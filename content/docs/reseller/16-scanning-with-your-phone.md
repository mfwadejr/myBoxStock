---
title: Scanning with your phone camera
summary: Use your phone or tablet camera to read the barcode on a box into Serial, MAC, UID, Bulk scan, Quick sale and the Inventory search, step by step, with tips for good scans.
keywords: scan, scanner, camera, barcode, qr code, serial, mac, uid, phone camera, take a photo, type it instead, flash, torch, small, medium, large, scan box, aim line, scan next field, bulk scan camera, search by camera, camera blocked, https, glare, light, focus, label, several barcodes, wrong barcode
order: 16
covers: Scan with the camera, camera button, Scan Serial number, Fit the whole code in the box, Small, Medium, Large, Flash, Type it instead, Take a photo, Try again, Got it, Scan next field, Scan again, Done, Two codes are about equally close, aim line, scan box, Scanned, Bulk scan with the camera, search by camera, camera is turned off for this site, No camera was found, The camera is busy, The camera could not start, The camera only works when this site is opened over https, No code was found in that photo, No MAC address was found in that photo, That photo could not be read, scanning tips, several barcodes on a label
---

## What this is

You do not need a barcode scanner to enter devices. Your phone or tablet already has a camera, and myBoxStock can read the barcode or QR code on a box or label with it. The code is turned into text and put in the box you are filling in, so you do not have to type long serial numbers or MAC addresses.

If you already have a hardware scanner that types into the page like a keyboard, it keeps working exactly as before. The camera is an extra way, not a replacement.

> Your pictures stay on your phone. The camera frames are read on the phone itself, and they are never sent anywhere, saved or logged. The only thing that is kept is the text you scan, in the field, like anything else you type.

## Before you start

- The camera only works when the site is opened over **https**, a secure web address that starts with `https://`. Your normal myBoxStock address already does.
- The first time, your browser asks "Allow camera?". Choose **Allow**. If you said no by mistake, see "If the camera does not start" below.
- Use a phone or tablet with a back camera. Laptops with a webcam work too, but a phone is much easier to aim.

## Where the camera button is

A small **camera button** sits inside the right end of these boxes:

- **Serial number**, **MAC address** and **UID** in **Add device** and when you open a device to edit it. Any other text detail that your Administrator ticked **Look up in sale** or **Must be unique** in [Settings](#/docs/settings) gets one too.
- The scan box in **Bulk scan** in [Inventory](#/docs/inventory).
- The scan box in [Quick sale](#/docs/quick-sale).
- The **Search** box at the top of Inventory.

## Scanning one code into a field

1. Open **Add device** (or open a device to edit it) and tap the **camera button** in the Serial number box.
2. The scanner opens full screen. Allow the camera if asked. The title says what it wants, for example "Scan Serial number", and the hint says "Fit the whole code in the box".
3. Point the back camera at the label. The screen is dark except a bright **scan box** with corner brackets. A thin **aim line** runs across its middle.
4. Move the phone until the whole barcode is inside the box and the aim line crosses it. Hold steady for a moment.
5. When the code is read, the aim line turns green, the screen says **Got it** with the value, the phone beeps (and buzzes if it can), and the value drops into the field. You also see a small message such as "Scanned 1234567890".
6. The scanner closes by itself. Check the number in the field and fix it if needed, then carry on filling in the form.

Only the part of the picture inside the scan box is read. Anything outside the box is ignored.

### Scanning the next field

Serial number and MAC address are usually on the same label. After you scan Serial number, if the next scannable box in the form is still empty, the screen stays and offers three buttons:

- **Scan MAC address** (the name of the next field) reads the next code at once.
- **Scan again** throws away what you just read and tries the same field again.
- **Done** closes the scanner.

So a serial number and a MAC address are two quick scans without leaving the camera.

### What the scanner can read

It reads the common barcodes on boxes and parcels (Code 128, Code 39, EAN and UPC, ITF, Codabar) and also QR codes and DataMatrix codes. A code counts only after the camera has seen the same value twice in a row (three times for the older Code 39, ITF and Codabar kinds), so a blurry half-read does not get through.

### MAC addresses

When you scan into a **MAC address** box, only a real MAC address is accepted. It must have 12 digits or letters A to F, plain or written with colons, dashes or dots. The app writes it for you in the tidy form `AA:BB:CC:DD:EE:FF`. Any other barcode in view, such as a serial number, is ignored in a MAC scan, so it cannot end up in the wrong box.

### Serial numbers and other text

Into a Serial number or other text box, the app takes whatever was scanned, with spaces trimmed off the ends. As always, a label such as "SN:" or "UID" that a scanner sends in front of the number is cleaned off when you leave the box.

## The scanner buttons

- **Close** (top right) leaves the scanner without changing the field. The Escape key does the same on a computer.
- **Small, Medium, Large** change the size of the scan box. **Medium** is the normal size. **Small** is a wide, thin strip, for picking one barcode out of a crowded label. **Large** is good for QR codes. The size you pick is remembered on that device.
- **Flash** turns the phone's torch on and off, for dark rooms. It appears only if your phone allows it. It does not appear on iPhone Safari.
- **Type it instead** closes the scanner and puts the cursor in the field so you can type the code.
- **Take a photo** opens the phone's own camera app. Take a picture of the label, and myBoxStock reads the code from the photo. Use it if the live view will not focus. If there is one code in the photo, it is used. If there are several, you tap the one you want. If none is found you see "No code was found in that photo. Move closer so the whole code fills the picture, and try again." (for a MAC scan: "No MAC address was found in that photo..."). If the picture cannot be read: "That photo could not be read. Try again."
- **Try again** appears after a camera problem, once you have fixed it.

## Labels with several barcodes

Many labels carry a UID, a serial number and a MAC address, each as its own barcode. The scanner reads the one **nearest the aim line**, the middle of the box. So:

1. Make the box **Small** so it shows only a strip of the label.
2. Slide the phone until the barcode you want sits on the aim line.
3. Check the value you got in the field. If it is the wrong one, tap the camera button again, or **Scan again** if the scanner is still open, and aim a little higher or lower.

If two barcodes are about the same distance from the aim line, the scanner does not guess. It shows both as big buttons with the message "Two codes are about equally close. Tap the one you want." Tap the right one, or tap **Scan again** and aim better.

## Tips for good scans

- **Light.** Good, even light helps most. In a dim room use **Flash** if you have it, or move under a lamp.
- **Distance.** Hold the phone about a hand span (15 to 25 cm) from the label. Too close and it cannot focus. Too far and the bars are too small. Move slowly nearer or farther until the aim line turns green.
- **Hold steady.** Rest your hand on the table. Do not chase the code, let it settle for a second.
- **Glare.** Shiny labels and plastic bags reflect light. Tilt the phone a little so the reflection moves off the bars, or take the label out of its bag.
- **Whole code in the box.** Include the empty margin on each side of a barcode. If the code is longer than the box, choose **Large**.
- **Flat and clean.** A creased or dirty label reads poorly. Smooth it out and wipe it.
- **Keep the phone upright to the bars.** Any angle works for a QR code, but a barcode reads best when the aim line crosses the bars from side to side.
- **Still not working?** Tap **Take a photo** or **Type it instead**.

## Bulk scan with the camera

[Bulk scan](#/docs/inventory) is for entering many boxes from one delivery.

1. Open **Bulk scan** in Inventory, set what is the same for every device, and tick what is on the labels (for example Serial number and MAC address).
2. Tap the **camera button** in the scan box.
3. The scanner **stays open**. Scan the first code. It says **Got it**, adds it, and after a moment is ready for the next one. The title tells you which identifier it wants next, such as "Scan MAC address".
4. Scan the next label. The scanner ignores the same code until it sees a different one, so holding the phone still on one label does not add it twice.
5. If a code is refused, the scanner stays open and tells you why, for example "1234567890 was already scanned in this batch." or "Another device already has that Serial number." Move on to the next label.
6. When you are finished, tap **Close**, then press **Save N devices** as usual.

A hardware scanner and the camera can be used in the same batch.

## Quick sale with the camera

In [Quick sale](#/docs/quick-sale), tap the camera button in the scan box and scan a serial. The device goes into the sale and the scanner closes. If nothing in your inventory matches, the scanner stays open and shows: Nothing in your inventory matches "the code". Scan another label, or tap **Type it instead**.

## Search Inventory by camera

In [Inventory](#/docs/inventory), tap the camera button in the **Search** box (the scanner is titled "Scan a code to search for"). The code fills the box, and the list narrows to the device that has it. It is a quick way to find a box on the shelf. Clear the box to see everything again.

## If the camera does not start

The scanner tells you in plain words. Fix the cause, then tap **Try again**.

- **"The camera is turned off for this site."** You said no to the permission. Allow the camera when your browser asks, and tap Try again. On an iPhone, open **Settings**, **Safari**, **Camera** and choose **Ask** or **Allow**. On Android, tap the padlock next to the web address and look for the camera permission (the exact words vary by phone).
- **"No camera was found on this device."** The device has no usable camera. Type the code, or take a photo on another device.
- **"The camera is busy."** Another app or browser tab is using it. Close that one and tap Try again.
- **"The camera could not start."** Tap Try again. If it keeps happening, close the browser completely and open it again, or use **Take a photo** or **Type it instead**.
- **"The camera only works when this site is opened over https..."** You opened the site through an address that does not start with `https://`. Open it with the secure address. Your site administrator can tell you the right one.
- **"This browser cannot use the camera here."** An old or restricted browser. Update it, or use another browser such as Safari on iPhone or Chrome on Android. Meanwhile use **Take a photo** or **Type it instead**.
- **"The scanner could not be loaded."** The scanner part did not download. Check your connection and try again.

More fixes are in [Troubleshooting and FAQ](#/docs/troubleshooting-faq).

## Good to know

- The screen stays awake while the scanner is open, so it does not go dark in the middle of a delivery. It is released when you close the scanner, and the camera light goes off.
- A buzz on scan works only on phones that can vibrate, mostly Android. The beep depends on your phone's sound settings.
- The camera never changes a field without telling you. Always glance at the value before you save.

Related pages: [Inventory](#/docs/inventory), [Quick sale](#/docs/quick-sale), [Settings](#/docs/settings) and [Glossary](#/docs/glossary).
