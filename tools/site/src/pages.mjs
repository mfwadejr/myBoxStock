// TOOLS / site / pages — the words and layout of each marketing page. build.mjs wraps every body in the shared header and footer.
// Rules: describe only what the app does today; no email address or phone number anywhere; never mention complimentary accounts;
// liability wording is always "myBoxStock, its owner and supporting staff"; no inline styles.

export const APP_SIGNUP = 'https://app.myboxstock.com/app/#/signup', APP_LOGIN = 'https://app.myboxstock.com/app/';
export const LIABILITY = 'myBoxStock, its owner and supporting staff cannot see your customer data (inventory, customers, sales, receipts and prices) and are not responsible or liable for it. You own your data and are 100 percent responsible for it, for your recovery key, and for your own backup files and exports.';

// A laptop picture and a phone picture of the same screen (either may be left out). Sample data only.
const shot = (name, what, { laptop = true, phone = true } = {}) => `<figure class="shots${laptop && phone ? '' : ' alone'}">${laptop ? `<img class="laptop" src="ms/shots/${name}-laptop.png" width="1920" height="1200" loading="lazy" alt="${what} on a laptop. Sample data.">` : ''}${phone ? `<img class="phone" src="ms/shots/${name}-phone.png" width="585" height="1266" loading="lazy" alt="${what} on a phone. Sample data.">` : ''}</figure>`;
const signup = (label = 'Start your free 14 days', cls = '') => `<a class="btn${cls}" data-app="signup" href="${APP_SIGNUP}">${label}</a>`;
const row = ({ kicker, h, body, ticks = [], pic, first = false }) => `<div class="frow${first ? ' first' : ''}"><div><p class="kicker">${kicker}</p><h2>${h}</h2></div><div class="fbody">${body.map(p => `<p>${p}</p>`).join('')}${ticks.length ? `<ul class="ticks">${ticks.map(t => `<li>${t}</li>`).join('')}</ul>` : ''}</div><div class="fpic">${pic}</div></div>`;
const faq = (items) => `<div class="faq">${items.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('')}</div>`;
const band = (h, p) => `<section class="band"><div class="wrap"><h2>${h}</h2><p>${p}</p>${signup()}<p class="fine">No card needed to start.</p></div></section>`;

export const PAGES = [
  {
    file: 'index.html', nav: 'Home', title: 'myBoxStock: inventory and sales for streaming-box sellers',
    desc: 'Track every device, scan it with your phone, sell in a few taps, and keep proof of what you tested and promised. Your data is encrypted so only you can read it. Free for 14 days.',
    body: `
<section class="hero"><div class="wrap"><div class="prose">
<h1>Know what’s on your shelf, what you sold, and what you promised.</h1>
<p class="lead">myBoxStock is a calm, simple home for your streaming-box business. Scan a device in, sell it in a few taps, and keep the receipt, the test record and the warranty together. Your data is locked in your own browser, so only you and your team can read it.</p>
<div class="cta">${signup()}<a class="btn secondary" href="features.html">See what it does</a></div>
<p class="fine">No card needed. Already have an account? <a data-app="login" href="${APP_LOGIN}">Log in</a>.</p>
</div>${shot('home', 'The Home page: devices available, sold this month, revenue, profit and recent sales')}</div></section>

<section class="section alt"><div class="wrap">
<h2>Sound familiar?</h2>
<div class="grid3">
<div class="tile"><h3>“Which one did I test?”</h3><p>A shelf of identical boxes, a sticky note somewhere, and a customer on the phone. Each device here carries its own test checklist.</p></div>
<div class="tile"><h3>“When does their warranty end?”</h3><p>You told them 90 days. Every sale keeps its warranty with a live countdown, and the receipt says what you promised.</p></div>
<div class="tile"><h3>“It’s in the spreadsheet… somewhere.”</h3><p>One version on your laptop, another on your phone, a third your helper edited last Tuesday. Here everyone works from the same up-to-date account.</p></div>
</div></div></section>

<section class="section"><div class="wrap">
<h2>Three steps, no training day</h2>
<p class="intro">We kept it small on purpose. If you can fill in a form and press a button, you can run it.</p>
<div class="grid3">
<div class="tile"><span class="badge">1</span><h3>Add your stock</h3><p>Type devices in, import a spreadsheet, or point your phone at the label and scan the serial, MAC address or UID. Track what matters to you: make, model, condition, supplier and anything else you add yourself.</p></div>
<div class="tile"><span class="badge">2</span><h3>Sell in a few taps</h3><p>Scan or type an ID, or browse what’s in stock and tick what the customer is taking. Sell one or fifty, give a percentage off a device or the whole order, then print or email the receipt.</p></div>
<div class="tile"><span class="badge">3</span><h3>Stand behind it</h3><p>Every sale keeps its test record, its receipt and a warranty countdown, so “did you check this one?” has a real answer.</p></div>
</div>
<p class="fine"><a href="features.html">Every feature, with screenshots →</a></p>
</div></section>

<section class="section alt"><div class="wrap">
<h2>Made for the way you actually sell</h2>
<div class="grid2">
<div class="tile"><h3>Resellers and distributors</h3><p>Moving volume? Add a whole model by quantity, bulk scan a stack of boxes, take a percentage off a line or the full order, and let your team work without handing everyone the keys.</p>
<ul class="ticks"><li>Administrator, Standard and View-only user types</li><li>A discount limit for Standard users</li><li>Optional two-factor sign-in for every person</li><li>An activity record of who signed in, and from where</li></ul></div>
<div class="tile"><h3>Small sellers</h3><p>Selling a few boxes on the side? Nothing here asks you to be an accountant. Add a device, sell it, hand over a receipt.</p>
<ul class="ticks"><li>Works in your phone’s browser, nothing to install</li><li>Receipts you can print or email</li><li>Customers remembered for next time</li><li>Your list of what’s left is always current</li></ul></div>
</div></div></section>

<section class="section"><div class="wrap center">
<h2>Your business stays yours</h2>
<p class="intro">Your inventory, customers and sales are scrambled in your own browser before they ever reach the server. ${'myBoxStock, its owner and supporting staff'} cannot read them. That also means you look after your own recovery key and your own backup files, and the app shows you how.</p>
<p class="fine"><a href="security.html">How that works, in plain English →</a></p>
</div></section>

<section class="section alt"><div class="wrap">
<h2>Questions people ask first</h2>
${faq([
  ['Do I need a credit card to try it?', 'No. You get 14 days free with everything switched on. Nothing to cancel.'],
  ['Can my team use it too?', 'Yes. Add people from the Team page and choose what each of them can do: Administrator, Standard or View only.'],
  ['What if I forget my password?', 'You can reset it from the sign-in page. Because your data is encrypted for you alone, you also get a recovery key when you set up. Keep it somewhere safe. It is how you get back into your data if every password is forgotten.'],
  ['Can I get my data out?', 'Yes. Download a backup file of the whole account at any time, and export your inventory, customers and sales to spreadsheet files. You can also test a backup file to prove it works before you ever need it.'],
  ['Does it work on a phone?', 'Yes. It runs in your browser, so a phone, a tablet or a laptop all work, and the phone camera can scan serial numbers and MAC addresses.'],
])}
</div></section>
${band('Ready when you are.', 'Set up your first devices in an afternoon. Your free trial starts the moment you sign up.')}`,
  },

  {
    file: 'features.html', nav: 'Features', title: 'Features: myBoxStock',
    desc: 'Inventory with phone scanning, quick sale and receipts, customers, sales and warranty, test steps, team roles, backup and restore. Screenshots on a laptop and a phone.',
    body: `
<section class="pagehead"><div class="wrap"><h1>Everything a box seller needs, nothing they don’t.</h1><p class="lead prose">Every screen below is the real app on a laptop and a phone, filled with made-up sample data.</p></div></section>
<section class="section"><div class="wrap">
${row({ first: true, kicker: 'Home', h: 'The day at a glance', body: ['Devices available, devices sold this month, revenue and profit, a low-stock warning and your recent sales. Open any receipt with a click.'], ticks: ['Quick sale button one tap away', 'Reminders to back up, with a Back up now button', 'Announcements and account notices in one place'], pic: shot('home', 'The Home page') })}
${row({ kicker: 'Inventory', h: 'Every device, with its history', body: ['Add devices one at a time, by quantity, by bulk scan or by importing a spreadsheet. Choose which details you track (UID, serial number, MAC address, condition, supplier and your own), and which of them can be looked up at the till.'], ticks: ['Search by any identifier, filter by status or model', 'Statuses: Available, Reserved, Sold, Returned, Damaged, Archived', 'Optional rule: only sell devices whose required tests are done', 'Export to a spreadsheet whenever you like'], pic: shot('inventory', 'The Inventory page with tested and not-tested chips and status') })}
${row({ kicker: 'Scanning with your phone', h: 'Point, scan, done', body: ['Tap the camera button beside any serial, MAC address or UID box and read the label with your phone’s back camera. Tap the barcode you want if a label has several, and the scanner aims at it.', 'The scanner says “Got it”, beeps, fills the box and flashes it green so you can see which field took the code.'], ticks: ['Works in Add device, Bulk scan, Quick sale and the search box', 'Small, Medium and Large scan boxes, a torch where your phone allows it', 'Optional “Confirm each scan” step', 'Type it instead, or take a photo, when the live view will not focus'], pic: shot('scanner', 'The phone scanner reading a label', { laptop: false }) })}
${row({ kicker: 'Quick sale', h: 'Sell in a few taps', body: ['Scan or type an ID, browse available stock and tick what the customer takes, or add by quantity. Set the price per device, take a percentage off a line or the whole order, choose the customer, the warranty and how they paid.'], ticks: ['Back-date a sale to the day it really happened', 'Printed or emailed receipts with the warranty on them', 'Add a new customer without leaving the sale', 'Standard users are held to a discount limit you set'], pic: shot('quick-sale', 'Quick sale with two devices, a customer and a total') })}
${row({ kicker: 'Customers', h: 'Remember who bought what', body: ['Every customer has a record with their purchases, how much they have spent and their last purchase. A customer calls about a box, you search their name and see the receipt and whether they are still in warranty.'], ticks: ['Notes for delivery preferences or reminders', 'Export one customer’s data, or erase them for a privacy request', 'Receipts are pre-filled with their saved email address'], pic: shot('customers', 'The Customers page') })}
${row({ kicker: 'Sales, receipts and warranty', h: 'Proof, not guesses', body: ['Every sale is a receipt with the devices, identifiers, price, payment method and a warranty countdown. Tick “Include the test record” and the receipt also shows what was checked on each device before it left.', 'Search by serial, customer or payment method, filter by dates or warranty status, and void a sale to put its devices back in stock.'], ticks: ['Test steps you define: tick them per device, require them before sale if you want', 'Warranty periods you define; each sale keeps its own snapshot', 'Totals for sales, revenue, profit and devices sold in the period', 'Export the list to a spreadsheet'], pic: shot('sales-receipt', 'A receipt with its test record, total and warranty') })}
${row({ kicker: 'Team', h: 'Let people help, safely', body: ['Add the people who work with you, each with their own username and password under your Reseller ID. Choose what they can do and switch a person off without touching anyone else.'], ticks: ['Administrator: everything, including Team, Settings and Backup', 'Standard: inventory, customers and sales', 'View: look but not change', 'Two-factor sign-in is optional and each person turns it on for themselves', 'The Activity page shows who signed in and on which devices'], pic: shot('team', 'The Team page with three user types') })}
${row({ kicker: 'Settings', h: 'Shape it to the way you trade', body: ['Choose the details you track, build your test checklist, set your warranty periods and payment methods, and keep your list of makes and models tidy. Lists can be put in any order with the Reorder switch.'], ticks: ['Details can be required to be unique, such as MAC address', 'Customer emails with your own wording and logo', 'Changes are yours alone: they are encrypted like everything else'], pic: shot('settings', 'The Settings page with device details to track') })}
${row({ kicker: 'Backup and restore', h: 'Your own copy, proven to work', body: ['Back up now saves one file of the whole account: devices, customers, sales, receipts, settings and your team list (never passwords). It is encrypted, so it is useless without your password or recovery key.', '<strong>Test a backup file</strong> opens a file in your browser and tells you, check by check, whether it is good: made for this account, opens with your key, complete, every record readable. Nothing is restored, changed or sent. When you do need it, Restore shows you what is inside first and keeps an undo copy.'], ticks: ['“Last backup” reminder so it does not slip', 'Spreadsheet exports for your accountant', 'Save to Files on iPhone and iPad, or download on a computer'], pic: `<div class="stack">${shot('backup', 'The Backup and restore page')}${shot('backup-test', 'The Test a backup file report, every check passed')}</div>` })}
</div></section>
${band('See it with your own stock.', 'Fourteen days, everything switched on, no card.')}`,
  },

  {
    file: 'security.html', nav: 'Privacy & security', title: 'Privacy and security: myBoxStock',
    desc: 'How myBoxStock keeps your inventory, customers and sales private with zero-knowledge encryption, and the few things you look after yourself.',
    body: `
<section class="pagehead"><div class="wrap"><h1>Your business stays yours.</h1><p class="lead prose">Here is how your data is protected, what the site can and cannot see, and the things you look after yourself.</p></div></section>
<section class="section"><div class="wrap">
<h2>The short version</h2>
<p class="intro">Everything you enter about your devices, customers and sales is scrambled in your own browser before it leaves your phone or computer. The server stores the scrambled version. The key to unscramble it stays with you and your team. This is often called zero-knowledge encryption.</p>
<div class="grid2">
<div class="tile"><span class="chip green">What the site can see</span><ul class="ticks"><li>Your business name, Reseller ID and the email addresses you gave</li><li>Usernames, user types and whether two-factor is on</li><li>Your plan, trial dates and sign-in times</li><li>How many encrypted records exist, and about how large they are</li></ul></div>
<div class="tile"><span class="chip red">What the site cannot see</span><ul class="ticks"><li>Your inventory, serial numbers, costs and prices</li><li>Your customers and their notes</li><li>Your sales, receipts, discounts and profit</li><li>Your settings, your password or your recovery key</li></ul></div>
</div>
<p class="note"><strong>In plain words.</strong> ${LIABILITY}</p>
</div></section>

<section class="section alt"><div class="wrap">
<h2>What you look after</h2>
<p class="intro">Because nobody else can read your data, nobody else can unlock it for you either. That is the trade, and we would rather say so now than surprise you later.</p>
<div class="grid3">
<div class="tile"><span class="badge">1</span><h3>Your recovery key</h3><p>You get one when you set up, and the app will not let you carry on until you say you have saved it. Keep it in two safe places, away from the computer you work on. If every password is forgotten and the key is lost, the data cannot be recovered by anyone.</p></div>
<div class="tile"><span class="badge">2</span><h3>Your backup files</h3><p>Back up now makes a file you keep. The site takes its own safety copies for its own emergencies, but a backup file you hold is your real protection. Use Test a backup file to prove yours works.</p></div>
<div class="tile"><span class="badge">3</span><h3>Your team</h3><p>Give people the user type they need. Reset a person’s access, switch them off, or delete them on the Team page. Nobody else on the account has to change a password.</p></div>
</div></div></section>

<section class="section"><div class="wrap">
<h2>Other protections</h2>
<div class="grid3">
<div class="tile"><h3>Passwords</h3><p>Passwords are stored only as one-way scrambles. Repeated wrong guesses are slowed down and blocked, and a locked-out person can be unlocked by the site’s operator.</p></div>
<div class="tile"><h3>Two-factor sign-in</h3><p>Each person can add an authenticator app for an extra step at sign-in.</p></div>
<div class="tile"><h3>Sign-in alerts</h3><p>When email is set up on the site, you are told about a sign-in from somewhere new, and the Activity page lets you sign devices out.</p></div>
<div class="tile"><h3>Separate accounts</h3><p>Each business is walled off from every other. Nobody sees anyone else’s data.</p></div>
<div class="tile"><h3>Checked backups</h3><p>The site is backed up on a schedule, and every backup is checked after it is written. A restore of the whole site brings everything back together, but cannot restore one business by itself, which is why your own backup file matters.</p></div>
<div class="tile"><h3>Closing and erasing</h3><p>You can close your account yourself, after a short waiting period, and erase a single customer for a privacy request. You can export everything to spreadsheets first.</p></div>
</div></div></section>

<section class="section alt"><div class="wrap">
<h2>Questions about privacy</h2>
${faq([
  ['Can the site help me if I lose my password?', 'It can help you sign in again and tell you about your account status. It cannot open your data. An Administrator on your team can use Reset access, or you can use your recovery key.'],
  ['Does it work if someone steals my backup file?', 'The file is encrypted and only opens with your password or your recovery key, so it is as hard to open as the stored copy.'],
  ['Who is responsible for my data?', 'You are. You own it, and you are 100 percent responsible for it, for your recovery key and for your own backup files and exports. The full wording is on the <a href="data-responsibility.html">Data responsibility and acceptable use</a> page, which is a draft.'],
])}
</div></section>
${band('Private by design.', 'Try it with your real stock for 14 days.')}`,
  },

  {
    file: 'pricing.html', nav: 'Pricing', title: 'Pricing and free trial: myBoxStock',
    desc: 'Free for 14 days with every feature, no card needed. What happens at the end of the trial, and how plans work.',
    body: `
<section class="pagehead"><div class="wrap"><h1>Try it properly. Free for 14 days.</h1><p class="lead prose">Everything switched on, no card needed. Add your stock, sell something, invite your team, and see if it fits.</p></div></section>
<section class="section"><div class="wrap">
<div class="grid2">
<div class="tile"><span class="chip blue">Free trial</span><h3>14 days with every feature</h3><ul class="ticks"><li>No payment details asked for</li><li>All features, no limits during the trial</li><li>Your team can join you</li><li>Backups and exports whenever you like</li></ul><p><a class="btn" data-app="signup" href="${APP_SIGNUP}">Sign up free</a></p></div>
<div class="tile"><span class="chip">Paid plan</span><h3>When you decide to continue</h3><ul class="ticks"><li>Set up for your account by the person who runs the site, once you agree terms</li><li>May run to an end date or keep going until changed</li><li>Everything works exactly as it did in the trial</li></ul><p>Plans and prices are being finalised. Everyone who signs up now keeps their trial, and you will be told what is coming before anything changes. Nothing is charged without you agreeing first.</p></div>
</div>
<h2>What happens when a period ends</h2>
<div class="grid3">
<div class="tile"><h3>Before the end</h3><p>A chip in the top bar counts down the days of your trial.</p></div>
<div class="tile"><h3>At the end</h3><p>The account becomes read-only. You can still sign in, look at everything, print receipts, back up, export and change your own password.</p></div>
<div class="tile"><h3>After the end</h3><p>Nothing is deleted because a period ended. Ask to continue and carry on where you left off, with all your stock, customers and sales still there.</p></div>
</div>
</div></section>
<section class="section alt"><div class="wrap">
<h2>Pricing questions</h2>
${faq([
  ['Will you tell me the price before I pay anything?', 'Always. Nothing is charged without you saying so first. See the <a href="billing-terms.html">Billing, trial and refund terms</a>, which are a draft.'],
  ['I sell in volume. Is there something for me?', 'That is who we are building for. The support portal is where you will be able to tell us how many devices and people you have.'],
  ['What happens to my data if I stop?', 'You can download a backup file and export spreadsheets at any time, trial or not, including after a trial has ended.'],
  ['Does the trial need a card?', 'No.'],
])}
</div></section>
${band('Start with the trial.', 'Fourteen days, everything on.')}`,
  },

  {
    file: 'support.html', nav: 'Support', title: 'Support: myBoxStock',
    desc: 'How to get help with myBoxStock: the built-in documentation and the support portal.',
    body: `
<section class="pagehead"><div class="wrap"><h1>Help when you need it.</h1><p class="lead prose">Most questions are answered inside the app. For everything else there will be a support portal.</p></div></section>
<section class="section"><div class="wrap">
<div class="grid2">
<div class="tile"><h3>Documentation, in the app</h3><p>Open Documentation from the menu for a page on every screen, a troubleshooting section and a glossary, with a search box. It is written in plain language.</p></div>
<div class="tile"><h3>The support portal</h3><p>Contact is through the myBoxStock support portal, which is planned and not open yet. This page will link to it when it is. Please do not look for an email address or phone number: there isn’t one.</p></div>
</div>
<p class="note"><strong>What support can and cannot see.</strong> ${LIABILITY} When the portal opens, do not paste customer details, passwords or your recovery key into a support request.</p>
<h2>Already a customer?</h2>
<p class="intro">Log in to your account, or use “Forgot password?” on the sign-in page. If you are locked out, the person who runs your site can unlock you. Your own Administrators can reset any team member’s access from the Team page.</p>
<p class="cta"><a class="btn" data-app="login" href="${APP_LOGIN}">Log in</a></p>
</div></section>`,
  },
];
