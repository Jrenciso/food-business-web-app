# Claude Code Prompt: Build a Read-Only Live Order Monitor

Add a new, read-only operations module called **Live Order Monitor**. It is a shared-screen/kiosk-style dashboard for owners and operational crew (kitchen staff, chefs, and riders) to understand the order queue and pace at a glance. Use the attached sketch as the basic concept: a live board grouped into columns by order status. This view is specifically for monitoring; it must not expose order editing, payment entry, status-changing buttons, navigation shortcuts to other modules, or other operational actions.

Inspect the existing application, order lifecycle, role permissions, business-day/register behavior, and realtime data subscriptions first. Reuse the existing models and status timestamps. Do not introduce a second source of truth for orders or status.

## Name and access

- Label the module **Live Order Monitor** in navigation and page titles.
- Make it available to the owner, kitchen staff, chefs, and riders, subject to the existing account and module-access model. It must not be owner-only.
- The module is strictly read-only. Enforce that in the UI and route/API authorization; do not rely only on hiding buttons.
- Provide a focused kiosk/display layout without links or shortcuts into other modules. Preserve the app’s normal role security and sign-in. A monitor-only route/session must not grant broader account access.
- Respect module enable/disable settings. If disabled, hide its navigation and prevent direct access according to the app’s existing module configuration pattern.

## Live order board

- Use a clear status board with separate columns for active fulfillment stages supported by the existing workflow, such as **New**, **Preparing**, **Ready**, **Picked up**, and **Out for delivery**. Include **Completed** as a compact completed-today area or column so it does not crowd active work. Show cancelled count separately rather than mixing cancelled tickets into fulfillment queues.
- Put the order count in each column header. Update the board live using the existing realtime/subscription mechanism where available, with a safe periodic refresh fallback and visible last-updated/connection state.
- Make ticket cards readable from a distance and at a glance: ticket number, order type, current status, elapsed time since order creation (or time in current status), item count and concise item/quantity summary, and assigned rider for delivery when available. Highlight tickets that exceed the configured target or have been waiting unusually long, using text/indicators as well as color.
- Avoid exposing customer phone number, full delivery address, payment method, payment reference, or sensitive customer data on a shared display. Include only operationally necessary information. Do not show payment totals or payroll/employee metrics.
- Support long queues without breaking the board: responsive columns, bounded ticket-card content with a way to view the remaining item summary read-only if needed, clear overflow/scroll behavior, and no clipped ticket details.
- Do not allow a status action from this monitor. Staff should use the existing authorized Orders workflow to update a ticket.

## Today-only metrics

Show a compact metrics strip at the top. Use labels and definitions that make each number trustworthy:

1. **Orders received today** — distinct orders created in the current business day, including cancelled orders in the total but with cancellations identified separately.
2. **Orders in line** — currently active, non-cancelled tickets awaiting fulfillment; show the count and, if space permits, the breakdown by active status.
3. **Completed today** — tickets completed in the current business day.
4. **Average order turnaround** — average elapsed time from order creation to completion, calculated only from orders completed during the current business day. Show the completed-order sample count and use `—`/`Not enough completed orders` when the sample is empty. Do not include still-open tickets or cancelled tickets in this average.
5. **Oldest active order** — age and ticket number for the longest-waiting active ticket, to flag queue risk.
6. **Over-target orders** — count of active tickets exceeding the configured operational target, if the app already has a target setting. If no target exists, do not invent a business promise; show active ticket ages and label the target as not configured, or propose a simple owner-configurable target in settings without blocking the monitor.

If reliable status timestamps exist, optionally show **Average kitchen time** (New/received to Ready) and **Average delivery/fulfillment time** for completed delivery orders as separate metrics. Include the sample count and omit/label unavailable metrics when timestamps are missing. Never label order creation-to-completion as kitchen preparation time.

## Business date and carryover handling

- Scope today’s metrics to the current open business-day session when the Register/Business Day module is enabled. If that module is disabled or no session exists, use the configured business timezone (Asia/Manila for this business) and the local calendar date.
- Show the current business date and a live clock in the business timezone. Update the clock without a page reload.
- Keep today’s counts and averages limited to orders belonging to today’s business date.
- Do not lose visibility of unfinished tickets from an earlier business day. If an older ticket is still active, show it in a clearly separated **Carryover** area with its original ticket number and age, but exclude it from today’s orders received/completed/turnaround metrics. If there are no carryovers, do not render an empty section.
- Completed tickets from previous business dates must not appear in this today-only monitor.

## Display modes and responsive behavior

- Optimize for a landscape tablet, counter display, or TV: high contrast, large status headings, large ticket numbers, readable elapsed timers, minimal chrome, and a board that uses available screen space.
- On phones and portrait tablets, convert status columns into a usable status selector or horizontally navigable status lanes with visible counts; do not shrink all columns until text becomes unreadable. Preserve access to every status group and carryover tickets.
- Reflow metrics into a compact responsive grid. Keep the live clock and current date visible without taking excessive space.
- Support browser zoom, keyboard navigation, accessible status labels, and reduced-motion preferences. Use subtle age/threshold cues and avoid distracting animations or flashing alerts.
- Provide useful loading, empty, offline/disconnected, and stale-data states. Never imply the display is live when updates are stale.

## Data correctness and security

- Query and subscribe only to records the signed-in user is authorized to see. Respect tenant/business boundaries and existing server-side access policies.
- Derive order counts and durations from persisted order/status timestamps, not client-side guesses. Handle timezone boundaries and daylight-saving behavior using the configured business timezone.
- Deduplicate realtime events and guard against stale/out-of-order updates. Keep the board correct after reconnecting.
- The monitor must not mutate orders, payments, payroll, attendance, or settings.
- Do not seed data, alter existing tickets, change payment records, or change database schemas unless the current backend genuinely requires a migration; if one is needed, make it additive and explain why.

## Implementation and verification

Implement the module in the existing application and integrate it with navigation, module settings, role access, and the existing shared backend. Review it at representative desktop/TV, tablet landscape, tablet portrait, and phone widths. Verify live status changes, metric definitions and date boundaries, carryover exclusion, no-data states, permission denial, disabled-module behavior, and that the view offers no mutation actions or unrelated navigation. Run relevant existing checks/build and report the route/components/data sources changed, the metrics implemented, and scenarios actually verified.
