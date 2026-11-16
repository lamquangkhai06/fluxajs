import type { Signal } from "./fluxa.js";
type Reader<T> = (() => T) & { peek(): T };

/** Tự lưu signal vào localStorage và đọc lại khi tải trang. */
export function persist<T>(
  s: Signal<T>,
  key: string,
  options?: { storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null; revive?: (stored: any) => T; save?: (value: T) => unknown }
): Signal<T>;

export type Rule<T = any> = (value: T, all: Record<string, any>) => string | false | null | undefined;
export const rules: {
  required(msg?: string): Rule;
  minLength(n: number, msg?: string): Rule;
  maxLength(n: number, msg?: string): Rule;
  pattern(re: RegExp, msg?: string): Rule;
  email(msg?: string): Rule;
  number(msg?: string): Rule;
  min(n: number, msg?: string): Rule;
  max(n: number, msg?: string): Rule;
  matches(otherField: string, msg?: string): Rule;
};

export interface FormField<T> {
  value: Signal<T>;
  /** Lỗi chỉ hiện sau khi người dùng đã sửa trường hoặc đã bấm gửi. */
  error(): string;
  dirty(): boolean;
  valid(): boolean;
  reset(): void;
}
export type Form<S extends Record<string, readonly [any, ...Rule[]] | any>> = {
  [K in keyof S]: FormField<S[K] extends readonly [infer V, ...any[]] ? V : S[K]>;
} & {
  values(): { [K in keyof S]: S[K] extends readonly [infer V, ...any[]] ? V : S[K] };
  valid(): boolean;
  dirty(): boolean;
  errors(): Partial<Record<keyof S & string, string>>;
  submitting(): boolean;
  submitted(): boolean;
  reset(): void;
  /** Trả về hàm xử lý sự kiện submit; handler chỉ chạy khi form hợp lệ. */
  submit(handler?: (values: any) => void | Promise<void>): (e?: Event) => Promise<void>;
};
export function form<const S extends Record<string, readonly [any, ...Rule[]] | any>>(
  spec: S,
  options?: { onSubmit?: (values: any) => void | Promise<void> }
): Form<S>;

export interface I18n<L extends string = string> {
  locale: Signal<L>;
  locales: L[];
  setLocale(l: L): void;
  t(key: string, params?: Record<string, unknown>): string;
  /** Trả về hàm phản ứng, dùng thẳng làm nội dung: p(i18n.text("chao")). */
  text(key: string, params?: Record<string, unknown>): () => string;
  n(num: number, options?: Intl.NumberFormatOptions): string;
  date(d: Date | number | string, options?: Intl.DateTimeFormatOptions): string;
}
export function createI18n<const M extends Record<string, Record<string, any>>>(
  messages: M,
  options?: { locale?: keyof M & string; fallback?: keyof M & string; persistKey?: string; storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null }
): I18n<keyof M & string>;

export type ThemeMode = "light" | "dark" | "auto";
export function createTheme(options?: {
  key?: string;
  initial?: ThemeMode;
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
  media?: { matches: boolean; addEventListener?: (type: "change", fn: (e: { matches: boolean }) => void) => void } | null;
}): {
  mode: Signal<ThemeMode>;
  resolved(): "light" | "dark";
  setMode(m: ThemeMode): void;
  toggle(): void;
};

/** Bản chậm của signal: chỉ đổi sau khi nguồn đứng yên `ms` mili giây. */
export function debounced<T>(source: Signal<T> | Reader<T>, ms?: number): Reader<T>;
/** true/false theo media query (luôn false nếu không có matchMedia). */
export function media(query: string, options?: { matchMedia?: ((q: string) => { matches: boolean; addEventListener?: (t: "change", f: (e: { matches: boolean }) => void) => void; removeEventListener?: (t: "change", f: (e: { matches: boolean }) => void) => void }) | null }): Reader<boolean>;
/** true/false: máy có mạng không. */
export function online(options?: { target?: { addEventListener(n: string, f: () => void): void; removeEventListener(n: string, f: () => void): void } }): Reader<boolean>;
/** Hoàn tác / làm lại cho một signal. */
export function history<T>(source: Signal<T>, options?: { limit?: number }): {
  undo(): void; redo(): void; clear(): void; canUndo: Reader<boolean>; canRedo: Reader<boolean>;
};
