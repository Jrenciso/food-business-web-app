# Claude Code prompt: order edit rules, customer update details, and pickup permissions

Use this prompt in Claude Code with the existing Food Business Web App project open. The attached screenshots show the current Order Details modal, Customer Order Update modal, and a delivery ticket. Implement these changes in the existing application, preserving sample data and current UI styling.

---

You are continuing the existing food operations app. Inspect the current order status model, role permissions, order details, and customer order update image export before changing code. Implement the requirements below in the project, preserving saved orders and payments. Do not rebuild the app or return only a plan. Run the project's existing checks and resolve issues.

## 1. Lock editing for dispatched and completed orders

- If an order's fulfillment status is **Out for delivery** or **Completed**, the user must not be able to edit it.
- In the order details modal, hide or visibly disable the **Edit order** button and state why it is unavailable (for example, `Orders cannot be edited after dispatch or completion`).
- Enforce the same rule in the edit form, save handler, and data/business logic so a stale page or direct action cannot bypass the restriction.
- Keep editing available only for otherwise eligible statuses, subject to the existing role permissions and cancellation rules. Preserve payment history and totals for all locked orders.
- This rule applies regardless of whether the order is paid or unpaid. Do not conflate payment status with fulfillment status.

## 2. Show the item and payment breakdown on customer order updates

The current Customer Order Update preview shows the ticket number and order status but no itemized order details or payment state. Update both the preview and downloaded PNG so customers can see what they ordered and whether payment remains due.

Include:

- Business logo, business name, and tagline using the existing non-cropped responsive logo treatment.
- Ticket number and current customer-facing fulfillment status with a short status message.
- Pickup/delivery type and delivery area for delivery orders.
- Each item name, quantity, selected options/flavors/modifiers, and line total. Keep the layout readable for long orders and wrap text without clipping.
- Subtotal, discount if any, delivery fee if any, and final total, each clearly labeled.
- A clear **PAID** or **UNPAID** badge/label, amount collected, and remaining balance. If partially paid, display `PARTIALLY PAID` and the remaining balance, rather than falsely calling it paid. This is intended to help the owner follow up on payment.
- Updated date/time and a concise customer-appropriate footer.

Privacy and accuracy:

- Do not include private kitchen/service notes, internal employee notes, rider-only instructions, payment reference numbers, or other internal data in the customer update.
- Use the current saved order and payment ledger; do not infer payment from fulfillment status. Keep status and payment labels separate.
- Keep currency in PHP and format amounts consistently with the receipt.
- Make both the preview and downloaded image show the complete content. Wait for logo/fonts before export; ensure all rows are included even when the order is long. Use a safe descriptive filename such as `order-update-1003.png` and show success/error toast feedback.

## 3. Let kitchen staff and chefs mark pickup orders as picked up

- Make the **Picked up** action available to **Kitchen Staff** and **Chef** roles for orders whose type is **Pickup**, when the current status allows the transition (normally after Ready).
- Preserve the existing allowed transition rules. A pickup order marked Picked up should progress to the appropriate completed state if that is how the current workflow models pickup handoff; do not make it appear as a delivery dispatch.
- Keep Rider permissions and delivery transitions unchanged. Do not show Kitchen/Chef the delivery `Out for delivery` action unless existing policy explicitly grants it.
- Show the button in the appropriate ticket/detail controls and ensure the role-guarded action works after refresh and is reflected in status history.
- Owner retains access to all valid transitions. Prevent invalid status transitions and duplicate timestamp entries.

## Acceptance walkthrough

Verify in the running app:

1. An eligible New/Preparing/Ready order can be edited by an authorized user.
2. Orders Out for delivery and Completed show editing as unavailable and cannot be saved via the edit handler.
3. A customer update preview and downloaded image show item lines, options, totals, delivery details, and accurate Paid / Partially paid / Unpaid state with collected and remaining amounts, but no internal notes or payment reference.
4. A Kitchen Staff and a Chef can mark a Ready pickup order Picked up; those roles do not receive delivery dispatch controls from this change.
5. Owner and Rider workflows still respect their existing permissions.

Summarize the implementation and any workflow assumptions when done.

---

Use the project's existing `start-app.bat` to start the app after implementation.
