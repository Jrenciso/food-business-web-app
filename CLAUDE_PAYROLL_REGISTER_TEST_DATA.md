# Claude Code prompt: simple payroll register and Live Local attendance test data

Open the existing Food Business Web App in Claude Code and paste the prompt below. The attached screenshot shows the current payroll batch Step 3, where employee selection is displayed as a single small tile and the payroll amounts appear only as totals. Keep the current brand and four-step payroll workflow, but make the register clear and easy to scan.

---

You are continuing the existing food business app. Inspect the current payroll batch flow, employee/rate data, attendance storage, and workspace separation before editing. Implement the changes below in the existing project. Preserve menu, orders, employees, settings, demo workspace, and payroll functionality. Do not scaffold a new application or return only a plan.

## 1. Show a real payroll register before batch generation

In the batch workflow's **Payroll register / Generate payroll batch** step, replace the current employee selection tile(s) and totals-only presentation with a simple payroll register table that shows one row per included employee.

Keep the table concise, with these columns:

- Employee name
- Base pay
- Additional earnings
- Deductions
- Projected net pay

Requirements:

- Include all employees selected for this batch, with each employee's individual amounts visible at a glance.
- Keep employee selection available in this step, defaulting to the employees selected in the Time Logs step. A checkbox or compact include toggle at the start of each row should let the owner include/exclude employees before generation.
- When employees are included/excluded, immediately update the employee count, all amount columns, and totals. Do not count excluded employees in batch totals.
- Below the rows, show one **Total** row for base pay, additional earnings, deductions, and projected net pay. The total must equal the sum of the included employee rows.
- Keep the selected payroll date range visible above the register. Keep the existing clear explanation that generating a batch does not mean it has been paid; time logs become paid only when payment to each employee is recorded.
- Keep an optional, compact way to review included dates or adjustment details (such as expanding a row), but do not force every detail into the main register. The default view should not feel crowded or overly detailed.
- Make the **Generate payroll batch** action clear and accessible after the register. On narrower screens, use a responsive stacked/card register or horizontal scrolling with employee name and net pay remaining visible.
- Do not display only the totals cards. This register's purpose is to compare all employees' base pay, adjustments, and projected net pay before generating the batch.

## 2. Replace Live Local attendance with sample test records

The owner explicitly wants the current attendance records in the **Live Local** workspace cleared and replaced with test attendance data so they can exercise the payroll workflow. Implement this narrowly and safely:

- Clear only the existing attendance records in the **Live Local** workspace. Do not clear or modify the Demo/Sample workspace, employees, employee fixed rates, payroll history, orders, menu, business settings, or any other data.
- Before clearing, create a recoverable backup/export of the existing Live Local attendance data if the app supports it. If it does not, provide a confirmation that explicitly says the Live Local attendance records are being replaced, and make the operation a one-time, idempotent setup action so it does not duplicate sample records on later reloads.
- Seed a clearly labeled **TEST ATTENDANCE DATA** set covering every active employee and the most recent full Monday-to-Sunday business week. The screenshot/app context shows Oct 11, 2026 and a payroll range of Oct 5–11, 2026; for this context, use **October 5 through October 11, 2026 inclusive**, timezone Asia/Manila. If the app is run later, use its current test date and compute the most recent completed Monday-to-Sunday week instead.
- Create realistic varied worked days for each active employee during that week, not necessarily all seven days for everyone. Ensure every active employee has at least two valid Worked records so payroll can be tested with multiple employees and different totals. Also include a few Did not work records where appropriate. Use plausible, valid time-in/out values with time out after time in; do not seed invalid or overnight shifts.
- Use each employee's existing saved rate/pay basis as the attendance pay-rate snapshot for the seeded records. Do not change salaries. If an employee has no valid rate, still seed their attendance and make the missing rate visible for owner correction instead of inventing a salary.
- Add short notes on a small subset of records, leave most notes empty, and ensure records are identifiable as sample test data in the UI.
- Ensure these records are stored in Live Local and are visible in Attendance calendar/history and eligible in Payroll's Time Logs step. They should initially be **unpaid** and available for a payroll batch. Do not create fake payroll batches or mark records paid.
- Provide a clear, owner-only `Reset Live Local attendance to sample week` control in Settings or the Attendance module if needed to repeat the test setup. Require explicit confirmation, scope it only to Live Local attendance, preserve all other records, and ensure repeated runs replace rather than duplicate that sample week's data.
- If current data storage cannot safely distinguish workspaces, first fix workspace scoping before performing any reset/seed. Do not guess and risk changing Demo data.

## 3. Keep the payroll workflow simple

- Preserve the four clear steps: Time Logs → Adjustments → Payroll Register → Payment Tracking.
- Avoid adding extra modules, long detail tables, or new tracking data to accomplish this request.
- Keep currency in Philippine pesos and date grouping in Asia/Manila.
- Keep payroll formulas consistent with each employee's configured daily/monthly rate policy. Show missing or invalid rate data clearly; do not fabricate rates or deductions.
- Add clear success/error toast messages for the attendance reset/seed and payroll register recalculation.

## Acceptance walkthrough

Before finishing, verify in the running app:

1. The Payroll Register step shows all selected employees in separate rows with base pay, additions, deductions, and projected net pay.
2. Including/excluding an employee updates row inclusion and all totals correctly.
3. The total row equals the sum of the included employees and projected net pay equals base pay plus additions minus deductions.
4. Existing Live Local attendance records are replaced only after the owner confirms; demo/sample attendance and all non-attendance records remain untouched.
5. The replacement test attendance includes every active employee, covers Oct 5–11, 2026 for the screenshot context, has valid varied times, is visibly sample/test data, and is initially unpaid.
6. Reloading or repeating the reset action does not duplicate records.
7. Seeded records appear as eligible time logs in payroll and no fake payroll batch is generated.

When complete, summarize the register changes, state exactly what Live Local data was replaced, identify the test week, and explain how to repeat/reset the sample attendance setup.

---

Use the project's existing `start-app.bat` to start the app after implementation.
