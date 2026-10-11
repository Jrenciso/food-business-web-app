# Claude Code prompt: simplify payroll into a batch workflow

Open the existing Food Business Web App in Claude Code and paste the prompt below. Keep the existing employee, attendance, rate, and payroll data. Replace the confusing payroll workflow with the simple process described here. Keep the app's existing design and sample data.

---

You are a senior product engineer simplifying an existing small food-business payroll module. First inspect the current payroll/attendance data model, salary calculation policy, and screens. Then implement a straightforward owner workflow in the existing app. The owner finds the current payroll snapshot/batch concepts confusing; remove or rename confusing concepts and make the steps visible and linear. Do not rebuild the app, add enterprise payroll complexity, or return only a plan. Preserve existing attendance and payroll history safely.

## The simple payroll workflow

Use these four steps, in this order:

1. **Select time logs** — choose a date range and employees, then review which logged work dates/hours are still unpaid.
2. **Review pay and adjustments** — calculate base pay from the selected unpaid time logs, then add optional earnings or deductions.
3. **Generate payroll batch** — create one batch for the selected employees and date range, with a register for all included employees.
4. **Track payment** — open an employee's payslip from the register and mark their net pay paid/transferred, with date/method/reference/remark as appropriate.

Show a simple step indicator and plain labels. Do not expose or rely on an unexplained `snapshot` concept in the interface. If the implementation needs to preserve a finalized calculation for historical accuracy, call it a **Payroll batch** or **Payroll record**, explain it in one sentence, and make it part of the above workflow.

## Step 1: Select time logs

- Add a clear **Prepare time logs** action in Payroll.
- Allow selecting a period using **This day**, **This week**, **This month**, or **Custom range**. Use Asia/Manila business dates and show the exact start/end dates.
- Provide an employee selector for the batch: all active employees by default, with the ability to select/deselect individuals. Show the selected employee count before continuing.
- Display a calendar or simple tracker for the selected period. Each date/employee should clearly show whether they worked and whether those work hours/day have already been included and paid in a prior payroll batch. Use clear states such as `Worked · unpaid`, `Worked · paid`, `Did not work`, and `No record`.
- Let the owner review/edit attendance details with the existing validation rules, including time in/out and notes. The tracker should show worked days/hours and pay basis/rate so the owner can verify the calculation.
- Only unpaid work records within the selected range are eligible for this payroll preparation. Exclude work dates already paid in a prior payroll batch so they are never computed twice. Make excluded/previously paid dates visible with a `Already paid` label and do not let them be reselected accidentally.
- Show a concise preview per employee: eligible worked days/hours, base pay estimate, and which dates are included. Allow the owner to include/exclude employees before moving forward.
- Clearly handle missing attendance, malformed time logs, inactive employees, rate changes, and an empty selection. Block continuing if the selected batch has no eligible unpaid work records.

## Step 2: Review base pay and adjustments

- After confirming time logs, show a simple employee-by-employee pay table. Base pay must be calculated only from the unpaid selected work records and the employee's configured rate/pay basis. Show included dates and formula details on demand, without forcing the owner through a complex screen.
- Provide an **Add adjustment** control for each employee. An adjustment is either **Additional earning** or **Deduction**, with amount and a short reason/description. Show the adjustment total and its effect on the employee's pay immediately.
- Do not invent tax/statutory deductions or call the result legal payroll. Adjustments are owner-entered only.
- Allow editing/removing adjustments before batch generation. Show base pay, additions, deductions, and projected net pay clearly.
- Keep the chosen date range and employee selection visible. Allow returning to Step 1 to change included employees/time logs; if the selection changes, recalculate pay and clearly keep or discard existing adjustments only after confirmation.

## Step 3: Generate a payroll batch and register

- Provide one clear **Generate payroll batch** action after review. Confirm the period, included employee count, total base pay, total additions, total deductions, and projected total net pay.
- Generating the batch should create a payroll register with one row per employee and columns for employee, included worked dates/days/hours, gross/base pay, additions, deductions, net pay, and payment status.
- Show batch total amounts at the top or bottom. Default payroll processing to a **batch containing all selected employees**. Do not require generating payslips one employee at a time.
- Add an employee selector to the batch-generation step as well, so the owner can choose exactly whose payroll records are included. Default to all selected employees from Step 1. Show the final included employee count and let the owner change the selection before confirming.
- On successful generation, mark the included attendance dates as assigned to that payroll batch and prevent those dates from being included in another batch. They become **paid** only when payment is recorded, not merely because a batch was generated. Until then show `In payroll batch · unpaid`.
- Prevent duplicate generation that would pay the same employee/date twice. If a draft batch is canceled before payment, release its unpaid time logs back to eligibility. Preserve a clear record of void/cancelled batches without counting them as paid.
- Keep historical payroll batch totals and employee calculations stable if rates or attendance are later edited. Any correction to a generated but unpaid batch should be explicit and recalculate/replace the draft; a paid batch should not silently change.

## Step 4: Register, payslip, and payment tracking

- Clicking an employee row in the payroll register opens that employee's payslip view for this batch. Make it clear that this is one row/payslip within the batch.
- Payslip should show business branding, employee name/role, pay period, included worked dates, rate basis, base/gross pay, each additional earning and deduction with its reason, net pay, and payment state.
- Provide **Download payslip image** (PNG) and print actions. The full payslip content must export without clipping and use a filename containing employee and payroll period.
- Each employee row should have a simple payment tag: `Unpaid` or `Paid/Transferred`. Add a **Mark paid/transferred** action for the employee's net pay with a confirmation. Capture paid date, payment method (cash, bank transfer, e-wallet, other), optional reference, and optional remark. Show who/when only if the app already has a reliable authenticated user.
- Allow recording payment for each employee independently while keeping the register as one batch. Show batch summary totals for net pay, amount paid, and amount still unpaid.
- Do not mark employee time logs paid when only the batch is generated. Mark those logs paid when the corresponding employee payment is recorded. Prevent marking the same employee payment twice without an explicit correction/refund flow.
- Keep payment state separate from fulfillment/order payment and from employee attendance state.

## Simple navigation and terminology

- Payroll landing page should present a small number of obvious actions: `Prepare time logs`, `Continue draft batch` if one exists, and `Payroll history`.
- Use a stepper or tabs with plain names: `Time logs → Adjustments → Payroll register → Payment tracking`.
- Remove unnecessary intermediate screens, duplicate confirmation layers, confusing snapshot jargon, and advanced controls that are not needed for this owner workflow.
- Keep historical completed batches accessible from Payroll history with date range, employee count, total net pay, paid/unpaid totals, and a way to reopen the register.
- Preserve existing time-log monthly calendar and attendance history. Payroll should reuse attendance records rather than asking the owner to re-enter them.

## Calculation and data integrity

- Reuse the existing configured daily/monthly rate policy and attendance accrual rules; show the exact method and dates in the employee breakdown. Do not silently reinterpret existing salary rates.
- Use integer centavos or reliable decimal arithmetic. Verify that gross/base pay + additions - deductions = net pay and register totals equal the sum of employee rows.
- A date is considered paid for an employee only after that employee's payment is recorded. Exclude only the paid employee/date records in later periods; other employees' records on the same dates remain eligible if unpaid.
- If payroll batches need a stored copy of finalized calculations, use a plain internal model but label it in the app as a payroll batch/register. Preserve existing paid history and provide safe migration/default handling. Never erase attendance or payment history while simplifying the interface.
- Do not add activity logs or unrelated tracking data.

## Acceptance walkthrough

Verify the workflow in the running app:

1. Select This week and two employees; see only their eligible unpaid work records and a per-employee base-pay preview.
2. Confirm a previously paid employee/date is excluded, while an unpaid employee's record on the same date remains selectable.
3. Add one earning and one deduction, then verify projected net pay and the register math.
4. Generate one batch for the selected employees and open the payroll register.
5. Click an employee row, review the payslip, download the image, and confirm it is complete.
6. Mark one employee Paid/Transferred and verify only their included time logs become paid; the other employee remains unpaid and visible in the batch outstanding total.
7. Start another period and confirm already-paid employee/date records are excluded from computation.
8. Cancel an unpaid draft batch and confirm its time logs become eligible again.

When finished, summarize the new four-step workflow in plain language, explain when a work date becomes paid, and note any remaining persistence/authentication limitations.

---

Use the project's existing `start-app.bat` to run the app after Claude completes the work.
