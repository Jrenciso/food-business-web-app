# Claude build prompt: small food-business POS MVP

Copy the prompt below into Claude Code with this folder open as the project. Have Claude create and run the app here.

---

You are a senior full-stack product engineer. Build a polished, usable MVP web app for small food businesses: a counter POS, order-ticket tracker, menu manager, and lightweight sales dashboard. Build the actual working application in the current project folder, not just a plan or mockup. Make sensible product and technical decisions without stopping for routine questions. Start the app and resolve build/runtime errors before you finish.

## Product goal

Help an owner and their small team manage a food business's menu and day-to-day orders in one simple operations app. Prioritize fast order entry on a laptop or tablet, legible kitchen tickets, accurate totals, and useful sales summaries. This is an internal operations tool, not a public ordering website or multi-location enterprise platform.

## Recommended implementation

- Use the framework and package manager already present if this folder contains a project. Otherwise create a TypeScript React app using Vite, Tailwind CSS, and a lightweight component/icon library.
- Persist data between refreshes. For a single-device MVP, use local storage behind a small data-access layer and include realistic seeded demo data. Keep the data layer structured so a hosted database and authentication can replace it later. Do not pretend local storage is secure multi-user cloud storage.
- If a backend is already configured, use it for persistence and authentication rather than replacing it. Never put secrets in client code.
- Make the app responsive and usable on a touchscreen. Use accessible labels, keyboard-friendly controls, clear empty states, validation, and confirmation before destructive actions.

## Main application shell

Create a branded application shell with a left navigation/sidebar and clear active location. Include these pages:

1. **POS / New order** — make this the main, fastest workflow.
2. **Orders / Tickets** — a live operational order list and status board.
3. **Menu** — categories and item management.
4. **Sales / Reports** — date-filtered summaries and reports.
5. **Settings** — business profile, appearance, delivery fee, and team roles.

Show the business name, a clear current date/time, and the signed-in demo user's role. Include useful sample data on first launch, plus a way to reset the demo data in settings.

## POS workflow

- Display menu categories as tabs or filters (for example: Meals, Snacks, Drinks); show food/drink categories and allow an owner to add, rename, reorder, and remove categories.
- Display menu items as image-supported cards with item name, category, price, availability, and optional description. Use a tasteful placeholder when an item has no image. Allow image URL or local file selection if practical; explain any browser-local image limitation in the UI.
- Search and filter items. Tapping/clicking an item adds it to the current order. The cart supports quantity increase/decrease, removal, and an optional item note.
- Capture order type (dine-in, pickup, or delivery), optional customer name/contact, and order notes. For dine-in, allow a table/seat label.
- Show a readable price breakdown: item subtotal, optional delivery fee, optional discount, and final total. Use Philippine peso (₱) formatting by default, configurable in settings; calculate amounts in integer minor units or otherwise avoid floating-point rounding errors.
- Include a configurable in-house rider fee for delivery. The owner can set a default fee, and an authorized user can override it per delivery order. Do not add the fee to dine-in/pickup orders. Show the fee separately in the ticket and receipt.
- Provide a clear **Place order** action. Validate the cart and required fields. Assign a human-readable order/ticket number and timestamp. Creating an order must not imply it has been paid.
- After placing an order, show a print-friendly receipt view with business name/logo, order number, date/time, order type, itemized quantities and prices, subtotal, delivery fee/discount when applicable, total, payment status/method/reference when recorded, and a short thank-you footer. Include a working browser print action.
- Support starting a fresh order without losing the saved ticket. Include a confirmation before clearing a non-empty in-progress cart.

## Orders and kitchen tickets

- Show searchable/filterable orders with ticket number, time, customer/table, order type, line-item summary, total, payment state, and fulfilment status.
- Provide useful status stages such as **New**, **Preparing**, **Ready**, **Out for delivery**, **Completed**, and **Cancelled**. Allow authorized roles to advance status; show timestamps for creation and status changes. Avoid nonsensical transitions (for example, cancelled tickets should not be advanced as active tickets).
- Offer a board view suitable for kitchen staff, with large readable ticket cards, notes, elapsed time, and quick status controls, as well as a compact list view for the owner.
- Track payment independently from fulfilment status. Payment states: unpaid, partially paid, paid, refunded. Record payment method (cash, card, e-wallet, bank transfer, other), amount, time, and optional reference number. Support multiple payment entries for split/partial payments and show remaining balance. Prevent overpayment unless the app explicitly records change given for cash.
- Provide a print-friendly ticket/receipt from an order. Never silently change an order's recorded prices when the menu price later changes; save item name and unit price snapshots on each order line.

## Menu management

- Create, edit, deactivate/reactivate, and delete menu items. Each item has name, description, category, price, optional image, and availability. Prevent accidental deletion of an item used in old tickets, or preserve historical order snapshots.
- Create, edit, reorder, and delete categories. Prevent deletion of a non-empty category until its items have been reassigned or the user confirms a clear migration path.
- Add a few editable example items and categories so the POS is immediately understandable.

## Sales and reports

- Provide date presets (today, yesterday, last 7 days, this month) and a custom date range.
- Show gross order sales, discounts, delivery fees, refunds, net collected revenue, outstanding balance, order count, average order value, and paid/unpaid counts. Label metrics precisely: distinguish order totals from money actually collected; exclude cancelled tickets from sales and account for refunds.
- Include an easy-to-read sales-over-time chart, orders by fulfilment status, popular items by quantity/revenue, and payment-method totals. A simple export to CSV for the selected period is valuable.
- Keep calculations consistent with order and payment records. Clearly indicate the selected reporting period and empty-data states.

## Roles and permissions

Implement role-aware navigation and actions with these roles:

- **Owner:** all pages and actions, including settings, menu, reports, payments/refunds, and team roles.
- **Kitchen staff:** view the kitchen ticket board and order details; advance preparation/ready statuses; cannot edit menu/prices, settings, or payments.
- **Chef:** view tickets and mark preparing/ready; cannot edit prices, settings, or payments.
- **Rider:** see delivery tickets assigned to them, relevant customer/delivery details, and mark picked up/out for delivery/completed; cannot edit menu, settings, or payment records.

For this MVP, include a demo role switcher in the profile/settings area so each experience can be previewed without building a production identity system. Label it clearly as a demo. Enforce role checks in the interface and action/data layer, not just by hiding navigation. State in the code/readme that client-only demo roles are not a security boundary; production needs server-side authentication and authorization. Include sensible demo accounts/roles if useful.

## Settings and appearance

- Edit business name, optional logo, currency, receipt footer, and default in-house delivery fee.
- Allow selecting a small set of accessible accent colors and light/dark appearance. Apply choices throughout the app and save them.
- Include a simple team/role management interface appropriate to the demo; do not imply it creates secure real user accounts.
- Include demo-data reset with a confirmation.

## Design direction

Design a clean, confident food-service operations tool: warm neutral background, dark readable text, one vivid configurable accent, generous spacing, restrained borders/shadows, and clear status colors. Make the POS grid and current ticket the visual focus. Optimize for quick scanning and low-friction counter use. Avoid generic landing-page sections, excessive gradients, tiny text, and decorative elements that compete with order entry. Use realistic sample menu photos only if available without brittle external dependencies; otherwise use polished category-colored placeholders.

## Quality and delivery

- Implement working navigation, CRUD flows, order creation, status changes, payment logging, receipt printing, reports, export, settings persistence, and role-aware behavior. Do not leave prominent buttons as nonfunctional mockups.
- Handle invalid forms, empty states, long names, zero results, cancelled orders, partial payments, and refresh persistence.
- Keep components and business calculations organized. Add a README with setup instructions, the demo persistence/authentication limitations, and how to run the app.
- When finished, run the available development/build checks, fix errors, launch the app, and summarize what works, the local URL, and any limitations.

---

## Windows quick start

After Claude has generated the project, double-click `start-app.bat` in this folder to install dependencies when needed and run the development server. Keep the command window open while using the app; press Ctrl+C to stop it.
