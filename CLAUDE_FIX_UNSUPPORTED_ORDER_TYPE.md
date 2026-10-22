# Claude Code Prompt: Fix “Unsupported new-order type” Blocking Order Updates

Investigate and fix the shared Supabase error shown in the app: **“Unsupported new-order type.”** The error appears while updating an existing order, and previous tickets can no longer be updated.

## Likely cause to verify

Inspect the applied Supabase migration history and the live database function/trigger definitions. In this repository, migration `202610220004_dine_in_menu_images_and_order_display.sql` validates enabled order types as `pickup`, `delivery`, and `dine-in`; migration `202610220005_take_out_selector_first.sql` extends the allowed values to include `take-out`. Every shared workspace save, including an update to an older order, runs the settings validation trigger. If the database is still using the migration 004 function while workspace settings include `take-out`, the trigger rejects the entire save, even though the order being edited is an older Pickup or Delivery ticket.

Confirm whether migration 005 was applied to the configured Supabase project, and whether a later migration or deployment restored the older function. Do not assume the frontend is the only source of the failure.

## Required fix

- Reconcile local migrations with the target database migration history. Apply unapplied migrations in order; do not rerun or modify an already applied migration in place.
- Ensure the deployed `validate_new_order_display_settings` function accepts exactly the currently supported order types: `pickup`, `take-out`, `delivery`, and `dine-in`.
- Ensure supported types include valid settings when disabled; disabling a type must prevent new orders of that type, but must not make existing historical orders invalid or block unrelated edits to them.
- Review the trigger's new-order detection. Updating an existing order, changing its status, recording its payment, or updating unrelated business data must not be treated as creating a new order or rejected because that historical order type is currently disabled.
- Keep the separate order validation rules intact: only Delivery may have delivery fees/areas/rider assignment; Dine-in and Take-out must not acquire delivery-only data; valid status/payment authorization remains enforced.
- If the migration history says 005 was applied but the live function is stale or incorrect, add a new forward-only repair migration that reinstalls the correct function and trigger. Do not edit migration 004 or 005 after deployment.
- Preserve every existing order, payment, status history, ticket number, and total. Do not reset workspace data, delete tickets, or rewrite historical order types/totals to make the trigger pass.
- Improve the UI error handling only if useful, but do not hide the database failure or report a failed save as successful. After a server-confirmed retry, clear pending state and refresh the workspace revision safely.

## Verification

Use the configured local/test Supabase project if available. Otherwise, complete the forward migration and provide the exact deployment steps without claiming the live project is fixed. Verify:

1. Existing Pickup and Delivery tickets can be updated after `take-out` is enabled in settings.
2. New tickets of each enabled type save, and a disabled type cannot be used for a new ticket.
3. Disabling an order type does not prevent status or payment updates on historical orders of that type.
4. Invalid new order types and invalid delivery-only fields on non-delivery orders are still rejected.
5. A failed write remains visibly failed; a successful retry does not duplicate a payment or status-history entry.

At completion, report the confirmed root cause, the database migration state, the files changed, and whether the repair was applied to the live Supabase project. Do not claim live repair without confirming the target project accepted the migration and the affected order update succeeds.
