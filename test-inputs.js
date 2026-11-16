// Test cho Combobox, FileInput, DatePicker (fluxa-inputs.js)
import "./fake-dom.js";
import assert from "node:assert/strict";
import { fire, fireDoc, docListenerCount } from "./fake-dom.js";
import { signal, h, mount, onError } from "./fluxa.js";
import { Combobox, FileInput, DatePicker, parseDate, matchesAccept, formatSize } from "./fluxa-inputs.js";

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
const type = async (input, text) => { input.value = text; fire(input, "input", { target: input }); await tick(); };

console.log("Combobox");

const FRUITS = [{ value: "ca", label: "Cà chua" }, { value: "dua", label: "Dưa hấu" }, { value: "dao", label: "Đào" }, { value: "xoai", label: "Xoài", disabled: true }, { value: "cam", label: "Cam" }];

await test("Combobox: ARIA, lọc không dấu, chọn bằng bàn phím, giá trị là signal", async () => {
  const v = signal("");
  const { root } = render(() => h(Combobox, { label: "Trái cây", value: v, options: FRUITS }));
  const input = byTag(root, "input");
  assert.equal(input.getAttribute("role"), "combobox");
  assert.equal(input.getAttribute("aria-expanded"), "false");
  assert.equal(byRole(root, "listbox"), null);
  await type(input, "d");
  assert.equal(input.getAttribute("aria-expanded"), "true");
  const opts = () => findAll(root, (e) => e.getAttribute("role") === "option");
  assert.deepEqual(opts().map((o) => o.textContent), ["Dưa hấu", "Đào"], '"d" khớp cả Đ và D, không phân biệt dấu');
  assert.equal(input.getAttribute("aria-activedescendant"), opts()[0].getAttribute("id"));
  const e1 = fire(input, "keydown", { key: "ArrowDown" }); await tick();
  assert.equal(e1.defaultPrevented, true);
  assert.equal(input.getAttribute("aria-activedescendant"), opts()[1].getAttribute("id"));
  fire(input, "keydown", { key: "Enter" }); await tick();
  assert.equal(v(), "dao");
  assert.equal(input.value, "Đào");
  assert.equal(byRole(root, "listbox"), null, "chọn xong thì đóng");
  assert.equal(errors.length, 0);
});

await test("Combobox: bỏ qua mục bị khóa, Esc đóng, blur trả lại chữ đã chọn, không có kết quả", async () => {
  const v = signal("cam");
  const { root } = render(() => h(Combobox, { value: v, options: FRUITS }));
  const input = byTag(root, "input");
  assert.equal(input.value, "Cam", "hiện nhãn của giá trị ban đầu");
  await type(input, "xoai");
  const opt = find(root, (e) => e.getAttribute("role") === "option");
  assert.equal(opt.getAttribute("aria-disabled"), "true");
  fire(opt, "click"); await tick();
  assert.equal(v(), "cam", "mục khóa không chọn được");
  fire(input, "keydown", { key: "Escape" }); await tick();
  assert.equal(byRole(root, "listbox"), null);
  await type(input, "zzz");
  assert.equal(byRole(root, "listbox"), null);
  assert.ok(find(root, (e) => e.className === "combo-empty"), "báo không tìm thấy");
  fire(input, "blur"); await tick();
  assert.equal(input.value, "Cam", "không giữ chữ ngoài danh sách");
  assert.equal(v(), "cam");
});

await test("Combobox: nhãn là chữ thuần, allowCustom giữ giá trị tự gõ, value đổi từ ngoài, thiếu signal báo lỗi", async () => {
  const v = signal("");
  const { root } = render(() => h(Combobox, { value: v, options: ["<img src=x onerror=alert(1)>", "b"], allowCustom: true }));
  const input = byTag(root, "input");
  await type(input, "<img");
  const opt = find(root, (e) => e.getAttribute("role") === "option");
  assert.equal(opt.textContent, "<img src=x onerror=alert(1)>");
  assert.equal(find(root, (e) => e.tagName === "IMG"), null, "không sinh thẻ img");
  await type(input, "tự gõ");
  fire(input, "blur"); await tick();
  assert.equal(v(), "tự gõ");
  v.set("b"); await tick();
  assert.equal(input.value, "b");
  assert.throws(() => h(Combobox, { options: [] }), /value/);
});

console.log("\nFileInput");

const file = (name, size, type = "") => ({ name, size, type });
const drop = (el, files) => fire(el, "drop", { dataTransfer: { files } });

await test("FileInput: accept sạch, loại/dung lượng/số lượng bị từ chối với lý do, tên tệp là chữ thuần", async () => {
  const files = signal([]);
  const { root } = render(() => h(FileInput, { label: "Ảnh", value: files, accept: [".png", "image/jpeg", "x\" onerror=\"y", "image/*"], maxSize: 1000, multiple: true, maxFiles: 2 }));
  const native = byTag(root, "input");
  assert.equal(native.getAttribute("type"), "file");
  assert.equal(native.getAttribute("accept"), ".png,image/jpeg,image/*", "mục accept lạ bị bỏ");
  const zone = find(root, (e) => e.className.startsWith("file-zone"));
  const e = drop(zone, [file("a.png", 500, "image/png"), file("b.exe", 10, "application/x-msdownload"), file("big.png", 5000, "image/png"), file("<b>c</b>.png", 1, "image/png"), file("d.png", 1, "image/png")]);
  assert.equal(e.defaultPrevented, true);
  await tick();
  assert.deepEqual(files().map((f) => f.name), ["a.png", "<b>c</b>.png"], "tối đa 2 tệp hợp lệ");
  const msgs = findAll(root, (e) => e.className === "error").map((e) => e.textContent);
  assert.ok(msgs.some((m) => m.startsWith("b.exe") && m.includes("loại tệp")));
  assert.ok(msgs.some((m) => m.startsWith("big.png") && m.includes("lớn hơn")));
  assert.ok(msgs.some((m) => m.includes("tối đa 2")));
  assert.equal(find(root, (e) => e.tagName === "B"), null, "tên tệp không được thành HTML");
  const names = findAll(root, (e) => e.className === "file-name").map((e) => e.textContent);
  assert.deepEqual(names, ["a.png", "<b>c</b>.png"]);
});

await test("FileInput: bỏ tệp, chế độ một tệp thay thế tệp cũ, kéo qua thì đổi class", async () => {
  const files = signal([]);
  let got = null;
  const { root } = render(() => h(FileInput, { value: files, onFiles: (f) => (got = f) }));
  const zone = find(root, (e) => e.className.startsWith("file-zone"));
  fire(zone, "dragover"); await tick();
  assert.ok(zone.className.includes("over"));
  drop(zone, [file("1.txt", 5, "text/plain")]); await tick();
  assert.ok(!zone.className.includes("over"));
  drop(zone, [file("2.txt", 5, "text/plain")]); await tick();
  assert.deepEqual(files().map((f) => f.name), ["2.txt"], "không multiple: thay thế");
  assert.equal(got.length, 1);
  fire(find(root, (e) => e.className === "link"), "click"); await tick();
  assert.equal(files().length, 0);
});

await test("matchesAccept và formatSize", () => {
  assert.equal(matchesAccept(file("A.PNG", 1, ""), [".png"]), true);
  assert.equal(matchesAccept(file("a", 1, "image/webp"), ["image/*"]), true);
  assert.equal(matchesAccept(file("a", 1, "text/html"), ["image/*"]), false);
  assert.equal(matchesAccept(file("a", 1, "x"), []), true);
  assert.equal(formatSize(500), "500 B"); assert.equal(formatSize(2048), "2.0 KB"); assert.equal(formatSize(5 * 1048576), "5.0 MB");
});

console.log("\nDatePicker");

await test("parseDate: chỉ nhận ngày có thật", () => {
  assert.deepEqual(parseDate("2026-02-28"), { y: 2026, m: 2, d: 28 });
  assert.equal(parseDate("2026-02-30"), null);
  assert.equal(parseDate("2026-13-01"), null);
  assert.equal(parseDate("26-1-1"), null);
  assert.equal(parseDate("2024-02-29") !== null, true, "năm nhuận");
  assert.equal(parseDate("<script>"), null);
});

await test("DatePicker: mở lịch, ARIA, chọn ngày, hai chiều, đóng và trả tiêu điểm", async () => {
  const v = signal("2026-11-16");
  const { root } = render(() => h(DatePicker, { label: "Ngày giao", value: v }));
  const input = byTag(root, "input");
  assert.equal(input.getAttribute("aria-haspopup"), "dialog");
  assert.equal(input.getAttribute("readonly"), "");
  assert.ok(input.value.includes("16") && input.value.includes("2026"), "hiện ngày theo locale: " + input.value);
  assert.equal(byRole(root, "dialog"), null);
  fire(input, "click"); await tick();
  assert.equal(input.getAttribute("aria-expanded"), "true");
  const days = () => findAll(root, (e) => e.className.startsWith("dp-day"));
  assert.equal(days().length, 30, "tháng 11 có 30 ngày");
  assert.equal(findAll(root, (e) => e.tagName === "TH").length, 7);
  const sel = days().find((d) => d.className.includes("selected"));
  assert.equal(sel.textContent, "16");
  assert.equal(sel.getAttribute("tabindex"), "0");
  assert.equal(days().filter((d) => d.getAttribute("tabindex") === "0").length, 1, "roving tabindex");
  fire(days()[19], "click"); await tick();
  assert.equal(v(), "2026-11-20");
  assert.equal(byRole(root, "dialog"), null, "chọn xong thì đóng");
  assert.equal(document.activeElement, input);
  assert.equal(errors.length, 0);
});

await test("DatePicker: bàn phím điều hướng qua tháng/năm, min/max khóa ngày, Esc, xóa", async () => {
  const v = signal("2026-01-31");
  const { root } = render(() => h(DatePicker, { value: v, min: "2026-01-10", max: "2027-12-31" }));
  const input = byTag(root, "input");
  fire(input, "keydown", { key: "ArrowDown" }); await tick();
  const grid = byTag(root, "table");
  const days = () => findAll(root, (e) => e.className.startsWith("dp-day"));
  assert.equal(days().find((d) => d.getAttribute("tabindex") === "0").textContent, "31");
  assert.equal(days()[0].hasAttribute("disabled"), true, "ngày 1 < min bị khóa");
  assert.equal(days()[9].hasAttribute("disabled"), false, "ngày 10 = min được chọn");
  fire(days()[0], "click"); await tick();
  assert.equal(v(), "2026-01-31", "ngày ngoài min không chọn được dù có click");
  assert.ok(byRole(root, "dialog"), "và lịch vẫn mở");
  fire(grid, "keydown", { key: "ArrowRight" }); await tick();
  assert.equal(findAll(root, (e) => e.tagName === "STRONG")[0].textContent.includes("2026"), true);
  assert.equal(days().length, 28, "sang tháng 2/2026");
  assert.equal(days().find((d) => d.getAttribute("tabindex") === "0").textContent, "1");
  fire(grid, "keydown", { key: "PageDown" }); await tick();
  assert.equal(days().length, 31, "tháng 3");
  fire(grid, "keydown", { key: "PageDown", shiftKey: true }); await tick();
  assert.equal(days().find((d) => d.getAttribute("tabindex") === "0").textContent, "1");
  fire(grid, "keydown", { key: "End" }); await tick();
  assert.equal(days().find((d) => d.getAttribute("tabindex") === "0").getAttribute("aria-label").length > 0, true);
  fireDoc("keydown", { key: "Escape" }); await tick();
  assert.equal(byRole(root, "dialog"), null);
  fire(find(root, (e) => e.className === "dp-clear"), "click"); await tick();
  assert.equal(v(), "");
  assert.throws(() => h(DatePicker, {}), /value/);
});

await test("DatePicker: bấm ra ngoài đóng, chỉ lắng nghe khi mở, gỡ component thì dọn", async () => {
  const before = { click: docListenerCount("click"), key: docListenerCount("keydown") };
  const v = signal("");
  const { root, stop } = render(() => h(DatePicker, { value: v }));
  const input = byTag(root, "input");
  assert.equal(docListenerCount("click"), before.click);
  fire(input, "click"); await tick();
  assert.equal(docListenerCount("click"), before.click + 1);
  fireDoc("click", { target: document.body }); await tick();
  assert.equal(byRole(root, "dialog"), null);
  assert.equal(docListenerCount("click"), before.click);
  fire(input, "click"); await tick();
  stop(); await tick();
  assert.equal(docListenerCount("click"), before.click);
  assert.equal(docListenerCount("keydown"), before.key);
});

console.log(`\n${passed} test qua, ${failed.length} lỗi`);
if (failed.length) { console.log("Lỗi:", failed.join("; ")); process.exit(1); }
