// SERVICES / demo / records — makes the made-up records of one demo account (models, devices, customers, sales) in exactly the shape the reseller app stores them,
// ready to be sealed with the account key. Pure and deterministic: the same plan and seed give the same plaintext and the same record ids.
import { rng, seedOf, stableId } from './rng.mjs';
import { DAY, domain } from './plan.mjs';

const MAKES = { Aurora: ['Stream 4K', 'Stream Max', 'Box Mini'], Nimbus: ['N1', 'N2 Pro', 'N3'], Vertex: ['V10', 'V20 Lite', 'V30 Ultra'], Kestrel: ['K Box', 'K Box Plus'], Zephyr: ['Z5', 'Z8', 'Z8 Pro'], Orbit: ['Orbit One', 'Orbit Two'] };
const SUPPLIERS = ['Northwind Wholesale', 'Bayside Imports', 'Pinecrest Supply', 'Harbor Trading'];
const FIRST = ['Alex', 'Blake', 'Casey', 'Drew', 'Eden', 'Finley', 'Gray', 'Harper', 'Indy', 'Jordan', 'Kai', 'Logan', 'Morgan', 'Nico', 'Owen', 'Parker', 'Quinn', 'Riley', 'Sage', 'Taylor'];
const LAST = ['Adler', 'Brooks', 'Carter', 'Dawson', 'Ellis', 'Foster', 'Grant', 'Hayes', 'Irwin', 'Jensen', 'Keller', 'Lowell', 'Mercer', 'Nolan', 'Oakley', 'Porter', 'Reyes', 'Sutton', 'Turner', 'Vaughn'];
const PAY = [['cash', 'Cash'], ['card', 'Card'], ['transfer', 'Bank transfer'], ['other', 'Other']];
const WAR = [{ key: 'none', label: 'No warranty', days: 0 }, { key: 'd30', label: '30 days', days: 30 }, { key: 'd60', label: '60 days', days: 60 }, { key: 'd90', label: '90 days', days: 90 }, { key: 'y1', label: '1 year', days: 365 }];
const ymd = (t) => { const d = new Date(t); return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`; };
const day = (t) => new Date(t).toISOString().slice(0, 10);
const CHARS = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';

// Returns { models, items, customers, sales } as arrays of { id, type, data }.
export function recordsFor(set, plan, anchor) {
  const r = rng(seedOf(set.seed, set.key, 'data', plan.index)), id = (kind, n) => stableId(set.seed, set.key, plan.index, kind, n);
  const makes = Object.keys(MAKES).sort(() => r.next() - 0.5).slice(0, r.int(2, 4));
  const models = [], pairs = [];
  for (const mk of makes) for (const md of MAKES[mk].slice(0, r.int(1, MAKES[mk].length))) { pairs.push({ make: mk, model: md, base: r.int(1800, 7500) }); }
  pairs.forEach((p, n) => models.push({ id: id('model', n), type: 'model', data: { name: p.model, reorder: r.int(2, 8) } }));

  // devices
  const items = [], total = plan.devices, span = Math.max(1, anchor - plan.createdAt);
  const used = { uid: new Set(), mac: new Set() };
  for (let n = 0; n < total; n++) {
    const p = r.pick(pairs), status = r.weighted(set.shares), added = plan.createdAt + Math.floor(r.next() * span * 0.95);
    let uid; do uid = `${plan.code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(-5)}${r.int(100000, 999999)}`; while (used.uid.has(uid)); used.uid.add(uid);
    let mac; do mac = Array.from({ length: 6 }, () => r.hex(2)).join(':'); while (used.mac.has(mac)); used.mac.add(mac);
    const cost = p.base + r.int(-300, 300), price = Math.round(cost * (1.3 + r.next() * 0.6) / 100) * 100;
    items.push({ id: id('item', n), type: 'item', data: {
      uid, serial: `SN${r.hex(8)}`, mac, make: p.make, model: p.model, cond: r.weighted({ New: 50, Refurbished: 35, Used: 15 }), supplier: r.pick(SUPPLIERS), custom: {},
      status, cost, price, notes: status === 'returned' ? 'Customer return (demo data)' : status === 'damaged' ? 'Cracked case (demo data)' : '', addedAt: added, receivedOn: day(added),
    } });
  }

  // sold devices are grouped into sales; each sale has an optional customer
  const sold = items.filter(x => x.data.status === 'sold'), customers = [], sales = [];
  const wantCust = sold.length ? Math.max(1, Math.ceil(sold.length * set.customersPer100Sold / 100)) : 0;
  for (let n = 0; n < wantCust; n++) {
    const first = r.pick(FIRST), last = r.pick(LAST), made = plan.createdAt + Math.floor(r.next() * span * 0.9);
    customers.push({ id: id('customer', n), type: 'customer', data: { name: `${first} ${last}`, phone: `(555) 01${r.int(0, 9)}-${r.int(1000, 9999)}`, email: `${first}.${last}${n + 1}`.toLowerCase() + `@${domain}`, notes: '', createdAt: made } });
  }
  const nos = new Set(); let k = 0, saleN = 0;
  while (k < sold.length) {
    const take = r.int(1, set.maxPerSale), group = sold.slice(k, k + take); k += take;
    const late = Math.max(...group.map(g => g.data.addedAt)), ts = Math.min(anchor - 60e3, Math.max(late + DAY, late + Math.floor(r.next() * (anchor - late)))), cust = customers.length && r.next() < 0.85 ? r.pick(customers) : null;
    let no; do no = `S-${ymd(ts)}-${Array.from({ length: 5 }, () => CHARS[r.int(0, CHARS.length - 1)]).join('')}`; while (nos.has(no)); nos.add(no);
    const saleId = id('sale', saleN++), lines = group.map(g => { const d = g.data, pct = r.next() < 0.1 ? 5 : 0, net = Math.round(d.price * (100 - pct) / 100); return { g, line: { id: g.id, uid: d.uid, serial: d.serial, mac: d.mac, make: d.make, model: d.model, fields: [{ label: 'UID', value: d.uid }, { label: 'MAC address', value: d.mac }], inspection: null, listPrice: d.price, pct, price: net, cost: d.cost } }; });
    const subtotal = lines.reduce((t, x) => t + x.line.price, 0), pay = r.weighted({ cash: 30, card: 45, transfer: 15, other: 10 }), w = WAR[r.weighted({ 0: 25, 1: 20, 2: 15, 3: 25, 4: 15 }) | 0];
    sales.push({ id: saleId, type: 'sale', data: {
      no, ts, customerId: cust?.id || null, customerName: cust?.data.name || '', customerEmail: cust?.data.email || '', items: lines.map(x => x.line), subtotal, orderPct: 0, orderOff: 0, total: subtotal,
      cost: lines.reduce((t, x) => t + x.line.cost, 0), payment: pay, paymentLabel: PAY.find(p => p[0] === pay)[1], warranty: { key: w.key, label: w.label, start: ts, end: w.days ? ts + w.days * DAY : null }, notes: '',
    } });
    for (const x of lines) { x.g.data.soldAt = ts; x.g.data.saleId = saleId; x.g.data.price = x.line.listPrice; }
  }
  return { models, items, customers, sales };
}
export const WARRANTY_KEYS = WAR.map(w => w.key);
