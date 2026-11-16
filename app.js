import { signal, computed, tags, list, mount, h, createStore, model, resource, show, choose, onMounted } from "./fluxa.js";
import { createRouter } from "./fluxa-router.js";
import { createTheme } from "./fluxa-extras.js";
import {
  Button, Input, Checkbox, Select, Card, Badge, Alert, Modal, Tabs, createToaster,
  Table, Pagination, Dropdown, Progress, Avatar, Tooltip, Skeleton,
  Textarea, RadioGroup, Switch, Slider, Rating, Accordion, Breadcrumb, Drawer, Stepper, Popover,
} from "./fluxa-components.js";
import { Combobox, FileInput, DatePicker } from "./fluxa-inputs.js";
import { LineChart, BarChart, DonutChart } from "./fluxa-charts.js";

const { div, h1, h2, p, span, button, input, ul, li, label, nav, main, a, code } = tags;

// Store toàn cục: chia sẻ giữa các component không có quan hệ cha-con
const app = createStore({ clicks: 0 });
const toaster = createToaster();
const theme = createTheme(); // sáng / tối / theo hệ điều hành, nhớ lựa chọn

// Chế độ hash: chạy được với mọi server tĩnh, không cần cấu hình gì thêm
const router = createRouter(
  {
    "/": Home,
    "/todo": Todo,
    "/ui": UIKit,
    "/more": MoreUI,
    "/user/:id": User,
    "/security": Security,
    "*": NotFound,
  },
  { mode: "hash" }
);

const NavLink = (to, text) =>
  router.link({ href: to, class: () => (router.path() === to ? "active" : "") }, text);

// ───── Đồng hồ: minh họa vòng đời (onMounted trả về hàm dọn dẹp) ─────
function Clock() {
  const now = signal(new Date());
  onMounted(() => {
    const t = setInterval(() => now.set(new Date()), 1000);
    return () => clearInterval(t); // chạy khi rời trang
  });
  return span({ class: "badge" }, () => now().toLocaleTimeString("vi-VN"));
}

// ───── Trang chủ: bộ đếm + store ─────
function Home() {
  const count = signal(0);
  const double = computed(() => count() * 2);
  const bump = (d) => {
    count.set((c) => c + d);
    app.clicks++; // ghi vào store dùng chung
  };
  return div({ class: "card" },
    h2("Bộ đếm ", h(Clock)),
    div({ class: "row" },
      button({ class: "btn ghost", onclick: () => bump(-1) }, "−"),
      span({ class: "big" }, count),
      button({ class: "btn", onclick: () => bump(1) }, "+"),
      span({ class: "badge" }, () => `gấp đôi: ${double()}`),
    ),
    p({ class: "muted" }, () => `Tổng số lần bấm (store dùng chung, hiện cả ở thanh điều hướng): ${app.clicks}`),
  );
}

// ───── Việc cần làm: list có key + store theo từng mục ─────
function Todo() {
  // Mỗi việc là một store nhỏ: đổi `t.done` chỉ cập nhật đúng dòng đó, không dựng lại danh sách
  const newTodo = (text, done = false) => createStore({ text, done });
  const items = signal([newTodo("Thử framework Fluxa", true), newTodo("Tự viết một component")]);
  const text = signal("");

  const add = () => {
    if (!text().trim()) return;
    items.set((a) => [...a, newTodo(text().trim().slice(0, 200))]);
    text.set("");
  };

  return div({ class: "card" },
    h2("Việc cần làm ", span({ class: "badge" }, () => `còn ${items().filter((t) => !t.done).length}`)),
    div({ class: "row" },
      input({
        class: "input",
        placeholder: "Thêm việc mới rồi nhấn Enter…",
        maxlength: 200,
        value: text, // truyền signal là tự ràng buộc hai chiều
        onkeydown: (e) => e.key === "Enter" && add(),
      }),
      button({ class: "btn", onclick: add, disabled: () => !text().trim() }, "Thêm"),
    ),
    show(() => !items().length, () => p({ class: "muted" }, "Chưa có việc nào, hãy thêm một việc ở trên.")),
    ul({ class: "todo" },
      list(items, (t) =>
        li({ class: { done: () => t.done } },
          input({ type: "checkbox", checked: model(t, "done") }),
          label({ onclick: () => (t.done = !t.done) }, t.text),
          button({ class: "btn ghost", onclick: () => items.set((a) => a.filter((x) => x !== t)) }, "Xóa"),
        ),
      ),
    ),
  );
}

// ───── Component bổ sung 0.10: form, điều hướng, nhập liệu nâng cao, biểu đồ ─────
function MoreUI() {
  const bio = signal("");
  const size = signal("m");
  const notify = signal(true);
  const volume = signal(40);
  const stars = signal(3);
  const city = signal("");
  const date = signal("");
  const step = signal(1);
  const drawer = signal(false);
  const fruits = ["Cà chua", "Dưa hấu", "Đào", "Cam", "Xoài", "Nho"].map((t) => ({ value: t, label: t }));
  const revenue = [{ label: "T1", value: 12 }, { label: "T2", value: 19 }, { label: "T3", value: 15 }, { label: "T4", value: 27 }, { label: "T5", value: 31 }, { label: "T6", value: 26 }];
  return div({ class: "stack" },
    h(Breadcrumb, { items: [{ label: "Trang chủ", href: "#/" }, { label: "Thư viện", href: "#/ui" }, { label: "Component bổ sung" }] }),
    h(Card, { title: "Form cơ bản" },
      h(Textarea, { label: "Giới thiệu", value: bio, maxlength: 120, hint: "Tối đa 120 ký tự" }),
      h(RadioGroup, { label: "Cỡ áo", value: size, inline: true, options: [{ value: "s", label: "S" }, { value: "m", label: "M" }, { value: "l", label: "L" }, { value: "xl", label: "XL", disabled: true }] }),
      h(Switch, { checked: notify, label: "Nhận thông báo" }),
      h(Slider, { label: "Âm lượng", value: volume }),
      div({ class: "mt" }, p({ class: "label" }, "Đánh giá"), h(Rating, { value: stars })),
      p({ class: "muted" }, () => `cỡ=${size()}, thông báo=${notify()}, âm lượng=${volume()}, sao=${stars()}`),
    ),
    h(Card, { title: "Nhập liệu nâng cao" },
      h(Combobox, { label: "Trái cây (gõ \"dua\" hoặc \"dao\")", value: city, options: fruits, placeholder: "Chọn hoặc gõ để tìm…" }),
      h(DatePicker, { label: "Ngày giao hàng", value: date, min: "2026-01-01" }),
      h(FileInput, { label: "Ảnh sản phẩm", accept: [".png", ".jpg", "image/webp"], multiple: true, maxFiles: 3, maxSize: 2 * 1024 * 1024 }),
      p({ class: "muted" }, () => `trái cây=${city() || "(chưa chọn)"}, ngày=${date() || "(chưa chọn)"}`),
    ),
    h(Card, { title: "Bố cục và điều hướng" },
      h(Stepper, { steps: ["Giỏ hàng", "Giao hàng", "Thanh toán"], current: step }),
      div({ class: "row mt" },
        h(Button, { size: "sm", variant: "ghost", onclick: () => step.set((v) => Math.max(0, v - 1)) }, "Lùi"),
        h(Button, { size: "sm", onclick: () => step.set((v) => Math.min(2, v + 1)) }, "Tiếp"),
        h(Popover, { label: "Bộ lọc", title: "Bộ lọc" }, p("Nội dung tùy ý nằm trong hộp nổi."), h(Switch, { checked: signal(false), label: "Chỉ hàng còn" })),
        h(Button, { variant: "ghost", onclick: () => drawer.set(true) }, "Mở ngăn kéo"),
      ),
      h(Drawer, { open: drawer, title: "Giỏ hàng", side: "right" }, p("Ngăn kéo trượt từ cạnh phải. Bấm Esc để đóng.")),
      div({ class: "mt" },
        h(Accordion, { open: 0, items: [
          { title: "Chính sách đổi trả", content: () => p("Đổi trả trong 30 ngày nếu còn nguyên tem mác.") },
          { title: "Vận chuyển", content: () => p("Giao toàn quốc 2–4 ngày. Miễn phí từ 1.000.000đ.") },
          { title: "Bảo hành", content: () => p("Bảo hành đường may 6 tháng.") },
        ] })
      ),
    ),
    h(Card, { title: "Biểu đồ SVG" },
      div({ class: "grid2" },
        h(LineChart, { title: "Doanh thu (triệu đồng)", data: revenue }),
        h(BarChart, { title: "Đơn hàng theo quý", labels: ["Q1", "Q2", "Q3"], series: [{ name: "2025", values: [40, 55, 48] }, { name: "2026", values: [52, 61, 70] }] }),
      ),
      div({ class: "mt" }, h(DonutChart, { title: "Cơ cấu doanh thu", data: [{ label: "Nam", value: 45 }, { label: "Nữ", value: 38 }, { label: "Phụ kiện", value: 17 }] })),
    ),
  );
}

// ───── Bộ UI component ─────
function UIKit() {
  const email = signal("");
  const emailErr = computed(() => (email() && !/^\S+@\S+\.\S+$/.test(email()) ? "Email không hợp lệ" : ""));
  const agree = signal(false);
  const role = signal("dev");
  const open = signal(false);
  const tab = signal("a");
  const loading = signal(false);

  const save = () => {
    loading.set(true);
    setTimeout(() => {
      loading.set(false);
      toaster.show("Đã lưu thành công", { tone: "success" });
    }, 900);
  };

  // Dữ liệu mẫu cho bảng + phân trang
  const people = Array.from({ length: 23 }, (_, i) => ({ ten: `Người dùng ${i + 1}`, diem: (i * 37) % 100, vaitro: ["Dev", "Thiết kế", "QA"][i % 3] }));
  const page = signal(1);
  const PAGE_SIZE = 5;
  const view = () => people.slice((page() - 1) * PAGE_SIZE, page() * PAGE_SIZE);
  const progress = signal(35);

  return div({ class: "stack" },
    h(Card, { title: "Dữ liệu: bảng, phân trang, tiến độ" },
      h(Table, {
        columns: [
          { key: "ten", label: "Tên", render: (r) => div({ class: "row" }, h(Avatar, { name: r.ten, size: "sm" }), r.ten) },
          { key: "vaitro", label: "Vai trò" },
          { key: "diem", label: "Điểm", align: "right" },
        ],
        rows: view,
      }),
      div({ class: "row mt" },
        h(Pagination, { page, pages: Math.ceil(people.length / PAGE_SIZE) }),
        span({ class: "muted" }, () => `Trang ${page()}`),
      ),
      div({ class: "mt" }, h(Progress, { value: progress, tone: "success", label: "Tiến độ" })),
      div({ class: "row mt" },
        h(Button, { size: "sm", variant: "ghost", onclick: () => progress.set((v) => Math.min(100, v + 15)) }, "Tăng tiến độ"),
        h(Tooltip, { text: "Đặt lại về 35%" }, h(Button, { size: "sm", variant: "ghost", onclick: () => progress.set(35) }, "Đặt lại")),
        h(Dropdown, { label: "Tùy chọn", items: [
          { label: "Sao chép", onclick: () => toaster.show("Đã sao chép") },
          { label: "Đổi tên", onclick: () => toaster.show("Đổi tên…") },
          { divider: true },
          { label: "Xóa", danger: true, onclick: () => toaster.show("Đã xóa", { tone: "warning" }) },
        ] }),
      ),
      div({ class: "mt" }, h(Skeleton, { lines: 2 })),
    ),
    h(Card, { title: "Nút" },
      div({ class: "row" },
        h(Button, null, "Chính"),
        h(Button, { variant: "ghost" }, "Phụ"),
        h(Button, { variant: "danger" }, "Nguy hiểm"),
        h(Button, { size: "sm" }, "Nhỏ"),
        h(Button, { loading, onclick: save }, "Lưu"),
        h(Button, { disabled: true }, "Bị khóa"),
      ),
    ),
    h(Card, { title: "Biểu mẫu (ràng buộc hai chiều với signal)" },
      h(Input, { label: "Email", type: "email", value: email, error: emailErr, hint: "Ví dụ: ban@example.com" }),
      h(Select, {
        label: "Vai trò",
        value: role,
        options: [{ value: "dev", label: "Lập trình viên" }, { value: "design", label: "Thiết kế" }],
      }),
      h(Checkbox, { checked: agree, label: "Tôi đồng ý điều khoản" }),
      p({ class: "muted" }, () => `email="${email()}", vai trò=${role()}, đồng ý=${agree()}`),
    ),
    h(Card, { title: "Thông báo, nhãn, hộp thoại" },
      div({ class: "row" },
        h(Badge, null, "Mặc định"),
        h(Badge, { tone: "info" }, "Info"),
        h(Badge, { tone: "success" }, "Thành công"),
        h(Badge, { tone: "warning" }, "Cảnh báo"),
        h(Badge, { tone: "danger" }, "Lỗi"),
      ),
      h(Alert, { tone: "info", title: "Thông tin" }, "Đây là một hộp thông báo."),
      h(Alert, { tone: "danger", title: "Lỗi" }, "Có gì đó không ổn."),
      div({ class: "row mt" },
        h(Button, { variant: "ghost", onclick: () => toaster.show("Xin chào từ Fluxa!") }, "Hiện toast"),
        h(Button, { onclick: () => open.set(true) }, "Mở hộp thoại"),
      ),
      h(Modal, { open, title: "Xóa mục này?" },
        p("Hành động này không thể hoàn tác. Bấm Esc hoặc ra ngoài để đóng."),
        div({ class: "row mt" },
          h(Button, { variant: "danger", onclick: () => { open.set(false); toaster.show("Đã xóa", { tone: "warning" }); } }, "Xóa"),
          h(Button, { variant: "ghost", onclick: () => open.set(false) }, "Hủy"),
        ),
      ),
    ),
    h(Card, { title: "Thẻ tab" },
      h(Tabs, {
        value: tab,
        tabs: [
          { id: "a", label: "Tổng quan", content: () => p("Nội dung tổng quan. Thử phím ← → Home End.") },
          { id: "b", label: "Chi tiết", content: () => p("Nội dung chi tiết, chỉ được dựng khi bạn chọn tab này.") },
          { id: "c", label: "Cài đặt", content: () => p("Nội dung cài đặt.") },
        ],
      }),
    ),
  );
}

// ───── Người dùng: tham số route + minh họa chống XSS ─────
function User({ params }) {
  // Dữ liệu bất đồng bộ: có sẵn loading / error / data, tự hủy khi rời trang
  const profile = resource(() => new Promise((ok) => setTimeout(() => ok({ name: `Người dùng #${params.id}` }), 500)));
  const bio = signal("<img src=x onerror=alert('XSS')> Xin chào!");
  const url = signal("javascript:alert('XSS')");
  return div({ class: "card" },
    h2("Người dùng ", code(params.id)),
    p(choose(profile.state, { loading: "Đang tải hồ sơ…", error: "Lỗi tải hồ sơ", ready: () => `Xin chào, ${profile.data().name}` })),
    p({ class: "muted" }, "Tham số lấy từ URL: ", code("#/user/:id"), ". Thử đổi số cuối trên thanh địa chỉ."),
    p("Tiểu sử (nội dung bên dưới luôn là chữ thuần, không bao giờ thành HTML):"),
    input({ class: "input", value: bio }),
    p({ class: "preview" }, bio),
    p("Liên kết do người dùng nhập (giao thức nguy hiểm bị loại bỏ, liên kết không bấm được):"),
    input({ class: "input", value: url }),
    p(a({ href: url, target: "_blank" }, "Mở liên kết")),
  );
}

// ───── Bảo mật ─────
function Security() {
  const item = (t) => li(t);
  return div({ class: "card" },
    h2("Fluxa bảo vệ bạn thế nào"),
    ul({ class: "plain" },
      item("Văn bản luôn đi qua createTextNode, không có đường nào biến chuỗi thành HTML."),
      item("href/src/action... chỉ nhận http, https, mailto, tel và đường dẫn tương đối."),
      item("onclick=\"...\" dạng chuỗi bị chặn; sự kiện chỉ nhận hàm."),
      item("Thẻ script, style, object, embed, base, meta, link bị chặn; iframe bị sandbox mặc định."),
      item("Router chặn open redirect và giới hạn độ dài/số đoạn của URL."),
      item("Store từ chối khóa __proto__, constructor, prototype."),
      item("Component UI chỉ nhận variant/tone/type từ danh sách cho phép."),
      item("Trang demo này còn dùng Content-Security-Policy nghiêm ngặt, xem index.html."),
    ),
    p({ class: "muted" }, "Đọc thêm trong SECURITY.md: phần Fluxa không thể làm thay bạn (server, xác thực, tiêu đề HTTP)."),
  );
}

function NotFound() {
  return div({ class: "card" }, h2("404"), p("Không tìm thấy trang."), router.link({ href: "/" }, "Về trang chủ"));
}

// ───── Ứng dụng ─────
mount("#app", () =>
  div({ class: "container" },
    h1(span("Fluxa"), ".js"),
    p({ class: "muted" }, "Nhẹ. Nhanh. Đẹp. An toàn theo mặc định. Không virtual DOM."),
    nav({ class: "nav" },
      NavLink("/", "Trang chủ"),
      NavLink("/todo", "Việc cần làm"),
      NavLink("/ui", "Giao diện"),
      NavLink("/more", "Component mới"),
      NavLink("/user/42", "Người dùng"),
      NavLink("/security", "Bảo mật"),
      span({ class: "badge nav-badge" }, () => `bấm: ${app.clicks}`),
      button({ class: "btn ghost theme-toggle", type: "button", "aria-label": "Đổi giao diện sáng/tối", onclick: theme.toggle }, () => (theme.resolved() === "dark" ? "☀" : "🌙")),
    ),
    main(router.view),
    h(toaster.Toaster),
  ),
);
