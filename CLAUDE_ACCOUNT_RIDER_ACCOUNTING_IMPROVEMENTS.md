# Claude Code Prompt: Staff Accounts, Rider Operations, and Accounting Reports

Work in the existing Urban Casero food operations app in this repository. Implement the improvements below in the current application; do not replace it with a new scaffold. First inspect the current app, its Supabase setup, existing migrations, role permissions, order/payment model, and sample/live-local data behavior. Preserve existing features and sample demo data. Keep the live-local workspace clearly separate from shared production data.

## Goals

1. Let the owner create and manage staff sign-in credentials using usernames rather than requiring staff email addresses.
2. Let riders share their live location with the owner during active delivery work, with clear privacy controls.
3. Let riders record customer payments they physically collect for assigned deliveries.
4. Give the owner an accurate downloadable accounting CSV for sales and received payments, including money collected by riders.

Keep these workflows quick on phones and tablets. Use the app's current visual style and existing components where practical. Do not add an activity-log module or retain unnecessary location history.

## Authentication and staff accounts

- Keep owner sign-in with the owner's email and password.
- For non-owner employees, use a unique username and password created, reset, activated, or disabled by the owner. Staff must not be able to self-register or change roles/business membership.
- Treat an email address as optional recovery/contact information, not as the staff login identifier. Do not require a staff email to create an account.
- Use Supabase Auth and a trusted server-side Edge Function or equivalent server endpoint to create/manage staff accounts. Never put the Supabase service-role key in browser code or expose it to users.
- Normalize usernames consistently and enforce uniqueness. Scope usernames deliberately (globally unique login names, or an unambiguous business-qualified login flow); explain the choice in the UI.
- Do not store plaintext passwords. Validate password strength, rate-limit credential operations and sign-in attempts where supported, return generic sign-in errors, and avoid account enumeration.
- For owner-issued initial credentials, require a password change at first sign-in. Show the temporary password only at creation/reset time and tell the owner to pass it securely in person. Never email passwords.
- Preserve existing owner accounts, staff memberships, and linked employee records. Provide a safe migration path for existing staff who currently use email credentials; do not silently lock them out. Document any one-time owner action required.
- Enforce role and business membership on the server/database as well as in the UI. Staff account management is owner-only. A disabled employee must lose access promptly.

## Rider location sharing

- Make rider location available throughout the rider's signed-in session, including before pickup and between deliveries. Do not require an order to be picked up before location sharing can start. Ask for browser location permission when the rider signs in or first opens the rider view, explain why it is needed, and show a persistent sharing indicator and a clear last-updated time.
- Keep sharing on while the rider remains signed in and has granted location permission. Stop updates on sign-out or permission revocation. Provide a clear pause/stop control; if paused, show that state to the rider and owner. Explain that mobile browser background updates may stop when the app is closed, suspended, or the device restricts location access. Resume updates when the rider returns to the active app session.
- Let the owner see signed-in riders on a map when available and in a usable rider list on small screens, whether or not they currently have an assigned delivery. Show rider name, current assigned ticket when any, last update time, and a clear stale/offline or sharing-paused state. Allow opening a location in the device's map app.
- Store only the latest location per rider, with accuracy, timestamp, and optional active order reference. Do not build a location trail or retain historical coordinates. Minimize update frequency (for example, on meaningful movement or every 15–30 seconds while active).
- Enforce access with database row-level security or server-side checks: riders can update only their own location and owners can view only locations in their business. A rider must not be able to submit another employee's identity. Validate coordinates server-side and validate any active order reference against the rider's assignment.
- Make location sharing visible and limited to the signed-in work session. Remove or expire stale locations when the rider signs out, disables sharing, or is no longer active. Never imply continuous background tracking when the browser/device cannot provide it.

## Rider-collected customer payments

- Allow a rider to record a payment from the assigned delivery order when the customer hands payment to the rider. Make the action easy to reach from the rider's delivery ticket.
- Use only payment methods enabled in the business settings (Urban Casero currently uses cash, GCash, and bank transfer). Capture amount, method, time, optional reference, and the authenticated employee who received it.
- A rider may record only payments for their own assigned eligible delivery, and only up to the remaining balance. Validate this on the server/database in one atomic operation to prevent overpayment and duplicate submissions.
- Keep payments as an append-only transaction ledger. Do not let riders edit or delete payments or issue refunds. Owners retain the existing authorized correction/refund workflow.
- Show payment collection distinctly in the owner's order detail and payment views: amount received by rider, rider name, method, reference if entered, and time. Clearly show remaining balance and whether the customer still owes money. Do not mark an order fully paid until recorded valid payments cover its total.
- Payment information is not private between operational roles within the same business. Kitchen staff, chefs, riders, owners, and other authorized roles must be able to see each order's payment status and the payment details needed for operations, including amount paid/balance due, method, who received it, and reference when available. Do not hide payment status or details based only on role. Keep create, refund, correction, and account-management actions governed by their role permissions; visibility does not grant permission to modify payment records.
- Limit rider visibility to the rider's assigned delivery tickets and the minimum customer/order information needed to deliver and collect payment.

## Owner accounting report and CSV

- Add an owner-only report with a Today default and date-range filters. Use the business timezone (Asia/Manila) consistently for day boundaries, timestamps, and filenames.
- Distinguish these measures so they are not double-counted:
  - **Sales booked:** totals of eligible non-cancelled orders by order date, with cancelled orders excluded and discounts/delivery fees treated consistently with the receipt.
  - **Payments received:** actual payment transactions by payment time, including partial payments and refunds as negative amounts.
  - **Rider collections:** the subset of payments received by an authenticated rider, grouped by rider and payment method.
  - **Other collections:** payments received by owner or other authorized staff.
  - **Outstanding balance:** unpaid balance on orders, shown separately from cash received.
- Include a compact on-screen summary and a transaction-level CSV download. Include ticket number, order date, payment date/time, order type, delivery area when applicable, transaction type (sale/payment/refund), amount, method, receiver name/role, and optional reference. Exclude full delivery addresses and private order notes from the accounting export.
- If helpful, provide a separate daily summary CSV with booked sales, rider collections by rider/method, other collections, refunds, net collected, and outstanding balance. Label each measure clearly.
- Escape CSV values correctly, preserve Philippine peso decimal values, use UTF-8, and use descriptive filenames. Make it clear that this report shows recorded sales/collections and is not a profit report because food and other operating costs are not tracked here.
- Build report totals from persisted order and payment records, not UI state. Add database indexes or efficient queries for business/date/receiver filters as appropriate.

## Data safety and setup

- Use additive, reversible database migrations and appropriate indexes, constraints, and row-level security policies. Do not erase or rewrite current orders, attendance, payroll, employee, payment, demo, or live-local data.
- Keep sample/demo data isolated from real shared production data. Do not upload demo records during these changes.
- Add no new activity history module. Store only the operational records required for accounts, current rider location, and payment transactions.
- Update the existing setup documentation with required Supabase migrations, Edge Function deployment, environment secrets, and any owner setup steps. Keep all privileged secrets server-side.
- If production Supabase credentials or deployment access are not configured, complete the code and migration work, document the exact setup needed, and do not claim that production is live.

## Verification and acceptance criteria

Use the repository's existing build and test commands, adding focused tests only where they fit the existing setup. Verify:

1. Owner can create, reset, disable, and re-enable staff username accounts; staff can sign in without an email; initial password change is enforced.
2. Owner email sign-in and existing memberships still work; other business data remains isolated.
3. A signed-in rider can share location before pickup and between deliveries; the rider sees sharing, pause, permission, and last-update states. Owner sees signed-in riders with or without an assigned order and sees stale/offline locations clearly. Sign-out stops sharing, riders cannot access another rider's location or assigned orders, and no location trail is retained.
4. A rider can record a valid partial/full collection only on their assigned delivery, with configured methods; cannot over-collect, duplicate, edit, or refund it.
5. Owner order details show who collected each payment, and remaining balances update accurately.
6. CSV totals reconcile with persisted records across partial payments, refunds, cancellations, unpaid orders, multiple receivers, and Asia/Manila date boundaries. Sales and payments are not added together as if they were the same measure.
7. Authentication, location controls, delivery payment capture, owner map/list, and report are usable at phone and tablet widths with touch-friendly controls and no clipped content.

At the end, summarize implemented changes, migrations/functions to deploy, verification performed, and any production setup that remains. Do not claim a check passed unless you ran it.
