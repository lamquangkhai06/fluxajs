export interface FluxaPluginOptions {
  /** Nơi import h và Fragment ở chế độ classic (mặc định "fluxa-ui"). */
  importFrom?: string;
  /** true: dùng jsx-runtime tự động; mặc định false (classic, pragma h). */
  automatic?: boolean;
  /** HMR giữ state (mặc định true). false: Vite tải lại toàn trang khi sửa file. */
  hmr?: boolean;
}
export interface FluxaVitePlugin {
  name: string;
  config(): { esbuild: Record<string, unknown> };
  configResolved(config: { command: string }): void;
  transform(code: string, id: string): { code: string; map: null } | null;
}
export default function fluxa(options?: FluxaPluginOptions): FluxaVitePlugin;
