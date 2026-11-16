// Giữ quy tắc thiết kế: giao diện phẳng, không dùng chuyển màu (gradient) ở bất kỳ file CSS/SVG/HTML nào.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import assert from "node:assert/strict";

const skip = new Set(["node_modules", "dist", ".git"]);
const exts = new Set([".css", ".svg", ".html"]);
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (skip.has(name)) continue;
    const p = join(dir, name);
    statSync(p).isDirectory() ? walk(p) : exts.has(extname(p)) && files.push(p);
  }
})(".");

let bad = [];
for (const f of files) {
  const text = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  if (/(linear|radial|conic)-gradient|<(linear|radial)Gradient/i.test(text)) bad.push(f);
}
assert.deepEqual(bad, [], "File còn dùng gradient: " + bad.join(", "));
console.log(`CSS: ${files.length} file CSS/SVG/HTML, không có gradient`);
