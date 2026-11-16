// Test cho LineChart, BarChart, DonutChart (fluxa-charts.js)
import "./fake-dom.js";
import assert from "node:assert/strict";
import { signal, h, mount, onError } from "./fluxa.js";
import { LineChart, BarChart, DonutChart, niceScale } from "./fluxa-charts.js";

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
const findAll = (n, pred, out = []) => { for (const c of kids(n)) { if (pred(c)) out.push(c); findAll(c, pred, out); } return out; };
const all = (n, tag, cls) => findAll(n, (e) => e.tagName.toLowerCase() === tag && (!cls || e.className === cls || e.getAttribute("class") === cls));
const cls = (e) => e.className || e.getAttribute("class") || "";
const byClass = (n, c) => findAll(n, (e) => cls(e).split(" ").includes(c));

await test("niceScale: bước 1/2/2.5/5×10^n, bao trọn dải dữ liệu, không bao giờ chia cho 0", () => {
  const a = niceScale(0, 87);
  assert.deepEqual(a.ticks, [0, 25, 50, 75, 100]);
  assert.equal(a.hi, 100);
  assert.deepEqual(niceScale(-30, 70).ticks, [-50, -25, 0, 25, 50, 75]);
  assert.ok(niceScale(5, 5).hi > niceScale(5, 5).lo);
  assert.ok(niceScale(0, 1e12).ticks.length <= 50);
});

await test("LineChart: role=img + mô tả, đường/chấm/lưới, bảng dữ liệu ẩn, nhãn là chữ thuần", async () => {
  const { root } = render(() => h(LineChart, { title: "Doanh thu", data: [{ label: "T1", value: 10 }, { label: "<script>alert(1)</script>", value: 30 }, { label: "T3", value: "abc" }] }));
  const svg = all(root, "svg")[0];
  assert.equal(svg.getAttribute("role"), "img");
  assert.ok(svg.getAttribute("aria-label").startsWith("Doanh thu."));
  assert.equal(svg.namespaceURI, "http://www.w3.org/2000/svg");
  assert.equal(all(root, "circle").length, 3);
  const d = all(root, "path")[0].getAttribute("d");
  assert.ok(d.startsWith("M") && d.split("L").length === 3, "một đường 3 điểm: " + d);
  assert.ok(!/NaN|Infinity/.test(d), "không có NaN");
  assert.equal(all(root, "script").length, 0, "nhãn không thành thẻ script");
  assert.ok(byClass(root, "chart-tick").some((t) => t.textContent === "<script>alert(1)</script>"));
  const table = all(root, "table")[0];
  assert.equal(table.className, "sr-only");
  assert.ok(table.textContent.includes("Doanh thu") && table.textContent.includes("T3"));
  assert.equal(all(root, "figcaption")[0].textContent, "Doanh thu");
});

await test("LineChart: nhiều chuỗi có chú giải, dữ liệu là signal thì vẽ lại, giới hạn số điểm", async () => {
  const rows = signal([{ label: "a", value: 1 }, { label: "b", value: 2 }]);
  const { root } = render(() => h(LineChart, { data: rows }));
  assert.equal(all(root, "circle").length, 2);
  rows.set([{ label: "a", value: 1 }, { label: "b", value: 2 }, { label: "c", value: 3 }]); await tick();
  assert.equal(all(root, "circle").length, 3, "tự vẽ lại");
  const { root: r2 } = render(() => h(LineChart, { labels: ["x", "y"], series: [{ name: "A", values: [1, 2] }, { name: "B", values: [2, 1] }] }));
  assert.equal(all(r2, "path").length, 2);
  assert.equal(byClass(r2, "chart-legend")[0].textContent.includes("A"), true);
  assert.ok(byClass(r2, "chart-c1").length > 0, "chuỗi thứ hai dùng màu thứ hai");
  const big = Array.from({ length: 5000 }, (_, i) => ({ label: String(i), value: i }));
  const { root: r3 } = render(() => h(LineChart, { data: big }));
  assert.equal(all(r3, "circle").length, 1000, "tối đa 1000 điểm");
  const { root: r4 } = render(() => h(LineChart, { data: [] }));
  assert.equal(all(r4, "circle").length, 0);
  assert.equal(errors.length, 0);
});

await test("BarChart: chiều cao tỉ lệ, giá trị âm nằm dưới đường 0, cột nhóm, không NaN", async () => {
  const { root } = render(() => h(BarChart, { data: [{ label: "a", value: 50 }, { label: "b", value: 100 }, { label: "c", value: -50 }, { label: "d", value: "x" }] }));
  const bars = byClass(root, "chart-bar");
  assert.equal(bars.length, 4);
  const hgt = (b) => Number(b.getAttribute("height"));
  const y = (b) => Number(b.getAttribute("y"));
  assert.ok(Math.abs(hgt(bars[1]) / hgt(bars[0]) - 2) < 0.05, "100 cao gấp đôi 50");
  assert.ok(Math.abs(hgt(bars[2]) - hgt(bars[0])) < 0.05, "|-50| cao bằng 50");
  assert.ok(y(bars[2]) > y(bars[0]), "cột âm bắt đầu thấp hơn cột dương");
  assert.equal(hgt(bars[3]), 0, "giá trị không hợp lệ thành 0");
  for (const b of bars) for (const k of ["x", "y", "width", "height"]) assert.ok(Number.isFinite(Number(b.getAttribute(k))), k);
  const { root: r2 } = render(() => h(BarChart, { labels: ["q1", "q2"], series: [{ name: "A", values: [1, 2] }, { name: "B", values: [3, 4] }] }));
  const xs = byClass(r2, "chart-bar").map((b) => Number(b.getAttribute("x")));
  assert.equal(new Set(xs).size, 4, "4 cột không đè nhau");
});

await test("DonutChart: các phần cộng lại 100%, chú giải có số và phần trăm, giá trị âm/rỗng an toàn", async () => {
  const { root } = render(() => h(DonutChart, { title: "Cơ cấu", data: [{ label: "A", value: 50 }, { label: "B", value: 30 }, { label: "<b>C</b>", value: 20 }, { label: "D", value: -10 }] }));
  const segs = byClass(root, "chart-seg");
  assert.equal(segs.length, 4);
  const pcts = segs.map((s) => Number(s.getAttribute("stroke-dasharray").split(" ")[0]));
  assert.deepEqual(pcts, [50, 30, 20, 0]);
  assert.equal(pcts.reduce((a, b) => a + b, 0), 100);
  const offsets = segs.map((s) => Number(s.getAttribute("stroke-dashoffset")));
  assert.deepEqual(offsets, [25, -25, -55, -75]);
  const items = all(root, "li");
  assert.ok(items[0].textContent.includes("50%"));
  assert.equal(all(root, "b").length, 0, "nhãn là chữ thuần");
  assert.ok(items[2].textContent.includes("<b>C</b>"));
  assert.equal(all(root, "svg")[0].getAttribute("role"), "img");
  const { root: r2 } = render(() => h(DonutChart, { data: [] }));
  assert.equal(byClass(r2, "chart-seg").length, 0);
  const { root: r3 } = render(() => h(DonutChart, { data: [{ label: "x", value: 0 }] }));
  assert.ok(!/NaN/.test(byClass(r3, "chart-seg")[0].getAttribute("stroke-dasharray")));
  assert.equal(errors.length, 0);
});

console.log(`\n${passed} test qua, ${failed.length} lỗi`);
if (failed.length) { console.log("Lỗi:", failed.join("; ")); process.exit(1); }
