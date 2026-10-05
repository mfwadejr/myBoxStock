# CSS standard

**One file owns every visual value: `public/css/tokens.css`.** Colors, fonts, sizes, weights, line heights, letter spacing, spacing scale,
radii, border widths, shadows, blur, opacity, z-index, durations, easing, component dimensions and even embedded icon colors are
variables there. Nothing else may contain a raw value. To restyle the product, edit tokens; nothing else changes.

| File | Holds |
|---|---|
| `tokens.css` | the only place raw values are allowed |
| `base.css` | element defaults (body, headings, inputs) |
| `layout.css` | top bar, shell, sidebar, grids, breakpoints |
| `components.css` | card, stat, meter, buttons, switch, segmented control, table, chip, banner, sheet, toast, log viewer, account menu (`.menu-*`), Documentation layout (`.doc-*`), long lists (`.feed`, `.more-row`, `.pager`)… |
| `commerce.css` | inventory, sales, receipts and other reseller screens |
| `responsive.css` | phone / tablet / laptop breakpoints (640, 820, 980) |
| `scanner.css` | the full-screen phone camera scanner |
| `auth.css` | sign-in / sign-up screens |
| `utilities.css` | single-purpose helpers (`.mt-md`, `.muted`, `.maxw-md`, …) — the replacement for inline styles |
| `motion.css` | keyframes, view animation, reduced-motion |

## Rules (enforced by `test/standards.test.mjs` — the build fails if broken)
1. No hex/rgb/hsl, px/rem/em/ms/s/vh/vw or decimal literals outside `tokens.css`. (`@media` breakpoints are the one exception — CSS can't put variables there; they are listed in `tokens.css` comments.)
2. `font-size`, `font-weight`, `line-height`, `letter-spacing`, `z-index`, `opacity`, `border-radius`, `box-shadow`, `font-family` must use a token.
3. No `style="…"`, no `<style>`, no `element.style.x = …` anywhere in scripts or HTML. The CSP (`style-src 'self'`) also blocks them at runtime.
   The one sanctioned dynamic value is a CSS custom property: `<i data-pct="40">` → `UI.dynamic()` sets `--pct`, and CSS turns it into a width.
4. No colors or presentation attributes (`fill=`, `stroke=`, `font-size=`…) in scripts or markup — use classes (e.g. `.icon`, `.qr-dark`, `.spark-line`).
5. Every class used in markup exists in the stylesheets; every `var(--x)` is defined in `tokens.css`.
6. Email templates can't read CSS variables, so their few colors live in `src/services/mail/theme.mjs` and a test asserts they equal the tokens.

## Fonts: `.ident` and `.tab-num` (the old `.mono` class is gone)
Page code names the **kind** of value; the CSS decides the font.
- `.ident` (monospace, `--font-mono` at `--text-ident`) for identifiers people check or copy: serial numbers, MAC addresses, receipt numbers, Reseller IDs, backup file names, event codes, secret keys, commands.
- `.tab-num` (the normal font with tabular figures) for numbers that must line up in columns: dates, amounts, IP addresses.
- Usernames are normal text. Never use `mono` in new code: `test/standards.test.mjs` fails if a class attribute, `classList` or `className` uses it, or if `utilities.css` defines it.
- Windows falls back to Segoe UI / Consolas / Cascadia Mono because those are in the font tokens.

## Native controls
`base.css` styles them once: number fields have no spinner, text areas no resize grip (`resize: none` is the only `resize` allowed), search boxes no clear button, checkboxes are 20px and brand blue, date/time keep the native picker with a quieter icon, and every scroll bar is one thin themed style (no arrow buttons). Tested.

## Long lists
- **Feeds** (Host Logs, Audit, Alerts history, Onboarding, Pipeline, Backups file lists, sign-in history): put the list in `.feed` (a box capped at `--feed-max-h`, about 640px, on tablets and up; no cap at 640px and narrower, where the page scrolls) and use `UI.more` or `UI.chunked` for the "Showing N of M …" line and **Load more** (100 rows at a time; Backups lists 25).
- **Working lists** (reseller Inventory, Customers, Sales; Host Accounts): use `UI.pager` — 25 / 50 / 100 per page with Previous / Next, hidden when 25 or fewer; a new search or filter returns to page 1.

## Adding something new
Need a new size or color? Add a token to `tokens.css` first, then reference it. Need one-off spacing in markup? Use a utility class; add one to
`utilities.css` if it doesn't exist (using spacing tokens).
