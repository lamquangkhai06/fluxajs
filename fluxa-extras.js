// fluxa-extras.js — Fluxa 0.10.0: persist, form + rules, i18n, theme, debounced, media, online, history. MIT License.
// Tách khỏi lõi để lõi giữ nhỏ; bản đóng gói một file (dist/) đã gồm sẵn module này.
import { signal, computed, effect, onCleanup } from "./fluxa.js";

const FORBIDDEN = new Set(["__proto__", "constructor", "prototype"]);
const MAX_JSON = 1_000_000; // số ký tự tối đa đọc lại từ bộ nhớ
const isSignal = (v) => typeof v === "function" && typeof v.set === "function";
const isEmpty = (v) => v == null || v === "" || (Array.isArray(v) && v.length === 0);

// ───────────────────────── persist ─────────────────────────

const defaultStorage = () => {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null; // trình duyệt chặn localStorage (chế độ riêng tư, iframe...)
  }
};

// JSON.parse nhưng bỏ các khóa nguy hiểm: dữ liệu trong localStorage không phải lúc nào cũng đáng tin
const safeParse = (raw) => JSON.parse(raw, (k, v) => (FORBIDDEN.has(k) ? undefined : v));

/**
 * Tự lưu một signal vào localStorage và đọc lại khi tải trang:
 *   const todos = persist(signal([]), "todos");
 * Tùy chọn: { storage } đổi nơi lưu, { revive(dữLiệuĐọcĐược) } biến dữ liệu thành dạng cần dùng,
 * { save(giáTrị) } biến giá trị thành dữ liệu thuần trước khi lưu.
 * Không có localStorage hoặc dữ liệu hỏng thì cứ dùng giá trị ban đầu, không báo lỗi.
 */
export function persist(s, key, { storage, revive, save } = {}) {
  if (!isSignal(s)) throw new TypeError("Fluxa: persist() needs a signal, e.g. persist(signal([]), \"key\")");
  if (typeof key !== "string" || !key || key.length > 200) throw new TypeError("Fluxa: persist() needs a non-empty string key");
  const st = storage === undefined ? defaultStorage() : storage;
  if (!st) return s;
  try {
    const raw = st.getItem(key);
    if (typeof raw === "string" && raw.length <= MAX_JSON) {
      const v = safeParse(raw);
      s.set(revive ? revive(v) : v);
    }
  } catch {
    /* dữ liệu hỏng hoặc revive lỗi: giữ giá trị mặc định */
  }
  effect(() => {
    const v = s();
    try {
      const data = save ? save(v) : v;
      if (data === undefined) st.removeItem(key);
      else st.setItem(key, JSON.stringify(data));
    } catch {
      /* hết dung lượng hoặc bị chặn: bỏ qua, ứng dụng vẫn chạy */
    }
  });
  return s;
}

// ───────────────────────── form ─────────────────────────

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REGEX_MAX = 1000; // giới hạn độ dài đầu vào để giảm rủi ro treo; KHÔNG cứu được regex viết tệ (tránh lồng lặp như (a+)+)

/** Luật kiểm tra dựng sẵn. Mỗi luật là hàm (giáTrị, tấtCảGiáTrị) => "thông báo lỗi" hoặc "" nếu hợp lệ. */
export const rules = {
  required: (msg = "Bắt buộc nhập") => (v) => (isEmpty(v) || v === false ? msg : ""),
  minLength: (n, msg) => (v) => (isEmpty(v) || String(v).length >= n ? "" : msg || `Tối thiểu ${n} ký tự`),
  maxLength: (n, msg) => (v) => (isEmpty(v) || String(v).length <= n ? "" : msg || `Tối đa ${n} ký tự`),
  pattern: (re, msg = "Không đúng định dạng") => (v) => {
    if (isEmpty(v)) return "";
    const s = String(v);
    return s.length <= REGEX_MAX && re.test(s) ? "" : msg;
  },
  email: (msg = "Email không hợp lệ") => (v) => {
    if (isEmpty(v)) return "";
    const s = String(v);
    return s.length <= 254 && EMAIL.test(s) ? "" : msg;
  },
  number: (msg = "Phải là số") => (v) => (isEmpty(v) || (v !== true && v !== false && Number.isFinite(Number(v))) ? "" : msg),
  min: (n, msg) => (v) => (isEmpty(v) || Number(v) >= n ? "" : msg || `Phải từ ${n} trở lên`),
  max: (n, msg) => (v) => (isEmpty(v) || Number(v) <= n ? "" : msg || `Phải từ ${n} trở xuống`),
  matches: (otherField, msg = "Không khớp") => (v, all) => (v === all[otherField] ? "" : msg),
};

const RESERVED = new Set(["values", "valid", "errors", "dirty", "submit", "reset", "submitting", "submitted"]);

/**
 * Form khai báo: mỗi trường là [giáTrịBanĐầu, ...luật].
 *   const f = form({
 *     email: ["", rules.required(), rules.email()],
 *     tuoi:  [18, rules.min(18, "Phải đủ 18 tuổi")],
 *   });
 *   input({ value: f.email.value });  p(f.email.error);
 *   tags.form({ onsubmit: f.submit((data) => luuLai(data)) }, ...);
 * Lỗi chỉ hiện sau khi người dùng đã sửa trường đó hoặc đã bấm gửi (không hiện đỏ lòm ngay từ đầu).
 */
export function form(spec, { onSubmit } = {}) {
  if (spec === null || typeof spec !== "object" || Array.isArray(spec)) throw new TypeError("Fluxa: form() needs an object of fields");
  const names = Object.keys(spec);
  for (const n of names) {
    if (FORBIDDEN.has(n) || RESERVED.has(n)) throw new TypeError(`Fluxa: form field name "${n}" is not allowed`);
  }
  const submitted = signal(false);
  const submitting = signal(false);
  const fields = {};
  const current = () => {
    const o = {};
    for (const n of names) o[n] = fields[n].value();
    return o;
  };
  const values = computed(current);

  for (const n of names) {
    const def = spec[n];
    const [initial, ...checks] = Array.isArray(def) ? def : [def];
    if (!checks.every((c) => typeof c === "function")) throw new TypeError(`Fluxa: rules of form field "${n}" must be functions`);
    const value = signal(initial);
    const problem = computed(() => {
      const all = values();
      for (const c of checks) {
        const msg = c(value(), all);
        if (msg) return String(msg);
      }
      return "";
    });
    const dirty = computed(() => value() !== initial);
    fields[n] = {
      value,
      dirty,
      valid: () => !problem(),
      error: () => (dirty() || submitted() ? problem() : ""),
      reset: () => value.set(initial),
    };
  }

  const valid = computed(() => names.every((n) => fields[n].valid()));
  const f = {
    values,
    valid,
    submitting,
    submitted,
    dirty: computed(() => names.some((n) => fields[n].dirty())),
    errors: computed(() => {
      const o = {};
      for (const n of names) {
        const e = fields[n].error();
        if (e) o[n] = e;
      }
      return o;
    }),
    reset() {
      for (const n of names) fields[n].reset();
      submitted.set(false);
    },
    submit(handler = onSubmit) {
      return async (e) => {
        if (e && typeof e.preventDefault === "function") e.preventDefault();
        submitted.set(true);
        if (!valid() || submitting.peek()) return;
        submitting.set(true);
        try {
          if (handler) await handler(values());
        } finally {
          submitting.set(false);
        }
      };
    },
  };
  for (const n of names) f[n] = fields[n];
  return f;
}

// ───────────────────────── i18n ─────────────────────────

const LANG = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
const has = (o, k) => o !== null && typeof o === "object" && Object.prototype.hasOwnProperty.call(o, k);

function lookup(table, path) {
  let cur = table;
  for (const part of String(path).split(".")) {
    if (!has(cur, part)) return undefined;
    cur = cur[part];
  }
  return cur;
}

/**
 * Đa ngôn ngữ, đổi ngôn ngữ không cần tải lại trang:
 *   const i18n = createI18n({ vi: { chao: "Xin chào, {ten}!" }, en: { chao: "Hello, {ten}!" } }, { locale: "vi" });
 *   p(i18n.text("chao", { ten: "Lan" }));    // tự cập nhật khi đổi ngôn ngữ
 *   button({ onclick: () => i18n.setLocale("en") }, "English");
 * Khóa có thể lồng nhau ("menu.home"). Số nhiều: { one: "{count} item", other: "{count} items" } với params.count.
 */
export function createI18n(messages, { locale, fallback, persistKey, storage } = {}) {
  if (messages === null || typeof messages !== "object") throw new TypeError("Fluxa: createI18n() needs an object of messages");
  const langs = Object.keys(messages);
  if (!langs.length) throw new TypeError("Fluxa: createI18n() needs at least one language");
  for (const l of langs) if (!LANG.test(l)) throw new TypeError(`Fluxa: invalid language code "${l}"`);
  const first = has(messages, locale) ? locale : has(messages, fallback) ? fallback : langs[0];
  const current = signal(first);
  if (persistKey) persist(current, persistKey, { storage, revive: (v) => (typeof v === "string" && has(messages, v) ? v : first) });

  effect(() => {
    const el = globalThis.document && globalThis.document.documentElement;
    if (el && typeof el.setAttribute === "function") el.setAttribute("lang", current());
  });

  const pick = (l, key, params) => {
    let m = lookup(messages[l], key);
    if (m !== null && typeof m === "object") {
      const count = params && params.count;
      if (typeof count !== "number") return undefined;
      m = m[new Intl.PluralRules(l).select(count)] ?? m.other;
    }
    return typeof m === "string" ? m : undefined;
  };
  const t = (key, params) => {
    const l = current(); // đọc signal: dùng trong hàm () => ... sẽ tự cập nhật khi đổi ngôn ngữ
    let m = pick(l, key, params);
    if (m === undefined && fallback && fallback !== l && has(messages, fallback)) m = pick(fallback, key, params);
    if (m === undefined) return String(key);
    return m.replace(/\{(\w+)\}/g, (all, name) => (params && has(params, name) ? String(params[name]) : all));
  };
  return {
    locale: current,
    locales: langs,
    setLocale(l) {
      if (!has(messages, l)) throw new TypeError(`Fluxa: unknown language "${l}"`);
      current.set(l);
    },
    t,
    /** Trả về hàm phản ứng: p(i18n.text("chao")) khỏi phải viết () => t("chao"). */
    text: (key, params) => () => t(key, params),
    n: (num, opts) => new Intl.NumberFormat(current(), opts).format(num),
    date: (d, opts) => new Intl.DateTimeFormat(current(), opts).format(d instanceof Date ? d : new Date(d)),
  };
}

// ───────────────────────── theme ─────────────────────────

const MODES = ["light", "dark", "auto"];

/**
 * Chế độ sáng/tối/tự động (theo hệ điều hành), nhớ lựa chọn, đặt data-theme lên <html>:
 *   const theme = createTheme();
 *   button({ onclick: theme.toggle }, () => (theme.resolved() === "dark" ? "☀" : "🌙"));
 * fluxa.css đã có sẵn biến màu cho cả hai chế độ.
 */
export function createTheme({ key = "fluxa-theme", initial = "auto", storage, media } = {}) {
  const mode = signal(MODES.includes(initial) ? initial : "auto");
  persist(mode, key, { storage, revive: (v) => (MODES.includes(v) ? v : "auto") });
  let mq = media;
  if (mq === undefined) {
    try {
      mq = typeof globalThis.matchMedia === "function" ? globalThis.matchMedia("(prefers-color-scheme: dark)") : null;
    } catch {
      mq = null;
    }
  }
  const system = signal(!!(mq && mq.matches));
  if (mq && typeof mq.addEventListener === "function") mq.addEventListener("change", (e) => system.set(!!e.matches));
  const resolved = computed(() => (mode() === "auto" ? (system() ? "dark" : "light") : mode()));
  effect(() => {
    const el = globalThis.document && globalThis.document.documentElement;
    if (el && typeof el.setAttribute === "function") el.setAttribute("data-theme", resolved()); // chỉ "light" hoặc "dark"
  });
  return {
    mode,
    resolved,
    setMode(m) {
      if (!MODES.includes(m)) throw new TypeError(`Fluxa: theme mode must be one of ${MODES.join(", ")}`);
      mode.set(m);
    },
    toggle: () => mode.set(resolved() === "dark" ? "light" : "dark"),
  };
}

// ───────────────────────── tín hiệu từ trình duyệt & lịch sử ─────────────────────────

/**
 * Bản "chậm" của một signal: chỉ đổi sau khi nguồn đứng yên `ms` mili giây.
 *   const q = signal(""); const qChamp = debounced(q, 300);
 *   resource(() => timKiem(qChamp()))   // không gọi máy chủ sau mỗi phím gõ
 */
export function debounced(source, ms = 300) {
  const out = signal(source.peek ? source.peek() : source());
  const wait = Math.min(60_000, Math.max(0, Number(ms) || 0));
  effect(() => {
    const v = source();
    const id = setTimeout(() => out.set(v), wait);
    onCleanup(() => clearTimeout(id));
  });
  return computed(() => out());
}

/**
 * Signal true/false theo media query: media("(max-width: 600px)") để biết đang ở điện thoại.
 * Không có matchMedia (Node, trình duyệt cũ) thì luôn false.
 */
export function media(query, { matchMedia = globalThis.matchMedia && globalThis.matchMedia.bind(globalThis) } = {}) {
  const q = String(query);
  const mql = typeof matchMedia === "function" ? matchMedia(q) : null;
  const s = signal(!!(mql && mql.matches));
  if (mql && typeof mql.addEventListener === "function") {
    const on = (e) => s.set(!!e.matches);
    mql.addEventListener("change", on);
    onCleanup(() => mql.removeEventListener("change", on));
  }
  return computed(() => s());
}

/** Signal true/false: máy đang có mạng không. Tự cập nhật khi mạng mất/có lại. */
export function online({ target = globalThis } = {}) {
  const nav = globalThis.navigator;
  const s = signal(nav && typeof nav.onLine === "boolean" ? nav.onLine : true);
  if (target && typeof target.addEventListener === "function") {
    const up = () => s.set(true), down = () => s.set(false);
    target.addEventListener("online", up);
    target.addEventListener("offline", down);
    onCleanup(() => { target.removeEventListener("online", up); target.removeEventListener("offline", down); });
  }
  return computed(() => s());
}

/**
 * Hoàn tác / làm lại cho một signal:
 *   const text = signal(""); const hist = history(text);
 *   hist.undo(); hist.redo(); hist.canUndo(); hist.canRedo();
 * Chỉ nhớ giá trị MỚI mỗi khi signal đổi (so sánh bằng ===), tối đa `limit` bước (mặc định 100).
 * Với mảng/đối tượng hãy luôn tạo bản mới (todos.set(a => [...a, x])) như bình thường.
 */
export function history(source, { limit = 100 } = {}) {
  const max = Math.min(1000, Math.max(1, Math.floor(Number(limit)) || 100));
  const past = signal([]), future = signal([]);
  let current = source.peek ? source.peek() : source();
  let applying = false;
  effect(() => {
    const v = source();
    if (applying || v === current) return;
    const prev = current;
    current = v;
    past.set((p) => [...p.slice(-(max - 1)), prev]);
    future.set([]);
  });
  const move = (from, to) => {
    const f = from.peek();
    if (!f.length) return;
    const target = f[f.length - 1];
    from.set(f.slice(0, -1));
    to.set((t) => [...t, current]);
    applying = true;
    current = target;
    source.set(target);
    applying = false;
  };
  return {
    undo: () => move(past, future),
    redo: () => move(future, past),
    canUndo: computed(() => past().length > 0),
    canRedo: computed(() => future().length > 0),
    clear: () => { past.set([]); future.set([]); },
  };
}
