# Shared backend and mobile implementation

## Data ownership

The app has two explicit modes. Demo mode keeps Sample and Live Local records in this browser. Shared mode uses Supabase Auth and the PostgreSQL migration in `supabase/migrations/202610120001_shared_operations.sql`. The browser holds an authenticated session and a cached view; PostgreSQL is the source of truth for confirmed writes. It never places a service-role key in the client.

Each business has its own membership and revisioned workspace document. Order, payment, attendance, payroll batch, and payroll work-date projections have business-scoped keys and uniqueness constraints. Writes take a row lock, require the revision read by the client, validate money and role-specific operations, rebuild relational projections in the same transaction, and store an idempotency request ID. A lost response can be retried with the same request ID. Concurrent changes return a conflict; the client reloads and asks the user to review before resubmitting. Polling refreshes other devices approximately every 12 seconds.

The JSON workspace preserves historic menu prices, delivery fees, attendance rate snapshots, payroll calculations, and source IDs. Only owners receive payroll, employee pay, and settings. Kitchen roles receive tickets; riders receive only assigned delivery tickets. Direct table access for anon/authenticated is revoked and RPC functions check membership. Client-only Demo mode remains a preview, not an access boundary.

## Configure a Supabase project

1. Create a Supabase project and enable email/password authentication. Create the owner account in Authentication.
2. Apply the SQL files in `supabase/migrations/` in numeric order: `202610120001_shared_operations.sql`, `202610120002_employee_access.sql`, then `202610120003_staff_branding.sql`. Check that each completes without errors. Existing projects should apply only migrations they have not yet run.
3. Copy `.env.example` to `.env.local` and set the project URL and publishable key. Never use a service-role key in a `VITE_` variable.
4. Start the app using `start-app.bat` or `npm run dev`. Sign in, create a business, then add menu, delivery areas, employee records, and roles. For staff access, the owner creates or edits an employee in Employees and sets the role and app access email. The employee chooses Create account on the shared sign-in screen, signs up using that exact email, confirms the message from Supabase, then signs in. Access is granted by a database trigger only after email confirmation. Existing confirmed accounts link immediately. Rider accounts must use their assigned employee records.
5. Set Supabase Authentication → URL Configuration Site URL and allowed redirect URLs to the app origin (for local testing, `http://localhost:5173`; for staff on other devices, the deployed HTTPS origin). Keep email confirmations enabled and configure a production SMTP provider before live staff onboarding. Configure database backups, TLS hosting, email/account recovery, monitoring, and a restore drill before live use. Test the SQL permissions and a multi-device workflow against the actual project before relying on it.

There are no Supabase project credentials in this repository, so the migration has not been applied to a live project here. SQL behavior and cross-device authorization require integration testing after configuration.

## Live Local migration

In Shared mode, the owner opens Settings → Import Live Local. The app downloads a JSON backup of the current browser's Live Local workspace first. After confirmation, the import RPC accepts it only while the target shared business has no menu, orders, attendance, or payroll batches. The server transaction rebuilds unique indexes; failed imports leave local records untouched. Save the downloaded backup and compare totals, ticket numbers, employee logs, batch rows, and receipt prices after import. An import retry with the same request ID returns the prior result. Imported data stays in browser storage as a separate local copy until the owner chooses to clear it.

## Mobile implementation and verification

The POS has a phone-sized Menu / Current ticket switch with a visible item count and total; the ticket footer remains reachable. Attendance changes to a scrollable day list below 600 px; each day opens the existing detail and shift form. Batch payment rows become cards. Existing tablet breakpoints keep the order board and forms responsive. Buttons in these flows target at least 44 CSS px where practical.

`pnpm build` passed with the bundled modern Node runtime on 2026-10-12. The local browser automation tool blocked this local URL under its security policy, so 320 px, 390 px, 768 px, and desktop visual walkthroughs could not be completed in this session. CSS/source checks do not replace those device tests. The Vite build reports a bundle-size advisory, not a build failure.

## Current limitations

The shared database uses one revisioned JSON document with indexed relational projections. Its single business-wide write lock favors correctness for a small team, but high write volume should move operations into narrower server transactions. Polling gives eventual screen refresh; it is not a push subscription. Logo uploads currently remain inline in the workspace document and should move to managed object storage before large image use. Demo local roles and records are separate from shared businesses.

## Employee account activation

The owner does not create or handle staff passwords. The employee profile stores an optional `accessEmail`; the owner can add it later or change it. The owner-only `save_employee_access` RPC saves the employee profile and its access record in one transaction. It links an already confirmed Supabase Auth user, or stores a pending access record. A trigger on `auth.users` activates pending access only when that email is confirmed. Direct client writes to membership and pending-access tables remain revoked. The app sign-in page exposes staff self-registration and email confirmation instructions. This is account creation, not an automatic email invitation; the owner must tell the employee the app URL. The staff member enters their own password. A future password-reset flow and production SMTP configuration remain required for full production onboarding.

For an existing project, apply only migration `202610120002_employee_access.sql` after backing up the database. Test a new staff signup and an email change before enabling the process broadly. Supabase Auth URL Configuration must include the app origin for confirmation redirects.

Staff snapshots include the business name, tagline, and logo through migration `202610120003_staff_branding.sql`; order payment entries, payroll, employee pay, and private settings remain excluded.
