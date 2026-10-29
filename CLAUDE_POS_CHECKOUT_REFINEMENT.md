# Claude Code Prompt: Refine the POS Checkout and Payment View

Improve the existing **Review order & payment** step shown in the attached screenshot. Keep the existing app architecture, backend, design language, permissions, and order workflows intact. First inspect the current implementation and reuse its existing order, payment, and settings models. Make the checkout clearer and faster for counter service, including on phones and tablets.

## Required checkout behavior

- Keep the payment area visible and usable every time this review step opens. Do not ask the user how they want to finish, and do not make payment entry conditional on choosing a separate “Record payment now” card or mode.
- Always allow **Finalize order**, whether no payment has been entered, a partial payment has been entered, or the order has been fully paid. A zero-payment order must finalize as **Unpaid**; partial collection as **Partially paid**; and collection of the full balance as **Paid**.
- Finalizing an unpaid order must not require a payment method, amount, transaction reference, or cash confirmation. The order remains available for payment later through the existing order workflow.
- Payment capture is optional at checkout. Make the distinction between **Finalize order** and **Record payment** clear so the app never implies money was received when no payment was recorded.
- Support every payment method configured in Settings. Show only fields relevant to the selected method.

## Make payment feel like a cash register

Present a compact, prominent payment panel with the amount due, payment method, amount being applied, and remaining balance. For cash payments:

- Show **Cash received** as the tendered amount and calculate **Change to return** immediately.
- Show the amount applied to the order separately from the cash tendered. Never apply more than the outstanding balance; excess tender is change, not extra sales or an overpayment.
- Include a one-tap **Exact amount** action and useful quick cash buttons based on the balance (for example, the exact amount and convenient next denominations). Keep the amount editable.
- Require a clear confirmation that cash was received and displayed change was returned before recording a cash payment. Do not require this confirmation merely to finalize an unpaid order.
- Allow partial cash collection. Calculate the balance remaining after the payment.

For non-cash methods, show the amount to apply and any relevant optional transaction/reference field. Do not show cash tender or change fields. Support partial and full payments consistently.

Use the configured currency and locale. Clearly label **Subtotal**, any discount or delivery fee, **Total**, **Already paid**, **Payment amount**, **Change** when applicable, and **Balance due**. Avoid duplicate or ambiguous amounts. If the order already has payments, show them and calculate the new balance from persisted payment records plus this checkout draft.

## Suggested layout and interaction

1. A clear **Review order** heading and compact order summary, including order type, customer/table or delivery details where applicable, ordered items with quantities, line totals, subtotal, fees/discounts, and total.
2. A visible **Payment** panel beneath the summary, defaulting to the first configured payment method or Cash when Cash is available. The user can leave the amount at zero to finalize unpaid.
3. A persistent bottom action area with **Back to order** and a prominent **Finalize order** button. Do not disable finalization because payment is empty, partial, or unpaid. Disable it only while saving or when actual required order data is invalid.
4. Make the final button’s helper text/status informative when relevant, such as “Save as unpaid,” “Save with partial payment,” or “Save as paid,” while keeping the primary action label stable as **Finalize order**.

Keep review data as an unsaved draft until finalization. After the user clicks **Finalize order**, persist the order and any explicitly entered payment together using the existing server-backed workflow. Use the existing transaction/atomicity patterns where available, prevent duplicate orders/payments on retry, and preserve the draft if saving fails. Show a clear success or error toast. On success, show the persisted receipt/order update with the final payment status and balance.

## Responsive and accessibility requirements

- On desktop, use a readable review column with the payment panel easy to scan and the actions anchored at the modal footer.
- On phone and tablet, use a single-column layout, large touch targets, readable labels, and a sticky action footer that does not cover fields or content. The modal must fit the viewport and allow its body to scroll independently.
- Ensure keyboard access, visible focus, semantic labels, and accessible status/error messaging. Avoid relying on color alone.
- Keep the familiar visual style but reduce unnecessary choice cards, nested scroll areas, and decorative clutter. Optimize for fast-paced order entry.

## Safety and regression checks

- Do not create a payment record for an empty payment draft or when the user finalizes unpaid.
- Never treat cash received as sales beyond the amount applied to the order; record the excess only as change returned.
- Keep order status and payment status independent.
- Preserve configured payment methods, all order types, discounts, delivery fees, receipts, rider collection flows, existing permissions, and later payment recording.
- Confirm the flow for unpaid, partial cash, exact cash, over-tender cash with change, non-cash full payment, non-cash partial payment, save failure/retry, and narrow mobile/tablet layouts.
- Do not clear, seed, settle, or otherwise alter existing live/test records as part of this UI change.

Implement the improvement in the existing app rather than producing a static mockup. Inspect the current checkout and related payment code first, then make the smallest coherent changes and report the files changed and the scenarios verified.
