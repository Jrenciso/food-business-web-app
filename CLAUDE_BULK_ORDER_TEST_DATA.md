# Claude Code Prompt: Generate Bulk Order Test Data

Add a safe way to load a large, realistic set of test orders so I can evaluate the Orders board/list, filtering, details, receipts, dashboard, reports, and performance when many tickets and line items exist.

First inspect the current app's data model, order-type settings, valid status transitions, payment rules, menu, sample/live-local separation, and existing demo-data tools. Implement this in the existing app without replacing the project or changing real business data.

## Test data generator

- Add an owner-only control in the **Sample / Test** workspace, clearly labeled **Generate bulk test orders**. The control must never write to the Shared production workspace or a real business. If the app cannot reliably identify the Sample / Test workspace, do not expose the action there; instead add a safe developer-only fixture command and document how to run it.
- Let the owner choose a useful preset such as **50**, **100**, or **250** orders. Show a confirmation with the selected count and destination before generating.
- Generate realistic order records using the existing menu, pricing, enabled order types, payment methods, employee/rider assignments, order numbering, and schema. Avoid invented menu items unless a test explicitly requires an unknown item case.
- Include a balanced mix of enabled order types: Pickup, Take-out, Delivery, and Dine-in. If a type is disabled in settings, omit it or clearly ask to enable it in the test workspace; never bypass the actual validation rules.
- Include a varied distribution of valid order statuses, such as New, Preparing, Ready, Picked up, Out for delivery, Completed, and a small number of Cancelled tickets. Respect order-type-specific status rules and role workflow constraints; for example, do not assign delivery statuses to Pickup, Take-out, or Dine-in orders.
- Vary line counts and quantities across orders. Include single-item tickets, multi-item tickets, repeated items, popular items, different categories, notes, flavors/modifiers where supported, discounts, and delivery areas/fees for Delivery orders only.
- Include customer names and contact values that are clearly synthetic. Do not use real customer information. Delivery addresses should be obviously fictional test values.
- Include a realistic mix of payment conditions: unpaid, partially paid, and paid orders, with valid payment methods and references where appropriate. Keep totals, collected amounts, and remaining balances mathematically consistent. Do not generate impossible overpayments or paid cancelled orders unless the app explicitly supports and labels that case.
- Generate created dates across a configurable recent range (for example, the last 30 days) so date filters, daily/weekly reports, and sales trends can be exercised. Keep timestamps in the configured business timezone and produce valid chronological status histories and payment timestamps.
- Make generation deterministic where practical, with a user-provided or fixed seed, so the same fixture can be reproduced when debugging.

## Safe loading and cleanup

- Mark generated records with an explicit test-data marker supported by the current model, and use a recognizable ticket/customer label such as `TEST-`. Make it visually obvious in the UI that these are test tickets.
- Do not overwrite or delete existing Sample / Test orders when generating. Add an option to remove only records created by this generator, with a confirmation showing the number to remove. Never delete ordinary sample orders or records without the generator marker.
- Avoid duplicate ticket numbers, IDs, payment IDs, or status-history entries. Use the existing persistence and validation path; do not directly bypass business rules or write fake records into a production database.
- Show progress and the final number generated. Handle storage limits, save failures, and partial generation safely. If a batch fails, either roll it back or report exactly which records were saved, without leaving the app in an ambiguous state.
- Make it clear that the generated records are disposable test data and excluded from real production accounting. Preserve the user's existing business and demo records.

## Bulk-view and performance goals

- Verify the Orders board and list with at least 250 tickets and a high total count of line items. Keep search, order-type/status filters, sorting, opening details, and payment/status badges usable.
- Avoid rendering an unnecessarily huge DOM at once. Use pagination, virtualization, or a reasonable incremental loading approach if current rendering becomes slow, while preserving search/filter behavior and showing total result counts.
- Keep the new generator usable on desktop, tablet, and mobile. The order list/cards must remain readable with dense data and must not overflow the viewport.
- Ensure Dashboard and Reports totals include test data only when viewing the Sample / Test workspace, and are unaffected in Shared production mode.

## Verification

Use the repository's existing build and test setup. Verify:

1. Each preset creates the expected number of clearly marked test orders in Sample / Test only.
2. The dataset includes varied order types, valid status distributions, different menu items and line counts, date ranges, and payment states.
3. Order totals reconcile with line prices, discounts, delivery fees, and payments.
4. Existing sample data is preserved, and cleanup removes only generated fixture records.
5. No test records appear in Shared production mode or affect real business totals.
6. Orders remain searchable/filterable and the board/list remain usable with 250 orders on desktop, tablet, and mobile.
7. Generation failure does not leave duplicate IDs/ticket numbers or an unexplained partial dataset.

At completion, summarize the generator location, presets and data coverage, cleanup behavior, checks actually run, and any limits. Do not claim production data was tested unless a configured production-like test business was used safely.
