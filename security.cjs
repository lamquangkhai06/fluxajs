// security.cjs - bộ kiểm thử XSS công khai trên Chromium thật.
// Ném hàng loạt payload tấn công vào mọi cửa mà Fluxa nhận dữ liệu (nội dung, thuộc tính, URL, style, tên thẻ,
// sự kiện, khóa store, router) rồi kiểm tra: không có mã nào chạy, không có thẻ/thuộc tính nguy hiểm nào lọt vào DOM.
// Trang thử chạy dưới CSP nghiêm ngặt + Trusted Types. Cách chạy:  node security.cjs   (cần playwright + chromium)
const http = require("http"), fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const ROOT = __dirname;

const PAGE_JS = String.raw`
import { tags, h, signal, mount, createStore, model, unsafeHTML, onError, svgTags } from "/fluxa.js";
import { createRouter } from "/fluxa-router.js";
window.__pwned = 0;
const blockedMsgs = [];
onError((e) => blockedMsgs.push(String(e && e.message)));
const { div, span, p, a, img, input } = tags;
const P = (n) => "window.__pwned++";
const XSS = [
  "<img src=x onerror=window.__pwned++>", "<script>window.__pwned++</script>", "\"><svg onload=window.__pwned++>",
  "<iframe srcdoc=\"<script>parent.__pwned++</script>\"></iframe>", "'-window.__pwned++-'", "<a href=javascript:window.__pwned++>x</a>",
  "<math><mtext><style><img src=x onerror=window.__pwned++></style></mtext></math>", "<details open ontoggle=window.__pwned++>",
  "<body onload=window.__pwned++>", "</textarea><img src=x onerror=window.__pwned++>", "&lt;img src=x onerror=window.__pwned++&gt;",
];
// Lưu ý: URL tuyệt đối http(s) tới host khác (kể cả "//host/x") là hợp lệ theo thiết kế, việc giới hạn host là của CSP.
const URLS = [
  "javascript:window.__pwned++", "JaVaScRiPt:window.__pwned++", " javascript:window.__pwned++", "java\tscript:window.__pwned++",
  "java\nscript:window.__pwned++", "\u0001javascript:window.__pwned++", "data:text/html,<script>parent.__pwned++</script>",
  "vbscript:msgbox(1)", "jar:http://evil.example!/", "blob:http://evil.example/x",
];
const list = [];
const rows = [];
const results = {};

// 1) payload làm nội dung (chuỗi, signal, hàm, mảng)
const sig = signal(XSS[0]);
rows.push(div({ id: "t-text" }, ...XSS, sig, () => XSS[1], [XSS[2], [XSS[3]]]));
// 2) payload làm giá trị thuộc tính an toàn, class, id, style, title
rows.push(div({ id: "t-attr", title: XSS[0], class: XSS[2], style: XSS[1], "data-x": XSS[4], "aria-label": XSS[5] }, "x"));
rows.push(div({ id: "t-style-obj", style: { color: XSS[0], "background-image": "url(javascript:window.__pwned++)", "__proto__": "x", constructor: "y" } }, "x"));
// 3) payload URL vào mọi thuộc tính URL
for (const u of URLS) {
  rows.push(a({ href: u }, "a"), img({ src: u }), tags.form({ action: u }, tags.button({ formaction: u }, "b")), tags.video({ poster: u }));
  rows.push(h("iframe", { src: u }), h("a", { href: () => u, target: "_blank" }, "r"));
}
// 4) sự kiện dạng chuỗi và thuộc tính bị cấm
const bad = {};
for (const k of ["onclick", "onerror", "onload", "onmouseover", "ONCLICK", "onfocus"]) bad[k] = "window.__pwned++";
rows.push(h("div", { ...bad, innerHTML: XSS[0], outerHTML: XSS[0], srcdoc: XSS[0], srcset: XSS[0], ping: "http://evil.example" }, "x"));
rows.push(h("img", { src: "x", onerror: "window.__pwned++" }));
// 5) tên thẻ / tên thuộc tính độc hại
const thrown = [];
for (const t of ["script", "style", "object", "embed", "applet", "base", "meta", "link", "frame", "frameset", "foreignObject", "SCRIPT", "img src=x onerror=1", "a b", "", "<script>"]) {
  try { rows.push(h(t, null, "x")); } catch (e) { thrown.push(t); }
}
rows.push(h("div", { "x onerror=window.__pwned++": "1", '"><script>': "1", "a/b": "1" }, "x"));
// 6) SVG animate -> href
rows.push(svgTags.svg({}, svgTags.a({}, svgTags.animate({ attributeName: "href", values: "javascript:window.__pwned++" })), svgTags.set({ attributeName: "onclick", to: "window.__pwned++" })));
// 7) iframe tự sandbox; target=_blank tự có rel
rows.push(h("iframe", { src: "https://example.invalid/" }));
rows.push(h("a", { href: "https://example.invalid/", target: "_blank", rel: "opener" }, "t"));
// 8) prototype pollution qua store / model
const store = createStore({});
const pol = [];
for (const k of ["__proto__", "constructor", "prototype"]) { try { store[k] = { polluted: 1 }; } catch { pol.push(k); } try { model(store, k); } catch { pol.push("m:" + k); } }
try { JSON.parse('{"__proto__":{"polluted":1}}'); } catch {}
try { store.__proto__.polluted = 1; } catch {}
// 9) payload qua ô nhập hai chiều
const bound = signal("");
rows.push(input({ value: bound }));
bound.set(XSS[0]);
// 10) router
const r = createRouter({ "/": () => div("home"), "*": () => div("nf") }, { mode: "hash" });
const redirects = ["//evil.example", "/\\evil.example", "javascript:window.__pwned++", "https://evil.example", "\\\\evil.example", "/\t/evil.example", "http:evil.example"];
const navOk = redirects.map((u) => r.navigate(u));
rows.push(div({ id: "t-router" }, r.view));
// 11) unsafeHTML dưới Trusted Types
let ttOk = false, ttRawBlocked = false, ttNoSan = false;
const sanitize = (s) => s.replace(/<(?!\/?b>)[^>]*>/g, "");
const frag = unsafeHTML("<b>ok</b><img src=x onerror=window.__pwned++>", sanitize);
ttOk = frag.querySelector("b") !== null && frag.querySelector("img") === null;
try { document.createElement("template").innerHTML = "<b>raw</b>"; } catch { ttRawBlocked = true; }
try { unsafeHTML("<b>x</b>"); } catch { ttNoSan = true; }

mount("#app", () => div(...rows));
// kích hoạt mọi thứ có thể kích hoạt
await new Promise((ok) => setTimeout(ok, 50));
for (const el of document.querySelectorAll("#app *")) { try { el.click(); el.dispatchEvent(new Event("error")); el.dispatchEvent(new Event("load")); el.focus && el.focus(); } catch {} }
await new Promise((ok) => setTimeout(ok, 100));

const all = [...document.querySelectorAll("#app *")];
const URL_ATTRS = ["href", "src", "action", "formaction", "poster", "xlink:href", "data", "background", "cite", "manifest"];
const attrsOf = (el) => [...el.attributes].map((x) => [x.name.toLowerCase(), x.value]);
results.pwned = window.__pwned;
results.scripts = document.querySelectorAll("#app script").length;
results.forbiddenTags = all.filter((e) => /^(script|style|object|embed|applet|base|meta|link|frame|frameset|foreignobject)$/i.test(e.tagName)).length;
results.onAttrs = all.filter((e) => attrsOf(e).some(([n]) => n.startsWith("on"))).length;
results.badAttrNames = all.filter((e) => attrsOf(e).some(([n]) => /["'<>\s]/.test(n))).length;
results.dangerousAttrs = all.filter((e) => attrsOf(e).some(([n]) => ["innerhtml", "outerhtml", "srcdoc", "srcset", "ping"].includes(n))).length;
results.badUrls = all.filter((e) => attrsOf(e).some(([n, v]) => URL_ATTRS.includes(n) && !/^(https?:|mailto:|tel:|\/(?![\/\\])|#|\.{0,2}\/?[\w-]*$|\?)/i.test(v.trim()) && v !== "")).length;
results.jsUrls = all.filter((e) => attrsOf(e).some(([n, v]) => !["values", "to", "from", "by"].includes(n) && /^\s*(javascript|vbscript|data):/i.test(v.replace(/[\u0000- ]/g, "")))).length;
results.animDanger = all.filter((e) => /^(animate|set|animatetransform|animatemotion)$/i.test(e.tagName) && /^(href|xlink:href|on)/i.test(e.getAttribute("attributeName") || "")).length;
results.iframesUnsandboxed = all.filter((e) => e.tagName === "IFRAME" && !e.hasAttribute("sandbox")).length;
results.iframeSandboxLoose = all.filter((e) => e.tagName === "IFRAME" && /allow-scripts/.test(e.getAttribute("sandbox") || "")).length;
const blank = all.filter((e) => e.tagName === "A" && e.getAttribute("target") === "_blank");
results.blankNoRel = blank.filter((e) => !/noopener/.test(e.rel) || !/noreferrer/.test(e.rel)).length;
results.blankCount = blank.length;
results.textIsText = document.querySelector("#t-text").textContent.includes("<img src=x onerror=window.__pwned++>") && document.querySelector("#t-text img") === null;
results.protoClean = ({}).polluted === undefined && Object.prototype.polluted === undefined;
results.storeThrew = pol.length;
results.tagsThrown = thrown.length;
results.navBlocked = navOk.every((v) => v === false);
results.hashAfter = location.hash;
results.ttOk = ttOk; results.ttRawBlocked = ttRawBlocked; results.ttNoSan = ttNoSan;
results.reports = blockedMsgs.length;
results.nodes = all.length;
window.__results = results;
`;

const HTML = `<!doctype html><meta charset="utf-8"><title>sec</title><div id="app"></div><script type="module" src="/__sec.js"></script>`;
const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; require-trusted-types-for 'script'; trusted-types fluxa";
const server = http.createServer((req, res) => {
  const u = req.url.split("?")[0];
  if (u === "/") { res.writeHead(200, { "content-type": "text/html", "content-security-policy": CSP }); return res.end(HTML); }
  if (u === "/__sec.js") { res.writeHead(200, { "content-type": "text/javascript" }); return res.end(PAGE_JS); }
  const f = path.join(ROOT, u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": u.endsWith(".js") ? "text/javascript" : "text/plain" });
  fs.createReadStream(f).pipe(res);
});

let failed = 0;
const check = (name, ok, extra = "") => { if (!ok) failed++; console.log(ok ? "  ✓" : "  ✗", name, ok ? "" : extra); };

(async () => {
  await new Promise((r) => server.listen(0, r));
  const browser = await chromium.launch();
  const page = await browser.newPage();
  let dialogs = 0;
  const popups = [], requests = [], pageErrors = [];
  page.on("dialog", async (d) => { dialogs++; await d.dismiss(); });
  page.on("popup", (p) => popups.push(p.url()));
  page.on("pageerror", (e) => pageErrors.push(e.message));
  page.on("request", (r) => { if (/evil\.example/.test(r.url())) requests.push(r.url()); });
  await page.goto(`http://localhost:${server.address().port}/`);
  await page.waitForFunction(() => window.__results, null, { timeout: 15000 }).catch(() => {});
  const R = await page.evaluate(() => window.__results);
  if (!R) { console.log("  ✗ trang thử không chạy xong:", pageErrors.join("; ")); process.exit(1); }

  console.log(`Bộ kiểm thử XSS trên Chromium thật (${R.nodes} phần tử được dựng từ payload tấn công)\n`);
  check("không có mã nào chạy (window.__pwned === 0)", R.pwned === 0, "pwned=" + R.pwned);
  check("không có hộp thoại alert/confirm/prompt", dialogs === 0);
  check("không mở cửa sổ/popup lạ", popups.length === 0, popups.join());
  check("không có yêu cầu mạng nào tới máy chủ kẻ tấn công", requests.length === 0, requests.join());
  check("payload làm nội dung luôn là chữ thuần", R.textIsText);
  check("không có thẻ <script> nào trong DOM", R.scripts === 0);
  check("không có thẻ bị cấm (style, object, embed, base, meta, link, frame...)", R.forbiddenTags === 0, R.forbiddenTags);
  check("không phần tử nào có thuộc tính on*", R.onAttrs === 0, R.onAttrs);
  check("không có thuộc tính tên bất thường (chứa dấu nháy, <, >, khoảng trắng)", R.badAttrNames === 0, R.badAttrNames);
  check("innerHTML/outerHTML/srcdoc/srcset/ping không thành thuộc tính", R.dangerousAttrs === 0, R.dangerousAttrs);
  check("mọi thuộc tính URL chỉ chứa http(s)/mailto/tel/tương đối", R.badUrls === 0, R.badUrls);
  check("không có javascript:/vbscript:/data: ở bất kỳ thuộc tính nào", R.jsUrls === 0, R.jsUrls);
  check("animate/set không mang attributeName trỏ tới href hoặc on*", R.animDanger === 0, R.animDanger);
  check("mọi iframe đều có sandbox", R.iframesUnsandboxed === 0, R.iframesUnsandboxed);
  check("sandbox mặc định không cho phép script", R.iframeSandboxLoose === 0);
  check(`target=_blank luôn có rel noopener noreferrer (${R.blankCount} liên kết)`, R.blankNoRel === 0, R.blankNoRel);
  check("tên thẻ độc hại bị từ chối (16 tên thử)", R.tagsThrown >= 10, R.tagsThrown);
  check("store và model từ chối __proto__/constructor/prototype", R.storeThrew >= 6, R.storeThrew);
  check("Object.prototype không bị ô nhiễm", R.protoClean);
  check("router chặn mọi open redirect và javascript:", R.navBlocked && !/evil/.test(R.hashAfter), R.hashAfter);
  check("Trusted Types: CSP đang thực thi (gán innerHTML thô bị từ chối)", R.ttRawBlocked);
  check("Trusted Types: unsafeHTML + hàm làm sạch chạy được và loại payload", R.ttOk);
  check("unsafeHTML không có hàm làm sạch thì bị từ chối", R.ttNoSan);
  check("framework báo cáo các chỗ bị chặn qua onError", R.reports > 20, R.reports);
  check("không có lỗi JavaScript ngoài ý muốn", pageErrors.length === 0, pageErrors.join("; "));

  await browser.close();
  server.close();
  console.log(`\n${failed ? failed + " kiểm tra THẤT BẠI" : "Tất cả kiểm tra bảo mật qua"}`);
  process.exit(failed ? 1 : 0);
})();
