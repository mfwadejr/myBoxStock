---
title: Accessibility
summary: How to use the Host Console with a keyboard, a screen reader, large text or reduced motion, which keys work where, and how to report a problem you find.
keywords: accessibility, accessible, keyboard, keyboard shortcuts, shortcuts, screen reader, VoiceOver, NVDA, focus, focus ring, tab key, escape key, contrast, large text, zoom, reduced motion, colour blind, touch target, report a problem
order: 25
covers: Accessibility, Keyboard shortcuts, Focus ring, Screen reader, Reduced motion, Report an accessibility problem, Escape closes
---

## What this page is for

The Host Console is built to be used with a mouse, a finger, only a keyboard, a screen reader, larger text or the reduce-motion setting turned on, on a phone or a computer. This page says what to expect and how to report a problem. The resellers' app follows the same rules, and its own Accessibility page is in their documentation.

## Using only the keyboard

Every button, link, switch, check box, tab and field can be reached with **Tab** (and **Shift + Tab** to go back). The control you are on shows a clear blue outline, the **focus ring**, the same everywhere.

- **Enter** or **Space** presses the control you are on, including switches, check boxes and the filter buttons at the top of [Support](#/docs/support-tickets) and [Accounts](#/docs/accounts).
- **Escape** closes the window (sheet), the account menu or an open dropdown that is on top, and focus goes back to the button that opened it. A window keeps **Tab** inside it until it is closed.
- In a dropdown, **Enter**, **Space** or the **Down arrow** opens the list; the arrow keys, **Home** and **End** move through it; typing a letter jumps to a choice; **Enter** picks it.
- In the account menu, the arrow keys move between items.
- A row in a table that opens something (a ticket, an account) can be reached with **Tab** and opened with **Enter** or **Space**.
- In the screenshot viewer in a ticket, **Left** and **Right** arrows move between pictures and **Escape** closes it.
- The Support list refreshes by itself. A refresh never moves your cursor away from the row you are on, and new tickets wait behind a short "new tickets, show" bar instead of shifting the list.

## Screen readers

Every control has a spoken name. Fields are tied to their labels, icon-only buttons have a name, switches are named after the setting, and segmented buttons, tabs and filters say whether they are selected or pressed. The page you are on in the menu is marked as current.

Changes are announced politely without moving your place: a toast ("Saved") is read out, and an error is read out right away. When the **Support** count in the menu goes up, or an alert count changes, it is announced once. A background job such as a backup or a Demo mode build says each step and each quarter of the way, not every second, and the progress bar has a name.

## Colour, size and motion

- Text, chips, banners and buttons meet the WCAG 2.1 AA contrast level. The colour tokens are checked by an automated test in every release, so a colour that is too faint cannot slip in.
- Status never relies on colour alone: red, amber and green chips carry a word, such as **Overdue** or **Suspended**.
- On phones and tablets all controls are at least 44 pixels high, and fields are large enough that the phone does not zoom by itself.
- Zooming the page or enlarging text reflows the layout without sideways scrolling.
- With **Reduce motion** set on the device, all slide, fade and progress animations are switched off.

## What is checked in every release

Accessibility is not a one-time job. Every release runs an automated test that opens the main Host and reseller screens in a real browser, at the width of a phone and of a laptop, and fails the build if any of these slip:

- a button, field, switch, check box or icon-only control has no spoken name;
- a screen asks for a tab order other than the natural one (a positive tab index);
- the focus ring cannot be seen on a control reached with **Tab**;
- **Escape** does not close a window, or focus does not return to the button that opened it;
- the page scrolls sideways;
- any text colour, chip, banner or button falls below the contrast level.

The colours live in one place, the design tokens, so fixing a faint colour there fixes it everywhere. When you add a page or a setting, give every control a visible label or a name, and the test will confirm it.

## Report an accessibility problem

Staff and resellers can report problems through Support. For a problem you find in the Host Console yourself, note the page, what you were trying to do, what happened and what assistive technology you use, and send it to the person who maintains the site. For a problem a reseller reports, it arrives as a ticket in [Support tickets](#/docs/support-tickets); give it the category **Problem**, assign it, and answer as you would any ticket.

> A good report names the page, the control and what a screen reader said (or failed to say). The same automated test that guards the colours and names can be extended to catch it for good.
