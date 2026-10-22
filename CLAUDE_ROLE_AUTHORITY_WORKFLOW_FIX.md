# Claude Code Prompt: Review and Fix Staff, Owner, and Rider Permissions

Review the existing Urban Casero app carefully and fix the role and order workflow so each employee can complete the work assigned to their role. Work in this repository and preserve existing data, features, sample data, and the current visual style. Do not replace the app with a new scaffold.

## Problem to investigate

The attached rider screenshot shows a delivery ticket with a **Mark Out for delivery** action, but the rider reports being unable to update the order status. The screen also shows a red **“A save is pending. Retry it before making another change.”** message after a customer payment was recorded. Diagnose the actual cause before changing behavior. Check the rider UI, role checks, state transitions, save queue/retry behavior, Supabase RPC or server functions, row-level security, and database error handling. Fix the underlying issue so an authorized status change is saved and confirmed reliably.

## First map the current permission system

Before implementation, inspect all places where permissions are defined or enforced, including:

- Role types and employee membership records.
- Navigation visibility and page access.
- Order detail actions and status transition controls.
- Order payment display and payment mutation controls.
- Client-side `can(...)` or equivalent checks.
- Supabase functions/RPCs, database policies, and server-side role checks.
- Pending save, retry, concurrency, and error handling.

Create one consistent permission policy and use it in the UI and on the server. Hiding a button is not authorization. Never trust a role, employee ID, order assignment, or payment receiver supplied by the browser without checking it against the authenticated user and business membership on the server.

## Recommended role authority

Use the following as the intended default matrix, adapting names to the existing app roles and retaining any stricter existing safety rules:

| Action | Owner | Kitchen staff / chef | Rider |
|---|---|---|---|
| View order ticket, items, notes needed for fulfillment, order type, order status, payment status, amount paid, balance, payment method, receiver, and reference | All business orders | All business orders | Only assigned delivery orders |
| Move an order from New to Preparing | Yes | Yes | No |
| Move an order from Preparing to Ready | Yes | Yes | No |
| Mark an eligible pickup order Picked up | Yes | Yes | No |
| Mark an assigned delivery order Picked up | Yes | Yes | Yes, for that rider's assigned delivery |
| Move an assigned delivery order from Picked up to Out for delivery | Yes | No | Yes, for that rider's assigned delivery |
| Complete an assigned delivery | Yes | No | Yes, for that rider's assigned delivery |
| Cancel an order | Yes | No, unless the current app explicitly permits cancellation before preparation; preserve and document a deliberate existing rule | No |
| Edit order contents, customer details, delivery fee, or assigned rider | Yes, subject to the app's lock after Out for delivery or Completed | No | No |
| Record customer payment for an assigned delivery | Yes | If allowed by current business workflow | Yes, only for own assigned delivery |
| Edit/delete/refund/correct a recorded payment | Yes through the existing owner workflow | No | No |
| Manage employees, accounts, roles, settings, payroll, and reports | Yes | No | No |
| View payment information | Yes | Yes | Yes for assigned orders |

Payment information is visible to every operational role with access to that ticket. Visibility does not grant permission to change payment records. Riders remain limited to assigned delivery tickets and the customer information needed to deliver the order.

## Enforce valid order transitions

- Use the app's existing order statuses and implement clear transition rules. The usual delivery path is **New → Preparing → Ready → Picked up → Out for delivery → Completed**. The pickup path ends at **Picked up** or follows the app's established pickup-completion rule; do not force delivery-only steps onto pickup orders.
- A rider may update only a delivery assigned to that rider. A rider cannot change another rider's ticket, an unassigned ticket, a pickup ticket, or a cancelled ticket.
- Kitchen staff and chefs can advance preparation and mark orders picked up, but cannot mark deliveries Out for delivery or Completed. Owner can perform authorized corrections and workflow transitions.
- Reject invalid, skipped, backward, duplicate, stale, or unauthorized transitions server-side. Return a clear user-facing reason instead of silently ignoring the request.
- Preserve the existing lock that prevents editing order contents once the order is Out for delivery or Completed.
- Record status timestamps/history only when a change is successfully committed. Do not show a new status as saved if the server rejected or failed the write.

## Make saves reliable on mobile

- Trace why a payment save leaves the app in a pending state and blocks another change. Ensure status changes and payment writes use the same robust save behavior without losing either change or falsely reporting success.
- Serialize or safely reconcile concurrent mutations for the same order. Use revision/version checks or idempotency keys where appropriate. A retry must not duplicate a payment or status-history entry.
- Keep the action clearly pending while saving, disable only conflicting actions for that ticket, and show a success confirmation when the server confirms the save.
- On failure, preserve the user's input and display a concise actionable error with a retry option. Retry must submit the original operation safely. Do not leave the UI permanently stuck in pending state.
- Support unreliable mobile connections and avoid requiring a full page refresh to see the confirmed status.

## Security and compatibility

- Apply the same permissions in client controls and trusted server/database operations. Verify business membership, active account state, authenticated employee identity, role, order type, assignment, current status, and allowed transition on every mutation.
- Keep database row-level security enabled. Do not expose service-role secrets to client code.
- Maintain owner access, existing staff accounts, sample/demo workspace isolation, and existing live data. Use additive migrations only when needed; never clear or overwrite business records.
- Keep payment details visible to kitchen staff, chefs, riders with assigned tickets, and owners as described above, while protecting payment mutation actions.
- Keep actions usable on mobile with touch-friendly controls, clear labels, and visible pending/success/error feedback.

## Verification

Run the repository's existing build and relevant tests. Add or update focused tests for authorization and transitions if the current test setup supports them. Verify at minimum:

1. Rider can mark their assigned delivery Picked up, Out for delivery, and Completed in sequence, and sees server-confirmed status updates.
2. Rider cannot update another rider's order, an unassigned order, a pickup ticket, or an invalid status transition, even by calling the backend directly.
3. Kitchen staff and chefs can update preparation statuses and mark orders picked up, but cannot mark delivery Out for delivery or Completed.
4. Owner can manage and correct orders according to existing rules.
5. All roles can see payment details for tickets they are allowed to view, while only authorized roles can record or modify payments.
6. A rider payment followed by a status change does not leave the order stuck in pending, lose either update, or create a duplicate payment/status event on retry.
7. Unauthorized or failed requests do not appear as successful in the UI, and the user receives a useful error.

At completion, report the root cause, the permission rules implemented, files/migrations changed, and the checks actually run. If the failure depends on production Supabase policies or configuration that cannot be inspected locally, identify the exact deployment step and do not claim the production issue is fixed until verified.
