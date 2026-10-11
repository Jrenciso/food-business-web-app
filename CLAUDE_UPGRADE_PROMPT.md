# Claude Code prompt: upgrade the food-business operations app

Open this project in Claude Code and paste the prompt below. The existing app's current records are **test/demo data**. Preserve them as a clearly labeled demo dataset or provide a safe way to reset/replace them; do not treat them as the real prospect's business data. The menu below is transcribed from the attached Urban Casero menu photos. Two photos show the same Rice Meals page; seed that category only once. One vegetable item is cut off in the photo and is marked for owner verification.

---

You are a senior full-stack product engineer continuing an existing food-business operations web app. First inspect the current project, instructions, and implementation. Then make the changes in this project and run it. Do not replace a working application with an unrelated scaffold. Preserve useful existing features such as order tickets, payment logging, receipts, menu management, and role-based views while adapting the product to the requirements below. Treat all existing records as test data, not as the prospect's actual records. Do not claim the app has been deployed or that client-only demo roles are secure.

## Product context

This is a home-based food business. Orders are **delivery or pickup only**; there is no dine-in/table workflow. The current sample menu is for **Urban Casero – One-Stop Snackshop**, provided as initial test data. The owner will gradually change the business profile, menu, prices, employees, and operations to match the prospect. Make the business data editable and make it easy to clear/reset the sample data without losing business settings by accident.

Use Philippine pesos (₱) and Asia/Manila local dates/times by default. Store timestamps consistently and group attendance, orders, and reports by the business's configured timezone. Keep financial calculations accurate to the centavo.

## First inspect, then upgrade

1. Inspect the repo structure, README, existing data model, package scripts, and current app before editing.
2. Identify whether data is local-only or backed by a server/database. Preserve the existing persistence approach if it works. If this is a local demo, maintain refresh persistence and clearly explain single-device limitations. Do not silently migrate or discard existing user data.
3. Implement all requirements in the working UI, not as static mockups. Keep existing functionality that still fits.
4. Start the app and resolve runtime/build errors. Update the README with the new setup, demo-data, and payroll calculation rules.

## Business profile and branding

- In Settings, let the owner edit and save the business name, tagline, logo, phone/contact details, address/service area, currency, timezone, receipt footer, and accent color.
- Provide a logo upload with preview, replace, and remove actions. Persist it using the project's existing storage method; if browser storage size is a limitation, explain it and use a suitable file-storage approach when a backend already exists.
- Display the saved name, tagline, and logo consistently in the app shell, dashboard, receipts, and printable reports. Provide a polished fallback before a logo is uploaded.
- Offer a sample/test-data label and a confirmed reset/import path. Clearly distinguish sample transactions and menu from future real business records.

## Home-based delivery and pickup operations

- Remove dine-in and table selection from order creation, filters, metrics, and tickets. The only order types are **Pickup** and **Delivery**.
- Keep quick POS order entry: search/category-filter the menu, tap to add, change quantity, add item/order notes, capture customer name and contact, then place the order.
- For delivery, capture delivery address/area, optional landmark/directions, and assigned in-house rider. Show configurable delivery fee separately. For pickup, do not show or charge delivery fee.
- Show order status and payment status separately. Preserve item name and unit price snapshots when an order is placed. Keep receipt printing and itemized totals.
- Provide clear order tickets for kitchen and rider roles. Rider views should show only relevant delivery information and assigned deliveries. Use operational statuses that fit pickup and delivery; no dine-in stages.

## Owner dashboard

Create an owner dashboard that gives a concise view of the selected day and useful trends. Include:

- Today's order count, gross order total, discounts/refunds when supported, collected payments, outstanding balances, and average order value. Distinguish orders booked from money actually received.
- Pickup versus delivery order counts and totals; order-status counts; payment-method breakdown.
- Employees who worked today (unique employees with a recorded attendance entry), current attendance list, and today's labor cost based on the configured fixed rates and attendance policy.
- Best-selling menu items for today and a selectable date range. Rank by quantities sold and show sales revenue as a separate metric.
- Sales trend and labor cost trend for a useful recent period.
- Date-aware empty states and links/actions to the corresponding orders, attendance, menu analytics, or reports.

Do not mix unpaid order value with collected revenue. Exclude cancelled orders from sales. Show refunds and delivery fees separately where possible. Make formulas consistent across dashboard and reports.

## Employee list, attendance, and fixed salaries

- Provide an owner-only Employees/Staff area or well-organized Settings section to create, edit, deactivate, and view employees. Capture display name, optional contact, role, fixed pay rate, pay basis, active dates, and optional notes. Roles should include owner, kitchen staff, chef, and rider (and allow a simple custom display title if useful).
- Support fixed rates paid **per day** or **per month**. Store rate and effective date in a way that preserves historical calculations when rates change. Do not infer one rate basis from another.
- Provide a fast daily attendance log: choose local business date, mark each employee worked/not worked (or present/absent), record optional start/end times and notes, and save. Prevent accidental duplicate attendance records for an employee on the same date; allow authorized corrections with an audit trail or clear last-updated metadata.
- Show how many unique employees worked today and their attendance details. Let the owner browse attendance by date range and filter by employee.
- Define and display a transparent labor-cost calculation policy. For a **daily-rate** employee, each worked day accrues one daily rate (unless the owner explicitly records a partial-day adjustment). For a **monthly-rate** employee, expose a configurable accrual method (recommended: monthly salary divided by calendar days in the month, multiplied by attended days) and label it clearly. Keep the method consistent; do not silently treat monthly salary as a daily rate. Allow manual payroll adjustments with a reason and preserve them in the salary breakdown.
- Attendance-based labor cost is an operational estimate, not automatically a legal payroll result. Make no claims about statutory deductions, taxes, overtime, benefits, or compliance. This MVP computes the owner's configured fixed-rate breakdown only.

## Salary breakdown and labor expense report

- Let the owner choose an employee and payroll period (week, half-month, month, or custom dates) and generate a printable/downloadable salary breakdown.
- Each breakdown should show employee, role, rate and basis, covered dates, days attended, daily/monthly accrual calculation, adjustments with notes, gross computed pay, payments already recorded (if payment tracking is implemented), and remaining amount due. Do not fabricate deductions; show none unless the owner explicitly entered them as adjustments.
- Provide a labor expense report by day/week/month/custom period, with totals by employee and rate basis, attendance days, adjustments, and overall labor cost. Clearly identify estimate versus manually approved/paid payroll.
- Support CSV export and print view. Persist generated payroll runs or snapshots if the app already has durable data storage; keep historical rate/attendance details visible if employee rates are edited later.

## Orders, sales reports, and menu analytics

- Add order reports for today, yesterday, week, month, and custom date range. Include a filterable order listing and totals for order count, gross sales, discounts, refunds, delivery fees, paid/collected amount, outstanding amount, and pickup/delivery split.
- Add menu performance analytics ranked by most ordered, with units sold, order count containing the item, gross sales, and date range. Handle edited/deactivated items by reporting against historical order-line snapshots and stable item IDs where available.
- Include a simple readable chart and CSV export for orders and item performance. Use consistent timezone-aware boundaries and exclude cancelled orders from sales while still allowing cancelled tickets to appear in operational order listings.
- Keep labor expense reporting distinct from sales so the owner can compare revenue and labor cost without the app misleadingly presenting revenue as profit. There is no cost-of-goods data in this MVP, so do not label revenue minus payroll as net profit.

## Roles and practical access

- **Owner:** dashboard, all orders, menu, employees, attendance, payroll, sales reports, business settings, payment records.
- **Kitchen staff / Chef:** kitchen tickets and preparation statuses only; no salary, employee, business settings, or payment editing.
- **Rider:** assigned delivery tickets and delivery progression only; no menu, payroll, or settings access.
- Preserve or improve existing role selection. If this is a local demo, label demo role switching and enforce permissions throughout the UI/data actions while clearly documenting that production needs server-side authentication and authorization.

## Seed the menu from the attached photos

Create editable categories and items with the prices below, all in PHP. Seed the item names and prices exactly as listed. Menu photos contain no per-dish product photos; use clean category-colored placeholders until the owner uploads product images. Product names in ALL CAPS below can be displayed in readable title case if the original spelling remains searchable and is preserved as the item name.

### Ala Carte Dishes — Pork

| Item | Price |
|---|---:|
| Chinese Braised Ham Hock | ₱750 |
| Crispy Pata | ₱650 |
| Urban Casero Signature Ribs | ₱350 |
| Sweet & Sour Pork | ₱250 |
| Sinigang na Liempo | ₱250 |
| Kare-Kareng Bagnet | ₱200 |
| Sinigang na Bagnet | ₱200 |
| Pork Binagoongan | ₱170 |
| Tokwa't Baboy sa Tausi | ₱170 |
| Lechon Kawali | ₱160 |
| Chicharon Bulaklak | ₱160 |
| Pork Sisig | ₱160 |
| Tokwa't Baboy | ₱150 |
| Sizzling Hungarian | ₱140 |
| Pork Shanghai | ₱130 |
| Pork Siomai | ₱130 |
| Fried Pork BBQ | ₱130 |
| Tokwa Dinakdakan | ₱130 |

### Ala Carte Dishes — Beef

| Item | Price |
|---|---:|
| Beef Bulalo | ₱350 |
| Kalderetang Ribs ng Baka | ₱250 |
| Sinigang na Baka | ₱250 |
| Beef Teriyaki | ₱220 |
| Beef & Mushroom | ₱220 |
| Beef Broccoli | ₱220 |

### Ala Carte Dishes — Chicken

| Item | Price |
|---|---:|
| Chinese Savory Fried Chicken | ₱400 |
| Fried Chicken Neck | ₱200 |
| Chinese Chicken Feet | ₱170 |
| Chicken Fillet | ₱190 |
| Chicken Nuggets | ₱150 |

### Seafood & Grill

| Item | Price |
|---|---:|
| Cajun Seafood | ₱300 |
| Cheesy Bake Bangus | ₱300 |
| Inihaw na Liempo | ₱250 |
| Grilled Scallops | ₱220 |
| Shrimp Tempura | ₱220 |
| Chicken Neck Inasal | ₱200 |
| Shrimp Gambas | ₱200 |
| Camaron Rebosado | ₱200 |
| Beef Enoki Rolls | ₱180 |
| Sinugbang Bangus | ₱180 |
| Inihaw na Pusit | ₱150 |
| Inihaw na Tilapia | ₱150 |
| Pork Enoki Rolls | ₱150 |

### Vegetables

| Item | Price |
|---|---:|
| Beef Ampalaya | ₱200 |
| Augratin | ₱180 |
| Chopsuey | ₱150 |
| Talong Bagoong | ₱150 |
| Sipo Egg | ₱150 |
| Vegetable Misono (name cut off in photo; owner must verify) | ₱150 |

### Rice Meals

| Item | Price |
|---|---:|
| Grilled T-Bone | ₱240 |
| Grilled Porterhouse | ₱230 |
| Urban Casero Signature Ribs | ₱180 |
| Chixilog | ₱170 |
| Chicken Inasal (Petso) | ₱160 |
| Chicken Inasal (Paa) | ₱150 |
| Bangus Silog | ₱130 |
| Liempo Silog | ₱130 |
| Chicken Fillet Silog | ₱109 |
| Lechon Kawali Silog | ₱99 |
| Tapsilog | ₱99 |
| Chichabusilog | ₱99 |
| Fish Fillet Silog | ₱99 |
| Sisig Silog | ₱99 |
| Longasilog | ₱99 |
| Pork Chop Silog | ₱99 |
| Maling Silog | ₱95 |
| Hungarian Silog | ₱95 |
| Hotsilog | ₱80 |

The two Urban Casero Signature Ribs entries above are separate menu products in different categories and have different listed prices. Do not merge them.

### Rice Specialties

| Item | Price |
|---|---:|
| Seafood Rice | ₱300 |
| Yang Chow Rice | ₱300 |
| Crabmeat Fried Rice | ₱300 |
| Bagoong Rice | ₱250 |

### Soups

| Item | Price |
|---|---:|
| Cream of Asparagus | ₱180 |
| Cream of Spinach | ₱180 |
| Crab & Corn Soup | ₱150 |
| Oriental Soup | ₱150 |

### Pasta & Noodles

| Item | Price |
|---|---:|
| UC Shrimp Aglio Olio | ₱180 |
| Chicken Alfredo | ₱150 |
| Bacon & Mushroom Carbonara | ₱150 |
| Filipino-Italian Spaghetti | ₱150 |
| Chinese Savory Pancit Canton | ₱150 |
| Chicken Lomi | ₱150 |
| Palabok ala Quiapo | ₱120 |

### Chicken Wings — combos and flavor choices

Create four selectable combo sizes as distinct products or a single configurable product with these exact size/price choices:

| Combo | Price | Flavor selection |
|---|---:|---|
| 6 pcs (1 flavor) | ₱185 | Choose 1 flavor |
| 12 pcs (2 flavors) | ₱360 | Choose 2 flavors |
| 30 pcs (5 flavors) | ₱900 | Choose 5 flavors |
| 60 pcs (6 flavors) | ₱1,800 | Choose 6 flavors |

Offer these flavor choices with no extra charge unless the owner later edits them:

- Classic flavors: Classic, Garlic Parmesan, Teriyaki, Salted Egg, Honey Butter, Buttered Garlic, Hickory BBQ, Soy Garlic.
- Spicy flavors: Buffalo Spicy, Korean Spicy, Spicy Salted Egg, Buttered Garlic, Sriracha, Spicy Korean BBQ, Yangnyeom.

The printed photo lists Buttered Garlic in both flavor groups. Preserve one selectable Buttered Garlic flavor (or retain the group labels while avoiding duplicate choices). Enforce the combo's maximum flavor count, save selected flavors on the ticket, and show them on kitchen ticket/receipt. Do not invent separate prices for flavors.

### Extras

| Item | Price |
|---|---:|
| Cheese Sauce | ₱20 |
| Garlic Ranch | ₱20 |
| Extra Flavor | ₱30 |
| Jalapeño Cheese | ₱20 |

The photo does not clearly state whether any extras can be attached to particular items. Seed them as separate add-on items unless the existing app already has a suitable modifier system; keep the owner able to configure them.

## Visual direction

Use the attached menu's identity as inspiration: warm cream background, dark espresso/brown text and accents, and a golden-orange highlight. Preserve clear contrast and practical readability for counter operations. Put the editable business logo/name/tagline in the shell; do not bake the Urban Casero name into every screen. Build a compact owner dashboard and a fast POS, not a marketing landing page.

## Completion summary

When finished, tell me what changed, which menu items were seeded, where to edit the owner-confirmation item, how payroll is calculated, how to start the app, and any important persistence/security limitations. Give the exact local URL if the app is running.

---

### Starting the app

Use the existing `start-app.bat` from this project folder after Claude finishes the upgrade. Keep its command window open while using the app; press Ctrl+C to stop the development server.
