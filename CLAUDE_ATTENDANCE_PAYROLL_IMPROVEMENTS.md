# Claude Code prompt: improve attendance history and payroll

Open the existing Food Business Web App in Claude Code and paste the prompt below. The attached screenshot shows the current Attendance module. Keep the app's existing sample data, business identity, warm visual design, and working workflows.

---

You are a senior product engineer continuing an existing food business operations app. Inspect the existing attendance and payroll implementation, data model, salary calculation rules, styles, and any existing export/image libraries before editing. Implement the improvements below in the current app. Preserve existing employee profiles, attendance records, rate snapshots, payroll records, sample data, and other app features. Do not scaffold a replacement app or return only a plan. Run the project's existing build/start checks and fix issues.

## 1. Fix attendance record editing

- When the owner clicks **Edit record** on an employee attendance tile or history row, open the edit form with the saved record's current values prefilled: attendance state, time in, time out, notes, and any existing adjustment/correction fields.
- Make the selected employee and business-local date explicit in the edit form. Do not open a blank create form when editing an existing record.
- Save should update/correct the existing record rather than create a duplicate for that employee/date. Preserve the existing revision/correction history and pay-rate snapshot behavior.
- Ensure the save action clearly indicates whether it will create or update the record. Show a success/error toast and refresh the tile, calendar, and history immediately after saving.
- If a record is malformed or lacks optional values, show the saved state accurately and leave optional fields blank; never silently replace saved values with defaults.

## 2. Validate time in and time out

- For a Worked attendance entry, require valid time-in and time-out values before saving. Validate in the form and again in the save/data layer.
- For same-day work, time out must be later than time in. For example, `9:00 AM` to `8:00 AM` is invalid and must show a clear inline message such as `Time out must be later than time in.` Keep the save button disabled or reject submission until corrected.
- Do not calculate a negative duration or silently accept invalid time ranges. If the app should support overnight shifts in the future, implement an explicit **Overnight shift** option and date-aware calculation; otherwise clearly disallow overnight shifts for this MVP.
- Keep the two time fields unambiguous, keyboard accessible, and correctly formatted in Asia/Manila local time.
- A `Did not work` record should not require time-in/time-out. Switching an existing record to Did not work should require confirmation if it will remove saved work times and should preserve the prior values in the existing correction history where supported.

## 3. Monthly attendance calendar with employee markers

Replace the date-range-only history as the primary overview with a compact **month calendar / contribution grid**, inspired by the attached Codex activity calendar. Keep a detailed record table/list available below it or via a selected day.

- Display the selected month as a calendar grid with one square/cell for each date, arranged by weekday columns and week rows. Include weekday labels, month/year, previous/next month controls, a **Today** action, and a clear month summary.
- Each date cell should communicate how many unique employees worked that day. Use small employee-colored bars/segments inside the date cell, one segment per employee with a Worked attendance record for that date. If four employees worked, show four colored markers. Keep colors stable for each employee across the month and distinguish employees with an accessible legend or employee initials/tooltip; do not rely on color alone.
- Handle days with many employees without making the cell overflow: show a bounded number of segments and a `+N` indicator, with all employees available in a tooltip or on selection.
- Use neutral styling for days with no records, a visible highlight for today, and a separate highlight for the selected date. Distinguish Did not work records from Worked markers without counting them as worked.
- Clicking/tapping a day should select it and show that day's attendance detail: employees, Worked/Did not work/unmarked state, valid time-in/out, notes, and rate/accrual summary as appropriate. Provide a clear action to open/edit a selected employee's record.
- Keep filters for employee and role if useful. When filtered to one employee, show only that employee's markers and update daily counts/legend appropriately. Month navigation should preserve applicable filters.
- Provide a summary such as `12 of 31 days recorded`, `3 employees worked today`, or monthly worked-day counts. Be precise about recorded versus worked days.
- On desktop, use a clean contribution-grid layout with aligned week rows; on smaller screens, keep it scrollable or adapt it without clipping. Add screen-reader labels for date/count and a non-color indicator.
- Retain a detailed attendance history list/table for audits and payroll review. It should respect selected month/filters, show recorded times and rate snapshot, and offer edit actions. Do not remove access to historical records.

## 4. Improve payroll monitoring and adjustment workflow

Redesign Payroll for owner use so the covered period, employee totals, calculation details, and adjustments are easy to review before generating payslips.

- Provide clear period controls (weekly, half-month, monthly, or custom range as supported), an employee filter, and a prominent payroll summary for the selected period.
- Show each active employee in a readable card/table row with role, fixed rate and basis, days worked, time totals if available, base accrued pay, adjustments, gross computed amount, paid/remaining amount if payroll payments are tracked, and payroll state (draft/ready/paid or the app's existing states).
- Add a detail view/drawer per employee that itemizes the calculation by attendance date, displays the rate snapshot for each date, and explains the formula used for daily-rate versus monthly-rate employees. Ensure rate changes do not alter historical attendance/payroll calculations.
- Make payroll adjustments easy to add, review, edit, and remove before finalization. Each adjustment should include positive/negative amount, category/type, effective date, and required reason/description; show its effect on the total and maintain any existing correction history. Clearly distinguish additions from deductions and never invent statutory/tax deductions. Only owner-authorized users can adjust payroll.
- Confirm before finalizing or marking a payroll run paid. Show the period, employee count, total payroll, and adjustment total in that confirmation. Prevent duplicate finalized runs for the same employee/period unless the app explicitly supports revisions; if revisions are supported, mark prior versions superseded while preserving history.
- Keep calculations transparent and consistent with configured fixed-pay policy. Do not describe a computed fixed-rate estimate as statutory payroll or legal compliance.
- Improve empty/loading/error states, spacing, filters, labels, currency formatting, and mobile layout. Keep the existing color system.

## 5. Payslip breakdown image generation

- From an employee's payroll detail or finalized payroll run, generate a polished printable payslip and a **Download image** action (PNG preferred).
- The payslip should include business logo/name/tagline, employee name/role, payroll period, issue date, rate and basis, attendance dates/days, itemized base-pay calculation, each adjustment with type/reason/amount, gross/total amount due, payments already recorded and remaining balance when applicable, and an appropriate acknowledgment/signature area.
- Label values and formulas clearly. Do not show private information that is not needed for the payslip. Do not include another employee's information.
- Ensure long employee names, many attendance rows, and multiple adjustments are fully included in the image; do not capture only the visible portion of a scroll container. Wait for logo/fonts before capture and handle export errors with a visible toast.
- Use a predictable filename such as `payslip-<employee>-<period>.png`. Keep print output clean and page-break friendly. Reuse existing image/export utilities when practical.

## 6. Payroll CSV export

- Add **Download CSV** for the selected payroll period and optional employee filter. Export one row per employee or, where useful, a separate detail export with one row per attendance/adjustment; make the chosen granularity clear in the button/filename.
- Include columns such as employee name, role, period start/end, pay basis, fixed rate, worked days, base accrued pay, adjustments total, adjustment details/reasons where appropriate, gross computed pay, paid amount, remaining balance, and payroll state.
- Ensure exported values match the on-screen payroll calculations exactly. Use proper CSV escaping for names/reasons containing commas, quotation marks, or newlines; format currency consistently; use UTF-8 and a filename like `payroll-YYYY-MM.csv`.
- Respect employee filters and selected period. Do not export unrelated customers/orders or credentials.

## Data integrity and visual direction

- Use business-local dates for attendance calendar grouping and payroll boundaries; keep date handling consistent around month/year transitions.
- Preserve all historical attendance, corrections, rate snapshots, and payroll details. Avoid destructive schema/data changes; if a migration is required, make it safe for existing local/demo records.
- Keep the existing warm cream/espresso/orange app styling and readable card layout. Use the attendance screenshot as the basis for the current page but make the month view the main history overview.
- Do not add an activity log module or unrelated tracking data.

## Acceptance walkthrough

Before finishing, verify in the running app:

1. Edit an existing worked record and confirm time-in, time-out, and notes are prefilled and save updates the same record.
2. Try time-in `9:00 AM` and time-out `8:00 AM`; saving is blocked with a clear validation message. Then enter a valid range and save successfully.
3. Navigate months, inspect dates with zero, one, and multiple employees, filter to an employee, and open a date's detail. Confirm four worked employees produce four stable employee markers (or the documented overflow indicator).
4. Review payroll for a period with multiple employees and adjustments; verify the displayed calculation details and totals.
5. Generate a payslip preview, download its full image, and confirm all attendance and adjustment rows appear.
6. Download CSV for the selected period and confirm its totals/rows match the screen and special characters are escaped correctly.
7. Confirm historical rate snapshots and correction records remain available after edits.

When done, summarize the changes, explain the monthly calendar markers, payroll formulas and adjustment behavior, and give the app start instructions and any remaining limitations.

---

Start the app using the project's existing `start-app.bat` after implementation.
