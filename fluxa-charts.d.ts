type Reactive<T> = T | (() => T);
type Rest = { [attr: string]: unknown };
export interface Point { label: string; value: number; }
export interface Series { name?: string; values: number[]; }
interface ChartBase extends Rest { title?: string; locale?: string; format?: (v: number) => string; label?: string; class?: string; }
export type ChartProps = ChartBase & ({ data: Reactive<Point[]> } | { labels: Reactive<string[]>; series: Reactive<Series[]> });
export function LineChart(props: ChartProps): HTMLElement;
export function BarChart(props: ChartProps): HTMLElement;
export function DonutChart(props: ChartBase & { data: Reactive<Point[]>; centerLabel?: Reactive<string> }): HTMLElement;
export function niceScale(min: number, max: number, ticks?: number): { lo: number; hi: number; ticks: number[] };
