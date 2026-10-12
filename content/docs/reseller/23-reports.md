---
title: Reports
summary: See how much you made, which models earn the most, which devices have sat on the shelf too long, and download a year-end sales spreadsheet for your accountant.
keywords: reports, profit, margin, revenue, cost, by month, by model, make and model, best sellers, what sells, aging, aged stock, sitting too long, shelf, days on the shelf, year-end, taxes, accountant, csv, export list, this month, last 30 days, this year, all time, last 12 months
order: 23
covers: nav:reports, Last 12 months, This month, Last 30 days, This year, All time, By month, By make and model, Sitting too long, Days on the shelf, Export list, Year-end sales CSV, Download CSV, Margin, Profit, Revenue
---

## What this page is for



Reports answers three plain questions about your business. How much did I make, and how much of it was profit? Which makes and models are worth buying more of? And which devices have been sitting on my shelf so long that I should do something about them?

Everything on the page is worked out in your own browser from the sales and devices you already have. Nothing is sent to the site's server to be added up, so the server never sees a single figure.

![Reports](shot:reseller-reports-1 "Reports: profit for the period, by month, by make and model, and what has sat too long.")

You need a user type that can read sales to open it; if yours cannot, the page says so. See [Team](#/docs/team) for user types.

## Choosing the period

Near the top there is a drop-down with five choices: **Last 12 months**, **This month**, **Last 30 days**, **This year** and **All time**. Pick one and every number on the page changes to match, except the year-end spreadsheet at the bottom, which has its own year picker.

The row of boxes under it shows the number of sales, the **Revenue**, the cost of the devices you sold, the **Profit** and the **Margin** for that period.

- **Revenue** is what customers paid, after any refunds. A refunded sale only counts for what you kept.
- **Cost** is what you paid for the devices that were sold, as entered when you added them to [Inventory](#/docs/inventory).
- **Profit** is revenue minus cost. If you charged shipping and spent your own money to ship, your shipping cost is taken off as well, so the figure is what you actually kept.
- **Margin** is profit as a share of revenue, shown as a percentage.

Voided sales are left out completely.

> If profit looks too good, look for devices with no cost. A device added without a cost counts as free, which makes the profit higher than it really was. Fix the cost in [Inventory](#/docs/inventory) and the report corrects itself.

## By month

The **By month** table lists each month in the chosen period, newest first, with the number of sales, revenue, profit and margin. Use it to spot a slow month, or to see whether a price change helped. The month is the month the sale was recorded, not the month the device was received.

## By make and model

The **By make and model** table shows what you sold in the period, grouped by make and model, with how many, the revenue, the cost, the profit and the margin of each. It counts devices, not sales, so a sale with three boxes adds three to the right rows. A device that came back through a return is not counted.

This is the table to read before you place an order. A model that sells quickly but earns a thin margin may not be worth the shelf space. A model that earns well but sells slowly may be worth buying a few more of, or not at all, depending on how long it sat.

## Sitting too long

The **Sitting too long** card lists devices that are still on your shelf, not sold and not out on demo, and arrived that many days ago or more. The oldest is at the top.

The number of days is yours to choose. Type it in **Days on the shelf** (the default is 60). An Administrator can change it; everyone else sees it greyed out. Typing 0 turns the list off. The change is saved straight away and is a setting of your account, so it is part of a backup file.

Click any row to open the device and fix its price, change its status or add a note. The same list appears on [Home](#/docs/home) as a short card with the count and a link, so you notice without having to open Reports. **Export list** downloads the list as a spreadsheet you can open in Excel or Numbers, with the device, make, model, date received, days on the shelf, status, cost and price.

## Year-end sales CSV

Pick a year from the drop-down in the **Year-end sales CSV** card and press **Download CSV**. You get one spreadsheet with a row for every sale in that calendar year: the date, receipt number, customer, devices, how it was paid, revenue after refunds, refunds, cost of devices, shipping you charged, your own shipping cost and profit. The last row is a total line.

Your accountant can use it directly, and you can keep one per year alongside your backup files. Customer names are in it, so keep it somewhere private, the same way you would keep any record of your customers. The download is created in your browser and does not pass through the server.

## Who can do what

- **Administrator**, **Standard** and **View** can open Reports if their user type includes sales. They can all download the spreadsheets.
- Only an **Administrator** can change **Days on the shelf**.

Every download is logged on the server, by who and when. The log records that a report was downloaded, never what was in it.

## Common questions

**"The numbers do not match what my bank shows."** Reports adds up sales as you recorded them. Payments you took but never recorded, or fees your card processor kept, are not in it.

**"A month is missing."** There were no sales that month in the period you chose. Widen the period.

**"Sitting too long is empty."** Either nothing has been on the shelf that long, or the number of days is 0. Check the number.

For help with anything else, see [Troubleshooting and FAQ](#/docs/troubleshooting-faq) and the [Glossary](#/docs/glossary).
