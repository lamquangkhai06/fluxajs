/*! Fluxa inputs 0.10.0 — Combobox, FileInput, DatePicker: nhập liệu nâng cao, có bàn phím + ARIA, an toàn theo mặc định. MIT License. */
import { h, signal, computed, effect, untrack } from "./fluxa.js";
import { uid, cx } from "./fluxa-components.js";

const read = (v) => (typeof v === "function" ? v() : v);
const isSignal = (v) => typeof v === "function" && typeof v.set === "function";
// So khớp không phân biệt hoa/thường và dấu tiếng Việt: "ao" khớp "Áo", "dong ho" khớp "Đồng hồ"
const fold = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

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

// ═══════════════════════════ Combobox ═══════════════════════════

/**
 * Ô nhập có gợi ý (ARIA combobox + listbox). value là signal (giá trị đã chọn). options: mảng chuỗi hoặc {value, label, disabled},
 * hoặc hàm trả về mảng. Gõ để lọc (không phân biệt dấu), ↑ ↓ chọn, Enter xác nhận, Esc đóng.
 * allowCustom=true cho phép giá trị tự gõ ngoài danh sách. Nhãn luôn hiển thị là chữ thuần.
 */
export function Combobox(props) {
  const { value, options = [], label, hint, error, placeholder, id = uid("combo"), allowCustom = false, limit = 50, noResults = "Không tìm thấy", class: klass, ...rest } = props;
  if (!isSignal(value)) throw new TypeError("Fluxa UI: Combobox needs a `value` signal");
  const fid = String(id);
  const listId = fid + "-list";
  const max = Math.min(200, Math.max(1, Math.floor(Number(limit)) || 50));
  const norm = (o) => (o !== null && typeof o === "object" ? { value: o.value, label: String(o.label ?? o.value), disabled: !!o.disabled } : { value: o, label: String(o), disabled: false });
  const opts = () => (typeof options === "function" ? options() : options).map(norm);
  const labelOf = (v) => {
    const f = opts().find((o) => String(o.value) === String(v));
    return f ? f.label : allowCustom && v != null ? String(v) : "";
  };
  const text = signal(untrack(() => labelOf(value())));
  const open = signal(false);
  const active = signal(0);
  const items = [];
  let input = null;

  // Giá trị đổi từ bên ngoài (hoặc do chọn) thì chữ trong ô theo đó; chỉ phụ thuộc vào value, không bị options kéo lại khi đang gõ
  effect(() => {
    const v = value();
    text.set(untrack(() => labelOf(v)));
  });

  const shown = computed(() => {
    const q = fold(text().trim());
    const all = opts();
    const list = !q || text() === labelOf(value()) ? all : all.filter((o) => fold(o.label).includes(q));
    return list.slice(0, max);
  });
  const enabledIdx = () => shown().map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);
  const choose = (o) => {
    if (!o || o.disabled) return;
    value.set(o.value);
    text.set(o.label);
    open.set(false);
  };
  const step = (dir) => {
    const ok = enabledIdx();
    if (!ok.length) return;
    const at = ok.indexOf(active.peek());
    active.set(ok[at < 0 ? (dir > 0 ? 0 : ok.length - 1) : (at + dir + ok.length) % ok.length]);
  };
  const onKey = (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open.peek()) {
        open.set(true);
        const ok = enabledIdx();
        active.set(ok.length ? ok[e.key === "ArrowUp" ? ok.length - 1 : 0] : 0);
      } else step(e.key === "ArrowDown" ? 1 : -1);
    } else if (e.key === "Enter") {
      const o = open.peek() ? shown()[active.peek()] : null;
      if (o && !o.disabled) (e.preventDefault(), choose(o));
      else if (allowCustom) value.set(text.peek());
    } else if (e.key === "Escape" && open.peek()) {
      e.preventDefault();
      open.set(false);
    }
  };
  const onBlur = () => {
    open.set(false);
    if (allowCustom) value.set(text.peek());
    else text.set(labelOf(value.peek())); // không cho giữ chữ không nằm trong danh sách
  };
  // Đưa mục đang chọn vào vùng nhìn thấy khi danh sách dài
  effect(() => {
    const i = active();
    if (open.peek()) items[i]?.scrollIntoView?.({ block: "nearest" });
  });

  const control = h("input", {
    ...rest,
    id: fid,
    class: cx("input", klass),
    type: "text",
    role: "combobox",
    autocomplete: "off",
    placeholder: placeholder != null ? String(placeholder) : null,
    "aria-autocomplete": "list",
    "aria-expanded": () => String(open()),
    "aria-controls": listId,
    "aria-activedescendant": () => (open() && shown()[active()] ? `${fid}-opt-${active()}` : null),
    "aria-invalid": () => (read(error) ? "true" : null),
    "aria-describedby": describedBy(fid, error, hint),
    value: () => text(),
    ref: (el) => (input = el),
    oninput: (e) => {
      text.set(e.target.value);
      active.set(0);
      open.set(true);
      if (!e.target.value && !allowCustom) value.set("");
    },
    onkeydown: onKey,
    onblur: onBlur,
    onclick: () => open.set(true),
  });

  const pop = () => {
    if (!open()) return null;
    const list = shown();
    items.length = 0;
    if (!list.length) return h("div", { class: "combo-pop" }, h("p", { class: "combo-empty" }, String(noResults)));
    return h(
      "div",
      { class: "combo-pop" },
      h(
        "ul",
        { class: "combo-list", role: "listbox", id: listId, "aria-label": label != null ? String(read(label)) : null },
        ...list.map((o, i) =>
          h(
            "li",
            {
              role: "option",
              id: `${fid}-opt-${i}`,
              class: () => "combo-opt" + (active() === i ? " active" : "") + (o.disabled ? " disabled" : ""),
              "aria-selected": () => String(String(o.value) === String(value())),
              "aria-disabled": o.disabled ? "true" : null,
              ref: (el) => (items[i] = el),
              // mousedown + preventDefault: giữ tiêu điểm ở ô nhập, không kích hoạt blur trước khi chọn
              onmousedown: (e) => e.preventDefault(),
              onclick: () => choose(o),
              onmouseenter: () => !o.disabled && active.set(i),
            },
            o.label
          )
        )
      )
    );
  };
  const status = h("span", { class: "sr-only", role: "status" }, () => (open() ? (shown().length ? `${shown().length} kết quả` : String(noResults)) : ""));
  return field(fid, { label, hint, error }, h("div", { class: "combo" }, control, pop, status));
}

// ═══════════════════════════ FileInput ═══════════════════════════

const ACCEPT_TOKEN = /^(\.[a-z0-9]{1,10}|[a-z]+\/([a-z0-9][a-z0-9.+-]*|\*))$/i;
export const formatSize = (n) => {
  n = Number(n) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};
/** Tệp có khớp danh sách accept (đuôi `.png` hoặc MIME `image/png`, `image/*`) không. Chỉ là kiểm tra phía client. */
export function matchesAccept(file, accept) {
  if (!accept.length) return true;
  const name = String(file.name || "").toLowerCase();
  const type = String(file.type || "").toLowerCase();
  return accept.some((a) => {
    a = a.toLowerCase();
    if (a.startsWith(".")) return name.endsWith(a);
    if (a.endsWith("/*")) return type.startsWith(a.slice(0, -1));
    return type === a;
  });
}

/**
 * Chọn tệp (bấm hoặc kéo-thả) có kiểm tra loại, dung lượng và số lượng. value là signal<File[]> (tùy chọn, để đọc từ ngoài).
 * accept: mảng như [".png", "image/*"]; maxSize: byte (mặc định 5 MB); maxFiles: mặc định 10; multiple.
 * Tên tệp luôn hiển thị là chữ thuần. LƯU Ý: kiểm tra ở đây chỉ để người dùng đỡ chọn nhầm; server phải kiểm tra lại.
 */
export function FileInput(props) {
  const { value, accept = [], maxSize = 5 * 1024 * 1024, maxFiles = 10, multiple = false, label, hint, error, id = uid("file"), onFiles, class: klass, ...rest } = props;
  const fid = String(id);
  const okAccept = (Array.isArray(accept) ? accept : []).map(String).filter((a) => ACCEPT_TOKEN.test(a));
  const sizeCap = Number(maxSize) > 0 ? Number(maxSize) : 5 * 1024 * 1024;
  const countCap = multiple ? Math.min(100, Math.max(1, Math.floor(Number(maxFiles)) || 10)) : 1;
  const files = isSignal(value) ? value : signal([]);
  const problems = signal([]);
  const over = signal(false);
  let input = null;

  const handle = (list) => {
    const bad = [];
    const good = [];
    for (const f of Array.from(list || [])) {
      const name = String(f.name || "(không tên)");
      if (!matchesAccept(f, okAccept)) bad.push(`${name}: loại tệp không được phép`);
      else if (f.size > sizeCap) bad.push(`${name}: lớn hơn ${formatSize(sizeCap)}`);
      else good.push(f);
    }
    const base = multiple ? files.peek() : [];
    const room = countCap - base.length;
    if (good.length > room) bad.push(`Chỉ được chọn tối đa ${countCap} tệp`);
    const next = [...base, ...good.slice(0, Math.max(0, room))];
    problems.set(bad);
    files.set(next);
    if (typeof onFiles === "function") onFiles(next);
    if (input) input.value = ""; // cho phép chọn lại đúng tệp vừa bỏ
  };
  const remove = (f) => {
    const next = files.peek().filter((x) => x !== f);
    files.set(next);
    problems.set([]);
    if (typeof onFiles === "function") onFiles(next);
  };

  input = h("input", {
    ...rest,
    id: fid,
    type: "file",
    class: "file-native",
    accept: okAccept.length ? okAccept.join(",") : null,
    multiple: multiple ? "" : null,
    tabindex: "-1",
    "aria-describedby": describedBy(fid, error, hint),
    onchange: (e) => handle(e.target.files),
  });
  const zone = h(
    "div",
    {
      class: () => ["file-zone", over() && "over", typeof klass === "string" && klass].filter(Boolean).join(" "),
      ondragover: (e) => (e.preventDefault(), over.set(true)),
      ondragleave: () => over.set(false),
      ondrop: (e) => {
        e.preventDefault();
        over.set(false);
        handle(e.dataTransfer && e.dataTransfer.files);
      },
    },
    input,
    h("button", { type: "button", class: "btn ghost", onclick: () => input.click() }, multiple ? "Chọn các tệp" : "Chọn tệp"),
    h("span", { class: "muted" }, "hoặc kéo thả vào đây"),
    h("span", { class: "hint" }, () => [okAccept.length ? okAccept.join(", ") : "mọi loại", `tối đa ${formatSize(sizeCap)}`, multiple ? `${countCap} tệp` : ""].filter(Boolean).join(" · "))
  );
  const list = () =>
    files().length
      ? h("ul", { class: "file-list" }, ...files().map((f) =>
          h("li", null,
            h("span", { class: "file-name" }, String(f.name)),
            h("span", { class: "muted" }, formatSize(f.size)),
            h("button", { type: "button", class: "link", "aria-label": `Bỏ ${String(f.name)}`, onclick: () => remove(f) }, "Bỏ"))))
      : null;
  const issues = () => (problems().length ? h("ul", { class: "file-errors", role: "alert" }, ...problems().map((m) => h("li", { class: "error" }, m))) : null);
  return field(fid, { label, hint, error }, h("div", { class: "file" }, zone, list, issues));
}

// ═══════════════════════════ DatePicker ═══════════════════════════

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const pad = (n, w = 2) => String(n).padStart(w, "0");
/** "2026-11-16" => {y, m, d} nếu là ngày có thật, ngược lại null. */
export function parseDate(s) {
  const m = ISO.exec(String(s || ""));
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d ? { y, m: mo, d } : null;
}
const toIso = ({ y, m, d }) => `${pad(y, 4)}-${pad(m)}-${pad(d)}`;
const fromUtc = (t) => ({ y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() });
const addDays = (p, n) => fromUtc(new Date(Date.UTC(p.y, p.m - 1, p.d + n)));
const addMonths = (p, n) => {
  const t = new Date(Date.UTC(p.y, p.m - 1 + n, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: Math.min(p.d, last) };
};
const dow = (p) => new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay(); // 0 = Chủ nhật

/**
 * Chọn ngày. value là signal<string> dạng "YYYY-MM-DD" ("" khi chưa chọn). min/max cũng là "YYYY-MM-DD".
 * Lịch dạng lưới: ← → ↑ ↓ đổi ngày, PageUp/PageDown đổi tháng (Shift: đổi năm), Home/End đầu/cuối tuần, Enter chọn, Esc đóng.
 * Ngày luôn tính theo UTC nên không lệch múi giờ. locale mặc định "vi-VN"; firstDay: 1 = thứ Hai (mặc định), 0 = Chủ nhật.
 */
export function DatePicker(props) {
  const { value, min, max, label, hint, error, id = uid("date"), locale = "vi-VN", firstDay = 1, placeholder = "Chọn ngày", clearable = true, class: klass, ...rest } = props;
  if (!isSignal(value)) throw new TypeError("Fluxa UI: DatePicker needs a `value` signal");
  const fid = String(id);
  const gridId = fid + "-grid";
  const lo = parseDate(read(min)), hi = parseDate(read(max));
  const first = firstDay === 0 ? 0 : 1;
  let loc = "vi-VN";
  try {
    loc = Intl.DateTimeFormat.supportedLocalesOf([String(locale)])[0] || "vi-VN";
  } catch { /* giữ mặc định */ }
  const dayFmt = new Intl.DateTimeFormat(loc, { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });
  const longFmt = new Intl.DateTimeFormat(loc, { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const monthFmt = new Intl.DateTimeFormat(loc, { timeZone: "UTC", month: "long", year: "numeric" });
  const wdFmt = new Intl.DateTimeFormat(loc, { timeZone: "UTC", weekday: "short" });
  const show = (p) => dayFmt.format(new Date(Date.UTC(p.y, p.m - 1, p.d)));
  const cmp = (a, b) => a.y - b.y || a.m - b.m || a.d - b.d;
  const allowed = (p) => !(lo && cmp(p, lo) < 0) && !(hi && cmp(p, hi) > 0);
  const clamp = (p) => (lo && cmp(p, lo) < 0 ? lo : hi && cmp(p, hi) > 0 ? hi : p);
  const today = () => fromUtc(new Date());

  const open = signal(false);
  const selected = () => parseDate(value());
  const cursor = signal(toIso(clamp(selected() || today())));
  const view = signal(cursor.peek().slice(0, 7)); // "YYYY-MM": lưới chỉ dựng lại khi đổi tháng
  const refs = new Map();
  let input = null, root = null;

  const moveTo = (p) => {
    const t = clamp(p);
    cursor.set(toIso(t));
    view.set(toIso(t).slice(0, 7));
    queueMicrotask(() => refs.get(toIso(t))?.focus?.());
  };
  const pickDay = (p) => {
    if (!allowed(p)) return;
    value.set(toIso(p));
    open.set(false);
    input?.focus?.();
  };
  const openPicker = () => {
    const base = clamp(selected() || today());
    cursor.set(toIso(base));
    view.set(toIso(base).slice(0, 7));
    open.set(true);
    queueMicrotask(() => refs.get(toIso(base))?.focus?.());
  };
  const onGridKey = (e) => {
    const c = parseDate(cursor.peek());
    if (!c) return;
    const k = e.key;
    let next = null;
    if (k === "ArrowLeft") next = addDays(c, -1);
    else if (k === "ArrowRight") next = addDays(c, 1);
    else if (k === "ArrowUp") next = addDays(c, -7);
    else if (k === "ArrowDown") next = addDays(c, 7);
    else if (k === "PageUp") next = addMonths(c, e.shiftKey ? -12 : -1);
    else if (k === "PageDown") next = addMonths(c, e.shiftKey ? 12 : 1);
    else if (k === "Home") next = addDays(c, -((dow(c) - first + 7) % 7));
    else if (k === "End") next = addDays(c, 6 - ((dow(c) - first + 7) % 7));
    if (next) (e.preventDefault(), moveTo(next));
  };

  // Esc đóng, bấm ra ngoài đóng; chỉ lắng nghe khi đang mở
  effect(() => {
    if (!open()) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        open.set(false);
        input?.focus?.();
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

  input = h("input", {
    ...rest,
    id: fid,
    class: cx("input", klass),
    type: "text",
    readonly: "",
    placeholder: String(placeholder),
    "aria-haspopup": "dialog",
    "aria-expanded": () => String(open()),
    "aria-controls": gridId,
    "aria-invalid": () => (read(error) ? "true" : null),
    "aria-describedby": describedBy(fid, error, hint),
    value: () => (selected() ? show(selected()) : ""),
    onclick: () => (open.peek() ? open.set(false) : openPicker()),
    onkeydown: (e) => {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") (e.preventDefault(), openPicker());
      else if ((e.key === "Backspace" || e.key === "Delete") && clearable) (e.preventDefault(), value.set(""));
    },
  });

  const weekdays = Array.from({ length: 7 }, (_, i) => {
    const ref = new Date(Date.UTC(2023, 0, 1 + ((first + i) % 7))); // 2023-01-01 là Chủ nhật
    return wdFmt.format(ref);
  });

  const grid = () => {
    if (!open()) return null;
    const [y, m] = view().split("-").map(Number);
    const startPad = (dow({ y, m, d: 1 }) - first + 7) % 7;
    const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
    refs.clear();
    const cells = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= count; d++) cells.push({ y, m, d });
    while (cells.length % 7) cells.push(null);
    const rows = [];
    for (let r = 0; r < cells.length; r += 7) rows.push(cells.slice(r, r + 7));
    return h(
      "div",
      { class: "dp-pop", role: "dialog", "aria-label": label != null ? String(read(label)) : "Chọn ngày", id: gridId },
      h("div", { class: "dp-head" },
        h("button", { type: "button", class: "btn ghost sm", "aria-label": "Tháng trước", onclick: () => moveTo(addMonths(parseDate(cursor.peek()), -1)) }, "‹"),
        h("strong", { "aria-live": "polite" }, monthFmt.format(new Date(Date.UTC(y, m - 1, 1)))),
        h("button", { type: "button", class: "btn ghost sm", "aria-label": "Tháng sau", onclick: () => moveTo(addMonths(parseDate(cursor.peek()), 1)) }, "›")
      ),
      h("table", { class: "dp-grid", role: "grid", onkeydown: onGridKey },
        h("thead", null, h("tr", null, ...weekdays.map((w) => h("th", { scope: "col", abbr: w }, w)))),
        h("tbody", null, ...rows.map((row) =>
          h("tr", null, ...row.map((p) => {
            if (!p) return h("td", { class: "dp-empty" });
            const iso = toIso(p);
            const ok = allowed(p);
            return h("td", null,
              h("button", {
                type: "button",
                class: () => "dp-day" + (value() === iso ? " selected" : "") + (cmp(p, today()) === 0 ? " today" : ""),
                tabindex: () => (cursor() === iso ? "0" : "-1"),
                "aria-label": longFmt.format(new Date(Date.UTC(p.y, p.m - 1, p.d))),
                "aria-pressed": () => String(value() === iso),
                disabled: !ok,
                ref: (el) => refs.set(iso, el),
                onclick: () => pickDay(p),
              }, String(p.d)));
          }))
        ))
      )
    );
  };
  const clear = () =>
    clearable
      ? () => (selected() ? h("button", { type: "button", class: "dp-clear", "aria-label": "Xóa ngày đã chọn", onclick: () => (value.set(""), input?.focus?.()) }, "×") : null)
      : null;
  root = h("div", { class: "dp" }, input, clear(), grid);
  return field(fid, { label, hint, error }, root);
}
