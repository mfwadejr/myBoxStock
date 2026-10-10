# Documentation and site screenshots

`run.mjs` re-shoots every documentation screenshot from Demo mode data (made-up accounts only) so they never go stale. Run it before each release and whenever a screen a shot shows changes.

## Run

```
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tools/docs-shots/run.mjs [--manifest reseller|host|site|all] [--only NAME,NAME] [--set demo3] [--out DIR] [--keep]
```

- Default: both documentation manifests, into `public/assets/docs/` (the folder the docs renderer reads).
- Marketing site: `node tools/docs-shots/run.mjs --manifest site --out <folder>`, then `node tools/site/build.mjs <site folder> <folder>`.
- It builds the Demo set (`demo3` by default) into a throw-away data folder, starts the real server on it, signs in, takes a laptop (1280x800) and a phone (390x844, drawn at 2x) picture of each entry, compresses each PNG (palette, fewer colours, then a slightly smaller picture) under 240 KB, writes `NAME-laptop.png` and `NAME-phone.png`, and prints a table. The temp folder is deleted unless `--keep`.
- Needs Playwright with Chromium (`/opt/pw-browsers/chromium`, or set `CHROMIUM_PATH`) and `sharp` (found in `/opt/npm-tools/node_modules`).
- Demo passwords stay in memory. They are never printed or saved, and a shot is refused if a password is visible on the page. The DEMO banner and chips are left in: the pictures say Demo.

## Manifests

`manifest-reseller.mjs`, `manifest-host.mjs` and `manifest-site.mjs` each `export default` a list:

```js
{ name: 'reseller-inventory',   // lowercase letters, digits, hyphens; unique across manifests
  set: 'reseller',              // 'reseller' (Demo Owner/Standard/View login) or 'host' (Host admin)
  role: 'Owner',                // reseller only: 'Owner' (default), 'Standard' or 'View'
  route: '#/inventory',         // hash route opened after sign-in
  viewport: 'both',             // 'both' (default), 'laptop' or 'phone'
  fullPage: false,              // true = whole page instead of the visible window
  keepScroll: false,            // true = do not scroll back to the top before the shot (use after h.scrollTo)
  prep: async (page, h) => {}   // optional: click, fill, open a sheet; h.wait(ms), h.waitFor(sel), h.click(sel), h.fill(sel, v), h.scrollTo(sel), h.size
}
```

Do not click Show or Copy on demo passwords in a `prep`. In the docs, use the shot as one line: `![Alt text](shot:NAME "Caption text")` (see `content/docs/FORMAT.txt`). `test/docs-shots.test.mjs` checks that both files exist, are PNGs under 250 KB, and have alt text and a caption.
