export const version: string;

export interface Signal<T> {
  (): T;
  peek(): T;
  set(value: T | ((prev: T) => T)): void;
  /** @deprecated Kiểu Vue, vẫn chạy nhưng báo cảnh báo một lần. Hãy dùng s() để đọc và s.set(x) để ghi. */
  value: T;
}
export function signal<T>(value: T): Signal<T>;
export function signal<T = undefined>(): Signal<T | undefined>;
export function computed<T>(fn: () => T): {
  (): T;
  /** @deprecated Hãy gọi c() để đọc. */
  readonly value: T;
};
export function effect(fn: () => void | (() => void)): () => void;
export function untrack<T>(fn: () => T): T;
export function onCleanup(fn: () => void): void;
export function createRoot(fn: (dispose: () => void) => void): () => void;
export function onError(fn: (err: unknown) => void): void;

/** Chạy sau khi component được gắn vào DOM; có thể trả về hàm dọn dẹp. */
export function onMounted(fn: () => void | (() => void)): void;
/** Chạy khi component bị gỡ. */
export const onUnmounted: typeof onCleanup;
/** Chạy sau mỗi lần phần phản ứng của chính component này cập nhật (gộp một lần mỗi lô); không chạy ở lần dựng đầu. */
export function onUpdated(fn: () => void): void;
/** Gỡ mọi ứng dụng đã mount và chạy các dọn dẹp đã đăng ký (Vite plugin tự gọi khi HMR). */
export function unmountAll(): void;
/** Dùng nội bộ: đăng ký việc dọn dẹp chạy khi unmountAll(). */
export function onHotDispose(fn: () => void): void;
/** Theo dõi nguồn, gọi cb(giáTrịMới, giáTrịCũ) khi đổi. Trả về hàm dừng. */
export function watch<T>(source: () => T, cb: (value: T, old: T | undefined) => void, options?: { immediate?: boolean }): () => void;
/** Bắn sự kiện lên cha: emit(props, "change", v) gọi props.onChange(v). */
export function emit(props: Record<string, unknown> | null | undefined, name: string, ...args: unknown[]): boolean;
/** Store toàn cục phản ứng theo từng khóa (nông). Khóa __proto__/constructor/prototype bị từ chối. */
export function createStore<T extends Record<string, any>>(initial?: T): T;

/** Ràng buộc một trường của store: input({ value: model(form, "email") }). */
export function model<T extends Record<string, any>, K extends keyof T>(
  obj: T, key: K
): { (): T[K]; peek(): T[K]; set(next: T[K] | ((prev: T[K]) => T[K])): void };

export interface Resource<T> {
  data(): T | undefined;
  loading(): boolean;
  error(): unknown;
  refetch(): void;
  /** "loading" | "error" | "ready" */
  state(): "loading" | "error" | "ready";
}
/** Dữ liệu bất đồng bộ có sẵn loading/error/data; tự hủy yêu cầu cũ, bỏ qua phản hồi cũ, tự dọn. */
export function resource<T>(fetcher: (signal: AbortSignal | null) => T | Promise<T>, options?: { initial?: T }): Resource<T>;

/** Hiện nội dung theo điều kiện (cond: signal, hàm hoặc giá trị). */
export function show(cond: unknown | (() => unknown), then: Child, otherwise?: Child): () => Child;
/** Chọn nội dung theo giá trị; phần thứ ba là mặc định. */
export function choose<K extends string>(source: unknown | (() => unknown), cases: Partial<Record<K | (string & {}), Child>>, fallback?: Child): () => Child;

export type Child = Node | string | number | boolean | null | undefined | Child[] | (() => Child);
export type Props = Record<string, unknown>;
export type Component<P = Props> = (props: P & { children: Child[] }) => Child;

export const Fragment: Component;
/** Component: props được kiểm tra theo kiểu của chính component. */
export function h<F extends (props: any) => Child>(tag: F, props?: Parameters<F>[0] | null, ...children: Child[]): any;
/** Phần tử HTML. */
export function h(tag: string, props?: Props | null, ...children: Child[]): any;

export interface TagFn {
  (props?: Props | null, ...children: Child[]): HTMLElement;
  (...children: Child[]): HTMLElement;
}
export const tags: Record<string, TagFn>;
export const svgTags: Record<string, TagFn>;

/** Danh sách khóa theo định danh phần tử; cập nhật dữ liệu bất biến. */
export function list<T>(items: () => T[], render: (item: T, index: () => number) => Child): () => Child;

/** Trả về hàm gỡ ứng dụng. */
export function mount(root: string | Element, view: Child | (() => Child)): () => void;

export function safeUrl(value: unknown): string | null;
export function unsafeHTML(html: string, sanitize: (html: string) => string): DocumentFragment;
