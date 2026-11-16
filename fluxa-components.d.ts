import type { Child, Signal } from "./fluxa.js";

type Reactive<T> = T | (() => T);
type Rest = { [attr: string]: unknown };

export const uid: (prefix?: string) => string;
export function cx(...parts: Array<string | false | null | undefined | (() => string | false | null | undefined)>): string | (() => string);

export interface ButtonProps extends Rest {
  variant?: "primary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: Reactive<boolean>;
  disabled?: Reactive<boolean>;
  type?: "button" | "submit" | "reset";
  class?: string;
  children?: Child;
}
export function Button(props?: ButtonProps): HTMLButtonElement;
export function Spinner(props?: { label?: string; small?: boolean }): HTMLElement;
export function Card(props?: { title?: Child; class?: string; children?: Child } & Rest): HTMLElement;
export function Badge(props?: { tone?: "neutral" | "info" | "success" | "warning" | "danger"; class?: string; children?: Child } & Rest): HTMLElement;
export function Alert(props?: {
  tone?: "info" | "success" | "warning" | "danger";
  title?: Child;
  onClose?: () => void;
  class?: string;
  children?: Child;
} & Rest): HTMLElement;

interface FieldProps extends Rest {
  label?: Child;
  hint?: Reactive<string>;
  error?: Reactive<string>;
  id?: string;
  class?: string;
}
export function Input(props?: FieldProps & { value?: Signal<string> | Reactive<string>; type?: string }): HTMLElement;
export function Select(props?: FieldProps & {
  value?: Signal<string> | Reactive<string>;
  options?: Array<string | { value: string | number; label?: string; disabled?: boolean }> | (() => Array<string | { value: string | number; label?: string; disabled?: boolean }>);
}): HTMLElement;
export function Checkbox(props?: { checked?: Signal<boolean> | Reactive<boolean>; label?: Child; id?: string; class?: string } & Rest): HTMLElement;

export function Modal(props: {
  open: Signal<boolean>;
  title?: Child;
  onClose?: () => void;
  dismissOnBackdrop?: boolean;
  class?: string;
  children?: Child;
}): () => Child;

export interface TabItem {
  id: string | number;
  label: Child;
  /** Node hoặc hàm trả về node (hàm chỉ chạy khi tab được chọn). */
  content: Child | (() => Child);
}
export function Tabs(props: { tabs: TabItem[]; value?: Signal<string | number>; class?: string }): HTMLElement;

export function createToaster(options?: { max?: number; timeout?: number }): {
  Toaster: () => HTMLElement;
  show: (message: string, options?: { tone?: "info" | "success" | "warning" | "danger"; timeout?: number }) => number;
  dismiss: (id: number) => void;
};

// ───────── Hiển thị dữ liệu ─────────
export function Progress(props?: {
  value?: Reactive<number>;
  max?: Reactive<number>;
  tone?: "info" | "success" | "warning" | "danger";
  label?: string;
  class?: string;
} & Rest): HTMLElement;
export function Skeleton(props?: { lines?: number; circle?: boolean; width?: number | string; height?: number | string; class?: string } & Rest): HTMLElement;
export function Avatar(props?: { name?: string; src?: string; size?: "sm" | "md" | "lg"; alt?: string; class?: string } & Rest): HTMLElement;
export function Tooltip(props: { text: Reactive<string>; class?: string; children?: Child } & Rest): HTMLElement;

export interface TableColumn<Row = Record<string, unknown>> {
  key?: keyof Row & string;
  label?: Child;
  align?: "left" | "center" | "right";
  sortable?: boolean;
  render?: (row: Row) => Child;
}
export function Table<Row extends Record<string, unknown> = Record<string, unknown>>(props: {
  columns: TableColumn<Row>[];
  rows?: Row[] | (() => Row[]);
  caption?: Child;
  empty?: Child;
  sortable?: boolean;
  class?: string;
} & Rest): HTMLElement;

export function Pagination(props: {
  page: Signal<number>;
  pages: Reactive<number>;
  siblings?: number;
  onChange?: (page: number) => void;
  class?: string;
} & Rest): HTMLElement;

export interface MenuItem {
  label?: string;
  onclick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
}
export function Dropdown(props?: {
  label?: Child;
  items?: MenuItem[] | (() => MenuItem[]);
  variant?: "primary" | "ghost" | "danger";
  align?: "start" | "end";
  class?: string;
} & Rest): HTMLElement;

// ───── 0.10: form bổ sung, bố cục và điều hướng ─────
type Opt = { value: string | number; label?: string; disabled?: boolean };
export function Textarea(props?: FieldProps & { value: Signal<string>; rows?: number; maxlength?: number }): HTMLElement;
export function RadioGroup(props: FieldProps & { value: Signal<string>; options: Array<string | Opt>; inline?: boolean; name?: string }): HTMLElement;
export function Switch(props?: { checked?: Signal<boolean> | Reactive<boolean>; label?: Child; id?: string; class?: string } & Rest): HTMLElement;
export function Slider(props: FieldProps & { value: Signal<number>; min?: number; max?: number; step?: number; showValue?: boolean }): HTMLElement;
export function Rating(props: { value: Signal<number>; max?: number; readonly?: boolean; label?: string; class?: string } & Rest): HTMLElement;
export interface AccordionItem { title: Child; content: Child | (() => Child); }
export function Accordion(props: { items: AccordionItem[]; multiple?: boolean; open?: number | number[]; class?: string } & Rest): HTMLElement;
export interface Crumb { label: string; href?: string; }
export function Breadcrumb(props?: { items?: Crumb[]; label?: string; class?: string } & Rest): HTMLElement;
export function Drawer(props: { open: Signal<boolean>; side?: "left" | "right" | "bottom"; title?: Reactive<string>; class?: string; children?: Child } & Rest): Child;
export function Stepper(props?: { steps?: string[]; current?: Reactive<number>; class?: string } & Rest): HTMLElement;
export function Popover(props?: { label?: Child; title?: string; align?: "start" | "end"; variant?: "primary" | "ghost" | "danger"; class?: string; children?: Child } & Rest): HTMLElement;
