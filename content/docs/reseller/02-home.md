---
title: Home
summary: Your daily dashboard: how many devices you have ready to sell, what you sold and earned this month, which models are running low, and your latest sales.
keywords: home, dashboard, overview, stats, available devices, revenue, profit, low stock, reorder, recent sales, this month, banner, trial, read-only, receipt
order: 2
covers: nav:home, Quick sale, Available devices, Devices sold this month, Revenue this month, Profit this month, Low stock, Recent sales, Date, Receipt, Customer, Total, Walk-in, email confirmation banner, Send it again, announcement banner, Close, closing account banner, Restore account, records could not be opened, free trial chip, Trial ended read-only
---

## What Home is for

Home is the first page you see after signing in. Think of it as the whiteboard on the wall of your shop: a quick look at how business is going this month, with nothing to type. You can leave it open on a tablet at the counter and glance at it between customers.

Home only shows information. Everything on it is worked out inside your browser from your own records, after they have been unscrambled with your key. The site itself never sees these totals. Because of this, the page always reflects the latest records your team has saved when you open it.

Everyone who can sign in can see Home. Only people whose user type can record sales see the **Quick sale** button. See [Team](#/docs/team) for user types.

## The top of the page

At the top you will see the word **Home**, your business name, and the current month and year, for example "Acme Streaming · October 2026". The month matters because the four tiles below count from the first day of this calendar month up to now.

### The Quick sale button

If you are allowed to record sales, a **Quick sale** button sits in the page heading. Pressing it opens [Quick sale](#/docs/quick-sale), where you add devices, choose a customer and finish a sale. It saves a trip to the menu when a customer is standing in front of you.

## The four tiles

### Available devices

This is the number of devices you can sell right now, and below it the total cost of those devices (the "at cost" amount, which is the sum of the Cost you entered for each one).

Why you want it: it answers "how much stock do I have, and how much money is sitting on my shelf?" at a glance.

What counts as available: devices whose status is **Available** (or **Returned**) and which are ready to sell. Devices that are Reserved, Sold, Damaged or Archived are not counted. If your Administrator turned on **Sell only tested devices** in [Settings](#/docs/settings), a device that has not finished its required tests shows as **Awaiting test** in [Inventory](#/docs/inventory) and is also left out of this count until its tests are ticked.

### Devices sold this month

The number of devices sold since the first of the month, with the count of sales underneath, for example "12 devices, in 9 sales". One sale can include several devices, which is why the two numbers can differ.

Voided sales are not counted. If you void a sale, the numbers change straight away. See [Sales](#/docs/sales) for voiding.

### Revenue this month

The total of all sales this month after discounts. If you sold three boxes at 50.00 and gave 10 percent off one of them, revenue counts the discounted price. Revenue is money coming in; it does not subtract your costs.

### Profit this month

Revenue minus the cost of the devices that were sold. It uses the **Cost** you entered on each device at the time of the sale, so it only tells the truth if your costs are filled in. A device with no cost recorded counts as zero cost, which makes profit look better than it is.

> Tip: if your profit looks too high, open Inventory and check that every device has a Cost. Costs saved with a sale stay with that sale even if you later edit the device.

Amounts are shown in US dollars with the formatting of your browser.

## The Low stock warning

When any model drops to or below the reorder level you set, a banner appears reading **Low stock** with the model name, how many are left, and the reorder level, for example "Fire Stick 4K (2 left, reorder at 3)".

How a model gets a reorder level: in [Inventory](#/docs/inventory), the **Stock levels** area lists each model with a **Reorder at** box. A level of 0 turns the warning off for that model. Once you have set a number, the warning appears on Home and on the Inventory page whenever the available count is equal to or below it.

Why you want it: it is an early reminder to place a supplier order before you run out, instead of finding out when a customer asks for something you do not have.

Example: you sell about five of one model each week and your supplier takes a week to deliver. Set the reorder level to 6. When the shelf drops to 6, Home tells you it is time to order.

The warning is based only on devices that are available. Devices that are awaiting test, sold or archived do not count towards "left".

## Recent sales

Below the tiles is a short list headed **Recent sales** with your six most recent sales, newest first (voided sales are not shown here). The columns are:

- **Date**: when the sale happened, with the time.
- **Receipt**: the receipt number, starting with S- followed by the date and a few letters and digits.
- **Customer**: the customer's name. Sales recorded without a customer, such as very old ones, show **Walk-in**.
- **Total**: what the customer paid.

### Opening a receipt

Click or tap any row to open its receipt. From the receipt you can print it, email it, show the test record, and (if you are allowed to record sales) void the sale or, as an Administrator, change its warranty. The full set of receipt buttons is explained on the [Quick sale](#/docs/quick-sale) and [Sales](#/docs/sales) pages.

If there are no sales yet the list says **No sales yet.** If you are able to add devices and have none, it also suggests you start by adding devices under Inventory.

## Banners you may see on Home

Several notices can appear above the tiles. None of them need you to leave Home.

### Confirm your email address

A blue banner says "Confirm your email address" and where we sent the link. Press **Send it again** to receive a fresh link. Until you confirm, password reset by email and adding team members may be held back. This banner is also shown on [Security](#/docs/security).

### Announcements

Your site administrator can post a message for everyone, in blue, amber or red depending on how important it is. Press **Close** to hide it. It stays hidden on that browser until the message changes.

### Account closing

A red banner says the account is closing and gives the date it will be erased. Until then the account is read-only. An Administrator will see a **Restore account** button to cancel the closing. If you do not want to lose your data, make sure you have exported it first; see [Your data, your responsibility](#/docs/your-data-your-responsibility).

### Records that could not be opened

A red banner says that a number of records could not be opened with your key. Sign out and back in. If it continues, contact support, and make sure you have recent exports of your data.

### Free trial and read-only

At the top of every page, a blue chip shows the days left in your free trial. When a trial or paid period ends it changes to a red chip saying **Trial ended** (read-only). In that state you can still look at your information and export it, but you cannot save changes. See [Plans, trials and billing](#/docs/plans-trials-billing).

## How to use Home day to day

1. Sign in and look at the tiles. Is the available count where you expect it?
2. Check for a Low stock banner. If you see one, decide whether to reorder.
3. Scan the recent sales for anything odd, such as an unexpected total or a customer you do not recognise. Click it to look at the receipt.
4. If a customer is waiting, press **Quick sale**.

## What Home is not

- It is not a report you can export. For lists and spreadsheets use [Sales](#/docs/sales), [Inventory](#/docs/inventory) and the export tools in [Security](#/docs/security).
- It does not have filters. For a different time period, use the period buttons on [Sales](#/docs/sales).
- It does not show a graph. The numbers are for this calendar month only; on the first day of a new month the sales tiles start again from zero.

## Common mistakes and questions

**"My Available count is lower than the number of boxes on the shelf."** Check their status in Inventory. Boxes marked Reserved, Damaged or Archived are not counted, and boxes still awaiting their test are left out if testing is required before sale.

**"The month total dropped after I voided a sale."** That is correct. Voided sales are removed from the tiles and the devices return to available.

**"I recorded a sale yesterday and it is missing from Recent sales."** Home shows only the six newest. Open [Sales](#/docs/sales) for the full list. Also check the date and time you entered for the sale: a sale dated in the past sorts by its sale date, not by when you typed it.

**"Two people see different numbers."** Each page reads the latest saved records when you open it. Navigate to another page and back to refresh.

**"The Quick sale button is missing."** Your user type does not include recording sales. Ask an Administrator. See [Team](#/docs/team).

**"Profit looks too good."** Costs are probably missing on some devices. Add them in [Inventory](#/docs/inventory).
