# Claude Code prompt: payment methods, order badges, and payroll UI polish

Open the existing Food Business Web App in Claude Code and paste the prompt below. The attached screenshots show the current order tickets, payment-method report, payroll period dropdown, register heading, and payment tracking control. Implement the changes in the existing app while preserving its current data, roles, design, and simple attendance/payroll workflows.

---

You are continuing the existing food operations app. Inspect the current settings, order ticket/card component, payment records and reports, payroll schedule/period logic, and batch payment-tracking UI before editing. Make the requested changes in the existing project; do not rebuild the app or return only a plan. Preserve existing order/payment/payroll history and run the existing app/build checks.

## 1. Configurable payment methods

- Add **Payment methods** in Settings. The owner can enable/disable and reorder the methods accepted when recording customer order payments.
- Seed this business with exactly these enabled methods: **Cash**, **GCash**, and **Bank transfer**. Disable/hide Card and Other by default for this business.
- Use the active configured methods in the order payment form and any related filters or summaries. Do not show inactive choices for new payments.
- Preserve the method label saved on historical payment records and continue reporting those records accurately even if a method is later disabled or renamed. Do not rewrite payment history.
- If no methods remain enabled, block new payment entry and show an owner-facing Settings link/help message.

## 2. Order tickets: badges without redundant labels

On the Orders board/list, show three clear badges near the ticket number, without the separate captions `ORDER STATUS`, `PAYMENT STATUS`, or `ORDER TYPE`:

1. Fulfillment status badge (New, Preparing, Ready, Picked up, Out for delivery, Completed, Cancelled, etc. as supported).
2. Payment badge (Paid, Unpaid, or Partially paid; continue using the actual payment ledger and outstanding balance).
3. Order type badge (Delivery or Pickup).

- Make the badge text itself explicit enough to understand. For example, `Ready`, `Unpaid`, and `Delivery`.
- Keep badges visually distinct by color/shape and accessible contrast; do not rely on color alone.
- Do not remove useful customer-facing delivery area, created time, total, due balance, or the Details action. The change is specifically to remove the redundant field labels and make type visible as a badge beside the other two badges.
- Apply the same concise badge presentation consistently in Board and List views, including responsive layouts. Keep order status, payment status, and order type as separate data fields.
- Update dashboard/report payment method labels to use the configured names. Historical methods such as card/other may still appear in historical reports if older payments used them.

## 3. Short payroll period labels

Simplify the payroll period dropdown. Each option should show only:

- The period identifier (week number within the calendar year for weekly schedule; correct period label for twice-monthly/monthly schedules).
- The covered dates.

Use a concise format such as `Week 42 (October 12–18)` for a weekly period. Calculate the correct week number consistently (use ISO week numbering and explain/label that convention in help text if needed). Include the year only when necessary to distinguish periods or at year boundaries.

- Remove verbose dropdown text like `Contains saved work dates` or repeated start/end date narration from each option. Put eligibility/processed explanations outside the dropdown as a small helper or status next to the selected period.
- Only offer payroll periods eligible under the configured schedule and paid/processed rules. Keep the selected period's covered dates easy to see after selection.
- For twice-monthly or monthly schedules, use concise labels such as `Period 1 (October 1–15)` or `October 2026`, rather than forcing a weekly label.
- The user-provided example `Week-52 (October 11 - October 25)` is illustrative of the desired compact `Week + covered dates` style; calculate actual period dates from the schedule and do not show an incorrect week/date combination.

## 4. Payroll register heading hierarchy

In Step 3, **Payroll register · review before saving**:

- Make the selected payroll period and covered dates the prominent heading/subheading. It should be the most visible contextual information in the section.
- Reduce `review before saving` and the save/reservation explanation to small helper text. It is only a reminder, not the main title.
- Keep employee count and included date range clear without repeating long explanations.
- Preserve the simple employee register rows and totals, Back to adjustments, and Save payroll register actions.

## 5. Payment tracking: explicit “For payment” starting state

The current payment dropdowns appear blank. Make the starting state explicit and provide an understandable paid workflow for every employee row in the batch.

- Each employee starts with a visible status/control labeled **For payment** (not blank). This means net pay is still unpaid/awaiting transfer.
- When the user clicks **For payment** or chooses **Mark paid/transferred**, reveal a compact inline panel or modal with:
  - **Date paid** — prefilled with today's Asia/Manila business date; editable if the payment occurred on a different date.
  - **Transfer/payment method** — optional and selected from enabled Settings payment methods (Cash, GCash, Bank transfer by default).
  - **Remarks** — optional short note.
  - Clear actions: **Confirm paid** and **Back / Keep for payment**.
- After confirmation, the row shows a clear **Paid** or **Paid/Transferred** badge and the saved date. Do not mark as paid just by opening the panel.
- Keep the batch view compact: employee name, net pay, and payment status are the main row content. Payment details should stay collapsed until requested.
- Provide a clear correction path to change Paid back to For payment; ask for confirmation and do not silently delete the previous payment information if the app supports payment correction history.
- Keep a single **Save payment status** action for the batch. Payment statuses/details should not be considered saved until the user confirms the batch save. If the current app saves each row immediately, preserve that behavior only if it is clearly communicated and the batch-level save is adjusted to prevent misleading unsaved UI.
- Show batch totals for total net pay, paid, and remaining for payment. A row in For payment counts as unpaid.
- Validate that Paid has a valid date. Method and remarks are optional as requested. Do not require a reference number.

## Design and data integrity

- Keep the current warm cream, espresso, and orange styling. Use compact badges and controls that still work on mobile/tablet.
- Preserve historical order payment labels and finalized payroll register amounts. Configuration changes affect new records, not historical ones.
- Use PHP formatting and Asia/Manila dates.
- Do not add activity logs or other unrelated tracking/storage.

## Acceptance walkthrough

Verify in the running app:

1. Settings show Cash, GCash, and Bank transfer enabled by default; disabled methods are absent from new customer payment forms.
2. Historical records using old methods remain readable and correctly reported.
3. Every order card/list row shows fulfillment, payment, and pickup/delivery badges without those three text captions.
4. Payroll period options are short and show the correct week/period plus covered dates; no eligibility prose is repeated in the dropdown.
5. Step 3 emphasizes the period dates and renders the review reminder as helper text.
6. Payment tracking starts each employee at `For payment`; opening it reveals today's prefilled date plus optional method/remarks, and only confirmation changes status to Paid.
7. Batch totals update correctly for paid and for-payment employees, and one batch save persists the selected statuses.

When complete, summarize where payment methods are configured, how the three order badges work, the period-label convention, and how to mark payroll as paid.

---

Use the existing `start-app.bat` to start the app after implementation.
