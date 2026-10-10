// TOOLS / site / pages — the words and layout of each marketing page. build.mjs wraps every body in the shared header and footer.
// Rules: describe only what the app does today; no email address or phone number anywhere; never mention complimentary accounts;
// liability wording is always "myBoxStock, its owner and supporting staff"; no inline styles.

import { CLOSED, WORDS } from './settings.mjs';
import { AVAILABLE, COMING_SOON } from './content.mjs';

export const APP_SIGNUP = 'https://app.myboxstock.com/app/#/signup', APP_LOGIN = 'https://app.myboxstock.com/app/';
export const LIABILITY = 'myBoxStock, its owner and supporting staff cannot see your customer data (inventory, customers, sales, receipts and prices) and are not responsible or liable for it. You own your data and are 100 percent responsible for it, for your recovery key, and for your own backup files and exports.';

// Shared by the home page and the FAQ page.
const FAQ = [
  [WORDS.faqQ, CLOSED ? WORDS.faqA : 'Yes. Use the Sign up button at the top of the page.'],
  ['Can my team use it too?', 'Yes. Add people from the Team page and choose what each of them can do: Administrator, Standard or View only.'],
  ['What if I forget my password?', 'You can reset it from the sign-in page. Because your data is encrypted for you alone, resetting a password gets you back into your login, but your business data stays locked until you enter your recovery key or an Administrator unlocks it for you. Keep your recovery key somewhere safe.'],
  ['Can I get my data out?', 'Yes. Download a backup file of the whole account at any time, and export your inventory, customers and sales to spreadsheet files. You can also test a backup file to prove it works before you ever need it.'],
  ['Does it work on a phone?', 'Yes. It runs in your browser, so a phone, a tablet or a laptop all work, and the phone camera can scan serial numbers and MAC addresses.'],
  ['Can I ship orders and print labels?', 'Yes. Choose Shipping on a sale, enter the address and the fee, then print an address label in the browser. Postage is not bought inside the app: you pay it elsewhere and enter the tracking number.'],
  ['What about returns and refunds?', 'Record which devices came back, why, what happens to each one, and the refund. The original sale stays on record and your totals show refunds separately.'],
  ['Who can see my customer data?', 'Only you and your team. It is encrypted in your browser, and myBoxStock, its owner and supporting staff cannot read it. You own your data and are responsible for it.'],
];
// A laptop picture and a phone picture of the same screen (either may be left out). Sample data only. Skipped when the entry has no picture.
export const shot = (name, what, { laptop = true, phone = true } = {}) => !name ? '' : `<figure class="shots${laptop && phone ? '' : ' alone'}">${laptop ? `<img class="laptop" src="ms/shots/${name}-laptop.png" width="1280" height="800" loading="lazy" alt="${what} on a laptop. Sample data.">` : ''}${phone ? `<img class="phone" src="ms/shots/${name}-phone.png" width="780" height="1688" loading="lazy" alt="${what} on a phone. Sample data.">` : ''}</figure>`;
// The main call to action. While sign-ups are closed it is a plain label, never a link (see settings.mjs).
export const signup = (label = 'Sign up', cls = '') => CLOSED ? `<span class="closedbtn${cls}" role="note">${WORDS.button}</span>` : `<a class="btn${cls}" data-app="signup" href="${APP_SIGNUP}">${label}</a>`;
export const notice = () => CLOSED ? `<p class="banner devnote" role="note">${WORDS.banner}</p>` : '';
const row = ({ id = '', kicker, h, body, ticks = [], pic = '', first = false }) => `<div class="frow${first ? ' first' : ''}"${id ? ` id="${id}"` : ''}><div><p class="kicker">${kicker}</p><h2>${h}</h2></div><div class="fbody">${body.map(p => `<p>${p}</p>`).join('')}${ticks.length ? `<ul class="ticks">${ticks.map(t => `<li>${t}</li>`).join('')}</ul>` : ''}</div>${pic ? `<div class="fpic">${pic}</div>` : ''}</div>`;
const faq = (items) => `<div class="faq">${items.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('')}</div>`;
const band = (h, p) => `<section class="band"><div class="wrap"><h2>${h}</h2><p>${p}</p>${signup()}${CLOSED ? `<p class="fine">${WORDS.banner}</p>` : ''}</div></section>`;

// Coming soon: made from COMING_SOON in content.mjs. With no items the whole section (heading and lead-in) is left out.
export const comingSoon = (alt = false) => !COMING_SOON.length ? '' : `<section class="section${alt ? ' alt' : ''}" id="coming-soon"><div class="wrap"><h2>Coming soon</h2><p class="intro">${WORDS.comingLead}</p><div class="grid3">${COMING_SOON.map(c => `<div class="tile"><span class="chip">Planned</span><h3>${c.title}</h3><p>${c.text}</p></div>`).join('')}</div></div></section>`;
const availableGrid = () => `<div class="grid3">${AVAILABLE.map(a => `<a class="tile tilelink" href="features.html#${a.id}"><p class="kicker">${a.kicker}</p><h3>${a.h}</h3></a>`).join('')}</div>`;

export const PAGES = [
  {
    file: 'index.html', nav: 'Home', title: 'myBoxStock: inventory and sales for streaming-box sellers',
    desc: 'Track every device, scan it with your phone, sell in a few taps, ship with printable labels and keep proof of what you tested and promised. Your data is encrypted so only you can read it. ' + (CLOSED ? WORDS.banner : 'Your data is encrypted so only you can read it.'),
    body: `
<section class="hero"><div class="wrap"><div class="prose">
<h1>Know what’s on your shelf, what you sold, and what you promised.</h1>
<p class="lead">myBoxStock is a calm, simple home for your streaming-box business. Scan a device in, sell it in a few taps, ship it with a printed label, and keep the receipt, the test record and the warranty together. Your data is locked in your own browser, so only you and your team can read it.</p>
<div class="cta">${signup()}<a class="btn secondary" href="features.html">See what it does</a></div>
${notice()}
<p class="fine">Already have an account? <a data-app="login" href="${APP_LOGIN}">Log in</a>.</p>
</div>${shot('home', 'The Home page: Get set up checklist, devices available, sales and recent activity')}</div></section>

<section class="section alt" id="available"><div class="wrap">
<h2>Available today</h2>
<p class="intro">What a reseller can do in myBoxStock right now, by the job to be done. Each one has a full description with pictures on the <a href="features.html">Features page</a>.</p>
${availableGrid()}
</div></section>

${comingSoon()}

<section class="section${COMING_SOON.length ? ' alt' : ''}"><div class="wrap center">
<h2>Your business stays yours</h2>
<p class="intro">Your inventory, customers and sales are scrambled in your own browser before they ever reach the server. ${'myBoxStock, its owner and supporting staff'} cannot read them. That also means you look after your own recovery key and your own backup files, and the app shows you how.</p>
<p class="fine"><a href="security.html">How it keeps your data private, in plain English →</a></p>
</div></section>

<section class="section${COMING_SOON.length ? '' : ' alt'}"><div class="wrap">
<h2>Questions people ask first</h2>
${faq(FAQ.slice(0, 4))}
<p class="fine"><a href="faq.html">All questions →</a></p>
</div></section>
${CLOSED ? band('Ready when sign-ups open.', 'myBoxStock is being built carefully, one feature at a time.') : band('Ready when you are.', 'Set up your first devices in an afternoon.')}`,
  },

  {
    file: 'features.html', nav: 'Features', title: 'Features: myBoxStock',
    desc: 'What a reseller can do in myBoxStock today: inventory with phone scanning, quick sale, delivery and shipping labels, returns and refunds, customers, sales and profit, team roles, backup and restore. Screenshots on a laptop and a phone.',
    body: `
<section class="pagehead"><div class="wrap"><h1>Everything a box seller needs, nothing they don’t.</h1><p class="lead prose">Below is what the app does today, organised by the work you do. Every picture is the real app, filled with made-up sample data.</p>${notice()}</div></section>
<section class="section" id="available"><div class="wrap">
<h2>Available today</h2>
<p class="intro">Only things that are built and working in the current version are listed here.</p>
${AVAILABLE.map((a, i) => row({ id: a.id, first: i === 0, kicker: a.kicker, h: a.h, body: a.body, ticks: a.ticks, pic: shot(a.shot, a.alt) })).join('\n')}
</div></section>
${comingSoon(true)}
${CLOSED ? band('Not open yet.', 'You can read about it here, and log in if you already have an account.') : band('See it with your own stock.', 'Set up your first devices in an afternoon.')}`,
  },

  {
    file: 'security.html', nav: 'Privacy & security', title: 'How it keeps your data private: myBoxStock',
    desc: 'How myBoxStock keeps your inventory, customers and sales private with zero-knowledge encryption, and the few things you look after yourself.',
    body: `
<section class="pagehead"><div class="wrap"><h1>How it keeps your data private.</h1><p class="lead prose">Here is how your data is protected, what the site can and cannot see, and the things you look after yourself.</p></div></section>
<section class="section"><div class="wrap">
<h2>The short version</h2>
<p class="intro">Everything you enter about your devices, customers and sales is scrambled in your own browser before it leaves your phone or computer. The server stores the scrambled version. The key to unscramble it stays with you and your team. This is often called zero-knowledge encryption.</p>
<div class="grid2">
<div class="tile"><span class="chip green">What the site can see</span><ul class="ticks"><li>Your business name, Reseller ID and the email addresses you gave</li><li>Usernames, user types and whether two-factor is on</li><li>Your account status and sign-in times</li><li>How many encrypted records exist, and about how large they are</li></ul></div>
<div class="tile"><span class="chip red">What the site cannot see</span><ul class="ticks"><li>Your inventory, serial numbers, costs and prices</li><li>Your customers, their addresses and their notes</li><li>Your sales, receipts, shipping details, refunds and profit</li><li>Your settings, your password or your recovery key</li></ul></div>
</div>
<p class="note"><strong>In plain words.</strong> ${LIABILITY}</p>
</div></section>

<section class="section alt"><div class="wrap">
<h2>What you look after</h2>
<p class="intro">Because nobody else can read your data, nobody else can unlock it for you either. That is the trade, and we would rather say so now than surprise you later.</p>
<div class="grid3">
<div class="tile"><span class="badge">1</span><h3>Your recovery key</h3><p>You get one when you set up, and the app will not let you carry on until you say you have saved it. Keep it in two safe places, away from the computer you work on. If every password is forgotten and the key is lost, the data cannot be recovered by anyone.</p></div>
<div class="tile"><span class="badge">2</span><h3>Your backup files</h3><p>Back up now makes a file you keep. Use Test a backup file to prove yours works before you ever need it.</p></div>
<div class="tile"><span class="badge">3</span><h3>Your team</h3><p>Give people the user type they need: Administrator, Standard or View. Reset a person’s access, switch them off, or delete them on the Team page.</p></div>
</div></div></section>

<section class="section"><div class="wrap">
<h2>Other protections</h2>
<div class="grid3">
<div class="tile"><h3>Passwords</h3><p>Passwords are stored only as one-way scrambles. Repeated wrong guesses are slowed down and blocked.</p></div>
<div class="tile"><h3>Two-factor sign-in</h3><p>Each person can add an authenticator app for an extra step at sign-in.</p></div>
<div class="tile"><h3>Activity log</h3><p>The Activity page shows sign-ins and lets you sign devices out.</p></div>
<div class="tile"><h3>Separate accounts</h3><p>Each business is walled off from every other. Nobody sees anyone else’s data.</p></div>
<div class="tile"><h3>Labels and receipts stay in your browser</h3><p>Shipping labels and receipts are built in your browser from data that is already decrypted there. Nothing about the address is sent anywhere to make them.</p></div>
<div class="tile"><h3>Closing and erasing</h3><p>You can erase a single customer for a privacy request, and export everything to spreadsheets first.</p></div>
</div></div></section>
${band('Private by design.', 'Encrypted in your browser. You hold the key.')}`,
  },

  {
    file: 'pricing.html', nav: 'Pricing', title: 'Pricing: myBoxStock',
    desc: 'Plans and pricing are still being finalized.',
    body: `
<section class="pagehead"><div class="wrap"><h1>Pricing.</h1><p class="lead prose">${WORDS.pricing}</p>${notice()}</div></section>
<section class="section"><div class="wrap">
<p class="intro">${WORDS.pricing} Nothing is charged without you agreeing first. See the <a href="billing-terms.html">Billing, trial and refund terms</a>, which are a draft.</p>
<h2>Pricing questions</h2>
${faq([
  FAQ[0],
  ['Will you tell me the price before I pay anything?', 'Always. Nothing is charged without you saying so first. See the <a href="billing-terms.html">Billing, trial and refund terms</a>, which are a draft.'],
  ['What happens to my data if I stop?', 'You can download a backup file and export spreadsheets at any time.'],
])}
</div></section>`,
  },

  {
    file: 'faq.html', nav: 'FAQ', title: 'Questions and answers: myBoxStock',
    desc: 'Short answers about myBoxStock: sign-ups, teams, passwords, your data, shipping labels and returns.',
    body: `
<section class="pagehead"><div class="wrap"><h1>Questions and answers.</h1><p class="lead prose">Short answers to what people ask first.</p>${notice()}</div></section>
<section class="section"><div class="wrap">
${faq(FAQ)}
</div></section>`,
  },

  {
    file: 'support.html', nav: 'Support', title: 'Support: myBoxStock',
    desc: 'How to get help with myBoxStock: the built-in documentation and in-app support tickets for signed-in resellers.',
    body: `
<section class="pagehead"><div class="wrap"><h1>Help when you need it.</h1><p class="lead prose">Most questions are answered inside the app. Signed-in resellers can also send a support ticket from there.</p></div></section>
<section class="section"><div class="wrap">
<div class="grid2">
<div class="tile"><h3>Documentation, in the app</h3><p>Open Documentation from the menu for a page on every screen, a troubleshooting section and a glossary, with a search box. It is written in plain language.</p></div>
<div class="tile"><h3>Support tickets, in the app</h3><p>If you have an account, open Support from the menu to send a ticket, attach a screenshot and follow the replies. There is no email address or phone number for support.</p></div>
</div>
<p class="note"><strong>What support can and cannot see.</strong> ${LIABILITY} Do not paste customer details, passwords or your recovery key into a support ticket.</p>
<h2>Already a customer?</h2>
<p class="intro">Log in to your account, or use “Forgot password?” on the sign-in page. Your own Administrators can reset any team member’s access from the Team page.</p>
<p class="cta"><a class="btn" data-app="login" href="${APP_LOGIN}">Log in</a></p>
</div></section>`,
  },
];
