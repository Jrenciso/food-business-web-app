# Claude Code Prompt: Add a POS Checkout Step Before Saving the Ticket

Change the current post-**Place order** popup in the existing Urban Casero app into a real POS review-and-payment step. Today the popup is titled **Customer order update** and appears after the order has already been saved to the Orders ticket list. The intended workflow is different: staff need to review the full breakdown, optionally record a payment, then finalize the order so it is added to the ticket list.

Inspect the existing POS flow, draft state, payment ledger, register/session behavior, order-type rules, role permissions, Supabase write functions/RPCs, and customer-facing order update/receipt before editing. Preserve all current features and existing orders/payment history. Do not replace the app with a scaffold.

## 1. Change the workflow to compose → review/payment → finalize

Implement this flow for every enabled order type: Delivery, Pickup, Take-out, and Dine-in.

1. Staff select an order type and build the draft as they do today.
2. Replace the current immediate-submit behavior with a **Review order** or **Review & payment** action. Opening this view must not yet create an order, reserve a permanent ticket number, add a record to Orders, or record a payment.
3. Show a review screen/dialog called **Review & payment**, **Checkout**, or another concise POS label. Do not call this screen **Customer order update**; that name implies the order is already finalized and customer-facing.
4. Show the full draft breakdown: order type, required customer/order details, item names/options, quantities, unit/line prices, subtotal, allowed discount, applicable delivery fee, and final total. Show only fields relevant to the selected order type.
5. Let the user choose either **Record payment now** or **Leave unpaid / Pay later**. If paying now, select an enabled payment method and enter only the method-specific details described below.
6. The final primary action is **Finalize order** (or **Confirm order**). It atomically creates the order and, if selected, its payment transaction. Only after server confirmation should the order appear in the ticket list and the draft be cleared.
7. After success, show a concise confirmation with the assigned ticket number, payment state, and actions to open Orders, view/download the customer receipt/update, or start another order. Keep the existing customer-facing order update/receipt capability as a separate post-save view with customer-safe content.

If current product wording must retain **Place order**, make that button open Review & payment, and use **Finalize order** for the actual commit. Avoid ambiguous duplicate buttons that can create the order twice.

## 2. Payment entry adapts to the selected method

Payment capture must be available during checkout for all order types and only to roles authorized to record payments. The selected method controls which fields appear.

### Cash

- Show the remaining balance and a **Cash received** field, prefilled with the exact balance for speed.
- Calculate and display **Amount applied**, **Change to return**, and **Balance after payment** before finalization.
- If cash received is less than the balance, allow a partial payment when the current business rules allow it; change is zero and the remaining balance stays due.
- If cash received is greater than the balance, apply only the balance and calculate the excess as change. Do not record excess as an overpayment or tip.
- Require an explicit confirmation that cash was received and calculated change returned. Persist tender amount and change with the payment. Count drawer cash as net tender (cash received minus change) exactly once.
- Attribute the payment to the authenticated employee taking the payment and the open register session when Register is enabled. For payments collected later by a rider, keep the existing rider collection flow and rider custody rules.

### GCash, bank transfer, and other enabled non-cash methods

- Show the amount received/applied and an optional reference field if appropriate.
- Do not render cash-tender, change, drawer, or cash-confirmation fields.
- Do not claim the app independently verified an external GCash or bank transaction.

### Leave unpaid / pay later

- Permit saving an unpaid order if the business workflow and role allow it. Do not create a payment record with a zero or fake amount.
- For Delivery with payment due on delivery, show that the rider may collect later using the assigned-delivery payment flow. Do not mark the order paid at checkout.
- Show the resulting balance due after finalization.

Payment methods must come from the current business settings. Disable checkout payment when no methods are enabled, but still allow **Leave unpaid** if the role and business rules permit it.

## 3. Keep order-type rules intact

- **Delivery:** show the required customer contact, area, address, and rider fields; include the configured delivery fee in the review. Payment can be recorded now or left for the rider/customer later.
- **Pickup:** no delivery address, area, rider, or fee.
- **Take-out:** no delivery address, area, rider, or fee.
- **Dine-in:** no delivery fields or fee; show the configured table/reference. Respect the setting that hides customer mobile/contact for dine-in.
- Apply discounts and totals consistently with the existing receipt and reporting calculations. Never add a delivery fee to a non-delivery type.

## 4. Atomic save, recovery, and existing records

- Make **Finalize order** a single trusted server operation that validates and writes the new order and optional initial payment together. Either both save or neither saves; avoid a ticket without its selected payment or a payment without its order.
- Use the existing server-authoritative order numbering, role authorization, enabled order types, menu price checks, delivery validations, payment methods, register state, and idempotency/concurrency patterns.
- Prevent double taps and retries from creating duplicate tickets or duplicate payments. Use a stable idempotency key for the checkout attempt and return the existing successful result on a safe retry.
- If validation or server save fails, keep the review screen open and preserve the order draft and payment inputs. Show a clear, actionable error; do not show a success receipt, clear the cart, or claim the order was saved.
- Do not finalize a new order when the business is closed or not accepting orders if business-day controls are enabled. If Register is disabled, do not require a register session to take an order or record a payment; the payment must still persist in the order ledger.
- Do not change historical orders or payment records. Existing detail/payment flows for old tickets continue to work.

## 5. Review screen design

- Make the checkout screen compact, clear, and quick to use on phones, tablets, and desktop.
- Keep the order total and payment state prominent. Put payment method selection before method-specific fields. Use large touch controls and a pinned bottom action area on mobile.
- Clearly distinguish **Review & payment** (not saved yet) from the customer-facing receipt/update (saved already). Show a draft indicator and avoid assigning a permanent ticket number until finalization succeeds.
- Let staff return to editing the draft without losing cart, customer, delivery, dine-in, discount, or payment inputs. If they choose to abandon the draft, confirm before clearing it.
- After finalization, show the ticket number and saved payment status. Keep **View receipt/order update**, **Go to orders**, and **New order** actions easy to find.
- Receipt and customer update exports must use the persisted order and payment data, show cash tender/change when appropriate, and omit private internal notes/references according to the existing customer-facing policy.

## 6. Permissions and reports

- Respect the configured roles allowed to create orders and separately enforce who may record payments.
- Kitchen staff, chef, owner, rider, and other roles retain existing order/payment visibility rules. Do not grant an employee payment-refund, correction, settings, or payroll permission just because they can use checkout.
- Record payment receiver and register session so the Register and reports can reconcile by method, date, employee, and cash custody. Customer payment and cash handover remain distinct events.
- New checkout payments must appear once in order payment status, sales/collection reports, and register totals. Preserve the distinction between order date and payment timestamp.

## 7. Verification

Use the repository's existing build/test setup and run relevant checks. Verify:

1. Clicking the review action opens checkout without adding a ticket or payment.
2. Finalize with **Leave unpaid** creates exactly one order with no payment record and the correct balance due.
3. Finalize with cash records tender, calculated change, net payment, receiver, and drawer effect correctly for exact, partial, and excess tender.
4. Selecting GCash/bank transfer shows no cash/change fields and records the selected method/reference correctly.
5. Each enabled order type uses its correct fields, totals, fees, and validations.
6. A failed save preserves the draft; a retry does not duplicate the order or payment; the post-save receipt appears only after confirmed success.
7. Register enabled/disabled configurations both work, without blocking payment capture when register reconciliation is disabled.
8. Existing orders and payment records remain unchanged and the new flow is usable on phone, tablet, and desktop.

At completion, summarize the new checkout journey, server/data changes, checks actually run, and any Supabase deployment required. Do not claim the live backend is updated until its migrations/functions have been applied and verified.
