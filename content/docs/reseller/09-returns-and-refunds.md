---
title: Returns and refunds
summary: Record a customer sending devices back, whole or in part, give a refund, put each device where it belongs, and hand over a credit note, including for shipped sales.
keywords: return, returns, refund, refunds, credit note, restocking fee, send back, money back, partial return, part return, damaged, returned device, return shipping, return tracking, void, undo a sale, who can process returns, refund limit, return reasons
order: 9
covers: Return or refund, Devices that came back, What happens to it, Back to Available, Returned, Damaged (out of stock), Reason, Note (optional), Restocking fee, Shipping fee refunded, Refund given by, Return shipping, Return tracking number (optional), Return shipping cost (optional), Who paid for return shipping, Not recorded, I paid, The customer paid, Refund total, Process return, Ask an Administrator, Credit note, Email the credit note, Partly returned, Return requested, Refunds, returns.csv, Standard users can process returns, Refunds above this amount need an Administrator, Default restocking fee, Return reasons
---

## What returns and refunds are for

Sooner or later a customer brings a box back. Perhaps it does not work, perhaps it is the wrong model, perhaps they simply changed their mind. The **Return or refund** button on a sale lets you record exactly what happened: which devices came back, why, how much money went back to the customer, and where each device goes next.

This is different from voiding. **Void sale** is for a sale that should never have been recorded, such as the wrong device or a sale entered twice. It undoes the sale as if it had not happened. A return is for a sale that really happened and was later reversed in whole or in part. The original sale stays on record, so your history, your warranty records and your receipts all stay honest.

Money is still handled outside the app. If you took the payment by card, you give the refund back through your card reader or bank. The app records that you did it, how, and for how much, so your totals are right and you have a credit note to show for it.

Everything about a return is encrypted in your browser together with the sale, like the rest of your business data. It is included in your backups, in **Export everything**, and when you restore, and it is written to the activity log with the name of the person who processed it. See [Your data, your responsibility](#/docs/your-data-your-responsibility).

## Who can process a return

- **Administrators** can always process returns.
- **Standard** users can, as long as the Administrator has left the switch **Standard users can process returns** on in [Settings](#/docs/settings). It is on to start with.
- **View** users can never process a return. They can open a sale and its credit notes to look at them.
- The Administrator can also set **Refunds above this amount need an Administrator**. It is empty to start with, which means no limit. When it is set and a Standard user's refund is higher, the sheet shows a plain message and the button changes to **Ask an Administrator**. Pressing it tags the sale **Return requested**, and an Administrator can open the sale and process it.

Because your data is encrypted, the site cannot enforce these rules itself; they are checked in the app, like the discount limit. Treat them as guard rails for honest mistakes. Whoever processes a return, it is always logged with their name and user type.

## Processing a return

1. Open the sale from [Sales](#/docs/sales), from Home's recent sales or from the customer's purchases. (The receipt shown straight after finishing a sale does not offer it.)
2. Press **Return or refund**.
3. Under **Devices that came back**, tick each device the customer returned. A sale of several devices can be returned in part. The amount box beside each device starts at the price it sold for, after any discount. Lower it for a partial refund. It cannot be more than the device sold for.
4. For each ticked device, choose **What happens to it**: **Back to Available** (it goes back on the shelf and can be sold again), **Returned** (it is stock again but flagged as having come back, which is useful if you check returned boxes before reselling) or **Damaged (out of stock)** (it stays out of stock until you deal with it in [Inventory](#/docs/inventory)).
5. Choose a **Reason** from your list and, if you like, add a **Note (optional)**. The note is for you; it never goes on the customer's credit note.
6. Check the **Restocking fee**. It is empty unless you set a default in Settings, and you can type a different amount, or clear it, for this one return. The fee is kept by you, so it is taken off the refund.
7. Choose **Refund given by**, the way you gave the money back. It uses your **Paid by** list and starts with the way the customer paid.
8. Read the **Refund total** at the bottom: the devices, plus any shipping fee refunded, minus the restocking fee.
9. Press **Process return**. You see "Return recorded", and the credit note opens straight away.

![The Return or refund sheet with one device ticked, a reason, a restocking fee and a refund total](shot:reseller-returns-and-refunds-1 "The Return or refund sheet. Tick what came back and choose what happens to it.")

What changes when you press it:

- The sale shows a grey **Returned** tag when every device came back, or an amber **Partly returned** tag when only some did. The receipt marks each returned device.
- The returned devices change status as you chose, so they can be sold again if you put them back in stock.
- The warranty on a returned device ends. A fully returned sale shows a grey **Returned** chip instead of a warranty countdown.
- The sale can no longer be voided.
- Home and Sales report revenue and profit after refunds, and show the money given back separately as **Refunds**.

## Shipped sales

If the sale was shipped, the sheet has extra boxes:

- **Shipping fee refunded** - the shipping fee the customer paid on the sale. It starts at the full fee when every remaining device is being returned and is empty otherwise. Leave it empty to keep the fee. Either way it is on the credit note and in your totals.
- Under **Return shipping**, the **Return tracking number (optional)**, the **Return shipping cost (optional)** and **Who paid for return shipping**, with the choices **Not recorded**, **I paid** and **The customer paid**.

If you paid for the return postage, that cost is counted against your profit. If the customer paid, it is only recorded. Your own return postage never appears on the credit note.

## The credit note

A credit note is the refund receipt, in the same style as the sale receipt. It shows your business name, the credit note number (it starts with R-), the date, the receipt it belongs to, the customer, each device refunded and the amount, any shipping refunded, any restocking fee, the total refunded, how it was refunded and the reason you chose. It never shows what the devices cost you, your profit, your notes or your tracking details.

![A credit note with the credit note number, the device refunded and the total refunded](shot:reseller-returns-and-refunds-2 "The credit note, ready to print or email.")

- **Print** opens your browser's print window with only the credit note on the page.
- **Email** opens a box titled **Email the credit note**. Check the **Send to** address (it is filled in from the customer) and press **Send**, or press **Open in my mail app** to use your own mail program. Sending uses the same route as receipts, and the credit note is not kept on the site.
- **Done** closes it.

Open it again later from the sale: every return has a button named **Credit note** with its number. Administrators also see the list in the **Returns and refunds** card on the [Activity](#/docs/activity) page.

## How the numbers add up

Revenue is the total of the sale minus the refunds. Profit is that revenue minus the cost of the devices you still sold. If a returned device goes back to Available or Returned, its cost comes off the sale, because you still have the box. If it is marked Damaged, its cost stays, because you lost it. Return postage you paid is subtracted too. A restocking fee you keep is revenue you did not give back.

Refunds are counted in the month of the original sale, not the day you gave the money back, so a month's figures describe the sales made in that month. Voided sales are still left out of everything.

In **Export CSV** on Sales, the columns **return_status**, **refund**, **net_total** and **net_profit** show these figures for each sale. **Export everything** on the Security page adds `returns.csv`, with one row for each return.

## Settings for returns

An Administrator finds these under **Returns and refunds** in [Settings](#/docs/settings): the Standard-users switch, the refund limit, the **Default restocking fee** (none, a percentage or a flat amount) and the **Return reasons**.

## Common mistakes and tips

- **Voiding instead of returning.** If the customer really bought it, use **Return or refund**. Void cannot be combined with a return.
- **Forgetting to give the money back.** The app records the refund but never sends money. Give it through your card reader, bank or cash drawer.
- **Choosing Back to Available for a faulty box.** Use **Damaged (out of stock)** so it is not sold again by accident.
- **Wrong amount.** Returns cannot be edited afterwards. If you made a mistake, ask an Administrator to look at the sale; the credit note and activity log keep the full record.

> Tip: set your usual reasons and, if you charge one, your restocking fee in Settings once. Each return then needs only a few taps.
