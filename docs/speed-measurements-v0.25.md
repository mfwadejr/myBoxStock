# Big-account speed measurements (T49, v0.25.0)

Measure first. Nothing in the app was changed to produce these numbers. Re-run with `node tools/measure-speed.mjs --set demo300` (sets: demo3, demo300, demo1000, demo5000; add `--json file` to save). The script builds the set into a throwaway folder, starts the real server on it, drives headless Chromium as the Owner of the largest demo account, and deletes the folder afterwards.

Run date 2026-10-09, Node 22, Chromium headless, one run per cell after one warm-up sign-in (page-open and search cells are the median of 3). Expect about 20 to 30 percent run-to-run noise. All times are milliseconds unless shown as seconds.

## What was measured, and how far to trust it

- **Largest account** in each set is the account holding the most records (devices + customers + sales + models). That is the worst case for that set. The other accounts in a set are far smaller (median 24 to 100 devices), so sign-in for a typical reseller is much quicker than the numbers below.
- **Profiles.** Laptop: 1280px, no slowdown. Recent phone: 390px, Chromium CPU throttle 4x. Older phone: 375px, throttle 6x. The throttle slows JavaScript and page drawing; it does NOT slow the browser's built-in crypto (decryption runs natively), so real phones are probably somewhat slower than "Older phone" on the decrypt step. Treat the phone columns as a floor.
- **Network is localhost.** No download delay is simulated. The size of the download is given so a real link can be added: about 2.0 MB for 2,000 devices and 3.1 MB for 3,000 devices (about 1 s and 1.5 s on a 15 Mbit/s mobile link; more on a slow one).
- **Demo sign-in uses 100,000 key-stretching rounds; real accounts use 600,000.** The script times 600,000 rounds separately in the same browser (110 to 265 ms in these runs) so the real sign-in cost is roughly the "usable Home" figure plus 0.1 to 0.25 s.
- **Memory** is the browser's JavaScript heap after a garbage collection (decrypted records held in memory). It is not the whole browser process; a phone browser tab will use more. It is the number that grows with the account.
- **Search times** include the 180 ms typing pause the app waits before searching, so about 190 to 230 ms is the floor (a value of ~190 means the search itself was nearly free).
- Customer and sale data are small in the demo (about 600 bytes per record). Real records with long notes will be larger.

## Account sizes measured

| Set | Accounts built | Records in the whole set | Build time | Largest account: devices | customers | sales | records |
|---|---|---|---|---|---|---|---|
| Demo3 | 3 | 998 | 0.4 s | 493 | 145 | 131 | 771 |
| Demo300 | 300 | 77,136 | 7 s | 1,968 | 592 | 547 | 3,112 |
| Demo1000 | 1,000 | 322,443 | 32 s | 1,974 | 601 | 552 | 3,131 |
| Demo5000 | 5,000 | 2,182,622 | 3 min 49 s | 2,996 | 909 | 825 | 4,737 |

(The Demo300/1000 largest accounts are about 2,000 devices because the default maximum is 2,000; Demo5000's maximum is 3,000. Median account: 24 to 100 devices.)

## Results, largest account of each set

### Sign-in submit to a usable Home (every record downloaded and decrypted)

| Set | Laptop | Recent phone | Older phone |
|---|---|---|---|
| Demo3 (771 records) | 0.71 s | 0.84 s | 0.97 s |
| Demo300 (3,112) | 0.82 s | 1.81 s | 2.31 s |
| Demo1000 (3,131) | 0.68 s | 1.61 s | 2.21 s |
| Demo5000 (4,737) | 0.97 s | 2.25 s | 3.26 s |

Where it goes (Demo5000, same account, measured by reloading with an empty store):

| Step | Laptop | Recent phone | Older phone |
|---|---|---|---|
| Download of all records (3.1 MB, localhost) | 62 ms | 119 ms | 210 ms |
| Download plus decrypt of all records again | 291 ms | 1,212 ms | 1,853 ms |
| Same load when nothing has changed (no decrypt) | 61 ms | 141 ms | 196 ms |

So on a phone, decrypting every record is about 55 percent of the wait. The rest is the sign-in request itself, key derivation, and drawing Home. A load where nothing changed is 10 to 20 times cheaper than a full one.

### JS memory after sign-in (decrypted records held in the page)

| Set | Laptop | Recent phone | Older phone |
|---|---|---|---|
| Demo3 | 2.5 MB | 2.6 MB | 2.6 MB |
| Demo300 | 3.6 MB | 3.6 MB | 3.6 MB |
| Demo1000 | 3.6 MB | 3.6 MB | 3.6 MB |
| Demo5000 | 4.4 MB | 4.4 MB | 4.4 MB |

After using every screen the heap stayed under 8 MB in all runs. Memory is not a problem at these sizes (roughly 1 KB per record).

### Opening Inventory, Sales and Customers (from Home, data already loaded) and searching each

Open / search, in milliseconds. Search includes the 180 ms typing pause.

| Set | Screen | Laptop | Recent phone | Older phone |
|---|---|---|---|---|
| Demo3 | Inventory | 51 / 200 | 233 / 249 | 320 / 289 |
| | Sales | 58 / 187 | 145 / 210 | 228 / 230 |
| | Customers | 68 / 185 | 144 / 201 | 179 / 217 |
| Demo300 | Inventory | 109 / 227 | 451 / 414 | 644 / 493 |
| | Sales | 71 / 188 | 263 / 213 | 296 / 232 |
| | Customers | 73 / 185 | 223 / 202 | 305 / 210 |
| Demo1000 | Inventory | 115 / 227 | 439 / 406 | 623 / 523 |
| | Sales | 76 / 188 | 243 / 217 | 388 / 234 |
| | Customers | 74 / 185 | 218 / 212 | 317 / 228 |
| Demo5000 | Inventory | 164 / 249 | 616 / 516 | 954 / 686 |
| | Sales | 99 / 190 | 333 / 218 | 493 / 233 |
| | Customers | 96 / 185 | 284 / 203 | 401 / 217 |

### Quick sale: scan to the device appearing in the cart

Three scans in a row, milliseconds (the first is usually the slowest).

| Set | Laptop | Recent phone | Older phone |
|---|---|---|---|
| Demo3 | 39 / 20 / 25 | 105 / 49 / 48 | 89 / 51 / 49 |
| Demo300 | 34 / 25 / 27 | 115 / 64 / 78 | 184 / 151 / 84 |
| Demo1000 | 35 / 26 / 26 | 111 / 71 / 72 | 165 / 75 / 99 |
| Demo5000 | 31 / 26 / 32 | 130 / 87 / 104 | 185 / 147 / 121 |

### Reseller backup (Back up now, file saved)

| Set | File size | Time (laptop) | Time (recent phone) | Time (older phone) |
|---|---|---|---|---|
| Demo3 | 0.47 MB | 0.9 s | 1.0 s | 1.6 s |
| Demo300 | 1.9 MB | 1.0 s | 0.5 s | 0.6 s |
| Demo1000 | 1.9 MB | 1.0 s | 0.4 s | 0.6 s |
| Demo5000 | 2.9 MB | 0.2 s | 0.7 s | 0.9 s |

All under about 1.6 s. The times do not follow size or profile because the figure is dominated by a roughly fixed cost and run noise; the file is built from the records already in memory. The backup file is about the same size as the download (the data is already encrypted, so it does not compress much).

## Reading it in plain language

- **Nothing is slow today, even at the largest sizes tested.** The biggest account we can build (about 3,000 devices, 900 customers, 825 sales) signs in and shows a usable Home in about 1 s on a laptop, about 2.3 s on a recent phone and about 3.3 s on an older phone, before real network time. Memory use is tiny.
- **The slowest single thing is sign-in on a phone with a big account**, and about half of that is decrypting every record one after another (about 30 percent on the laptop). It grows in a straight line with the number of records: about 0.06 ms per record on a laptop, 0.26 ms on the recent phone and 0.39 ms on the older phone (download plus decrypt). At 3,000 devices an older phone waits about 3 s; an account with 10,000 devices (about 16,000 records) would wait roughly 10 s, which would feel slow. The tested maximum (3,000 devices) is not yet a problem.
- **The next slowest is opening Inventory on a phone with a big account**: about 0.6 s (recent phone) and 0.95 s (older phone) at 3,000 devices, growing with device count. Sales and Customers are about half of that.
- **Search is fine.** After the built-in 180 ms pause, search itself takes 5 to 50 ms except Inventory on phones (about 300 to 500 ms of work at 3,000 devices).
- **Quick sale scanning is fine** (under 200 ms on every profile), and backup is fine (a couple of MB, a second or two).
- **Real network will add time we did not measure:** the download is 2 to 3 MB and the app does not compress responses itself (the data is encrypted, so compression helps little: about 25 percent from the text encoding). On a slow mobile link the download may become the biggest part of the wait.
- **Limits of these runs:** localhost network, synthetic made-up data, a software CPU slowdown rather than real phones, demo accounts with fewer key-stretching rounds. Real phones should be checked once before deciding anything.

## Candidate fixes, ranked (NOT implemented; for the owner to approve)

Ranked by benefit for effort and risk, given the numbers. None changes encryption or the zero-knowledge promise. Given the numbers, none is urgent at 3,000 devices; they pay off as accounts grow toward 10,000 devices or on slow links.

1. **Decrypt records in parallel batches (or a Web Worker) instead of one at a time.** Decryption is about 55 percent of the phone sign-in wait and is done record by record. Batching 20 to 50 at a time keeps the screen responsive and may cut that part noticeably on phones with several cores. Small change in the store load code; not on the owner's original list, offered as the lightest first step.
2. **Show Home first, then finish loading in the background with a progress indicator.** Home needs recent sales and counts; load and decrypt those first (newest records first), draw Home, then fill the rest. Makes the wait feel a fraction of its length for any account size. Moderate change (the store must tolerate partly loaded data and screens show "still loading" until done).
3. **Changes-only downloads with a browser cache of the encrypted records** (cleared at sign-out). A load where nothing changed costs 0.06 to 0.2 s versus up to 1.9 s for a full one, so repeat visits and page refreshes become near-instant; only changed records are downloaded and decrypted. Needs a "changed since" request on the records route and a careful cache; keep the cache encrypted (it holds the same ciphertext the server holds), which keeps the promise intact. Bigger change and bigger test surface; also the largest saving on slow links.
4. **Draw only the rows on screen in Inventory (paged or virtual list), and build the search index once.** Inventory is the slowest screen and grows with device count (0.95 s on an older phone at 3,000). Likely only needed past roughly 5,000 devices per account; low risk for the Customers and Sales lists, which are already fast.
5. **Smaller response over the wire:** confirm the reverse proxy compresses `/api/app/vault/records`; add HTTP compression in the app if not. Cheap, but a modest saving because the payload is encrypted text.

Suggested first step if the owner wants something now: items 1 and 2 together. Items 3 and 4 only if larger accounts (over about 5,000 devices) become real.

## Not measured or not feasible here

- Real phones and real mobile networks (this sandbox has neither); the throttle is a rough stand-in.
- Accounts above 3,000 devices (the Demo mode maximum for these sets is 3,000; the setting allows up to 20,000 per account, which would be the next thing to measure).
- Peak process memory of the whole browser (only the JavaScript heap is reported).
- Host-side load (server CPU/database) while many resellers sign in at once; that is the separate load simulation already in the project (claude/load-and-size-simulation-2026-10-07.md).
