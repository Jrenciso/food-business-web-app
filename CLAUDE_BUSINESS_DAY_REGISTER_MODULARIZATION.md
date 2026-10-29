# Claude Code Prompt: Business Day, Cash Register, Payments, and Configurable Modules

Implement the next substantial improvement to the existing Urban Casero operations app. Make the actual discussed workflow appear in the app, in the app's established friendly visual style. Keep the application easy to use at fast pace and excellent on phones and tablets. First inspect the current architecture, role permissions, Supabase schema/RPCs, order/payment models, workspace modes, reports, navigation, and existing tests. Extend the working app; do not replace it with a scaffold or weaken existing order, payment, payroll, or security behavior.

This work has four related parts:

1. Prepare the existing test order set as completed and paid using clearly marked mock/test settlements.
2. Add business-day opening/closing and register cash reconciliation.
3. Make payment entry change its fields based on payment method, including tender and change for cash.
4. Let each business enable/disable optional modules without losing data or blocking the remaining workflows.

## A. Protect data and prepare existing test orders first

The user has described the current order data as test/mock data. Still verify the actual selected workspace before writing anything.

- Begin with a read-only preflight showing the exact workspace/business, order count by status and order type, unpaid balances, existing payments, date range, and whether records are explicitly marked test/sample.
- Export a timestamped backup of the target dataset before mutation. Implement the cleanup as a deterministic, idempotent migration/seed script or an owner-confirmed tool, not a hidden page-load side effect.
- Only settle records in the explicitly designated test workspace (Sample/Test or Live Local test fixture). Never write synthetic payments into a real production business or an unmarked Shared workspace. If the selected Shared business contains unmarked or mixed records, stop before mutation and provide the preview/backup information so the owner can choose a clearly marked test business.
- For each non-cancelled mock/test order, append a clearly labeled synthetic payment only for its remaining balance, using a configured payment method. Use an explicit `is_test`/`testData` marker and a recognizable reference such as `MOCK-SETTLEMENT-<ticket>`; never represent it as a verified real receipt. Do not duplicate a mock settlement when the script is rerun.
- Use existing immutable payment records as they are. Do not overwrite, delete, or alter historic payment entries. Keep cancelled orders cancelled and do not add payments to them. Do not change historical totals, customer details, item lines, creation timestamps, or ticket numbers.
- Set non-cancelled mock/test orders to Completed through valid status-history progression. Preserve all earlier history and append any missing valid transitions with chronological timestamps; do not rewrite the order creation time. Do not alter cancelled order status.
- Synthetic cash settlements must be labeled test data and excluded from real-business accounting totals by default. In the test workspace, allow a clearly labeled option to include them for QA.
- Do not invent a physical cash count or claim actual cash was counted. For mock close records, label any generated drawer counts as simulated test values, or leave counted cash unset and show the report as not physically reconciled.
- After this preparation, display a concise before/after summary and preserve the backup path. The app should remain usable if no test rows exist.

## B. Add business opening, stopping new orders, and closing

Keep business operating state separate from order status and payment status. Add a simple **Register / Business day** workflow with these states:

- **Closed**: no new tickets can be placed.
- **Accepting orders**: an open business day and, if register tracking is enabled, an open register session.
- **Not accepting new orders**: staff cannot create new tickets, but can fulfill, update, and collect payments for existing tickets.
- **Closing review**: owner reviews sales, money movements, register cash, rider-held cash, and open tickets.
- **Closed for the day**: a saved close report/snapshot exists; existing tickets remain available for allowed status/payment actions.

### Opening

- Owner opens the business day, recording business date, timezone-aware opening timestamp, and authenticated actor. Use the configured business timezone (Asia/Manila by default), with a configurable business-day cutoff for operations that pass midnight.
- When Register is enabled, start a register session for the default register/location. Opening float is optional; allow it to be zero or omitted where the business has no physical drawer.
- Make role permissions explicit: owner can open/stop/close by default; allow settings to grant those actions to specified operational roles if needed. Attendance is still recorded separately; opening must not mark employees present or clock them in.

### Stopping orders and closing

- Provide **Stop new orders** separately from **Close business day**. Stopping new tickets must not disable the Orders module or prevent fulfillment and authorized payment collection on existing orders.
- At close, show a concise review: sales booked by order type, item totals, payment collections by method/receiver, refunds, discounts, unpaid balances, register expected/count cash and variance, cash movements, rider cash still held, and unfinished tickets.
- List unfinished orders for review. Let the owner confirm carry-forward. Never automatically mark them Completed, Paid, Cancelled, or refunded. Carried-forward orders retain their original order date and current status.
- Do not silently change historical close reports. Save a close snapshot with business date, totals, actor, and timestamps. Reopening or correcting a closed day is owner-only, requires a reason, preserves the original snapshot, and creates a new revision/correction record.
- If a server write or payment is still pending, do not allow final close to appear successful. Wait for server confirmation or show a clear retry/error state.

## C. Payment entry varies by payment method

Payment entry begins with choosing an enabled payment method. Only after that selection should the form show fields relevant to that method.

### Cash payment

- Show remaining balance and a **Cash received** field, defaulted to the exact balance for quick operation. Provide useful tender shortcuts if practical.
- Calculate and display **Payment applied**, **Change to return**, and **Balance after payment** before confirmation.
- If tendered cash is less than or equal to the balance, apply the tendered amount and leave any remainder unpaid. If tendered cash exceeds the remaining balance, apply only the balance and calculate the excess as change. Do not record the excess as an overpayment or unconfigured tip.
- Require an explicit confirmation that the recipient received the cash and returned the displayed change. Save tendered amount and change amount on the transaction. Count net cash exactly once in the register: tender minus change. Never add tender, applied payment, and change as separate positive inflows.
- For rider-collected cash, record the rider as receiver and keep the net amount in rider custody until a separate handover is recorded. Rider cash and register cash are separate custody balances.

### GCash, bank transfer, and other enabled non-cash methods

- Show the amount actually received/applied, plus an optional transaction/reference field where appropriate.
- Do not show Cash received, change, cash drawer, or change-confirmation fields for non-cash methods.
- Clearly label a payment as recorded by the user; do not imply that the app independently verified a bank or e-wallet transfer.

### Payment integrity

- Persist payment method, applied amount, optional cash tender/change, reference, received timestamp, authenticated receiver, business, location/custody, and register session when applicable.
- Preserve existing payment rows. Add new nullable columns or compatible metadata for tender/change; historical rows without those values remain valid and display as **Not recorded** for tender/change.
- Use integer centavos, server-side remaining-balance validation, role/assignment checks, row locking or atomic RPC behavior, and idempotency keys. Reject overpayment, duplicate retry, unauthorized receiver, and disabled payment method server-side.
- Corrections/refunds append reversal transactions; do not silently edit or delete a recorded payment.

## D. Cash inflows, outflows, and custody reconciliation

Provide a quick, understandable movement form with **Cash in**, **Cash out**, **Transfer**, and **Rider handover**. Use categories and descriptions; do not put every movement under sales.

- Cash customer payments flow into the register automatically from the payment ledger; users must not re-enter them as manual cash-in.
- Cash expenses/payouts reduce register cash and capture a category, amount, actor, time, and optional note/receipt.
- Cash deposits/transfers out reduce register cash but are not expenses. Transfers between owner/register/safe/rider custody accounts change custody, not sales or total business funds.
- Track money actually collected by rider separately from register cash. A rider handover transfers custody; do not count it as a second customer payment.
- Expected register cash formula: opening float + register cash payments net of change + cash transfers in − cash refunds paid − cash expenses/payouts − deposits/transfers out.
- Expected rider cash: rider cash collections net of change − recorded cash handovers. Show per rider and aggregate outstanding custody.
- At session close, capture actual counted amount; show over/short variance. Require an explanation or owner approval over a configurable threshold. Non-cash collections are reported separately and excluded from physical drawer count.
- Connect payroll cash payouts or other expenses to a movement only once; do not double-count a payroll cost and a cash movement as two expenses.

## E. Daily reporting and historical orders

- Keep all previous business-day tickets available in Orders with date filters/history. A new day never deletes, hides permanently, or resets previous orders.
- Distinguish **Sales booked** by order business date from **Payments received** by transaction timestamp. A payment received today for yesterday's order appears in today's collections and stays linked to yesterday's order.
- Keep unpaid balance separate from cash received. Keep completed orders with outstanding balances visible and reportable if the business permits follow-up collection.
- Daily close report should include sales by order type and category/item, discounts, refunds, payment method totals, receiver totals, register cash expected/count/variance, rider-held cash and handovers, outflows by category, unfinished/carryover tickets, and outstanding balances.
- Do not label sales minus recorded expenses as profit unless all cost categories are complete; identify report as operational cash/sales summary.
- Support on-screen review and CSV export with timezone-safe business dates, UTF-8, correct quoting, and clearly labeled test data. Mock settlements are excluded from real business totals by default.

## F. Business-configurable modules without broken workflows

Create a centralized module catalog and per-business enablement configuration. Do not scatter ad hoc feature flags through components. Separate module availability from role authorization: a module can be enabled for the business while only selected roles can use specific actions.

### Module behavior

- The owner can enable/disable optional modules in Settings. Changes persist per business and sync through the backend.
- When disabled, hide that module's navigation, dashboard cards, routes, page content, and notifications; direct-route access must show a friendly unavailable message/redirect rather than an error or dead end.
- Disabling a module must never delete its data. Re-enabling it restores the saved records and settings.
- Show dependencies before disabling a module. Prevent incompatible combinations or offer a clear fallback workflow so the remaining app keeps working.
- Keep business-specific module configuration separate from subscription billing/plan enforcement. Do not build a pricing/subscription system unless it already exists and is in scope.

### Recommended module groups and dependency rules

- **Core POS bundle:** New Order, Orders, Menu, and Settings needed for the configured order-taking workflow. Do not let an owner disable a dependency while leaving a broken route behind. If choosing to hide one of these, offer a supported replacement and explain the consequence.
- **Dashboard:** optional overview. Disabling it must not affect underlying data or other modules.
- **Register / Business day:** optional cash reconciliation module. If disabled, keep order taking, order status, and payment recording available; hide register sessions, float/count, cash movement, and closeout controls. Do not block the remaining operation with a required day-opening step. Show a clear neutral note that register reconciliation is turned off.
- **Attendance:** optional. If disabled, hide attendance screens and actions but retain employee identity and sign-in records required by Orders and role permissions.
- **Payroll:** optional and may work with Attendance enabled or disabled. With Attendance disabled, offer a simple manual payroll-period input or clearly explain the configured basis; never create a dead-end dependency. With Payroll disabled, Attendance can still run independently.
- **Employees / staff access:** keep identity, role, active state, and sign-in access that core operation requires. Optional HR/pay detail subfeatures can be hidden separately. Disabling an employee management screen must not delete accounts or prevent existing authorized staff from signing in.
- **Reports:** optional. If disabled, hide advanced report pages/exports but keep the essential close summary inside Register when Register is enabled. Re-enabling Reports restores access to historical data.
- **Rider tracking:** optional. Disabling it stops/hides location sharing and map displays without removing order assignment or the rider's delivery status/payment workflow.

### Settings and enforcement

- Add a clear module settings screen with module name, short purpose, enabled switch, affected workflow/dependencies, and a confirmation before disabling a module that is in active use.
- Define safe defaults that preserve the current app experience for existing businesses. Do not unexpectedly turn off current modules after migration.
- Validate module combinations on save and on the backend. Authorization checks must be enforced in server-side RPCs/Edge Functions as well as navigation/UI.
- Keep module visibility and role permissions separate in data models. A role with permission cannot access a disabled module; enabling a module does not automatically give every role permission to every action.
- Preserve data, migrations, demo/live-local separation, and auditability when changing module configuration.

## G. Enterprise-ready data and security foundation

Prepare a clean foundation without trying to build every enterprise feature now:

- Model the future hierarchy as Business → Location → Register → Register session, while defaulting existing businesses to one location and one register.
- Associate orders, payments, cash movements, rider handovers, and close reports with business/date and relevant location/session/custodian.
- Use additive migrations, business-scoped row-level security, server-side authorization, indexes for date/status/session reports, and request idempotency. Keep secrets server-side.
- Store financial events as append-only records with correction/reversal entries. Keep a small critical financial/close correction history, not a general click-by-click activity log.
- Maintain one source of truth for each payment/movement; don't calculate totals from duplicated UI snapshots.
- Preserve current sample/test data in the chosen test workspace and never mix it into production reports.

## H. Mobile and fast-paced operation

- Design the workflow mobile-first for phones and tablets: large touch controls, clear totals, one-screen cash entry where practical, readable status, pinned primary actions, and accessible field labels.
- Close review should be scannable with summaries first and expandable details for tickets/movements. Avoid forcing the owner to read raw tables to complete the close.
- Show pending/saved/error states clearly. Never show a completed close or payment until the server confirms it.
- At narrow widths, present register and close reports as compact cards/sections instead of wide tables. Keep CSV export available without harming the mobile layout.

## I. Verification and delivery

Use the repository's existing test/build commands and add focused coverage where appropriate. Verify:

1. Preflight identifies the correct test workspace and a backup exists before synthetic settlement; rerunning does not duplicate mock payments.
2. Active non-cancelled test orders become Completed and fully paid with clearly marked mock settlements; cancelled tickets stay cancelled; totals/history remain intact.
3. No synthetic payment is written to a real or mixed Shared business; mock payments are excluded from real-accounting totals by default.
4. Owner can open the business/register, stop new orders, review, carry forward pending tickets, and close. Closing never changes order/payment status automatically.
5. Cash entry shows tender, calculated change, and applied amount; partial tender works; drawer totals count net cash once. Non-cash methods show no change fields.
6. Rider collections remain in rider custody until handover; register cash and rider cash reconcile separately; transfers are not sales or expenses.
7. Prior tickets remain available across business days; late payments report on payment date and remain linked to their original ticket.
8. Closed-period corrections are permission-checked and preserve the prior close snapshot.
9. Modules can be disabled/re-enabled without data loss; route/navigation/dashboard behavior is correct; dependency fallbacks prevent blocked workflows.
10. Register disabled still permits the enabled order and payment flow; Attendance and Payroll combinations do not create dead ends; Reports disabled leaves the essential register close summary available.
11. Role and module permissions are enforced by backend calls, not only hidden UI controls.
12. Mobile/tablet workflows work at phone and tablet widths with no clipped fields, inaccessible actions, or false saved states.

Run checks and report only the checks actually performed. At completion, summarize the implementation, module dependency decisions, migration/deployment steps, data backup and test-settlement results, and anything that remains unverified in production. Do not claim the live Supabase backend is updated unless migrations/functions were applied to and verified against the correct project.
