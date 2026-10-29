# Urban Casero: Day-to-Day Operations Blueprint

## Purpose

This blueprint describes how the owner and team use the app through a normal operating day. It keeps three records separate:

- **Business day:** whether the business is accepting new orders and which operating date the work belongs to.
- **Order status:** where each ticket is in preparation or fulfillment.
- **Payment and cash custody:** what the customer paid, when it was received, who received it, and where the cash is now.

Closing the business day never automatically completes, cancels, or pays an order.

## Roles and routine responsibilities

| Role | Typical daily actions |
|---|---|
| Owner | Opens and closes the business day; reviews dashboard and closeout; manages exceptions, settings, and staff; records or reviews money movements; reconciles register and rider cash. |
| Chef | Views tickets and payment information; moves orders through preparation and ready states; marks eligible pickups as picked up. |
| Kitchen staff | Views tickets and payment information; prepares orders; updates preparation status; marks eligible pickups as picked up. |
| Rider | Sees assigned deliveries and relevant payment information; marks own assigned delivery picked up, out for delivery, and completed; records money collected from the customer; turns cash over to the owner. |

The owner can configure which roles may create new orders. Permission to view a ticket or its payment state does not automatically grant permission to edit the order, refund a payment, close a register, or change business settings.

## 1. Before accepting orders: open the business day

1. The owner opens the app and checks the current business date and timezone (Asia/Manila by default).
2. The owner selects **Open business day**. The app records the business date, opening time, and person who opened it.
3. If cash will be handled in a register, the owner starts the register session and enters the opening float. This is optional for businesses that do not use a physical cash drawer.
4. The app changes to **Accepting orders**. Staff can create new tickets only if their role is enabled in New Order settings.
5. Employees mark attendance separately. Opening the business must not automatically mark employees present or clock anyone in.

If a business routinely works past midnight, the owner can configure a business-day cutoff. The app assigns orders to a business date using that cutoff and timezone, not the server's local date.

## 2. During the day: take and fulfill tickets

### Taking an order

1. Staff select an enabled order type: Delivery, Pickup, Take-out, or Dine-in.
2. They add menu items, quantities, options/notes, and any customer details required for that order type.
3. The app calculates item subtotal, allowed discount, applicable delivery fee, and total.
4. The user places the order. The app confirms the save before showing the customer order update/receipt.
5. The new ticket appears in the Orders board under **New**.

Order-type rules:

- **Delivery:** delivery area, address, and assigned rider are required; delivery fee is applied from the configured area.
- **Pickup:** customer collects an order placed ahead.
- **Take-out:** counter order to be carried away.
- **Dine-in:** optional table/reference; no delivery area, address, rider, or delivery fee.

### Preparing and handing off

1. Kitchen staff or chef moves a ticket from **New → Preparing → Ready**.
2. For pickup or take-out, an authorized staff member marks it **Picked up** at handoff. The existing pickup workflow may mark the order completed according to the chosen business rule; it must not run delivery-only steps.
3. For delivery, the assigned rider marks **Picked up → Out for delivery → Completed** as the order is handed to them and delivered.
4. The customer-facing order update shows the current status and order breakdown, but excludes staff-only controls and private notes.
5. Staff can see payment state on tickets they are authorized to view. Order status and payment status remain separate; a completed ticket can still be unpaid if the business permits follow-up collection.

## 3. Record customer payments

- Record each payment as a separate transaction with amount, method (Cash, GCash, Bank transfer, or enabled methods), timestamp, and authenticated receiver. Add a reference when useful.
- Partial payments are allowed where the business workflow permits them. The ticket shows **Paid**, **Partially paid**, or **Unpaid**, plus the remaining balance.
- A rider can record a payment only on their own assigned delivery and only up to the remaining balance. The system records that the rider received it.
- A payment collection is recorded once. Do not also add the same customer payment as a manual cash-in.
- Payment corrections and refunds use an authorized reversal/refund record; they do not erase the original payment.

## 4. Keep cash and money movements clear

The app treats a payment and a movement of cash as different things:

- A **cash payment at the register** increases expected drawer cash.
- A **GCash or bank transfer payment** appears in the collection report but not in physical drawer cash.
- A **rider cash collection** is held by that rider until handed over; it does not increase the owner's drawer balance yet.
- A **rider handover** transfers cash custody from rider to owner/register. It is not another sale or payment.
- A **cash expense/payout** reduces drawer cash and is recorded with a category, amount, and optional note/receipt.
- A **bank deposit/safe transfer** moves cash out of the drawer but is not a business expense.
- Owner-provided starting cash is an opening float or cash-in movement, not sales.

Expected cash in the register is:

`Opening float + cash received at register + transfers in − cash refunds − cash expenses/payouts − transfers out`

Expected cash held by a rider is tracked separately:

`Rider cash collections − rider cash handovers`

The app shows expected amounts; staff still count physical cash and confirm the count.

## 5. Stop new orders and close the day

At closing time, the owner selects **Stop new orders**. New tickets are blocked, while existing tickets can still be fulfilled and authorized payments can still be recorded.

The owner opens **Review and close** and checks:

1. Orders created during the selected business date, grouped by order type and status.
2. Sales booked from non-cancelled orders.
3. Payments actually received during the date, by method and receiver.
4. Rider collections still held by each rider and cash handed over.
5. Register expected cash versus counted cash, with over/short difference.
6. Cash expenses/payouts, refunds, deposits, and other movements.
7. Unpaid balances and orders that are not yet fulfilled.

For unfinished tickets, the owner reviews them and confirms they will carry over. The tickets retain their current status and original order date. The owner then saves **Close business day**. The close report is saved with the person and time who confirmed it.

If a late payment is recorded after closing, it is reported on its actual payment date and remains linked to the original order. A correction after close should be a new authorized adjustment or reversal; do not silently change a saved close snapshot.

## 6. What the daily report means

The close report keeps these totals separate:

- **Sales booked:** order totals by the order's business date, with cancelled orders handled by the documented cancellation rule.
- **Payments collected:** payment transactions by the date received. Refunds are displayed separately and reduce net collections.
- **Cash in register:** expected and counted physical cash for the register session.
- **Cash held by riders:** collections not yet handed over.
- **Unpaid balance:** amount customers still owe; not counted as cash received.
- **Outflows:** cash expenses/payouts, refunds, and transfers, each labeled distinctly.

Sales and payments are not added together as if they were the same number. The report is an operations and cash-reconciliation report, not a profit report; food costs and all operating costs may not be recorded in this app.

## 7. Next day and carry-over work

1. The owner opens a new business date and starts a new register session if needed.
2. Carried-over tickets remain visible with their original order date and current status.
3. The team continues preparing or delivering those tickets without recreating them.
4. Payments recorded today appear in today's cash/collection report, while the order remains associated with its original order date.
5. The dashboard distinguishes today's new sales from today's payments collected on earlier tickets.

## 8. Recommended rollout

### First release

- One business-wide open/stop/close state per location/business date.
- One default register with optional opening float and closing count.
- Sales, payments, refunds, expenses/payouts, deposits/transfers, and rider cash handovers shown as distinct records.
- Unfinished-order carry-forward review.
- Saved close report and CSV export.
- Owner-controlled close permissions and clear confirmation for variances.

### Enterprise foundation

Structure the records so they can later support:

`Business → Location → Register → Register session`

Every order, payment, cash movement, rider handover, and close report should belong to the correct business and location, and to a register session or money custodian where applicable. Use server-enforced permissions, database constraints, unique idempotency keys, and append-only money records. Keep a small financial correction history for reversals and close adjustments; this is operational accounting evidence, not a general activity-log feed.

Later phases can add multiple locations/registers, manager approval thresholds, cash denomination counting, offline order queueing, bank/payment-provider reconciliation, and accounting-system exports. The first release should make online saves explicit and block final close while financial writes are still pending synchronization.
