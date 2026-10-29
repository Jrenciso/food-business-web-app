# Claude Code Prompt: Hide Payment Entry When an Order Is Fully Paid

Update the order details/payment panel shown in the attached screenshot. When an order is fully paid, staff should see that clearly and should not see controls for recording another customer payment.

## Required behavior

- Determine payment state from the order's authoritative total and persisted payment records, using the existing shared calculation and currency precision rules. Treat the order as fully paid when its remaining balance is zero within the app's currency rounding tolerance.
- For a fully paid order:
  - Keep the payment history and its **Payments · Paid** heading visible.
  - Hide the **Record customer payment** form, including payment method, amount, and reference inputs.
  - In its place, show a simple, prominent confirmation such as **Fully paid** and **No balance due**. Optionally show the amount collected and total, without adding a new complex panel.
  - Do not show disabled payment inputs or require staff to choose a payment method.
- For an unpaid order, show the payment form with its full outstanding balance.
- For a partially paid order, show the payment form with the remaining balance and prevent the recorded payment from exceeding that balance.
- When a payment is saved, refresh the order's payment state immediately. If that payment settles the balance, replace the entry form with the fully-paid confirmation without requiring a page reload.
- Keep order fulfillment status independent from payment status. A fully paid order must retain its normal status controls and history.
- Keep refunds as a separate workflow governed by existing permissions and refund rules. Hiding additional customer payment entry must not remove or silently alter refund capability or existing payment history.

## Data integrity and concurrent updates

- Enforce the no-overpayment rule in the authoritative backend/API mutation as well as in the UI. A hidden form is not a security or integrity control.
- Recheck the current remaining balance when saving a payment so a stale open modal or simultaneous payment from another user cannot over-collect.
- Make retries idempotent so a network retry cannot create duplicate payments.
- If a payment save fails, retain entered values and show a clear error. Do not present the order as paid until the persisted payment is confirmed.
- Handle legacy or inconsistent records safely: use the canonical payment calculation, clamp display-only negative balances to zero where appropriate, and do not create additional payments when the authoritative balance is settled.

## User experience

- Match the current visual style and keep the fully-paid state concise, readable, and accessible on phone, tablet, and desktop.
- Use text and an appropriate status treatment; do not communicate paid state through color alone.
- Preserve existing order details, payment history, receipts, rider collection data, permissions, and responsive modal behavior.

Inspect the existing payment state calculation and order-detail component before changing code. Implement this in the real app and report the files changed and the relevant scenarios verified: unpaid, partial, fully paid, payment settling the balance, stale/concurrent payment attempt, and refund visibility.
