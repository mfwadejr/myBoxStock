# Reseller documentation check list

Documentation-to-code check list for the reseller set (content/docs/reseller). Every page was read against the code on branch v25-dr (all v0.22.0 to v0.25.0 features merged). Screenshots are captured by `tools/docs-shots/run.mjs` from `tools/docs-shots/manifest-reseller.mjs` into `public/assets/docs/` (laptop and phone).

| # | Page | Slug | Screenshots | Verified against | Notes |
|---|------|------|-------------|------------------|-------|
| 1 | Getting started | getting-started | Yes (3): getting-started-3, getting-started-1, getting-started-2 | v0.25.0 | Legal links, reset wording, Get set up, account menu and More sheet confirmed. Added screenshots. |
| 2 | Home | home | Yes (2): home-1, home-2 | v0.25.0 | Running low card, refunds tile, Get set up checked against firstrun.js and home-low.js. |
| 3 | Inventory | inventory | Yes (3): inventory-1, inventory-2, inventory-3 | v0.25.0 | Stock levels and Running low link checked. Added screenshots. |
| 4 | Quick sale | quick-sale | Yes (2): quick-sale-1, quick-sale-2 | v0.25.0 | Delivery section checked against sell.js and delivery.js. Added screenshots. |
| 5 | Delivery and shipping | delivery-and-shipping | Yes (3): delivery-and-shipping-1, delivery-and-shipping-2, delivery-and-shipping-3 | v0.25.0 | Renumbered (was 18). Checked against delivery.js. Screenshots added. |
| 6 | Shipping labels | shipping-labels | Yes (2): shipping-labels-1, shipping-labels-2 | v0.25.0 | Renumbered (was 19). Added who can print a label (all roles) and who changes settings. |
| 7 | Customers | customers | Yes (3): customers-1, customers-2, customers-3 | v0.25.0 | Renumbered (was 05). Search, sort, chips and history checked against customers.js. |
| 8 | Sales | sales | Yes (2): sales-1, sales-2 | v0.25.0 | Renumbered (was 06). Delivery filters, refunds and CSV columns checked. |
| 9 | Returns and refunds | returns-and-refunds | Yes (2): returns-and-refunds-1, returns-and-refunds-2 | v0.25.0 | Renumbered (was 20). Removed an unclear phrase. |
| 10 | Team | team | Yes (4): team-3, team-4, team-1, team-2 | v0.25.0 | Renumbered (was 07). Roles now say what Standard and View can do with delivery, labels and returns; Support and Running low for everyone. |
| 11 | Settings | settings | Yes (2): settings-1, settings-2 | v0.25.0 | Renumbered (was 08). Delivery and labels, Returns and refunds cards checked against the code. |
| 12 | Backup and restore | backup-and-restore | Yes (1): backup-and-restore-1 | v0.25.0 | Renumbered (was 15). Button names (Test file, Choose file) checked against backup.js. |
| 13 | Activity | activity | Yes (1): activity-1 | v0.25.0 | Renumbered (was 09). Returns and refunds card checked. |
| 14 | Security | security | Yes (1): security-1 | v0.25.0 | Renumbered (was 10). Reset wording and legal links confirmed. |
| 15 | Your data, your responsibility | your-data-your-responsibility | None. Explanation page; the text stands on its own. | v0.25.0 | Renumbered (was 11). What the site cannot see now lists addresses, deliveries, returns, labels; tickets noted as readable on purpose. |
| 16 | Plans, trials and billing | plans-trials-billing | None. Reference text; the plan chip is a single line, no flow to show. | v0.25.0 | Renumbered (was 12). No change needed. |
| 17 | Scanning with your phone camera | scanning-with-your-phone | None. Needs a live camera, which the demo shots cannot show. | v0.25.0 | Renumbered (was 16). No screenshot: the camera cannot be shown in the demo. |
| 18 | Support | support | Yes (2): support-1, support-2 | v0.25.0 | Renumbered (was 17). Checked against support.js. |
| 19 | Accessibility | accessibility | None. Keyboard and screen reader guidance; nothing visual to add. | v0.25.0 | Renumbered (was 21). Keyboard shortcuts checked (/ and Ctrl or Cmd + K on Customers). |
| 20 | Troubleshooting and FAQ | troubleshooting-faq | None. Reference page. | v0.25.0 | Renumbered (was 13). Added Running low, customer search, sort and DEMO entries. |
| 21 | Glossary | glossary | None. Reference page. | v0.25.0 | Renumbered (was 14), re-sorted A to Z. Added Partly returned, Return requested, Order number, Themed and Plain, DEMO chip, Mark shipped, Focus ring, Saved address, Refund, Return reason, Label logo, Screenshot viewer. |

Totals: 21 pages, 15 with screenshots, 33 screenshot entries (each in a laptop and a phone size).

Role coverage: Administrator, Standard and View are described on Team, Inventory, Quick sale, Customers, Sales, Returns and refunds, Delivery and shipping and Shipping labels.

Encryption statement: Getting started, Your data your responsibility, Delivery and shipping, Returns and refunds, Shipping labels and Support say what is encrypted in the browser and what the Host can and cannot see (the test in test/docs.test.mjs checks the responsibility wording).

Next release: re-shoot with `node tools/docs-shots/run.mjs --manifest reseller`, re-read every page against the changed screens, and update the Verified against column.
