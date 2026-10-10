// TEST / t48-field-guard — fails when a stored field the app uses is missing from docs/data-model-checklist.md, so a future change cannot silently drop data from
// backups and exports. The checklist lists every field with how it is backed up, exported and imported; this test reads the code that BUILDS each record
// (the sale, the delivery, the return, the customer, the settings...) and checks every key is listed with coverage filled in. It also watches the browser-only
// keys, the Host tables, the Host setting keys and the Demo mode columns. To fix a failure: add a row to the checklist, then decide its backup / export / import cells.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './helpers.mjs';

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const walk = (dir, out = []) => { for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p, out); else if (p.endsWith('.js') || p.endsWith('.mjs')) out.push(p); } return out; };

// ---- the checklist ----
const rows = new Map();
for (const line of read('docs/data-model-checklist.md').split('\n')) {
  const m = line.match(/^\| `([^`]+)` \|(.*)\|\s*$/); if (!m) continue;
  const cells = m[2].split('|').map(c => c.trim()); // meaning, backup, export, import
  assert.ok(!rows.has(m[1]), `the checklist lists ${m[1]} twice`);
  rows.set(m[1], { meaning: cells[0], backup: cells[1], exp: cells[2], imp: cells[3] });
}

// ---- the top-level keys of an object literal that starts at the "{" ending the anchor match ----
export function keysAt(src, re) {
  const m = re.exec(src); assert.ok(m, `anchor not found in the code: ${re}`);
  let i = m.index + m[0].length - 1; assert.equal(src[i], '{', `anchor must end at "{": ${re}`);
  const keys = []; let depth = 0, q = '', start = i + 1, part = '';
  const flush = () => { const k = part.trim().match(/^(?:['"]([\w$]+)['"]|([A-Za-z_$][\w$]*))\s*(?::|$)/); if (k && !part.trim().startsWith('...')) keys.push(k[1] || k[2]); part = ''; };
  for (i = i + 1; i < src.length; i++) {
    const ch = src[i];
    if (q) { part += ch; if (ch === '\\') { part += src[++i]; } else if (ch === q) q = ''; continue; }
    if (ch === '\'' || ch === '"' || ch === '`') { q = ch; part += ch; continue; }
    if ('({['.includes(ch)) { depth++; part += ch; continue; }
    if (')}]'.includes(ch)) { if (depth === 0) { flush(); break; } depth--; part += ch; continue; }
    if (ch === ',' && depth === 0) { flush(); continue; }
    part += ch;
  }
  return keys;
}

// Each anchor matches just up to the "{" of the object literal that builds the record (the lookahead says which one).
const CHECKS = [
  ['public/js/app/views/sell.js', /const sale = \{/, 'sale'],
  ['public/js/app/views/sell.js', /return \{(?= id: l\.id, uid: it\.uid)/, 'sale.items'],
  ['public/js/app/delivery.js', /delivery: \{(?= type: 'shipping', shipTo)/, 'sale.delivery'],
  ['public/js/app/delivery.js', /delivery: \{(?= type: dl\.type)/, 'sale.delivery'],
  ['public/js/app/returns.js', /const ret = \{/, 'sale.returns'],
  ['public/js/app/returns.js', /returnAsk: \{(?= by:)/, 'sale.returnAsk'],
  ['public/js/app/views/sell.js', /customer = \{ id, data: \{/, 'customer'],
  ['public/js/app/views/customers.js', /return \{(?= \.\.\.old, name:)/, 'customer'],
  ['public/js/app/views/inventory.js', /type: 'model', id: cur\?\.id, data: \{/, 'model'],
  ['public/js/app/views/inventory.js', /d = \{(?= \.\.\.old, \.\.\.C\.catalog\.read\(el\), status:)/, 'item'],
  ['public/js/app/label.js', /return \{(?= size: pick\(L\.SIZES)/, 'config.label'],
  ['public/js/app/delivery.js', /D\.cfg = \(\) => \(\{(?= country)/, 'config.delivery'],
  ['public/js/app/store.js', /return \{(?= reasons: Array\.isArray\(r\.reasons\))/, 'config.returns'],
  ['public/js/app/store.js', /const DEFAULTS = \{/, 'config'],
  ['public/js/app/store.js', /mail: \{(?= enabled: false)/, 'config.mail'],
  ['src/services/support/settings.mjs', /export const DEFAULTS = \{/, 'support'],
];
const keysFor = (file, re) => keysAt(read(file), re);

test('the checklist exists and every row has all three coverage cells filled in', () => {
  assert.ok(rows.size > 150, `the checklist has ${rows.size} rows`);
  const bad = [];
  for (const [k, r] of rows) {
    if (!r.meaning) bad.push(`${k}: no meaning`);
    for (const [name, v] of [['backup', r.backup], ['export', r.exp], ['import', r.imp]]) if (!v) bad.push(`${k}: the ${name} cell is empty`);
    if (!/^(yes|Host|Team|not backed up|Team list)/.test(r.backup)) bad.push(`${k}: the backup cell must start with yes, Host, Team list or not backed up (got "${r.backup}")`);
    if (r.exp !== '-' && /^-/.test(r.exp) === false && r.exp !== 'settings.json' && !/^[a-z_]+\.(csv|json)\b/.test(r.exp)) bad.push(`${k}: the export cell must be "-" (with a reason), settings.json or file.csv:column (got "${r.exp}")`);
    if (/^-\s*$/.test(r.exp) && !/^(table|setting|support|accounts|browser)\./.test(k) && !/^team\./.test(k)) bad.push(`${k}: an unexported reseller field needs a reason after the dash`);
  }
  assert.deepEqual(bad, []);
});

test('every key the code saves in a record is in the checklist', () => {
  const missing = [];
  for (const [file, re, prefix] of CHECKS) {
    for (const k of keysFor(file, re)) if (!rows.has(`${prefix}.${k}`)) missing.push(`${prefix}.${k}  (built in ${file})`);
  }
  assert.deepEqual(missing, [], 'Add these to docs/data-model-checklist.md with their backup, export and import cells');
});

test('the fields set outside those object literals are listed too (sale, device and customer changes)', () => {
  const need = ['item.soldAt', 'item.saleId', 'item.status', 'item.custom', 'item.checks', 'item.checkVals', 'item.testedOn', 'item.testNotes', 'sale.voided', 'sale.voidedAt', 'sale.customerErased', 'sale.returns', 'sale.returnAsk', 'sale.delivery',
    'customer.address', 'config.delivery', 'config.label', 'config.returns', 'config.label.customLogo', 'sale.delivery.labelRef', 'sale.delivery.shippedAt'];
  assert.deepEqual(need.filter(k => !rows.has(k)), []);
  // and the code really sets them (so a rename shows up here)
  const all = walk('public/js/app').map(read).join('\n');
  for (const t of ['soldAt', 'saleId', 'voidedAt', 'customerErased', 'returnAsk', 'labelRef', 'shippedAt', 'customLogo', 'retShipPaidBy']) assert.ok(all.includes(t), `the code no longer uses ${t}; remove it from the checklist`);
});

test('the address parts (ship to, customer address) are all listed', () => {
  const m = read('public/js/app/delivery.js').match(/const ADDR = \[([^\]]*)\]/); assert.ok(m);
  const parts = [...m[1].matchAll(/'(\w+)'/g)].map(x => x[1]);
  assert.deepEqual(parts, ['name', 'street', 'unit', 'city', 'state', 'zip', 'country']);
  for (const p of parts) assert.ok(rows.has(`customer.address.${p}`), `customer.address.${p}`);
  assert.ok(rows.has('sale.delivery.shipTo'));
});

test('every browser-only key is listed as not backed up', () => {
  const found = new Set();
  for (const f of walk('public/js/app')) for (const m of read(f).matchAll(/['"`](mbs[.-][\w.-]*)/g)) found.add(m[1].replace(/\.$/, ''));
  assert.ok(found.size >= 5, `found ${[...found]}`);
  const listed = new Set([...rows.keys()].filter(k => k.startsWith('browser.')).map(k => k.slice(8).replace(/\.<[^>]+>$/, '')));
  assert.deepEqual([...found].filter(k => !listed.has(k)), [], 'browser-only keys missing from the checklist');
  for (const k of rows.keys()) if (k.startsWith('browser.')) assert.equal(rows.get(k).backup, 'not backed up', k);
});

test('every Host table, setting key and Demo mode column is listed; every table is copied between databases', () => {
  const schema = read('src/db/schema.mjs');
  const tables = [...schema.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?([a-z_]+)/g)].map(m => m[1]);
  assert.ok(tables.length > 25 && tables.includes('demo_logins'));
  assert.deepEqual(tables.filter(t => !rows.has(`table.${t}`)), [], 'tables missing from the checklist');
  const copy = [...schema.match(/COPY_ORDER = \[([^\]]*)\]/)[1].matchAll(/'([a-z_]+)'/g)].map(m => m[1]);
  assert.deepEqual(tables.filter(t => t !== 'schema_migrations' && !copy.includes(t)), [], 'a table that is not in COPY_ORDER is lost when the site moves to another database');
  for (const c of ['demo', 'demo_set']) { assert.ok(new RegExp(`ALTER TABLE accounts ADD COLUMN ${c}\\b`).test(schema)); assert.ok(rows.has(`accounts.${c}`), `accounts.${c}`); }

  const keys = new Set();
  for (const f of walk('src')) {
    const s = read(f); if (!/getSetting|setSetting/.test(s)) continue;
    for (const m of s.matchAll(/(?:getSetting|setSetting)\(\s*(?:db|t|this\.db),\s*'([a-z_]+)'/g)) keys.add(m[1]);
    for (const m of s.matchAll(/\b(?:KEY|STATE|CHECK|SINCE_KEY|TEST_KEY)\s*=\s*'([a-z_]+)'/g)) keys.add(m[1]);
  }
  assert.ok(keys.size >= 20 && keys.has('demo_mode') && keys.has('mail_last_test') && keys.has('support'), [...keys].join());
  assert.deepEqual([...keys].filter(k => !rows.has(`setting.${k}`)), [], 'Host setting keys missing from the checklist');
});

test('every export column named in the checklist exists in the code that writes the file', () => {
  const code = ['public/js/app/views/inventory.js', 'public/js/app/views/sales.js', 'public/js/app/delivery.js', 'public/js/app/returns.js', 'public/js/app/export.js', 'public/js/app/store.js', 'public/js/app/label.js'].map(read).join('\n');
  const files = new Set(['inventory.csv', 'customers.csv', 'sales.csv', 'sale_items.csv', 'returns.csv', 'models.csv']), bad = [];
  for (const [k, r] of rows) {
    const m = r.exp.match(/^([a-z_]+\.csv):(.+?)(?: \(|$)/); if (!m) continue;
    if (!files.has(m[1])) bad.push(`${k}: unknown file ${m[1]}`);
    if (/^one column/.test(m[2])) continue;
    if (!code.includes(`'${m[2]}'`) && !code.includes(`label: '${m[2]}'`) && !code.includes(`'${m[2]}',`)) bad.push(`${k}: column "${m[2]}" is not written by the code`);
  }
  assert.deepEqual(bad, []);
});

test('the guard itself works: it finds the keys of the real builders', () => {
  const k = keysFor('public/js/app/views/sell.js', /const sale = \{/);
  for (const need of ['no', 'ts', 'customerId', 'items', 'total', 'cost', 'payment', 'warranty', 'notes']) assert.ok(k.includes(need), `sale.${need}`);
  const d = keysFor('public/js/app/delivery.js', /delivery: \{(?= type: 'shipping', shipTo)/);
  assert.deepEqual(d.sort(), ['carrier', 'cost', 'fee', 'labelRef', 'note', 'shipTo', 'shippedAt', 'status', 'tracking', 'type']);
  const r = keysFor('public/js/app/returns.js', /const ret = \{/);
  for (const need of ['id', 'no', 'ts', 'by', 'role', 'reasonKey', 'reasonLabel', 'note', 'lines', 'fee', 'shipRefund', 'net', 'method', 'methodLabel']) assert.ok(r.includes(need), `ret.${need}`);
});
