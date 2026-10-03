# CSS standard

**One file owns every visual value: `public/css/tokens.css`.** Colors, fonts, sizes, weights, line heights, letter spacing, spacing scale,
radii, border widths, shadows, blur, opacity, z-index, durations, easing, component dimensions and even embedded icon colors are
variables there. Nothing else may contain a raw value. To restyle the product, edit tokens; nothing else changes.

| File | Holds |
|---|---|
| `tokens.css` | the only place raw values are allowed |
| `base.css` | element defaults (body, headings, inputs) |
| `layout.css` | top bar, shell, sidebar, grids, breakpoints |
| `components.css` | card, stat, meter, buttons, switch, segmented control, table, chip, banner, sheet, toast, log viewer… |
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

## Adding something new
Need a new size or color? Add a token to `tokens.css` first, then reference it. Need one-off spacing in markup? Use a utility class; add one to
`utilities.css` if it doesn't exist (using spacing tokens).
