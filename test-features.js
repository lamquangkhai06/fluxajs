import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { setLocation, firePop, fire, serialize } from "./fake-dom.js";

// TypeScript chỉ cần cho 2 test biên dịch JSX thật; không có thì các test đó được bỏ qua
let ts = null;
try {
  ts = createRequire(import.meta.url)("typescript");
} catch {
  try {
    const root = execSync("npm root -g", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    ts = createRequire(root + "/")("typescript");
  } catch {
    /* không có TypeScript */
  }
}
import {
  signal, computed, effect, h, tags, mount, Fragment, onMounted, onUnmounted, onUpdated, unmountAll, watch, emit, createStore,
  onError, createRoot, model, resource, show, choose,
} from "./fluxa.js";
import { createRouter } from "./fluxa-router.js";
import { jsx, jsxs, Fragment as JF } from "./jsx-runtime.js";
import fluxaPlugin from "./vite-plugin-fluxa.js";

// esbuild (bộ biên dịch JSX mà Vite dùng) chỉ cần cho vài test; không có thì các test đó được bỏ qua
let esbuild = null;
try {
  esbuild = createRequire(import.meta.url)("esbuild");
} catch {
  try {
    const root = execSync("npm root -g", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    esbuild = createRequire(root + "/")("esbuild");
  } catch {
    /* không có esbuild */
  }
}

const tick = () => new Promise((r) => setTimeout(r, 0));
const errors = [];
onError((e) => errors.push(e.message));

let passed = 0;
const failed = [];
const test = async (name, fn) => {
  errors.length = 0;
  try {
    await fn();
    passed++;
    console.log("  ✓", name);
  } catch (e) {
    failed.push(name);
    console.log("  ✗", name, "\n     ", e.message);
  }
};
const { div, span } = tags;
const render = (view) => {
  const root = document.createElement("div");
  const stop = mount(root, view);
  return { root, stop };
};

console.log("Vòng đời và component");

await test("onMounted chạy một lần sau khi gắn; onUnmounted chạy khi bị gỡ", async () => {
  const show = signal(true);
  let mounted = 0, un = 0;
  const Comp = () => {
    onMounted(() => { mounted++; });
    onUnmounted(() => un++);
    return span("c");
  };
  render(() => div(() => (show() ? h(Comp) : null)));
  assert.equal(mounted, 0, "chưa chạy trong lúc đang dựng");
  await tick();
  assert.equal(mounted, 1);
  show.set(false);
  await tick();
  assert.equal(un, 1);
  assert.equal(mounted, 1);
});

await test("onMounted không chạy nếu component bị gỡ trước đó; hàm trả về được dọn khi gỡ", async () => {
  let ran = 0;
  const C = () => { onMounted(() => { ran++; }); return span("x"); };
  const { stop } = render(() => h(C));
  stop();
  await tick();
  assert.equal(ran, 0);

  let cleaned = 0;
  const D = () => { onMounted(() => () => cleaned++); return span("y"); };
  const r = render(() => h(D));
  await tick();
  r.stop();
  assert.equal(cleaned, 1);
});

await test("thân component không đăng ký phụ thuộc vào effect cha", async () => {
  const s = signal(0);
  let builds = 0;
  const C = () => { builds++; s(); return span("x"); };
  render(() => div(() => h(C)));
  s.set(1);
  await tick();
  assert.equal(builds, 1);
});

await test("effect tạo trong component bị dọn khi component bị gỡ", async () => {
  const show = signal(true), n = signal(0);
  let runs = 0;
  const C = () => { effect(() => { n(); runs++; }); return span("x"); };
  render(() => div(() => (show() ? h(C) : null)));
  n.set(1);
  await tick();
  assert.equal(runs, 2);
  show.set(false);
  await tick();
  n.set(2);
  await tick();
  assert.equal(runs, 2);
});

await test("component ném lỗi: phạm vi được dọn, lỗi vẫn ném ra", () => {
  const Bad = () => { throw new Error("hỏng"); };
  assert.throws(() => render(() => h(Bad)), /hỏng/);
});

await test("Fragment gom nhiều con không cần phần tử bọc", () => {
  const { root } = render(() => div(h(Fragment, null, span("a"), span("b"))));
  assert.equal(root.childNodes[0].textContent, "ab");
  assert.equal(root.childNodes[0].childNodes.filter((c) => c.nodeType === 1).length, 2);
});

await test("key bị bỏ qua, htmlFor thành for", () => {
  const el = div({ key: "k", id: "x" });
  assert.equal(el.getAttribute("key"), null);
  assert.equal(el.getAttribute("id"), "x");
  assert.equal(h("label", { htmlFor: "abc" }).getAttribute("for"), "abc");
});

await test("watch: gọi cb với giá trị mới/cũ, hỗ trợ immediate và dừng", async () => {
  const s = signal(1);
  const seen = [];
  const stop = watch(s, (v, old) => seen.push([v, old]));
  assert.deepEqual(seen, []);
  s.set(2);
  await tick();
  assert.deepEqual(seen, [[2, 1]]);
  stop();
  s.set(3);
  await tick();
  assert.equal(seen.length, 1);
  const seen2 = [];
  watch(s, (v, old) => seen2.push([v, old]), { immediate: true });
  assert.deepEqual(seen2, [[3, undefined]]);
  assert.throws(() => watch(1, 2), /needs two functions/);
});

await test("emit gọi onXxx của cha, không phân biệt hoa thường", () => {
  const got = [];
  assert.equal(emit({ onChange: (a, b) => got.push([a, b]) }, "change", 1, 2), true);
  assert.equal(emit({ onchange: (a) => got.push(a) }, "change", 9), true);
  assert.equal(emit({}, "change"), false);
  assert.equal(emit({ onChange: "not a fn" }, "change"), false);
  assert.equal(emit(null, "change"), false);
  assert.equal(emit({ onX: () => {} }, "x y"), false, "tên không hợp lệ");
  assert.deepEqual(got, [[1, 2], 9]);
});

console.log("\nStore");

await test("store phản ứng theo từng khóa, chia sẻ giữa các component", async () => {
  const store = createStore({ count: 0, name: "a" });
  const seenCount = [], seenName = [];
  effect(() => seenCount.push(store.count));
  effect(() => seenName.push(store.name));
  store.count = 1;
  await tick();
  assert.deepEqual(seenCount, [0, 1]);
  assert.deepEqual(seenName, ["a"], "khóa khác không bị chạy lại");
  store.count = 1;
  await tick();
  assert.deepEqual(seenCount, [0, 1], "giá trị không đổi thì không chạy lại");
  const { root } = render(() => div(() => `n=${store.count}`));
  store.count = 5;
  await tick();
  assert.equal(root.textContent, "n=5");
});

await test("store: thêm / xóa khóa và liệt kê khóa", async () => {
  const store = createStore({ a: 1 });
  const keys = [], missing = [];
  effect(() => keys.push(Object.keys(store).join(",")));
  effect(() => missing.push(store.b));
  store.b = 2;
  await tick();
  assert.deepEqual(keys, ["a", "a,b"]);
  assert.deepEqual(missing, [undefined, 2], "đọc khóa chưa có sẽ cập nhật khi khóa được thêm");
  delete store.b;
  await tick();
  assert.deepEqual(keys, ["a", "a,b", "a"]);
  assert.deepEqual(missing, [undefined, 2, undefined]);
  store.b = 3;
  await tick();
  assert.deepEqual(missing, [undefined, 2, undefined, 3], "thêm lại khóa đã xóa vẫn phản ứng");
  assert.equal("a" in store, true);
  assert.equal("zz" in store, false);
});

await test("store từ chối khóa nguy hiểm và không gây prototype pollution", () => {
  const store = createStore({});
  assert.throws(() => { store.__proto__ = { polluted: 1 }; }, /not allowed/);
  assert.throws(() => { store.constructor = 1; }, /not allowed/);
  assert.throws(() => createStore(JSON.parse('{"__proto__": {"x": 1}}')), /not allowed/);
  assert.throws(() => { store[Symbol("s")] = 1; }, /not allowed/);
  assert.throws(() => Object.defineProperty(store, "a", { value: 1 }), /assign/);
  assert.equal({}.polluted, undefined);
  assert.equal(store.__proto__, undefined);
  assert.equal(store.constructor, undefined);
  assert.throws(() => createStore(null), TypeError);
  assert.throws(() => createStore([]), TypeError);
});

await test("đọc nhiều khóa lạ không tạo thêm signal (không phình bộ nhớ)", () => {
  const store = createStore({ a: 1 });
  for (let i = 0; i < 1000; i++) store["k" + i];
  assert.deepEqual(Object.keys(store), ["a"]);
});

console.log("\nJSX");

await test("jsx-runtime: jsx / jsxs / Fragment / component", () => {
  const el = jsx("div", { class: "a", children: "hi" });
  assert.equal(el.className, "a");
  assert.equal(el.textContent, "hi");
  const ul = jsxs("ul", { children: [jsx("li", { children: "1" }), jsx("li", { children: "2" })] });
  assert.equal(ul.childNodes.filter((c) => c.nodeType === 1).length, 2);
  let got;
  const C = (p) => { got = p; return span("c"); };
  jsx(C, { x: 1, children: "kid" }, "key");
  assert.equal(got.x, 1);
  assert.deepEqual(got.children, ["kid"]);
  assert.equal(JF, Fragment);
  assert.equal(jsx("div", { children: undefined }).childNodes.length, 0);
});

// Biên dịch JSX thật bằng TypeScript, rồi chạy kết quả với Fluxa
const compile = (src, opts) =>
  ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, ...opts },
  }).outputText;

const runModule = async (code, name) => {
  const { writeFileSync, mkdirSync } = await import("node:fs");
  mkdirSync("./.tmp", { recursive: true });
  writeFileSync(`./.tmp/${name}.mjs`, code);
  return import(`./.tmp/${name}.mjs`);
};

const jsxTest = ts ? test : async (name) => console.log("  - bỏ qua (không có TypeScript):", name);

await jsxTest("JSX thật (TypeScript, chế độ classic với pragma h)", async () => {
  const src = `
    import { h, Fragment, signal, tags } from "../fluxa.js";
    const n = signal(7);
    const Btn = (p) => <button class="btn" onClick={p.onPick}>{p.children}</button>;
    export const view = (
      <div id="root" className="x">
        <>
          <span>{n}</span>
          <Btn onPick={() => 1}>OK</Btn>
        </>
      </div>
    );
    export { n };
  `;
  const code = compile(src, { jsx: ts.JsxEmit.React, jsxFactory: "h", jsxFragmentFactory: "Fragment" }).replace(/\.\.\/fluxa\.js/, "../fluxa.js");
  const m = await runModule(code, "classic");
  assert.equal(m.view.getAttribute("id"), "root");
  assert.equal(m.view.className, "x");
  assert.equal(m.view.textContent, "7OK");
  m.n.set(8);
  await tick();
  assert.equal(m.view.textContent, "8OK");
  const btn = m.view.childNodes.filter((c) => c.nodeType === 1)[1];
  assert.equal(typeof btn.listeners.click[0], "function");
});

await jsxTest("JSX thật (TypeScript, chế độ automatic với jsx-runtime)", async () => {
  const src = `
    import { signal } from "../fluxa.js";
    const n = signal(1);
    export const view = <ul key="k">{[1, 2, 3].map((i) => <li>{i}</li>)}<li>{n}</li></ul>;
    export { n };
  `;
  const code = compile(src, { jsx: ts.JsxEmit.ReactJSX, jsxImportSource: "FLUXA_SRC" }).replace(
    /["']FLUXA_SRC\/jsx-(?:dev-)?runtime["']/g,
    '"../jsx-runtime.js"'
  );
  const m = await runModule(code, "automatic");
  assert.equal(m.view.textContent, "1231");
  m.n.set(9);
  await tick();
  assert.equal(m.view.textContent, "1239");
});

console.log("\nonUpdated và unmountAll");

await test("onUpdated: không chạy lúc dựng, gộp một lần mỗi lô, chỉ của chính component", async () => {
  const a = signal(0), b = signal(0), other = signal(0);
  const calls = [];
  const Child = () => span(() => other());
  const Comp = () => {
    onUpdated(() => calls.push("comp"));
    return div(span(() => a()), span({ title: () => String(b()) }), h(Child));
  };
  render(() => h(Comp));
  await tick();
  assert.deepEqual(calls, [], "không chạy ở lần dựng đầu");
  a.set(1); b.set(1);
  await tick();
  assert.deepEqual(calls, ["comp"], "hai thay đổi cùng lô chỉ gọi một lần");
  a.set(2);
  await tick();
  assert.equal(calls.length, 2);
  other.set(1); // thay đổi nằm trong component con
  await tick();
  assert.equal(calls.length, 2, "component con đổi không gọi hook của cha");
  onUpdated(() => {}); // ngoài component: bỏ qua, không ném lỗi
});

await test("onUpdated: tính cả effect, hook lỗi không chặn hook khác, dừng sau khi gỡ", async () => {
  const s = signal(0);
  const calls = [];
  const show = signal(true);
  const Comp = () => {
    effect(() => { s(); });
    onUpdated(() => calls.push("1"));
    onUpdated(() => { throw new Error("hook lỗi"); });
    onUpdated(() => calls.push("3"));
    return span("x");
  };
  render(() => div(() => (show() ? h(Comp) : null)));
  s.set(1);
  await tick();
  assert.deepEqual(calls, ["1", "3"]);
  assert.ok(errors.includes("hook lỗi"));
  show.set(false);
  await tick();
  s.set(2);
  await tick();
  assert.deepEqual(calls, ["1", "3"], "đã gỡ thì không chạy nữa");
});

await test("unmountAll gỡ mọi ứng dụng, dừng effect và gỡ lắng nghe popstate của router", async () => {
  const n = signal(0);
  let runs = 0;
  const a = render(() => div(() => { runs++; return n(); }));
  const b = render(() => div(() => n()));
  setLocation("http://localhost/#/a");
  const r = createRouter({ "/a": () => span("a"), "/b": () => span("b") }, { mode: "hash" });
  const c = render(() => div(r.view));
  assert.equal(c.root.textContent, "a");
  unmountAll();
  assert.equal(a.root.childNodes.length, 0);
  assert.equal(b.root.childNodes.length, 0);
  assert.equal(c.root.childNodes.length, 0);
  n.set(1);
  await tick();
  assert.equal(runs, 1);
  setLocation("http://localhost/#/b");
  firePop();
  await tick();
  assert.equal(r.path(), "/a", "router đã gỡ listener nên không đổi nữa");
  a.stop(); // gọi lại không gây lỗi
});

await test("mount: gọi hàm gỡ hai lần không xóa nhầm ứng dụng mount sau đó", () => {
  const el = document.createElement("div");
  const off1 = mount(el, () => span("một"));
  off1();
  const off2 = mount(el, () => span("hai"));
  off1();
  assert.equal(el.textContent, "hai");
  off2();
  assert.equal(el.textContent, "");
});

console.log("\nVite plugin");

await test("vite-plugin-fluxa: cấu hình classic, automatic và kiểm tra đầu vào", () => {
  const classic = fluxaPlugin().config();
  assert.equal(classic.esbuild.jsxFactory, "h");
  assert.equal(classic.esbuild.jsxFragment, "Fragment");
  assert.match(classic.esbuild.jsxInject, /^import \{ h, Fragment \} from "fluxa-ui"$/);
  const auto = fluxaPlugin({ automatic: true, importFrom: "@me/fluxa" }).config();
  assert.deepEqual(auto.esbuild, { jsx: "automatic", jsxImportSource: "@me/fluxa" });
  assert.throws(() => fluxaPlugin({ importFrom: 'x"; alert(1); "' }), /invalid importFrom/);
  assert.equal(fluxaPlugin().handleHotUpdate, undefined, "HMR do Vite xử lý qua accept/dispose, không ép tải lại toàn trang");
});

await test("vite-plugin-fluxa: HMR chỉ thêm vào file khởi động, ở cuối file, chỉ khi chạy dev server", () => {
  const entry = `import { signal, mount } from "fluxa-ui";\nmount("#app", () => 1);\n`;
  const dev = fluxaPlugin();
  dev.configResolved({ command: "serve" });
  const out = dev.transform(entry, "/p/src/main.js");
  assert.ok(out.code.startsWith(entry), "mã gốc giữ nguyên, phần thêm nằm ở cuối");
  assert.match(out.code, /import \{ unmountAll as __fluxaUnmountAll \} from "fluxa-ui";/);
  assert.match(out.code, /import\.meta\.hot\.accept\(\)/);
  assert.match(out.code, /import\.meta\.hot\.dispose\(\(\) => __fluxaUnmountAll\(\)\)/);
  assert.equal(out.map, null);
  assert.ok(dev.transform(`import { mount as m } from "./src/fluxa.js";`, "/p/a.js").code.includes('from "./src/fluxa.js"'));
  assert.equal(dev.transform(`import { h } from "fluxa-ui";`, "/p/c.js"), null, "không import mount thì bỏ qua");
  assert.equal(dev.transform(`import { mount } from "other-lib";`, "/p/c.js"), null, "mount của thư viện khác thì bỏ qua");
  assert.equal(dev.transform(`import { remount } from "fluxa-ui";`, "/p/c.js"), null);
  assert.equal(dev.transform(entry, "/p/node_modules/x/index.js"), null);
  assert.equal(dev.transform(entry, "/p/readme.md"), null);
  assert.equal(dev.transform(entry, "\0virtual:x"), null);
  assert.equal(dev.transform(entry + "if (import.meta.hot) {}", "/p/m.js"), null, "người dùng đã tự xử lý HMR");
  assert.ok(dev.transform(entry, "/p/m.jsx?v=1").code.includes("__fluxaUnmountAll"), "bỏ qua phần ?query");
  const build = fluxaPlugin();
  build.configResolved({ command: "build" });
  assert.equal(build.transform(entry, "/p/main.js"), null, "build thì không thêm HMR");
  const off = fluxaPlugin({ hmr: false });
  off.configResolved({ command: "serve" });
  assert.equal(off.transform(entry, "/p/main.js"), null, "hmr:false thì tắt");
});

await test("mô phỏng HMR: dispose gỡ app cũ, chạy lại file khởi động, store ở module không đổi giữ nguyên state", async () => {
  const { writeFileSync, mkdirSync } = await import("node:fs");
  mkdirSync("./.tmp", { recursive: true });
  writeFileSync("./.tmp/store.mjs", `import { createStore } from "../fluxa.js"; export const app = createStore({ n: 0 });`);
  const entrySrc = (label) => `
    import { mount, tags } from "../fluxa.js";
    import { app } from "./store.mjs";
    globalThis.__hmr = globalThis.__hmr || { disposers: [], root: document.createElement("div") };
    mount(globalThis.__hmr.root, () => tags.p("${label}:", () => app.n));
  `;
  // Vite cung cấp import.meta.hot cho module; ở đây giả lập nó ở đầu file (sau khi plugin đã biến đổi mã)
  const hotStub = `import.meta.hot = { accept() {}, dispose(cb) { globalThis.__hmr.disposers.push(cb); } };\n`;
  const plugin = fluxaPlugin();
  plugin.configResolved({ command: "serve" });
  const load = async (label, v) => {
    const transformed = plugin.transform(entrySrc(label), "/p/entry.js").code;
    writeFileSync(`./.tmp/entry${v}.mjs`, hotStub + transformed);
    return import(`./.tmp/entry${v}.mjs`);
  };
  await load("v1", 1);
  const { app } = await import("./.tmp/store.mjs");
  app.n = 5;
  await tick();
  const H = globalThis.__hmr;
  assert.equal(H.root.textContent, "v1:5");
  assert.equal(H.disposers.length, 1);
  H.disposers.forEach((f) => f()); // Vite gọi dispose của module cũ trước khi chạy lại
  H.disposers.length = 0;
  assert.equal(H.root.textContent, "", "app cũ đã được gỡ");
  await load("v2", 2);
  assert.equal(H.root.textContent, "v2:5", "app mới, state của store giữ nguyên");
  app.n = 6;
  await tick();
  assert.equal(H.root.textContent, "v2:6");
});

console.log("\nesbuild thật (bộ biên dịch JSX của Vite)");
const esTest = esbuild ? test : async (name) => console.log("  - bỏ qua (không có esbuild):", name);

await esTest("JSX classic với đúng cấu hình plugin sinh ra, chạy với Fluxa và giữ nguyên class kiểu Tailwind", async () => {
  const cfg = fluxaPlugin({ importFrom: "../fluxa.js" }).config().esbuild;
  const src = `
    import { signal } from "../fluxa.js";
    const n = signal(3);
    const Btn = (p) => <button class="px-4 hover:bg-blue-500 w-1/2 [&>svg]:size-4" onClick={p.onPick}>{p.children}</button>;
    export const view = <div id="r"><><span>{n}</span><Btn onPick={() => 1}>OK</Btn></></div>;
    export { n };
  `;
  const out = esbuild.transformSync(src, { loader: "jsx", format: "esm", jsxFactory: cfg.jsxFactory, jsxFragment: cfg.jsxFragment });
  // Vite chèn jsxInject lên đầu mỗi file JSX
  const m = await runModule(cfg.jsxInject + ";\n" + out.code, "es-classic");
  assert.equal(m.view.getAttribute("id"), "r");
  assert.equal(m.view.textContent, "3OK");
  m.n.set(4);
  await tick();
  assert.equal(m.view.textContent, "4OK");
  const btn = m.view.childNodes.filter((c) => c.nodeType === 1)[1];
  assert.equal(btn.className, "px-4 hover:bg-blue-500 w-1/2 [&>svg]:size-4");
  assert.equal(typeof btn.listeners.click[0], "function");
});

await esTest("JSX automatic với jsx-runtime", async () => {
  const out = esbuild.transformSync(
    `import { signal } from "../fluxa.js";
     const n = signal(1);
     export const view = <ul>{[1, 2].map((i) => <li>{i}</li>)}<li>{n}</li></ul>;
     export { n };`,
    { loader: "jsx", format: "esm", jsx: "automatic", jsxImportSource: "FLUXA_SRC" }
  );
  const code = out.code.replace(/["']FLUXA_SRC\/jsx-(?:dev-)?runtime["']/g, '"../jsx-runtime.js"');
  const m = await runModule(code, "es-automatic");
  assert.equal(m.view.textContent, "121");
  m.n.set(7);
  await tick();
  assert.equal(m.view.textContent, "127");
});

await esTest("mã sau esbuild rồi plugin thêm HMR vẫn hợp lệ (đúng thứ tự trong Vite)", () => {
  const entry = esbuild.transformSync(`import { mount } from "fluxa-ui"; mount("#app", () => <p>hi</p>);`, {
    loader: "jsx", format: "esm", jsxFactory: "h", jsxFragment: "Fragment",
  }).code;
  const p = fluxaPlugin();
  p.configResolved({ command: "serve" });
  const res = p.transform(entry, "/p/main.jsx");
  assert.ok(res && res.code.includes("__fluxaUnmountAll"));
  esbuild.transformSync(res.code, { loader: "js", format: "esm" }); // ném lỗi nếu cú pháp sai
});

console.log("\nAPI ngắn gọn: class, ràng buộc tự động, model, resource");

await test("class nhận object và mảng, phản ứng theo signal, chuỗi cũ vẫn chạy", async () => {
  const on = signal(false);
  const { root } = render(() => div({ class: { a: true, b: () => on(), c: false } }));
  const el = root.childNodes[0];
  assert.equal(el.className, "a");
  on.set(true); await tick();
  assert.equal(el.className, "a b");
  const { root: r2 } = render(() => div({ class: ["x", null, false, { y: true }, "z"] }));
  assert.equal(r2.childNodes[0].className, "x y z");
  const { root: r3 } = render(() => div({ class: "plain" }));
  assert.equal(r3.childNodes[0].className, "plain");
});

await test("value/checked truyền signal tự ràng buộc hai chiều (không cần oninput)", async () => {
  const text = signal("a"), ok = signal(false);
  const { root } = render(() => div(tags.input({ value: text }), tags.input({ type: "checkbox", checked: ok })));
  const [i, c] = root.childNodes[0].childNodes;
  assert.equal(i.value, "a");
  i.value = "xyz"; fire(i, "input");
  assert.equal(text(), "xyz");
  text.set("q"); await tick();
  assert.equal(i.value, "q");
  c.checked = true; fire(c, "change");
  assert.equal(ok(), true);
});

await test("model(store, khóa): đọc/ghi hai chiều, từ chối khóa nguy hiểm", async () => {
  const t = createStore({ done: false });
  const m = model(t, "done");
  assert.equal(m(), false);
  m.set(true);
  assert.equal(t.done, true);
  m.set((v) => !v);
  assert.equal(t.done, false);
  const { root } = render(() => tags.input({ type: "checkbox", checked: m }));
  const c = root.childNodes[0];
  c.checked = true; fire(c, "change");
  assert.equal(t.done, true);
  t.done = false; await tick();
  assert.equal(c.checked, false);
  assert.throws(() => model(t, "__proto__"));
  assert.throws(() => model(null, "x"));
});

await test("resource: loading → data, lỗi, refetch", async () => {
  let n = 0;
  const r = resource(() => Promise.resolve(++n));
  assert.equal(r.loading(), true);
  await tick();
  assert.equal(r.data(), 1);
  assert.equal(r.loading(), false);
  r.refetch(); await tick();
  assert.equal(r.data(), 2);
  const bad = resource(() => Promise.reject(new Error("hỏng")));
  await tick();
  assert.equal(bad.error().message, "hỏng");
  assert.equal(bad.loading(), false);
  const sync = resource(() => { throw new Error("đồng bộ"); });
  await tick();
  assert.equal(sync.error().message, "đồng bộ");
});

await test("resource: phản hồi cũ đến muộn bị bỏ qua, chạy lại khi signal đổi, hủy yêu cầu cũ", async () => {
  const id = signal(1);
  const resolvers = {}, signals = [];
  const r = resource((sig) => { const k = id(); signals.push(sig); return new Promise((ok) => (resolvers[k] = ok)); });
  id.set(2); await tick();
  assert.equal(signals.length, 2);
  assert.equal(signals[0].aborted, true, "yêu cầu cũ phải bị hủy");
  resolvers[2]("mới"); await tick();
  resolvers[1]("cũ"); await tick();
  assert.equal(r.data(), "mới", "không được ghi đè bằng dữ liệu cũ");
  assert.equal(r.loading(), false);
});

await test("resource: dọn khi component bị gỡ (hủy yêu cầu, bỏ qua phản hồi)", async () => {
  let sig, done;
  const show = signal(true);
  let data;
  render(() => div(() => (show() ? h(() => { data = resource((s) => { sig = s; return new Promise((ok) => (done = ok)); }); return span("x"); }) : null)));
  show.set(false); await tick();
  assert.equal(sig.aborted, true);
  done("trễ"); await tick();
  assert.equal(data.data(), undefined);
});

console.log("\nKhai báo thay cho if/switch: show, choose");

await test("show: đổi nhánh theo điều kiện, nhánh lười, không dựng lại khi đúng/sai không đổi", async () => {
  const n = signal(1);
  let built = 0;
  const { root } = render(() => div(show(() => n() > 0, () => (built++, span("có")), () => span("trống"))));
  const box = root.childNodes[0];
  const txt = () => box.childNodes.map((c) => c.textContent ?? "").join("");
  assert.ok(txt().includes("có"));
  assert.equal(built, 1);
  n.set(5); await tick();
  assert.equal(built, 1, "n đổi nhưng vẫn đúng: không dựng lại");
  n.set(0); await tick();
  assert.ok(txt().includes("trống") && !txt().includes("có"));
  n.set(2); await tick();
  assert.equal(built, 2);
  const { root: r2 } = render(() => div(show(false, () => span("x"))));
  assert.ok(!r2.childNodes[0].childNodes.some((c) => c.textContent === "x"));
});

await test("choose: chọn theo giá trị, mặc định, không đọc khóa kế thừa", async () => {
  const k = signal("a");
  const { root } = render(() => div(choose(k, { a: "AAA", b: () => span("BBB") }, "??")));
  const box = root.childNodes[0];
  const txt = () => serialize(box).replace(/<[^>]+>/g, "");
  assert.equal(txt(), "AAA");
  k.set("b"); await tick();
  assert.equal(txt(), "BBB");
  k.set("zzz"); await tick();
  assert.equal(txt(), "??");
  k.set("constructor"); await tick();
  assert.equal(txt(), "??", "không được lấy Object.prototype.constructor");
  assert.throws(() => choose(k, null));
});

await test("resource.state: loading → ready / error, dùng được với choose", async () => {
  const ok = resource(() => Promise.resolve("x"));
  assert.equal(ok.state(), "loading");
  await tick();
  assert.equal(ok.state(), "ready");
  const bad = resource(() => Promise.reject(new Error("e")));
  await tick();
  assert.equal(bad.state(), "error");
  const { root } = render(() => div(choose(ok.state, { ready: () => span("xong") }, "chờ")));
  assert.ok(serialize(root).includes("xong"));
});

console.log("\nThói quen kiểu Vue: .value vẫn chạy, báo một lần");

await test("signal.value / computed.value đọc-ghi đúng, theo dõi phụ thuộc, chỉ báo MỘT lần", async () => {
  const n = signal(1);
  const dbl = computed(() => n() * 2);
  let seen = 0;
  effect(() => { seen = dbl.value; });
  assert.equal(seen, 2);
  n.value = 5; await tick();
  assert.equal(n(), 5);
  assert.equal(seen, 10, "đọc .value trong effect vẫn được theo dõi");
  const warns = errors.filter((m) => m.includes(".value"));
  assert.equal(warns.length, 1, "chỉ báo một lần, không spam");
  assert.throws(() => { "use strict"; dbl.value = 3; }, TypeError);
});

import("node:fs").then(({ rmSync }) => rmSync("./.tmp", { recursive: true, force: true }));
console.log(`\n${passed} test qua, ${failed.length} lỗi`);
if (failed.length) {
  console.log("Lỗi:", failed.join("; "));
  process.exit(1);
}
