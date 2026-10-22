# Urban Casero food operations app

React, TypeScript, and Vite app for a small food business: POS, kitchen/rider tickets, menu, attendance, payroll estimates, dashboard, and reports.

## Start

On Windows, double-click [start-app.bat](./start-app.bat) and keep its command window open. Or use Node.js 18+:

```powershell
npm install
npm run dev
```

Open the URL Vite prints, normally http://localhost:5173. Run `npm run build` for the TypeScript and production bundle checks.

## Demo sign-in and workspaces

The entry page offers local demo profiles: Alex Reyes (owner), Sam Dela Cruz (chef), Jo Lim (kitchen staff), and Nico Ramos (rider). Select a profile and either:

- **SAMPLE / TEST DATA** — the existing Urban Casero menu and existing sample tickets/labor records stay here. New sample transactions are labeled. The upgrade copies the prior `urban-ops-v1` browser dataset into this separate workspace; it does not delete the old key. Earlier Salo demo data remains in its archive.
- **LIVE LOCAL** — a separate browser-local workspace with the Urban Casero menu/settings and empty transactions on first entry. Switching does not delete or merge sample data. The header and sidebar always identify the current workspace.

The owner can switch workspaces in the sidebar or Settings. Settings also provides a JSON backup of the current workspace. Resetting the sample workspace requires confirmation and archives prior sample records within the sample workspace backup fields. Download a JSON backup before resetting or clearing browser storage.

Shared mode is available when Supabase is configured. Apply the SQL migrations in order. The current staff flow uses owner-issued usernames; existing staff email sign-ins remain valid during migration. See [backend and mobile setup](docs/backend-and-mobile.md) for deployment, sign-in, security, and go-live checks.

**Demo mode is not production authentication or shared storage.** The demo profile chooser has no password. Client-side role checks and records can be changed by anyone with browser storage access. Shared operation requires a hosted database, real sign-in, server authorization, backups, TLS, and integration checks. This repository does not contain private Supabase keys; deployment status must be verified in the target project.

## Orders and pricing

Money is stored as integer centavos. Pickup has no delivery area or fee. Delivery requires an active area, address, and rider. Settings → **Delivery Areas & Fees** seeds exactly five pricing areas: Sonoma ₱80; Amaia / Phirst Park Pandi ₱90; Brighthomes / Primeville / EPDR / Calle, Malabon / Caysio Pabahay / Caypombo ₱40; Pintong Bato / Malawak / Sunrays / Villa Corazon ₱40; M. Sapa ₱60. Owners can edit names, fees, aliases, notes, active state, and order. The order saves the selected area label, configured fee, and applied fee as snapshots; later menu and area edits do not alter existing tickets. An owner fee override requires a reason stored on the order.

New orders start unpaid. Fulfilment and payment status are separate. Multiple payment and refund entries are supported. A payment that fully settles the ticket requires a confirmation; partial payments save directly. Payments cannot exceed the remaining balance and refunds cannot exceed net collected money. Owners can edit orders in New, Preparing, Ready, or Picked up status in the POS form. Dispatched, completed, and cancelled orders cannot be edited; the form and data layer enforce the same rule. The ticket number, creation time, and payment ledger remain; saved line prices remain for unchanged lines, new lines use the current menu price, and fulfilment resets to New. An edit cannot reduce the total below net collected payments. Receipts show the snapshot and can be printed or downloaded as a full PNG. The customer order update PNG shows item names, quantities, selected flavors, totals, and payment balance, while omitting internal notes and payment references. A remote logo URL may prevent browser image export if the remote server disallows capture, so a locally uploaded logo is more reliable.

For pickup tickets, Kitchen Staff and Chef may advance New → Preparing → Ready → Picked up. The owner may then mark the pickup Completed; the existing direct Ready → Completed owner action remains available. Delivery tickets retain the rider sequence Ready → Picked up → Out for delivery → Completed. Kitchen Staff and Chef cannot dispatch delivery tickets.

The owner can change item order within each category and star favorites. Favorites sort first, then manual order. POS tile size is saved per demo profile in this browser.

## Reports and payroll

Dashboard and reports use the configured business timezone (default Asia/Manila). Booked sales include non-cancelled orders created in the selected period; money collected and refunds use payment timestamps. Outstanding balance is based on non-cancelled orders created in the period. Reports are scoped to the current workspace, include delivery area on ticket rows/CSV, and never mix sample with live-local transactions.

The dashboard labels active order counts separately from status counts, which include cancelled tickets. Its net payments and refunds use transaction dates, including payments against older tickets. Order totals, channel totals, average order value, and outstanding balances use active tickets created on the selected business day. The Worked today panel lists worked logs; absences are counted separately. Batch payment tracking offers **View payslip** for every employee, including those still For payment.

Settings → **Work shifts** lets the owner add, edit, reorder, and deactivate named same-day shifts. The **Payroll schedule** setting offers weekly, twice-monthly, or monthly periods; the twice-monthly cut-off defaults to the 15th. Attendance uses Asia/Manila business dates. Its large month calendar shows worked-employee markers and counts. Select a day to see every active employee, their saved shift, absence, or missing log. Choose a shift to save its label and hours on the employee/date record; **Custom hours** handles a one-off shift. The employee tiles below the calendar show logs for Today, Last week, This month, or a custom range. Corrections update the existing record and retain prior values and rate snapshots. Logs assigned to a saved payroll batch are locked.

Payroll follows four owner steps: **Time logs → Adjustments → Payroll register → Payment tracking**. Period choices follow the saved schedule and show exact covered dates; a custom range remains available. Dates already assigned to a saved register are visible but excluded from new calculations, whether paid or still unpaid. Malformed work times and missing or invalid saved rates are shown but excluded. Daily rates accrue once per eligible worked day; monthly rates divide by calendar days in the attendance month, allocating integer-centavo remainder to earlier dates. The owner reviews adjustments, then uses **Save payroll register** once to fix the batch calculation and reserve its work dates. Employee names in the saved register open narrow vertical payslips with print and full-PNG download. **Proceed to payment tracking** opens one table for the batch; the owner confirms paid rows and uses **Save payment status** once. A work date becomes paid only when that employee's Paid status is saved. Correcting Paid back to For payment requires confirmation and keeps the earlier payment record in that row's correction history. Older individual payroll records are imported into history as legacy batches; the earlier app did not track disbursements, so their payment state is unverified and shown unpaid until recorded. Payroll is an operational estimate without statutory deductions, tax, benefits, or overtime calculation.

Settings → **Payment methods** controls which methods appear for new customer and payroll payments. Cash, GCash, and Bank transfer start enabled; Card, E-wallet, and Other start disabled. Disabling or reordering methods does not alter earlier payments. New payment records snapshot the displayed label. The order board and list show fulfillment, payment, and pickup/delivery as separate badges. Weekly payroll options use ISO week numbers (Monday through Sunday), and only periods with unprocessed worked logs are listed. In payment tracking, **For payment** means the saved register remains unpaid. **Mark paid / transferred** opens an inline date, optional method, and remarks form; **Confirm paid** changes the pending view, and **Save payment status** persists all changed rows together.

The Activity Log screen and event writes have been removed. Existing legacy activity entries remain in old browser data so this upgrade does not erase stored data; no new activity entries are added. Operational ticket, payment, attendance, and payroll records remain intact. Download a workspace JSON backup in Settings before clearing any browser storage.
