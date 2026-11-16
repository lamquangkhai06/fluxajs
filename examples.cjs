// examples.cjs - mở từng ứng dụng mẫu bằng file:// trên Chromium thật, bấm thử và đòi không có lỗi/cảnh báo console.
const path = require("path");
const { chromium } = require("playwright");
let failed = 0;
const check = (n, ok, x = "") => { if (!ok) failed++; console.log(ok ? "  ✓" : "  ✗", n, ok ? "" : x); };
const url = (f) => "file://" + path.join(__dirname, "examples", f);
(async () => {
  const browser = await chromium.launch();
  const open = async (f) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const problems = [];
    page.on("console", (m) => { if (["error", "warning"].includes(m.type())) problems.push(m.text()); });
    page.on("pageerror", (e) => problems.push(e.message));
    await page.goto(url(f));
    return { page, problems, ctx };
  };

  console.log("index");
  { const { page, problems, ctx } = await open("index.html");
    check("trang chủ có 4 liên kết", (await page.$$("a[href$='.html']")).length === 4);
    check("index: không lỗi console", problems.length === 0, problems.join(" | ")); await ctx.close(); }

  console.log("todo");
  { const { page, problems, ctx } = await open("todo.html");
    await page.waitForSelector("h1");
    const before = (await page.$$("li")).length;
    await page.fill("input[type=text], input.input", "việc kiểm thử"); await page.press("input.input", "Enter");
    check("thêm việc", (await page.$$("li")).length === before + 1);
    await page.reload(); await page.waitForSelector("h1");
    check("persist: tải lại vẫn còn", (await page.$$("li")).length === before + 1);
    check("todo: không lỗi console", problems.length === 0, problems.join(" | ")); await ctx.close(); }

  console.log("chi-tieu");
  { const { page, problems, ctx } = await open("chi-tieu.html");
    await page.waitForSelector("h1");
    check("render có bảng + progress", !!(await page.$("table")) && !!(await page.$("[role=progressbar]")));
    check("chi-tieu: không lỗi console", problems.length === 0, problems.join(" | ")); await ctx.close(); }

  console.log("ghi-chu");
  { const { page, problems, ctx } = await open("ghi-chu.html");
    await page.waitForSelector("h1");
    await page.click("ul.plain li button");
    await page.fill("textarea", "nội dung mới");
    check("sửa bằng model hai chiều", (await page.inputValue("textarea")) === "nội dung mới");
    await page.click("button:has-text('+ Ghi chú')");
    check("thêm ghi chú → 2 mục", (await page.$$("ul.plain li")).length === 2);
    await page.fill("input[type=search]", "zzzz"); await page.waitForTimeout(350);
    check("tìm không thấy → báo trống", (await page.textContent("body")).includes("Không có ghi chú phù hợp"));
    await page.fill("input[type=search]", "");
    await page.click("button:has-text('Ghim')");
    check("ghim đổi nhãn", !!(await page.$("button:has-text('Bỏ ghim')")));
    await page.reload(); await page.waitForSelector("h1");
    check("persist ghi chú", (await page.$$("ul.plain li")).length === 2);
    check("ghi-chu: không lỗi console", problems.length === 0, problems.join(" | ")); await ctx.close(); }

  console.log("dashboard");
  { const { page, problems, ctx } = await open("dashboard.html");
    check("hiện Skeleton khi đang tải", !!(await page.$(".skeleton")));
    await page.waitForSelector("table", { timeout: 5000 });
    check("xong tải: có bảng 5 hàng", (await page.$$("tbody tr")).length === 5);
    await page.click("button:has-text('EN')");
    check("đổi sang tiếng Anh", (await page.textContent("h1")).includes("Dashboard") && (await page.getAttribute("html", "lang")) === "en");
    await page.click(".theme-toggle");
    check("đổi giao diện tối", (await page.getAttribute("html", "data-theme")) === "dark");
    check("dashboard: không lỗi console", problems.length === 0, problems.join(" | ")); await ctx.close(); }

  await browser.close();
  console.log(failed ? `\n${failed} thất bại` : "\nTất cả đạt");
  process.exit(failed ? 1 : 0);
})();
