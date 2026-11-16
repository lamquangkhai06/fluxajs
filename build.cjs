// build.cjs - đóng gói Fluxa thành MỘT file để dùng không cần npm/Vite.
//   dist/fluxa.global.js : thẻ <script src> thường, tạo biến toàn cục `Fluxa` (chạy được cả khi bấm đúp mở file)
//   dist/fluxa.bundle.js : ES module, dùng với <script type="module"> hoặc import
// Cần esbuild:  npm i -D esbuild && node build.cjs
const esbuild = require("esbuild"), fs = require("fs"), zlib = require("zlib");
fs.mkdirSync("dist", { recursive: true });
const common = { entryPoints: ["fluxa-all.js"], bundle: true, minify: true, target: "es2020", legalComments: "none", logLevel: "warning" };
const banner = { js: "/*! Fluxa.js | MIT | https://github.com/ (thêm địa chỉ kho mã khi công bố) */" };
esbuild.buildSync({ ...common, format: "iife", globalName: "Fluxa", outfile: "dist/fluxa.global.js", banner });
esbuild.buildSync({ ...common, format: "esm", outfile: "dist/fluxa.bundle.js", banner });
// Bản gọn: không kèm nhập liệu nâng cao và biểu đồ
esbuild.buildSync({ ...common, entryPoints: ["fluxa-lite.js"], format: "iife", globalName: "Fluxa", outfile: "dist/fluxa.lite.global.js", banner });
for (const f of ["dist/fluxa.global.js", "dist/fluxa.bundle.js", "dist/fluxa.lite.global.js"]) {
  const b = fs.readFileSync(f);
  console.log(f.padEnd(24), (b.length / 1024).toFixed(1) + " KB", "| gzip", (zlib.gzipSync(b, { level: 9 }).length / 1024).toFixed(1) + " KB");
}
