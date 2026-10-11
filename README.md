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

**This is not production authentication or shared storage.** The demo profile chooser has no password. Client-side role checks and records can be changed by anyone with browser storage access. Real multi-user operation requires a hosted shared database, real sign-in, server-side authorization, reliable backups/restore, deployment and TLS, and a plan to migrate verified business data. No backend or credentials were configured in this project, so the app must not be treated as production-ready across staff devices.

## Orders and pricing

Money is stored as integer centavos. Pickup has no delivery area or fee. Delivery requires an active area, address, and rider. Settings → **Delivery Areas & Fees** seeds exactly five pricing areas: Sonoma ₱80; Amaia / Phirst Park Pandi ₱90; Brighthomes / Primeville / EPDR / Calle, Malabon / Caysio Pabahay / Caypombo ₱40; Pintong Bato / Malawak / Sunrays / Villa Corazon ₱40; M. Sapa ₱60. Owners can edit names, fees, aliases, notes, active state, and order. The order saves the selected area label, configured fee, and applied fee as snapshots; later menu and area edits do not alter existing tickets. An owner fee override requires a reason stored on the order.

New orders start unpaid. Fulfilment and payment status are separate. Multiple payment and refund entries are supported. A payment that fully settles the ticket requires a confirmation; partial payments save directly. Payments cannot exceed the remaining balance and refunds cannot exceed net collected money. Owners can edit orders in New, Preparing, Ready, or Picked up status in the POS form. Dispatched, completed, and cancelled orders cannot be edited; the form and data layer enforce the same rule. The ticket number, creation time, and payment ledger remain; saved line prices remain for unchanged lines, new lines use the current menu price, and fulfilment resets to New. An edit cannot reduce the total below net collected payments. Receipts show the snapshot and can be printed or downloaded as a full PNG. The customer order update PNG shows item names, quantities, selected flavors, totals, and payment balance, while omitting internal notes and payment references. A remote logo URL may prevent browser image export if the remote server disallows capture, so a locally uploaded logo is more reliable.

For pickup tickets, Kitchen Staff and Chef may advance New → Preparing → Ready → Picked up. The owner may then mark the pickup Completed; the existing direct Ready → Completed owner action remains available. Delivery tickets retain the rider sequence Ready → Picked up → Out for delivery → Completed. Kitchen Staff and Chef cannot dispatch delivery tickets.

The owner can change item order within each category and star favorites. Favorites sort first, then manual order. POS tile size is saved per demo profile in this browser.

## Reports and payroll

Dashboard and reports use the configured business timezone (default Asia/Manila). Booked sales include non-cancelled orders created in the selected period; money collected and refunds use payment timestamps. Outstanding balance is based on non-cancelled orders created in the period. Reports are scoped to the current workspace, include delivery area on ticket rows/CSV, and never mix sample with live-local transactions.

Attendance opens on a month calendar in the configured business timezone. Each Worked employee adds one stable, color-coded marker to the date; the legend names the employees, and the day label states the worked and Did not work counts. Filters carry across months. Day cards and the history table open the saved record with its original state, times, and notes. The form requires both times for Worked and a same-day end later than the start; overnight shifts are unsupported. Corrections update the same record and retain previous values in revision history and the original rate snapshot. Switching Worked to Did not work confirms before clearing current work times. Dates assigned to an active payroll batch are locked; void a fully unpaid batch before correcting its time logs.

Payroll follows four owner steps: **Time logs → Adjustments → Payroll register → Payment tracking**. Select this day/week/month or a custom range and employees; the tracker marks each date as Worked · unpaid, In payroll batch · unpaid, Worked · paid, Did not work, or No record. Malformed work times and missing rate snapshots are shown but excluded from pay. Daily rates accrue once per eligible worked day; monthly rates divide by calendar days in the attendance month, allocating integer-centavo remainder to earlier dates. Every line uses its saved rate snapshot. Additional earnings and deductions are owner-entered with a required reason and can be edited or removed before generation. The confirmed batch includes all finally selected employees, preserves each calculation, and reserves their work dates without marking them paid. A row becomes Paid/Transferred only after its employee payment is recorded with date and method. Payroll history keeps both active and cancelled batches; cancelling a fully unpaid batch releases its work dates. Each register row opens a printable/full-PNG payslip, and the register exports UTF-8 CSV. Older individual payroll records are imported into history as legacy batches; because the older app did not track payroll disbursements, their payment status is **unverified and displayed unpaid** until the owner records it. Payroll remains an operational estimate, without statutory deductions, tax, benefits, or overtime calculation.

The Activity Log screen and event writes have been removed. Existing legacy activity entries remain in old browser data so this upgrade does not erase stored data; no new activity entries are added. Operational ticket, payment, attendance, and payroll records remain intact. Download a workspace JSON backup in Settings before clearing any browser storage.
