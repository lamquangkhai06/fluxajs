// fake-dom.js — DOM tối giản chỉ để chạy test trong Node. Không thuộc framework.

class FNode {
  constructor() {
    this.parentNode = null;
    this.childNodes = [];
  }
  get nextSibling() {
    const p = this.parentNode;
    return p ? p.childNodes[p.childNodes.indexOf(this) + 1] || null : null;
  }
  _detach() {
    const p = this.parentNode;
    if (p) {
      p.childNodes.splice(p.childNodes.indexOf(this), 1);
      this.parentNode = null;
    }
  }
  insertBefore(node, ref) {
    if (node.nodeType === 11) {
      for (const c of [...node.childNodes]) this.insertBefore(c, ref);
      return node;
    }
    node._detach();
    const i = ref ? this.childNodes.indexOf(ref) : this.childNodes.length;
    if (i < 0) throw new Error("fake-dom: ref is not a child");
    this.childNodes.splice(i, 0, node);
    node.parentNode = this;
    return node;
  }
  append(...ns) {
    for (const n of ns) this.insertBefore(typeof n === "string" ? new FText(n) : n, null);
  }
  before(...ns) {
    for (const n of ns) this.parentNode.insertBefore(typeof n === "string" ? new FText(n) : n, this);
  }
  remove() {
    this._detach();
  }
  get textContent() {
    return this.childNodes.map((c) => c.textContent).join("");
  }
  set textContent(v) {
    for (const c of [...this.childNodes]) c._detach();
    if (v) this.append(String(v));
  }
}
class FText extends FNode {
  constructor(d) {
    super();
    this.nodeType = 3;
    this.data = String(d);
  }
  get textContent() {
    return this.data;
  }
  set textContent(v) {
    this.data = String(v);
  }
}
class FComment extends FNode {
  constructor() {
    super();
    this.nodeType = 8;
  }
  get textContent() {
    return "";
  }
}
class FFragment extends FNode {
  constructor() {
    super();
    this.nodeType = 11;
  }
}
class FElement extends FNode {
  constructor(tag, ns = "http://www.w3.org/1999/xhtml") {
    super();
    this.nodeType = 1;
    this.tagName = tag.toUpperCase();
    this.namespaceURI = ns;
    this.attrs = Object.create(null);
    this.className = "";
    this.style = { cssText: "", overflow: "", setProperty(k, v) { this[k] = v; } };
    this.listeners = {};
  }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  hasAttribute(k) { return k in this.attrs; }
  removeAttribute(k) { delete this.attrs[k]; }
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
  focus() { globalThis.document.activeElement = this; }
  querySelectorAll() { return []; }
}

const docListeners = {};
globalThis.Node = FNode;
globalThis.document = {
  createElement: (t) => new FElement(t),
  createElementNS: (ns, t) => new FElement(t, ns),
  createTextNode: (d) => new FText(d),
  createComment: () => new FComment(),
  createDocumentFragment: () => new FFragment(),
  querySelector: () => null,
  body: null,
  activeElement: null,
  addEventListener: (t, f) => (docListeners[t] ||= []).push(f),
  removeEventListener: (t, f) => (docListeners[t] = (docListeners[t] || []).filter((x) => x !== f)),
};
globalThis.document.body = new FElement("body");
export const fireDoc = (type, ev = {}) => {
  const e = { type, preventDefault() {}, ...ev };
  (docListeners[type] || []).slice().forEach((f) => f(e));
};
export const docListenerCount = (t) => (docListeners[t] || []).length;

export const serialize = (n) => {
  if (n.nodeType === 3) return n.data;
  if (n.nodeType === 8) return "";
  const kids = n.childNodes.map(serialize).join("");
  if (n.nodeType === 11) return kids;
  const attrs = Object.entries(n.attrs).map(([k, v]) => ` ${k}="${v}"`).join("");
  const cls = n.className ? ` class="${n.className}"` : "";
  const t = n.tagName.toLowerCase();
  return `<${t}${cls}${attrs}>${kids}</${t}>`;
};

export const fire = (el, type, ev = {}) => {
  const e = {
    type, target: el, currentTarget: el, button: 0, defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true; }, ...ev,
  };
  (el.listeners[type] || []).forEach((f) => f(e));
  return e;
};

// Location / history / window giả để test router
export const loc = {
  origin: "http://localhost",
  pathname: "/",
  search: "",
  hash: "",
  get href() {
    return this.origin + this.pathname + this.search + this.hash;
  },
};
const apply = (url) => {
  const u = new URL(url, loc.href);
  loc.pathname = u.pathname;
  loc.search = u.search;
  loc.hash = u.hash;
};
export const setLocation = apply;
globalThis.location = loc;
globalThis.history = {
  pushState: (_s, _t, url) => apply(url),
  replaceState: (_s, _t, url) => apply(url),
};
const winListeners = {};
globalThis.window = {
  addEventListener: (t, f) => (winListeners[t] ||= []).push(f),
  removeEventListener: (t, f) => (winListeners[t] = (winListeners[t] || []).filter((x) => x !== f)),
  scrollTo() {},
};
export const firePop = () => (winListeners.popstate || []).forEach((f) => f());
