<p align="center"><img src="brand/fluxa-logo.svg" alt="Fluxa" width="320"></p>

<p align="center"><b>English</b> | <a href="README.vi.md">Tiếng Việt</a></p>

# Fluxa.js

A tiny UI framework built on **signals**: no virtual DOM, no dependencies, no required build step, and **secure by default**. It ships with a router, a store, JSX support, a UI component kit and a Vite plugin.

The single-file bundle `dist/fluxa.global.js` (core + router + extras + UI kit, minified) is **58.8 KB, about 21.3 KB gzipped** (measured at the 0.10.0 build; a slimmer `dist/fluxa.lite.global.js` without inputs and charts is 42.7 KB / 15.8 KB gzipped). `fluxa.css` is about 13 KB unminified. The modules can also be used on their own: `fluxa.js`, `fluxa-router.js`, `fluxa-extras.js`, `fluxa-components.js`, `fluxa-inputs.js`, `fluxa-charts.js`, `jsx-runtime.js`.

I have not benchmarked speed against React/Vue yet. "Fast" here is a design property (only the nodes that need to change are updated, no tree diffing), not a measured number.

## Get started in one minute (nothing to install)

1. Copy `starter.html`, `fluxa.css` and the `dist/` folder into the same directory.
2. **Double-click `starter.html`.** It just runs: no Node, Vite, npm or server needed (tested via `file://` in Chromium).
3. Edit the code in the `<script>` tag and reload the page.

`dist/fluxa.global.js` is **the whole framework (core, router, extras, UI kit) in one file, about 21 KB gzipped**, and creates a global `Fluxa` variable. If you want an ES module, use `dist/fluxa.bundle.js`. To rebuild it yourself: `npm i -D esbuild && npm run build`.

> Note: `starter.html` uses an inline `<script>` tag to keep things simple. For a real product with a strict CSP (see `index.html`), move the code into a separate `.js` file.

## Vibe coding: let an AI write your Fluxa app

Fluxa is small and consistent, so an AI can learn almost all of it in one read. How to use it:

1. Paste the contents of [`AI.md`](AI.md) (Vietnamese) into your AI assistant (Claude, ChatGPT, ...).
2. Describe the app you want, for example: *"write a single index.html that tracks expenses, using Fluxa as described above"*.
3. Save the result next to `dist/` and `fluxa.css`, and double-click to run.

Why it suits this workflow:
- **One way to do each thing** (`signal`, `show`, `choose`, `list`, `model`, `resource`), so there is little room for an AI to invent APIs.
- **Every example in `AI.md` is actually executed** by the test suite (`test-ai.js`), so the AI learns from examples that work.
- **Common mistakes are documented** (writing `p("Total: " + n())` instead of `p(() => ...)`, mutating arrays in place, ...). The Vue habit `n.value` still works and prints the preferred form once, instead of failing silently.
- **Safe even when the AI gets it wrong:** HTML strings from users are always plain text, and `javascript:` URLs and string handlers like `onclick="..."` are blocked.

What is not verified: I have not measured what percentage of Fluxa code an AI generates correctly. `AI.md` is designed to help, not to guarantee. Try it and tell me where the AI goes wrong so I can add it to the "common mistakes" section.

## Running locally (for developers)

ES modules must be served over HTTP (they don't work when opened directly via `file://`). Pick one:

```bash
npx serve .                      # needs Node.js
python -m http.server 8000       # needs Python (on Windows it is usually `python`, not `python3`)
```

Or use the VS Code **Live Server** extension (right-click `index.html` → Open with Live Server). The demo uses the router in `hash` mode, so it works with any static server. Live Server injects an inline script, so the CSP in `index.html` may block its auto-reload; the page still works normally.

Tests:

```bash
npm test          # unit tests: core, router, store, JSX, Vite plugin, UI, extras (fake DOM in Node)
                  # also run `npm i -D typescript esbuild` to run the 5 real JSX compile tests; they are skipped otherwise
npm run test:e2e  # 57 checks in real Chromium (needs: npm i -D playwright && npx playwright install chromium)
```

## Quick start

```js
import { signal, computed, tags, mount } from "./fluxa.js";
const { div, button, span } = tags;

const count = signal(0);
const double = computed(() => count() * 2);

mount("#app", () =>
  div(
    button({ onclick: () => count.set((c) => c + 1) }, "+"),
    span(count),                        // pass a signal: updates automatically
    span(() => `double: ${double()}`)   // pass a function: reactive content
  )
);
```

The core rule: **a component runs only once**. A prop or child that is a **function** is reactive; `onXxx` is an event (it must be a function).

## Core API (`fluxa.js`)

| API | Meaning |
|---|---|
| `signal(v)` | Reactive value. `s()` reads, `s.set(v \| fn)` writes, `s.peek()` reads without tracking |
| `computed(fn)` | Derived value, lazily computed and always fresh |
| `effect(fn)` | Re-runs when a signal read inside changes; `fn` may return a cleanup function |
| `watch(source, cb, {immediate})` | Calls `cb(new, old)` when `source()` changes |
| `untrack(fn)` / `onCleanup(fn)` / `createRoot(fn)` | Don't track / clean up / own scope |
| `onMounted(fn)` | Runs after the component is attached; `fn` may return a cleanup function |
| `onUnmounted(fn)` | Runs when the component is removed |
| `onUpdated(fn)` | Runs after this component's own reactive parts have updated |
| `unmountAll()` | Unmounts every mounted app and cleans up the router (the Vite plugin calls it on HMR) |
| `emit(props, "change", v)` | Fire an event to the parent: calls `props.onChange(v)` |
| `createStore(obj)` | Global store, reactive per key |
| `model(store, "key")` | Two-way binding for one store field: `input({ checked: model(t, "done") })` |
| `resource(fetcher)` | Async data: `.data()` `.loading()` `.error()` `.state()` `.refetch()` |
| `show(condition, ifTrue, ifFalse)` | Conditional content, no `? :` needed |
| `choose(value, { key: content }, default)` | Pick content by value, no `if / else if / switch` needed |
| `tags` / `svgTags` | `div({class:"a"}, "hello")`; `svgTags` for SVG |
| `h(tag, props, ...kids)` / `Fragment` | The long form; if `tag` is a function it is a component |
| `list(items, render)` | Keyed list |
| `mount(root, view)` | Mount an app; returns an unmount function |
| `onError(fn)` | Receives every framework error and security warning |
| `safeUrl(v)` / `unsafeHTML(html, sanitize)` | Filter a URL / insert raw HTML (a sanitizer function is required) |

### Lifecycle

```js
function Clock() {
  const now = signal(new Date());
  onMounted(() => {
    const t = setInterval(() => now.set(new Date()), 1000);
    return () => clearInterval(t);          // runs when the component is removed
  });
  return span(() => now().toLocaleTimeString());
}
```

`onUpdated` differs from React/Vue: the component **does not re-render**, so it runs after the reactive parts *inside* the component (dynamic content, dynamic attributes, `effect`, `watch`) have finished updating, once per batch of changes. It does not run on the first render (use `onMounted`), and it does not run when only a child component changes.

```js
function Chat() {
  const messages = signal([]);
  const box = div({ class: "chat" }, list(messages, (m) => p(m)));
  onUpdated(() => { box.scrollTop = box.scrollHeight; }); // scroll to the bottom after new messages
  return box;
}
```

To watch a single value (with its previous value), use `watch(source, cb)`.

### Events from child to parent

```js
function Rating(props) {
  return button({ onclick: () => emit(props, "change", 5) }, "5 stars");
}
h(Rating, { onChange: (v) => console.log(v) });
```

## Write less: the shortcuts

Fluxa tries to make the shortest way to write something also the most correct way. All of these are **additive**; existing code keeps working.

**1. Passing a signal to `value` / `checked` gives you two-way binding** (no `oninput` needed):

```js
const name = signal("");
input({ value: name });                       // typing changes name; name.set(...) updates the input
input({ type: "checkbox", checked: done });
```

**2. `class` accepts an object or an array**, and function values are reactive:

```js
li({ class: { done: () => t.done, hot: isHot } }, t.text);
div({ class: ["card", () => open() && "open"] });
```

**3. `model(store, key)`** connects a store field to an input without a separate signal:

```js
const t = createStore({ text: "Learn Fluxa", done: false });
input({ type: "checkbox", checked: model(t, "done") });
```

**4. `resource(fetcher)`** bundles `loading` / `error` / `data` and handles the usual pitfalls: it cancels the previous request when parameters change, ignores late responses, and cleans up when you leave the page:

```js
const user = resource((signal) => fetch(`/api/users/${id()}`, { signal }).then((r) => r.json()));
p(() => (user.loading() ? "Loading…" : user.error() ? "Error" : user.data().name));
```

**5. `show(condition, yes, no)`** replaces `? :` and `if`. A branch written as a function is only built when needed, and only rebuilt when the true/false result changes (not every time data inside it changes):

```js
show(() => !items().length, () => p("Nothing to do yet"));
show(loggedIn, () => p("Welcome!"), () => p("Please sign in"));
```

**6. `choose(value, { key: content }, default)`** replaces `if / else if` chains and `switch`. Combine it with `resource(...).state()` to handle all three states without nested conditions:

```js
p(choose(user.state, {
  loading: "Loading…",
  error: "Failed to load",
  ready: () => `Hello, ${user.data().name}`,
}));
```

Together with `list(...)` (instead of loops) and `computed(...)` (instead of dependency arrays), people who aren't comfortable with loops, recursion or nested conditions can still build a UI by **declaring** "what shows when", rather than writing algorithms.

Note: `resource` re-runs only when a signal read **synchronously** in the `fetcher` (before the first `await`) changes. Use `user.refetch()` to reload by hand.

### Comparison

The "Todo" demo page rewritten with these shortcuts: `Todo()` went from **44 to 35 lines** and has no `oninput` left. That is a real measurement on the code in this repo. The table below is an **illustration** (not a benchmark) of the same task, "a two-way input plus loading data":

| | Fluxa | React (hooks) |
|---|---|---|
| Two-way input | `input({ value: name })` | `const [name, setName] = useState(""); <input value={name} onChange={e => setName(e.target.value)} />` |
| Load data, cancel when parameters change | `resource(...)` | `useEffect` + `AbortController` + a flag to ignore stale responses, or a library (TanStack Query, SWR) |
| Derived value | `computed(() => a() * 2)` | `useMemo(() => a * 2, [a])` (you declare the dependency array yourself) |

Vue's `v-model` and `computed` are similarly short; the difference is that Fluxa needs no template compile step. The canonical Fluxa style is `s()` to read and `s.set(x)` to write (consistent with `computed` and reactive functions). Vue-style `.value` still works but prints a warning once, because AI-generated code often uses it. Shorter does not mean more complete: React/Vue have an ecosystem, devtools, SSR and a community that Fluxa does not have yet.

### Shared store

```js
const app = createStore({ user: null, clicks: 0 });

// in component A
button({ onclick: () => app.clicks++ }, "Click");
// in component B (unrelated to A)
span(() => `Clicked: ${app.clicks}`);
```

The store is reactive at a **shallow** level: assign a new value (`app.user = { ...app.user, name: "B" }`) instead of mutating inside a nested object.

### Keyed lists

```js
const items = signal([{ id: 1, text: "A" }, { id: 2, text: "B" }]);
ul(list(items, (item, index) => li(item.text, " #", () => index())));
```

The key is the **identity of the item**: an item that stays the same keeps its DOM, and only the needed nodes are created, removed or moved. Update data **immutably**:

```js
items.set((a) => a.map((t) => (t.id === 2 ? { ...t, text: "B2" } : t))); // only item B is rebuilt
```

## Router (`fluxa-router.js`)

```js
import { createRouter } from "./fluxa-router.js";

const router = createRouter(
  {
    "/": Home,
    "/user/:id": ({ params, query }) => div("User ", params.id, " ", () => query().tab),
    "*": NotFound,
  },
  { mode: "hash" } // or "history" (default), { base: "/app" }, { beforeEach }
);

mount("#app", () => div(
  router.link({ href: "/" }, "Home"),
  router.link({ href: "/user/42?tab=info" }, "User"),
  div(router.view),            // changing page only rebuilds this part
));
router.navigate("/user/7");
```

- More specific routes win: `/user/new` before `/user/:id`, and the wildcard `*` comes last.
- `mode: "history"` needs the server to return `index.html` for every path (for example `npx serve -s`). `mode: "hash"` does not.
- `beforeEach(dest)` returns `true`, `false` or a path to redirect to. **A guard is a UX feature, not security**; real access control must be checked on the server.
- `router.view` must be **a child of an element** (`div(router.view)`), not passed directly to `mount`.

## UI components (`fluxa-components.js`)

```js
import { Button, Input, Select, Checkbox, Card, Badge, Alert, Spinner, Modal, Tabs, createToaster } from "./fluxa-components.js";
```

| Component | Notes |
|---|---|
| `Button` | `variant`: primary / ghost / danger; `size`: sm / md / lg; `loading`, `disabled` accept a boolean, a signal or a function |
| `Input`, `Select`, `Checkbox` | Labels linked via `for`/`id`, hints, errors (`aria-invalid`, `aria-describedby`). Pass a **signal** to `value`/`checked` for two-way binding |
| `Card`, `Badge`, `Alert`, `Spinner` | Display components; `Alert` has a `role` per severity and a close button when `onClose` is given |
| `Modal` | `open` is a signal. `role="dialog"`, `aria-modal`, closes with Esc or a click on the backdrop, traps Tab inside, locks page scroll, restores focus on close |
| `Tabs` | Keyboard ← → Home End; tab content given as a function is built only when selected |
| `createToaster()` | `const t = createToaster(); h(t.Toaster)` once, then `t.show("Saved", { tone: "success" })` |

```js
const email = signal("");
const err = computed(() => (email() && !email().includes("@") ? "Invalid email" : ""));
h(Input, { label: "Email", type: "email", value: email, error: err, hint: "Example: you@example.com" });

const open = signal(false);
h(Button, { onclick: () => open.set(true) }, "Delete…");
h(Modal, { open, title: "Delete this item?" }, "This cannot be undone.");
```

Added in 0.9: `Table` (3-state sorting, reads only the row's own properties), `Pagination`, `Dropdown` (keyboard ↑ ↓ Esc), `Tooltip` (Esc to dismiss, per WCAG), `Progress`, `Skeleton`, `Avatar` (images go through the URL filter).

The UI components use classes from `fluxa.css`, so load that file. Dark mode is supported out of the box in `fluxa.css` (follows the OS, or use `createTheme()` to let users choose).

### New in 0.10

**Forms:** `Textarea` (with character counter), `RadioGroup`, `Switch`, `Slider`, `Rating` (keyboard: arrows, Home, End). **Layout and navigation:** `Accordion`, `Breadcrumb`, `Drawer` (left/right/bottom), `Stepper`, `Popover`.

**Advanced inputs** (`import { Combobox, FileInput, DatePicker } from "fluxa-ui/inputs"`): `Combobox` (ARIA combobox, accent-insensitive search), `FileInput` (drag and drop, type/size/count checks), `DatePicker` (full keyboard control, `YYYY-MM-DD` value, no dependencies). Client-side file checks are a UX aid only; **always validate uploads on the server.**

**SVG charts** (`import { LineChart, BarChart, DonutChart } from "fluxa-ui/charts"`): pure SVG, no dependencies, reactive data, every chart ships a hidden data table for screen readers, and labels are always rendered as plain text. Capped at 1000 points and 12 series.

```js
h(LineChart, { title: "Revenue", data: [{ label: "Jan", value: 12 }, { label: "Feb", value: 19 }] })
```

See the live demo at the `/more` route of the demo app. Tested on Chromium only.

## Extras (`fluxa-extras.js`, included in the single-file bundle)

```js
import { persist, form, rules, createI18n, createTheme, debounced, media, online, history } from "fluxa-ui/extras";
```

| Function | Purpose |
|---|---|
| `persist(signal, "key")` | Saves to localStorage and restores it. Safe JSON parsing (drops `__proto__`, ...), 1,000,000-character cap, no error if localStorage is blocked |
| `form({ name: { value: "", rules: [rules.required()] } }, { onSubmit })` | Form + validation; errors show only after the field is touched or the form is submitted; blocks double submit |
| `createI18n({ vi: {...}, en: {...} })` | Multi-language: `{param}` is always plain text, plurals via `Intl.PluralRules`, `i18n.text("key")` updates automatically when the language changes |
| `createTheme()` | Light / dark / follow system, remembers the choice: `theme.toggle()` |
| `debounced(signal, 300)` | A "slow" version of a signal, good for search boxes |
| `media("(max-width: 600px)")` | `true/false` following a media query |
| `online()` | `true/false` whether the device is online |
| `history(signal)` | `undo()`, `redo()`, `canUndo()`, `canRedo()` (remembers up to 100 steps) |

## Example apps (`examples/`)

Each app is a single HTML file you can double-click to run: To-do, Expense tracker, Notes, Dashboard (Vietnamese/English + light/dark). Open `examples/index.html`. Test them in real Chromium with `npm run test:examples`.

## JSX

**Option 1: the `h` pragma (classic):**

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
- Babel: `@babel/plugin-transform-react-jsx` with `{ pragma: "h", pragmaFrag: "Fragment" }`.

**Option 2: the automatic runtime:** set `"jsx": "react-jsx"` and `"jsxImportSource": "fluxa-ui"` in tsconfig; Fluxa provides `fluxa-ui/jsx-runtime`.

Note: reactive content must be a function: write `{count}` (a signal) or `{() => count() * 2}`, not `{count() * 2}` (that runs only once).

## Vite

```js
// vite.config.js
import { defineConfig } from "vite";
import fluxa from "fluxa-ui/vite";

export default defineConfig({ plugins: [fluxa()] });          // classic: injects the h, Fragment import
// fluxa({ automatic: true })                                 // use the jsx-runtime
// fluxa({ importFrom: "./src/fluxa.js" })                     // import from a different path
```

If the `esbuild` options the plugin injects are not picked up by your Vite version, declare them directly:

```js
esbuild: { jsxFactory: "h", jsxFragment: "Fragment", jsxInject: `import { h, Fragment } from "fluxa-ui"` }
```

### State-preserving HMR

The plugin enables HMR by default. Any file that imports `mount` from Fluxa (your app's entry file) gets this appended **at the end of the file**:

```js
import { unmountAll as __fluxaUnmountAll } from "fluxa-ui";
if (import.meta.hot) { import.meta.hot.accept(); import.meta.hot.dispose(() => __fluxaUnmountAll()); }
```

When you edit a component, Vite re-runs the entry file: the old app is torn down cleanly (effects, router, `createToaster` timers, ...) and then mounted again. Modules that were **not edited** (for example the file holding your `createStore`) are kept, so their state survives, while state inside the edited component itself is recreated. Turn it off with `fluxa({ hmr: false })` (Vite then reloads the whole page), or write your own `import.meta.hot` in the entry file (the plugin will stay out of the way).

### Tailwind CSS

Fluxa assigns `class` straight to the DOM, so no special setup is needed. With Tailwind v4 and Vite:

```js
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({ plugins: [fluxa(), tailwindcss()] });
```

```css
/* src/style.css */
@import "tailwindcss";
```

```jsx
<button class="px-4 hover:bg-blue-500 md:px-8 [&>svg]:size-4">Save</button>
<div class={() => cx("rounded-xl border", open() && "bg-blue-500")}>…</div>
```

Write class names out in full in the source (don't build them like `"bg-" + color`) so Tailwind can find them. The default UI components use `fluxa.css`; you can use both side by side, or replace them with Tailwind classes via the `class` prop.

## The highlight: secure by default, and you can verify it yourself

Fluxa's difference is not "fastest" or "smallest" (I have no benchmarks, and Preact/Solid are still lighter). The difference is: **the simplest way to write something is also the safest way**, and you can prove that yourself.

```bash
npm run test:security   # needs playwright + chromium
```

This command builds a page under a strict CSP and Trusted Types, throws dozens of attack payloads at every input path (content, attributes, URLs, styles, tag names, string event handlers, SVG animate, store keys, the router) and checks in **real Chromium** that: no code runs, no dialogs appear, no dangerous tags/attributes end up in the DOM, no prototype pollution happens, and the router cannot be redirected off-site. I deliberately broke three protection layers (URL filtering, string-handler blocking, Trusted Types) and the suite failed each time, so it is not an "always green" test.

**Trusted Types:** if your page enables `require-trusted-types-for 'script'`, `unsafeHTML` wraps the output of your sanitizer in a policy named `fluxa`. Add this to your CSP: `require-trusted-types-for 'script'; trusted-types fluxa`. If your sanitizer (for example DOMPurify with `RETURN_TRUSTED_TYPE`) already returns TrustedHTML, it is used as is.

What the suite does **not** prove: it is not an independent audit, it only ran on Chromium, and absolute `http(s)` URLs to any host are valid by design (restricting hosts is the CSP's job, see SECURITY.md).

## Security summary

| Threat | How Fluxa handles it |
|---|---|
| XSS via content | Text always goes through `createTextNode`; only `unsafeHTML` (which requires a sanitizer) inserts HTML |
| `javascript:` / `data:` in `href`, `src`, ... | Only `http`, `https`, `mailto`, `tel` and relative URLs are allowed |
| `onclick="..."` | Events accept functions only |
| Dangerous tags/attributes | Blocks `script`, `style`, `object`, `embed`, `base`, `meta`, `link`, `innerHTML`, `srcdoc`, ...; `iframe` is sandboxed by default |
| Tabnabbing | `target="_blank"` automatically gets `rel="noopener noreferrer"` |
| Open redirect | The router only accepts internal paths and checks same origin |
| Prototype pollution | Query, params and the store use prototype-less objects; keys like `__proto__` are blocked |
| Page freeze | Infinite update loops are stopped; URL length/segment count is capped |
| Arbitrary class/type in components | `variant`, `tone`, `type`, ... accept only values from an allow-list |

For details and what you still have to do yourself (server, HTTP headers, sanitizer), see [SECURITY.md](SECURITY.md).

## Current limitations

- No SSR, hydration or devtools yet.
- The Vite plugin has **not been run against real Vite** (the development environment had no network to install it). Verified: the config it generates; the HMR code transform; that code processed by esbuild (Vite's JSX compiler) and then by the plugin is still valid; a full simulation of the dispose → re-run entry file → store state preserved cycle. Not verified: integration in a real dev server. If HMR misbehaves for you, use `fluxa({ hmr: false })` and report the error message.
- HMR preserves state only in modules that were not edited (stores, ...). State inside an edited component is recreated.
- Tailwind has only been verified at the compile level: the Tailwind v4.3.3 core generated the correct CSS for classes written in Fluxa code (`hover:`, `md:`, `dark:`, `w-1/2`, `[&>svg]:size-4`) using my own simple scanner; it was not run through `@tailwindcss/vite` or the official scanner. JSX was compiled with real TypeScript and esbuild and ran correctly in both modes.
- The UI kit has no Combobox, DatePicker, charts, drag-and-drop sorting or file upload yet.
- A `computed`/`effect` created outside `mount` or `createRoot` lives until the page closes; create them inside components.
- No independent security audit; only tested on Chromium (not Firefox/Safari).
- Some documentation (`AI.md`, code comments) is currently in Vietnamese.

## License

MIT. See [LICENSE](LICENSE).
