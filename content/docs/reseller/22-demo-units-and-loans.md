---
title: Demo units and loans
summary: Lend a device to a customer or prospect for a demo, an RMA replacement or a repair, see who has it and for how long, and check it properly when it comes back.
keywords: demo, demo unit, loan, loaner, lend, lend out, on demo, return from demo, rma, replacement, prospect, borrower, due back, overdue, customer keeps it, sell to borrower, included items, remote, batteries, power adapter, hdmi, retest, damage, condition, loans.csv, trial
order: 22
covers: Lend out, Return from demo, Sell to borrower, On demo, Overdue, Prospect, Reason, Due back (optional), Who is borrowing it, Existing, New, Related sale (optional, for an RMA), Handover, How it gets to them, What goes with it, Date out, Note (optional), Items returned, Condition, Good, no damage, Damaged or something is wrong, What is wrong, Test it again before it goes back on sale, Customer keeps it, Date back, Demo and loan history, Demo units and loans, Usual loan length in days, Loan reasons, Customer can keep it, Add a reason, What goes with a loaned device, Add an item, Test again when a device comes back, loans.csv
---

## What this is for

Sometimes a device leaves your shelf without being sold. You let a prospect try a box for a week, you send a replacement while a customer's unit is away for an RMA, or you hand someone a loaner during a repair. **Demo units and loans** record who has it, what went with it, when it is due back and what condition it came back in, so a box never goes missing quietly.

A device that is out shows the status **On demo** in [Inventory](#/docs/inventory). It cannot be sold to someone else, it does not count as available, and it cannot be deleted or archived until it is back.

### Who can do what

- **Administrator** and **Standard**: lend out, take back, and sell to the borrower.
- **View**: can look at a loan and its history, but not change anything.

## Lending a device out

1. Open the device in [Inventory](#/docs/inventory) and press **Lend out**. The button shows for a device that is Available or Returned.
2. Choose the **Reason**: for example **Demo or trial**, **RMA replacement**, **Loaner during a repair** or **Other**. You can change this list in [Settings](#/docs/settings).
3. Optionally set **Due back**. If you set a usual loan length in Settings, the date is filled in for you.
4. Choose **Who is borrowing it**. Pick **Existing** and search by name, phone or email, or pick **New** and type a name (the phone and email are optional). A new person is saved in [Customers](#/docs/customers) with a **Prospect** chip, which goes away once they buy something.
5. When you pick an existing customer who has bought before, an optional **Related sale** list lets you link an RMA to the original sale.
6. Under **Handover**, choose **Pickup**, **Meet** or **Shipping**. Shipping asks for the address, carrier and tracking number just as a sale does, and offers to print a shipping label afterwards.
7. Under **What goes with it**, tick what you are handing over. Everything is ticked to start with. The list is yours to edit in Settings.
8. Add a note if you like, check the **Date out**, and press **Lend out**.

![The Lend out form with the reason, borrower, handover and the items that go with the device](shot:reseller-demo-units-1 "Lending a device out.")

The loan keeps its own copy of the borrower's name, phone, email and address as they were that day, so changing the customer later does not rewrite the past.

## Seeing what is out

- **Home** has an **On demo** card listing each device that is out, who has it, for how many days and when it is due. A late one shows an **Overdue** chip. Click a row to open the device. The card is hidden when nothing is out.
- **Inventory** has an **On demo** choice in its status filter.
- The device lists its **Demo and loan history**, newest first.
- The customer's page lists **Demo units and loans** under their purchases.

## Taking it back

Open the device and press **Return from demo**.

1. Check the **Date back**.
2. For a reason where the customer may keep the device (see below) you can choose **Customer keeps it** instead of **Returned**.
3. Under **Items returned**, untick anything that did not come back. It is written on the loan.
4. Under **Condition**, choose **Good, no damage** or **Damaged or something is wrong**. If it is damaged, say what is wrong. The device is then marked **Damaged**.
5. Leave **Test it again before it goes back on sale** ticked to clear the test steps chosen in Settings. The device shows **Awaiting test** until they are done again, and the device form opens so you can tick them and record the firmware or upgrade details.
6. Press **Save**.

![The Return from demo form with the items checklist, the condition and the re-test choice](shot:reseller-demo-units-2 "Taking a device back.")

A good device goes back to **Available**. If the customer keeps it, the loan is closed as **Kept** and the device is archived. In both cases the loan stays in the device's history.

## Selling a demo unit to the borrower

Open the device while it is out and press **Sell to borrower**. Quick sale opens with the device in the cart and the borrower already chosen. Finish the sale as usual. The loan closes as **Sold** and is linked to the receipt.

## Settings for loans

Administrators find **Demo units and loans** in [Settings](#/docs/settings).

![The Demo units and loans card in Settings with the loan reasons, the items that go with a device and the test steps repeated on return](shot:reseller-demo-units-3 "Settings, Demo units and loans.")

- **Usual loan length in days**: fills in the due date. Leave it empty for no due date.
- **Loan reasons**: edit the wording, tick **Customer can keep it** for the reasons where it is allowed (for example a demo or an RMA, not a repair loaner), press **Add a reason**, or remove one. At least one is needed.
- **What goes with a loaned device**: the list of items ticked on the Lend out form. It starts with Device, Remote, Batteries, Power Adapter and HDMI Cable. **Add an item** or remove the ones you do not use.
- **Test again when a device comes back**: the test steps that are cleared on a good return.

## Your data

Loans are saved inside the device record, encrypted in your browser like everything else, and are included in your backups. **Export everything** on the Security page adds a `loans.csv` file with one row per loan, and one customer's export includes only their loans. The Activity log records only the kind of event, such as "lent a device out" or "took a loaned device back", never the borrower. Erasing a customer removes their name, phone, email, address and notes from their loans while the device history stays.

## Common mistakes

- Forgetting to press **Return from demo** when the box comes back. It stays **On demo** and out of your available stock.
- Lending a device with an unfinished test record. The loan form does not stop you, but the test record is copied into the loan so you can see its state when it went out.
- Expecting a prospect to have a sale. A prospect is just a customer who has not bought yet.
