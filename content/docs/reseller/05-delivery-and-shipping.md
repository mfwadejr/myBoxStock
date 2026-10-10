---
title: Delivery and shipping
summary: Choose how each sale reaches the customer (Immediate, Shipping, Pickup or Meet), record the address, the shipping fee and tracking, and follow a parcel from To ship to Shipped.
keywords: delivery, shipping, ship, ship to, address, parcel, package, post, mail, courier, carrier, tracking, tracking number, shipping fee, postage, shipping cost, delivery note, to ship, shipped, mark shipped, pickup, collect, meet, meetup, immediate, saved address, customer address, fragile, leave at the door
order: 5
covers: Delivery, Immediate, Shipping, Pickup, Meet, Ship to, Street, Apartment or suite, City, State, ZIP, Country, Shipping fee charged to the customer, Your shipping cost (optional), Carrier (optional), Tracking number (optional), Delivery note (optional), Save this address to the customer, Date (optional), Notes (where, when, who), Pickup note (optional), All deliveries, To ship, Shipped, Mark shipped, Date shipped, Carrier and tracking, Edit tracking, Copy, Shipping charged, Your shipping cost, Ask for a country on addresses, Show the pickup or meet note on the receipt, Show the delivery note on the receipt, delivery_status, shipping_fee, shipping_cost
---

## What delivery is for

Most sales at the counter are over in a moment: the customer hands over money and walks off with the box. Some are not. You may post a box to a buyer, hand it over at your door on Saturday, or meet someone in a car park. The **Delivery** choice on Quick sale lets you record which of these happened, so that the right address, fee and notes are saved with the sale and you can see at a glance what still needs to go in the post.

There are four choices:

- **Immediate** - the customer takes the device now. This is the default. It looks and behaves exactly as Quick sale always has, with nothing extra to fill in, and nothing extra is saved.
- **Shipping** - you post or courier the device. You record where it goes, what you charged for shipping, and later the carrier and tracking number.
- **Pickup** - the customer collects it from you later. You can note the date and anything useful, such as "Back door, ask for Sam".
- **Meet** - you hand it over somewhere else. You can note where and when the meet took place, and who was there.

Older sales, recorded before this feature existed, are treated as **Immediate**. Nothing in them changes.

Delivery is available to Administrators and Standard users, the people who can record sales. View users can see the delivery details on a sale but cannot change them. See [Team](#/docs/team).

## Choosing a delivery on Quick sale

1. Add the devices and choose the customer as usual (see [Quick sale](#/docs/quick-sale)).
2. In the card with the date, warranty and payment, open the **Delivery** drop-down and choose **Shipping**, **Pickup** or **Meet**. Leave it on **Immediate** for an ordinary sale.
3. The extra fields for your choice appear in a tinted box. Nothing else on the screen moves.
4. Complete the sale as normal.

Changing the choice back to **Immediate** hides the extra fields. Anything you typed is forgotten when the sale is completed as Immediate.

## Shipping

When you choose **Shipping** a box titled **Ship to** opens with these fields:

- **Name** - who the parcel is for. If you leave it empty, the customer's name is used.
- **Street**, **Apartment or suite**, **City**, **State** and **ZIP** - the address. Street and city are required; the rest are optional so that addresses from other places still fit.
- **Country** - hidden unless an Administrator switches on **Ask for a country on addresses** in [Settings](#/docs/settings). Leave it off if you only ship inside your own country.
- **Shipping fee charged to the customer** - what you charge for postage and packing. It is shown as its own **Shipping** line under the sale total, and added to what the customer pays. It is never mixed into item prices, discounts or profit.
- **Your shipping cost (optional)** - what the postage actually cost you. This is for your own profit figures. It is internal: it is never shown on a receipt, a label, an emailed receipt or anything the customer sees (see the privacy section below).
- **Carrier (optional)** and **Tracking number (optional)** - fill them in now if you already know them, or leave them empty and add them later. A label prints fine without tracking.
- **Delivery note (optional)** - a short line such as "Fragile, leave at the door". It prints on the shipping label under the heading **Delivery note**. It is not on the customer's receipt unless you switch that on in Settings.

### The saved address

If the customer already has a saved address (see [Customers](#/docs/customers)), **Ship to** is filled in for you the moment you choose Shipping. Change anything you like for this one sale; the saved address is not altered.

If the customer is new, or has no saved address yet, a switch **Save this address to the customer** appears. It is on by default, so next time the address fills in by itself. Switch it off if the address is a one-off, for example a gift sent to someone else. When a customer already has an address, no switch is shown and their saved address is never overwritten from Quick sale. To change it, edit the customer.

## Pickup and Meet

These two choices need no address. They capture notes only.

- **Pickup** shows an optional **Date (optional)** and a **Pickup note (optional)**.
- **Meet** shows an optional **Date (optional)** and a **Notes (where, when, who)** box. Use it to record the place, the time and who was there, for example "Library car park, 5pm, with Dana".

The notes are for you. They do not print on the receipt unless an Administrator switches on **Show the pickup or meet note on the receipt** in Settings. The receipt always shows the word Pickup or Meet, and the date if you entered one.

## Following a shipped sale: To ship and Shipped

Every Shipping sale starts as **To ship**. You will see a small **Shipping** tag and an amber **To ship** tag next to its receipt number on the [Sales](#/docs/sales) page.

![The Sales list filtered to To ship, with a Print label and a Mark shipped button on each row](shot:reseller-delivery-and-shipping-1 "The To ship list on Sales.")

![The Mark shipped form asking for the date shipped, carrier and tracking number](shot:reseller-delivery-and-shipping-2 "The Mark shipped form. Carrier and tracking are optional.")

1. On Sales, open the **All deliveries** drop-down and choose **To ship**. The list now shows only sales waiting to go out, with **Print label** and **Mark shipped** buttons on each row.
2. Pack the parcel and, if you have it, note the tracking number.
3. Press **Mark shipped**. A small form asks for the **Date shipped** (today by default), the **Carrier** and the **Tracking number**. All three are optional; you can add carrier and tracking later with **Edit tracking** on the sale.
4. Press **Save**. The sale is now tagged green **Shipped**, and the tracking number appears on the sale with a **Copy** button so you can paste it into a message to the customer.

You can also open the sale and use the buttons in its **Delivery** section: **Mark shipped**, **Edit tracking** and **Print label** (see [Shipping labels](#/docs/shipping-labels)).

Other choices in the same drop-down are **Shipped**, **Shipping**, **Pickup**, **Meet** and **Immediate**, which show every sale of that kind.

A voided sale is left out of To ship and Shipped, because its devices went back into stock. See [Sales](#/docs/sales).

## Your shipping cost and profit

The Sales page keeps the figures apart so nothing is hidden and nothing is muddled:

![A shipped sale showing its Delivery section with the tracking number and a Copy button](shot:reseller-delivery-and-shipping-3 "A shipped sale: tracking number with a Copy button, and your own cost marked internal.")

- **Revenue** at the top includes the shipping fee you charged (it is part of what the customer paid), less any refunds. **Profit** is that revenue minus your device costs and minus your own shipping cost, which is your **Profit after shipping**. Home, Customers, the Sales list, the CSV export and the totals all use this same figure.
- A line under the filters, shown only when shipping sales are in view, says how much shipping you charged and what it cost you.
- The sale's Delivery section shows **Shipping charged** and **Your shipping cost** (marked internal) to your team.

## Privacy: what the customer sees

The receipt, a printed receipt, an emailed receipt and anything else for the customer show the shipping address, the word Shipping and the shipping fee you charged. They never show your own shipping cost, what the devices cost you, or your profit. The same is true of the shipping label.

The address, fee, cost, carrier, tracking and notes are encrypted in your browser together with the rest of the sale, exactly like customer names and prices. The people who run the site cannot read them. They are included in your backups, restores, exports and the team list restore. When a customer is erased, their address and notes are removed from their sales too. See [Your data, your responsibility](#/docs/your-data-your-responsibility) and [Backup and restore](#/docs/backup-and-restore).

The activity log records only the kind of event, such as "marked a sale as shipped", never an address or a tracking number.

## Exporting delivery details

**Export CSV** on Sales adds these columns after the existing ones: delivery, delivery_status, ship_to, shipping_fee, shipping_cost, carrier, tracking, shipped_on, delivery_note, delivery_date and delivery_notes. The customers export gets street, apartment_or_suite, city, state, zip and country columns. These files include your own shipping cost, so think before you share them.

## Common mistakes and tips

- **Forgetting to mark a parcel shipped.** The To ship list is your to-do list. Check it at the end of the day.
- **Typing the tracking number into the Delivery note.** The note is for the label's special instructions. Use the **Tracking number** box.
- **Forgetting your own cost.** The fee you charge counts as revenue, but profit only reflects the postage if you enter **Your shipping cost (optional)** on the sale.
- **Wrong address on a saved customer.** Fix it on the customer's page, not on each sale.
- **Choosing Shipping for a pickup.** You can edit tracking later but not the delivery type, so choose carefully. If you got it wrong, void the sale and enter it again.

See also [Quick sale](#/docs/quick-sale), [Customers](#/docs/customers), [Sales](#/docs/sales), [Shipping labels](#/docs/shipping-labels) and [Settings](#/docs/settings).
