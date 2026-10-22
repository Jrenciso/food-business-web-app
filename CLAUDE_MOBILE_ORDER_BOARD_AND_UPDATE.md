# Claude Code Prompt: Make Order Board and Customer Update Work on Mobile and Tablet

Improve the existing Urban Casero app's mobile and tablet order workflows. The desktop Orders page groups tickets into status columns, but those grouped board sections are not accessible in mobile view. Also, after a successful **Place order**, the customer order breakdown/update preview is unavailable or does not reliably appear on mobile. Inspect the current responsive CSS, Orders board/list state, POS submit flow, customer update component, and image export before editing. Fix the real responsive/state issue in the existing app without changing order data or removing desktop behavior.

## 1. Mobile-friendly status-grouped order board

- Keep the desktop kanban/board layout as it currently works.
- Make the **Board** view available and useful on mobile and tablet, with every workflow status section accessible: New, Preparing, Ready, Picked up, Out for delivery, Completed, and Cancelled when included by the current filters.
- On a phone, use a compact horizontally scrollable status selector with a count badge for each status and a full-width stack of cards for the selected status. Make the active status obvious, retain its lane heading/description, and let users switch between lanes with one tap. Support horizontal swipe between status sections only if it does not conflict with vertical page scrolling.
- Keep the status selector reachable while scrolling the selected lane, and automatically bring the active status into view when selected. Do not shrink every desktop lane into unreadable narrow columns.
- On tablets, use a responsive kanban presentation suited to available width: show multiple readable columns when they fit, otherwise use the mobile lane selector. Avoid horizontal page overflow; if a horizontally scrollable board is used, keep lane widths readable and make the scroll affordance clear.
- Preserve the existing **Board / List** switch. The List view remains a usable alternative and all filters, search, status counts, role restrictions, and status actions must work in both views.
- Preserve status sorting and ticket-card information: workflow order from New through Completed, Cancelled last, consistent sorting within lanes, order type/payment badges, and assigned rider for Delivery tickets.
- Ensure all ticket actions (details, status updates, payment info, cancellation where authorized) remain visible, reachable, and touch-friendly on mobile. Do not make the entire card intercept taps intended for buttons.

## 2. Customer order update after successful placement on all screen sizes

- After the server confirms a new order was saved, automatically open the existing Customer order update/breakdown preview on desktop, tablet, and mobile. This behavior must not depend on desktop-only CSS or a desktop-specific pane being active.
- On phones, show the update as a full-screen dialog or bottom-sheet style view with a clear close control, a fixed or sticky top bar, and reachable bottom actions. On tablet/desktop, retain a well-sized modal/dialog that uses the available viewport.
- Include **Go to orders** at the top, plus **Close**, **Edit**, and **Download PNG** actions. Keep Edit permission-aware and preserve existing order lock/payment rules. Go to orders must close the preview, navigate to Orders, and make the just-created ticket easy to find without creating a duplicate.
- Show a complete customer-facing order breakdown: business branding, ticket number, order type, status, item names and quantities, per-line amounts, applicable fees/discounts, total, payment state, amount collected, remaining balance, and relevant customer-facing delivery or dine-in information.
- Keep the preview content vertically scrollable on mobile while the header and key actions remain reachable. Do not let browser safe areas, mobile browser bars, toast notifications, or the on-screen keyboard obscure the main actions.
- Make **Download PNG** capture the entire update content, including line items and totals below the visible scroll area. Verify the downloaded file is legible at phone resolution and has a useful ticket-number filename.
- Do not include staff-only controls, private internal notes, or payment references in the customer-facing preview or PNG.
- Open the preview only for a confirmed successful save. If validation/save fails, keep the user in the order flow, preserve the draft fields, and show the existing actionable error. Prevent duplicate orders from double taps or retry behavior.

## 3. Responsive interaction and accessibility

- Test narrow phone widths (320–390 CSS px), common large phones, portrait/landscape tablet widths, and desktop. Use the app's existing design tokens and visual style.
- Use touch targets of about 44 CSS px or larger for lane selectors, buttons, and card actions. Respect safe-area insets and avoid fixed elements covering scrollable content.
- Preserve keyboard navigation, focus visibility, dialog focus handling, Escape/close behavior where supported, and accessible labels for status counts and actions.
- Maintain readable text and sensible spacing without hiding critical order/payment information to save space.
- Keep all responsive state tied to the same order data and selection state as desktop. Switching viewport size or opening/closing mobile panes must not discard the selected ticket or hide a saved update.

## 4. Verification

Use the repository's existing build and tests. If browser-based responsive tooling is available, inspect the actual app at phone, tablet portrait/landscape, and desktop widths. Verify:

1. Every status lane can be reached on a phone, displays the correct count and tickets, and supports search/filter and authorized actions.
2. Tablet displays readable grouped lanes or the lane-selector fallback depending on width; no critical content is clipped or unreachable.
3. Board and List views remain available and consistent across roles and viewport changes.
4. Successful order placement opens the breakdown on mobile/tablet, and failed saves do not open a false success preview or duplicate an order.
5. Go to orders, Close, Edit, and Download PNG are reachable on a phone without being covered by browser chrome or content.
6. A long order breakdown scrolls fully, and the downloaded PNG contains the whole customer-facing breakdown with no clipped items or totals.
7. Existing desktop layout, status/payment workflows, rider assignment, permissions, and order data remain intact.

At completion, summarize the mobile/tablet interaction chosen, files changed, viewport sizes inspected, checks actually run, and any remaining browser-specific limitation. Do not claim a device/viewport was tested unless it was inspected.
