# Shared backend and mobile implementation

## Data ownership

The app has two explicit modes. Demo mode keeps Sample and Live Local records in this browser. Shared mode uses Supabase Auth and the PostgreSQL migration in `supabase/migrations/202610120001_shared_operations.sql`. The browser holds an authenticated session and a cached view; PostgreSQL is the source of truth for confirmed writes. It never places a service-role key in the client.

Each business has its own membership and revisioned workspace document. Order, payment, attendance, payroll batch, and payroll work-date projections have business-scoped keys and uniqueness constraints. Writes take a row lock, require the revision read by the client, validate money and role-specific operations, rebuild relational projections in the same transaction, and store an idempotency request ID. A lost response can be retried with the same request ID. Concurrent changes return a conflict; the client reloads and asks the user to review before resubmitting. Polling refreshes other devices approximately every 12 seconds.

The JSON workspace preserves historic menu prices, delivery fees, attendance rate snapshots, payroll calculations, and source IDs. Only owners receive payroll, employee pay, and settings. Kitchen roles receive tickets; riders receive only assigned delivery tickets. Direct table access for anon/authenticated is revoked and RPC functions check authenticated membership. Staff ticket-status writes are rebuilt from the authoritative stored order, so filtered rider snapshots cannot overwrite private fields. Client-only Demo mode remains a preview, not an access boundary.

## Configure a Supabase project

1. Create a Supabase project and enable email/password authentication. Create the owner account in Authentication.
2. Back up the database and apply the SQL files in `supabase/migrations/` in numeric order. Existing projects should apply only migrations they have not yet run. The 20261022 migrations add staff accounts, rider session location, payment visibility, and the corrected role-aware ticket write/collection behavior; check that each completes without errors.
3. Copy `.env.example` to `.env.local` and set the project URL and publishable key. Never use a service-role key in a `VITE_` variable.
4. Deploy the `staff-accounts` Edge Function before testing staff account controls. Supabase injects `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_ANON_KEY` into hosted Edge Functions; do not add them manually in Vercel or try to create `SUPABASE_` secrets. Leave JWT verification enabled. Never use the service-role key in Vite/Vercel environment variables. The browser only uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
5. Start the app using `start-app.bat` or `pnpm dev`. Sign in as the owner, create or edit a non-owner employee profile, then use **Create login** on that employee card. Usernames are globally unique and use lowercase letters, digits, and underscores (4–32 characters, starting with a letter). The owner sees a generated temporary password once and gives it privately to the employee. At first sign-in, the employee must change it to a password of at least 12 characters with upper- and lowercase letters and a number. Owners can reset, disable, and re-enable access from the employee card. The optional contact email does not create a new login.
6. Set Supabase Authentication → URL Configuration Site URL and allowed redirect URLs to the app origin (for local testing, `http://localhost:5173`; for staff on other devices, the deployed HTTPS origin). After existing email accounts have been reviewed, disable new public email signups in Supabase Auth so staff cannot self-register. Keep existing linked email accounts until their owners confirm the replacement username works, then explicitly disable those legacy memberships. Configure database backups, TLS hosting, monitoring, and a restore drill before live use. Test cross-device permissions against the actual project before relying on it.

There are no Supabase project credentials in this repository, so the migration has not been applied to a live project here. SQL behavior and cross-device authorization require integration testing after configuration.

## Live Local migration

In Shared mode, the owner opens Settings → Import Live Local. The app downloads a JSON backup of the current browser's Live Local workspace first. After confirmation, the import RPC accepts it only while the target shared business has no menu, orders, attendance, or payroll batches. The server transaction rebuilds unique indexes; failed imports leave local records untouched. Save the downloaded backup and compare totals, ticket numbers, employee logs, batch rows, and receipt prices after import. An import retry with the same request ID returns the prior result. Imported data stays in browser storage as a separate local copy until the owner chooses to clear it.

## Mobile implementation and verification

The POS has a phone-sized Menu / Current ticket switch with a visible item count and total; the ticket footer remains reachable. Attendance changes to a scrollable day list below 600 px; each day opens the existing detail and shift form. Batch payment rows become cards. Existing tablet breakpoints keep the order board and forms responsive. Buttons in these flows target at least 44 CSS px where practical.

`pnpm build` passed with the bundled modern Node runtime on 2026-10-12. The local browser automation tool blocked this local URL under its security policy, so 320 px, 390 px, 768 px, and desktop visual walkthroughs could not be completed in this session. CSS/source checks do not replace those device tests. The Vite build reports a bundle-size advisory, not a build failure.

## Current limitations

The shared database uses one revisioned JSON document with indexed relational projections. Its single business-wide write lock favors correctness for a small team, but high write volume should move operations into narrower server transactions. Polling gives eventual screen refresh; it is not a push subscription. Logo uploads currently remain inline in the workspace document and should move to managed object storage before large image use. Demo local roles and records are separate from shared businesses.

## Employee account activation

The older email-invite flow remains in the database for existing linked staff, but the current UI does not offer staff self-registration. Do not delete existing Auth users or memberships during rollout. For each existing staff member, the owner should create a username account, verify sign-in and permissions with the employee, then explicitly disable the older email membership in Supabase if it is no longer needed. Both accounts can coexist temporarily; leaving both active grants both access. The employee profile's optional email is contact information and does not issue new credentials.

For an existing project, apply only migrations not previously run. The new username migration is additive. Test one new staff account and one existing email account before disabling public signup.

Staff snapshots include the business name, tagline, and logo. All authorized operational roles can see order payment status, amounts, methods, receiver, reference, and time. Riders receive only their assigned delivery tickets and enabled payment methods; internal order notes and line notes are removed from rider snapshots. Riders cannot see payroll, employee pay, or private settings.

## Rider collection and location

On first opening Orders after sign-in, a rider sees why location is requested and the browser permission prompt. Sharing can run before pickup and between assigned deliveries, and the rider can pause or resume it. A heartbeat lets the owner distinguish a signed-in paused rider from an offline rider. The database stores at most one current coordinate per rider and no location trail; sign-out deletes the row and pause clears coordinates. A `pg_cron` job expires abandoned rows after ten minutes, and the owner RPC clears stale coordinates as a second check. Browser background suspension can stop updates; the rider view explains this and resumes on return. Owner view lists active rider profiles with or without an assigned order and labels waiting, paused, stale, and offline states. The map embed uses OpenStreetMap when reachable, and the map-app link remains available without the embed.

Rider collection uses the `record_rider_collection` RPC. It locks the shared workspace, verifies authenticated rider membership, assigned delivery and eligible status, enabled method, amount against remaining balance, and an idempotency request ID. Riders may collect against their assigned delivery from Picked up through Completed. The payment is appended to the existing order ledger with receiver identity. All authorized staff can see payment details on the order; only owners can record corrections or refunds. Riders cannot edit ledger entries or issue refunds. Owner payments and refunds also record receiver metadata; older entries appear as unattributed in accounting.

Owners may manage valid ticket transitions. Chefs and kitchen staff may move tickets New → Preparing → Ready → Picked up, but cannot dispatch or complete deliveries. An assigned rider may move a delivery Ready → Picked up → Out for delivery → Completed. Each staff transition appends one status-history event and is validated against authenticated membership, role, and assignment in the database.

## Accounting definitions

The owner report uses confirmed shared workspace records (or explicitly labeled local demo records). Sales booked are non-cancelled order totals by order date. Payments are positive transactions by payment date; refunds are negative and shown separately. Rider collections are a subset of positive payments. Other collections include owner/staff and unattributed older payments. Outstanding is unpaid balance on all non-cancelled orders through the selected end date and is never added to cash received. The transaction CSV omits full addresses and notes, quotes fields, includes a UTF-8 BOM, and uses Philippine peso decimal amounts. Order cancellation state is the current state; historic as-of cancellation reconstruction is not available from the existing order snapshot.

## Deployment checklist and limits

1. Back up the database; apply any unapplied migrations in numeric order, including `202610220001_staff_rider_operations.sql`, `202610220002_rider_session_and_payment_visibility.sql`, and `202610220003_rider_pickup_status.sql`. The second enables `pg_cron`; the third fixes filtered-snapshot status writes, aligns server role transitions, and allows assigned riders to add a collection after delivery completion.
2. Deploy `supabase/functions/staff-accounts/index.ts` with JWT verification and the server-side Supabase secrets. Confirm that a non-owner JWT cannot call owner account actions.
3. Verify owner and old staff email sign-in, then a new username account and forced password change. Check disable/re-enable and profile deactivation.
4. Verify location permission, sharing before pickup and between deliveries, pause/resume, sign-out cleanup, stale/offline states, assigned ticket isolation, payment visibility by role, partial/full collections, overpayment rejection, duplicate request handling, and rider refund denial. Use a separate test business or reversible test tickets, not existing production orders.
5. Run `pnpm test` and `pnpm build`, then deploy the frontend through the existing GitHub/Vercel workflow. Vercel still needs only the two public Vite Supabase values.

No production migration, Edge Function deployment, or live-account integration has been performed by this code change. The migration can be rolled back after backing up its two operational tables by dropping the new functions/trigger/tables and restoring the previous `read_operations` and `apply_operations` definitions from the preceding migrations; do not drop existing Auth users or workspace data as part of rollback.
