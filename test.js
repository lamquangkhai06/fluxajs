import "./fake-dom.js";
import assert from "node:assert/strict";
import { serialize, fire, loc, setLocation, firePop } from "./fake-dom.js";
import {
  signal, computed, effect, onCleanup, untrack, createRoot, h, tags, svgTags,
  list, mount, onError, safeUrl, unsafeHTML,
} from "./fluxa.js";
import { createRouter, compileRoutes, matchRoute, parseQuery, sameOriginPath } from "./fluxa-router.js";

const tick = () => new Promise((r) => setTimeout(r, 0));
const errors = [];
onError((e) => errors.push(e.message));

let passed = 0;
const failed = [];
const test = async (name, fn) => {
  errors.length = 0;
  try {
    await fn();
    passed++;
    console.log("  ✓", name);
  } catch (e) {
    failed.push(name);
    console.log("  ✗", name, "\n     ", e.message);
  }
};

const { div, span, a, ul, li, input, button } = tags;
const render = (view) => {
  const root = document.createElement("div");
  const stop = mount(root, view);
  return { root, stop };
};
const els = (n) => n.childNodes.filter((c) => c.nodeType === 1);

console.log("Reactivity");

await test("signal + effect, gom nhiều lần ghi thành một lần chạy", async () => {
  const s = signal(1);
  const seen = [];
  effect(() => seen.push(s()));
  s.set(2); s.set(3); s.set(4);
  await tick();
  assert.deepEqual(seen, [1, 4]);
  s.set(4);
  await tick();
  assert.deepEqual(seen, [1, 4]);
});

await test("computed luôn mới khi đọc ngay và có cache", async () => {
  const x = signal(1), y = signal(2);
  const sum = computed(() => x() + y());
  assert.equal(sum(), 3);
  x.set(10);
  assert.equal(sum(), 12);
  let runs = 0;
  const dbl = computed(() => (runs++, sum() * 2));
  dbl(); dbl();
  assert.equal(runs, 1);
  x.set(0);
  assert.equal(dbl(), 4);
  assert.equal(runs, 2);
});

await test("effect phụ thuộc computed", async () => {
  const x = signal(1);
  const y = computed(() => x() * 2);
  const seen = [];
  effect(() => seen.push(y()));
  x.set(5);
  await tick();
  assert.deepEqual(seen, [2, 10]);
});

await test("computed phụ thuộc vòng bị chặn", () => {
  const c = computed(() => c());
  assert.throws(() => c(), /circular/);
});

await test("onCleanup và hàm dừng", async () => {
  let cleaned = 0;
  const s = signal(0);
  const stop = effect(() => { s(); onCleanup(() => cleaned++); });
  s.set(1);
  await tick();
  assert.equal(cleaned, 1);
  stop();
  assert.equal(cleaned, 2);
  s.set(2);
  await tick();
  assert.equal(cleaned, 2);
});

await test("effect lồng nhau không rò rỉ khi effect cha chạy lại", async () => {
  const outer = signal(0), inner = signal(0);
  let runs = 0;
  effect(() => { outer(); effect(() => { inner(); runs++; }); });
  outer.set(1);
  await tick();
  runs = 0;
  inner.set(1);
  await tick();
  assert.equal(runs, 1);
});

await test("untrack không đăng ký phụ thuộc", async () => {
  const s = signal(0);
  let runs = 0;
  effect(() => { untrack(() => s()); runs++; });
  s.set(1);
  await tick();
  assert.equal(runs, 1);
});

await test("lỗi trong một effect không làm hỏng effect khác", async () => {
  const s = signal(0);
  let ok = 0;
  effect(() => { if (s() > 0) throw new Error("boom"); });
  effect(() => { s(); ok++; });
  s.set(1);
  await tick();
  assert.equal(ok, 2);
  assert.ok(errors.includes("boom"));
});

await test("chống vòng lặp cập nhật vô hạn (không treo)", async () => {
  const s = signal(0);
  effect(() => { s.set(s() + 1); });
  await new Promise((r) => setTimeout(r, 30));
  assert.ok(errors.some((m) => m.includes("infinite")));
  assert.ok(s.peek() < 1000);
});

await test("createRoot dọn sạch effect bên trong", async () => {
  const s = signal(0);
  let runs = 0;
  const stop = createRoot(() => effect(() => { s(); runs++; }));
  stop();
  s.set(1);
  await tick();
  assert.equal(runs, 1);
});

console.log("\nBảo mật");

await test("văn bản không bao giờ được hiểu là HTML", () => {
  const evil = "<img src=x onerror=alert(1)>";
  const { root } = render(() => div(evil, () => evil));
  const d = root.childNodes[0];
  assert.equal(els(d).length, 0);
  assert.ok(d.textContent.includes(evil));
});

await test("chặn URL nguy hiểm, giữ URL an toàn", () => {
  const hrefOf = (v) => a({ href: v }).getAttribute("href");
  for (const bad of [
    "javascript:alert(1)", "JaVaScRiPt:alert(1)", "  javascript:alert(1)",
    "java\tscript:alert(1)", "java\nscript:alert(1)", "vbscript:msgbox(1)",
    "data:text/html,<script>alert(1)</script>",
  ]) {
    assert.equal(hrefOf(bad), null, `phải chặn: ${JSON.stringify(bad)}`);
  }
  for (const good of ["https://example.com/a?b=1", "http://x.y", "/relative", "relative/path", "#top", "mailto:a@b.c", "tel:+123", "?q=1"]) {
    assert.equal(hrefOf(good), good, `phải giữ: ${good}`);
  }
  assert.equal(tags.img({ src: "data:image/svg+xml,<svg onload=alert(1)>" }).getAttribute("src"), null);
  assert.equal(tags.form({ action: "javascript:alert(1)" }).getAttribute("action"), null);
  assert.equal(safeUrl("javascript:1"), null);
  assert.ok(errors.length > 0);
});

await test("sự kiện chỉ nhận hàm, chuỗi bị chặn", () => {
  const el = button({ onclick: "alert(1)" });
  assert.equal(el.listeners.click, undefined);
  assert.equal(el.getAttribute("onclick"), null);
  assert.ok(errors.length > 0);
  const f = () => {};
  assert.equal(button({ onClick: f }).listeners.click[0], f);
});

await test("chặn thẻ nguy hiểm", () => {
  assert.throws(() => tags.script, /blocked/);
  assert.throws(() => tags.style, /blocked/);
  assert.throws(() => h("SCRIPT"), /blocked/);
  assert.throws(() => h("object"), /blocked/);
  assert.throws(() => svgTags.foreignObject, /blocked/);
  assert.throws(() => h("di v"), /invalid tag/);
  assert.throws(() => tags.__proto__, /invalid tag/);
});

await test("iframe mặc định bị sandbox tối đa", () => {
  assert.equal(h("iframe", { src: "https://x.y" }).getAttribute("sandbox"), "");
  assert.equal(h("iframe", { sandbox: "allow-scripts" }).getAttribute("sandbox"), "allow-scripts");
});

await test("chặn innerHTML, srcdoc và prototype pollution", () => {
  const el = div({ innerHTML: "<b>x</b>", srcdoc: "<script>1</script>" }, "t");
  assert.equal(els(el).length, 0);
  assert.equal(el.textContent, "t");
  const bad = JSON.parse('{"__proto__": {"polluted": true}, "id": "ok"}');
  const el2 = div(bad);
  assert.equal({}.polluted, undefined);
  assert.equal(el2.getAttribute("id"), "ok");
  assert.ok(errors.length >= 3);
});

await test("target=_blank tự thêm rel=noopener noreferrer", () => {
  const el = a({ href: "https://x.y", target: "_blank" }, "x");
  assert.ok(el.getAttribute("rel").includes("noopener"));
  assert.ok(el.getAttribute("rel").includes("noreferrer"));
  const el2 = a({ href: "https://x.y", target: "_blank", rel: "nofollow" });
  const rel = el2.getAttribute("rel");
  assert.ok(rel.includes("nofollow") && rel.includes("noopener") && rel.includes("noreferrer"));
});

await test("SVG: đúng namespace, chặn animate href", () => {
  const c = svgTags.circle({ cx: 5, class: "c" });
  assert.equal(c.namespaceURI, "http://www.w3.org/2000/svg");
  assert.equal(c.getAttribute("cx"), "5");
  assert.equal(c.getAttribute("class"), "c");
  const an = svgTags.animate({ attributeName: "href", values: "javascript:alert(1)" });
  assert.equal(an.getAttribute("attributeName"), null);
  assert.ok(errors.some((m) => m.includes("attributeName")));
});

await test("unsafeHTML bắt buộc có hàm làm sạch", () => {
  assert.throws(() => unsafeHTML("<b>x</b>"), /sanitizer/);
});

console.log("\nDOM");

await test("văn bản, thuộc tính, style, value cập nhật đúng chỗ", async () => {
  const n = signal(0), cls = signal("a"), color = signal("red"), v = signal("x");
  const { root } = render(() =>
    div({ class: cls, "data-n": n, style: () => ({ color: color(), "--k": "1" }) }, span(n), input({ value: v }))
  );
  const d = root.childNodes[0];
  const sp = els(d)[0], inp = els(d)[1];
  const spanText = sp.childNodes.find((c) => c.nodeType === 3);
  n.set(5); cls.set("b"); color.set("blue"); v.set("y");
  await tick();
  assert.equal(d.className, "b");
  assert.equal(d.getAttribute("data-n"), "5");
  assert.equal(d.style.color, "blue");
  assert.equal(d.style["--k"], "1");
  assert.equal(sp.textContent, "5");
  assert.equal(inp.value, "y");
  assert.equal(sp.childNodes.find((c) => c.nodeType === 3), spanText, "nút chữ được tái sử dụng");
});

await test("chuyển nhánh điều kiện dọn effect cũ", async () => {
  const show = signal(true), n = signal(0);
  let runs = 0;
  render(() => div(() => (show() ? span(() => { runs++; return n(); }) : null)));
  assert.equal(runs, 1);
  n.set(1);
  await tick();
  assert.equal(runs, 2);
  show.set(false);
  await tick();
  n.set(2);
  await tick();
  assert.equal(runs, 2);
});

await test("mount trả về hàm gỡ", async () => {
  const n = signal(0);
  let runs = 0;
  const { root, stop } = render(() => div(() => { runs++; return n(); }));
  stop();
  assert.equal(root.childNodes.length, 0);
  n.set(1);
  await tick();
  assert.equal(runs, 1);
  assert.throws(() => mount("#khong-co", () => "x"), /not found/);
});

console.log("\nList có key");

const liTexts = (root) => els(root.childNodes[0]).map((n) => n.textContent);

await test("giữ DOM khi thêm / đổi thứ tự / xóa, cập nhật chỉ số", async () => {
  const A = { id: "A" }, B = { id: "B" }, C = { id: "C" }, D = { id: "D" };
  const items = signal([A, B, C]);
  let renders = 0;
  const { root } = render(() => ul(list(items, (it, i) => { renders++; return li(it.id, " ", () => i()); })));
  const lis = () => els(root.childNodes[0]);
  assert.deepEqual(liTexts(root), ["A 0", "B 1", "C 2"]);
  const [la, lb, lc] = lis();

  items.set((x) => [D, ...x]);
  await tick();
  assert.equal(renders, 4);
  assert.deepEqual(liTexts(root), ["D 0", "A 1", "B 2", "C 3"]);
  assert.ok(lis()[1] === la && lis()[2] === lb && lis()[3] === lc);

  items.set([C, A, D, B]);
  await tick();
  assert.equal(renders, 4, "đổi thứ tự không render lại");
  assert.deepEqual(liTexts(root), ["C 0", "A 1", "D 2", "B 3"]);
  assert.ok(lis()[0] === lc && lis()[1] === la && lis()[3] === lb);

  items.set((x) => x.filter((v) => v !== A));
  await tick();
  assert.deepEqual(liTexts(root), ["C 0", "D 1", "B 2"]);
  assert.equal(la.parentNode, null);

  items.set([]);
  await tick();
  assert.deepEqual(liTexts(root), []);
});

await test("giá trị nguyên thủy trùng lặp", async () => {
  const prims = signal(["a", "a", "b"]);
  const { root } = render(() => ul(list(prims, (v) => li(v))));
  assert.deepEqual(liTexts(root), ["a", "a", "b"]);
  prims.set(["b", "a"]);
  await tick();
  assert.deepEqual(liTexts(root), ["b", "a"]);
  prims.set(["z", "z", "z", "a"]);
  await tick();
  assert.deepEqual(liTexts(root), ["z", "z", "z", "a"]);
});

await test("effect của từng mục được dọn khi mục bị xóa", async () => {
  const n = signal(0), runs = {};
  const X = { k: "x" }, Y = { k: "y" };
  const items = signal([X, Y]);
  render(() => ul(list(items, (it) => {
    runs[it.k] = 0;
    effect(() => { n(); runs[it.k]++; });
    return li(it.k);
  })));
  n.set(1);
  await tick();
  assert.deepEqual(runs, { x: 2, y: 2 });
  items.set([X]);
  await tick();
  n.set(2);
  await tick();
  assert.deepEqual(runs, { x: 3, y: 2 });
});

await test("gỡ ứng dụng dọn cả effect trong list", async () => {
  const n = signal(0);
  let runs = 0;
  const items = signal([{}]);
  const { stop } = render(() => ul(list(items, () => { effect(() => { n(); runs++; }); return li("x"); })));
  stop();
  n.set(1);
  await tick();
  assert.equal(runs, 1);
});

await test("render có nội dung phản ứng ở gốc vẫn đúng khi đổi thứ tự", async () => {
  const P = { t: signal("p") }, Q = { t: signal("q") };
  const items = signal([P, Q]);
  const { root } = render(() => ul(list(items, (it) => () => it.t())));
  assert.equal(root.textContent, "pq");
  items.set([Q, P]);
  await tick();
  assert.equal(root.textContent, "qp");
  P.t.set("P2");
  await tick();
  assert.equal(root.textContent, "qP2");
});

console.log("\nRouter");

await test("matchRoute: tham số, ưu tiên route cụ thể, wildcard", () => {
  const t = compileRoutes({ "*": () => 0, "/user/:id": () => 1, "/user/new": () => 2, "/": () => 3, "/files/*": () => 4 });
  assert.equal(matchRoute(t, "/user/new").pattern, "/user/new");
  assert.equal(matchRoute(t, "/user/42").params.id, "42");
  assert.equal(matchRoute(t, "/").pattern, "/");
  assert.equal(matchRoute(t, "/files/a/b/c").params["*"], "a/b/c");
  assert.equal(matchRoute(t, "/zzz/y").pattern, "*");
  assert.equal(matchRoute(t, "/user/a%20b").params.id, "a b");
  assert.equal(matchRoute(t, "/user/%E0%A4%A").params.id, "%E0%A4%A", "mã % hỏng không gây lỗi");
  assert.equal(matchRoute(t, "/" + "a/".repeat(60)), null, "quá nhiều đoạn");
  assert.equal(matchRoute(t, "/" + "a".repeat(3000)), null, "đường dẫn quá dài");
  assert.equal(Object.getPrototypeOf(matchRoute(t, "/user/1").params), null);
  assert.throws(() => compileRoutes({ "/a/*/b": () => 0 }), /last/);
  assert.throws(() => compileRoutes({ "/a/:__proto__x y": () => 0 }), /param/);
});

await test("parseQuery không bị prototype pollution", () => {
  const q = parseQuery("?a=1&a=2&b=3&__proto__=x&constructor=y");
  assert.deepEqual(q.a, ["1", "2"]);
  assert.equal(q.b, "3");
  assert.equal({}.x, undefined);
  assert.equal(Object.getPrototypeOf(q), null);
  assert.equal(Object.keys(parseQuery("?" + Array.from({ length: 500 }, (_, i) => `k${i}=1`).join("&"))).length, 100);
});

await test("sameOriginPath chặn open redirect", () => {
  setLocation("http://localhost/");
  for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", "data:text/html,x", "http://localhost.evil.com/", "/\t/evil.com", 42]) {
    assert.equal(sameOriginPath(bad, loc), null, `phải chặn: ${JSON.stringify(bad)}`);
  }
  assert.equal(sameOriginPath("/ok?x=1#h", loc), "/ok?x=1#h");
  assert.equal(sameOriginPath("http://localhost/abs", loc), "/abs");
});

const pages = {
  "/": () => span("home"),
  "/user/:id": ({ params, query }) => span(`user ${params.id} tab=${query().tab || "-"}`),
  "/admin": () => span("admin"),
  "/login": () => span("login"),
  "*": () => span("404"),
};

await test("router (history): điều hướng, params, query, chặn điều hướng độc hại", async () => {
  setLocation("http://localhost/");
  const r = createRouter(pages);
  const { root } = render(() => div(r.view));
  assert.equal(root.textContent, "home");
  assert.equal(r.navigate("/user/5?tab=x"), true);
  await tick();
  assert.equal(root.textContent, "user 5 tab=x");
  assert.equal(loc.pathname, "/user/5");
  assert.equal(r.params().id, "5");
  assert.equal(r.navigate("/nope"), true);
  await tick();
  assert.equal(root.textContent, "404");
  const before = loc.href;
  for (const bad of ["//evil.com", "https://evil.com", "javascript:alert(1)", "/\\evil.com", "user/1", "", null]) {
    assert.equal(r.navigate(bad), false, `phải chặn: ${JSON.stringify(bad)}`);
  }
  assert.equal(loc.href, before);
  r.navigate("/user/6");
  await tick();
  loc.pathname = "/user/7"; // giả lập nút Back/Forward
  firePop();
  await tick();
  assert.equal(root.textContent, "user 7 tab=-");
  r.destroy();
});

await test("router: đổi query không dựng lại trang", async () => {
  setLocation("http://localhost/user/1");
  const r = createRouter({ "/user/:id": () => { builds++; return span("u"); } });
  let builds = 0;
  render(() => div(r.view));
  r.navigate("/user/1?x=1");
  await tick();
  assert.equal(builds, 1);
  r.destroy();
});

await test("router: guard chuyển hướng và chống vòng lặp", async () => {
  setLocation("http://localhost/");
  const r = createRouter(pages, { beforeEach: (d) => (d.path === "/admin" ? "/login" : true) });
  const { root } = render(() => div(r.view));
  r.navigate("/admin");
  await tick();
  assert.equal(loc.pathname, "/login");
  assert.equal(root.textContent, "login");
  r.destroy();
  const loop = createRouter(pages, { beforeEach: (d) => (d.path === "/a" ? "/b" : d.path === "/b" ? "/a" : true) });
  assert.equal(loop.navigate("/a"), false);
  loop.destroy();
  setLocation("http://localhost/admin");
  const init = createRouter(pages, { beforeEach: (d) => (d.path === "/admin" ? "/login" : true) });
  assert.equal(loc.pathname, "/login", "guard áp dụng cả địa chỉ ban đầu");
  init.destroy();
});

await test("router (hash): không cần cấu hình server", async () => {
  setLocation("http://localhost/index.html");
  const r = createRouter(pages, { mode: "hash" });
  const { root } = render(() => div(r.view));
  assert.equal(root.textContent, "home");
  r.navigate("/user/9?tab=z");
  await tick();
  assert.equal(loc.hash, "#/user/9?tab=z");
  assert.equal(root.textContent, "user 9 tab=z");
  assert.equal(r.link({ href: "/x" }, "x").getAttribute("href"), "#/x");
  assert.equal(r.navigate("//evil.com"), false);
  r.destroy();
});

await test("router: base path và link", async () => {
  setLocation("http://localhost/app/");
  const r = createRouter(pages, { base: "/app" });
  const { root } = render(() => div(r.view));
  assert.equal(root.textContent, "home");
  const l = r.link({ href: "/user/3" }, "go");
  assert.equal(l.getAttribute("href"), "/app/user/3");
  const ev = fire(l, "click");
  assert.equal(ev.defaultPrevented, true);
  await tick();
  assert.equal(loc.pathname, "/app/user/3");
  assert.equal(root.textContent, "user 3 tab=-");
  // click có phím bổ trợ: để trình duyệt xử lý
  const ev2 = fire(r.link({ href: "/" }, "x"), "click", { ctrlKey: true });
  assert.equal(ev2.defaultPrevented, false);
  // link ngoài đi qua bộ lọc URL
  assert.equal(r.link({ href: "javascript:alert(1)" }, "x").getAttribute("href"), null);
  assert.equal(r.link({ href: "https://example.com" }, "x").getAttribute("href"), "https://example.com");
  assert.throws(() => createRouter(pages, { base: "//evil.com" }), /invalid base/);
  r.destroy();
});

console.log(`\n${passed} test qua, ${failed.length} lỗi`);
if (failed.length) {
  console.log("Lỗi:", failed.join("; "));
  process.exit(1);
}
