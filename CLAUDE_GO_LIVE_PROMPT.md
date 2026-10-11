# Claude Code prompt: prepare the food operations app for go-live

Open the existing food-business web app in Claude Code and paste the prompt below. The attached screenshots show the current app; keep its warm cream / espresso / orange visual identity and its sample Urban Casero workspace. Keep the sample/test data available after launch so the owner can continue exploring the system.

---

You are a senior full-stack engineer taking an existing food-business POS and operations app from demo toward go-live. Inspect the actual project, existing implementation, repository instructions, persistence, and package scripts before editing. Implement the requirements below in the app itself, run it, and fix build/runtime issues. Do not replace the existing app with a new scaffold or merely return a plan.

## Go-live and demo-data requirements

- Keep the existing Urban Casero sample/test workspace and all sample records accessible. Clearly label sample data as `SAMPLE / TEST DATA`; never silently mix demo transactions with live business transactions or reports.
- Provide an explicit workspace/data mode or a safe first-run flow to enter a live workspace while retaining the demo workspace. Make switching obvious and confirm before any destructive reset. Do not delete demo data as part of this upgrade.
- Review persistence before making claims about go-live. If the app is currently browser-local, explain that it is suitable only for a single browser/device demo and implement a production-capable shared backend only if the current project already has one configured or can use existing project configuration without inventing credentials. Never hard-code secrets. Document remaining deployment, backup, and authentication setup needed for real multi-user operation.
- Use existing framework, database, and conventions; preserve order history and existing features. Add appropriate validation, error handling, loading/empty states, and safe migration/default behavior.
- Keep Asia/Manila timezone and Philippine Peso (₱) defaults. Reports and daily activity must use the configured business timezone.

## Sign-in and user activity audit log

- Add a sign-in page as the entry point to the application, with a clean business-branded layout and clear error/validation states. Use the project's real authentication/backend if present. If none exists, implement a clearly marked local demo sign-in with selectable sample roles and document that it is not production security; do not present a client-only password check as secure authentication.
- Support owner, kitchen staff, chef, and rider access. Enforce role permissions on protected pages and actions, not only by hiding menu links. Owner can access dashboard, orders, menu, employees, attendance, payroll, reports, settings, and activity logs. Kitchen/chef can access assigned operational ticket views and allowed preparation status updates. Rider can access assigned deliveries and allowed delivery status updates.
- Add an owner-only **Activity log** page showing who did what and when throughout the app: sign-in/sign-out, order create/edit/cancel, payment changes, status changes, menu edits, employee/attendance/payroll changes, settings changes, workspace changes, and attempted permission-denied actions where practical. Include timestamp in Asia/Manila, actor, action, affected record, and useful before/after summary while avoiding unnecessary sensitive data. Add search and filters for date, user, action type, and record.
- Record activity through a central audit/event helper at the point the action is saved. Do not fabricate log rows for historical activity. Clearly mark any demo logs as sample activity. For live mode, audit records should be append-only through the supported backend/security rules; do not imply browser-only logs are tamper-proof.
- Show the signed-in user and role and provide sign-out. Never log passwords, authentication tokens, or full payment credentials.

## Delivery location pricing

Change delivery fees from a single generic fee to configurable delivery locations, selected per delivery order. Seed these exact locations and fees in settings:

| Delivery area | Fee |
|---|---:|
| Sonoma | ₱80 |
| Amaia / Phirst Park Pandi | ₱90 |
| Brighthomes / Primeville / EPDR / Calle, Malabon / Caysio Pabahay / Caypombo | ₱40 |
| Pintong Bato / Malawak / Sunrays / Villa Corazon | ₱40 |
| M. Sapa | ₱60 |

- Preserve the area labels as supplied. The long grouped labels above represent one selectable pricing area per line. Make it possible for the owner to rename labels, change fees, add aliases/notes, activate/deactivate a location, reorder the list, and add future delivery areas in **Settings → Delivery Areas & Fees**.
- In the order form, once Delivery is selected, require choosing a delivery area from the active configured locations. Automatically apply its current fee and show the area and fee in the live ticket, order record, receipt/invoice, and reports. For Pickup, hide the location control and charge no delivery fee.
- Store a snapshot of the selected delivery area label and fee on each placed order, so later settings changes do not rewrite old orders or receipts. Validate that the selected area is active when placing a new delivery order. Handle no configured areas with a clear owner-facing setup prompt.
- Let the owner optionally override the fee for a specific order only if the existing permissions support it; record the override and reason in activity history. Make the location pricing, not free-text customer address, the source of the automatic fee. Keep the customer's actual delivery address in its separate field.

## Receipt and invoice export

- Keep the current receipt preview and print action, and add a working **Download image** action to save the receipt as a PNG (or another common image format) using the browser. The downloaded image must render the complete receipt, including header, logo, business name/tagline, sample-data marker where applicable, ticket/date/order type, delivery area and fee when relevant, itemized lines/modifiers, subtotal/discount/total, payment status and balance, and footer.
- Ensure long receipts export fully rather than capturing only the currently visible or scrollable portion of the modal. Use a reliable DOM-to-image approach already in the project or add a suitable maintained library, handle font/logo loading before capture, provide a useful filename such as `receipt-<ticket-number>.png`, and show success/error feedback. Preserve print-friendly output too.
- Keep the receipt preview responsive and scrollable without clipping action buttons. Make download and print actions visible and accessible.

## Menu tile order, favorites, and size

- In menu management/settings, let the owner reorder items **within each category** by drag and drop and/or simple up/down controls. Save the order persistently and apply it consistently to POS, menu view, and the selected category.
- Let the owner star/unstar favorite items. Favorites appear before non-favorites within their category, with remaining items following their saved manual order. Clearly show the favorite indicator and make it operable by keyboard/touch.
- Add a POS control to change menu tile size (for example Compact / Comfortable / Large) so the owner can choose to see more items or larger, easier-to-tap cards. Persist this preference for the signed-in user/device. Ensure the layout responds cleanly at tablet and desktop widths and does not distort images or hide item names/prices.
- Preserve category selection, search, availability indicators, and quick-add interaction. Avoid unwanted reordering across categories.

## Toast notifications

- Replace or supplement subtle/inline transient feedback with clear toast notifications for important successful and failed actions: order placed, payment/status saved, menu/employee/settings changes, sign-in errors, validation failures, receipt download/print issues, and data reset/workspace changes.
- Toasts should be visually prominent in the current design, have readable text and status icons/colors, appear in a consistent non-obstructive location, support keyboard/screen-reader announcement, and dismiss after a sensible interval. Important destructive/error outcomes must not disappear before a user can understand them; allow manual dismissal. Do not use browser alert popups for normal feedback.

## Business logo layout correction

The current sidebar and receipt brand areas crop the uploaded logo because they force it into a small square. Fix all branding placements, including the sign-in page, sidebar/header, settings preview, receipt, and printable views:

- Give the logo its own dedicated row/block separate from the business name and tagline. In the app shell the sequence should be logo on one line, then business name, then tagline on separate text lines.
- Use a responsive logo container with the image fully visible (`object-fit: contain` or equivalent), preserve the uploaded image's natural aspect ratio, and never crop/stretch it. Allow a wide/horizontal logo as well as a square one. Use a sensible max height/width and enough breathing room; adjust layout around the image instead of forcing square dimensions.
- Add a preview in Settings that reflects the actual display behavior. Keep a polished placeholder for no uploaded logo. Do not modify or destructively crop the source image.

## Visual and workflow quality

- Follow the supplied screenshots' dark espresso sidebar, warm cream canvas, white cards, and orange accent. Keep strong readable contrast and make POS actions easy to scan and tap.
- Maintain the compact operations shell and sample-data banner, correcting logo/header layout as described. Do not add marketing-site content.
- Keep pickup and delivery as the only order types. Ensure delivery-area selection, ticket totals, dashboard metrics, receipts, and report calculations all agree.
- Preserve existing dashboard, attendance, payroll, staff, sales, and menu capabilities. Use sample data for demonstration while clearly separating it from any live workspace.
- Add tests only where the existing project already has a test setup; otherwise perform the build/start checks already used by the repo and manually verify the main workflows in the running app.

## Acceptance walkthrough

Before finishing, verify these flows in the running app:

1. Sign in as owner; open sample workspace and confirm its existing sample records remain available and visibly labeled.
2. Place a pickup order and confirm it has no delivery area/fee.
3. Place a delivery order, select each seeded area in turn, and confirm the appropriate fee is applied and snapshotted. Check one historical order after changing a configured fee.
4. Add or change a delivery area in settings and verify it becomes available for new delivery orders.
5. Download a full receipt image and print preview; confirm logo, tagline, itemization, area, fee, and totals are not cropped.
6. Favorite and reorder menu items, then change tile size and verify the POS reflects saved preferences.
7. Trigger successful and unsuccessful actions and confirm visible, accessible toast feedback.
8. Make representative changes to orders/menu/settings and confirm the owner activity log records actor, action, time, and target. Verify a staff role cannot access owner-only controls.
9. Sign out and return to the branded sign-in page.

## Completion response

Summarize the changes made, how to sign in to the demo/live workspace, how demo data is retained, where delivery areas and fees are configured, how to use receipt image download, and the app URL/start command. State honestly whether persistence and authentication are production-ready and list any remaining deployment configuration required for a real go-live.

---

Use the existing `start-app.bat` from the project folder to launch the app when implementation is complete.
