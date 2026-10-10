---
title: Customers
summary: Keep a list of the people you sell to, see what each one has bought, export or erase their details, and find anyone in seconds.
keywords: address, saved address, ship to, shipping address, customers, paging, per page, next, previous, customer list, buyers, contacts, phone, email, notes, purchase history, search, find customer, receipt number, tracking number, sort, sorting, filter chips, clear search, shipments, refunds, export customer, erase customer, delete customer, privacy, data request, GDPR
order: 7
covers: nav:customers, 25 / 50 / 100 per page, Previous, Next, Showing 1–25, Add customer, Search name, phone, email, address, receipt, tracking, Clear search, Clear search and filters, results, Has an address, Bought in the last 30 days, No purchases yet, Name (A to Z), Last purchase (newest first), Total spent (high to low), Number of purchases (most first), Recently added (newest first), Added, Purchases and shipments, Print label, Receipt, Name, Phone, Email, Notes, Purchases, Spent, Last purchase, Save, Cancel, Close, Delete, Erase, Export, customer.csv, purchases.csv, purchase_items.csv, Erased customer, customers.read, customers.write, Address, Street, Apartment or suite, City, State, ZIP, Country, Clear address, apartment_or_suite
---

## What the Customers page is for

The **Customers** page is your address book for the people who buy from you. Each customer has a name, a phone number, an email address and a free-text note, and the app works out for itself how many times they have bought, how much they have spent, and when they last bought.

Why bother keeping customers? A few real-life examples:

- A customer calls and says the box you sold them last month has stopped working. You type their name or phone number into the search box, open their record, and see every purchase, the receipt number, and whether they are still in warranty. You do not have to dig through paper receipts.
- You want to email a receipt again. Because the customer's email address is saved, it is already filled in for you when you send it from [Sales](#/docs/sales).
- A regular comes in and you want to know how much they have spent with you over the year, or you want to remember that "prefers to be called after 5 pm".

Like everything else in myBoxStock, your customer list is encrypted in your browser with your own key. Only people who sign in to your account can read it. Your site administrator cannot. See [Your data, your responsibility](#/docs/your-data-your-responsibility) for what that means for you.

> The page header shows how many customers you have and reminds you that only your team can read this list.

> Emails and alerts only work after the Email section is set up, using either direct sending or an SMTP gateway. The person who runs your site sets this up, so if a message you expect never arrives, ask them to check it.

## Who can see and change customers

What you can do depends on your user type (your role). The three types are explained in full on the [Team](#/docs/team) page.

- **Administrator** and **Standard** users can see customers and also add, change, delete and erase them.
- **View** users can see the list and open a customer, but everything is read-only. They get a **Close** button instead of **Cancel** and **Save**, the fields are greyed out, and the **Add customer**, **Delete** and **Erase** buttons are not shown.
- If your user type does not include customers at all, the **Customers** menu item is hidden, and if you reach the page anyway it says "Your user type does not include customers."

Anyone who can see a customer can also use **Export** on that customer (see below).

## Finding your way around the list

Open **Customers** from the menu. You will see a table with these columns:

![The Customers list with a search box, sort control, quick filters and a table](shot:reseller-customers-1 "The Customers list.")

![The search box holding a receipt number, with a clear button and a results count](shot:reseller-customers-2 "Searching by receipt number. The x clears the search.")

- **Name** - the customer's name. The list starts sorted alphabetically by name.
- **Phone** - their phone number, or a dash if you did not enter one.
- **Email** - their email address, or a dash.
- **Purchases** - how many sales they have. Voided sales are not counted.
- **Spent** - the total of those sales after any refunds, including any shipping you charged.
- **Last purchase** - the date of their most recent sale, or a dash if they have never bought.
- **Added** - the date the customer was added to your list.

Click anywhere on a row to open that customer. On a phone each customer is a small card with the same facts, each with its label.

### Sorting

On a laptop or tablet, click a column title (**Name**, **Purchases**, **Spent**, **Last purchase** or **Added**) to sort by it. Click it again to reverse the order; a small arrow shows which way it runs. On a phone the column titles are hidden, so a sort list sits under the search box instead, with the same choices in plain words: **Name (A to Z)**, **Last purchase (newest first)**, **Total spent (high to low)**, **Number of purchases (most first)** and **Recently added (newest first)**, each in both directions. Customers who have never bought stay at the end when you sort by last purchase. Your choice is remembered while the app stays open, and changing it takes you back to page 1.

### Pages

The list shows **25 rows per page**. Under it a line says, for example, "Showing 1–25 of 60", with a **25 / 50 / 100 per page** list and **Previous** and **Next** buttons. Choose 50 or 100 to see more at once. These controls hide when everything fits on one page of 25 or fewer. Changing the search or a filter always takes you back to page 1. Every customer is in the list; none are cut off.

### The search box

Above the table is a search box labelled **Search name, phone, email, address, receipt, tracking**. Type a few letters and the list narrows as you type. The search looks in the name, the phone number, the email address, the notes and the saved address. It also looks inside each customer's sales, so a **receipt number**, a **tracking number**, the carrier, the address a parcel was sent to, and a credit note number all find the customer who owns them. It ignores capital letters. For example, typing `smith` finds "Dana Smith", typing `S-20261004-7K2Q` finds whoever bought on that receipt, and typing part of a tracking number finds the customer you shipped it to. Your own costs and profit are never searched.

- Press `/` (or Ctrl+K, or Cmd+K on a Mac) anywhere on the page to jump to the search box.
- Press **Clear search** (the small x at the right end of the box) or the Escape key to empty it.
- A line under the box says how many customers match, for example "3 results", or the total when nothing is being searched.

If nothing matches you will see "No customers match." If you have not added anyone yet you will see "No customers yet. They are added here or during a quick sale."

### Quick filters

Under the search box are buttons that narrow the list further. They work together with the search and with each other:

- **Has an address** - customers with a saved address.
- **Bought in the last 30 days** - customers whose last purchase was within the past month.
- **No purchases yet** - customers who have never bought (handy for following up). This and the 30-day button cancel each other, since a customer cannot be both.

Press a button again to turn it off, or press **Clear search and filters** to start over.

> Tip: you do not need to type the whole phone number. Part of it is enough, and the search checks the notes too, so a note like "friend of Marcus" makes that customer easy to find later.

## Adding a customer

There are two ways a customer gets onto your list.

### Way 1: from the Customers page

1. Open **Customers** from the menu.
2. Press **Add customer**. A form opens.
3. Fill in the fields (described in the next section). Only **Name** is required.
4. Press **Save**. You will see a short "Saved" message and the new customer appears in the list.

Press **Cancel** at any time to close the form without saving anything.

### Way 2: during a Quick sale

When you are ringing up a sale on the [Quick sale](#/docs/quick-sale) page you can choose **New** under Customer, type the name, phone and email, and finish the sale. The customer is created at the same moment as the sale. This is the fastest way to build your list because you never have to enter anyone twice. Note that this needs permission to add customers; if your user type cannot, the app tells you "Your user type cannot add customers."

Why add customers up front? Say a friend tells you they will be buying three boxes on Saturday. Adding them now means that on Saturday you simply pick them from the list under **Existing** at Quick sale, rather than typing their details while they wait.

## The customer form, field by field

The same form is used for adding and for editing.

- **Name** - required. If you press Save with this blank you are told "Enter a name." Use whatever you will remember, such as a full name or "Dana S. (cafe)". The name is copied onto each receipt at the moment of sale.
- **Phone** - optional free text. You can type it however you like; the app does not reformat it.
- **Email** - optional. If you fill this in, it is offered automatically when you email a receipt to this customer. Use a valid address so receipts reach them.
- **Notes** - optional, free text with room for several lines. Good uses: delivery preferences, which box models they like, a reminder to follow up, how they found you. Do not put anything in notes that you would not want to show to a customer who asks for a copy of their data (see Export below).

### The Address section

Below Notes the form has an **Address** section: **Street**, **Apartment or suite**, **City**, **State** and **ZIP** (plus **Country** when an Administrator has switched on **Ask for a country on addresses** in [Settings](#/docs/settings)). It is optional. A saved address fills in **Ship to** the next time you choose Shipping in Quick sale for this customer, so repeat customers are never retyped. Press **Clear address** to empty it, then **Save**. Quick sale can also save an address to a new customer for you, with its **Save this address to the customer** switch. See [Delivery and shipping](#/docs/delivery-and-shipping).

### Editing an existing customer

1. Click the customer's row.
2. Change any of the fields, including the address.
3. Press **Save**. The list refreshes with the new details.

> Changing a customer's name later does not rewrite old receipts. Each sale keeps the name the customer had at the time. That is deliberate, so your records stay as they were. The only way to remove a name from past receipts is Erase, which is meant for people who have asked for their details to be removed (see below).

## Purchases and shipments

When you open an existing customer, the top of the form says in one line how much they have spent, across how many purchases, and when they last bought. Below the fields and the address is the **Purchases and shipments** heading: every sale for that customer in one place, newest first. Each entry shows:

![One customer opened, showing a saved address and every sale and shipment](shot:reseller-customers-3 "One customer: saved address and every sale in one place.")

- the receipt number (for example `S-20261004-7K2Q`), marked **Void** if the sale was voided,
- the amount the customer paid, shipping included,
- the date and how many items were on it, and the devices sold,
- a warranty badge saying whether the warranty is still running, has expired, or there was none,
- how it was delivered (Shipping, Pickup or Meet), whether a shipment is **To ship** or **Shipped**, and the carrier, tracking number and address a parcel went to,
- any returns: **Returned** or **Partly returned**, each refund with its credit note number and date, the return tracking number if one was recorded, and the net amount you kept.

Click an entry, or its **Receipt** button, to open the receipt. From the receipt you can print it, email it, process a return, or, if you have permission, void the sale or change the warranty. All of that is explained on the [Sales](#/docs/sales) page. On a shipped sale, **Print label** opens the shipping label ([Shipping labels](#/docs/shipping-labels)).

If the customer has never bought, you will see "No purchases yet."

Important details:

- Voided sales are listed (so you can find a receipt) but are left out of the **Purchases** and **Spent** numbers, because a voided sale did not really happen.
- Your own shipping cost, device costs and profit are never shown here or searched; this page shows what the customer saw.
- A new customer being created has no Purchases section yet; it only appears once the customer has been saved.

## Deleting a customer

Use **Delete** when you simply do not want someone on your list any more, for example you added a duplicate by mistake.

1. Open the customer.
2. Press **Delete** (only Administrator and Standard users see this button).
3. A confirmation box asks "Delete this customer?" and explains that their past sales stay in your history under their name.
4. Press **Delete** again to confirm, or cancel.

What happens next: the customer record is removed from your list. Their old sales are not touched. The receipts still show their name, and the sales still appear on the [Sales](#/docs/sales) page. This is a good choice when the person is not asking you to remove their information, you just want a tidier list.

Common mistake: deleting a customer and expecting their name to disappear from old receipts. It will not. If they have asked for their personal details to be removed, use **Erase** instead.

## Erasing a customer for privacy requests

Sometimes a customer asks you to remove their personal information. The **Erase** button is for that.

1. Open the customer.
2. If they also asked for a copy of what you hold, press **Export** first (see below).
3. Press **Erase**.
4. A confirmation box explains what will happen: their name, phone, email, address and notes are removed, both from the customer record and from their past sales (including where a parcel was sent). The sales themselves stay (totals and receipt numbers), and show the name "Erased customer". This cannot be undone.
5. To confirm, type the word `ERASE` in the box, then confirm.

After erasing, the customer is gone from the list and their sales appear as "Erased customer" with no email attached, so you can no longer email a receipt to them from those sales. Your books still add up, because the amounts and receipt numbers remain.

The app also leaves a small note in your account's activity log that a customer was erased and how many sales were kept. It records only the count, never the person's details.

> Delete versus Erase in one line: **Delete** removes the customer from the list and leaves their name on old sales. **Erase** removes the customer and wipes their personal details from old sales too.

You are responsible for deciding when a request must be honoured and for acting on it. The app gives you the tools; the decisions are yours. See [Your data, your responsibility](#/docs/your-data-your-responsibility).

## Exporting one customer's data

The **Export** button in a customer's form builds a small zip file in your browser and downloads it. It is useful when a customer asks "what do you have on me?" or when you want to keep a record before erasing.

1. Open the customer.
2. Press **Export**.
3. Your browser downloads a file named like `customer-dana-smith-20261004.zip` and you see "Exported" with their name.

The zip contains three spreadsheet files you can open in Excel, Numbers or Google Sheets:

- `customer.csv` - their name, phone, email, notes, the date they were added and their saved address.
- `purchases.csv` - one row per sale, with receipt number, date, devices, payment method, warranty, total, cost, profit and whether it was voided.
- `purchase_items.csv` - one row per device on each sale, with the device, the price and the details recorded.

The file is built inside your browser. It does not pass through the server, and your site administrator never sees it. Once it is on your computer it is yours to look after, so send it to the customer through a safe route and delete your copy when you no longer need it.

> Note that `purchases.csv` includes your cost and profit columns. If you are handing the file to the customer, open it first and remove anything you do not want to share.

To export everything about your whole business, not just one customer, see the Security page described in [Your data, your responsibility](#/docs/your-data-your-responsibility).

## Button and field reference

- **Add customer** - opens an empty form (Administrator and Standard).
- **Search name, phone, email, address, receipt, tracking** - filters the list as you type; `/` jumps to it and **Clear search** empties it.
- **Sort list and column titles** - Name, Last purchase, Total spent, Number of purchases, Recently added, each way round.
- **Has an address / Bought in the last 30 days / No purchases yet** - quick filters; **Clear search and filters** resets them.
- **Name / Phone / Email / Notes** - the four things you record. Only Name is required.
- **Address** - street, apartment or suite, city, state, ZIP (and country if switched on). Optional.
- **Clear address** - empties the saved address.
- **Save** - stores your changes.
- **Cancel** - closes the form without saving. View users see **Close** instead.
- **Delete** - removes the customer; old sales keep the name.
- **Erase** - removes the customer and wipes their details from old sales; asks you to type `ERASE`.
- **Export** - downloads a zip of their details and purchases.
- **Purchases and shipments** - every sale, shipment and refund for the customer; click one to open its receipt, or press **Print label** on a shipped sale.

## Common mistakes and tips

- **Duplicates.** Typing the same person twice with slightly different spellings creates two customers, and their purchases are split between them. Search before you add. If you do create a duplicate, there is no merge button, so pick one to keep and delete the other, remembering that old sales stay under the name they were sold with.
- **No email, no emailed receipt.** If a customer's email is blank you can still type an address in the email form when you send a receipt, but nothing is filled in for you.
- **Editing does not change history.** Changes to a customer's name or email apply from now on. Past receipts keep what they had.
- **Two people editing at once.** If a colleague saves the same customer a moment before you, you may see a message that someone else changed it. Reload and try again.
- **Keep notes professional.** Notes can be exported to the customer. Write them as if the customer might read them.
- **Read-only accounts.** If your trial or paid period has ended, the app is read-only and you cannot add or change customers until the account is renewed. See [Plans, trials and billing](#/docs/plans-trials-billing).

If something does not look right, the [Troubleshooting and FAQ](#/docs/troubleshooting-faq) page lists the most common questions, and the [Glossary](#/docs/glossary) explains any term you are unsure of.
