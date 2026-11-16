import "./fake-dom.js";
import assert from "node:assert/strict";
import { signal, h, mount, tags, effect, onError } from "./fluxa.js";
import { persist, form, rules, createI18n, createTheme, debounced, media, online, history } from "./fluxa-extras.js";
import { serialize } from "./fake-dom.js";

const tick = () => new Promise((r) => setTimeout(r, 0));
const errors = [];
onError((e) => errors.push(e.message));
let passed = 0;
const failed = [];
const test = async (name, fn) => {
  try { await fn(); passed++; console.log("  ✓", name); }
  catch (e) { failed.push(name); console.log("  ✗", name, "\n     ", e.message); }
};
// bộ nhớ giả có cùng giao diện với localStorage
const mem = (init = {}) => {
  const m = new Map(Object.entries(init));
  return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};

console.log("persist");
await test("đọc giá trị đã lưu, ghi lại khi đổi", async () => {
  const st = mem({ n: "41" });
  const n = persist(signal(0), "n", { storage: st });
  assert.equal(n(), 41);
  n.set(42); await tick();
  assert.equal(st.m.get("n"), "42");
});
await test("chưa có dữ liệu thì giữ giá trị ban đầu và lưu nó", async () => {
  const st = mem();
  persist(signal({ a: 1 }), "k", { storage: st });
  assert.equal(st.m.get("k"), '{"a":1}');
});
await test("dữ liệu hỏng hoặc quá lớn bị bỏ qua, không báo lỗi", async () => {
  const bad = persist(signal("mặc định"), "x", { storage: mem({ x: "{không phải json" }) });
  assert.equal(bad(), "mặc định");
  const huge = persist(signal("nhỏ"), "x", { storage: mem({ x: JSON.stringify("a".repeat(1_000_001)) }) });
  assert.equal(huge(), "nhỏ");
});
await test("khóa __proto__/constructor/prototype trong dữ liệu đã lưu bị loại bỏ", async () => {
  const st = mem({ k: '{"a":1,"__proto__":{"polluted":1},"constructor":{"prototype":{"polluted2":1}},"deep":{"__proto__":{"p3":1}}}' });
  const s = persist(signal({}), "k", { storage: st });
  assert.equal(s().a, 1);
  assert.equal(Object.prototype.hasOwnProperty.call(s(), "__proto__"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(s(), "constructor"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(s().deep, "__proto__"), false);
  assert.equal(({}).polluted, undefined);
  assert.equal(({}).polluted2, undefined);
  assert.equal(({}).p3, undefined);
});
await test("không có storage hoặc storage ném lỗi: vẫn chạy bình thường", async () => {
  const a = persist(signal(1), "k", { storage: null });
  a.set(2); assert.equal(a(), 2);
  const boom = { getItem() { throw new Error("chặn"); }, setItem() { throw new Error("đầy"); }, removeItem() { throw new Error("x"); } };
  const b = persist(signal(1), "k", { storage: boom });
  b.set(5); await tick();
  assert.equal(b(), 5);
});
await test("revive và save chuyển đổi dữ liệu; set undefined thì xóa khóa", async () => {
  const st = mem({ k: "[1,2]" });
  const s = persist(signal([]), "k", { storage: st, revive: (v) => v.map((x) => x * 10), save: (v) => v.map((x) => x / 10) });
  assert.deepEqual(s(), [10, 20]);
  assert.equal(st.m.get("k"), "[1,2]");
  const u = persist(signal(1), "u", { storage: st });
  u.set(undefined); await tick();
  assert.equal(st.m.has("u"), false);
});
await test("tham số sai thì báo lỗi rõ ràng", () => {
  assert.throws(() => persist(() => 1, "k"), TypeError);
  assert.throws(() => persist(signal(1), ""), TypeError);
  assert.throws(() => persist(signal(1), 5), TypeError);
});

console.log("\nform");
await test("lỗi chỉ hiện sau khi sửa trường hoặc bấm gửi", async () => {
  const f = form({ email: ["", rules.required(), rules.email()] });
  assert.equal(f.email.error(), "");
  assert.equal(f.valid(), false);
  f.email.value.set("abc"); await tick();
  assert.equal(f.email.error(), "Email không hợp lệ");
  f.email.value.set("a@b.co"); await tick();
  assert.equal(f.email.error(), "");
  assert.equal(f.valid(), true);
});
await test("submit: không hợp lệ thì không gọi handler và hiện lỗi; hợp lệ thì gọi với dữ liệu", async () => {
  const f = form({ name: ["", rules.required("Nhập tên")], age: [20, rules.min(18)] });
  let got = null; const ev = { prevented: false, preventDefault() { this.prevented = true; } };
  await f.submit((d) => (got = d))(ev);
  assert.equal(ev.prevented, true);
  assert.equal(got, null);
  assert.equal(f.name.error(), "Nhập tên");
  f.name.value.set("Lan");
  await f.submit((d) => (got = d))(ev);
  assert.deepEqual(got, { name: "Lan", age: 20 });
});
await test("submit bất đồng bộ: submitting bật rồi tắt, chặn bấm đúp", async () => {
  let calls = 0, release;
  const f = form({ a: ["x"] }, { onSubmit: () => { calls++; return new Promise((ok) => (release = ok)); } });
  const go = f.submit();
  const p1 = go(); await tick();
  assert.equal(f.submitting(), true);
  go(); await tick();
  assert.equal(calls, 1, "bấm đúp không được gửi hai lần");
  release(); await p1;
  assert.equal(f.submitting(), false);
});
await test("handler ném lỗi thì submitting vẫn được tắt", async () => {
  const f = form({ a: ["x"] });
  await assert.rejects(f.submit(() => { throw new Error("lỗi máy chủ"); })(), /lỗi máy chủ/);
  assert.equal(f.submitting(), false);
});
await test("reset đưa về giá trị đầu và xóa trạng thái đã gửi", async () => {
  const f = form({ a: ["", rules.required()] });
  f.a.value.set("x"); await f.submit(() => {})();
  f.reset();
  assert.equal(f.a.value(), "");
  assert.equal(f.submitted(), false);
  assert.equal(f.a.error(), "");
});
await test("các luật: minLength, maxLength, pattern, number, max, matches, luật tự viết", () => {
  assert.equal(rules.minLength(3)("ab"), "Tối thiểu 3 ký tự");
  assert.equal(rules.minLength(3)(""), "", "trường trống để luật required lo");
  assert.equal(rules.maxLength(2)("abc"), "Tối đa 2 ký tự");
  assert.equal(rules.pattern(/^\d+$/)("12a"), "Không đúng định dạng");
  assert.equal(rules.number()("1e3"), "");
  assert.equal(rules.number()("abc"), "Phải là số");
  assert.equal(rules.number()(true), "Phải là số");
  assert.equal(rules.max(5)("9"), "Phải từ 5 trở xuống");
  const f = form({ p: ["a"], q: ["b", rules.matches("p", "Mật khẩu không khớp")], r: ["", (v) => (v === "cấm" ? "Từ bị cấm" : "")] });
  f.q.value.set("c"); f.r.value.set("cấm");
  assert.equal(f.q.error(), "Mật khẩu không khớp");
  assert.equal(f.r.error(), "Từ bị cấm");
});
await test("pattern/email từ chối chuỗi quá dài mà không chạy biểu thức chính quy", () => {
  let ran = 0;
  const spy = { test: () => (ran++, true) };
  assert.equal(rules.pattern(spy, "dài quá")("a".repeat(5000)), "dài quá");
  assert.equal(ran, 0, "chuỗi quá dài không được đưa vào regex");
  assert.equal(rules.email()("a@b.co" + "x".repeat(300)), "Email không hợp lệ");
  assert.equal(rules.email()("a".repeat(100) + "@" + "b".repeat(100) + ".co"), "");
});
await test("tên trường nguy hiểm hoặc trùng tên API bị từ chối", () => {
  for (const n of ["__proto__", "constructor", "prototype", "values", "submit", "reset", "valid"]) assert.throws(() => form({ [n]: [""] }), TypeError, n);
  assert.throws(() => form({ a: ["", "không phải hàm"] }), TypeError);
  assert.throws(() => form(null), TypeError);
});
await test("hoạt động trong giao diện: nhập liệu cập nhật lỗi trên màn hình", async () => {
  const f = form({ email: ["", rules.email()] });
  const root = document.createElement("div");
  mount(root, () => tags.div(tags.input({ value: f.email.value }), tags.p(f.email.error)));
  const input = root.childNodes[0].childNodes.find((n) => n.tagName === "INPUT");
  input.value = "sai"; input.listeners.input.forEach((fn) => fn({}));
  await tick();
  assert.ok(serialize(root).includes("Email không hợp lệ"));
});

console.log("\ni18n");
const msgs = {
  vi: { chao: "Xin chào, {ten}!", menu: { home: "Trang chủ" }, mon: { other: "{count} món" }, chi_vi: "chỉ có tiếng Việt" },
  en: { chao: "Hello, {ten}!", menu: { home: "Home" }, mon: { one: "{count} item", other: "{count} items" } },
};
await test("dịch, tham số, khóa lồng nhau, đổi ngôn ngữ", () => {
  const i = createI18n(msgs, { locale: "vi" });
  assert.equal(i.t("chao", { ten: "Lan" }), "Xin chào, Lan!");
  assert.equal(i.t("menu.home"), "Trang chủ");
  i.setLocale("en");
  assert.equal(i.t("chao", { ten: "Lan" }), "Hello, Lan!");
  assert.equal(i.locale(), "en");
});
await test("số nhiều, thiếu khóa trả về chính khóa, thiếu tham số giữ nguyên {ten}", () => {
  const i = createI18n(msgs, { locale: "en" });
  assert.equal(i.t("mon", { count: 1 }), "1 item");
  assert.equal(i.t("mon", { count: 3 }), "3 items");
  assert.equal(i.t("khong.co"), "khong.co");
  assert.equal(i.t("chao"), "Hello, {ten}!");
});
await test("fallback khi ngôn ngữ hiện tại thiếu khóa", () => {
  const i = createI18n(msgs, { locale: "en", fallback: "vi" });
  assert.equal(i.t("chi_vi"), "chỉ có tiếng Việt");
});
await test("không đọc nhầm khóa kế thừa; tham số chỉ là chữ thuần", () => {
  const i = createI18n(msgs, { locale: "vi" });
  assert.equal(i.t("constructor"), "constructor");
  assert.equal(i.t("__proto__.x"), "__proto__.x");
  assert.equal(i.t("chao", { ten: "<img src=x onerror=alert(1)>" }), "Xin chào, <img src=x onerror=alert(1)>!");
  assert.equal(i.t("chao", { ten: { toString: () => "ok" } }), "Xin chào, ok!");
});
await test("ngôn ngữ sai bị từ chối, mã ngôn ngữ lạ bị từ chối", () => {
  const i = createI18n(msgs, { locale: "vi" });
  assert.throws(() => i.setLocale("fr"), TypeError);
  assert.throws(() => i.setLocale("__proto__"), TypeError);
  assert.throws(() => createI18n({ "<x>": {} }), TypeError);
  assert.throws(() => createI18n({}), TypeError);
});
await test("text() tự cập nhật giao diện khi đổi ngôn ngữ", async () => {
  const i = createI18n(msgs, { locale: "vi" });
  const root = document.createElement("div");
  mount(root, () => tags.p(i.text("menu.home")));
  assert.equal(serialize(root), "<div><p>Trang chủ</p></div>");
  i.setLocale("en"); await tick();
  assert.equal(serialize(root), "<div><p>Home</p></div>");
});
await test("nhớ ngôn ngữ đã chọn; giá trị lạ trong bộ nhớ bị bỏ qua; đặt lang cho <html>", async () => {
  const html = document.createElement("html"); document.documentElement = html;
  const st = mem({ lng: '"en"' });
  const i = createI18n(msgs, { locale: "vi", persistKey: "lng", storage: st });
  assert.equal(i.locale(), "en");
  assert.equal(html.getAttribute("lang"), "en");
  const j = createI18n(msgs, { locale: "vi", persistKey: "lng2", storage: mem({ lng2: '"zz"' }) });
  assert.equal(j.locale(), "vi");
  delete document.documentElement;
});
await test("định dạng số và ngày theo ngôn ngữ", () => {
  const i = createI18n(msgs, { locale: "vi" });
  assert.equal(i.n(1234567.5), "1.234.567,5");
  i.setLocale("en");
  assert.equal(i.n(1234567.5), "1,234,567.5");
  assert.match(i.date(new Date(Date.UTC(2026, 0, 5, 12)), { timeZone: "UTC", dateStyle: "medium" }), /Jan 5, 2026/);
});

console.log("\ntheme");
const fakeMedia = (matches) => { const l = []; return { matches, addEventListener: (_, f) => l.push(f), fire(m) { this.matches = m; l.forEach((f) => f({ matches: m })); } }; };
await test("auto theo hệ điều hành và đổi theo khi hệ điều hành đổi", async () => {
  const html = document.createElement("html"); document.documentElement = html;
  const mq = fakeMedia(false);
  const th = createTheme({ storage: mem(), media: mq });
  assert.equal(th.resolved(), "light");
  assert.equal(html.getAttribute("data-theme"), "light");
  mq.fire(true); await tick();
  assert.equal(th.resolved(), "dark");
  assert.equal(html.getAttribute("data-theme"), "dark");
  delete document.documentElement;
});
await test("toggle, setMode, nhớ lựa chọn; giá trị lạ bị từ chối", async () => {
  const st = mem();
  const th = createTheme({ storage: st, media: fakeMedia(false) });
  th.toggle(); await tick();
  assert.equal(th.resolved(), "dark");
  assert.equal(st.m.get("fluxa-theme"), '"dark"');
  th.setMode("auto"); assert.equal(th.mode(), "auto");
  assert.throws(() => th.setMode("<script>"), TypeError);
  assert.throws(() => th.setMode("__proto__"), TypeError);
  const again = createTheme({ storage: mem({ "fluxa-theme": '"dark"' }), media: fakeMedia(false) });
  assert.equal(again.resolved(), "dark");
  const junk = createTheme({ storage: mem({ "fluxa-theme": '"<script>"' }), media: fakeMedia(false) });
  assert.equal(junk.mode(), "auto");
});
await test("không có matchMedia vẫn chạy (mặc định sáng)", () => {
  const th = createTheme({ storage: null });
  assert.equal(th.resolved(), "light");
});

console.log("debounced / media / online / history");
await test("debounced chỉ đổi sau khi nguồn đứng yên", async () => {
  const q = signal("a"); const d = debounced(q, 20);
  assert.equal(d(), "a");
  q.set("ab"); q.set("abc");
  await tick(); assert.equal(d(), "a");
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(d(), "abc");
});
await test("media theo dõi sự kiện change; không có matchMedia thì false", () => {
  assert.equal(media("(max-width:600px)", { matchMedia: null })(), false);
  let cb; const mql = { matches: true, addEventListener: (_, f) => (cb = f), removeEventListener() {} };
  const m = media("(max-width:600px)", { matchMedia: () => mql });
  assert.equal(m(), true);
  cb({ matches: false }); assert.equal(m(), false);
});
await test("online đổi theo sự kiện online/offline", () => {
  const ls = {}; const target = { addEventListener: (n, f) => (ls[n] = f), removeEventListener() {} };
  const o = online({ target });
  ls.offline(); assert.equal(o(), false);
  ls.online(); assert.equal(o(), true);
});
await test("history: undo, redo, giới hạn bước, sửa mới xóa redo", async () => {
  const s = signal(0); const hs = history(s, { limit: 3 });
  assert.equal(hs.canUndo(), false);
  for (const v of [1, 2, 3, 4]) { s.set(v); await tick(); }
  hs.undo(); assert.equal(s(), 3); await tick();
  hs.undo(); hs.undo(); assert.equal(s(), 1); await tick();
  assert.equal(hs.canUndo(), false, "chỉ nhớ 3 bước nên không lùi về 0");
  hs.redo(); assert.equal(s(), 2); assert.equal(hs.canRedo(), true);
  s.set(99); await tick();
  assert.equal(hs.canRedo(), false);
  hs.undo(); assert.equal(s(), 2);
  hs.clear(); assert.equal(hs.canUndo(), false);
});

console.log(`\n${passed} test qua, ${failed.length} lỗi`);
process.exit(failed.length ? 1 : 0);
