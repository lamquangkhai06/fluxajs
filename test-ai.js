// test-ai.js - chạy thật mọi ví dụ trong AI.md và kiểm tra các "lỗi hay gặp" đúng như tài liệu nói.
// (Tài liệu mà AI học theo phải đúng: ví dụ sai sẽ khiến AI sinh code sai.)
import assert from "node:assert/strict";
import fs from "node:fs";
import { fire, serialize } from "./fake-dom.js";
import * as Fluxa from "./fluxa-all.js";

const md = fs.readFileSync(new URL("./AI.md", import.meta.url), "utf8");
const blocks = [...md.matchAll(/```js run\n([\s\S]*?)```/g)].map((m) => m[1]);
const errors = [];
Fluxa.onError((e) => errors.push(e.message));
const wait = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const text = (n) => serialize(n).replace(/<[^>]+>/g, "");
let passed = 0, failed = 0;
const test = async (name, fn) => {
  errors.length = 0;
  try { await fn(); passed++; console.log("  ✓", name); }
  catch (e) { failed++; console.log("  ✗", name, "\n     ", e.message); }
};
const run = (code) => {
  const App = new Function("Fluxa", code + "\n;return typeof App === 'function' ? App : null;")(Fluxa);
  assert.ok(App, "khối mã phải định nghĩa function App");
  const root = document.createElement("div");
  Fluxa.mount(root, () => App());
  return root;
};

console.log("Ví dụ trong AI.md");
await test(`tìm thấy ${blocks.length} ví dụ chạy được (mong đợi ≥ 6)`, () => assert.ok(blocks.length >= 6));

for (const [i, code] of blocks.entries()) {
  const title = `ví dụ ${i + 1}`;
  await test(`${title}: dựng được, không lỗi`, async () => {
    const root = run(code);
    await wait(60);
    assert.ok(root.childNodes.length > 0, "không dựng ra gì");
    assert.deepEqual(errors, []);
  });
}

console.log("\nHành vi đúng như tài liệu mô tả");
await test("bộ đếm: bấm nút thì p(n) và biểu thức bọc hàm cùng cập nhật", async () => {
  const root = run(blocks[0]);
  fire(root.childNodes[0].childNodes[0], "click");
  fire(root.childNodes[0].childNodes[0], "click");
  await wait();
  assert.equal(text(root), "+12gấp đôi: 4");
});
await test("form: gõ chữ cập nhật lời chào; tên dài thì hiện cảnh báo", async () => {
  const root = run(blocks[1]);
  const input = root.childNodes[0].childNodes[0];
  input.value = "Lan"; fire(input, "input"); await wait();
  assert.ok(text(root).includes("Xin chào Lan") && !text(root).includes("dài quá"));
  input.value = "Nguyễn Văn Rất Dài"; fire(input, "input"); await wait();
  assert.ok(text(root).includes("Tên dài quá!"));
});
await test("danh sách: thêm, hiện/ẩn thông báo trống, xóa", async () => {
  const root = run(blocks[2]);
  const box = root.childNodes[0];
  const inp = box.childNodes[0], addBtn = box.childNodes[1];
  assert.ok(text(root).includes("Học Fluxa") && !text(root).includes("Chưa có việc nào"));
  inp.value = "Việc 2"; fire(inp, "input"); fire(addBtn, "click"); await wait();
  assert.ok(text(root).includes("Việc 2"));
  const ul = box.childNodes.find((n) => n.tagName === "UL");
  const lis = () => ul.childNodes.filter((n) => n.tagName === "LI");
  assert.equal(lis().length, 2);
  for (const li of lis()) fire(li.childNodes[li.childNodes.length - 1], "click");
  await wait();
  assert.ok(text(root).includes("Chưa có việc nào"));
});
await test("resource + choose: đang tải rồi hiện tên", async () => {
  const root = run(blocks[3]);
  assert.ok(text(root).includes("Đang tải"));
  await wait(60);
  assert.ok(text(root).includes("Xin chào Lan"));
});

console.log("\nCác 'lỗi hay gặp' đúng như bảng trong AI.md");
await test("p('Tổng: ' + n()) KHÔNG cập nhật; p(() => ...) thì có", async () => {
  const n = Fluxa.signal(1);
  const { p, div } = Fluxa.tags;
  const root = document.createElement("div");
  Fluxa.mount(root, () => div(p("S:" + n()), p(() => "R:" + n())));
  n.set(2); await wait();
  assert.equal(text(root), "S:1R:2");
});
await test("items().push(x) không cập nhật; items.set((a) => [...a, x]) thì có", async () => {
  const items = Fluxa.signal([1]);
  const { ul, li } = Fluxa.tags;
  const root = document.createElement("div");
  Fluxa.mount(root, () => ul(Fluxa.list(items, (v) => li(v))));
  items().push(2); await wait();
  assert.equal(text(root), "1");
  items.set((a) => [...a, 3]); await wait();
  assert.equal(text(root), "123");
});
await test("onclick dạng chuỗi bị chặn và có báo; onClick (hoa) vẫn chạy", async () => {
  const { button } = Fluxa.tags;
  const root = document.createElement("div");
  let clicks = 0;
  Fluxa.mount(root, () => [button({ onclick: "alert(1)" }, "a"), button({ onClick: () => clicks++ }, "b")]);
  const [bad, ok] = root.childNodes.filter((n) => n.tagName === "BUTTON");
  fire(bad, "click"); fire(ok, "click");
  assert.equal(clicks, 1);
  assert.ok(errors.some((m) => m.includes("must be a function")));
});

console.log(`\n${passed} test qua, ${failed} lỗi`);
process.exit(failed ? 1 : 0);
