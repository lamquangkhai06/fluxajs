// Test cho các component bổ sung 0.10: Textarea, RadioGroup, Switch, Slider, Rating, Accordion, Breadcrumb, Drawer, Stepper, Popover.
import "./fake-dom.js";
import assert from "node:assert/strict";
import { fire, fireDoc, docListenerCount } from "./fake-dom.js";
import { signal, h, mount, onError } from "./fluxa.js";
import { Textarea, RadioGroup, Switch, Slider, Rating, Accordion, Breadcrumb, Drawer, Stepper, Popover } from "./fluxa-components.js";

const tick = () => new Promise((r) => setTimeout(r, 0));
const errors = [];
onError((e) => errors.push(e.message));
let passed = 0;
const failed = [];
const test = async (name, fn) => {
  errors.length = 0;
  try { await fn(); passed++; console.log("  ✓", name); }
  catch (e) { failed.push(name); console.log("  ✗", name, "\n     ", e.message); }
};
const render = (view) => { const root = document.createElement("div"); const stop = mount(root, view); return { root, stop }; };
const kids = (n) => n.childNodes.filter((c) => c.nodeType === 1);
const find = (n, pred) => { for (const c of kids(n)) { if (pred(c)) return c; const r = find(c, pred); if (r) return r; } return null; };
const findAll = (n, pred, out = []) => { for (const c of kids(n)) { if (pred(c)) out.push(c); findAll(c, pred, out); } return out; };
const byTag = (n, t) => find(n, (e) => e.tagName === t.toUpperCase());
const byRole = (n, r) => find(n, (e) => e.getAttribute("role") === r);

console.log("Form bổ sung");

await test("Textarea: nhãn liên kết, ép rows, bộ đếm, hai chiều, lỗi có aria", async () => {
  const text = signal("abc"), err = signal("");
  const { root } = render(() => h(Textarea, { label: "Mô tả", value: text, rows: 999, maxlength: 50, error: err }));
  const ta = byTag(root, "textarea");
  const label = byTag(root, "label");
  assert.equal(label.getAttribute("for"), ta.getAttribute("id"));
  assert.equal(ta.getAttribute("rows"), "40", "rows bị giới hạn");
  assert.equal(ta.getAttribute("maxlength"), "50");
  assert.equal(find(root, (e) => e.className === "counter").textContent, "3/50");
  ta.value = "xin chào"; fire(ta, "input", { target: ta }); await tick();
  assert.equal(text(), "xin chào");
  assert.equal(find(root, (e) => e.className === "counter").textContent, "8/50");
  err.set("Bắt buộc"); await tick();
  assert.equal(ta.getAttribute("aria-invalid"), "true");
  assert.equal(byRole(root, "alert").textContent, "Bắt buộc");
  assert.equal(errors.length, 0);
});

await test("RadioGroup: chọn một, hai chiều, tùy chọn bị khóa, bắt buộc có signal", async () => {
  const v = signal("b");
  const { root } = render(() => h(RadioGroup, { label: "Cỡ", value: v, options: ["a", { value: "b", label: "Bê" }, { value: "c", disabled: true }] }));
  const radios = findAll(root, (e) => e.tagName === "INPUT");
  assert.equal(radios.length, 3);
  assert.equal(new Set(radios.map((r) => r.getAttribute("name"))).size, 1, "cùng name");
  assert.deepEqual(radios.map((r) => r.checked), [false, true, false]);
  assert.equal(radios[2].hasAttribute("disabled"), true);
  radios[0].checked = true; fire(radios[0], "change", { target: radios[0] }); await tick();
  assert.equal(v(), "a");
  assert.deepEqual(radios.map((r) => r.checked), [true, false, false]);
  assert.equal(byTag(root, "legend").textContent, "Cỡ");
  assert.throws(() => h(RadioGroup, { options: ["x"] }), /value/);
});

await test("Switch: role=switch, aria-checked theo signal, hai chiều", async () => {
  const on = signal(false);
  const { root } = render(() => h(Switch, { checked: on, label: "Thông báo" }));
  const input = byTag(root, "input");
  assert.equal(input.getAttribute("role"), "switch");
  assert.equal(input.getAttribute("aria-checked"), "false");
  input.checked = true; fire(input, "change", { target: input }); await tick();
  assert.equal(on(), true);
  assert.equal(input.getAttribute("aria-checked"), "true");
  on.set(false); await tick();
  assert.equal(input.checked, false);
});

await test("Slider: ép min/max/step, kẹp giá trị, cập nhật signal, hiển thị giá trị", async () => {
  const v = signal(500);
  const { root } = render(() => h(Slider, { label: "Âm lượng", value: v, min: 0, max: 100, step: "5" }));
  const input = byTag(root, "input");
  assert.equal(input.getAttribute("type"), "range");
  assert.equal(input.getAttribute("step"), "5");
  assert.equal(input.value, "100", "giá trị vượt max bị kẹp");
  input.value = "35"; fire(input, "input", { target: input }); await tick();
  assert.equal(v(), 35);
  assert.equal(byTag(root, "output").textContent, "35");
  const { root: r2 } = render(() => h(Slider, { value: signal(1), min: "abc", max: "xyz", step: -3 }));
  const i2 = byTag(r2, "input");
  assert.equal(i2.getAttribute("min"), "0"); assert.equal(i2.getAttribute("max"), "100"); assert.equal(i2.getAttribute("step"), "1");
});

await test("Rating: radiogroup, chọn bằng bấm và phím, roving tabindex, chỉ đọc", async () => {
  const v = signal(0);
  const { root } = render(() => h(Rating, { value: v, max: 5, label: "Chất lượng" }));
  const stars = () => findAll(root, (e) => e.getAttribute("role") === "radio");
  assert.equal(byRole(root, "radiogroup").getAttribute("aria-label"), "Chất lượng");
  assert.equal(stars().length, 5);
  assert.deepEqual(stars().map((s) => s.getAttribute("tabindex")), ["0", "-1", "-1", "-1", "-1"]);
  fire(stars()[3], "click"); await tick();
  assert.equal(v(), 4);
  assert.deepEqual(stars().map((s) => s.getAttribute("aria-checked")), ["false", "false", "false", "true", "false"]);
  assert.equal(stars()[3].getAttribute("tabindex"), "0");
  const e = fire(stars()[3], "keydown", { key: "ArrowRight" }); await tick();
  assert.equal(v(), 5); assert.equal(e.defaultPrevented, true);
  fire(stars()[4], "keydown", { key: "ArrowRight" }); await tick();
  assert.equal(v(), 5, "không vượt quá max");
  fire(stars()[4], "keydown", { key: "Home" }); await tick();
  assert.equal(v(), 1);
  const { root: ro } = render(() => h(Rating, { value: 3, max: 5, readonly: true }));
  assert.equal(byRole(ro, "img").getAttribute("aria-label"), "Đánh giá: 3/5");
  assert.equal(findAll(ro, (e) => e.className === "star on").length, 3);
});

console.log("\nBố cục và điều hướng");

await test("Accordion: ARIA, mở một/nhiều, nội dung lười, bàn phím, mở sẵn", async () => {
  let built = 0;
  const items = [{ title: "A", content: () => { built++; return "nội dung A"; } }, { title: "B", content: "nội dung B" }, { title: "C", content: "nội dung C" }];
  const { root } = render(() => h(Accordion, { items, open: 1 }));
  const btns = () => findAll(root, (e) => e.className === "acc-btn");
  const panels = () => findAll(root, (e) => e.className === "acc-panel");
  assert.deepEqual(btns().map((b) => b.getAttribute("aria-expanded")), ["false", "true", "false"]);
  assert.equal(btns()[1].getAttribute("aria-controls"), panels()[1].getAttribute("id"));
  assert.equal(panels()[1].getAttribute("role"), "region");
  assert.equal(built, 0, "mục đóng chưa được dựng");
  fire(btns()[0], "click"); await tick();
  assert.equal(built, 1);
  assert.deepEqual(btns().map((b) => b.getAttribute("aria-expanded")), ["true", "false", "false"], "chế độ một mục: mở mục mới thì đóng mục cũ");
  assert.equal(panels()[0].textContent, "nội dung A");
  fire(btns()[0], "click"); await tick();
  assert.deepEqual(btns().map((b) => b.getAttribute("aria-expanded")), ["false", "false", "false"]);
  fire(btns()[0], "keydown", { key: "ArrowDown" });
  assert.equal(document.activeElement, btns()[1]);
  fire(btns()[1], "keydown", { key: "End" });
  assert.equal(document.activeElement, btns()[2]);
  const { root: r2 } = render(() => h(Accordion, { items, multiple: true, open: [0, 2] }));
  assert.deepEqual(findAll(r2, (e) => e.className === "acc-btn").map((b) => b.getAttribute("aria-expanded")), ["true", "false", "true"]);
  assert.throws(() => h(Accordion, { items: [] }), /items/);
});

await test("Breadcrumb: nav có nhãn, mục cuối là trang hiện tại, href độc bị lọc", async () => {
  const { root } = render(() => h(Breadcrumb, { items: [{ label: "Trang chủ", href: "/" }, { label: "Áo", href: "javascript:alert(1)" }, { label: "Áo thun" }] }));
  assert.equal(byTag(root, "nav").getAttribute("aria-label"), "Đường dẫn");
  const a = findAll(root, (e) => e.tagName === "A");
  assert.equal(a.length, 2);
  assert.equal(a[0].getAttribute("href"), "/");
  assert.ok(!(a[1].getAttribute("href") || "").startsWith("javascript"), "href độc không đi qua");
  const last = findAll(root, (e) => e.tagName === "SPAN").pop();
  assert.equal(last.getAttribute("aria-current"), "page");
  assert.ok(errors.length >= 1, "có báo cáo bảo mật");
});

await test("Drawer: là Modal có class theo cạnh, Esc đóng, chặn cạnh lạ", async () => {
  const open = signal(true);
  const { root } = render(() => h(Drawer, { open, title: "Giỏ", side: "left" }, "nội dung"));
  await tick();
  const dlg = byRole(root, "dialog");
  assert.equal(dlg.className, "modal drawer drawer-left");
  assert.equal(dlg.getAttribute("aria-modal"), "true");
  fireDoc("keydown", { key: "Escape" }); await tick();
  assert.equal(open(), false);
  const { root: r2, stop: stop2 } = render(() => h(Drawer, { open: signal(true), side: "x\" onclick=\"y" }, "z"));
  await tick();
  assert.equal(byRole(r2, "dialog").className, "modal drawer drawer-right", "cạnh lạ về mặc định");
  stop2(); await tick();
});

await test("Stepper: bước xong/hiện tại, aria-current, kẹp chỉ số, theo signal", async () => {
  const cur = signal(1);
  const { root } = render(() => h(Stepper, { steps: ["Giỏ", "Giao hàng", "Thanh toán"], current: cur }));
  const steps = () => findAll(root, (e) => e.tagName === "LI");
  assert.deepEqual(steps().map((s) => s.className), ["step done", "step active", "step"]);
  assert.deepEqual(steps().map((s) => s.getAttribute("aria-current")), [null, "step", null]);
  assert.equal(findAll(root, (e) => e.className === "step-dot")[0].textContent, "✓");
  cur.set(99); await tick();
  assert.deepEqual(steps().map((s) => s.className), ["step done", "step done", "step active"], "chỉ số quá lớn bị kẹp");
});

await test("Popover: mở/đóng, aria, Esc, bấm ngoài, chỉ lắng nghe khi mở, dọn khi gỡ", async () => {
  const before = { click: docListenerCount("click"), key: docListenerCount("keydown") };
  const { root, stop } = render(() => h(Popover, { label: "Bộ lọc", title: "Lọc" }, "nội dung lọc"));
  const trigger = byTag(root, "button");
  assert.equal(trigger.getAttribute("aria-expanded"), "false");
  assert.equal(byRole(root, "dialog"), null);
  assert.equal(docListenerCount("click"), before.click, "đóng thì chưa lắng nghe");
  fire(trigger, "click"); await tick();
  assert.equal(trigger.getAttribute("aria-expanded"), "true");
  assert.equal(byRole(root, "dialog").textContent, "nội dung lọc");
  assert.equal(trigger.getAttribute("aria-controls"), byRole(root, "dialog").getAttribute("id"));
  fireDoc("click", { target: byRole(root, "dialog") }); await tick();
  assert.ok(byRole(root, "dialog"), "bấm bên trong không đóng");
  fireDoc("keydown", { key: "Escape" }); await tick();
  assert.equal(byRole(root, "dialog"), null);
  assert.equal(document.activeElement, trigger, "trả tiêu điểm về nút");
  fire(trigger, "click"); await tick();
  fireDoc("click", { target: document.body }); await tick();
  assert.equal(byRole(root, "dialog"), null, "bấm ra ngoài thì đóng");
  fire(trigger, "click"); await tick();
  stop(); await tick();
  assert.equal(docListenerCount("click"), before.click);
  assert.equal(docListenerCount("keydown"), before.key);
});

console.log(`\n${passed} test qua, ${failed.length} lỗi`);
if (failed.length) { console.log("Lỗi:", failed.join("; ")); process.exit(1); }
