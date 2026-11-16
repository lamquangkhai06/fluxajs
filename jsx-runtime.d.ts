import type { Fragment as F } from "./fluxa.js";

export namespace JSX {
  type Element = any;
  interface IntrinsicElements {
    [tag: string]: any;
  }
  interface ElementChildrenAttribute {
    children: {};
  }
}
export const Fragment: typeof F;
export function jsx(type: any, props: any, key?: any): any;
export function jsxs(type: any, props: any, key?: any): any;
export function jsxDEV(type: any, props: any, key?: any): any;
