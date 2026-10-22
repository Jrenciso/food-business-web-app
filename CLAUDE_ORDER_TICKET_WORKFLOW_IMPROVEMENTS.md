# Claude Code Prompt: Improve Ticket Navigation, Sorting, and Post-Order Update

Improve the existing Urban Casero operations app in this repository. Inspect the current order board/list, ticket details, role permissions, POS submit/edit flow, customer order update image, save behavior, and responsive styles before making changes. Implement these improvements in the existing app. Preserve all existing orders and features, including payment handling, status history, delivery assignment, dine-in/take-out, sample data, and shared workspace behavior.

## 1. Open ticket details from the ticket number

- Make the displayed ticket number on each order card and in the order list an accessible, clearly interactive control.
- Tapping/clicking the ticket number should open the same complete ticket details currently opened by the **Details** button. It must not trigger status changes or other card actions.
- Keep the existing **Details** button for discoverability and for users who prefer an explicit action. Both entry points must open the same detail view for the same ticket.
- Use a semantic button or link with keyboard focus and a useful accessible name, and provide visible hover/focus states.

## 2. Show the assigned delivery rider on ticket cards

- For Delivery tickets, show the assigned rider's display name on every ticket card and in list view, in a predictable location near the delivery area/order metadata.
- If the order has no rider assigned or the rider profile is unavailable, display a clear label such as **Rider not assigned** rather than a blank value.
- Do not show rider assignment for Pickup, Take-out, or Dine-in.
- Follow existing role-based order visibility: owners and operational staff see the rider assignment for business tickets; riders only see tickets assigned to them. Do not expose unrelated rider account details.
- Keep the card readable on mobile and tablet, including when delivery-area labels and names are long.

## 3. Sort all order views by workflow status

- Sort tickets in every role's Orders board and list in workflow order, from earliest to latest: **New → Preparing → Ready → Picked up → Out for delivery → Completed**. Show **Cancelled** tickets last when they are included by the current filters.
- Apply the same status ordering consistently across owner, kitchen staff, chef, and rider views, including after search or order-type filters are applied.
- Within a status group, use a predictable secondary sort, recommended: newest order first. Keep the sort stable when the view refreshes or another device updates an order.
- Respect role visibility and order assignment filters. Sorting must not reveal tickets a user is not authorized to see.
- If the user selects a specific status filter, retain a sensible date/ticket ordering inside that result set.

## 4. Show the customer order update immediately after a successful order

- After **Place order** succeeds and the server confirms the save, automatically open the existing Customer order update view for the newly created ticket. Do not open it if validation or persistence fails.
- The update view should clearly show business branding, ticket number, order type, current order status, customer-facing status message, date/time, item-by-item quantity and amount, subtotal, applicable delivery fee, discount if any, total, and payment status/amount due. Include delivery area where applicable, but do not expose staff-only notes, internal status controls, private employee data, or payment references to the customer-facing image.
- Support long orders with a scrollable preview and a complete downloaded PNG. Confirm that image export captures the full update content rather than only the visible scroll area. Keep text legible in the image on phone and desktop.
- Add a **Go to orders** button at the top of the update view. It should close the preview, navigate to Orders, and make the newly created ticket easy to locate (for example, retain a ticket ID selection or briefly highlight it). It must not create another order.
- Keep **Close** and **Download PNG** actions. Closing returns to a sensible New order state without losing the successfully saved order. Downloading exports the current persisted order update, with a useful filename containing the ticket number.
- Add an **Edit** button. It should close the customer-facing preview and open the existing order editor for this ticket. Reuse the established order-edit behavior, including role checks, payment safeguards, delivery validations, and the existing rule that orders cannot be edited once Out for delivery or Completed. Since a newly placed order starts as New, it should normally be editable by an authorized user.
- If the order can no longer be edited, disable or omit the Edit action and explain why. Do not imply that the order was edited when no update was saved.
- When an edit is saved, refresh the customer update and show the latest persisted details. Follow the established rule that an edited order returns to New only where the current business workflow allows it; do not reset a paid/advanced/locked ticket or lose its payment history.
- Apply role permissions: only users who are allowed to create/edit orders may see and use Edit. Other roles can use the customer update view only if the existing application permits them to access that order.

## 5. Protect the current order workflow

- Use the existing successful-save result and server-confirmed order data as the source for the update preview. Do not build it from an uncommitted draft after a failed save.
- Avoid duplicate order creation if a user double taps **Place order**, navigates back, or retries after a slow network response. Use existing idempotency and pending-save protection.
- Preserve selected order type, enabled types, customer data, cart, payment calculations, delivery fees, rider assignment, and dine-in/take-out behavior.
- Do not clear or overwrite an existing ticket when opening the new post-order preview. The preview should reference the created order by its stable ID.
- Keep the customer-facing update separate from the staff ticket details. Staff controls such as status changes, payment capture forms, edit controls, and internal notes must never appear in the downloaded customer PNG.

## 6. Responsive interaction

- Keep the ticket number easy to tap without making the whole ticket card accidentally open when users press action buttons.
- Ensure assigned rider text, status/payment/order-type badges, ticket details, and actions fit cleanly on narrow phones and tablets.
- Make the post-order preview usable on small screens, with visible top navigation and bottom actions that remain reachable. Avoid clipped modal content or hidden Download/Edit/Go to orders actions.
- Preserve keyboard access, focus management, and screen-reader labels when opening/closing dialogs and returning to the Orders list.

## 7. Verification

Use the repository's existing build and test setup and run relevant checks. Verify:

1. Clicking a ticket number and clicking **Details** open the same order details for all roles allowed to view that ticket.
2. Assigned rider appears for Delivery cards/list rows and missing assignments are clear; non-delivery tickets have no rider label.
3. Every Orders view uses the same status order, with Cancelled last, and consistent newest-first ordering within each status.
4. Successful order placement opens the customer update exactly once; failed validation/save does not open a false success preview or duplicate a ticket.
5. **Go to orders** opens Orders and identifies the new ticket; **Close** and **Download PNG** work and do not change the order.
6. Downloaded PNG contains the complete customer-facing order breakdown for a long order and excludes internal notes, payment references, and staff-only controls.
7. **Edit** opens the existing editor for authorized roles, respects order locks and payment safeguards, and refreshes the update after a confirmed save.
8. Existing status, payment, delivery assignment, role permissions, and sample/shared data behavior remain intact.
9. Ticket cards and update preview work on phone, tablet, and desktop without clipped controls or unreadable text.

At completion, summarize the changed workflows, files changed, checks actually run, and any limitation. Do not claim a check passed unless you ran it.
