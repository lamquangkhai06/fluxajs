// e2e.cjs — kiểm thử đầu-cuối trên Chromium thật (chạy demo, bấm thử, bắt lỗi console/CSP).
// Cách chạy:  npm i -D playwright && npx playwright install chromium && node e2e.cjs
// Kiểm thử đầu-cuối trên Chromium thật: chạy demo, bấm thử, bắt lỗi console/CSP
const http = require("http"), fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const ROOT = __dirname;
const OUT = require("os").tmpdir();
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, req.url.split("?")[0] === "/" ? "index.html" : req.url.split("?")[0]);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});
const results = [];
const check = (name, ok, extra = "") => { results.push(ok); console.log(ok ? "  ✓" : "  ✗", name, ok ? "" : extra); };
(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = `http://localhost:${server.address().port}`;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 900 }, deviceScaleFactor: 1 });
  const problems = [];
  page.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !m.text().includes("unsafe URL blocked in \"href\": \"javascript:alert")) problems.push(m.type() + ": " + m.text()); });
  page.on("pageerror", (e) => problems.push("pageerror: " + e.message));
  let dialogs = 0;
  page.on("dialog", async (d) => { dialogs++; await d.dismiss(); });

  await page.goto(base + "/");
  await page.waitForSelector("h1");
  check("trang chủ hiển thị", (await page.textContent("h1")).includes("Fluxa"));

  // Bộ đếm + store dùng chung
  await page.click(".btn:has-text('+')");
  await page.click(".btn:has-text('+')");
  check("bộ đếm = 2", (await page.textContent(".big")) === "2");
  check("store hiện ở thanh điều hướng", (await page.textContent(".nav-badge")) === "bấm: 2");
  check("danh sách phản ứng gấp đôi", (await page.textContent(".card .badge:not(:has(+ *))")).length > 0);
  await page.screenshot({ path: OUT + "/home.png" });

  // Router
  await page.click(".nav a:has-text('Việc cần làm')");
  await page.waitForSelector(".todo");
  check("chuyển sang trang todo bằng hash", page.url().endsWith("#/todo"));
  const first = await page.$(".todo li");
  await page.fill(".input", "Việc mới");
  await page.press(".input", "Enter");
  check("thêm todo", (await page.$$(".todo li")).length === 3);
  check("giữ nguyên DOM mục cũ khi thêm (list có key)", await page.evaluate((el) => el.isConnected, first));
  await page.click(".todo li:nth-child(3) .btn.ghost");
  check("xóa todo", (await page.$$(".todo li")).length === 2);
  // show(): trạng thái trống chỉ hiện khi danh sách rỗng
  check("chưa hiện thông báo trống khi còn việc", !(await page.textContent(".card")).includes("Chưa có việc nào"));
  while ((await page.$$(".todo li")).length) await page.click(".todo li .btn.ghost");
  check("danh sách rỗng thì hiện thông báo trống", (await page.textContent(".card")).includes("Chưa có việc nào"));
  await page.fill("input.input", "việc mới");
  await page.press("input.input", "Enter");
  check("thêm lại thì thông báo trống biến mất", !(await page.textContent(".card")).includes("Chưa có việc nào") && (await page.$$(".todo li")).length === 1);

  // Bộ UI
  await page.click(".nav a:has-text('Giao diện')");
  await page.waitForSelector(".tabs");
  await page.fill("input[type=email]", "sai");
  check("Input báo lỗi + aria-invalid", (await page.getAttribute("input[type=email]", "aria-invalid")) === "true" && (await page.textContent(".error")) === "Email không hợp lệ");
  await page.fill("input[type=email]", "a@b.co");
  check("hết lỗi khi hợp lệ", (await page.$(".error")) === null);
  await page.selectOption("select", "design");
  await page.check(".check input");
  check("ràng buộc hai chiều select + checkbox", (await page.textContent(".muted:has-text('vai trò')")).includes("vai trò=design, đồng ý=true"));

  await page.click(".btn:has-text('Lưu')");
  check("nút loading bị khóa + aria-busy", (await page.getAttribute(".btn[aria-busy=true]", "aria-busy")) === "true");
  await page.waitForSelector(".toast-success");
  check("toast hiện sau khi lưu", (await page.textContent(".toast-success")).includes("Đã lưu"));

  await page.click(".btn:has-text('Mở hộp thoại')");
  await page.waitForSelector("[role=dialog]");
  check("modal có aria-modal", (await page.getAttribute("[role=dialog]", "aria-modal")) === "true");
  check("modal khóa cuộn trang", (await page.evaluate(() => document.body.style.overflow)) === "hidden");
  check("tiêu điểm vào modal", await page.evaluate(() => document.activeElement.getAttribute("role") === "dialog"));
  await page.screenshot({ path: OUT + "/modal.png" });
  // bẫy Tab: Tab nhiều lần phải luôn ở trong hộp
  let inside = true;
  for (let i = 0; i < 6; i++) { await page.keyboard.press("Tab"); inside = inside && (await page.evaluate(() => !!document.activeElement.closest("[role=dialog]"))); }
  check("Tab bị giữ trong modal", inside);
  await page.keyboard.press("Escape");
  await page.waitForSelector("[role=dialog]", { state: "detached" });
  check("Esc đóng modal, mở khóa cuộn", (await page.evaluate(() => document.body.style.overflow)) === "");
  check("tiêu điểm trả về nút mở", await page.evaluate(() => document.activeElement.textContent === "Mở hộp thoại"));

  await page.click(".tab:has-text('Chi tiết')");
  check("tab chi tiết", (await page.textContent("[role=tabpanel]")).includes("Chi tiết") || (await page.textContent("[role=tabpanel]")).includes("chi tiết"));
  await page.focus(".tab.active");
  await page.keyboard.press("ArrowRight");
  check("phím mũi tên đổi tab", (await page.textContent(".tab.active")) === "Cài đặt");

  // ── Component mới: Table, Pagination, Dropdown, Tooltip, Progress, Avatar ──
  const col = (i) => page.$$eval("table tbody tr", (trs, i) => trs.map((tr) => tr.children[i].textContent.trim()), i);
  check("Table hiện 5 dòng ở trang 1", (await col(0)).length === 5);
  check("Avatar lấy chữ cái đầu của hai từ", (await page.textContent("table tbody tr .avatar")).trim() === "ND");
  await page.click("th button:has-text('Điểm')");
  let pts = (await col(2)).map(Number);
  check("bấm tiêu đề: sắp xếp tăng dần theo SỐ", pts.every((v, i) => i === 0 || pts[i - 1] <= v), pts.join());
  check("aria-sort = ascending", (await page.getAttribute("th:has(button:has-text('Điểm'))", "aria-sort")) === "ascending");
  await page.click("th button:has-text('Điểm')");
  pts = (await col(2)).map(Number);
  check("bấm lần hai: giảm dần", pts.every((v, i) => i === 0 || pts[i - 1] >= v), pts.join());
  await page.click("[aria-label='Trang 2']");
  check("Pagination: dấu … thu gọn các trang xa", (await page.$("[aria-label='Trang 3']")) !== null);
  await page.click("[aria-label='Trang sau']");
  const names3 = await col(0);
  check("Pagination: sang trang 3 thì bảng đổi dữ liệu, giữ kiểu sắp xếp", names3.every((n) => /Người dùng 1[1-5]$/.test(n)) && (await page.getAttribute("[aria-label='Trang 3']", "aria-current")) === "page", names3.join());
  await page.click("[aria-label='Trang sau']"); await page.click("[aria-label='Trang sau']");
  check("Pagination: nút Sau bị khóa ở trang cuối (5)", await page.$eval("[aria-label='Trang sau']", (b) => b.disabled) && (await col(0)).length === 3);

  const dd = ".dropdown > button";
  await page.click(dd);
  check("Dropdown mở, aria-expanded=true", (await page.getAttribute(dd, "aria-expanded")) === "true" && (await page.$$("[role=menuitem]")).length === 3);
  await page.keyboard.press("ArrowDown");
  const activeText = () => page.evaluate(() => document.activeElement.textContent.trim());
  await page.focus("[role=menuitem]"); await page.keyboard.press("ArrowDown"); await page.keyboard.press("ArrowDown");
  check("Dropdown: ↓ di chuyển giữa các mục (bỏ qua đường kẻ)", (await activeText()) === "Xóa", await activeText());
  await page.keyboard.press("Home");
  check("Dropdown: Home về mục đầu", (await activeText()) === "Sao chép");
  await page.keyboard.press("Escape");
  check("Dropdown: Esc đóng và trả tiêu điểm về nút", (await page.$("[role=menu]")) === null && (await page.evaluate(() => document.activeElement.getAttribute("aria-haspopup"))) === "menu");
  await page.click(dd);
  await page.click("h2:has-text('Dữ liệu')");
  check("Dropdown: bấm ra ngoài thì đóng", (await page.$("[role=menu]")) === null);
  await page.click(dd);
  await page.click("[role=menuitem]:has-text('Sao chép')");
  await page.waitForSelector(".toast:has-text('Đã sao chép')");
  check("Dropdown: chọn mục chạy hàm và đóng menu", (await page.$("[role=menu]")) === null);

  const bar = () => page.$eval(".progress-bar", (el) => el.style.width);
  check("Progress hiện 35%", (await bar()) === "35%");
  await page.click(".btn:has-text('Tăng tiến độ')");
  check("Progress cập nhật lên 50% và aria-valuenow", (await bar()) === "50%" && (await page.getAttribute("[role=progressbar]", "aria-valuenow")) === "50");

  const tipVisible = () => page.$eval(".tip-bubble", (el) => getComputedStyle(el).visibility === "visible");
  check("Tooltip ẩn lúc đầu", !(await tipVisible()));
  await page.hover(".tip button");
  check("Tooltip hiện khi rê chuột", await tipVisible());
  await page.keyboard.press("Escape");
  check("Tooltip: Esc ẩn đi dù vẫn đang rê chuột (WCAG 1.4.13)", !(await tipVisible()));
  await page.mouse.move(0, 0);
  await page.focus(".tip button");
  check("Tooltip hiện khi dùng bàn phím (focus)", await tipVisible());
  await page.fill("input[type=email]", "a@b.co"); // blur nút để tiếp tục

  // ── Chế độ sáng/tối ──
  const dataTheme = () => page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.evaluate(() => localStorage.clear());
  await page.emulateMedia({ colorScheme: "light" });
  await page.reload(); await page.waitForSelector(".theme-toggle");
  check("Theme auto theo hệ điều hành: sáng", (await dataTheme()) === "light");
  const lightBg = await bg();
  await page.emulateMedia({ colorScheme: "dark" });
  await page.waitForFunction(() => document.documentElement.getAttribute("data-theme") === "dark");
  check("Hệ điều hành đổi sang tối thì giao diện đổi theo, không cần tải lại", (await bg()) !== lightBg);
  await page.click(".theme-toggle");
  check("Bấm nút: chuyển sang sáng (ghi đè hệ điều hành)", (await dataTheme()) === "light" && (await bg()) === lightBg);
  await page.reload(); await page.waitForSelector(".theme-toggle");
  check("Lựa chọn được nhớ sau khi tải lại trang", (await dataTheme()) === "light");
  await page.click(".theme-toggle");
  await page.screenshot({ path: OUT + "/dark.png", fullPage: true });
  await page.evaluate(() => localStorage.clear());
  await page.emulateMedia({ colorScheme: "light" });
  await page.reload(); await page.waitForSelector(".theme-toggle");
  await page.screenshot({ path: OUT + "/ui.png", fullPage: true });

  // XSS & URL
  await page.click(".nav a:has-text('Người dùng')");
  await page.waitForSelector(".preview");
  // resource() + choose(): đang tải rồi hiện dữ liệu
  check("hồ sơ ban đầu ở trạng thái đang tải", (await page.textContent(".card")).includes("Đang tải hồ sơ"));
  await page.waitForFunction(() => document.querySelector(".card").textContent.includes("Xin chào, Người dùng #42"));
  check("hồ sơ tải xong thì hiện tên", !(await page.textContent(".card")).includes("Đang tải hồ sơ"));
  check("HTML trong tiểu sử chỉ là chữ", (await page.$$(".preview img")).length === 0 && (await page.textContent(".preview")).includes("<img"));
  check("href javascript: bị loại", (await page.getAttribute(".card p a", "href")) === null);
  check("không có hộp thoại alert nào bật lên", dialogs === 0);
  const open = await page.evaluate(() => { location.hash = "//evil.com"; return location.href; });
  await page.waitForTimeout(100);
  check("hash //evil.com không rời khỏi trang", page.url().startsWith(base));

  // Dọn dẹp lifecycle: rời trang chủ phải clearInterval
  await page.goto(base + "/#/");
  await page.waitForSelector(".big");
  await page.evaluate(() => {
    window.__active = new Set();
    const si = window.setInterval.bind(window), ci = window.clearInterval.bind(window);
    window.setInterval = (...a) => { const id = si(...a); window.__active.add(id); return id; };
    window.clearInterval = (id) => { window.__active.delete(id); return ci(id); };
  });
  await page.click(".nav a:has-text('Bảo mật')");
  await page.click(".nav a:has-text('Trang chủ')");
  await page.waitForSelector(".big");
  await page.waitForTimeout(50);
  const act1 = await page.evaluate(() => window.__active.size);
  await page.click(".nav a:has-text('Bảo mật')");
  await page.waitForTimeout(50);
  const act2 = await page.evaluate(() => window.__active.size);
  check("onMounted dọn interval khi rời trang", act1 === 1 && act2 === 0, `act1=${act1} act2=${act2}`);

  // ───── Component 0.10: trang /more trên Chromium thật ─────
  await page.goto(base + "/#/more");
  await page.waitForSelector(".chart-svg");
  check("biểu đồ SVG: 3 biểu đồ, 6 cột", (await page.locator("svg.chart-svg").count()) === 3 && (await page.locator("rect.chart-bar").count()) === 6);
  check("biểu đồ có bảng dữ liệu cho trình đọc màn hình", (await page.locator("table.sr-only").count()) === 3);
  await page.locator("input[role=combobox]").fill("dua");
  check("Combobox lọc không phân biệt dấu", (await page.locator("[role=option]").allTextContents()).join() === "Dưa hấu");
  await page.keyboard.press("ArrowDown"); await page.keyboard.press("Enter");
  check("Combobox chọn bằng bàn phím", (await page.locator("input[role=combobox]").inputValue()) === "Dưa hấu");
  await page.locator(".switch-track").first().click();
  check("Switch đổi trạng thái", (await page.locator("[role=switch]").first().getAttribute("aria-checked")) === "false");
  await page.locator("[role=radio]").first().focus();
  const r0 = await page.locator("[role=radio]").count();
  check("Rating có 5 nút", r0 >= 5);
  const acc = page.locator(".accordion button[aria-expanded]");
  await acc.nth(1).click();
  check("Accordion mở mục thứ hai", (await acc.nth(1).getAttribute("aria-expanded")) === "true");
  await page.locator("button:has-text('Mở ngăn kéo')").click();
  check("Drawer mở", (await page.locator(".drawer").count()) === 1);
  await page.keyboard.press("Escape");
  check("Drawer đóng bằng Esc", (await page.locator(".drawer").count()) === 0);
  check("không thuộc tính children rò ra DOM", (await page.locator("[children]").count()) === 0);

  await page.goto(base + "/#/khong-ton-tai");
  await page.waitForSelector(".card h2");
  check("trang 404", (await page.textContent(".card h2")) === "404");

  check("không có lỗi/cảnh báo console, không vi phạm CSP", problems.length === 0, "\n      " + problems.join("\n      "));
  await browser.close(); server.close();
  const bad = results.filter((x) => !x).length;
  console.log(`\n${results.length - bad}/${results.length} kiểm tra trình duyệt qua`);
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
