# Claude Code prompt: order and attendance workflow improvements

Open the existing Food Business Web App in Claude Code and paste the prompt below. The screenshots attached with the request show the current Orders board, New Order POS, Menu Management, and Employees pages. Use them as context for the current design and workflows.

---

You are a senior product engineer continuing the existing food business operations app. Inspect the current app and data model first, then implement the requirements below in the existing project. Preserve existing sample/demo data, current design language, existing features that are not superseded, and working persistence. Do not rebuild the app from scratch or only describe a plan. Run the app/build checks already used by the repository and resolve errors.

## 1. Remove Activity Log

- Remove the Activity Log module from navigation, routes, screens, and owner workflows.
- Stop collecting/storing new activity log events. Do not replace the module with another audit/event history system; the owner does not want the additional storage use.
- If activity-log sample records exist, do not let their removal affect orders, payments, attendance, employees, menu, or settings. It is acceptable to stop displaying them; only remove stored log data when the app has a clear, safe cleanup/migration path.
- Keep operational data needed for tickets, payments, attendance, and payroll.

## 2. Clear order status and payment tags

On every order card, order details view, and order list row, display fulfillment/order status separately from payment information. Make the distinction obvious with separate labeled badges/fields:

- **Order status**: New, Preparing, Ready, Out for delivery, Completed, or Cancelled (using the app's current supported workflow).
- **Payment status**: Unpaid, Partially paid, Paid, or Refunded, based on recorded payment entries and order balance.
- Also show a compact, easy-to-scan **PAID** or **UNPAID** tag as requested. Derive it from the actual balance: PAID only when the full amount due has been recorded as paid; UNPAID when nothing or any balance remains. If there is a partial payment, retain the accurate `Partially paid` payment status and show the compact tag as `UNPAID` or `PARTIALLY PAID` consistently. Do not imply an order is fully paid when a balance remains.
- Refresh all badges immediately when a payment is recorded/refunded or an order total changes. Keep cancelled/refunded states clear and do not count them as paid revenue.

The order screenshot currently shows an order status badge at the top and text like `Partially paid · ₱450.00 due` near the total. Improve it to use a distinct payment badge and due amount without crowding the ticket.

## 3. Confirm completing payment

- When the owner/staff records a payment that would fully settle the remaining balance, show a clear confirmation step before saving/marking the order paid, such as: `Confirm full payment of ₱X for ticket #...` with **Confirm payment** and **Go back** actions.
- Confirmation should show the amount, payment method, and reference number if entered. After confirmation, save payment and show a prominent success toast and Paid badge.
- Do not ask for this full-payment confirmation for a partial payment. Validate amount and prevent accidental overpayment using existing payment rules. Keep payment recording separate from order fulfillment status; a paid ticket is not automatically completed.
- If the existing payment flow already has a confirmation modal, update it to show the full context and ensure it triggers only when payment will settle the balance.

## 4. Edit an existing order safely

- Add an **Edit order** action to order details for authorized roles. Reuse the current POS/cart workflow so the user can change items, quantities, item notes, customer/contact, delivery area/address, order notes, and applicable discount/fee fields.
- On save, recalculate the order totals and update the item lines while retaining stable order/ticket identity and original creation time. Show a clear confirmation if changing the order changes the amount due, especially if payment has already been recorded.
- After a successful edit, reset fulfillment status to **New** so kitchen/operations review the updated ticket. Make this behavior explicit in the confirmation/save feedback.
- Preserve the payment ledger and prevent editing from silently converting payments to match the new total. If recorded payments exceed the edited total, block saving and ask the user to resolve/refund the difference first; if the new total is higher, retain payments and show the new balance due.
- Preserve historical menu-price snapshots for unchanged items. Newly added items use their current menu price. Reprint/download receipts from the edited current order and show updated totals.
- Do not allow cancelled orders to be edited unless the app already has a deliberate restore workflow; if permitted, make restoration explicit.

## 5. Downloadable order-status update for customers

- Add a **Download order update** button to order details. It should create a clear shareable image (PNG preferred) containing the business name/logo/tagline, ticket number, customer-facing order status, pickup/delivery type, delivery area when relevant, last-updated time, and a concise customer-appropriate message. Include the estimated/confirmed total only if suitable, and never expose internal staff notes, private employee data, payment references, or internal kitchen notes.
- Make the image useful to send through Messenger or another contact method. Support long names and statuses without clipping; wait for fonts/logo to load before export. Use a filename like `order-update-1002.png` and show a toast on success/failure.
- Keep receipt/invoice printing and downloads as separate actions. A receipt contains itemized financial details; the status update image is a short customer follow-up card.
- If image export is already implemented, reuse its library/utilities and add this customer-safe status card format.

## 6. New Order category navigation

- On the POS New Order screen, make every menu category visible and easy to reach. The current screenshot has a horizontally clipped category tab row. Replace it with a responsive category selector that shows all categories (for example, a wrapping grid, vertically stacked compact list, or horizontally scrollable row with clear scroll affordance and no hidden inaccessible tabs).
- Category names should remain readable. On smaller screens, use a responsive wrap, dropdown with all options, or another interaction that makes all categories discoverable without clipping. Do not allow the ticket/cart panel to obscure category navigation.
- Selecting a category immediately filters the product tiles to that category. Keep search behavior, favorites, and availability filters coherent. Provide an obvious active category. `All items` may remain as a distinct option.

## 7. Menu Management category filtering

- In Menu Management, selecting a category in the left category list must show only that category's items in the right-hand item list. The current screenshot shows one category selected while items from other categories may still appear; fix that behavior.
- Add a clear selected-category heading and item count. Keep search scoped to the selected category; if an All Categories view exists, search can span all categories only in that view.
- Preserve category-specific favorites and saved manual item ordering. Reorder controls should affect only the selected category. Add a clear All Categories option only if it is useful, and never make it the default when a specific category has been selected.
- Keep adding/editing an item bound to the intended category. Changing category should update the displayed item list immediately.

## 8. Daily attendance workflow

Improve Attendance so it is as quick and visual as the Employees module shown in the screenshot:

- Show a date selector defaulting to the current business-local date, a search/filter if useful, and a responsive tile/card for every active employee. Each card should display employee name, role, current rate/basis where the owner is authorized to see it, and today's attendance state.
- Make **Worked** and **Did not work** easy primary actions. Choosing **Worked** opens a focused modal/inline panel with date, time in, time out, optional notes, and a clear **Save attendance** button. Validate time order and prevent duplicate daily records.
- Choosing **Did not work** should save an absent/not-worked record with a light confirmation or one-click save, according to the existing app's data model. Make the current state visible and allow the owner to edit/correct it.
- For an employee already marked Worked, show the saved times and note, plus **Edit record**. Reopening an employee tile must not silently overwrite the saved record.
- Show clear saved/error toast feedback. Preserve attendance history, selected date when appropriate, and historical salary-rate snapshots. Do not accidentally record attendance just by opening the edit panel.
- Use accessible labels, keyboard operation, and touch-friendly controls. On small screens, tiles should stack cleanly; on desktop, use a useful card grid.

## Design and data integrity

- Keep the current Urban Casero warm cream, espresso, and orange visual identity, the sample-data labeling, responsive layout, and accessible contrast.
- Do not change receipt/order data structures unnecessarily. Preserve existing orders and payments. Test edits against unpaid, partially paid, and fully paid orders.
- Ensure order totals, delivery fee snapshots, payment balances, paid/unpaid tags, dashboard metrics, and reports remain consistent after edits.
- Use helpful confirmation dialogs for consequential changes, and visible toast notifications for successful/failed saves. Do not use browser `alert()` for routine interactions.

## Acceptance walkthrough

Before finishing, verify in the running app:

1. Activity Log is absent from navigation and no new log records are created.
2. Orders show distinct fulfillment and payment status, plus an accurate paid/unpaid or partial tag.
3. Full settlement prompts for confirmation and updates payment without changing fulfillment status; partial payment does not use the full-settlement prompt.
4. Edit an unpaid order and a partially paid order. In both cases, the saved ticket returns to New, payment history remains accurate, and invalid overpayment is prevented.
5. Download a customer-safe order status image without private notes or payment reference data.
6. All POS categories are visible/reachable at desktop and narrow viewport widths; choosing each filters items.
7. Choosing a category in Menu Management shows only its items and category-scoped ordering works.
8. Attendance tiles support worked/not-worked, time in/out, optional notes, save, and later correction without duplicate records.

When done, summarize the changes, any data migration performed, how payment confirmation and order editing work, and any limitations.

---

Start the app with the project's existing `start-app.bat` after Claude completes the implementation.
