# Claude Code Prompt: Make the Refund Form Collapsible

Refine the refund area in the order details modal shown in the attached screenshot. The refund form currently takes up space even when no refund is being recorded. Keep it collapsed by default and reveal the form only when the user chooses to record a refund.

## Expected behavior

- Keep payment history and the current payment state visible as they are now.
- Replace the always-open refund form with a simple, clearly labeled **Record a refund** row or button. It should be visually secondary to the order and payment details, but easy to find.
- When clicked, expand a compact refund section containing the refund amount, optional remarks/reason/reference, and **Record refund** action.
- Clicking the trigger again, or a clear **Cancel** action inside the expanded section, should collapse it without recording a refund. If the user has entered values, confirm before discarding them or preserve them when collapsing, following the app’s existing patterns.
- Keep refund amount validation, refund limits, permissions, and persistence rules unchanged. Do not permit a refund above the refundable amount or record a refund until the user explicitly submits it.
- Make the expanded form work for partially paid and fully paid orders according to existing refund rules. Hiding the refund form by default must not hide payment history or the fully-paid confirmation.
- After a successful refund, refresh the displayed payment/refund totals and history, then return the refund area to its collapsed state. On failure, keep the form open with its entered values and show a clear error.

## Layout and accessibility

- Use a compact row with a clear label and an expand/collapse affordance. Expose the expanded state to assistive technology, such as with `aria-expanded` and a correctly associated region.
- When expanded, keep the amount and remarks fields readable and well-spaced; allow remarks to use a multiline field with adequate width.
- Ensure the section is responsive on phones, tablets, and desktop, with touch-friendly controls and no modal overflow or clipped fields.
- Match the existing application styling and avoid changing unrelated order, payment, or status workflows.

Inspect the current order-details and refund components first, then implement the change in the real application. Verify collapsed-by-default behavior, expansion and cancellation, valid and invalid refunds, successful submission, and mobile/tablet layout. Report the files changed and scenarios checked.
