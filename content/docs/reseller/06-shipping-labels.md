---
title: Shipping labels
summary: Print an address label for a parcel in three sizes, in a themed or plain black-and-white style, with your logo and return address, one at a time or a whole To ship list at once.
keywords: shipping label, label, print label, print labels, address label, return address, 4x6, 4 x 6, thermal, thermal printer, label printer, half sheet, letter, plain, themed, logo, label logo, delivery note, order number, tracking, carrier, pdf, batch, postage
order: 6
covers: Print label, Print labels, Shipping label, Shipping labels, Size, Style, Logo, Change the return address for this print, Hide return address, 4 x 6 in (thermal printer), Half sheet of letter, Full letter page, Themed (site look), Plain (black and white), Use my business logo, Use a different logo for labels, No logo, Return address on labels, Default label size, Label style, Label logo, Choose logo, Remove logo, Order, Date, Carrier, Tracking, Delivery note, Delivery and labels
---

## What shipping labels are for

A shipping label here is an **address label**: the sticker or sheet you attach to a parcel so that it reaches the right person and so that you can match it to the sale. It shows who the parcel is for, where it came from, which order it is and, when you have them, the carrier and tracking number.

It is not a postage label. myBoxStock does not buy postage, show carrier prices or talk to any shipping service. You pay for postage the way you already do, and type the tracking number onto the sale. Nothing is sent anywhere to make a label: it is built in your browser from the sale you already have open, and you print it from your browser, or save it as a PDF.

There is deliberately **no barcode and no QR code** on the label. The order number is printed in plain text instead.

Labels are for sales whose delivery is **Shipping**. See [Delivery and shipping](#/docs/delivery-and-shipping). Administrators and Standard users can print labels, and View users can too, because a label only shows what is already on the sale. Only Administrators change the label settings.

## What is on a label

- Your **logo**, if you chose one, at the top left.
- Your **return address** at the top right.
- **Ship to**, in large type: the name and address from the sale.
- A **Delivery note**, under that heading, only if you wrote one on the sale (for example "Fragile, leave at the door").
- Along the bottom: the **Order** number (the receipt number, always printed), the **Date** of the sale, and the **Carrier** and **Tracking** number, each only when you have entered it. When they are empty they are left out entirely, with no blank boxes, so a label printed before you have a tracking number looks tidy. Add the tracking later and print the label again to include it.

A label never shows your own shipping cost, what the devices cost you, or your profit.

## Printing one label

1. Open the sale from [Sales](#/docs/sales) (or from the **To ship** list).
2. In its **Delivery** section press **Print label**. On the To ship list there is also a **Print label** button on every row.
3. The label opens as a preview. Check the address.
4. Press **Print**. Your browser's print window opens with only the label on the page. Choose your printer, or choose **Save as PDF**.
5. Press **Done** to close the preview.

![The shipping label preview with Size, Style and Logo choices above a label showing the return address, ship-to address and delivery note](shot:reseller-shipping-labels-1 "The label preview. Changes here apply to this print only.")

The **Print label** button appears only on Shipping sales. Immediate, Pickup and Meet sales do not have one.

## Choices on the label view

Above the preview are choices that apply to this print only. They do not change your saved settings.

- **Size**: **4 x 6 in (thermal printer)**, **Half sheet of letter** or **Full letter page**.
- **Style**: **Themed (site look)** uses the app's colours; **Plain (black and white)** is pure black on white with a high-contrast logo, best for thermal label printers.
- **Logo**: **Use my business logo**, **Use a different logo for labels**, or **No logo**.
- **Change the return address for this print**: opens boxes to type a different return address, for example when you ship from a friend's address. The preview updates as you type. **Hide return address** puts the boxes away.

If you choose a logo that does not exist, for example the label logo when you never chose one, the label simply prints without a logo. It is never an error.

## Printing sizes

Each size sets the page size when you print, so the label fills the page the right way up:

- **4 x 6 in** is a portrait page of 4 inches by 6 inches, the standard thermal label.
- **Half sheet of letter** is 8.5 inches wide and 5.5 inches tall, half of a letter page.
- **Full letter page** is 8.5 by 11 inches.

In the print window, set margins to **None** or **Default** and turn **Headers and footers** off if your browser offers it. If your printer has its own paper-size setting, choose the same size.

## Printing several labels at once

1. Open [Sales](#/docs/sales) and choose **To ship** in the **All deliveries** drop-down.
2. Press **Print labels**; the button shows how many (for example "Print labels (3)").
3. The preview shows one label per sale. Press **Print**: each label is on its own page.

Sales that are not Shipping sales, or that have been voided, are never included.

## Setting up your labels

An Administrator sets the defaults in [Settings](#/docs/settings), in the **Delivery and labels** card:

![The Delivery and labels card in Settings with return address, default size, style and logo choices](shot:reseller-shipping-labels-2 "Settings, Delivery and labels: return address, default size, style and logo.")

- **Return address on labels**: name, street, apartment or suite, city, state, ZIP and country. A label printed without a return address simply leaves that corner empty.
- **Default label size** and **Label style**.
- **Label logo**: **Use my business logo** (the default) re-uses the logo from the Customer emails card; **Use a different logo for labels** shows **Choose logo** and **Remove logo** so you can pick a picture just for labels; **No logo** prints none. A picture can be PNG, JPEG, WebP or GIF; it is made small automatically in your browser.

Press **Save changes** at the top of Settings to keep them. The settings, and the label logo, are saved encrypted with the rest of your account data and are included in backups and restores.

## Privacy

Labels are built in your browser from data that is already decrypted there. Nothing is sent to the site or to any outside service to make or print one. The activity log notes only that a label was opened, never the address.

## Common mistakes and tips

- **A blank page before the label (DYMO and other label printers).** Fixed in 0.25.1: the label now prints on exactly one page. In the print window use the printer's 4 x 6 in (or 4XL) paper size, set Margins to **None** and Scale to **Default**. If your printer driver's paper is slightly bigger than 4 x 6 in (for example 104 x 159 mm), the label still prints on one page, with a thin blank strip at the bottom.
- **Printing on the wrong paper size.** Pick the same size in the label view and in the print window.
- **Blurry or grey logo on a thermal printer.** Choose **Plain** style, which prints the logo in black and white.
- **No return address.** Add it once in Settings so every label has it.
- **Tracking missing from the label.** Add it with **Edit tracking** on the sale and print the label again.
- **Looking for a barcode.** There is none by design. The order number is on the label in plain text.

See also [Delivery and shipping](#/docs/delivery-and-shipping), [Sales](#/docs/sales) and [Settings](#/docs/settings).
