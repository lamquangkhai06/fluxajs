/*! Fluxa JSX runtime — dùng với jsx: "react-jsx" và jsxImportSource: "fluxa-ui". MIT License. */
import { h, Fragment } from "./fluxa.js";

export { Fragment };

/** Biến <div class="a">…</div> thành lời gọi h(). Key chỉ để tương thích, bị bỏ qua. */
export function jsx(type, props) {
  const { children, ...rest } = props || {};
  const kids = children === undefined ? [] : Array.isArray(children) ? children : [children];
  return h(type, rest, ...kids);
}

export const jsxs = jsx;
export const jsxDEV = jsx;
