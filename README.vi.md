<p align="center"><img src="brand/fluxa-logo.svg" alt="Fluxa" width="320"></p>

<p align="center"><a href="README.md">English</a> | <b>Tiếng Việt</b></p>

# Fluxa.js

Framework UI siêu nhẹ dựa trên **signals**: không virtual DOM, không phụ thuộc, không bắt buộc bước build, **an toàn theo mặc định**. Đi kèm router, store, JSX, bộ UI component và Vite plugin.

Bản một file `dist/fluxa.global.js` (lõi + router + extras + bộ UI, đã nén): **58,8 KB, khoảng 21,3 KB gzip** (đo khi build 0.10.0; bản gọn `dist/fluxa.lite.global.js` không có nhập liệu và biểu đồ: 42,7 KB / 15,8 KB gzip). `fluxa.css` khoảng 13 KB chưa nén. Các module cũng dùng được riêng lẻ: `fluxa.js`, `fluxa-router.js`, `fluxa-extras.js`, `fluxa-components.js`, `fluxa-inputs.js`, `fluxa-charts.js`, `jsx-runtime.js`.

Mình chưa đo benchmark tốc độ so với React/Vue. "Nhanh" ở đây là do thiết kế (cập nhật đúng node cần đổi, không diff cả cây), chưa phải con số đã kiểm chứng.

## Bắt đầu trong 1 phút (không cần cài gì)

1. Chép `starter.html`, `fluxa.css` và thư mục `dist/` vào cùng một thư mục.
2. **Bấm đúp `starter.html`.** Chạy luôn, không cần Node, Vite, npm hay máy chủ (đã thử bằng `file://` trên Chromium).
3. Sửa code trong thẻ `<script>` rồi tải lại trang.

`dist/fluxa.global.js` là **cả framework (lõi, router, extras, bộ UI) trong một file, khoảng 21 KB gzip**, tạo biến toàn cục `Fluxa`. Cần ES module thì dùng `dist/fluxa.bundle.js`. Tự đóng gói lại: `npm i -D esbuild && npm run build`.

> Lưu ý: `starter.html` dùng thẻ `<script>` viết thẳng trong trang cho đơn giản. Khi làm sản phẩm thật với CSP nghiêm ngặt (xem `index.html`), hãy tách mã ra file `.js` riêng.

## Vibe coding: nhờ AI viết app Fluxa

Fluxa nhỏ và nhất quán nên AI học được gần hết trong một lần đọc. Cách làm:

1. Dán nội dung [`AI.md`](AI.md) cho trợ lý AI (Claude, ChatGPT...).
2. Mô tả ứng dụng bạn muốn, ví dụ: *"viết một file index.html duy nhất quản lý chi tiêu, dùng Fluxa như tài liệu trên"*.
3. Lưu kết quả cạnh `dist/` và `fluxa.css`, bấm đúp để chạy.

Vì sao hợp với cách làm này:
- **Một lối viết cho mỗi việc** (`signal`, `show`, `choose`, `list`, `model`, `resource`), ít chỗ để AI "chế" API.
- **Mọi ví dụ trong `AI.md` đều được chạy thật** trong bộ test (`test-ai.js`), nên AI học theo ví dụ đúng.
- **Lỗi hay gặp được ghi sẵn** (viết `p("Tổng: " + n())` thay vì `p(() => ...)`, sửa mảng tại chỗ...). Thói quen Vue `n.value` vẫn chạy và báo một lần cách viết chuẩn, thay vì im lặng hỏng.
- **An toàn dù AI viết sai:** chuỗi HTML từ người dùng luôn là chữ thuần, URL `javascript:` và `onclick="..."` dạng chuỗi bị chặn.

Điều chưa kiểm chứng: mình chưa đo AI nào sinh code Fluxa đúng bao nhiêu phần trăm. `AI.md` được thiết kế để giúp, không phải bảo đảm. Hãy thử và báo lại những chỗ AI hay sai để bổ sung vào mục "Lỗi hay gặp".

## Chạy thử (dành cho lập trình viên)

Module ES cần chạy qua HTTP (không mở trực tiếp bằng `file://`). Chọn một cách:

```bash
npx serve .                      # cần Node.js
python -m http.server 8000       # cần Python (Windows thường là `python`, không phải `python3`)
```

Hoặc dùng extension **Live Server** của VS Code (chuột phải `index.html` → Open with Live Server). Demo dùng router chế độ `hash` nên chạy được với mọi server tĩnh. Live Server chèn script nội tuyến nên CSP trong `index.html` có thể chặn tính năng tự reload; trang vẫn chạy bình thường.

Kiểm thử:

```bash
npm test          # test đơn vị: lõi, router, store, JSX, Vite plugin, UI, extras (DOM giả lập trong Node)
                  # cài thêm `npm i -D typescript esbuild` để chạy cả 5 test biên dịch JSX thật; thiếu thì các test đó tự bỏ qua
npm run test:e2e  # 57 kiểm tra trên Chromium thật (cần: npm i -D playwright && npx playwright install chromium)
```

## Bắt đầu nhanh

```js
import { signal, computed, tags, mount } from "./fluxa.js";
const { div, button, span } = tags;

const count = signal(0);
const double = computed(() => count() * 2);

mount("#app", () =>
  div(
    button({ onclick: () => count.set((c) => c + 1) }, "+"),
    span(count),                        // truyền signal: tự cập nhật
    span(() => `gấp đôi: ${double()}`)  // truyền hàm: nội dung phản ứng
  )
);
```

Quy tắc cốt lõi: **component chỉ chạy một lần**. Prop hoặc con là một **hàm** thì nó phản ứng; `onXxx` là sự kiện (phải là hàm).

## API lõi (`fluxa.js`)

| API | Ý nghĩa |
|---|---|
| `signal(v)` | Giá trị phản ứng. `s()` đọc, `s.set(v \| fn)` ghi, `s.peek()` đọc không theo dõi |
| `computed(fn)` | Giá trị suy ra, lười tính và luôn mới |
| `effect(fn)` | Chạy lại khi signal đọc bên trong đổi; `fn` có thể trả về hàm dọn dẹp |
| `watch(source, cb, {immediate})` | Gọi `cb(mới, cũ)` khi `source()` đổi |
| `untrack(fn)` / `onCleanup(fn)` / `createRoot(fn)` | Không theo dõi / dọn dẹp / phạm vi riêng |
| `onMounted(fn)` | Chạy sau khi component được gắn; `fn` có thể trả về hàm dọn dẹp |
| `onUnmounted(fn)` | Chạy khi component bị gỡ |
| `onUpdated(fn)` | Chạy sau khi phần giao diện phản ứng của chính component này cập nhật |
| `unmountAll()` | Gỡ mọi ứng dụng đã mount và dọn router (Vite plugin tự gọi khi HMR) |
| `emit(props, "change", v)` | Bắn sự kiện lên cha: gọi `props.onChange(v)` |
| `createStore(obj)` | Store toàn cục, phản ứng theo từng khóa |
| `model(store, "khóa")` | Ràng buộc hai chiều một trường của store: `input({ checked: model(t, "done") })` |
| `resource(fetcher)` | Dữ liệu bất đồng bộ: `.data()` `.loading()` `.error()` `.state()` `.refetch()` |
| `show(điều kiện, nhánh đúng, nhánh sai)` | Hiện nội dung theo điều kiện, khỏi viết `? :` |
| `choose(giá trị, { khóa: nội dung }, mặc định)` | Chọn nội dung theo giá trị, khỏi viết `if / else if / switch` |
| `tags` / `svgTags` | `div({class:"a"}, "xin chào")`; `svgTags` cho SVG |
| `h(tag, props, ...kids)` / `Fragment` | Dạng dài; `tag` là hàm thì là component |
| `list(items, render)` | Danh sách có key |
| `mount(root, view)` | Gắn ứng dụng; trả về hàm gỡ |
| `onError(fn)` | Nhận mọi lỗi và cảnh báo bảo mật của framework |
| `safeUrl(v)` / `unsafeHTML(html, sanitize)` | Lọc URL / chèn HTML thô (bắt buộc có hàm làm sạch) |

### Vòng đời

```js
function Clock() {
  const now = signal(new Date());
  onMounted(() => {
    const t = setInterval(() => now.set(new Date()), 1000);
    return () => clearInterval(t);          // chạy khi component bị gỡ
  });
  return span(() => now().toLocaleTimeString());
}
```

`onUpdated` khác với React/Vue: component **không render lại**, nên nó chạy sau khi các phần phản ứng *bên trong* component (nội dung động, thuộc tính động, `effect`, `watch`) cập nhật xong, và chỉ một lần cho mỗi lô thay đổi. Nó không chạy ở lần dựng đầu (dùng `onMounted`), và không chạy khi chỉ component con thay đổi.

```js
function Chat() {
  const messages = signal([]);
  const box = div({ class: "chat" }, list(messages, (m) => p(m)));
  onUpdated(() => { box.scrollTop = box.scrollHeight; }); // cuộn xuống đáy sau khi có tin mới
  return box;
}
```

Muốn theo dõi riêng một giá trị (kèm giá trị cũ) thì dùng `watch(source, cb)`.

### Sự kiện từ con lên cha

```js
function Rating(props) {
  return button({ onclick: () => emit(props, "change", 5) }, "5 sao");
}
h(Rating, { onChange: (v) => console.log(v) });
```

## Viết ít hơn: những lối tắt

Fluxa cố giữ cách viết ngắn nhất cũng là cách đúng nhất. Tất cả đều **cộng thêm**, code cũ vẫn chạy.

**1. Truyền signal vào `value` / `checked` là xong ràng buộc hai chiều** (không cần `oninput`):

```js
const name = signal("");
input({ value: name });                       // gõ → name đổi; name.set(...) → ô nhập đổi
input({ type: "checkbox", checked: done });
```

**2. `class` nhận object hoặc mảng**, giá trị là hàm thì phản ứng:

```js
li({ class: { done: () => t.done, hot: isHot } }, t.text);
div({ class: ["card", () => open() && "open"] });
```

**3. `model(store, khóa)`** nối một trường của store với ô nhập, không cần signal riêng:

```js
const t = createStore({ text: "Học Fluxa", done: false });
input({ type: "checkbox", checked: model(t, "done") });
```

**4. `resource(fetcher)`** gom `loading` / `error` / `data` và xử lý các lỗi hay gặp: hủy yêu cầu cũ khi đổi tham số, bỏ qua phản hồi đến muộn, tự dọn khi rời trang:

```js
const user = resource((signal) => fetch(`/api/users/${id()}`, { signal }).then((r) => r.json()));
p(() => (user.loading() ? "Đang tải…" : user.error() ? "Lỗi" : user.data().name));
```

**5. `show(điều kiện, đúng, sai)`** thay cho `? :` và `if`. Nhánh viết dạng hàm thì chỉ được dựng khi cần, và chỉ dựng lại khi kết quả đúng/sai đổi (không dựng lại mỗi lần dữ liệu bên trong đổi):

```js
show(() => !items().length, () => p("Chưa có việc nào"));
show(loggedIn, () => p("Chào bạn!"), () => p("Hãy đăng nhập"));
```

**6. `choose(giá trị, { khóa: nội dung }, mặc định)`** thay cho chuỗi `if / else if` hay `switch`. Kết hợp với `resource(...).state()` để xử lý đủ ba trạng thái mà không cần điều kiện lồng nhau:

```js
p(choose(user.state, {
  loading: "Đang tải…",
  error: "Lỗi tải dữ liệu",
  ready: () => `Xin chào, ${user.data().name}`,
}));
```

Cùng với `list(...)` (thay vòng lặp) và `computed(...)` (thay mảng phụ thuộc), người mới chưa quen vòng lặp, đệ quy hay điều kiện lồng nhau vẫn dựng được giao diện bằng cách **khai báo** "cái gì hiện khi nào", không phải tự viết thuật toán.

Lưu ý: `resource` chỉ chạy lại khi một signal được đọc **đồng bộ** trong `fetcher` (trước `await` đầu tiên) đổi. Dùng `user.refetch()` để tải lại bằng tay.

### So sánh

Trang demo "Việc cần làm" viết lại bằng các lối tắt trên: `Todo()` từ **44 xuống 35 dòng**, và không còn `oninput` nào. Đó là số đo thật trên mã trong repo này. Dưới đây là một **ví dụ minh họa** (không phải benchmark) cho cùng một việc, "ô nhập có hai chiều + tải dữ liệu":

| | Fluxa | React (hooks) |
|---|---|---|
| Ô nhập hai chiều | `input({ value: name })` | `const [name, setName] = useState(""); <input value={name} onChange={e => setName(e.target.value)} />` |
| Tải dữ liệu, hủy khi đổi tham số | `resource(...)` | `useEffect` + `AbortController` + cờ bỏ qua phản hồi cũ, hoặc thư viện ngoài (TanStack Query, SWR) |
| Giá trị suy ra | `computed(() => a() * 2)` | `useMemo(() => a * 2, [a])` (phải tự khai báo mảng phụ thuộc) |

Vue có `v-model` và `computed` cũng ngắn tương tự; điểm Fluxa khác là không cần bước biên dịch template. Cách viết chuẩn của Fluxa là `s()` để đọc và `s.set(x)` để ghi (thống nhất với `computed` và hàm phản ứng). `.value` kiểu Vue vẫn chạy nhưng báo cảnh báo một lần, vì code do AI sinh ra hay viết kiểu đó. Ngắn hơn không có nghĩa là hơn toàn diện: React/Vue có hệ sinh thái, devtools, SSR và cộng đồng mà Fluxa chưa có.

### Store dùng chung

```js
const app = createStore({ user: null, clicks: 0 });

// ở component A
button({ onclick: () => app.clicks++ }, "Bấm");
// ở component B (không quan hệ với A)
span(() => `Đã bấm: ${app.clicks}`);
```

Store phản ứng ở mức **nông**: hãy gán giá trị mới (`app.user = { ...app.user, name: "B" }`) thay vì sửa tại chỗ bên trong object lồng nhau.

### Danh sách có key

```js
const items = signal([{ id: 1, text: "A" }, { id: 2, text: "B" }]);
ul(list(items, (item, index) => li(item.text, " #", () => index())));
```

Khóa chính là **định danh phần tử**: phần tử còn nguyên thì giữ nguyên DOM, chỉ tạo mới / gỡ / sắp xếp lại đúng chỗ cần. Hãy cập nhật dữ liệu **bất biến**:

```js
items.set((a) => a.map((t) => (t.id === 2 ? { ...t, text: "B2" } : t))); // chỉ mục B được dựng lại
```

## Router (`fluxa-router.js`)

```js
import { createRouter } from "./fluxa-router.js";

const router = createRouter(
  {
    "/": Home,
    "/user/:id": ({ params, query }) => div("Người dùng ", params.id, " ", () => query().tab),
    "*": NotFound,
  },
  { mode: "hash" } // hoặc "history" (mặc định), { base: "/app" }, { beforeEach }
);

mount("#app", () => div(
  router.link({ href: "/" }, "Trang chủ"),
  router.link({ href: "/user/42?tab=info" }, "Người dùng"),
  div(router.view),            // đổi trang chỉ dựng lại phần này
));
router.navigate("/user/7");
```

- Route cụ thể được ưu tiên: `/user/new` trước `/user/:id`, wildcard `*` sau cùng.
- `mode: "history"` cần server trả về `index.html` cho mọi đường dẫn (ví dụ `npx serve -s`). `mode: "hash"` thì không cần.
- `beforeEach(dest)` trả về `true`, `false` hoặc đường dẫn để chuyển hướng. **Guard chỉ là trải nghiệm người dùng, không phải bảo mật**; quyền truy cập thật phải kiểm tra ở server.
- `router.view` phải là **con của một phần tử** (`div(router.view)`), không truyền thẳng vào `mount`.

## Bộ UI component (`fluxa-components.js`)

```js
import { Button, Input, Select, Checkbox, Card, Badge, Alert, Spinner, Modal, Tabs, createToaster } from "./fluxa-components.js";
```

| Component | Ghi chú |
|---|---|
| `Button` | `variant`: primary / ghost / danger; `size`: sm / md / lg; `loading`, `disabled` nhận boolean, signal hoặc hàm |
| `Input`, `Select`, `Checkbox` | Có nhãn liên kết `for`/`id`, gợi ý, lỗi (`aria-invalid`, `aria-describedby`). Truyền **signal** vào `value`/`checked` là có ràng buộc hai chiều |
| `Card`, `Badge`, `Alert`, `Spinner` | Hiển thị; `Alert` có `role` theo mức độ, nút đóng khi có `onClose` |
| `Modal` | `open` là signal. `role="dialog"`, `aria-modal`, đóng bằng Esc hoặc bấm nền, giữ Tab trong hộp, khóa cuộn trang, trả tiêu điểm khi đóng |
| `Tabs` | Bàn phím ← → Home End; nội dung tab là hàm thì chỉ dựng khi chọn |
| `createToaster()` | `const t = createToaster(); h(t.Toaster)` một lần, rồi `t.show("Đã lưu", { tone: "success" })` |

```js
const email = signal("");
const err = computed(() => (email() && !email().includes("@") ? "Email không hợp lệ" : ""));
h(Input, { label: "Email", type: "email", value: email, error: err, hint: "Ví dụ: ban@example.com" });

const open = signal(false);
h(Button, { onclick: () => open.set(true) }, "Xóa…");
h(Modal, { open, title: "Xóa mục này?" }, "Không thể hoàn tác.");
```

Thêm từ 0.9: `Table` (sắp xếp 3 trạng thái, chỉ đọc thuộc tính của chính hàng), `Pagination`, `Dropdown` (bàn phím ↑ ↓ Esc), `Tooltip` (Esc đóng, theo WCAG), `Progress`, `Skeleton`, `Avatar` (ảnh qua bộ lọc URL).

Component UI dùng class trong `fluxa.css`; hãy nạp file này. Giao diện tối: `fluxa.css` hỗ trợ sẵn (theo hệ điều hành, hoặc `createTheme()` để người dùng tự chọn).

### Mới ở 0.10

**Form:** `Textarea` (có bộ đếm ký tự), `RadioGroup`, `Switch`, `Slider`, `Rating` (bàn phím: mũi tên, Home, End). **Bố cục và điều hướng:** `Accordion`, `Breadcrumb`, `Drawer` (trái/phải/dưới), `Stepper`, `Popover`.

**Nhập liệu nâng cao** (`import { Combobox, FileInput, DatePicker } from "fluxa-ui/inputs"`): `Combobox` (ARIA combobox, tìm không phân biệt dấu), `FileInput` (kéo thả, kiểm tra loại/dung lượng/số lượng), `DatePicker` (điều khiển đủ bằng bàn phím, giá trị `YYYY-MM-DD`, không phụ thuộc gì). Kiểm tra file ở phía client chỉ để cải thiện trải nghiệm; **luôn kiểm tra lại ở server.**

**Biểu đồ SVG** (`import { LineChart, BarChart, DonutChart } from "fluxa-ui/charts"`): SVG thuần, không phụ thuộc, dữ liệu phản ứng, mỗi biểu đồ có bảng dữ liệu ẩn cho trình đọc màn hình, nhãn luôn là chữ thuần. Giới hạn 1000 điểm và 12 chuỗi.

```js
h(LineChart, { title: "Doanh thu", data: [{ label: "T1", value: 12 }, { label: "T2", value: 19 }] })
```

Xem demo trực tiếp ở route `/more` của app mẫu. Mới chỉ kiểm thử trên Chromium.

## Tính năng thêm (`fluxa-extras.js`, đã gồm trong bản một file)

```js
import { persist, form, rules, createI18n, createTheme, debounced, media, online, history } from "fluxa-ui/extras";
```

| Hàm | Dùng để |
|---|---|
| `persist(signal, "khóa")` | Tự lưu vào localStorage và đọc lại. Đọc JSON an toàn (bỏ `__proto__`...), giới hạn 1.000.000 ký tự, không lỗi nếu localStorage bị chặn |
| `form({ ten: { value: "", rules: [rules.required()] } }, { onSubmit })` | Form + kiểm tra dữ liệu; lỗi chỉ hiện sau khi chạm vào ô hoặc gửi; chặn gửi đúp |
| `createI18n({ vi: {...}, en: {...} })` | Đa ngôn ngữ: `{tham_số}` luôn là chữ thuần, số nhiều qua `Intl.PluralRules`, `i18n.text("khóa")` tự cập nhật khi đổi ngôn ngữ |
| `createTheme()` | Sáng / tối / theo hệ thống, nhớ lựa chọn: `theme.toggle()` |
| `debounced(signal, 300)` | Bản "chậm" của signal, hợp cho ô tìm kiếm |
| `media("(max-width: 600px)")` | `true/false` theo media query |
| `online()` | `true/false` có mạng hay không |
| `history(signal)` | `undo()`, `redo()`, `canUndo()`, `canRedo()` (nhớ tối đa 100 bước) |

## Ứng dụng mẫu (`examples/`)

Mỗi app là một file HTML, bấm đúp là chạy: Việc cần làm, Quản lý chi tiêu, Ghi chú, Bảng điều khiển (Việt/Anh + sáng/tối). Mở `examples/index.html`. Kiểm thử trên Chromium thật: `npm run test:examples`.

## JSX

**Cách 1: pragma `h` (classic)**, đúng như lộ trình ban đầu:

```jsx
import { h, Fragment, signal, mount } from "fluxa-ui";

const count = signal(0);
mount("#app", () => (
  <>
    <button class="btn" onClick={() => count.set((c) => c + 1)}>+</button>
    <span>{count}</span>
  </>
));
```

- TypeScript/esbuild: `jsxFactory: "h"`, `jsxFragmentFactory: "Fragment"`.
- Babel: `@babel/plugin-transform-react-jsx` với `{ pragma: "h", pragmaFrag: "Fragment" }`.

**Cách 2: runtime tự động**: đặt `"jsx": "react-jsx"` và `"jsxImportSource": "fluxa-ui"` trong tsconfig; Fluxa cung cấp `fluxa-ui/jsx-runtime`.

Lưu ý: nội dung phản ứng phải là hàm: viết `{count}` (signal) hoặc `{() => count() * 2}`, không viết `{count() * 2}` (chỉ chạy một lần).

## Vite

```js
// vite.config.js
import { defineConfig } from "vite";
import fluxa from "fluxa-ui/vite";

export default defineConfig({ plugins: [fluxa()] });          // classic: tự thêm import h, Fragment
// fluxa({ automatic: true })                                 // dùng jsx-runtime
// fluxa({ importFrom: "./src/fluxa.js" })                     // import từ đường dẫn khác
```

Nếu cấu hình `esbuild` mà plugin đưa vào không được phiên bản Vite của bạn nhận, hãy khai báo trực tiếp:

```js
esbuild: { jsxFactory: "h", jsxFragment: "Fragment", jsxInject: `import { h, Fragment } from "fluxa-ui"` }
```

### HMR giữ state

Mặc định plugin bật HMR. File nào import `mount` từ Fluxa (file khởi động ứng dụng) được tự thêm, ở **cuối file**:

```js
import { unmountAll as __fluxaUnmountAll } from "fluxa-ui";
if (import.meta.hot) { import.meta.hot.accept(); import.meta.hot.dispose(() => __fluxaUnmountAll()); }
```

Khi bạn sửa một component, Vite chạy lại file khởi động: ứng dụng cũ được gỡ sạch (effect, router, timer của `createToaster`...) rồi mount lại. Module **không bị sửa** (ví dụ file chứa `createStore`) được giữ nguyên nên state trong đó còn, còn state nằm trong chính component bị sửa thì được tạo lại. Tắt bằng `fluxa({ hmr: false })` (Vite sẽ tải lại toàn trang), hoặc tự viết `import.meta.hot` trong file khởi động (plugin sẽ không chen vào).

### Tailwind CSS

Fluxa gán `class` thẳng vào DOM nên không cần cấu hình riêng. Với Tailwind v4 và Vite:

```js
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({ plugins: [fluxa(), tailwindcss()] });
```

```css
/* src/style.css */
@import "tailwindcss";
```

```jsx
<button class="px-4 hover:bg-blue-500 md:px-8 [&>svg]:size-4">Lưu</button>
<div class={() => cx("rounded-xl border", open() && "bg-blue-500")}>…</div>
```

Class nên viết đầy đủ trong mã nguồn (đừng ghép chuỗi kiểu `"bg-" + color`) để Tailwind quét thấy. Các component UI mặc định dùng `fluxa.css`; có thể dùng song song hoặc thay bằng class Tailwind qua prop `class`.

## Điểm nhấn: an toàn theo mặc định, tự kiểm chứng được

Điểm khác biệt của Fluxa không phải "nhanh nhất" hay "nhẹ nhất" (mình chưa có benchmark, và Preact/Solid vẫn nhẹ hơn). Điểm khác là: **cách viết đơn giản nhất cũng là cách an toàn nhất**, và bạn tự chứng minh được điều đó.

```bash
npm run test:security   # cần playwright + chromium
```

Lệnh này dựng một trang dưới CSP nghiêm ngặt và Trusted Types, ném hàng chục payload tấn công vào mọi cửa nhận dữ liệu (nội dung, thuộc tính, URL, style, tên thẻ, sự kiện dạng chuỗi, SVG animate, khóa store, router) rồi kiểm tra trên **Chromium thật**: không mã nào chạy, không có hộp thoại, không có thẻ/thuộc tính nguy hiểm trong DOM, không ô nhiễm prototype, router không bị chuyển hướng ra ngoài. Mình đã thử cố tình phá ba lớp bảo vệ (lọc URL, chặn sự kiện dạng chuỗi, Trusted Types) và bộ kiểm thử đều báo lỗi, nên nó không phải bài test "luôn qua".

**Trusted Types:** nếu trang bật `require-trusted-types-for 'script'`, `unsafeHTML` tự bọc kết quả của hàm làm sạch bằng chính sách tên `fluxa`. Thêm vào CSP: `require-trusted-types-for 'script'; trusted-types fluxa`. Nếu hàm làm sạch của bạn (ví dụ DOMPurify với `RETURN_TRUSTED_TYPE`) đã trả về TrustedHTML thì dùng nguyên.

Điều bộ kiểm thử **không** chứng minh: không phải kiểm toán độc lập, chỉ thử trên Chromium, và URL tuyệt đối `http(s)` tới host bất kỳ vẫn hợp lệ theo thiết kế (giới hạn host là việc của CSP, xem SECURITY.md).

## Bảo mật tóm tắt

| Mối đe dọa | Cách Fluxa xử lý |
|---|---|
| XSS qua nội dung | Văn bản luôn qua `createTextNode`; chỉ `unsafeHTML` (bắt buộc có sanitizer) mới chèn HTML |
| `javascript:` / `data:` trong `href`, `src`... | Chỉ cho `http`, `https`, `mailto`, `tel` và URL tương đối |
| `onclick="..."` | Sự kiện chỉ nhận hàm |
| Thẻ/thuộc tính nguy hiểm | Chặn `script`, `style`, `object`, `embed`, `base`, `meta`, `link`, `innerHTML`, `srcdoc`...; `iframe` sandbox mặc định |
| Tabnabbing | `target="_blank"` tự thêm `rel="noopener noreferrer"` |
| Open redirect | Router chỉ nhận đường dẫn nội bộ, kiểm tra cùng origin |
| Prototype pollution | Query, params và store dùng object không prototype; chặn khóa `__proto__`... |
| Treo trang | Chặn vòng lặp cập nhật vô hạn; giới hạn độ dài/số đoạn của URL |
| Class/type tùy ý ở component | `variant`, `tone`, `type`... chỉ nhận giá trị trong danh sách cho phép |

Chi tiết và phần bạn vẫn phải tự làm (server, tiêu đề HTTP, sanitizer): xem [SECURITY.vi.md](SECURITY.vi.md).

## Hạn chế hiện tại

- Chưa có SSR, hydration, devtools.
- Vite plugin **chưa được chạy với Vite thật** (môi trường phát triển không có mạng để cài). Đã kiểm tra: cấu hình nó sinh ra; biến đổi mã HMR; mã sau khi esbuild (bộ biên dịch JSX của Vite) rồi plugin xử lý vẫn hợp lệ; một mô phỏng đầy đủ chu trình dispose → chạy lại file khởi động → state store còn nguyên. Chưa kiểm tra: tích hợp trong dev server thật. Nếu HMR lỗi trên máy bạn, dùng `fluxa({ hmr: false })` và báo lại thông báo lỗi.
- HMR chỉ giữ state ở module không bị sửa (store...). State trong component bị sửa được tạo lại.
- Tailwind mới được kiểm tra ở mức biên dịch: lõi Tailwind v4.3.3 sinh đúng CSS cho các class viết trong mã Fluxa (`hover:`, `md:`, `dark:`, `w-1/2`, `[&>svg]:size-4`) bằng bộ quét đơn giản của mình; chưa chạy qua `@tailwindcss/vite` hay bộ quét chính thức. JSX được biên dịch bằng TypeScript và esbuild thật, chạy đúng ở cả hai chế độ.
- Bộ UI chưa có Combobox, DatePicker, biểu đồ, kéo-thả sắp xếp, upload file.
- `computed`/`effect` tạo ngoài `mount` hoặc `createRoot` sống đến hết trang; hãy tạo chúng trong component.
- Chưa được kiểm toán bảo mật độc lập; mới thử trên Chromium (chưa Firefox/Safari).

## Giấy phép

MIT. Xem [LICENSE](LICENSE).
