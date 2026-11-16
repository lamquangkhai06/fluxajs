[English](SECURITY.md) | [Tiếng Việt](SECURITY.vi.md)

# Security

Fluxa is designed to be **secure by default**: the simplest way to write something is also the safest. However, no framework can protect an entire application; this document spells out what Fluxa does and what you still have to do.

## What Fluxa does

1. **XSS protection for content.** Every string you pass as content goes through `createTextNode`. No API uses `innerHTML`. `unsafeHTML(html, sanitize)` is the only escape hatch and it **requires** a sanitizer function (for example `DOMPurify.sanitize`).
2. **URL filtering.** The attributes `href`, `src`, `action`, `formaction`, `poster`, `cite`, `background`, `xlink:href`, `longdesc`, `data`, `manifest` only accept `http:`, `https:`, `mailto:`, `tel:` and relative URLs. It uses the browser's own URL parser, so it is not fooled by `JaVaScRiPt:`, tabs/newlines inside the scheme, or leading whitespace.
3. **Events accept functions only.** `onclick: "alert(1)"` is dropped and reported as an error.
4. **Dangerous tags and attributes are blocked.** Tags `script`, `style`, `object`, `embed`, `applet`, `base`, `meta`, `link`, `frame`, `frameset`, `foreignObject`; attributes `innerHTML`, `outerHTML`, `srcdoc`, `srcset`, `ping`, and any key starting with `__`; SVG `attributeName` pointing at `href`/`on*`. An `iframe` automatically gets `sandbox=""`.
5. **Tabnabbing protection.** `target="_blank"` automatically gets `rel="noopener noreferrer"`.
6. **Safe router.** It only accepts internal paths starting with a single `/`; it checks same origin (blocking `//evil.com`, `/\evil.com`, `javascript:`); it caps path length (2048), segment count (50) and query key count (100); query/params are prototype-less objects.
7. **Robustness.** Infinite update loops are stopped; an error in one effect does not break other effects; a `computed` with a circular dependency reports an error instead of overflowing the stack; effects and `list` clean up after themselves to avoid memory leaks.
8. **Strict CSP compatible.** No `eval`, `new Function`, or inline script/style. See `index.html` for a sample policy.
9. **UI components.** `variant`, `size`, `tone`, `type` accept only values from an allow-list (arbitrary class names cannot be injected); `Input` only accepts safe `type`s (no `file`, `hidden`, `image`, ...); toast, alert and error message content is always plain text; `Button` defaults to `type="button"` so it doesn't submit forms by accident; the number of toasts shown at once is capped; `Modal` traps focus inside the dialog and restores it on close.
10. **Store.** Rejects the keys `__proto__`, `constructor`, `prototype` and symbol keys; data lives in a prototype-less object; reading an unknown key does not allocate extra memory.
11. **JSX and the Vite plugin.** `key` and `children` never reach DOM attributes; the plugin's `importFrom` option is character-checked so code cannot be injected into the generated import line. The HMR code the plugin adds only runs in the dev server (it is absent from production builds), is a fixed snippet, and the path inside it is taken from the file's own `import { mount }` line and passed through `JSON.stringify`.
12. **Safe shortcuts.** `class` as an object/array always goes through the same `className` assignment path (there is no HTML-injection route); automatic binding is attached only to `input`/`textarea`/`select`; `model()` uses the same key filter as the store (rejecting `__proto__`, `constructor`, `prototype`). `resource()` cancels the previous request with an `AbortController` and ignores any stale response, so outdated data never appears; `choose()` only looks up keys on the object you pass in (`Object.hasOwn`), so a value like `"constructor"` or `"__proto__"` can never match an inherited key; a `resource` result is still raw data, and if you display it, it still goes through `createTextNode` like any other content.
13. **Trusted Types.** `unsafeHTML` is the only place where Fluxa assigns a string to `innerHTML`; when the page enables `require-trusted-types-for 'script'`, the sanitizer's output is wrapped by a policy named `fluxa` (your CSP needs `trusted-types fluxa`). A public test suite, `security.cjs` (`npm run test:security`), runs on real Chromium under CSP + Trusted Types.
14. **Extras module (`fluxa-extras.js`).** `persist` parses JSON through a filter that drops `__proto__`/`constructor`/`prototype`, caps input at 1,000,000 characters, and ignores corrupt data instead of throwing; use `revive` to validate the data's shape. `form` rejects reserved field names; the length cap applied when running `rules.pattern` only reduces the risk of freezing the page and **cannot save you from a badly written regex**. `createI18n` only looks up keys that are own properties of the translation object and inserts `{param}` values as plain text. `createTheme` only accepts `light`/`dark`/`auto`. `Avatar` filters image URLs; `Table` reads only the row's own properties and renders plain text; `Tooltip`/`Dropdown` attach listeners only while open and remove them afterwards. `debounced` caps its delay at 60 seconds and `history` caps at 1000 steps.
15. **Inputs and charts (0.10).** `Combobox`, `DatePicker`, `FileInput` and all charts render labels, option text and file names as plain text (no `innerHTML`). `accept` lists are sanitised against a strict token pattern. `FileInput` checks of type, size and count run in the browser and are **a UX aid, not a security control: the server must re-validate every upload.** Charts coerce invalid numbers to 0 and cap data at 1000 points and 12 series so huge input cannot freeze the page. `DatePicker` does UTC date math on strictly parsed `YYYY-MM-DD` strings only.

## What you still have to do

- **The server is where real security lives.** Authentication, authorization and data validation belong on the server. The router's `beforeEach` is only for nicer navigation; an attacker can bypass it.
- **HTTP headers.** `Content-Security-Policy` (the `<meta>` version does not support `frame-ancestors`), `X-Content-Type-Options: nosniff`, `Referrer-Policy`, HSTS, and `frame-ancestors`/`X-Frame-Options` against clickjacking. If you enable Trusted Types: `require-trusted-types-for 'script'` (Fluxa only touches the `innerHTML` sink, inside `unsafeHTML`).
- **Sanitize HTML** if you use `unsafeHTML`: use a proven library such as DOMPurify; don't write your own.
- **Don't put sensitive data in URLs**, `localStorage` or client-side code.
- **Audit your dependencies** (Fluxa has none, but your app may).
- **CSS.** Pass `style` as an object rather than a string when the values come from users; never concatenate user input into URLs inside CSS.

## Known limitations

- Fluxa has not had an independent security audit and has only been tried on Chromium (the end-to-end tests in `e2e.cjs`); most tests run on a fake DOM in Node. It has not been tried on Firefox or Safari.
- Absolute `http(s)` URLs (including `//host/x`) to any host are allowed by design, so an `<img src>` or `<a href>` can point off-site. Restrict hosts with your CSP (`img-src`, `connect-src`, `frame-src`, ...).
- Attribute filtering is list-based; new HTML attributes added to the standard in the future may need to be added. Update regularly.
- The store is reactive only at a shallow level and does not limit how many keys you write into it. Don't use user-controlled data as key names.
- If several `Modal`s are open at once, Esc closes all of them (there is no dialog stack yet).

## Reporting a vulnerability

If you find a vulnerability, **please don't open a public issue**. Use the repository's "Report a vulnerability" button (GitHub Security Advisories, under the Security tab) to contact the maintainer privately, and describe how to reproduce it. The issue will be fixed before it is disclosed.
