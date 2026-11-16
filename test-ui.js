import "./fake-dom.js";
import assert from "node:assert/strict";
import { fire, fireDoc, docListenerCount, serialize } from "./fake-dom.js";
import { signal, h, mount, onError } from "./fluxa.js";
import {
  Button, Input, Checkbox, Select, Card, Badge, Alert, Spinner, Modal, Tabs, createToaster, cx, uid,
  Progress, Skeleton, Avatar, Tooltip, Table, Pagination, Dropdown,
} from "./fluxa-components.js";

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
const render = (view) => {
  const root = document.createElement("div");
  const stop = mount(root, view);
  return { root, stop };
};
const kids = (n) => n.childNodes.filter((c) => c.nodeType === 1);
const find = (n, pred) => {
  for (const c of kids(n)) {
    if (pred(c)) return c;
    const r = find(c, pred);
    if (r) return r;
  }
  return null;
};
const byRole = (n, role) => find(n, (e) => e.getAttribute("role") === role);
const byTag = (n, tag) => find(n, (e) => e.tagName === tag.toUpperCase());

console.log("Tiện ích");

await test("cx ghép class; có hàm thì tự cập nhật; uid không trùng", () => {
  assert.equal(cx("a", false, null, "b"), "a b");
  const on = signal(true);
  const f = cx("a", () => on() && "x");
  assert.equal(f(), "a x");
  on.set(false);
  assert.equal(f(), "a");
  assert.notEqual(uid(), uid());
});

console.log("\nHiển thị");

await test("Button: mặc định type=button, class, loading khóa nút, chặn variant/type lạ", async () => {
  const loading = signal(false);
  let clicks = 0;
  const { root } = render(() => h(Button, { variant: "danger", size: "sm", loading, onclick: () => clicks++, class: "extra" }, "Lưu"));
  const b = byTag(root, "button");
  assert.equal(b.getAttribute("type"), "button");
  assert.equal(b.className, "btn danger sm extra");
  assert.equal(b.textContent, "Lưu");
  assert.equal(b.hasAttribute("disabled"), false);
  fire(b, "click");
  assert.equal(clicks, 1);
  loading.set(true);
  await tick();
  assert.equal(b.hasAttribute("disabled"), true);
  assert.equal(b.getAttribute("aria-busy"), "true");
  assert.ok(find(b, (e) => e.className.includes("spinner")));
  loading.set(false);
  await tick();
  assert.equal(b.getAttribute("aria-busy"), null);
  assert.equal(find(b, (e) => e.className.includes("spinner")), null);

  const evil = h(Button, { variant: 'primary" onclick="x', size: "xl", type: "javascript" }, "x");
  assert.equal(evil.className, "btn");
  assert.equal(evil.getAttribute("type"), "button");
  assert.equal(h(Button, { type: "submit" }).getAttribute("type"), "submit");
  assert.equal(h(Button, { disabled: true }).hasAttribute("disabled"), true);
  assert.equal(h(Button, { disabled: false }).hasAttribute("disabled"), false);
});

await test("Spinner có role=status; bản nhỏ ẩn với trình đọc màn hình", () => {
  assert.equal(Spinner().getAttribute("role"), "status");
  assert.equal(Spinner({ small: true }).getAttribute("aria-hidden"), "true");
});

await test("Card, Badge (chặn tone lạ), Alert (role theo mức độ, nút đóng)", () => {
  const c = h(Card, { title: "Tiêu đề" }, "nội dung");
  assert.equal(byTag(c, "h2").textContent, "Tiêu đề");
  assert.equal(h(Badge, { tone: "success" }, "ok").className, "badge badge-success");
  assert.equal(h(Badge, { tone: "x y" }, "ok").className, "badge");
  assert.equal(h(Alert, { tone: "danger" }, "lỗi").getAttribute("role"), "alert");
  assert.equal(h(Alert, { tone: "info" }, "tin").getAttribute("role"), "status");
  assert.equal(h(Alert, { tone: "zzz" }, "tin").className, "alert alert-info");
  let closed = 0;
  const a = h(Alert, { onClose: () => closed++, title: "T" }, "m");
  fire(byTag(a, "button"), "click");
  assert.equal(closed, 1);
  assert.equal(byTag(h(Alert, {}, "m"), "button"), null);
});

console.log("\nBiểu mẫu");

await test("Input: nhãn liên kết, ràng buộc hai chiều, lỗi/gợi ý có aria, chặn type lạ", async () => {
  const v = signal("a");
  const err = signal("");
  let userEvents = 0;
  const { root } = render(() => h(Input, { label: "Tên", hint: "Gợi ý", value: v, error: err, oninput: () => userEvents++ }));
  const input = byTag(root, "input");
  const label = byTag(root, "label");
  assert.equal(label.getAttribute("for"), input.getAttribute("id"));
  assert.equal(input.value, "a");
  assert.equal(input.getAttribute("aria-invalid"), null);
  assert.equal(input.getAttribute("aria-describedby"), input.getAttribute("id") + "-hint");
  assert.equal(find(root, (e) => e.className === "hint").textContent, "Gợi ý");

  input.value = "xyz";
  fire(input, "input", { target: input });
  assert.equal(v.peek(), "xyz", "DOM -> signal");
  assert.equal(userEvents, 1, "handler của người dùng vẫn chạy");
  v.set("abc");
  await tick();
  assert.equal(input.value, "abc", "signal -> DOM");

  err.set("Sai rồi");
  await tick();
  assert.equal(input.getAttribute("aria-invalid"), "true");
  const msg = byRole(root, "alert");
  assert.equal(msg.textContent, "Sai rồi");
  assert.equal(input.getAttribute("aria-describedby"), msg.getAttribute("id"));
  err.set("");
  await tick();
  assert.equal(byRole(root, "alert"), null);

  assert.equal(byTag(h(Input, { type: "file" }), "input").getAttribute("type"), "text");
  assert.equal(byTag(h(Input, { type: "email" }), "input").getAttribute("type"), "email");
});

await test("Input: thông báo lỗi chứa HTML vẫn chỉ là chữ", () => {
  const evil = "<img src=x onerror=alert(1)>";
  const el = h(Input, { error: evil });
  assert.equal(find(el, (e) => e.tagName === "IMG"), null);
  assert.ok(el.textContent.includes(evil));
});

await test("Checkbox: hai chiều với signal", async () => {
  const on = signal(false);
  const { root } = render(() => h(Checkbox, { checked: on, label: "Đồng ý" }));
  const cb = byTag(root, "input");
  assert.equal(cb.getAttribute("type"), "checkbox");
  assert.equal(cb.checked, false);
  cb.checked = true;
  fire(cb, "change", { target: cb });
  assert.equal(on.peek(), true);
  on.set(false);
  await tick();
  assert.equal(cb.checked, false);
  assert.equal(byTag(root, "label").textContent, "Đồng ý");
});

await test("Select: tùy chọn, giá trị ban đầu, hai chiều, tùy chọn phản ứng", async () => {
  const v = signal("b");
  const { root } = render(() =>
    h(Select, { label: "Vai trò", value: v, options: ["a", { value: "b", label: "Bê" }, { value: "c", disabled: true }] })
  );
  const sel = byTag(root, "select");
  assert.deepEqual(kids(sel).map((o) => o.textContent), ["a", "Bê", "c"]);
  assert.equal(sel.value, "b");
  assert.equal(kids(sel)[2].hasAttribute("disabled"), true);
  assert.equal(kids(sel)[0].hasAttribute("disabled"), false);
  sel.value = "a";
  fire(sel, "change", { target: sel });
  assert.equal(v.peek(), "a");
  const opts = signal(["x"]);
  const r2 = render(() => h(Select, { options: () => opts() }));
  opts.set(["x", "y"]);
  await tick();
  assert.deepEqual(kids(byTag(r2.root, "select")).map((o) => o.textContent), ["x", "y"]);
});

console.log("\nModal");

await test("Modal: ARIA, mở/đóng, Esc, bấm nền, khóa cuộn, trả tiêu điểm, dọn listener", async () => {
  const open = signal(false);
  let closed = 0;
  const opener = document.createElement("button");
  opener.focus();
  const { root, stop } = render(() => h(Modal, { open, title: "Xác nhận", onClose: () => closed++ }, "Bạn chắc chứ?"));
  assert.equal(byRole(root, "dialog"), null, "đóng thì không có trong DOM");
  assert.equal(docListenerCount("keydown"), 0);

  open.set(true);
  await tick();
  const dlg = byRole(root, "dialog");
  assert.equal(dlg.getAttribute("aria-modal"), "true");
  const heading = byTag(dlg, "h2");
  assert.equal(dlg.getAttribute("aria-labelledby"), heading.getAttribute("id"));
  assert.ok(dlg.textContent.includes("Bạn chắc chứ?"));
  assert.equal(document.body.style.overflow, "hidden");
  assert.equal(docListenerCount("keydown"), 1);
  assert.equal(document.activeElement, dlg, "tiêu điểm chuyển vào hộp");

  fireDoc("keydown", { key: "a" });
  assert.equal(open.peek(), true, "phím khác không đóng");
  fireDoc("keydown", { key: "Escape" });
  assert.equal(open.peek(), false);
  assert.equal(closed, 1);
  await tick();
  assert.equal(byRole(root, "dialog"), null);
  assert.equal(document.body.style.overflow, "");
  assert.equal(docListenerCount("keydown"), 0);
  assert.equal(document.activeElement, opener, "tiêu điểm trả về chỗ cũ");

  open.set(true);
  await tick();
  const backdrop = find(root, (e) => e.className === "modal-backdrop");
  fire(byRole(root, "dialog"), "click", { target: byRole(root, "dialog"), currentTarget: backdrop });
  assert.equal(open.peek(), true, "bấm bên trong hộp không đóng");
  fire(backdrop, "click", { target: backdrop });
  assert.equal(open.peek(), false, "bấm nền thì đóng");
  await tick();

  open.set(true);
  await tick();
  assert.equal(docListenerCount("keydown"), 1);
  stop();
  assert.equal(docListenerCount("keydown"), 0, "gỡ ứng dụng dọn cả listener");
  assert.equal(document.body.style.overflow, "");
});

await test("Modal: dismissOnBackdrop=false, nút × đóng, bẫy Tab, thiếu open báo lỗi", async () => {
  const open = signal(true);
  const { root } = render(() => h(Modal, { open, dismissOnBackdrop: false }, "x"));
  await tick();
  const backdrop = find(root, (e) => e.className === "modal-backdrop");
  fire(backdrop, "click", { target: backdrop });
  assert.equal(open.peek(), true);

  const dlg = byRole(root, "dialog");
  const a = document.createElement("button");
  const b = document.createElement("button");
  dlg.querySelectorAll = () => [a, b];
  let prevented = 0;
  b.focus();
  fire(dlg, "keydown", { key: "Tab", preventDefault: () => prevented++ });
  assert.equal(document.activeElement, a, "Tab ở phần tử cuối quay về đầu");
  fire(dlg, "keydown", { key: "Tab", shiftKey: true, preventDefault: () => prevented++ });
  assert.equal(document.activeElement, b, "Shift+Tab ở phần tử đầu quay về cuối");
  assert.equal(prevented, 2);

  fire(find(dlg, (e) => e.className === "modal-close"), "click");
  assert.equal(open.peek(), false);
  assert.throws(() => h(Modal, {}), /open/);
});

console.log("\nTabs và Toast");

await test("Tabs: ARIA, chọn tab, nội dung lười, bàn phím, signal điều khiển ngoài", async () => {
  let built = 0;
  const value = signal("b");
  const { root } = render(() =>
    h(Tabs, {
      value,
      tabs: [
        { id: "a", label: "Một", content: () => { built++; return "nội dung a"; } },
        { id: "b", label: "Hai", content: "nội dung b" },
        { id: "c", label: "Ba", content: "nội dung c" },
      ],
    })
  );
  const tabs = () => kids(byRole(root, "tablist"));
  const panel = () => byRole(root, "tabpanel");
  assert.deepEqual(tabs().map((t) => t.getAttribute("aria-selected")), ["false", "true", "false"]);
  assert.deepEqual(tabs().map((t) => t.getAttribute("tabindex")), ["-1", "0", "-1"]);
  assert.equal(panel().textContent, "nội dung b");
  assert.equal(built, 0, "tab chưa chọn chưa được dựng");
  assert.equal(panel().getAttribute("aria-labelledby"), tabs()[1].getAttribute("id"));

  fire(tabs()[0], "click");
  await tick();
  assert.equal(value.peek(), "a");
  assert.equal(panel().textContent, "nội dung a");
  assert.equal(built, 1);

  fire(tabs()[0], "keydown", { key: "ArrowRight" });
  await tick();
  assert.equal(value.peek(), "b");
  assert.equal(document.activeElement, tabs()[1]);
  fire(tabs()[1], "keydown", { key: "End" });
  assert.equal(value.peek(), "c");
  fire(tabs()[2], "keydown", { key: "ArrowRight" });
  assert.equal(value.peek(), "a", "vòng lại tab đầu");
  fire(tabs()[0], "keydown", { key: "ArrowLeft" });
  assert.equal(value.peek(), "c", "vòng về tab cuối");

  value.set("zzz");
  await tick();
  assert.equal(panel().textContent, "", "giá trị không hợp lệ thì không hiện nội dung");
  assert.throws(() => h(Tabs, { tabs: [] }), /non-empty/);
  assert.throws(() => h(Tabs, {}), /non-empty/);
});

await test("Toaster: hiển thị, chữ thuần, tự đóng, đóng tay, giới hạn số lượng, dọn timer", async () => {
  const toaster = createToaster({ max: 3, timeout: 15 });
  const { root, stop } = render(() => h(toaster.Toaster));
  const toasts = () => kids(find(root, (e) => e.getAttribute("role") === "region")).filter((e) => e.className.startsWith("toast"));
  assert.equal(find(root, (e) => e.getAttribute("aria-live") === "polite") !== null, true);

  toaster.show("<img src=x onerror=alert(1)>", { tone: "success", timeout: 0 });
  await tick();
  assert.equal(toasts().length, 1);
  assert.equal(find(root, (e) => e.tagName === "IMG"), null, "nội dung là chữ thuần");
  assert.ok(toasts()[0].textContent.includes("<img"));
  assert.equal(toasts()[0].className, "toast toast-success");

  const id = toaster.show("hai", { timeout: 0 });
  toaster.show("ba", { tone: "x y z", timeout: 0 });
  const id4 = toaster.show("bốn", { timeout: 0 });
  await tick();
  assert.equal(toasts().length, 3, "tối đa 3");
  assert.ok(!toasts().some((t) => t.textContent.includes("<img")), "cái cũ nhất bị loại");
  assert.equal(toasts()[1].className, "toast toast-info", "tone lạ rơi về info");

  fire(find(toasts()[0], (e) => e.tagName === "BUTTON"), "click");
  await tick();
  assert.equal(toasts().length, 2);
  toaster.dismiss(id); // đã đóng bằng tay ở trên: gọi lại không gây lỗi
  toaster.dismiss(id4);
  toaster.dismiss(99999);
  await tick();
  assert.equal(toasts().length, 1);

  toaster.show("tự tắt");
  await tick();
  assert.equal(toasts().length, 2);
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(toasts().length, 1, "tự biến mất sau timeout");

  toaster.show("chờ", { timeout: 60000 });
  stop(); // nếu timer không được dọn, tiến trình test sẽ treo đến 60 giây
});

console.log("\nHiển thị dữ liệu (mới)");

await test("Progress: giá trị, giới hạn 0..max, thuộc tính ARIA, tone lạ bị chặn", async () => {
  const v = signal(40);
  const { root } = render(() => h(Progress, { value: v, tone: "success" }));
  const bar = byRole(root, "progressbar");
  assert.equal(bar.getAttribute("aria-valuenow"), "40");
  assert.equal(bar.getAttribute("aria-valuemax"), "100");
  assert.ok(bar.className.includes("progress-success"));
  assert.equal(bar.childNodes[0].style.width, "40%");
  v.set(250); await tick();
  assert.equal(bar.childNodes[0].style.width, "100%");
  v.set(-5); await tick();
  assert.equal(bar.childNodes[0].style.width, "0%");
  v.set("rác"); await tick();
  assert.equal(bar.childNodes[0].style.width, "0%");
  const { root: r2 } = render(() => h(Progress, { value: 1, tone: "x onclick=1" }));
  assert.ok(byRole(r2, "progressbar").className.includes("progress-info"));
});

await test("Skeleton: số dòng bị giới hạn, kích thước chỉ nhận số/đơn vị an toàn", () => {
  const { root } = render(() => h(Skeleton, { lines: 3 }));
  assert.equal(byRole(root, "status").childNodes.filter((c) => c.nodeType === 1).length, 3);
  const { root: r2 } = render(() => h(Skeleton, { lines: 999 }));
  assert.equal(byRole(r2, "status").childNodes.filter((c) => c.nodeType === 1).length, 20);
  const { root: r3 } = render(() => h(Skeleton, { lines: 1, width: "url(javascript:alert(1))", height: "10px;position:fixed" }));
  const line = byRole(r3, "status").childNodes.find((c) => c.nodeType === 1);
  assert.equal(line.style.width, undefined);
  assert.equal(line.style.height, undefined);
  const { root: r4 } = render(() => h(Skeleton, { circle: true, width: 48 }));
  assert.ok(byRole(r4, "status").childNodes.find((c) => c.nodeType === 1).className.includes("circle"));
});

await test("Avatar: chữ cái đầu, màu cố định theo tên, ảnh chỉ nhận URL an toàn, lỗi ảnh thì về chữ", async () => {
  const { root } = render(() => h(Avatar, { name: "nguyễn văn an" }));
  const a = byRole(root, "img");
  assert.equal(serialize(a).replace(/<[^>]+>/g, ""), "NV");
  const cls = a.className;
  const { root: again } = render(() => h(Avatar, { name: "nguyễn văn an" }));
  assert.equal(byRole(again, "img").className, cls, "cùng tên thì cùng màu");
  assert.equal(serialize(byRole(render(() => h(Avatar, {})).root, "img")).replace(/<[^>]+>/g, ""), "?");
  const bad = render(() => h(Avatar, { name: "Lan", src: "javascript:alert(1)" })).root;
  assert.equal(byTag(bad, "img"), null, "URL nguy hiểm không thành ảnh");
  const ok = render(() => h(Avatar, { name: "Lan", src: "https://example.com/a.png" })).root;
  const img = byTag(ok, "img");
  assert.equal(img.getAttribute("src"), "https://example.com/a.png");
  img.listeners.error.forEach((f) => f({})); await tick();
  assert.equal(byTag(ok, "img"), null);
  assert.ok(serialize(ok).includes(">L<"));
  const xss = render(() => h(Avatar, { name: "<img src=x onerror=alert(1)>" })).root;
  assert.equal(byTag(xss, "img"), null);
});

await test("Tooltip: nối aria-describedby với phần tử con, Esc ẩn đi", async () => {
  const btn = h("button", null, "Lưu");
  const { root } = render(() => h(Tooltip, { text: "Lưu thay đổi" }, btn));
  const bubble = byRole(root, "tooltip");
  assert.equal(bubble.getAttribute("id"), btn.getAttribute("aria-describedby"));
  assert.equal(serialize(bubble).replace(/<[^>]+>/g, ""), "Lưu thay đổi");
  const wrap = root.childNodes[0];
  const before = docListenerCount("keydown");
  assert.ok(!wrap.className.includes("tip-hide"));
  fireDoc("keydown", { key: "Escape" }); await tick();
  assert.ok(!wrap.className.includes("tip-hide"), "chưa hiện thì Esc không làm gì và không có listener thừa");
  fire(wrap, "mouseenter"); await tick();
  assert.equal(docListenerCount("keydown"), before + 1, "hiện ra mới bắt đầu nghe Esc");
  fireDoc("keydown", { key: "Escape" }); await tick();
  assert.ok(wrap.className.includes("tip-hide"), "Esc ẩn gợi ý dù chỉ rê chuột, tiêu điểm ở chỗ khác");
  fire(wrap, "mouseleave"); await tick();
  assert.ok(!wrap.className.includes("tip-hide"), "rời đi thì lần sau lại hiện được");
  assert.equal(docListenerCount("keydown"), before, "rời đi thì gỡ listener");
  fire(wrap, "focusin"); await tick();
  assert.equal(docListenerCount("keydown"), before + 1);
  fire(wrap, "focusout"); await tick();
  assert.equal(docListenerCount("keydown"), before);
  const xss = render(() => h(Tooltip, { text: "<img src=x onerror=alert(1)>" }, btn)).root;
  assert.equal(byTag(xss, "img"), null);
});

const cells = (tr) => tr.childNodes.filter((c) => c.nodeType === 1).map((td) => serialize(td).replace(/<[^>]+>/g, ""));
const bodyRows = (root) => kids(byTag(root, "tbody")).filter((r) => r.tagName === "TR");

await test("Table: hiển thị dòng, sắp xếp ba trạng thái, aria-sort, ô là chữ thuần", async () => {
  const rows = signal([{ ten: "Chuối", gia: 30 }, { ten: "Táo", gia: 5 }, { ten: "Cam", gia: 100 }]);
  const { root } = render(() => h(Table, { columns: [{ key: "ten", label: "Tên" }, { key: "gia", label: "Giá", align: "right" }], rows }));
  assert.deepEqual(bodyRows(root).map((r) => cells(r)[0]), ["Chuối", "Táo", "Cam"]);
  const ths = kids(byTag(root, "thead").childNodes.find((n) => n.tagName === "TR"));
  const sortBtn = (i) => byTag(ths[i], "button");
  fire(sortBtn(1), "click"); await tick();
  assert.deepEqual(bodyRows(root).map((r) => cells(r)[1]), ["5", "30", "100"], "số được so sánh theo giá trị, không theo chữ");
  assert.equal(ths[1].getAttribute("aria-sort"), "ascending");
  assert.equal(ths[0].getAttribute("aria-sort"), "none");
  fire(sortBtn(1), "click"); await tick();
  assert.deepEqual(bodyRows(root).map((r) => cells(r)[1]), ["100", "30", "5"]);
  assert.equal(ths[1].getAttribute("aria-sort"), "descending");
  fire(sortBtn(1), "click"); await tick();
  assert.deepEqual(bodyRows(root).map((r) => cells(r)[0]), ["Chuối", "Táo", "Cam"], "lần thứ ba bỏ sắp xếp");
  fire(sortBtn(0), "click"); await tick();
  assert.deepEqual(bodyRows(root).map((r) => cells(r)[0]), ["Cam", "Chuối", "Táo"]);
  rows.set((a) => [...a, { ten: "Dưa", gia: 1 }]); await tick();
  assert.equal(bodyRows(root).length, 4, "thêm dòng vào dữ liệu thì bảng tự cập nhật");
});

await test("Table: giữ nguyên node của dòng khi sắp xếp, trạng thái trống, an toàn với dữ liệu độc", async () => {
  const rows = signal([{ a: "x" }, { a: "y" }]);
  const { root } = render(() => h(Table, { columns: [{ key: "a", label: "A" }], rows, empty: "Chưa có gì" }));
  const before = bodyRows(root)[0];
  fire(byTag(byTag(root, "thead"), "button"), "click"); fire(byTag(byTag(root, "thead"), "button"), "click"); await tick();
  assert.ok(bodyRows(root).includes(before), "dòng cũ được tái sử dụng, không dựng lại");
  rows.set([]); await tick();
  assert.ok(serialize(root).includes("Chưa có gì"));
  rows.set([{ a: "<img src=x onerror=alert(1)>" }, Object.create({ a: "kế thừa" })]); await tick();
  assert.equal(byTag(root, "img"), null);
  assert.ok(!serialize(root).includes("kế thừa"), "chỉ đọc thuộc tính riêng của dòng");
  assert.throws(() => h(Table, { columns: [] }), TypeError);
});

await test("Table: render tùy biến, cột không sắp xếp, sắp xếp ổn định với giá trị rỗng", async () => {
  const rows = [{ n: 2, k: "b" }, { n: null, k: "a" }, { n: 1, k: "c" }];
  const { root } = render(() => h(Table, { columns: [{ key: "n", label: "N", render: (r) => `#${r.n ?? "?"}` }, { key: "k", label: "K", sortable: false }], rows }));
  assert.deepEqual(bodyRows(root).map((r) => cells(r)[0]), ["#2", "#?", "#1"]);
  const ths = kids(byTag(root, "thead").childNodes.find((n) => n.tagName === "TR"));
  assert.equal(byTag(ths[1], "button"), null, "cột sortable:false không có nút");
  fire(byTag(ths[0], "button"), "click"); await tick();
  assert.deepEqual(bodyRows(root).map((r) => cells(r)[0]), ["#1", "#2", "#?"], "giá trị rỗng xếp cuối");
});

const pages = (root) => byRole(root, "navigation") || root.childNodes[0];
const pageLabels = (root) => kids(root.childNodes[0]).map((n) => (n.tagName === "BUTTON" ? n.getAttribute("aria-label") : "…"));

await test("Pagination: chọn trang, trước/sau, dấu … khi nhiều trang, chặn vượt biên", async () => {
  const page = signal(1);
  const changes = [];
  const { root } = render(() => h(Pagination, { page, pages: 20, onChange: (p) => changes.push(p) }));
  assert.deepEqual(pageLabels(root), ["Trang trước", "Trang 1", "Trang 2", "…", "Trang 20", "Trang sau"]);
  page.set(10); await tick();
  assert.deepEqual(pageLabels(root), ["Trang trước", "Trang 1", "…", "Trang 9", "Trang 10", "Trang 11", "…", "Trang 20", "Trang sau"]);
  const btn = (label) => find(root, (e) => e.getAttribute("aria-label") === label);
  assert.equal(btn("Trang 10").getAttribute("aria-current"), "page");
  fire(btn("Trang sau"), "click"); await tick();
  assert.equal(page(), 11);
  assert.deepEqual(changes, [11]);
  page.set(20); await tick();
  assert.ok(btn("Trang sau").hasAttribute("disabled") || btn("Trang sau").disabled === true);
  fire(btn("Trang sau"), "click");
  assert.equal(page(), 20, "không vượt quá trang cuối");
});

await test("Pagination: số trang giảm thì trang hiện tại tự co lại; giá trị rác được xử lý", async () => {
  const page = signal(5), total = signal(8);
  render(() => h(Pagination, { page, pages: total }));
  total.set(3); await tick();
  assert.equal(page(), 3);
  page.set(0); await tick();
  assert.equal(page(), 1);
  const { root } = render(() => h(Pagination, { page: signal(1), pages: "rác" }));
  assert.deepEqual(pageLabels(root), ["Trang trước", "Trang 1", "Trang sau"]);
  assert.throws(() => h(Pagination, { page: 1, pages: 3 }), TypeError);
});

const menuItems = (root) => kids(byRole(root, "menu") || { childNodes: [] }).filter((e) => e.getAttribute("role") === "menuitem");

await test("Dropdown: mở/đóng, chọn mục gọi hàm rồi đóng, mục khóa không bấm được, nhãn là chữ thuần", async () => {
  const picked = [];
  const { root } = render(() => h(Dropdown, { label: "Tùy chọn", items: [
    { label: "Sửa", onclick: () => picked.push("sua") },
    { divider: true },
    { label: "<img src=x onerror=alert(1)>", onclick: () => picked.push("xss") },
    { label: "Khóa", disabled: true, onclick: () => picked.push("khoa") },
    { label: "Xóa", danger: true, onclick: () => picked.push("xoa") },
  ] }));
  const trigger = byTag(root, "button");
  assert.equal(trigger.getAttribute("aria-expanded"), "false");
  assert.equal(byRole(root, "menu"), null);
  fire(trigger, "click"); await tick();
  assert.equal(trigger.getAttribute("aria-expanded"), "true");
  assert.equal(menuItems(root).length, 4);
  assert.equal(byTag(root, "img"), null);
  assert.ok(menuItems(root)[3].className.includes("danger"));
  assert.ok(menuItems(root)[2].hasAttribute("disabled"));
  fire(menuItems(root)[3], "click"); await tick();
  assert.deepEqual(picked, ["xoa"]);
  assert.equal(byRole(root, "menu"), null, "chọn xong thì đóng");
});

await test("Dropdown: bàn phím (↓ mở và nhảy, bỏ qua mục khóa, Esc đóng và trả tiêu điểm), bấm ra ngoài đóng, gỡ listener", async () => {
  const before = docListenerCount("click");
  const { root, stop } = render(() => h(Dropdown, { items: [{ label: "A" }, { label: "B", disabled: true }, { label: "C" }] }));
  const trigger = byTag(root, "button");
  fire(trigger, "keydown", { key: "ArrowDown" }); await tick(); await tick();
  assert.equal(document.activeElement, menuItems(root)[0]);
  const menu = byRole(root, "menu");
  fire(menu, "keydown", { key: "ArrowDown" }); await tick();
  assert.equal(document.activeElement, menuItems(root)[2], "bỏ qua mục B bị khóa");
  fire(menu, "keydown", { key: "ArrowDown" }); await tick();
  assert.equal(document.activeElement, menuItems(root)[0], "vòng lại đầu");
  fire(menu, "keydown", { key: "Escape" }); await tick();
  assert.equal(byRole(root, "menu"), null);
  assert.equal(document.activeElement, trigger);
  fire(trigger, "click"); await tick();
  assert.equal(docListenerCount("click"), before + 1);
  fireDoc("click", { target: document.body }); await tick();
  assert.equal(byRole(root, "menu"), null, "bấm ra ngoài thì đóng");
  assert.equal(docListenerCount("click"), before, "đóng rồi thì gỡ listener");
  fire(trigger, "click"); await tick();
  fireDoc("click", { target: menuItems(root)[0] }); await tick();
  assert.ok(byRole(root, "menu"), "bấm bên trong không đóng");
  stop(); await tick();
  assert.equal(docListenerCount("click"), before, "gỡ component thì gỡ listener");
});

console.log(`\n${passed} test qua, ${failed.length} lỗi`);
if (failed.length) {
  console.log("Lỗi:", failed.join("; "));
  process.exit(1);
}
