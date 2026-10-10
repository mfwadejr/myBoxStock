// TOOLS / docs-shots / manifest-host — the Host Console screenshots for content/docs/host (W2). Read by tools/docs-shots/run.mjs.
// Every entry: name (host-<slug>[-<n>]), set 'host', route (a real hash route from public/js/host/main.js), optional prep(page, h) to open or click something, viewport 'both' (laptop + phone).
// The runner is expected to: build Demo3 and Demo300 with Demo mode on, sign in to the Host as the Owner, and shoot made-up demo data only. Nothing here shows a real secret: the Security and
// Email password screens get no shot, and the Demo logins table is shot while passwords are still hidden (Show is never clicked).
// doc / before / alt / caption say where the matching `![alt](shot:name "caption")` line goes in content/docs/host (see tools/docs-shots/insert-host-shots.mjs, which adds the lines once the docs renderer supports images).
const wait = (page, sel) => page.waitForSelector(sel, { timeout: 15000 }).catch(() => {});
const idle = (page) => page.waitForTimeout(600);
const shot = (name, route, doc, before, caption, prep) => ({ name, set: 'host', route, doc, before, alt: caption.replace(/[.:]\s.*$/, ''), caption, prep, viewport: 'both' });

export default [
  shot('host-overview', '#/overview', '02-overview.md', 'The four top numbers', 'The Host Overview with made-up demo data: the top numbers, the Backups, Plans and Support cards and server health.', async (page) => { await wait(page, '.main .card'); await idle(page); }),
  shot('host-accounts', '#/accounts', '03-accounts.md', 'The account list', 'The Accounts list with search, filters and the Health column (made-up demo accounts, marked DEMO).', async (page) => { await wait(page, '#tbl table'); }),
  shot('host-accounts-2', '#/accounts', '03-accounts.md', 'The account sheet', 'Tick some rows and the bulk bar appears: Extend trial, Change plan, Send announcement and Export list.', async (page) => {
    await wait(page, '#tbl table'); const boxes = page.locator('#tbl input[data-pick]'); const n = Math.min(await boxes.count(), 3);
    for (let i = 0; i < n; i++) await boxes.nth(i).check(); await wait(page, '#bulk:not([hidden])'); }),
  shot('host-accounts-3', '#/accounts', '03-accounts.md', 'Managing a person', 'An account sheet: plan, status and the support tools. The Host sees no business data here.', async (page) => {
    await wait(page, '#tbl tr.click'); await page.locator('#tbl tr.click').first().click(); await wait(page, '.sheet'); await idle(page); }),
  shot('host-pipeline', '#/pipeline', '04-pipeline.md', '@2', 'Pipeline: sign-ups, trials ending, renewals and accounts that have gone quiet.', async (page) => { await wait(page, '.main .card'); await idle(page); }),
  shot('host-onboarding', '#/onboarding', '05-onboarding.md', '@2', 'Onboarding: the setup funnel and account-by-account progress.', async (page) => { await wait(page, '.main .card'); await idle(page); }),
  shot('host-plans', '#/plans', '06-plans.md', '@2', 'Plans: the plan list, trial length and receipts.', async (page) => { await wait(page, '.main .card'); await idle(page); }),
  shot('host-backups', '#/backups', '07-backups.md', 'The four kinds of backup', 'The Backups page with its status strip and the four kinds of backup.', async (page) => { await wait(page, '.main .card'); await idle(page); }),
  shot('host-email', '#/email', '08-email.md', 'Delivery tab', 'The Email page, Delivery tab, with the send-a-test card. (The mail password field is never shown.)', async (page) => { await wait(page, '#test'); await page.locator('#test').scrollIntoViewIfNeeded().catch(() => {}); }),
  shot('host-email-2', '#/email', '08-email.md', 'Health tab', 'A test email result: a plain cause, the next step and Show details for support.', async (page) => {
    await wait(page, '#test'); await page.locator('#test').click(); await idle(page); await page.locator('#test').scrollIntoViewIfNeeded().catch(() => {}); }),
  shot('host-alerts', '#/alerts', '09-alerts.md', 'Reading the Alerts page', 'The Alerts page: open problems, a new ticket alert and how to set one aside.', async (page) => { await wait(page, '.main .card'); await idle(page); }),
  shot('host-firewall', '#/firewall', '10-firewall.md', '@2', 'Firewall: blocked and rate-limited counts, bans and Host Console access.', async (page) => { await wait(page, '.main .card'); await idle(page); }),
  shot('host-settings', '#/settings', '12-settings.md', '@2', 'Host Settings: sign-ups, trial length, site address and the announcement banner.', async (page) => { await wait(page, '.main .card'); await idle(page); }),
  shot('host-logs', '#/logs', '13-logs.md', '@2', 'Logs: filters, quick filters and the scrolling feed.', async (page) => { await wait(page, '.main .card'); await idle(page); }),
  shot('host-audit', '#/audit', '14-audit-trail.md', 'Reading the list', 'The Audit trail listing who did what, with the type filter.', async (page) => { await wait(page, '.main .card'); await idle(page); }),
  shot('host-updates', '#/updates', '15-updates.md', '@2', 'Updates: running version, newest release and health since start.', async (page) => { await wait(page, '.main .card'); await idle(page); }),
  shot('host-support', '#/support', '22-support-tickets.md', 'The ticket list', 'The Support list with the Overdue count, filters and the new-tickets bar.', async (page) => { await wait(page, '.main .card'); await idle(page); }),
  shot('host-retention', '#/retention', '23-data-and-retention.md', 'What is using space', 'Data and retention: what is using space, retention rules and compacting.', async (page) => { await wait(page, '.main .card'); await idle(page); }),
  shot('host-demo', '#/demo', '24-demo-mode.md', 'The switch', 'Demo mode: the switch and the four standard size sets.', async (page) => { await wait(page, '[data-set=demo3]'); await idle(page); }),
  shot('host-demo-2', '#/demo', '24-demo-mode.md', 'Demo logins', 'The Demo logins table: passwords stay hidden until you choose Show.', async (page) => { await wait(page, '#dm-creds'); await page.locator('#dm-creds').scrollIntoViewIfNeeded().catch(() => {}); }),
];
