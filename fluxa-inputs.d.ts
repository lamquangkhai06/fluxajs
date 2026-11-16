import type { Child, Signal } from "./fluxa.js";

type Reactive<T> = T | (() => T);
type Rest = { [attr: string]: unknown };
interface FieldProps extends Rest { label?: Child; hint?: Reactive<string>; error?: Reactive<string>; id?: string; class?: string; }

export function Combobox(props: FieldProps & {
  value: Signal<string>;
  options: Array<string | { value: string; label?: string }> | (() => Array<string | { value: string; label?: string }>);
  placeholder?: string; allowCustom?: boolean; limit?: number; noResults?: string;
}): HTMLElement;
export function FileInput(props?: FieldProps & {
  value?: Signal<File[]>; accept?: string[]; maxSize?: number; maxFiles?: number; multiple?: boolean; onFiles?: (files: File[]) => void;
}): HTMLElement;
export function formatSize(bytes: number): string;
export function matchesAccept(file: { name: string; type?: string }, accept: string[]): boolean;
export function DatePicker(props: FieldProps & {
  value: Signal<string>; min?: string; max?: string; locale?: string; firstDay?: 0 | 1 | 2 | 3 | 4 | 5 | 6; placeholder?: string; clearable?: boolean;
}): HTMLElement;
export function parseDate(s: string): Date | null;
