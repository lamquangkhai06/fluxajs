import type { Child } from "./fluxa.js";

export interface RouteContext {
  params: Record<string, string>;
  query: () => Record<string, string | string[]>;
  hash: () => string;
  path: () => string | null;
}
export type RouteHandler = (ctx: RouteContext) => Child;

export interface Destination {
  path: string;
  query: Record<string, string | string[]>;
  hash: string;
}
export interface RouterOptions {
  mode?: "history" | "hash";
  base?: string;
  /** Trả về true để cho đi, false để chặn, hoặc đường dẫn để chuyển hướng. Chỉ là UX, không phải bảo mật. */
  beforeEach?: (dest: Destination) => boolean | string | void;
}
export interface Router {
  view: () => Child;
  link: (props: Record<string, unknown> | null, ...children: Child[]) => HTMLAnchorElement;
  navigate: (to: string, opts?: { replace?: boolean }) => boolean;
  path: () => string | null;
  query: () => Record<string, string | string[]>;
  hash: () => string;
  params: () => Record<string, string> | null;
  destroy: () => void;
}

export function createRouter(routes: Record<string, RouteHandler>, options?: RouterOptions): Router;
export function parseQuery(search: string): Record<string, string | string[]>;
export function sameOriginPath(to: string, loc?: Location): string | null;
export function compileRoutes(routes: Record<string, RouteHandler>): unknown[];
export function matchRoute(table: unknown[], path: string): { handler: RouteHandler; params: Record<string, string>; pattern: string } | null;
