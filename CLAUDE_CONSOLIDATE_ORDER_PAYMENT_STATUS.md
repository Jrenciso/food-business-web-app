# Claude Code Prompt: Consolidate Payment Status in Order Details

Update the ticket details modal shown in the attached screenshot. The payment state is currently repeated in two places: in the **Payments · Paid** heading and again in the large **Fully paid** panel. Show the payment state once in a single, clear status banner immediately above the payment history.

## Required layout and behavior

- Replace the status-bearing **Payments · Paid** heading with a neutral **Payment history** heading.
- Add one compact status banner directly above the Payment history heading/list. Remove the separate lower **Fully paid** panel so the same payment state is not repeated.
- Use the existing lower banner’s clear, readable visual treatment for the consolidated status. Adapt its text and semantic styling to the actual payment state:
  - **Paid** — no balance due; optionally include collected/total amounts as concise supporting text.
  - **Partially paid** — show the remaining balance due and, where useful, amount collected.
  - **Unpaid** — show the full balance due.
- Derive the state and amounts from the authoritative order total and persisted payment records, using the app’s normal currency rounding rules. Do not infer paid status from order fulfillment status.
- Keep payment history entries, refund actions, order status/history, and all existing permissions and workflows intact. The banner is a summary; it must not replace or alter transaction records.
- Check for other payment-state labels in this modal. Avoid redundant payment-state indicators within the details content; retain other ticket metadata only where it serves a distinct purpose and does not create confusing duplication.

## Visual and responsive requirements

- Place the single status banner directly above Payment history so users see the current state before transaction entries.
- Keep the banner compact and consistent with the current design system. Use clear text and semantic color, but do not rely on color alone.
- Maintain sufficient contrast, readable typography, and spacing. Ensure the layout remains clear on desktop, tablet, and phone without clipping or creating unnecessary vertical space.

Inspect the existing order details and payment summary components first, and reuse the canonical payment-status calculation. Implement this in the actual application without changing backend schema, payment behavior, or existing records. Verify paid, partially paid, and unpaid examples, including refunds and a narrow mobile viewport. Report the files changed and scenarios checked.
