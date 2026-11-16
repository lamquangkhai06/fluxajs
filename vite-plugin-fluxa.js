/*! vite-plugin-fluxa — JSX và HMR giữ state cho Fluxa trong Vite. MIT License. */

/**
 * Cách dùng (vite.config.js):
 *   import fluxa from "fluxa-ui/vite";
 *   export default { plugins: [fluxa()] };
 *
 * Tùy chọn:
 *   importFrom: nơi import h và Fragment ở chế độ classic (mặc định "fluxa-ui")
 *   automatic:  true => dùng jsx-runtime tự động (jsxImportSource), mặc định false (classic, pragma h)
 *   hmr:        mặc định true. Tắt bằng false để Vite tải lại toàn trang khi sửa file.
 *
 * HMR hoạt động thế nào: file nào import `mount` từ Fluxa (file khởi động ứng dụng) được thêm
 *   import.meta.hot.accept()  và  import.meta.hot.dispose(() => unmountAll())
 * Khi bạn sửa một component, Vite chạy lại file khởi động; ứng dụng cũ được gỡ sạch (effect, router,
 * timer của Toaster...) rồi mount lại. Các module KHÔNG bị sửa (ví dụ file store) được giữ nguyên nên
 * state trong đó còn nguyên. State nằm trong chính component bị sửa thì được tạo lại.
 *
 * Lưu ý: plugin này chưa được chạy với Vite thật (môi trường phát triển không có mạng để cài Vite);
 * logic biến đổi mã và cấu hình JSX đã được kiểm tra riêng, và JSX được biên dịch thử bằng esbuild.
 */
export default function fluxa(options = {}) {
  const importFrom = typeof options.importFrom === "string" ? options.importFrom : "fluxa-ui";
  if (!/^[\w@./-]+$/.test(importFrom)) throw new Error("vite-plugin-fluxa: invalid importFrom");
  const automatic = !!options.automatic;
  const hmr = options.hmr !== false;
  const SRC = /\.(?:[cm]?[jt]sx?)$/;
  const MOUNT_IMPORT = /import\s*\{[^}]*\bmount\b[^}]*\}\s*from\s*["']([^"']+)["']/;
  const isFluxaSpec = (spec) => spec === importFrom || /^fluxa-ui$|(?:^|\/)fluxa(?:\.js)?$/.test(spec);
  let serving = false;

  return {
    name: "vite-plugin-fluxa",
    config() {
      return {
        esbuild: automatic
          ? { jsx: "automatic", jsxImportSource: importFrom }
          : {
              jsxFactory: "h",
              jsxFragment: "Fragment",
              jsxInject: `import { h, Fragment } from ${JSON.stringify(importFrom)}`,
            },
      };
    },
    configResolved(config) {
      serving = config.command === "serve"; // HMR chỉ có ý nghĩa khi chạy dev server
    },
    transform(code, id) {
      if (!hmr || !serving) return null;
      if (id.startsWith("\0")) return null;
      const file = id.split("?")[0];
      if (!SRC.test(file) || file.includes("node_modules")) return null;
      if (code.includes("import.meta.hot")) return null; // người dùng tự xử lý HMR
      const m = MOUNT_IMPORT.exec(code);
      if (!m || !isFluxaSpec(m[1])) return null;
      // Thêm vào CUỐI file để không làm lệch số dòng / sourcemap
      const spec = JSON.stringify(m[1]);
      return {
        code:
          code +
          `\n;import { unmountAll as __fluxaUnmountAll } from ${spec};\n` +
          `if (import.meta.hot) { import.meta.hot.accept(); import.meta.hot.dispose(() => __fluxaUnmountAll()); }\n`,
        map: null,
      };
    },
  };
}
