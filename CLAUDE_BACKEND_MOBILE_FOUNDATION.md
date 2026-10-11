# Claude Code prompt: establish the backend and make operations mobile-ready

Open the existing Food Business Web App project in Claude Code and paste this prompt. The current app has important operations workflows and sample/test records. Upgrade its foundation without discarding those records, and verify the actual app at phone and tablet viewport sizes.

---

You are the senior full-stack engineer responsible for taking this existing food-business operations app from browser-local demo toward a reliable shared application. Start by inspecting the repository, existing frontend, data types, persistence/storage, authentication, workspace separation, package scripts, and prior project instructions. Then implement a sound backend foundation that fits this project. Do not replace working screens with a scaffold, stop at an architecture proposal, or claim the app is production-ready if required configuration is still missing.

The business runs a fast-paced home-based pickup/delivery operation. Owners and staff use phones and tablets most of the time. Order entry, ticket updates, attendance, payroll, and payment recording must stay quick and reliable on touchscreens.

## 1. Backend architecture and shared persistence

- Replace browser-only Live Local business data as the source of truth with a real shared backend/database so the owner and authorized staff see the same current menu, orders, payments, attendance, and payroll records across devices.
- Reuse an existing configured backend if present. If none exists, choose a well-supported, small-business-appropriate backend compatible with the current stack and implement the schema, migrations/setup, data access, and local development instructions. Prefer a managed relational database with authentication and file storage when the project has no existing server; do not hard-code provider secrets or invent credentials.
- Keep frontend components out of direct database-specific code. Use a clear data access/service layer and typed models so records can be validated and business calculations remain consistent.
- Use server-side authorization for every read/write. Hiding a button in the UI is not access control. Enforce owner/kitchen staff/chef/rider permissions in server/API policies. Scope all business data to its business/workspace so one business cannot read another business's records.
- Make customer orders, payments, employee attendance, payroll registers, and payroll payment updates durable and shared. Use database transactions for operations that must succeed together, such as placing an order with its lines/fee snapshots, applying a payroll register to included work logs, and updating a batch's payment statuses.
- Add validation constraints and indexes for the common lookups: workspace, order number/status/date, attendance employee/date, payroll period/status, and payment records. Prevent duplicate attendance records for an employee/date and prevent the same employee work date from being processed in more than one finalized payroll register.
- Use stable IDs and created/updated timestamps. Do not add a separate Activity Log module or store extra event history; the owner explicitly does not want it. Keep only operational records needed by the app.
- Store money as integer centavos or a precise decimal type. Keep order/payment and payroll calculations in shared business logic; never trust client-calculated totals without server validation.
- Use Asia/Manila business dates for daily orders, attendance, payroll period boundaries, and reports. Store timestamps consistently in UTC and convert for display/grouping.

## 2. Core data and workflow integrity

Inspect the current models and retain the useful structure. Ensure backend entities/relationships support at least:

- Business/workspace profile and settings, including branding, delivery areas/fees, payment methods, work shifts, and payroll schedule.
- Users/memberships with roles and active status.
- Menu categories/items and any item modifiers/flavor selections.
- Orders with immutable placed line-item name/price snapshots, delivery area/fee snapshots, order type, fulfillment status, customer details, and notes.
- Payment entries linked to orders, preserving method/reference and amount; payment state remains separate from fulfillment status.
- Employees, effective-dated pay rates, attendance records with chosen shift label and time snapshots, state/notes, and correction data already used by the app.
- Finalized payroll register/batch and per-employee calculations/adjustments/payment state, with included attendance work dates protected against duplicate processing.

Maintain the existing simple user workflows: POS order entry; orders and pickup/delivery status; attendance calendar/day details with shift selection; and payroll time logs → adjustments → register → payment tracking. Do not redesign core workflow into a more complex enterprise product while changing storage.

For operations affected by network interruptions:

- Show loading/saving/error states and keep the user informed if a save has not reached the server.
- Prevent accidental duplicate orders or payments on retries (use idempotency keys or equivalent where appropriate).
- Do not show success until the server confirms the write. Do not silently overwrite newer server data with stale local edits.
- If full offline support is out of scope, clearly show connection errors and retain unsaved form input so the user can retry safely.

## 3. Authentication, roles, and deployment configuration

- Use real authentication supported by the chosen backend. Implement sign-in, session handling, sign-out, and protected routes. Never store plain-text passwords or secrets in frontend code/local storage.
- Enforce roles on server/backend rules: owner has full business access; kitchen staff/chef can view and update allowed kitchen/order states; rider can access assigned delivery orders and allowed delivery states. Keep payroll, employee pay, and business settings owner-only.
- Document how to create/invite users and assign roles. A demo role switcher may remain only in the clearly isolated demo workspace, never as a substitute for production authentication.
- Add `.env.example` with names of needed variables and safe placeholders. Ensure real `.env` secrets are gitignored and not printed in logs.
- Provide database migrations/schema and safe setup commands. Explain required external project credentials, redirect URLs, storage buckets/policies, migrations, and deployment configuration. If credentials are unavailable in this environment, complete all code/schema/configuration possible and state precisely which user setup is still required; do not fake a connection.
- Include a backup/export and recovery plan for operational data. Add a practical owner data export (CSV/JSON where suitable) or document the provider backup method. Never reset or migrate real data destructively without a backup and explicit confirmation.

## 4. Demo and existing data migration

- Preserve current Demo/Sample data and label it clearly. Keep Demo workspace isolated from live business data.
- Preserve Live Local data during migration. Before migrating, create an export/backup. Provide a one-time import/migration path to move existing local business records into the backend with stable IDs and correct relationships. Make it idempotent so retrying does not duplicate orders, attendance, or payroll.
- Do not seed demo records into the live business workspace. Allow new live workspaces to start empty with onboarding/setup guidance.
- Preserve historical order price/payment snapshots, employee rate snapshots, and finalized payroll values. If migration reveals inconsistent or invalid records, report them and handle safely rather than silently dropping them.

## 5. Phone and tablet responsive design

Review the existing interface page by page and implement a touch-first responsive experience for common phone widths (320–430 CSS px) and tablet widths (768–1024 CSS px), in portrait and landscape where relevant.

### General

- Remove unintended horizontal overflow, clipped labels, inaccessible controls, tiny text, and buttons too close together. Use readable mobile type and touch targets around 44 CSS px where practical.
- Rework navigation for small screens with a compact header and accessible menu/bottom navigation. Keep the current selected page, business identity, role, and connection/save state easy to see.
- Keep important primary actions reachable without excessive scrolling. Use responsive cards or carefully designed horizontal tables for dense information.
- Modals should fit the screen, scroll internally when necessary, keep action buttons visible, support keyboard focus, and not open behind the on-screen keyboard.
- Check large logo images, menu tile images, receipt/payslip export previews, and calendar cells at different aspect ratios. Preserve aspect ratio and avoid cropping.

### Fast-paced operations

- **New Order/POS:** Make category selection, search, item tiles, cart, delivery area, customer fields, totals, and Place Order easy on a phone/tablet. On phones, present menu and cart as clear tabs/drawer or a compact stacked flow; never hide the cart total or primary action. On tablets, use an efficient split view. Keep item buttons large enough to tap quickly.
- **Orders/tickets:** Ensure status/payment/order-type badges and urgent actions are readable without card overflow. Provide a fast detail view and status controls; avoid requiring precision taps on tiny icons.
- **Attendance:** Keep the month calendar useful on mobile (adapt to an agenda/week/list mode if a full 7-column month cannot remain legible). Day selection and shift dropdown must work with touch and mobile keyboard. Employee log tiles/history should fit narrow widths.
- **Payroll:** Make period selection, employee inclusion, adjustment entry, payroll register, payment status, and payslip view usable at phone/tablet widths. On phones, convert the register to employee cards showing name and net pay with expandable pay breakdown; keep totals and Save/Proceed actions visible. Do not require horizontal scrolling for the most important amount/status.
- **Settings/menu/employees:** Keep forms single-column on phones, with save actions visible and category/item controls easy to tap.

## 6. Responsive verification is required

Use the existing test/browser setup when available, or add only the minimum tooling needed for the requested responsive verification. Run the app and inspect it at these viewport sizes at minimum:

- Phone portrait: 390 × 844 and narrow phone: 320 × 700.
- Tablet portrait: 768 × 1024.
- Tablet landscape: 1024 × 768.
- Desktop reference: 1440 × 900.

Verify the actual screens and flows, not only CSS breakpoints. Capture or inspect each main page at phone and tablet sizes. Fix visible layout and usability issues found before finishing.

Walk through these interactions at phone and tablet sizes:

1. Sign in and navigate between pages.
2. Create a pickup order, add/change items, and place it.
3. Create a delivery order, select a delivery area, verify fee/total, and place it.
4. Open order details, update a permitted status, and record a payment.
5. Open Attendance, navigate/select a day, choose a shift for an employee, and save.
6. Select a payroll period and employees, add an adjustment, review/save a register, open a payslip, and update payment tracking.
7. Open Settings and edit a business/payment/shift setting, then verify the saved state.

Check touch target reachability, no clipped critical content, no unintended horizontal page scrolling, validation/error feedback, and that network saves are visibly confirmed. Fix issues and rerun the walkthrough.

## 7. Completion requirements

- Update README with architecture, schema/migration steps, environment variables, local development, deployment, backup/recovery, user/role setup, and known limitations.
- Add a concise `docs/backend-and-mobile.md` (or equivalent) with data ownership, workspace isolation, migration, security rules, and mobile/tablet verification results.
- Do not claim production readiness until authentication, backend configuration, database policies, and deployment requirements have actually been configured and verified.
- In your final summary, state the backend provider/architecture selected, migrations implemented, records preserved/migrated, mobile/tablet viewport results, checks run, exact remaining external setup, and the local URL/start command.

---

Use the existing `start-app.bat` to run the app after the backend and responsive changes are complete.
