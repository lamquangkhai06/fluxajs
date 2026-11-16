# Fluxa cho AI (dán file này cho trợ lý AI trước khi nhờ viết code)

> You are writing code for **Fluxa**, a small signals-based UI library (no virtual DOM, no build step needed, secure by default). Components run **once**. Anything that must update is a **function** or a **signal**. Use only the API below; do not invent React/Vue APIs (`useState`, `v-if`, `v-for`, `{cond && <X/>}` do not exist).

## Cách dùng không cần cài đặt

```html
<link rel="stylesheet" href="fluxa.css">
<div id="app"></div>
<script src="dist/fluxa.global.js"></script>   <!-- tạo biến toàn cục Fluxa; chạy cả khi mở file:// -->
<script>
  const { signal, computed, tags, list, show, choose, model, resource, createStore, mount, h } = Fluxa;
  const { div, h1, p, span, button, input, ul, li, label } = tags;
  mount("#app", () => div(h1("Xin chào")));
</script>
```

Dùng npm/Vite thì `import { signal, tags, mount } from "fluxa-ui"`.

## Quy tắc vàng

1. **Hằng số thì viết thẳng, thứ thay đổi thì bọc trong hàm.** `p("Tổng: " + n())` chỉ chạy MỘT lần và **không bao giờ cập nhật**. Viết `p(() => "Tổng: " + n())`, hoặc truyền thẳng signal `p(n)`.
2. **Signal**: đọc `n()`, ghi `n.set(5)` hoặc `n.set((x) => x + 1)`. Không có `useState`.
3. **Không sửa mảng/object tại chỗ.** `list().push(x)` không cập nhật gì. Dùng `list.set((a) => [...a, x])`.
4. **Sự kiện là hàm**: `onclick: () => ...` (viết `onClick` cũng được). Chuỗi như `onclick: "..."` bị chặn.
5. **Không có HTML thô.** Mọi chuỗi đều là chữ thuần nên an toàn. Đừng tìm `innerHTML` hay `dangerouslySetInnerHTML`.
6. Thẻ HTML là hàm: `div({ class: "card" }, "chữ", span("con"))`. Tham số đầu là object thuộc tính (có thể bỏ), phần còn lại là nội dung con.

## Ví dụ chạy được (mỗi khối dưới đây đều được kiểm tra tự động)

### Bộ đếm: signal và computed

```js run
const { signal, computed, tags, mount } = Fluxa;
const { div, p, button } = tags;
function App() {
  const n = signal(0);
  const double = computed(() => n() * 2);
  return div(
    button({ onclick: () => n.set((x) => x + 1) }, "+1"),
    p(n),                                  // in thẳng signal
    p(() => "gấp đôi: " + double()),       // biểu thức phải bọc trong hàm
  );
}
```

### Form: ràng buộc hai chiều, class có điều kiện, hiện/ẩn

```js run
const { signal, tags, show } = Fluxa;
const { div, p, input, button } = tags;
function App() {
  const name = signal("");
  return div(
    input({ value: name, placeholder: "Tên bạn" }),   // truyền signal vào value là hai chiều, KHÔNG cần oninput
    p({ class: { warn: () => name().length > 10 } }, () => "Xin chào " + (name() || "bạn")),
    show(() => name().length > 10, () => p("Tên dài quá!")),   // show(điều kiện, hiện-khi-đúng, hiện-khi-sai)
  );
}
```

### Danh sách: list thay cho vòng lặp, createStore + model cho từng mục

```js run
const { signal, tags, list, show, model, createStore } = Fluxa;
const { div, ul, li, input, label, button, p } = tags;
function App() {
  const mk = (text) => createStore({ text, done: false });
  const items = signal([mk("Học Fluxa")]);
  const text = signal("");
  const add = () => { if (text().trim()) { items.set((a) => [...a, mk(text().trim())]); text.set(""); } };
  return div(
    input({ value: text, onkeydown: (e) => e.key === "Enter" && add() }),
    button({ onclick: add }, "Thêm"),
    show(() => !items().length, () => p("Chưa có việc nào")),
    ul(list(items, (t) =>                              // list(mảng-hoặc-signal, cách-vẽ-một-mục)
      li({ class: { done: () => t.done } },
        input({ type: "checkbox", checked: model(t, "done") }),
        label(t.text),
        button({ onclick: () => items.set((a) => a.filter((x) => x !== t)) }, "Xóa"),
      ))),
  );
}
```

### Tải dữ liệu: resource và choose

```js run
const { tags, resource, choose } = Fluxa;
const { div, p, button } = tags;
function App() {
  // fetcher trả về Promise; ví dụ thật: fetch("/api/user").then((r) => r.json())
  const user = resource(() => new Promise((ok) => setTimeout(() => ok({ name: "Lan" }), 10)));
  return div(
    p(choose(user.state, {                    // state() là "loading" | "error" | "ready"
      loading: "Đang tải…",
      error: "Lỗi tải dữ liệu",
      ready: () => "Xin chào " + user.data().name,
    })),
    button({ onclick: user.refetch }, "Tải lại"),
  );
}
```

### Component có tham số và nội dung con

```js run
const { tags, h } = Fluxa;
const { div, h2, p } = tags;
const Card = ({ title, children }) => div({ class: "card" }, h2(title), ...children);
function App() {
  return div(
    h(Card, { title: "Thẻ 1" }, p("Nội dung A")),    // component gọi bằng h(Hàm, thuộc tính, ...con)
    h(Card, { title: "Thẻ 2" }, p("Nội dung B")),
  );
}
```

### Lưu, hoàn tác (fluxa-extras, đã có trong bản một file)

```js run
const { signal, tags, persist, history, mount } = Fluxa;
const { div, p, button } = tags;
function App() {
  // persist: tự lưu vào localStorage, tải lại trang vẫn còn
  const n = persist(signal(0), "ai-md-demo");
  const hs = history(n); // hoàn tác / làm lại
  return div(
    p("Đếm: ", n),
    button({ onclick: () => n.set((v) => v + 1) }, "+"),
    button({ onclick: hs.undo, disabled: () => !hs.canUndo() }, "Hoàn tác"),
  );
}
```

Muốn ô tìm kiếm không lọc sau mỗi phím gõ: `const slow = debounced(query, 300)` rồi dùng `slow()` trong `computed`.

### Nhiều trang: router (chế độ hash chạy được với mọi máy chủ tĩnh và cả file://)

```js run
const { tags } = Fluxa;
const { div, p, nav, main } = tags;
const { createRouter } = Fluxa;
function App() {
  const router = createRouter({
    "/": () => p("Trang chủ"),
    "/user/:id": ({ params }) => p("Người dùng " + params.id),
    "*": () => p("Không tìm thấy"),
  }, { mode: "hash" });
  return div(
    nav(router.link({ href: "/" }, "Trang chủ"), router.link({ href: "/user/7" }, "Người dùng 7")),
    main(router.view),                       // router.view phải nằm trong một phần tử
  );
}
```

### Form, nhập liệu nâng cao và biểu đồ (0.10)

```js run
const { signal, tags, h, Switch, Rating, Combobox, DatePicker, LineChart } = Fluxa;
const { div, p } = tags;
function App() {
  const on = signal(true), stars = signal(4), fruit = signal(""), day = signal("");
  return div(
    h(Switch, { checked: on, label: "Nhận thông báo" }),
    h(Rating, { value: stars }),                                   // value phải là signal
    h(Combobox, { label: "Trái cây", value: fruit, options: ["Cam", "Dưa hấu", "Đào"] }),
    h(DatePicker, { label: "Ngày giao", value: day }),             // giá trị dạng "YYYY-MM-DD"
    h(LineChart, { title: "Doanh thu", data: [{ label: "T1", value: 3 }, { label: "T2", value: 7 }] }),
    p(() => `sao=${stars()}`),
  );
}
```

Component form (`Textarea, RadioGroup, Slider, Rating, Combobox, DatePicker`) đều nhận **signal** cho `value`. Biểu đồ nhận `data=[{label,value}]` hoặc `labels`+`series`. `FileInput` chỉ kiểm tra phía client, server phải kiểm tra lại.

## Lỗi hay gặp (do thói quen React/Vue) và cách sửa

| Viết sai | Vì sao | Viết đúng |
|---|---|---|
| `p("Tổng: " + n())` | chạy một lần, không cập nhật | `p(() => "Tổng: " + n())` |
| `n.value` | kiểu Vue; vẫn chạy nhưng báo cảnh báo một lần | `n()` để đọc, `n.set(x)` để ghi |
| `items().push(x)` | không báo cho ai biết | `items.set((a) => [...a, x])` |
| `cond ? a : b` trong nội dung | tính một lần | `show(() => cond(), a, b)` hoặc `() => (cond() ? a : b)` |
| `items().map(...)` trong nội dung | dựng lại cả danh sách mỗi lần | `list(items, (item) => ...)` |
| `oninput: e => s.set(e.target.value)` | thừa | `input({ value: s })` |
| `onclick: "doIt()"` | chuỗi bị chặn vì bảo mật | `onclick: () => doIt()` |
| `style: "color:red"` với dữ liệu người dùng | dễ lọt URL độc | `style: { color: "red" }` |
| `useState`, `useEffect`, `v-if`, `v-for`, `{x && <Y/>}` | không tồn tại | `signal`, `effect`, `show`, `list`, `show` |

## Tra cứu nhanh

`signal(v)` · `computed(fn)` · `effect(fn)` · `watch(src, cb)` · `untrack(fn)` · `createStore(obj)` · `model(store, "khóa")` · `resource(fetcher)` → `.data() .loading() .error() .state() .refetch()` · `show(cond, đúng, sai?)` · `choose(giáTrị, { khóa: nộiDung }, mặcĐịnh?)` · `list(mảng, render)` · `tags.div(...)` · `h(Component, props, ...con)` · `mount(selector, App)` · `onMounted(fn)` (trả về hàm dọn dẹp) · `onUnmounted(fn)` · `emit(props, "tênSựKiện", giáTrị)`.

Bộ UI có sẵn (kèm `fluxa.css`): `Button, Input, Select, Checkbox, Card, Badge, Alert, Modal, Tabs, createToaster, Textarea, RadioGroup, Switch, Slider, Rating, Accordion, Breadcrumb, Drawer, Stepper, Popover, Combobox, FileInput, DatePicker, LineChart, BarChart, DonutChart`, gọi bằng `h(Button, { variant: "danger" }, "Xóa")`. Xem `README.md` để biết thuộc tính.

## Mẫu câu lệnh để dán cùng file này

> Dựa vào tài liệu Fluxa ở trên, hãy viết cho tôi **một file index.html duy nhất** (dùng `dist/fluxa.global.js` và `fluxa.css`) cho ứng dụng sau: … Chỉ dùng API Fluxa trong tài liệu; nhớ bọc mọi biểu thức thay đổi trong hàm `() => …`.
