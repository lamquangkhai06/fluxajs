/*! Fluxa UI components 0.10.0 — bộ component dựng sẵn, truy cập được (a11y), an toàn theo mặc định. MIT License. */
import { h, signal, computed, effect, onCleanup, list, safeUrl } from "./fluxa.js";

// ───────────── Tiện ích ─────────────
const read = (v) => (typeof v === "function" ? v() : v);
const isSignal = (v) => typeof v === "function" && typeof v.set === "function";
let uidCount = 0;
/** Tạo id duy nhất cho liên kết label/aria. */
export const uid = (prefix = "fluxa") => `${prefix}-${++uidCount}`;

/** Ghép tên class; nếu có phần là hàm thì kết quả là hàm (tự cập nhật). */
export const cx = (...parts) =>
  parts.some((p) => typeof p === "function")
    ? () => parts.map((p) => (typeof p === "function" ? p() : p)).filter(Boolean).join(" ")
    : parts.filter(Boolean).join(" ");

// Giá trị như variant/tone/type chỉ nhận từ danh sách cho phép: không cho chèn tên class hay giá trị tùy ý
const pick = (v, allowed, dflt) => (typeof v === "string" && allowed.has(v) ? v : dflt);
const VARIANTS = new Set(["primary", "ghost", "danger"]);
const SIZES = new Set(["sm", "md", "lg"]);
const BUTTON_TYPES = new Set(["button", "submit", "reset"]);
const TONES = new Set(["info", "success", "warning", "danger"]);
const BADGE_TONES = new Set(["neutral", "info", "success", "warning", "danger"]);
const INPUT_TYPES = new Set([
  "text", "email", "password", "number", "search", "tel", "url", "date", "time", "datetime-local", "month", "week",
]);
const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';


// ───────────── Hiển thị ─────────────

/** Vòng xoay tải. small=true: nằm trong nút, ẩn với trình đọc màn hình. */
export function Spinner({ label = "Đang tải", small = false } = {}) {
  return small
    ? h("span", { class: "spinner sm", "aria-hidden": "true" })
    : h("span", { class: "spinner", role: "status", "aria-label": label });
}

/** Nút. variant: primary | ghost | danger. size: sm | md | lg. loading/disabled nhận boolean, signal hoặc hàm. */
export function Button(props) {
  const { variant = "primary", size = "md", loading = false, disabled = false, type = "button", class: klass, children = [], ...rest } = props;
  const v = pick(variant, VARIANTS, "primary");
  const s = pick(size, SIZES, "md");
  return h(
    "button",
    {
      ...rest,
      type: pick(type, BUTTON_TYPES, "button"), // mặc định "button": không vô tình gửi form
      class: cx("btn", v !== "primary" && v, s !== "md" && s, klass),
      disabled: () => !!(read(disabled) || read(loading)),
      "aria-busy": () => (read(loading) ? "true" : null),
    },
    () => (read(loading) ? Spinner({ small: true }) : null),
    ...children
  );
}

export function Card({ title, children = [], class: klass, ...rest } = {}) {
  return h("section", { ...rest, class: cx("card", klass) }, title != null ? h("h2", null, title) : null, ...children);
}

export function Badge({ tone = "neutral", children = [], class: klass, ...rest } = {}) {
  const t = pick(tone, BADGE_TONES, "neutral");
  return h("span", { ...rest, class: cx("badge", t !== "neutral" && `badge-${t}`, klass) }, ...children);
}

/** Hộp thông báo. tone: info | success | warning | danger. Có onClose thì hiện nút đóng. */
export function Alert({ tone = "info", title, onClose, children = [], class: klass, ...rest } = {}) {
  const t = pick(tone, TONES, "info");
  return h(
    "div",
    { ...rest, class: cx("alert", `alert-${t}`, klass), role: t === "danger" || t === "warning" ? "alert" : "status" },
    h("div", { class: "alert-body" }, title != null ? h("strong", null, title) : null, ...children),
    typeof onClose === "function"
      ? h("button", { type: "button", class: "alert-close", "aria-label": "Đóng", onclick: onClose }, "×")
      : null
  );
}

// ───────────── Biểu mẫu ─────────────

function field(fid, { label, hint, error }, control) {
  return h(
    "div",
    { class: "field" },
    label != null ? h("label", { class: "label", for: fid }, label) : null,
    control,
    () => {
      const e = read(error);
      if (e) return h("p", { class: "error", id: fid + "-err", role: "alert" }, e);
      const t = read(hint);
      return t ? h("p", { class: "hint", id: fid + "-hint" }, t) : null;
    }
  );
}
const describedBy = (fid, error, hint) => () => (read(error) ? fid + "-err" : read(hint) ? fid + "-hint" : null);

/**
 * Ô nhập có nhãn, gợi ý và thông báo lỗi.
 * value là signal => ràng buộc hai chiều tự động. error/hint nhận chuỗi, hàm hoặc signal.
 */
export function Input(props) {
  const { value, label, hint, error, id = uid("input"), type = "text", class: klass, ...rest } = props;
  const fid = String(id);
  const attrs = {
    ...rest,
    id: fid,
    type: pick(type, INPUT_TYPES, "text"),
    class: cx("input", klass),
    "aria-invalid": () => (read(error) ? "true" : null),
    "aria-describedby": describedBy(fid, error, hint),
  };
  if (value !== undefined) attrs.value = value; // value là signal/model() => lõi tự ràng buộc hai chiều
  return field(fid, { label, hint, error }, h("input", attrs));
}

/** Hộp chọn. options: mảng chuỗi hoặc {value, label, disabled}, hoặc hàm trả về mảng. value là signal => hai chiều. */
export function Select(props) {
  const { value, options = [], label, hint, error, id = uid("select"), class: klass, ...rest } = props;
  const fid = String(id);
  const toOption = (o) => {
    const obj = o !== null && typeof o === "object" ? o : { value: o };
    return h("option", { value: String(obj.value), disabled: !!obj.disabled }, String(obj.label ?? obj.value));
  };
  const attrs = {
    ...rest,
    id: fid,
    class: cx("input", klass),
    "aria-invalid": () => (read(error) ? "true" : null),
    "aria-describedby": describedBy(fid, error, hint),
  };
  if (value !== undefined) attrs.value = value;
  const kids = typeof options === "function" ? [() => options().map(toOption)] : options.map(toOption);
  return field(fid, { label, hint, error }, h("select", attrs, ...kids));
}

/** Ô tích. checked là signal => hai chiều. */
export function Checkbox(props) {
  const { checked = false, label, id = uid("check"), class: klass, ...rest } = props;
  const fid = String(id);
  const input = h("input", { ...rest, id: fid, type: "checkbox", checked });
  return h("label", { class: cx("check", klass), for: fid }, input, label != null ? h("span", null, label) : null);
}

// ───────────── Lớp phủ và điều hướng ─────────────

/**
 * Hộp thoại. open là signal<boolean>. Có role="dialog", aria-modal, đóng bằng Esc hoặc bấm nền,
 * giữ tiêu điểm trong hộp (Tab / Shift+Tab), khóa cuộn trang và trả tiêu điểm về chỗ cũ khi đóng.
 */
export function Modal(props) {
  const { open, title, onClose, dismissOnBackdrop = true, children = [], class: klass } = props;
  if (typeof open !== "function") throw new TypeError("Fluxa UI: Modal needs an `open` signal");
  const titleId = uid("modal-title");
  const close = () => {
    if (isSignal(open)) open.set(false);
    if (typeof onClose === "function") onClose();
  };
  // Giữ tiêu điểm trong hộp: Tab ở phần tử cuối quay về đầu, Shift+Tab ở đầu quay về cuối
  const trap = (e) => {
    const items = [...panel.querySelectorAll(FOCUSABLE)];
    const first = items[0] || panel, last = items[items.length - 1] || panel;
    const active = document.activeElement;
    const atEdge = e.shiftKey ? active === first || active === panel : active === last;
    if (!items.length || atEdge) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus();
    }
  };
  const panel = h(
    "div",
    {
      class: cx("modal", klass),
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": title != null ? titleId : null,
      tabindex: "-1",
      onkeydown: (e) => {
        if (e.key === "Tab") trap(e);
      },
    },
    title != null ? h("h2", { id: titleId, class: "modal-title" }, title) : null,
    h("div", { class: "modal-body" }, ...children),
    h("button", { type: "button", class: "modal-close", "aria-label": "Đóng", onclick: close }, "×")
  );
  const backdrop = h(
    "div",
    {
      class: "modal-backdrop",
      onclick: (e) => {
        if (dismissOnBackdrop && e.target === e.currentTarget) close();
      },
    },
    panel
  );
  effect(() => {
    if (!open()) return;
    const prev = document.activeElement;
    const body = document.body;
    const prevOverflow = body.style.overflow;
    body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    queueMicrotask(() => {
      try {
        panel.focus();
      } catch {
        /* không có gì để làm */
      }
    });
    return () => {
      document.removeEventListener("keydown", onKey);
      body.style.overflow = prevOverflow;
      if (prev && typeof prev.focus === "function") prev.focus();
    };
  });
  return () => (open() ? backdrop : null);
}

/**
 * Thẻ tab có bàn phím (←, →, Home, End). tabs: [{id, label, content}], content là node hoặc hàm trả về node
 * (hàm chỉ chạy khi tab được chọn). value là signal => điều khiển từ ngoài.
 */
export function Tabs(props) {
  const { tabs, value, class: klass } = props;
  if (!Array.isArray(tabs) || !tabs.length) throw new TypeError("Fluxa UI: Tabs needs a non-empty `tabs` array");
  const ids = tabs.map((t) => String(t.id));
  const active = isSignal(value) ? value : signal(ids[0]);
  if (!ids.includes(String(active.peek()))) active.set(ids[0]);
  const base = uid("tabs");
  const buttons = [];
  const isActive = (i) => String(active()) === ids[i];
  const onKey = (e, i) => {
    let n = null;
    if (e.key === "ArrowRight") n = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft") n = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = tabs.length - 1;
    if (n === null) return;
    e.preventDefault();
    active.set(ids[n]);
    buttons[n]?.focus?.();
  };
  const bar = h(
    "div",
    { class: "tabs", role: "tablist" },
    ...tabs.map((t, i) =>
      h(
        "button",
        {
          type: "button",
          role: "tab",
          id: `${base}-tab-${i}`,
          "aria-controls": `${base}-panel`,
          "aria-selected": () => String(isActive(i)),
          tabindex: () => (isActive(i) ? "0" : "-1"),
          class: () => (isActive(i) ? "tab active" : "tab"),
          ref: (el) => (buttons[i] = el),
          onclick: () => active.set(ids[i]),
          onkeydown: (e) => onKey(e, i),
        },
        t.label
      )
    )
  );
  const panel = h(
    "div",
    {
      class: "tabpanel",
      role: "tabpanel",
      id: `${base}-panel`,
      tabindex: "0",
      "aria-labelledby": () => `${base}-tab-${Math.max(0, ids.indexOf(String(active())))}`,
    },
    () => {
      const i = ids.indexOf(String(active()));
      const c = i < 0 ? null : tabs[i].content;
      return typeof c === "function" ? c() : c;
    }
  );
  return h("div", { class: cx("tabs-wrap", klass) }, bar, panel);
}

/**
 * Thông báo nổi. const toaster = createToaster(); đặt h(toaster.Toaster) một lần trong ứng dụng,
 * rồi gọi toaster.show("Đã lưu", { tone: "success" }). Nội dung luôn là chữ thuần.
 */
export function createToaster({ max = 5, timeout = 4000 } = {}) {
  const items = signal([]);
  const timers = new Map();
  let counter = 0;
  const forget = (id) => {
    clearTimeout(timers.get(id));
    timers.delete(id);
  };
  const dismiss = (id) => {
    forget(id);
    items.set((a) => a.filter((t) => t.id !== id));
  };
  const show = (message, opts = {}) => {
    const tone = pick(opts.tone, TONES, "info");
    const id = ++counter;
    const ms = Number.isFinite(opts.timeout) ? Math.max(0, opts.timeout) : timeout;
    items.set((a) => {
      const next = [...a, { id, message: String(message), tone }];
      while (next.length > max) forget(next.shift().id); // giới hạn số thông báo đồng thời
      return next;
    });
    if (ms > 0) timers.set(id, setTimeout(() => dismiss(id), ms));
    return id;
  };
  function Toaster() {
    onCleanup(() => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    });
    return h(
      "div",
      { class: "toasts", role: "region", "aria-live": "polite", "aria-label": "Thông báo" },
      list(items, (t) =>
        h(
          "div",
          { class: `toast toast-${t.tone}`, role: "status" },
          h("span", null, t.message),
          h("button", { type: "button", class: "toast-close", "aria-label": "Đóng", onclick: () => dismiss(t.id) }, "×")
        )
      )
    );
  }
  return { Toaster, show, dismiss };
}

// ───────────── Hiển thị dữ liệu ─────────────

const AVATAR_SIZES = new Set(["sm", "md", "lg"]);
const ALIGNS = new Set(["left", "center", "right"]);
const own = (o, k) => o !== null && typeof o === "object" && Object.prototype.hasOwnProperty.call(o, k);
const CSS_SIZE = /^\d+(\.\d+)?(px|%|rem|em)$/;
const cssSize = (v) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v + "px" : typeof v === "string" && CSS_SIZE.test(v) ? v : null);

/** Thanh tiến độ. value (0..max) là số, hàm hoặc signal. tone: info | success | warning | danger. */
export function Progress({ value = 0, max = 100, tone = "info", label = "Tiến độ", class: klass, ...rest } = {}) {
  const t = pick(tone, TONES, "info");
  const top = () => Number(read(max)) || 100;
  const now = () => {
    const v = Number(read(value));
    return Number.isFinite(v) ? Math.min(top(), Math.max(0, v)) : 0;
  };
  return h(
    "div",
    {
      ...rest,
      class: cx("progress", `progress-${t}`, klass),
      role: "progressbar",
      "aria-label": label,
      "aria-valuemin": "0",
      "aria-valuemax": () => String(top()),
      "aria-valuenow": () => String(Math.round(now())),
    },
    h("div", { class: "progress-bar", style: () => ({ width: (now() / top()) * 100 + "%" }) })
  );
}

/** Khung chờ khi đang tải dữ liệu. lines: số dòng (1..20). circle: hình tròn. width/height: số (px) hoặc "50%", "2rem". */
export function Skeleton({ lines = 3, circle = false, width, height, class: klass, ...rest } = {}) {
  const n = Math.min(20, Math.max(1, Math.floor(Number(lines)) || 1));
  const w = cssSize(width), hh = cssSize(height);
  const box = (extra, i) => {
    const st = {};
    if (w) st.width = w;
    if (hh) st.height = hh;
    if (!circle && !w && i === n - 1 && n > 1) st.width = "60%";
    return h("span", { class: cx("skeleton-line", extra), style: st });
  };
  return h(
    "div",
    { ...rest, class: cx("skeleton", klass), role: "status", "aria-label": "Đang tải" },
    circle ? box("circle", 0) : Array.from({ length: n }, (_, i) => box(null, i))
  );
}

/** Ảnh đại diện. Có src hợp lệ (http/https) thì hiện ảnh, lỗi hoặc không có thì hiện chữ cái đầu của name. */
export function Avatar({ name = "", src, size = "md", alt, class: klass, ...rest } = {}) {
  const sz = pick(size, AVATAR_SIZES, "md");
  const text = String(name).trim();
  const initials = text
    ? text.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => [...w][0].toUpperCase()).join("")
    : "?";
  let hash = 0;
  for (const ch of text) hash = (hash * 31 + ch.codePointAt(0)) % 6;
  const failed = signal(false);
  const url = src ? safeUrl(src) : null;
  return h(
    "span",
    { ...rest, class: cx("avatar", sz !== "md" && sz, `avatar-c${hash}`, klass), role: "img", "aria-label": alt ?? (text || "Ảnh đại diện") },
    () => (url && !failed() ? h("img", { src: url, alt: "", onerror: () => failed.set(true) }) : h("span", { "aria-hidden": "true" }, initials))
  );
}

/**
 * Gợi ý khi rê chuột hoặc dùng bàn phím: h(Tooltip, { text: "Lưu" }, nút).
 * Bấm Esc để ẩn (kể cả khi chỉ đang rê chuột, theo WCAG 1.4.13); chỉ lắng nghe Esc khi gợi ý đang hiện.
 */
export function Tooltip({ text, children = [], class: klass, ...rest } = {}) {
  const id = uid("tip");
  const hovered = signal(false);
  const focused = signal(false);
  const hidden = signal(false);
  const first = children.find((c) => c && c.nodeType === 1);
  if (first) first.setAttribute("aria-describedby", id);
  effect(() => {
    if (!(hovered() || focused())) return void hidden.set(false);
    const onKey = (e) => {
      if (e.key === "Escape") hidden.set(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });
  return h(
    "span",
    {
      ...rest,
      class: cx("tip", () => (hidden() ? "tip-hide" : ""), klass),
      onmouseenter: () => hovered.set(true),
      onmouseleave: () => hovered.set(false),
      onfocusin: () => focused.set(true),
      onfocusout: () => focused.set(false),
    },
    ...children,
    h("span", { class: "tip-bubble", role: "tooltip", id }, text)
  );
}

// So sánh để sắp xếp: số theo giá trị, còn lại theo chữ (có hiểu số trong chuỗi), rỗng xếp cuối
const compare = (a, b) => {
  const ea = a == null || a === "", eb = b == null || b === "";
  if (ea || eb) return ea === eb ? 0 : ea ? 1 : -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (a instanceof Date && b instanceof Date) return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
};

/**
 * Bảng dữ liệu có sắp xếp (bấm tiêu đề: tăng, giảm, bỏ sắp xếp).
 *   h(Table, { columns: [{ key: "ten", label: "Tên" }, { key: "gia", label: "Giá", align: "right", render: (r) => r.gia + "đ" }], rows })
 * rows là mảng, hàm hoặc signal. Ô luôn là chữ thuần (trừ khi render trả về node). Chỉ đọc thuộc tính riêng của dòng.
 */
export function Table({ columns, rows = [], caption, empty = "Không có dữ liệu", sortable = true, class: klass, ...rest } = {}) {
  if (!Array.isArray(columns) || !columns.length) throw new TypeError("Fluxa UI: Table needs a non-empty `columns` array");
  const cols = columns.map((c) => ({
    key: c.key == null ? null : String(c.key),
    label: c.label ?? c.key ?? "",
    align: pick(c.align, ALIGNS, "left"),
    render: typeof c.render === "function" ? c.render : null,
    sortable: sortable && c.sortable !== false && c.key != null,
  }));
  const sortKey = signal(null);
  const sortDir = signal("asc");
  const cycle = (key) => {
    if (sortKey.peek() !== key) (sortKey.set(key), sortDir.set("asc"));
    else if (sortDir.peek() === "asc") sortDir.set("desc");
    else sortKey.set(null);
  };
  const sorted = computed(() => {
    const arr = [...(read(rows) || [])];
    const k = sortKey();
    if (k === null) return arr;
    const dir = sortDir() === "asc" ? 1 : -1;
    const get = (r) => (own(r, k) ? r[k] : undefined);
    return arr.sort((a, b) => dir * compare(get(a), get(b)));
  });
  const cell = (row, c) => {
    const content = c.render ? c.render(row) : c.key !== null && own(row, c.key) ? row[c.key] : "";
    return h("td", { class: c.align !== "left" ? `align-${c.align}` : null }, content == null ? "" : content);
  };
  const ariaSort = (c) => () => (sortKey() !== c.key ? "none" : sortDir() === "asc" ? "ascending" : "descending");
  return h(
    "div",
    { ...rest, class: cx("table-wrap", klass) },
    h(
      "table",
      { class: "table" },
      caption != null ? h("caption", null, caption) : null,
      h(
        "thead",
        null,
        h(
          "tr",
          null,
          ...cols.map((c) =>
            h(
              "th",
              { scope: "col", class: c.align !== "left" ? `align-${c.align}` : null, "aria-sort": c.sortable ? ariaSort(c) : null },
              c.sortable
                ? h(
                    "button",
                    { type: "button", class: "th-sort", onclick: () => cycle(c.key) },
                    c.label,
                    h("span", { class: "sort-mark", "aria-hidden": "true" }, () => (sortKey() !== c.key ? "↕" : sortDir() === "asc" ? "↑" : "↓"))
                  )
                : c.label
            )
          )
        )
      ),
      h(
        "tbody",
        null,
        () => (sorted().length ? null : h("tr", { class: "table-empty" }, h("td", { colspan: String(cols.length) }, empty))),
        list(sorted, (row) => h("tr", null, ...cols.map((c) => cell(row, c))))
      )
    )
  );
}

// ───────────── Điều hướng và menu ─────────────

/**
 * Phân trang. page là signal (bắt đầu từ 1), pages là số trang (số, hàm hoặc signal).
 *   h(Pagination, { page, pages: () => Math.ceil(tong() / 10) })
 */
export function Pagination({ page, pages, siblings = 1, onChange, class: klass, ...rest } = {}) {
  if (!isSignal(page)) throw new TypeError("Fluxa UI: Pagination needs a `page` signal");
  const total = () => Math.max(1, Math.floor(Number(read(pages))) || 1);
  const sib = Math.min(5, Math.max(0, Math.floor(Number(siblings)) || 0));
  effect(() => {
    const t = total();
    if (page() > t) page.set(t);
    else if (!(page() >= 1)) page.set(1);
  });
  const go = (p) => {
    const n = Math.min(total(), Math.max(1, p));
    if (n === page.peek()) return;
    page.set(n);
    if (typeof onChange === "function") onChange(n);
  };
  const items = () => {
    const cur = Math.min(page(), total()), t = total();
    const keep = new Set([1, t, cur]);
    for (let d = 1; d <= sib; d++) (keep.add(cur - d), keep.add(cur + d));
    const nums = [...keep].filter((p) => p >= 1 && p <= t).sort((a, b) => a - b);
    const out = [];
    nums.forEach((p, i) => {
      const gap = i === 0 ? 1 : p - nums[i - 1];
      if (gap === 2) out.push(p - 1);
      else if (gap > 2) out.push("…");
      out.push(p);
    });
    return out;
  };
  const btn = (label, aria, onclick, disabled, cls) =>
    h("button", { type: "button", class: cx("page-btn", cls), "aria-label": aria, disabled, onclick }, label);
  return h(
    "nav",
    { ...rest, class: cx("pagination", klass), "aria-label": "Phân trang" },
    btn("‹", "Trang trước", () => go(page() - 1), () => page() <= 1),
    () =>
      items().map((p) =>
        p === "…"
          ? h("span", { class: "page-gap", "aria-hidden": "true" }, "…")
          : h(
              "button",
              {
                type: "button",
                class: p === page() ? "page-btn active" : "page-btn",
                "aria-label": `Trang ${p}`,
                "aria-current": p === page() ? "page" : null,
                onclick: () => go(p),
              },
              String(p)
            )
      ),
    btn("›", "Trang sau", () => go(page() + 1), () => page() >= total())
  );
}

/**
 * Menu thả xuống có bàn phím (↑ ↓ Home End Esc), đóng khi bấm ra ngoài.
 *   h(Dropdown, { label: "Tùy chọn", items: [{ label: "Sửa", onclick: sua }, { divider: true }, { label: "Xóa", danger: true, onclick: xoa }] })
 */
export function Dropdown({ label = "Tùy chọn", items = [], variant = "ghost", align = "start", class: klass, ...rest } = {}) {
  const open = signal(false);
  const menuId = uid("menu");
  const v = pick(variant, VARIANTS, "ghost");
  const refs = [];
  let trigger = null;
  const list_ = () => (typeof items === "function" ? items() : items) || [];
  const enabled = () => refs.map((el, i) => (el && !list_()[i]?.disabled ? i : -1)).filter((i) => i >= 0);
  const close = (refocus = true) => {
    if (!open.peek()) return;
    open.set(false);
    if (refocus && trigger && typeof trigger.focus === "function") trigger.focus();
  };
  const focusAt = (i) => {
    const el = refs[i];
    if (el && typeof el.focus === "function") el.focus();
  };
  const show = (which) =>
    queueMicrotask(() => {
      const ok = enabled();
      if (ok.length) focusAt(which === "last" ? ok[ok.length - 1] : ok[0]);
    });
  const onTriggerKey = (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      open.set(true);
      show(e.key === "ArrowUp" ? "last" : "first");
    }
  };
  const onMenuKey = (e) => {
    const ok = enabled();
    const at = ok.indexOf(refs.indexOf(document.activeElement));
    if (e.key === "Escape") (e.preventDefault(), close());
    else if (e.key === "Tab") close(false);
    else if (e.key === "ArrowDown") (e.preventDefault(), focusAt(ok[(at + 1) % ok.length]));
    else if (e.key === "ArrowUp") (e.preventDefault(), focusAt(ok[(at - 1 + ok.length) % ok.length]));
    else if (e.key === "Home") (e.preventDefault(), focusAt(ok[0]));
    else if (e.key === "End") (e.preventDefault(), focusAt(ok[ok.length - 1]));
  };
  const root = h(
    "div",
    { ...rest, class: cx("dropdown", klass) },
    h(
      "button",
      {
        type: "button",
        class: cx("btn", v !== "primary" && v),
        "aria-haspopup": "menu",
        "aria-expanded": () => String(open()),
        "aria-controls": menuId,
        ref: (el) => (trigger = el),
        onclick: () => (open.peek() ? close(false) : open.set(true)),
        onkeydown: onTriggerKey,
      },
      label,
      h("span", { class: "caret", "aria-hidden": "true" }, "▾")
    ),
    () => {
      if (!open()) return null;
      refs.length = 0;
      return h(
        "div",
        { class: cx("menu", pick(align, new Set(["start", "end"]), "start") === "end" && "menu-end"), role: "menu", id: menuId, onkeydown: onMenuKey },
        ...list_().map((it, i) =>
          it && it.divider
            ? h("div", { class: "menu-divider", role: "separator" })
            : h(
                "button",
                {
                  type: "button",
                  role: "menuitem",
                  class: cx("menu-item", it && it.danger && "danger"),
                  tabindex: "-1",
                  disabled: !!(it && it.disabled),
                  ref: (el) => (refs[i] = el),
                  onclick: () => {
                    close();
                    if (it && typeof it.onclick === "function") it.onclick();
                  },
                },
                it && it.label != null ? String(it.label) : ""
              )
        )
      );
    }
  );
  // Bấm ra ngoài thì đóng. Chỉ lắng nghe khi menu đang mở; tự gỡ khi đóng hoặc khi component bị gỡ.
  effect(() => {
    if (!open()) return;
    const onDoc = (e) => {
      for (let n = e.target; n; n = n.parentNode) if (n === root) return;
      close(false);
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  });
  return root;
}

// ───────────── Form: bổ sung (0.10) ─────────────

/** Ô nhập nhiều dòng. Có maxlength thì hiện bộ đếm ký tự. value là signal => hai chiều. */
export function Textarea(props) {
  const { value, label, hint, error, id = uid("textarea"), rows = 4, maxlength, class: klass, ...rest } = props;
  const fid = String(id);
  const lines = Math.min(40, Math.max(1, Math.floor(Number(rows)) || 4));
  const max = Number(maxlength) > 0 ? Math.floor(Number(maxlength)) : null;
  const attrs = {
    ...rest,
    id: fid,
    rows: String(lines),
    class: cx("input", klass),
    "aria-invalid": () => (read(error) ? "true" : null),
    "aria-describedby": describedBy(fid, error, hint),
  };
  if (max) attrs.maxlength = String(max);
  if (value !== undefined) attrs.value = value;
  const control = h("textarea", attrs);
  const counter = max ? h("span", { class: "counter", "aria-hidden": "true" }, () => `${String(read(value) ?? "").length}/${max}`) : null;
  return field(fid, { label, hint, error }, counter ? h("div", { class: "textarea-wrap" }, control, counter) : control);
}

/** Nhóm nút chọn một. options: mảng chuỗi hoặc {value, label, disabled}. value là signal bắt buộc. */
export function RadioGroup(props) {
  const { value, options = [], label, hint, error, name = uid("radio"), inline = false, class: klass, ...rest } = props;
  if (!isSignal(value)) throw new TypeError("Fluxa UI: RadioGroup needs a `value` signal");
  const fid = uid("radiogroup");
  const opts = options.map((o) => (o !== null && typeof o === "object" ? o : { value: o }));
  return h(
    "fieldset",
    {
      ...rest,
      class: cx("radiogroup", inline && "inline", klass),
      "aria-invalid": () => (read(error) ? "true" : null),
      "aria-describedby": describedBy(fid, error, hint),
    },
    label != null ? h("legend", { class: "label" }, label) : null,
    ...opts.map((o) => {
      const rid = uid("radio");
      return h(
        "label",
        { class: "check", for: rid },
        h("input", {
          type: "radio",
          id: rid,
          name: String(name),
          value: String(o.value),
          disabled: !!o.disabled,
          checked: () => String(value()) === String(o.value),
          onchange: (e) => e.target.checked && value.set(o.value),
        }),
        h("span", null, String(o.label ?? o.value))
      );
    }),
    () => {
      const e = read(error);
      if (e) return h("p", { class: "error", id: fid + "-err", role: "alert" }, e);
      const t = read(hint);
      return t ? h("p", { class: "hint", id: fid + "-hint" }, t) : null;
    }
  );
}

/** Công tắc bật/tắt (role="switch"). checked là signal => hai chiều. */
export function Switch(props) {
  const { checked = false, label, id = uid("switch"), class: klass, ...rest } = props;
  const fid = String(id);
  const input = h("input", { ...rest, id: fid, type: "checkbox", role: "switch", checked, "aria-checked": () => String(!!read(checked)) });
  return h("label", { class: cx("switch", klass), for: fid }, input, h("span", { class: "switch-track", "aria-hidden": "true" }), label != null ? h("span", null, label) : null);
}

/** Thanh trượt chọn số. value là signal<number>; min, max, step được ép về số hợp lệ. */
export function Slider(props) {
  const { value, min = 0, max = 100, step = 1, label, hint, id = uid("slider"), showValue = true, class: klass, ...rest } = props;
  const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
  const lo = num(min, 0);
  const hi = Math.max(lo, num(max, 100));
  const st = num(step, 1) > 0 ? num(step, 1) : 1;
  const get = () => Math.min(hi, Math.max(lo, num(read(value), lo)));
  const fid = String(id);
  const input = h("input", {
    ...rest,
    id: fid,
    type: "range",
    class: cx("slider", klass),
    min: String(lo),
    max: String(hi),
    step: String(st),
    value: () => String(get()),
    oninput: (e) => isSignal(value) && value.set(Number(e.target.value)),
  });
  return field(fid, { label, hint }, h("div", { class: "slider-row" }, input, showValue ? h("output", { class: "slider-value" }, () => String(get())) : null));
}

/** Đánh giá sao. value là signal => bấm hoặc dùng phím ← → ↑ ↓ Home End để chọn; readonly hoặc không có signal => chỉ hiển thị. */
export function Rating(props) {
  const { value, max = 5, label = "Đánh giá", readonly = false, class: klass, ...rest } = props;
  const n = Math.min(10, Math.max(1, Math.floor(Number(max)) || 5));
  const cur = () => Math.min(n, Math.max(0, Math.round(Number(read(value)) || 0)));
  const nums = Array.from({ length: n }, (_, k) => k + 1);
  if (readonly || !isSignal(value)) {
    return h("span", { ...rest, class: cx("rating", klass), role: "img", "aria-label": () => `${label}: ${cur()}/${n}` },
      ...nums.map((k) => h("span", { class: () => (k <= cur() ? "star on" : "star"), "aria-hidden": "true" }, "★")));
  }
  const btns = [];
  const move = (to) => {
    const v = Math.min(n, Math.max(1, to));
    value.set(v);
    btns[v - 1]?.focus?.();
  };
  const onKey = (e) => {
    const c = cur() || 1;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") (e.preventDefault(), move(c + 1));
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") (e.preventDefault(), move(c - 1));
    else if (e.key === "Home") (e.preventDefault(), move(1));
    else if (e.key === "End") (e.preventDefault(), move(n));
  };
  return h("div", { ...rest, class: cx("rating", klass), role: "radiogroup", "aria-label": label },
    ...nums.map((k) =>
      h("button", {
        type: "button",
        role: "radio",
        class: () => (k <= cur() ? "star on" : "star"),
        "aria-checked": () => String(cur() === k),
        "aria-label": `${k} / ${n}`,
        tabindex: () => ((cur() || 1) === k ? "0" : "-1"),
        ref: (el) => (btns[k - 1] = el),
        onclick: () => value.set(k),
        onkeydown: onKey,
      }, "★")
    )
  );
}

// ───────────── Bố cục và điều hướng (0.10) ─────────────

/**
 * Nhóm mục mở/đóng. items: [{title, content}], content là node hoặc hàm (hàm chỉ chạy khi mục đang mở).
 * multiple=true cho mở nhiều mục cùng lúc; open: chỉ số (hoặc mảng chỉ số) mở sẵn. Phím ↑ ↓ Home End di chuyển giữa các tiêu đề.
 */
export function Accordion({ items, multiple = false, open: initial, class: klass, ...rest } = {}) {
  if (!Array.isArray(items) || !items.length) throw new TypeError("Fluxa UI: Accordion needs a non-empty `items` array");
  const start = (Array.isArray(initial) ? initial : initial == null ? [] : [initial]).filter((i) => Number.isInteger(i) && i >= 0 && i < items.length);
  const openSet = signal(new Set(multiple ? start : start.slice(0, 1)));
  const base = uid("acc");
  const btns = [];
  const isOpen = (i) => openSet().has(i);
  const toggle = (i) => {
    const cur = openSet.peek();
    if (multiple) {
      const next = new Set(cur);
      next.has(i) ? next.delete(i) : next.add(i);
      openSet.set(next);
    } else openSet.set(cur.has(i) ? new Set() : new Set([i]));
  };
  const onKey = (e, i) => {
    let n = null;
    if (e.key === "ArrowDown") n = (i + 1) % items.length;
    else if (e.key === "ArrowUp") n = (i - 1 + items.length) % items.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = items.length - 1;
    if (n === null) return;
    e.preventDefault();
    btns[n]?.focus?.();
  };
  return h("div", { ...rest, class: cx("accordion", klass) },
    ...items.map((it, i) =>
      h("div", { class: () => (isOpen(i) ? "acc-item open" : "acc-item") },
        h("h3", { class: "acc-head" },
          h("button", {
            type: "button",
            class: "acc-btn",
            id: `${base}-btn-${i}`,
            "aria-expanded": () => String(isOpen(i)),
            "aria-controls": `${base}-panel-${i}`,
            ref: (el) => (btns[i] = el),
            onclick: () => toggle(i),
            onkeydown: (e) => onKey(e, i),
          }, String(it.title), h("span", { class: "caret", "aria-hidden": "true" }, "▾"))
        ),
        h("div", { class: "acc-panel", id: `${base}-panel-${i}`, role: "region", "aria-labelledby": `${base}-btn-${i}`, hidden: () => !isOpen(i) },
          () => (isOpen(i) ? (typeof it.content === "function" ? it.content() : it.content) : null))
      )
    )
  );
}

/** Đường dẫn phân cấp. items: [{label, href}]; mục cuối là trang hiện tại (không là liên kết). href qua bộ lọc URL của lõi. */
export function Breadcrumb({ items = [], label = "Đường dẫn", class: klass, ...rest } = {}) {
  const last = items.length - 1;
  return h("nav", { ...rest, class: cx("breadcrumb", klass), "aria-label": label },
    h("ol", null, ...items.map((it, i) =>
      h("li", null, i < last && it.href != null
        ? h("a", { href: it.href }, String(it.label))
        : h("span", { "aria-current": i === last ? "page" : null }, String(it.label)))
    ))
  );
}

const SIDES = new Set(["left", "right", "bottom"]);
/** Ngăn kéo trượt từ cạnh màn hình. Nhận mọi thuộc tính của Modal (open, title, onClose...). side: left | right | bottom. */
export function Drawer(props) {
  const { side = "right", class: klass, ...rest } = props;
  return Modal({ ...rest, class: cx("drawer", `drawer-${pick(side, SIDES, "right")}`, klass) });
}

/** Thanh các bước. steps: mảng nhãn; current là số (hoặc signal/hàm) chỉ chỉ số bước hiện tại, bắt đầu từ 0. */
export function Stepper({ steps = [], current = 0, class: klass, ...rest } = {}) {
  const cur = () => Math.min(steps.length - 1, Math.max(0, Math.floor(Number(read(current))) || 0));
  return h("ol", { ...rest, class: cx("stepper", klass) },
    ...steps.map((s, i) =>
      h("li", { class: () => "step" + (i < cur() ? " done" : i === cur() ? " active" : ""), "aria-current": () => (i === cur() ? "step" : null) },
        h("span", { class: "step-dot", "aria-hidden": "true" }, () => (i < cur() ? "✓" : String(i + 1))),
        h("span", { class: "step-label" }, String(s)))
    )
  );
}

/** Hộp nổi chứa nội dung tùy ý. Đóng bằng Esc hoặc bấm ra ngoài; chỉ lắng nghe khi đang mở. */
export function Popover({ label = "Mở", children = [], align = "start", variant = "ghost", title, class: klass, ...rest } = {}) {
  const open = signal(false);
  const id = uid("popover");
  const v = pick(variant, VARIANTS, "ghost");
  let trigger = null, root = null;
  effect(() => {
    if (!open()) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        open.set(false);
        trigger?.focus?.();
      }
    };
    const onDoc = (e) => {
      for (let n = e.target; n; n = n.parentNode) if (n === root) return;
      open.set(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onDoc);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onDoc);
    };
  });
  root = h("div", { ...rest, class: cx("popover", klass) },
    h("button", { type: "button", class: cx("btn", v !== "primary" && v), "aria-expanded": () => String(open()), "aria-controls": id, "aria-haspopup": "dialog", ref: (el) => (trigger = el), onclick: () => open.set(!open.peek()) }, label),
    () => (open() ? h("div", { class: cx("popover-panel", pick(align, new Set(["start", "end"]), "start") === "end" && "menu-end"), id, role: "dialog", "aria-label": title != null ? String(title) : null }, ...children) : null)
  );
  return root;
}
