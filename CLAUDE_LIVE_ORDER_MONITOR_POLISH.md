# Claude Code Prompt: Polish the Live Order Monitor

Refine the existing **Live Order Monitor** shown in the attached screenshot. Keep it read-only and preserve the established order workflow. The status is repeated in the lane heading and again on each ticket card; show the current status only once. Also improve the timer clarity, metric consistency, and overall scanability of this live operations display.

Inspect the current implementation, order/status timestamps, business-day scope, and existing Live Order Monitor requirements before editing. Reuse the app’s authoritative order data and calculations.

## Remove duplicate status text

- Treat each status lane heading (New, Preparing, Ready, Picked up, Out for delivery, etc.) as the authoritative visual status for its cards.
- Remove the repeated status label/text inside each ticket card. Keep the order type badge (Delivery, Pickup, Take-out, Dine-in), since that communicates different information.
- Keep status counts in lane headings and preserve a clear accessible association between a ticket and its lane/status for assistive technology.
- Ensure status remains understandable in narrow/mobile layouts when lanes switch to tabs, a selector, or a single-column view; in those layouts, show the selected status once at the section heading, not redundantly on every ticket.

## Make elapsed-time information accurate and easy to scan

- Review how **Order age** and **time in this stage** are calculated. Base both on persisted timestamps and the business timezone; do not use inconsistent or guessed values.
- For a ticket in **New**, order age and time in the current stage are the same. Show one clear timer, such as **Waiting · 3h 10m**, instead of repeating the same duration twice.
- For tickets in later stages, show time in the current stage as the primary operational timer. Show total order age only if it adds useful context; label it clearly and ensure it is distinct from stage duration. Never show duplicate or contradictory durations.
- Use readable age formatting that scales sensibly from minutes to hours/days. Highlight long waits using the configured target when one exists. If no target is configured, show elapsed time neutrally and do not invent an SLA.

## Reconcile the metrics and queue

- The screenshot shows different scopes/counts (for example, **Orders received today** and **Orders in line**). Make the scope of every metric explicit and ensure its numbers agree with the tickets and status counts shown.
- Split counts where needed: today’s active tickets versus carried-over active tickets. Today’s received/completed/turnaround metrics must use the current business day; carryover tickets must be clearly identified and excluded from today’s new-order counts and turnaround averages.
- Ensure **Orders in line** equals the sum of the active queues it claims to represent. If it includes carryovers, label and split the count so users can distinguish them.
- Ensure each lane count matches the tickets displayed or explicitly indicate pagination/hidden items. Status totals must not silently include filtered, off-screen, cancelled, or prior-day completed orders.
- Keep the existing meanings for orders received, completed, average turnaround, oldest active order, and configured wait target. Use appropriate empty values when no sample exists; never imply a zero duration when the metric is unavailable.
- Recheck edge cases for timezone boundaries, open business-day sessions, cancelled tickets, missing status timestamps, and stale/reconnected live updates.

## Improve overall live-display usability

- Strengthen hierarchy between page title, business date/live clock, metrics, lane titles, and ticket cards. Keep essential text comfortably readable at normal zoom and from a counter/tablet display distance.
- Reduce unused or uneven board space while keeping lanes and cards orderly. Use a responsive grid that distributes lanes well on wide screens and makes every status accessible on tablet and phone without tiny columns or horizontal page overflow.
- Keep cards concise: ticket number, order type, one primary elapsed-time indicator, item count and short item summary, and assigned rider when relevant. Avoid showing customer contact, full address, payment details, or unrelated data on a shared crew screen.
- Make long item lists readable with a clear “+N more”/expand-for-read-only-details affordance. Ensure expanded content remains inside the card/board and cannot be mistaken for an editing control.
- Make live/connection state and last-updated time clear, but keep the clock and sync metadata visually secondary to queue information.
- Retain read-only behavior, role access, module enable/disable behavior, reduced-motion support, and phone/tablet responsiveness.

## Constraints and verification

- Do not alter order/payment records, seed or reset data, or change fulfillment business rules.
- Do not add status-changing actions, payment controls, or navigation shortcuts to this monitor.
- Do not solve count mismatches by hiding valid active tickets. Fix the query, scope, aggregation, or labeling that causes the mismatch.
- Review the result at desktop/display, tablet landscape, tablet portrait, and phone widths. Verify one status presentation per ticket, accurate elapsed times in New and later stages, queue/lane count reconciliation, today-versus-carryover metrics, no-data states, and live refresh/reconnect behavior.
- Run relevant existing checks/build and report the specific changes and scenarios actually verified.
