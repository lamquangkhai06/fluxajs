/*! Fluxa Router 0.10.0 — router nhỏ, an toàn (chặn open redirect, giới hạn đầu vào). MIT License. */
import { signal, computed, untrack, h, onHotDispose } from "./fluxa.js";

const MAX_PATH = 2048;
const MAX_SEGMENTS = 50;
const MAX_REDIRECTS = 10;
const MAX_QUERY_KEYS = 100;
const CTRL = /[\u0000-\u001f\u007f]/;
const PARAM_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Phân tích query string thành object không có prototype (chống prototype pollution). */
export function parseQuery(search) {
  const out = Object.create(null);
  let n = 0;
  for (const [k, v] of new URLSearchParams(String(search || ""))) {
    if (!(k in out)) {
      if (++n > MAX_QUERY_KEYS) break;
      out[k] = v;
    } else out[k] = [].concat(out[k], v);
  }
  return out;
}

const decode = (s) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s; // mã hóa % hỏng: giữ nguyên chuỗi gốc (vẫn chỉ là chuỗi)
  }
};

/** Biên dịch bảng route; route cụ thể hơn được ưu tiên trước. */
export function compileRoutes(routes) {
  const table = Object.keys(routes).map((pattern) => {
    const handler = routes[pattern];
    if (typeof handler !== "function")
      throw new TypeError(`Fluxa router: handler for "${pattern}" must be a function`);
    const segs = pattern.split("/").filter(Boolean);
    segs.forEach((s, i) => {
      if (s === "*" && i !== segs.length - 1) throw new Error(`Fluxa router: "*" must be last in "${pattern}"`);
      if (s[0] === ":" && !PARAM_RE.test(s.slice(1))) throw new Error(`Fluxa router: bad param name in "${pattern}"`);
    });
    return { pattern, handler, segs };
  });
  const rank = (r) => [r.segs.includes("*") ? 1 : 0, r.segs.filter((s) => s[0] === ":").length, -r.segs.length];
  return table.sort((x, y) => {
    const a = rank(x);
    const b = rank(y);
    for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i];
    return 0;
  });
}

// Khớp các đoạn của route với đường dẫn: ":id" lấy một đoạn, "*" nuốt phần còn lại. Trả về params hoặc null.
function matchSegments(segs, parts) {
  const params = Object.create(null);
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    if (s === "*") return ((params["*"] = parts.slice(i).join("/")), params);
    if (i >= parts.length || (s[0] !== ":" && s !== parts[i])) return null;
    if (s[0] === ":") params[s.slice(1)] = parts[i];
  }
  return segs.length === parts.length ? params : null;
}

/** Tìm route khớp. Trả về { handler, params, pattern } hoặc null. */
export function matchRoute(table, path) {
  if (typeof path !== "string" || path.length > MAX_PATH) return null;
  const parts = path.split("/").filter(Boolean);
  if (parts.length > MAX_SEGMENTS) return null;
  const decoded = parts.map(decode);
  for (const r of table) {
    const params = matchSegments(r.segs, decoded);
    if (params) return { handler: r.handler, params, pattern: r.pattern };
  }
  return null;
}

/**
 * Phân giải `to` và chỉ trả về "đường dẫn + query + hash" nếu cùng origin với trang.
 * Chặn open redirect: https://evil.com, //evil.com, /\evil.com, javascript:... đều trả null.
 */
export function sameOriginPath(to, loc = globalThis.location) {
  if (typeof to !== "string" || CTRL.test(to)) return null;
  let u;
  try {
    u = new URL(to, loc.href);
  } catch {
    return null;
  }
  return u.origin === loc.origin ? u.pathname + u.search + u.hash : null;
}

const isAppPath = (to) => typeof to === "string" && /^\/(?![/\\])/.test(to) && !CTRL.test(to);

const normalizeBase = (b) => {
  if (!b || b === "/") return "";
  if (!/^\/[\w\-./~%]*$/.test(b) || b.includes("//") || b.includes(".."))
    throw new Error(`Fluxa router: invalid base "${b}"`);
  return b.replace(/\/+$/, "");
};

/**
 * Tạo router.
 *   routes: { "/": Home, "/user/:id": User, "*": NotFound }  (handler nhận { params, query, hash, path })
 *   options.mode: "history" (mặc định) | "hash" (không cần cấu hình server)
 *   options.base: tiền tố khi triển khai ở thư mục con, ví dụ "/app"
 *   options.beforeEach(dest): trả về true | false | "/đường-dẫn-khác"  (chỉ là UX, KHÔNG phải bảo mật)
 */
export function createRouter(routes, options = {}) {
  const hashMode = options.mode === "hash";
  const base = hashMode ? "" : normalizeBase(options.base);
  const guard = typeof options.beforeEach === "function" ? options.beforeEach : null;
  const table = compileRoutes(routes);

  const stripBase = (pathname) => {
    if (!base) return pathname;
    if (pathname === base) return "/";
    return pathname.startsWith(base + "/") ? pathname.slice(base.length) : null;
  };
  const readLocation = () => {
    if (hashMode) {
      const raw = location.hash.slice(1) || "/";
      const i = raw.indexOf("?");
      const p = i < 0 ? raw : raw.slice(0, i);
      return { path: p.startsWith("/") ? p : "/", search: i < 0 ? "" : raw.slice(i), hash: "" };
    }
    return { path: stripBase(location.pathname), search: location.search, hash: location.hash };
  };
  const parseDest = (to) => {
    const u = new URL(to, "https://fluxa.invalid");
    return { path: u.pathname, query: parseQuery(u.search), hash: u.hash };
  };

  const writeUrl = (to, replace) => {
    const full = hashMode ? "#" + to : sameOriginPath(base + to, location);
    if (full) history[replace ? "replaceState" : "pushState"](null, "", full);
    return !!full;
  };

  // Guard có yêu cầu chuyển hướng không? Trả về đường dẫn đích hoặc null (guard chỉ hỗ trợ chuyển hướng ở đây)
  const redirectOf = () => {
    const l = readLocation();
    if (!guard || l.path === null) return null;
    const r = guard({ path: l.path, query: parseQuery(l.search), hash: l.hash });
    return typeof r === "string" && isAppPath(r) ? r : null;
  };

  // Áp dụng guard cho địa chỉ ban đầu (có giới hạn số lần chuyển hướng)
  for (let i = 0, r; i < MAX_REDIRECTS && (r = redirectOf()); i++) writeUrl(r, true);

  const first = readLocation();
  const path = signal(first.path);
  const search = signal(first.search);
  const hash = signal(first.hash);
  const query = computed(() => parseQuery(search()));
  const match = computed(() => matchRoute(table, path()));

  const sync = () => {
    const l = readLocation();
    path.set(l.path);
    search.set(l.search);
    hash.set(l.hash);
  };

  function navigate(to, opts = {}, depth = 0) {
    const block = () => (console.warn("Fluxa router: blocked navigation to", String(to).slice(0, 80)), false);
    if (!isAppPath(to)) return block();
    if (guard) {
      const r = guard(parseDest(to));
      if (r === false) return false;
      if (typeof r === "string") return depth < MAX_REDIRECTS ? navigate(r, { replace: true }, depth + 1) : false;
    }
    if (!writeUrl(to, !!opts.replace)) return block();
    sync();
    if (!hashMode && !location.hash && typeof window.scrollTo === "function") window.scrollTo(0, 0);
    return true;
  }

  const onPop = () => {
    const r = redirectOf();
    if (r) writeUrl(r, true);
    sync();
  };
  window.addEventListener("popstate", onPop);
  onHotDispose(() => window.removeEventListener("popstate", onPop)); // HMR: không để lại listener của router cũ

  /** Dùng làm con của một phần tử: div(router.view). Đổi trang chỉ dựng lại phần này. */
  const view = () => {
    const m = match();
    if (!m) return null;
    return untrack(() => m.handler({ params: m.params, query, hash: () => hash(), path: () => path() }));
  };

  /** Thẻ <a> điều hướng nội bộ không tải lại trang; link ngoài vẫn đi qua bộ lọc URL an toàn. */
  function link(props, ...kids) {
    const p = { ...props };
    const to = p.href;
    if (typeof to === "string" && isAppPath(to)) {
      p.href = hashMode ? "#" + to : base + to;
      const user = p.onclick;
      p.onclick = (e) => {
        if (typeof user === "function") user(e);
        if (hashMode || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        const a = e.currentTarget;
        const t = a.getAttribute("target");
        if ((t && t !== "_self") || a.hasAttribute("download")) return;
        const url = sameOriginPath(a.getAttribute("href"), location);
        if (!url) return;
        const u = new URL(url, location.href);
        const inner = stripBase(u.pathname);
        if (inner === null) return;
        e.preventDefault();
        navigate(inner + u.search + u.hash);
      };
    }
    return h("a", p, ...kids);
  }

  return {
    view,
    link,
    navigate,
    path: () => path(),
    query,
    hash: () => hash(),
    params: () => {
      const m = match();
      return m ? m.params : null;
    },
    destroy: () => window.removeEventListener("popstate", onPop),
  };
}
