/*! Fluxa 0.10.0 — UI framework siêu nhẹ dựa trên signals, bảo mật theo mặc định. MIT License. */

export const version = "0.10.0";
const SVG_NS = "http://www.w3.org/2000/svg";

// ───────────── Báo lỗi ─────────────
let errorHandler = (err) => console.error(err);
/** Đặt hàm xử lý lỗi toàn cục (lỗi trong effect, URL bị chặn, thuộc tính bị chặn...). */
export const onError = (fn) => {
  if (typeof fn === "function") errorHandler = fn;
};
const report = (err) => {
  try {
    errorHandler(err);
  } catch {
    /* hàm xử lý lỗi bị lỗi thì cũng không được làm sập framework */
  }
};

// ───────────── Reactivity ─────────────
let tracking = null; // observer đang ghi nhận phụ thuộc
let owner = null; // chủ sở hữu: nơi đăng ký effect con để tự dọn dẹp
const queue = new Set();
let pending = false;
let chain = 0;
const MAX_CHAIN = 100; // số lần cập nhật nối tiếp tối đa trong một tác vụ

// comp: component gần nhất chứa phạm vi này (dùng cho onUpdated)
const makeOwner = () => ({
  deps: new Set(), kids: [], offs: [], fins: [], alive: true,
  comp: owner ? (owner.isComp ? owner : owner.comp) : null,
});
const safe = (f) => {
  try {
    f();
  } catch (err) {
    report(err);
  }
};

const flush = () => {
  pending = false;
  if (++chain === 1) setTimeout(() => (chain = 0));
  if (chain > MAX_CHAIN) {
    // Chống vòng lặp vô hạn (effect ghi vào chính signal nó đọc): bỏ cập nhật thay vì treo trang
    queue.clear();
    chain = 0;
    report(new Error("Fluxa: possible infinite update loop - pending updates were dropped"));
    return;
  }
  const jobs = [...queue];
  queue.clear();
  const touched = new Set(); // component có phần phản ứng vừa cập nhật trong lô này
  for (const e of jobs) {
    if (!e.alive) continue;
    try {
      e.run();
      if (e.comp && e.comp.upd) touched.add(e.comp);
    } catch (err) {
      report(err);
    }
  }
  touched.forEach((c) => {
    if (c.alive) c.upd.slice().forEach((f) => safe(() => untrack(f)));
  });
};
const schedule = (e) => {
  queue.add(e);
  if (!pending) {
    pending = true;
    queueMicrotask(flush);
  }
};
const notify = (n) => (n.notify ? n.notify() : schedule(n));

const cleanup = (e) => {
  e.deps.forEach((subs) => subs.delete(e));
  e.deps.clear();
  e.kids.splice(0).forEach((k) => dispose(k));
  e.offs.splice(0).forEach(safe);
};
function dispose(e) {
  if (!e.alive) return;
  e.alive = false;
  cleanup(e);
  e.fins.splice(0).forEach(safe);
}

let warnedValue = false;
// Thói quen từ Vue: count.value. Vẫn chạy đúng (để code do AI viết không hỏng) nhưng báo MỘT lần để người viết biết cách chuẩn.
const withValue = (f, writable) => {
  const warn = () => {
    if (warnedValue) return;
    warnedValue = true;
    report(new Error("Fluxa: read a signal by calling it, count(), and write with count.set(x). `.value` works but is not the Fluxa way."));
  };
  Object.defineProperty(f, "value", {
    get: () => (warn(), f()),
    set: writable ? (v) => (warn(), f.set(v)) : undefined,
  });
  return f;
};

/** Giá trị phản ứng. s() đọc, s.set(v | fn) ghi, s.peek() đọc không theo dõi. */
export function signal(value) {
  const subs = new Set();
  const s = () => {
    if (tracking) {
      subs.add(tracking);
      tracking.deps.add(subs);
    }
    return value;
  };
  s.peek = () => value;
  s.set = (next) => {
    if (typeof next === "function") next = next(value);
    if (Object.is(next, value)) return;
    value = next;
    [...subs].forEach(notify);
  };
  return withValue(s, true);
}

/** Chạy fn ngay, rồi chạy lại khi signal nó đọc thay đổi. Trả về hàm dừng. */
export function effect(fn) {
  const e = makeOwner();
  e.run = () => {
    cleanup(e);
    const pt = tracking;
    const po = owner;
    tracking = owner = e;
    try {
      const off = fn();
      if (typeof off === "function") e.offs.push(off);
    } finally {
      tracking = pt;
      owner = po;
    }
  };
  if (owner) owner.kids.push(e);
  e.run();
  return () => dispose(e);
}

/** Giá trị suy ra, lười tính và luôn mới: đọc ngay sau khi ghi vẫn đúng. */
export function computed(fn) {
  const subs = new Set();
  const node = makeOwner();
  let value;
  let dirty = true;
  let busy = false;
  node.notify = () => {
    if (!dirty) {
      dirty = true;
      [...subs].forEach(notify);
    }
  };
  if (owner) owner.kids.push(node);
  return withValue(() => {
    if (tracking) {
      subs.add(tracking);
      tracking.deps.add(subs);
    }
    if (dirty && node.alive) {
      if (busy) throw new Error("Fluxa: circular dependency in computed()");
      busy = true;
      cleanup(node);
      const pt = tracking;
      const po = owner;
      tracking = owner = node;
      try {
        value = fn();
        dirty = false;
      } finally {
        tracking = pt;
        owner = po;
        busy = false;
      }
    }
    return value;
  });
}

/** Chạy fn mà không theo dõi signal nào. */
export function untrack(fn) {
  const pt = tracking;
  tracking = null;
  try {
    return fn();
  } finally {
    tracking = pt;
  }
}

/** Đăng ký hàm dọn dẹp, chạy khi effect/component chạy lại hoặc bị gỡ. */
export function onCleanup(fn) {
  if (owner) owner.offs.push(fn);
}

/** Tạo phạm vi sở hữu riêng; gọi dispose() để dọn mọi effect bên trong. */
export function createRoot(fn) {
  const scope = makeOwner();
  const po = owner;
  const pt = tracking;
  owner = scope;
  tracking = null;
  try {
    fn(() => dispose(scope));
  } finally {
    owner = po;
    tracking = pt;
  }
  return () => dispose(scope);
}

// ───────────── Vòng đời, watch, emit, store ─────────────

/**
 * Chạy fn sau khi component đã được gắn vào cây DOM (cuối tác vụ đồng bộ hiện tại).
 * fn có thể trả về hàm dọn dẹp. Không chạy nếu component bị gỡ trước đó.
 */
export function onMounted(fn) {
  const o = owner;
  if (!o) return;
  queueMicrotask(() => {
    if (!o.alive) return;
    try {
      const off = untrack(fn);
      if (typeof off === "function") {
        if (o.alive) o.offs.push(off);
        else safe(off);
      }
    } catch (err) {
      report(err);
    }
  });
}

/** Chạy fn khi component bị gỡ khỏi cây (hoặc phạm vi chứa nó bị dọn). */
export const onUnmounted = onCleanup;

/**
 * Chạy sau mỗi lần phần phản ứng của CHÍNH component này (nội dung động, thuộc tính động, effect, watch)
 * cập nhật. Các thay đổi trong cùng một lô chỉ gọi một lần. Không chạy ở lần dựng đầu tiên
 * (dùng onMounted cho việc đó) và không chạy khi chỉ component con thay đổi.
 */
export function onUpdated(fn) {
  const c = owner && (owner.isComp ? owner : owner.comp);
  if (c && typeof fn === "function") (c.upd ||= []).push(fn);
}

/**
 * Theo dõi một nguồn và gọi cb(giáTrịMới, giáTrịCũ) mỗi khi nó đổi.
 * Muốn chạy việc gì đó sau khi phần giao diện của component cập nhật xong, dùng onUpdated().
 */
export function watch(source, cb, { immediate = false } = {}) {
  if (typeof source !== "function" || typeof cb !== "function")
    throw new TypeError("Fluxa: watch(source, cb) needs two functions");
  let first = true;
  let prev;
  return effect(() => {
    const v = source();
    const old = prev;
    prev = v;
    if (first) {
      first = false;
      if (!immediate) return;
    }
    untrack(() => {
      cb(v, old);
    });
  });
}

/**
 * Bắn sự kiện từ con lên cha: emit(props, "change", value) gọi props.onChange(value).
 * Không phân biệt hoa thường (onChange / onchange). Trả về true nếu có người nghe.
 */
export function emit(props, name, ...args) {
  if (!props || typeof props !== "object" || typeof name !== "string" || !/^[A-Za-z][A-Za-z0-9]*$/.test(name))
    return false;
  const want = ("on" + name).toLowerCase();
  for (const k of Object.keys(props)) {
    if (k.toLowerCase() === want && typeof props[k] === "function") {
      props[k](...args);
      return true;
    }
  }
  return false;
}

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const storeKey = (k) => {
  if (typeof k !== "string" || FORBIDDEN_KEYS.has(k)) throw new Error(`Fluxa: store key ${String(k)} is not allowed`);
  return k;
};

/**
 * Store toàn cục dùng chung giữa các component không liên quan nhau.
 * Phản ứng theo từng khóa ở mức nông: gán store.x = giáTrịMới (đừng sửa tại chỗ bên trong object lồng nhau,
 * hãy gán object mới). Khóa nguy hiểm (__proto__, constructor, prototype) bị từ chối.
 */
export function createStore(initial = {}) {
  if (initial === null || typeof initial !== "object" || Array.isArray(initial))
    throw new TypeError("Fluxa: createStore() needs a plain object");
  const data = Object.create(null);
  const sigs = Object.create(null);
  const shape = signal(0); // đổi khi thêm / xóa khóa
  const sig = (k) => sigs[k] || (sigs[k] = signal(data[k]));
  for (const k of Object.keys(initial)) data[storeKey(k)] = initial[k];
  return new Proxy(data, {
    get(_, k) {
      if (typeof k !== "string" || FORBIDDEN_KEYS.has(k)) return undefined;
      if (!(k in data)) {
        shape(); // khóa chưa tồn tại: theo dõi việc thêm khóa, không tạo signal mới (tránh phình bộ nhớ)
        return undefined;
      }
      return sig(k)();
    },
    set(_, k, v) {
      storeKey(k);
      const had = k in data;
      data[k] = v;
      if (sigs[k]) sigs[k].set(v);
      else sig(k);
      if (!had) shape.set((n) => n + 1);
      return true;
    },
    deleteProperty(_, k) {
      storeKey(k);
      if (k in data) {
        delete data[k];
        if (sigs[k]) sigs[k].set(undefined);
        shape.set((n) => n + 1);
      }
      return true;
    },
    has(_, k) {
      shape();
      return typeof k === "string" && k in data;
    },
    ownKeys(t) {
      shape();
      return Reflect.ownKeys(t);
    },
    defineProperty() {
      throw new Error("Fluxa: assign to the store directly (store.key = value)");
    },
    setPrototypeOf() {
      return false;
    },
  });
}

/**
 * Ràng buộc một trường của store với ô nhập: input({ value: model(form, "email") }).
 * Trả về hàm đọc có .set nên dùng được ở mọi nơi nhận signal. Hãy truyền object tạo bởi createStore
 * (object thường vẫn ghi được nhưng không phản ứng). Khóa __proto__/constructor/prototype bị từ chối.
 */
export function model(obj, key) {
  if (obj === null || typeof obj !== "object") throw new TypeError("Fluxa: model(obj, key) needs an object");
  storeKey(key);
  const f = () => obj[key];
  f.peek = () => untrack(() => obj[key]);
  f.set = (next) => {
    obj[key] = typeof next === "function" ? next(untrack(() => obj[key])) : next;
  };
  return f;
}

/**
 * Dữ liệu bất đồng bộ:
 *   const user = resource((signal) => fetch(`/api/users/${id()}`, { signal }).then((r) => r.json()));
 *   user.data()  user.loading()  user.error()  user.refetch()
 * Tự chạy lại khi signal được đọc ĐỒNG BỘ trong fetcher (trước await đầu tiên) đổi; hủy yêu cầu cũ,
 * bỏ qua phản hồi cũ (không bao giờ hiện dữ liệu lỗi thời); tự dọn khi component bị gỡ.
 * Khi tải lại, data cũ được giữ nguyên đến khi có data mới.
 */
export function resource(fetcher, { initial } = {}) {
  if (typeof fetcher !== "function") throw new TypeError("Fluxa: resource(fetcher) needs a function");
  const data = signal(initial);
  const error = signal(undefined);
  const loading = signal(true);
  const again = signal(0);
  let run = 0;
  effect(() => {
    again();
    const id = ++run;
    const ctl = typeof AbortController === "function" ? new AbortController() : null;
    loading.set(true);
    error.set(undefined);
    let p;
    try {
      p = Promise.resolve(fetcher(ctl && ctl.signal));
    } catch (e) {
      p = Promise.reject(e);
    }
    p.then(
      (v) => {
        if (id !== run) return;
        data.set(v);
        loading.set(false);
      },
      (e) => {
        if (id !== run) return;
        error.set(e);
        loading.set(false);
      }
    );
    return () => {
      run++; // phản hồi của lần chạy này (nếu đến muộn) sẽ bị bỏ qua
      if (ctl) ctl.abort();
    };
  });
  return {
    data: () => data(),
    loading: () => loading(),
    error: () => error(),
    refetch: () => again.set((n) => n + 1),
    /** "loading" | "error" | "ready": dùng với choose() để khỏi viết điều kiện lồng nhau. */
    state: () => (loading() ? "loading" : error() === undefined ? "ready" : "error"),
  };
}

const valueOf = (v) => (typeof v === "function" ? v() : v);

/**
 * Hiện nội dung theo điều kiện, khỏi viết `? :`:
 *   show(loggedIn, () => p("Chào bạn!"), () => p("Hãy đăng nhập"))
 *   show(() => items().length, ul(...))        // thiếu nhánh sau thì không hiện gì
 * cond là signal, hàm hoặc giá trị thường. Nhánh nên là hàm để chỉ được dựng khi cần.
 * Chỉ dựng lại khi kết quả đúng/sai đổi, không dựng lại mỗi khi dữ liệu bên trong đổi.
 */
export function show(cond, then, otherwise = null) {
  const on = signal(false);
  effect(() => on.set(!!valueOf(cond)));
  return () => (on() ? then : otherwise);
}

/**
 * Chọn nội dung theo giá trị, khỏi viết `if / else if` hay `switch`:
 *   choose(user.state, { loading: "Đang tải…", error: () => p("Lỗi"), ready: () => p(user.data().name) })
 *   choose(tab, { home: Home, about: About }, NotFound)   // phần thứ ba là mặc định
 * Chỉ tra khóa của chính object bạn đưa vào (không bao giờ đọc nhầm khóa kế thừa như "constructor").
 */
export function choose(source, cases, fallback = null) {
  if (cases === null || typeof cases !== "object") throw new TypeError("Fluxa: choose(source, cases) needs an object of cases");
  const key = signal("");
  effect(() => key.set(String(valueOf(source))));
  return () => (Object.hasOwn(cases, key()) ? cases[key()] : fallback);
}

// ───────────── Bảo mật ─────────────
const TAG_RE = /^[a-z][a-z0-9-]*$/;
const ATTR_RE = /^[A-Za-z_:][-\w:.]*$/;
// Thẻ có thể chạy mã, tải tài nguyên ngoài hoặc đổi hành vi cả trang
const BLOCKED_TAGS = new Set([
  "script", "object", "embed", "applet", "base", "meta", "link", "style",
  "frame", "frameset", "foreignobject",
]);
// Thuộc tính là "cổng" chèn HTML/đa nguồn
const BLOCKED_PROPS = new Set(["innerhtml", "outerhtml", "srcdoc", "srcset", "ping"]);
// Thuộc tính chứa URL: chỉ cho phép giao thức an toàn
const URL_ATTRS = new Set([
  "href", "src", "action", "formaction", "poster", "cite", "background",
  "xlink:href", "longdesc", "data", "manifest",
]);
const FORM_PROPS = new Set(["value", "checked", "selected", "indeterminate", "muted"]);
const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

/**
 * Trả về chính URL nếu an toàn, ngược lại null.
 * Dùng bộ phân tích URL chuẩn của trình duyệt nên miễn nhiễm với các mẹo
 * như "JaVaScRiPt:", "java\tscript:", khoảng trắng đầu chuỗi...
 */
export function safeUrl(value) {
  if (value == null) return null;
  const s = String(value).trim();
  try {
    // Gốc giả chỉ để phân giải URL tương đối; giao thức tường minh luôn thắng gốc
    return SAFE_PROTOCOLS.has(new URL(s, "https://fluxa.invalid/").protocol) ? s : null;
  } catch {
    return null;
  }
}

const checkTag = (tag) => {
  const name = String(tag).toLowerCase();
  if (!TAG_RE.test(name)) throw new Error(`Fluxa: invalid tag name "${tag}"`);
  if (BLOCKED_TAGS.has(name)) throw new Error(`Fluxa: <${name}> is blocked for security reasons`);
  return name;
};

/** Chèn HTML thô. Bắt buộc truyền hàm làm sạch (ví dụ DOMPurify.sanitize) - cố ý bất tiện. */
export function unsafeHTML(html, sanitize) {
  if (typeof sanitize !== "function")
    throw new TypeError("Fluxa: unsafeHTML(html, sanitize) requires a sanitizer function, e.g. DOMPurify.sanitize");
  const t = document.createElement("template");
  t.innerHTML = trustedHTML(sanitize(String(html)));
  return t.content;
}

// Trusted Types: nếu trang bật `require-trusted-types-for 'script'`, kết quả của hàm làm sạch được bọc bằng
// chính sách "fluxa" (CSP cần `trusted-types fluxa`). Sink innerHTML này là chỗ DUY NHẤT của Fluxa chạm tới DOM bằng chuỗi.
let ttPolicy;
const trustedHTML = (html) => {
  const tt = globalThis.trustedTypes;
  if (!tt) return html;
  if (tt.isHTML && tt.isHTML(html)) return html; // hàm làm sạch đã trả về TrustedHTML (ví dụ DOMPurify RETURN_TRUSTED_TYPE)
  try {
    ttPolicy ||= tt.createPolicy("fluxa", { createHTML: (x) => x });
    return ttPolicy.createHTML(html);
  } catch {
    return html; // CSP không cho tạo chính sách: trình duyệt sẽ tự từ chối, không im lặng bỏ qua
  }
};

// ───────────── DOM ─────────────
const isPrimitive = (v) => v == null || (typeof v !== "object" && typeof v !== "function");
const toText = (v) => (v == null || typeof v === "boolean" ? "" : String(v));

const LIST = Symbol("fluxa.list");
/**
 * Danh sách phản ứng, khóa theo định danh phần tử: phần tử còn giữ nguyên thì
 * giữ nguyên DOM, chỉ tạo mới / gỡ / sắp xếp lại đúng chỗ cần.
 * Hãy cập nhật dữ liệu bất biến (tạo object mới khi thay đổi một mục).
 */
export const list = (items, render) => {
  if (typeof items !== "function" || typeof render !== "function")
    throw new TypeError("Fluxa: list(items, render) needs two functions");
  const f = () => [];
  f[LIST] = { items, render };
  return f;
};

const markers = () => [document.createComment(""), document.createComment("")];
const pushTo = (map, k, v) => (map.get(k) || map.set(k, []).get(k)).push(v);

const rangeOf = (en) => {
  const out = [];
  for (let n = en.a; n; n = n.nextSibling) {
    out.push(n);
    if (n === en.b) break;
  }
  return out;
};

function insertList(parent, { items, render }) {
  const [start, end] = markers();
  parent.append(start, end);
  let entries = new Map(); // giá trị -> mảng entry (hỗ trợ giá trị trùng lặp)
  let registered = false;

  const createEntry = (v, i) => {
    const scope = makeOwner(), idx = signal(i), [a, b] = markers();
    const po = owner, pt = tracking;
    owner = scope;
    tracking = null;
    try {
      const frag = document.createDocumentFragment();
      frag.append(a);
      insert(frag, render(v, idx));
      frag.append(b);
      return { owner: scope, idx, a, b };
    } catch (err) {
      dispose(scope);
      throw err;
    } finally {
      owner = po;
      tracking = pt;
    }
  };
  const removeEntry = (en) => {
    dispose(en.owner);
    rangeOf(en).forEach((n) => n.remove());
  };

  effect(() => {
    if (!registered) {
      registered = true;
      owner.fins.push(() => {
        entries.forEach((arr) => arr.forEach((en) => dispose(en.owner)));
        entries = new Map();
      });
    }
    const src = items();
    const arr = Array.isArray(src) ? src : [];
    const next = new Map();
    const order = arr.map((v, i) => {
      const en = (entries.get(v) || []).shift();
      if (en) en.idx.set(i);
      const used = en || createEntry(v, i);
      pushTo(next, v, used);
      return used;
    });
    entries.forEach((bucket) => bucket.forEach(removeEntry)); // phần tử không còn
    entries = next;
    const par = end.parentNode;
    let ref = start.nextSibling;
    for (const en of order) {
      if (en.a === ref) {
        ref = en.b.nextSibling; // đã đúng chỗ
        continue;
      }
      for (const n of rangeOf(en)) par.insertBefore(n, ref);
    }
  });
}

function insert(parent, child) {
  if (child == null || typeof child === "boolean") return;
  if (Array.isArray(child)) return child.forEach((c) => insert(parent, c));
  if (typeof child === "function") {
    if (child[LIST]) return insertList(parent, child[LIST]);
    const [start, end] = markers();
    parent.append(start, end);
    let text = null;
    effect(() => {
      const v = child();
      // Đường nhanh: chỉ đổi nội dung chữ, không dựng lại DOM
      if (text && isPrimitive(v)) {
        text.data = toText(v);
        return;
      }
      while (start.nextSibling && start.nextSibling !== end) start.nextSibling.remove();
      text = isPrimitive(v) ? document.createTextNode(toText(v)) : null;
      const frag = document.createDocumentFragment();
      text ? frag.append(text) : insert(frag, v);
      end.before(frag);
    });
    return;
  }
  // Văn bản luôn đi qua createTextNode: không bao giờ được hiểu là HTML
  parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
}

const attr = (el, k, v) =>
  v == null || v === false ? el.removeAttribute(k) : el.setAttribute(k, v === true ? "" : String(v));

const fixRel = (el) => {
  if (String(el.getAttribute("target") || "").toLowerCase() !== "_blank") return;
  const tokens = new Set(String(el.getAttribute("rel") || "").split(/\s+/).filter(Boolean));
  tokens.add("noopener");
  tokens.add("noreferrer");
  el.setAttribute("rel", [...tokens].join(" "));
};

const blocked = (what) => report(new Error(`Fluxa: ${what}`));

/**
 * class nhận chuỗi, mảng hoặc object: class: ["btn", open() && "on"], class: { active: isActive, done: () => t.done }
 * (giá trị trong object có thể là boolean, signal hoặc hàm; hàm được theo dõi nên class tự cập nhật).
 */
const classText = (v) => {
  if (typeof v === "function") v = v();
  if (v == null || v === false || v === true) return "";
  if (Array.isArray(v)) return v.map(classText).filter(Boolean).join(" ");
  if (typeof v === "object")
    return Object.keys(v)
      .filter((k) => {
        const t = v[k];
        return typeof t === "function" ? t() : t;
      })
      .join(" ");
  return String(v);
};

const FORM_TAGS = new Set(["input", "textarea", "select"]);
const isModel = (v) => typeof v === "function" && typeof v.set === "function";
// Truyền signal (hoặc model()) vào value/checked của input/textarea/select là có ràng buộc hai chiều.
// Được thêm TRƯỚC các trình xử lý của người dùng nên khi họ đọc signal thì giá trị đã cập nhật.
function bindModel(el, name, lk, sig) {
  if (!FORM_TAGS.has(name)) return;
  const ev = lk === "checked" || name === "select" ? "change" : "input";
  el.addEventListener(ev, () => sig.set(lk === "checked" ? el.checked : el.value));
}

const STYLE_KEY = /^(?:--[\w-]+|[a-zA-Z][a-zA-Z0-9-]*)$/;
function setStyle(el, v) {
  if (!v || typeof v !== "object") return void (el.style.cssText = v == null || v === false ? "" : String(v));
  el.style.cssText = "";
  for (const p of Object.keys(v)) {
    if (!STYLE_KEY.test(p) || p === "constructor" || p === "prototype") continue;
    if (p.includes("-")) el.style.setProperty(p, String(v[p]));
    else el.style[p] = v[p];
  }
}

function setUrl(el, k, v) {
  const u = v == null || v === false ? undefined : safeUrl(v);
  if (u) return el.setAttribute(k, u);
  el.removeAttribute(k);
  if (u === null) blocked(`unsafe URL blocked in "${k}": ${JSON.stringify(String(v).slice(0, 80))}`);
}

function setProp(el, k, lk, v) {
  const svg = el.namespaceURI === SVG_NS;
  if (lk === "class" || lk === "classname") {
    const text = classText(v);
    svg ? attr(el, "class", text || null) : (el.className = text);
  } else if (lk === "style") setStyle(el, v);
  else if (URL_ATTRS.has(lk)) setUrl(el, k, v);
  else if (lk === "attributename") {
    // <animate attributeName="href"> là vector XSS cổ điển trong SVG
    const a = String(v).toLowerCase();
    if (URL_ATTRS.has(a) || a.startsWith("on")) blocked(`attributeName "${v}" is blocked`);
    else attr(el, k, v);
  } else if (!svg && FORM_PROPS.has(lk)) {
    const val = lk === "value" ? (v == null ? "" : String(v)) : !!v;
    if (el[lk] !== val) el[lk] = val;
  } else if (lk.startsWith("aria-") || lk.startsWith("data-")) {
    v == null ? el.removeAttribute(k) : el.setAttribute(k, String(v));
  } else attr(el, k, v);
  if (lk === "target" || lk === "rel") fixRel(el); // chống tabnabbing
}

function applyProp(el, k, v) {
  if (!ATTR_RE.test(k)) return blocked(`invalid attribute name "${k}" ignored`);
  const lk = k.toLowerCase();
  if (lk === "key" || lk === "children") return; // không phải thuộc tính DOM (children do h() truyền riêng)
  if (lk === "htmlfor") return applyProp(el, "for", v);
  if (lk === "ref") {
    if (typeof v === "function") v(el);
    return;
  }
  if (lk.startsWith("on")) {
    // Chỉ nhận hàm. Chuỗi như onclick="alert(1)" bị chặn hoàn toàn.
    if (typeof v !== "function") return blocked(`event handler "${k}" must be a function (strings are blocked)`);
    el.addEventListener(lk.slice(2), v);
    return;
  }
  if (BLOCKED_PROPS.has(lk) || lk.startsWith("__")) return blocked(`property "${k}" is blocked for security reasons`);
  if (typeof v === "function") effect(() => setProp(el, k, lk, v()));
  else if ((lk === "class" || lk === "classname") && v !== null && typeof v === "object")
    effect(() => setProp(el, k, lk, v)); // object/mảng chứa hàm: tự cập nhật
  else setProp(el, k, lk, v);
}

function build(ns, tag, props, kids) {
  const name = checkTag(tag);
  const el = ns ? document.createElementNS(ns, tag) : document.createElement(tag);
  const late = [];
  if (props) {
    for (const k of Object.keys(props)) {
      const lk = k.toLowerCase();
      if ((lk === "value" || lk === "checked") && isModel(props[k])) bindModel(el, name, lk, props[k]);
    }
    for (const k of Object.keys(props)) {
      if (k.toLowerCase() === "value") late.push(k); // value áp dụng sau khi có <option> con
      else applyProp(el, k, props[k]);
    }
  }
  if (name === "iframe" && !el.hasAttribute("sandbox")) el.setAttribute("sandbox", ""); // khóa tối đa theo mặc định
  for (const c of kids) insert(el, c);
  for (const k of late) applyProp(el, k, props[k]);
  return el;
}

/** Tạo phần tử. Prop là hàm => tự cập nhật. onXxx => sự kiện. Tag là hàm => component. */
// Mỗi component có phạm vi sở hữu riêng: onMounted/onUnmounted/effect bên trong gắn với đúng component này.
// Thân component chỉ chạy một lần và không đăng ký phụ thuộc vào effect cha.
function runComponent(fn, props, kids) {
  const scope = makeOwner();
  scope.isComp = true;
  if (owner) owner.kids.push(scope);
  const po = owner;
  const pt = tracking;
  owner = scope;
  tracking = null;
  try {
    return fn({ ...props, children: kids });
  } catch (err) {
    dispose(scope);
    throw err;
  } finally {
    owner = po;
    tracking = pt;
  }
}

/** Gom nhiều con không cần phần tử bọc: h(Fragment, null, a, b) hoặc <>…</> */
export const Fragment = (props) => props.children;

export function h(tag, props, ...kids) {
  if (typeof tag === "function") return runComponent(tag, props, kids);
  return build(null, tag, props, kids);
}

const isProps = (p) => p && typeof p === "object" && !Array.isArray(p) && !(p instanceof Node);
const makeTags = (ns) => {
  const cache = new Map();
  return new Proxy(
    {},
    {
      get(_, tag) {
        if (typeof tag !== "string" || tag === "then") return undefined;
        let f = cache.get(tag);
        if (!f) {
          checkTag(tag);
          f = (p, ...kids) => (isProps(p) ? build(ns, tag, p, kids) : build(ns, tag, null, [p, ...kids]));
          cache.set(tag, f);
        }
        return f;
      },
    }
  );
};

/** Cú pháp ngắn: const { div, button } = tags;  div({class:"a"}, "xin chào") */
export const tags = makeTags(null);
/** Giống tags nhưng cho SVG: const { svg, circle } = svgTags; */
export const svgTags = makeTags(SVG_NS);

const mounts = new Set();
const hotCleanups = new Set();

/** Dùng nội bộ (router...): đăng ký việc dọn dẹp sẽ chạy khi gọi unmountAll(). */
export function onHotDispose(fn) {
  if (typeof fn === "function") hotCleanups.add(fn);
}

/**
 * Gỡ mọi ứng dụng đã mount và chạy các dọn dẹp đã đăng ký (ví dụ lắng nghe popstate của router).
 * Vite plugin tự gọi hàm này khi thay module nóng (HMR); cũng hữu ích để dọn sạch trong test.
 */
export function unmountAll() {
  [...mounts].forEach((off) => safe(off));
  mounts.clear();
  [...hotCleanups].forEach((f) => safe(f));
  hotCleanups.clear();
}

/** Gắn ứng dụng vào DOM. Trả về hàm gỡ (dọn sạch effect và nội dung). */
export function mount(root, view) {
  const el = typeof root === "string" ? document.querySelector(root) : root;
  if (!el) throw new Error("Fluxa: mount target not found");
  el.textContent = "";
  const stop = createRoot(() => insert(el, typeof view === "function" ? view() : view));
  let done = false;
  const off = () => {
    if (done) return; // gọi lại không xóa nhầm ứng dụng khác mount sau đó vào cùng phần tử
    done = true;
    mounts.delete(off);
    stop();
    el.textContent = "";
  };
  mounts.add(off);
  return off;
}
