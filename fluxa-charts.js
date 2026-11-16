/*! Fluxa charts 0.10.0 — LineChart, BarChart, DonutChart bằng SVG thuần, không phụ thuộc, truy cập được, an toàn theo mặc định. MIT License. */
import { h, svgTags } from "./fluxa.js";
import { cx } from "./fluxa-components.js";

const { svg, g, line, path, circle, rect, text, title: svgTitle } = svgTags;
const read = (v) => (typeof v === "function" ? v() : v);
const MAX_POINTS = 1000; // giới hạn để dữ liệu quá lớn không làm treo trang
const r2 = (n) => String(Math.round(n * 100) / 100);
const num = (v) => (Number.isFinite(Number(v)) && v !== null && v !== "" ? Number(v) : 0);

/** Chuẩn hóa mọi dạng dữ liệu về { labels, series: [{name, values}] } với số hợp lệ. */
function normalize({ data, labels, series }) {
  const d = read(data);
  if (Array.isArray(d)) {
    const rows = d.slice(0, MAX_POINTS);
    return { labels: rows.map((r) => String(r && r.label != null ? r.label : "")), series: [{ name: "", values: rows.map((r) => num(r && r.value)) }] };
  }
  const ls = (read(labels) || []).slice(0, MAX_POINTS).map(String);
  const ss = (read(series) || []).slice(0, 12).map((s) => ({ name: String((s && s.name) ?? ""), values: ls.map((_, i) => num(s && s.values && s.values[i])) }));
  return { labels: ls, series: ss };
}

/** Bước chia trục "đẹp" (1, 2, 2.5, 5 × 10^n) để tick tròn số. */
export function niceScale(min, max, ticks = 4) {
  if (!(max > min)) max = min + 1;
  const raw = (max - min) / ticks;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const frac = raw / pow;
  const step = (frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 2.5 ? 2.5 : frac <= 5 ? 5 : 10) * pow;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const out = [];
  for (let v = lo; v <= hi + step / 2 && out.length < 50; v += step) out.push(Math.round(v / step) * step);
  return { lo, hi, ticks: out };
}

const makeFormat = (locale, format) => {
  if (typeof format === "function") return format;
  let nf;
  try {
    nf = new Intl.NumberFormat(String(locale), { maximumFractionDigits: 2 });
  } catch {
    nf = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });
  }
  return (v) => nf.format(v);
};

// Bảng dữ liệu ẩn cho trình đọc màn hình: biểu đồ không bao giờ chỉ dựa vào màu hoặc hình
function dataTable(caption, labels, series, fmt, withName) {
  return h("table", { class: "sr-only" },
    h("caption", null, caption),
    h("thead", null, h("tr", null, h("th", { scope: "col" }, ""), ...series.map((s, i) => h("th", { scope: "col" }, s.name || `Chuỗi ${i + 1}`)))),
    h("tbody", null, ...labels.map((l, i) => h("tr", null, h("th", { scope: "row" }, l), ...series.map((s) => h("td", null, fmt(s.values[i])))))))
  ;
}

const frame = (klass, titleText, summary, chart, table, legend) =>
  h("figure", { class: cx("chart", klass) }, chart, titleText ? h("figcaption", null, titleText) : null, legend || null, table);

// ═══════════════════════════ Trục + lưới dùng chung cho Line/Bar ═══════════════════════════

const W = 640, H = 320, M = { l: 56, r: 16, t: 16, b: 36 };

function axes(labels, all, fmt) {
  const min = Math.min(0, ...all), max = Math.max(0, ...all);
  const sc = niceScale(min, max);
  const iw = W - M.l - M.r, ih = H - M.t - M.b;
  const y = (v) => M.t + ih - ((v - sc.lo) / (sc.hi - sc.lo || 1)) * ih;
  const stride = Math.max(1, Math.ceil(labels.length / 10));
  const grid = sc.ticks.map((t) =>
    g(null,
      line({ class: t === 0 ? "chart-axis" : "chart-grid", x1: M.l, x2: W - M.r, y1: r2(y(t)), y2: r2(y(t)) }),
      text({ class: "chart-tick", x: M.l - 8, y: r2(y(t) + 4), "text-anchor": "end" }, fmt(t))));
  return { y, iw, ih, stride, grid, sc };
}

const chartProps = (props) => {
  const { data, labels, series, title, locale = "vi-VN", format, class: klass, label, ...rest } = props;
  return { data, labels, series, title, klass, rest, fmt: makeFormat(locale, format), label };
};

const describe = (title, labels, series) => `${title ? title + ". " : ""}${series.length} chuỗi, ${labels.length} mục${labels.length ? `, từ ${labels[0]} đến ${labels[labels.length - 1]}` : ""}.`;

// ═══════════════════════════ LineChart ═══════════════════════════

/**
 * Biểu đồ đường. Hai cách đưa dữ liệu: data = [{label, value}] (một đường), hoặc labels = [...] + series = [{name, values: [...]}].
 * data/labels/series có thể là hàm hoặc signal (biểu đồ tự vẽ lại). Có bảng dữ liệu ẩn cho trình đọc màn hình.
 * Mọi nhãn là chữ thuần; số không hợp lệ thành 0; tối đa 1000 điểm và 12 đường.
 */
export function LineChart(props) {
  const { data, labels, series, title, klass, rest, fmt, label } = chartProps(props);
  return h("div", { ...rest, class: "chart-host" }, () => {
    const d = normalize({ data, labels, series });
    const all = d.series.flatMap((s) => s.values);
    const a = axes(d.labels, all, fmt);
    const n = d.labels.length;
    const x = (i) => M.l + (n <= 1 ? a.iw / 2 : (i / (n - 1)) * a.iw);
    const summary = describe(title, d.labels, d.series);
    const chart = svg({ class: "chart-svg", viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": label != null ? String(label) : summary, preserveAspectRatio: "xMidYMid meet" },
      ...a.grid,
      ...d.labels.map((l, i) => (i % a.stride ? null : text({ class: "chart-tick", x: r2(x(i)), y: H - 12, "text-anchor": "middle" }, l))),
      ...d.series.map((s, k) =>
        g({ class: `chart-series chart-c${k % 6}` },
          path({ class: "chart-line", d: s.values.map((v, i) => `${i ? "L" : "M"}${r2(x(i))} ${r2(a.y(v))}`).join(" ") || "M0 0", fill: "none" }),
          ...s.values.map((v, i) => circle({ class: "chart-dot", cx: r2(x(i)), cy: r2(a.y(v)), r: 3.5 }, svgTitle(`${d.labels[i]}: ${fmt(v)}${s.name ? " (" + s.name + ")" : ""}`))))));
    return frame("chart-line-wrap", title, summary, chart, dataTable(summary, d.labels, d.series, fmt), legendFor(d.series));
  });
}

// ═══════════════════════════ BarChart ═══════════════════════════

/** Biểu đồ cột. Cùng cách đưa dữ liệu với LineChart; nhiều chuỗi thì cột xếp nhóm cạnh nhau. */
export function BarChart(props) {
  const { data, labels, series, title, klass, rest, fmt, label } = chartProps(props);
  return h("div", { ...rest, class: "chart-host" }, () => {
    const d = normalize({ data, labels, series });
    const all = d.series.flatMap((s) => s.values);
    const a = axes(d.labels, all, fmt);
    const n = Math.max(1, d.labels.length), k = Math.max(1, d.series.length);
    const slot = a.iw / n, bw = Math.max(2, Math.min(48, (slot * 0.7) / k));
    const zero = a.y(0);
    const summary = describe(title, d.labels, d.series);
    const chart = svg({ class: "chart-svg", viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": label != null ? String(label) : summary, preserveAspectRatio: "xMidYMid meet" },
      ...a.grid,
      ...d.labels.map((l, i) => (i % a.stride ? null : text({ class: "chart-tick", x: r2(M.l + slot * (i + 0.5)), y: H - 12, "text-anchor": "middle" }, l))),
      ...d.series.map((s, si) =>
        g({ class: `chart-series chart-c${si % 6}` },
          ...s.values.map((v, i) => {
            const top = a.y(v);
            const x0 = M.l + slot * (i + 0.5) - (bw * k) / 2 + bw * si;
            return rect({ class: "chart-bar", x: r2(x0), y: r2(Math.min(top, zero)), width: r2(bw), height: r2(Math.abs(zero - top)), rx: 2 }, svgTitle(`${d.labels[i]}: ${fmt(v)}${s.name ? " (" + s.name + ")" : ""}`));
          }))));
    return frame("chart-bar-wrap", title, summary, chart, dataTable(summary, d.labels, d.series, fmt), legendFor(d.series));
  });
}

// ═══════════════════════════ DonutChart ═══════════════════════════

/**
 * Biểu đồ tròn khuyết. data = [{label, value}] (giá trị âm hoặc không hợp lệ coi là 0). Chú giải liệt kê tên, giá trị và phần trăm
 * nên thông tin không phụ thuộc vào màu. centerLabel: chữ ở giữa (mặc định là tổng).
 */
export function DonutChart(props) {
  const { data, title, klass, rest, fmt, label } = chartProps(props);
  const { centerLabel } = props;
  return h("div", { ...rest, class: "chart-host" }, () => {
    const nd = normalize({ data });
    const rows = nd.labels.map((l, i) => ({ label: l, value: Math.max(0, nd.series[0].values[i]) }));
    const total = rows.reduce((s, r) => s + r.value, 0);
    let acc = 0;
    const segs = rows.map((r, i) => {
      const pct = total > 0 ? (r.value / total) * 100 : 0;
      const el = circle({ class: `chart-seg chart-c${i % 6}`, cx: 21, cy: 21, r: 15.9155, fill: "none", "stroke-width": 6, "stroke-dasharray": `${r2(pct)} ${r2(100 - pct)}`, "stroke-dashoffset": r2(25 - acc) }, svgTitle(`${r.label}: ${fmt(r.value)} (${r2(pct)}%)`));
      acc += pct;
      return { el, pct, r };
    });
    const summary = `${title ? title + ". " : ""}${rows.length} phần, tổng ${fmt(total)}.`;
    const chart = svg({ class: "chart-svg chart-donut", viewBox: "0 0 42 42", role: "img", "aria-label": label != null ? String(label) : summary },
      circle({ class: "chart-track", cx: 21, cy: 21, r: 15.9155, fill: "none", "stroke-width": 6 }),
      ...segs.map((s) => s.el),
      text({ class: "chart-center", x: 21, y: 22.5, "text-anchor": "middle" }, centerLabel != null ? String(read(centerLabel)) : fmt(total)));
    const legend = h("ul", { class: "chart-legend" }, ...segs.map((s, i) =>
      h("li", null, h("span", { class: `chart-key chart-c${i % 6}`, "aria-hidden": "true" }), h("span", { class: "chart-name" }, s.r.label), h("span", { class: "muted" }, `${fmt(s.r.value)} · ${r2(s.pct)}%`))));
    const table = dataTable(summary, rows.map((r) => r.label), [{ name: "Giá trị", values: rows.map((r) => r.value) }], fmt);
    return frame("chart-donut-wrap", title, summary, chart, table, legend);
  });
}

function legendFor(series) {
  const named = series.filter((s) => s.name);
  return named.length > 1
    ? h("ul", { class: "chart-legend" }, ...series.map((s, i) => h("li", null, h("span", { class: `chart-key chart-c${i % 6}`, "aria-hidden": "true" }), h("span", { class: "chart-name" }, s.name))))
    : null;
}
