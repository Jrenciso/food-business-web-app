# Claude Code Prompt: Configure Who Can Take Orders and Which Fields Each Order Type Uses

Extend the existing Urban Casero app's **New order settings** so the owner can control which roles may create orders and which customer/order fields appear for each order type. Inspect current roles, order creation routes, settings model, validation, Supabase persistence/RLS/RPCs, and historical order data before implementation. Preserve existing orders and workflows.

## 1. Configure roles allowed to create new orders

- Add a clear owner-only section to Settings → New order settings called **Who can take orders?**
- Show the app's actual roles as individual toggles or checkboxes with short descriptions: Owner, Kitchen staff, Chef, and Rider. Use the existing role names/identifiers in the code.
- Owner must always retain access and cannot be disabled. Let the owner enable or disable new order creation for each non-owner role independently.
- Save these permissions per business and sync them through the existing backend. Use safe defaults for existing businesses that preserve current behavior unless the owner explicitly changes it.
- When a role cannot create orders, remove/disable the New order navigation and entry controls for that role and show a brief explanation if they navigate directly to the route.
- Enforce the same setting server-side on every order creation path, including Supabase RPCs/Edge Functions. Hiding the menu is not security. Continue to allow permitted roles to access the order tickets and status actions that their role already has.
- Do not grant riders access to unassigned orders or let this setting override delivery assignment or status-transition rules. A role allowed to create orders receives only that capability, not broader employee, menu, payroll, payment-refund, or settings permissions.
- For existing staff and live data, use additive migrations and safe defaults. Do not disable existing accounts or rewrite historical orders.

## 2. Configure fields by order type

Add a simple settings matrix for the four supported types: **Delivery**, **Take-out**, **Dine-in**, and **Pickup**. For each field, let the owner choose whether it is **Required**, **Optional**, or **Hidden**. Make the meaning clear in the UI and show a preview/example if useful.

Support the applicable fields:

- Customer name
- Mobile/contact number
- Delivery area
- Delivery address
- Landmark/directions
- Assigned rider
- Table number/dine-in reference
- Order notes/instructions

Use safe business defaults, including:

- **Delivery:** customer name required; mobile/contact required; delivery area required; delivery address required; assigned rider required; landmark optional; order notes optional; dine-in reference hidden.
- **Dine-in:** mobile/contact hidden and not collected; delivery area/address/landmark/rider hidden; dine-in table/reference optional; order notes optional. Make customer name required by default, while allowing the owner to configure non-system fields as appropriate.
- **Take-out:** no delivery area/address/landmark/rider; customer name and mobile/contact configurable; order notes optional; dine-in reference hidden.
- **Pickup:** no delivery area/address/landmark/rider; customer name and mobile/contact configurable; order notes optional; dine-in reference hidden.

## 3. Apply settings consistently in order entry and output

- Render only fields configured as Required or Optional for the selected order type. Hidden fields must not appear in the form or be included in customer-facing order updates/receipts unless the data already exists on a historical order.
- Required fields must be marked clearly, validated before placing an order, and included in accessible error messages. Optional fields must not block submission. Hidden fields must be cleared from a new draft when changing to a type where they do not apply, with a clear explanation if the user entered a value.
- When the user changes order type, retain only data that is applicable and allowed in both types. Never silently transfer a delivery address or rider to a dine-in/pickup/take-out ticket.
- For Dine-in, do not render a mobile/contact input and do not save a newly entered phone/contact value. Existing historical contact values must remain intact, but do not show them in newly generated dine-in customer-facing outputs if the field is hidden.
- Keep contact requirements conditional. Do not globally require a contact number in shared validation if the selected order type's settings make it hidden or optional.
- Update order types, order edit forms, customer order updates, receipts, exports, and reports to handle a missing contact number without showing `undefined`, `null`, placeholder text, or a validation failure.
- Preserve delivery invariants even if someone changes field settings: Delivery must always require an active delivery area, a valid address, and an active assigned rider if those are necessary to fulfill the current business workflow. These system-critical fields cannot be made hidden in Settings. Explain locked requirements in the settings UI.
- Prevent non-delivery types from receiving delivery fees, areas, addresses, or rider assignments regardless of client-submitted data.

## 4. Validation and data integrity

- Store role permissions and field visibility/requiredness in the business-scoped settings model with schema validation, database constraints where appropriate, and backwards-compatible defaults.
- Validate settings on save: Owner is fixed as allowed; supported roles/fields/order types only; delivery-critical fields remain enforced; each field state must be one of Required/Optional/Hidden.
- Enforce configured fields and role permissions in trusted server-side order creation/update operations. Never rely only on the React form.
- Use additive migrations and preserve existing tickets, contacts, receipts, payments, and test data. Historical records must remain readable even when new-order settings change.
- Keep Sample/Test workspace records isolated from Shared production data.

## 5. Verification

Use the repository's existing build/test setup and run relevant checks. Verify:

1. Owner always can take orders; each non-owner role can be independently enabled/disabled.
2. Disabled roles cannot create orders through the UI or direct backend calls, but retain their existing allowed ticket/status/payment visibility capabilities.
3. Delivery requires a contact number, address, active area, and assigned rider; missing any blocks submission with a clear message.
4. Dine-in renders no contact/mobile number input and accepts an order with the configured fields; no newly entered contact value is stored or shown in its customer-facing update/receipt.
5. Pickup and Take-out show only their configured fields and can be placed when optional contact details are absent.
6. Hidden fields are cleared safely when changing order type; delivery-specific details cannot leak into other types.
7. Receipts, order updates, reports, and historical orders handle absent contacts cleanly.
8. Settings persist after refresh/sign-in and work in Shared and Sample/Test modes without mixing data.
9. Mobile/tablet order entry remains easy to use, with clear required markers and no clipped fields.

At completion, summarize the role permissions and default field matrix, migrations changed, checks actually run, and any deployment steps needed. Do not claim the live backend is updated until migrations and server-side functions have been deployed and verified.
