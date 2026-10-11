# Claude Code prompt: simplify attendance and payroll around shifts and batches

Open the existing Food Business Web App in Claude Code and paste the prompt below. The four attached screenshots show the current attendance calendar, the intended day-detail idea, the current payslip, and the desired simple payment register. Use them as visual references. This prompt supersedes earlier payroll workflow details where they conflict. Preserve existing business, employee, menu, order, and sample data.

---

You are continuing the existing small food business operations app. Inspect the current attendance, employee, settings, and payroll implementation before editing. Then implement the workflow below in the existing app. Do not rebuild it or return only a plan. Keep the existing brand and data. The owner wants a simpler attendance and payroll experience with very few screens and no unexplained payroll jargon.

## A. Work shifts in Settings

- Add a **Work shifts** section in Settings where the owner can add, edit, deactivate, and reorder named shifts. Each shift has a name and start/end time (for example, `1:00 PM–10:00 PM`).
- Use configured shifts as the normal source for employee attendance time logs. Selecting a shift should save its start and end time to that attendance record so historical records do not change when the owner edits the shift later.
- Validate shift definitions and attendance times. The end must be later than the start for this MVP; reject invalid or overnight shifts with a clear message. Do not silently accept `9:00 AM–8:00 AM`.
- If an existing employee log must use a one-off time, allow a clearly labeled owner-only **Custom hours** option, with the same validation. Keep shift selection as the default path.
- Do not delete or rewrite historical attendance if a shift is renamed/deactivated.

## B. Attendance: make the monthly calendar the main workspace

### Full-size calendar

- Make the month calendar the primary, spacious view on the Attendance page. Use most of the available page width/height. Include month/year, previous/next month, **Today**, employee filter, and role filter. Keep weekday headers and a normal month grid.
- Each day cell should clearly show the date and a compact colored marker for every employee who has a Worked log that day. Use stable employee colors and a legend with employee names/initials; do not rely on color alone. Show `+N` when a day has more markers than fit in the cell.
- Show a small worked-employee count in each date cell. Distinguish absent, no log, and worked records. Do not make the cells so small or crowded that the calendar feels like a tiny report above other content.
- Clicking or tapping a date opens a focused day-detail modal/panel for that business-local date. Show every active employee and their attendance state for that date: saved shift and hours if worked, `Did not work` if absent, or `No time log yet` if unmarked.
- In the date detail, the owner can add or edit an employee's time log by choosing the employee's shift from a dropdown. Saving a selected shift records the shift label plus its start/end time for that employee/date. Include an optional short note. Do not require typing start and end times for normal shift entries.
- Allow changing a prior log by reopening the day and selecting a different shift or state. Prefill the current saved shift, state, times, and note when editing. Update the existing employee/date record; do not create duplicates. Show validation and save feedback.
- Keep date-day details concise and readable. Include a small daily summary such as `3 worked · 1 absent · 0 without logs`.

### Employee log explorer below the calendar

- Below the calendar, show a simple tile/card for each active employee. Clicking a tile selects that employee and displays their time-log history for a selectable period: **Today**, **Last week**, **This month**, or **Custom range**.
- Show date, shift name, time in/out, Worked/Did not work state, and a short note when present. Keep it easy to scan; do not repeat every payroll formula or audit detail here.
- Allow opening the relevant date detail from a log row to edit that employee's record.
- Preserve existing attendance history and pay-rate snapshots. Use Asia/Manila business dates for calendar grouping and range boundaries.

## C. Payroll schedule setting and period selection

- Add a **Payroll schedule** setting in Settings with three choices: **Weekly**, **Twice monthly**, and **Monthly**. For twice-monthly, use two configurable/default periods (recommended: 1st–15th and 16th–last day of month) and let the owner adjust the cut-off dates if practical.
- Use the selected schedule to make payroll period choices sensible by default. Weekly schedules should offer periods such as **This week**, **Last week**, and other unpaid/unprocessed weeks. Monthly schedules should offer unpaid/unprocessed months. Twice-monthly schedules should offer the corresponding half-month periods.
- Always show exact covered dates next to each period choice, for example `Week of Oct 5–11, 2026`. Use Asia/Manila and clearly label period start/end. The owner may use a custom date range if it does not overlap already processed time logs.
- When a period has already been finalized/processed, show that clearly and prevent selecting the same employee/date work logs for a new payroll calculation. Attendance logs become paid only when payment is marked Paid; a saved finalized register must be protected from duplicate processing even if it remains unpaid.

## D. Simple payroll workflow

Use this short workflow:

1. **Select time logs** — choose the schedule period and employees; review eligible unpaid/unprocessed attendance.
2. **Adjustments** — review calculated base pay and add/remove earnings or deductions per employee.
3. **Payroll register** — review one compact batch register, then save/finalize it.
4. **Payment tracking** — mark each employee's net pay paid or unpaid and save the batch payment status.

Keep a visible step indicator, but avoid duplicate layers, confusing jargon, or extensive details in the default view. Do not use or show the confusing term **snapshot**. Use **Payroll batch** and **Payroll register** only.

### 1. Select time logs

- Default to a batch containing all active employees with eligible records for the chosen period. Include an employee selection control to include/exclude employees. Show selected count and covered dates.
- Show each employee's eligible worked dates/shifts and concise base-pay estimate. Exclude any dates already finalized in another payroll register and visibly label previously paid records. Do not include the same employee/date twice.
- Use saved shifts and saved rate snapshots to calculate pay, using the existing configured daily/monthly pay policy. Do not change employee rates. Make missing rates visible and do not invent amounts.
- Keep the view compact. Detailed daily calculation rows can be opened on demand.

### 2. Adjustments

- Show a simple row per selected employee with base pay, additional earnings, deductions, and projected net pay.
- Provide **Add adjustment** for a selected employee. An adjustment has type (additional earning or deduction), amount, and short reason. Allow editing/removing adjustments before saving the register.
- Recalculate projected net pay immediately. Net pay = base pay + additions − deductions. Do not invent taxes/statutory deductions.
- Provide a clear **Back to time logs** action if the employee selection or date coverage needs changes.

### 3. Payroll register — save to finalize

- Show a clear, compact register table with one row per included employee and columns: **Employee**, **Base pay**, **Additional earnings**, **Deductions**, **Net pay**.
- Include one total row that sums all employees. Keep period and employee count visible above the table. Do not show only summary cards or employee selection tiles instead of the register.
- Employee names in the saved register should be clickable. After the register is saved/finalized, clicking an employee name opens that employee's payslip. Before saving, the payslip may be previewed, but label it draft.
- Provide two clear actions: **Back to adjustments** (to add, edit, or delete an employee adjustment) and **Save payroll register**. Do not provide a `Cancel unpaid batch` action. Use the back action for changes before finalization.
- Saving finalizes the payroll register for that period and employee set. Confirm once with the period, included employee count, and total net pay. After save, preserve the calculated values and adjustments for that register and prevent those employee/date work logs from being processed again.
- Only after the register is saved should the interface offer **Proceed to payment tracking**. Explain briefly that saved/finalized means calculations are fixed; payment still needs to be recorded separately.

### 4. Payment tracking — keep it batch-oriented

- Show one simple batch table for all employees in the saved register with only **Employee**, **Net pay**, and an editable **Paid / Unpaid** control. This matches the attached example. Do not force the owner through a separate payment screen per employee.
- Default each employee to **Unpaid** after saving a payroll register. The owner can change each row to **Paid** when funds are actually transferred/handed over, and back to Unpaid only through a clear correction confirmation.
- A compact optional payment-detail popover may capture paid date, method, reference, or remark when marking Paid, but keep the default batch view simple.
- Provide one **Save payment status** button for the batch. Save all row statuses together and show a clear confirmation/toast. Show the batch total net pay, paid amount, and remaining unpaid amount as a small summary.
- A work date is financially **paid** only when the employee's status in this finalized batch is saved as Paid. Unpaid rows stay visible as unpaid and remain attached to this batch; do not duplicate them into a second payroll batch automatically.
- Allow reopening an existing batch's payment tracking to update statuses. Preserve the finalized register amounts; payment changes must not alter payslip calculations.

## E. Simple vertical payslip

- Each employee name in a saved register opens a payslip in a narrow **vertical receipt/document layout**, not a landscape/horizontal two-column sheet.
- Keep it simple and readable, with only usual payslip details:
  - Business logo/name/tagline
  - Employee name and role
  - Payroll period with covered dates
  - Worked days/shifts summary
  - Base/gross pay
  - Additional earnings with short labels and amounts
  - Deductions with short labels and amounts
  - Clear net pay
  - Paid/Unpaid status and paid date if applicable
  - Issue date and optional prepared/received signature lines
- Format it like a clean receipt: narrow centered page, single-column sections, thin separators, no wide table. Ensure it prints on a receipt-like vertical page and can be downloaded as a full PNG image without clipping.
- Do not overload the payslip with internal database IDs, lengthy formula explanations, customer/order data, or unrelated payroll history.

## F. Keep the interface simple

- Follow the supplied screenshots' current warm cream, espresso, and orange style.
- Use concise headings, plain terms, clear buttons, and one primary action at each step.
- Avoid placing extensive payroll detail on the default screen; expose detail only when the owner clicks an employee or expands a row.
- Keep toasts for save/error feedback. Use accessible form labels and keyboard/touch-friendly calendar/day-detail interactions.
- Do not add activity logs, extra employee tracking, or unrelated data collection.

## Data safety and acceptance walkthrough

- Preserve all existing attendance, payroll, employee, order, menu, and settings records. If migration is needed, make it safe and workspace-scoped.
- Test a week with multiple employees and shifts, at least one absent/no-log employee, and multiple adjustments.
- Verify the calendar opens a day detail, shift dropdown preselects on edit, edits update existing records, and invalid shift hours cannot be saved.
- Verify a weekly payroll schedule offers this/last week with exact covered dates. Verify already finalized employee/date logs cannot be processed twice.
- Verify register rows and totals reconcile: base pay + additions − deductions = net pay.
- Verify Save payroll register finalizes the batch, exposes clickable employee names/payslips, and then Proceed to payment tracking.
- Verify payment tracking shows all batch employees together with only name, net pay, paid/unpaid control, and one batch Save action. Confirm payslip payment state updates after saving.
- Verify payslip is a simple vertical receipt-like layout and the full content prints/downloads as PNG.

When complete, summarize the new attendance flow, how to configure shifts and payroll schedule, the payroll steps, and any storage/authentication limitations. Run the app and report its local URL.

---

Use the existing `start-app.bat` to start the app after implementation.
