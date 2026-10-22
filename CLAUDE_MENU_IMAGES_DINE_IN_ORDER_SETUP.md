# Claude Code Prompt: Menu # Claude Code Prompt: Menu Images, Order Display Settings, and Dine-In

Improve the existing Urban Casero operations app in this repository. Inspect the current menu, order-entry workflow, settings, data model, Supabase persistence, role permissions, and mobile layouts before editing. Extend the existing app; preserve existing orders, menu items, employee access, sample data, and live/shared workspace behavior. Do not replace the app with a new scaffold.

## 1. Add an image option for every menu item

- In menu management, make it possible to add, replace, preview, and remove an image for every item, both when creating and editing an item.
- Images are optional per item. Items without an uploaded image must continue to display cleanly using a consistent fallback graphic or initials.
- Validate supported image types and file size. Resize/compress large uploads where practical, preserve aspect ratio, and show clear upload/progress/error states.
- Persist image references in the existing backend/storage approach. For Supabase, use a private or appropriately scoped Storage bucket with policies that restrict writes to authorized business owners and reads to signed-in members of the same business. Do not store large base64 image strings in the main database or browser local storage.
- Preserve current images and data during migration. If images are unavailable in sample data, show the fallback without breaking ordering.

## 2. Add owner settings for new-order item display

Add a clear **New order display** section in Settings with owner controls for:

- **Item appearance:** show images or use a compact no-image presentation.
- **Layout:** choose a tile/grid view or a list view.
- **Default tile size:** compact, standard, or large when tile view is selected.
- **Visible order types:** choose which of Pickup, Take-out, Delivery, and Dine-in are available in New order. Support one or more active types, and prevent disabling every type.
- Provide sensible defaults consistent with the current business setup. Settings should persist per business, load correctly after refresh and sign-in on another device, and apply only to the new-order screen.
- Apply the image/layout settings consistently and responsively on desktop, tablet, and mobile. Keep category filtering, search, favorites, manual item order, item price, and add-to-ticket interactions working in both layouts.
- In list view, make each row easy to scan and tap, with item name, category, price, optional thumbnail, and a clear add control. In tile view, use the selected size and optional image without cropping important content.

## 3. Add Dine-in and Take-out as order types

- Support four order types: **Pickup**, **Take-out**, **Delivery**, and **Dine-in** throughout order creation, order tickets, order detail, receipts, reports, and relevant filters.
- Keep Pickup and Take-out as separate labels and report values. Treat both as customer collection without a delivery fee, area, address, or rider. Use Pickup for an order placed ahead for later collection; use Take-out for an immediate counter order to be carried away. If the existing app has a specific pickup convention, preserve it and document the distinction in the UI with short helper text.
- Make the backend fully ready to create and persist Dine-in and Take-out orders. Update canonical order types in application types, database schema/constraints, Supabase RPCs or Edge Functions, validation schemas, read/write queries, and generated database types. Orders of both types must survive reload, sign-in on another device, and shared-workspace synchronization.
- Add additive database migrations for the new order types. Backfill nothing unless required; existing Pickup and Delivery records and their stored totals must remain unchanged. Ensure old records remain valid and new writes accept only supported types with clear validation errors.
- Update server-side order creation and mutation validation so Dine-in and Take-out are accepted and correctly validated. Enforce that all non-delivery order types have no delivery area, delivery fee, delivery address requirement, or rider assignment; reject inconsistent payloads instead of trusting the UI to omit those fields.
- Update all backend queries, filters, reports, exports, status transitions, payment workflows, and receipt data generation that assume only Pickup or Delivery. Confirm Dine-in and Take-out orders are included in sales and payment totals once, and never receive a delivery fee accidentally.
- Keep the order type in the ticket/order model and preserve existing Pickup/Delivery records unchanged.
- Dine-in and Take-out must not require a delivery area, delivery fee, rider assignment, or delivery address. Hide those fields for these types and do not charge a delivery fee.
- Provide a simple optional table number or dine-in reference field if useful to identify the customer/order. Do not require a table-management subsystem for this MVP.
- Keep customer name/contact requirements consistent with the current POS workflow; do not add unnecessary fields just because the order is dine-in.
- Ensure status transitions and role permissions handle Dine-in sensibly. Do not show delivery-only rider actions for Dine-in tickets.
- Update payment, receipt, and analytics calculations so Dine-in orders behave like other sales, with no accidental delivery charge.

## 4. Change the new-order workflow to selector-first

Replace the current order type tabs/dropdown flow with a dedicated first step, like a point-of-sale register:

1. When the user opens New order with no active ticket, show a simple **Order type** heading and only large, touch-friendly buttons for the order types enabled in Settings. Do not show the menu, item categories, cart fields, customer form, delivery fields, tabs, or other order controls at this initial step.
2. Do not preselect an order type. The user must deliberately tap one of the available buttons before starting the ticket.
3. After selection, lock that order type for the new ticket and open the POS workspace: menu/search/categories and item tiles or list become available, with the active ticket and relevant customer/order fields alongside or below. Show the chosen type clearly in the ticket header.
4. Provide a deliberate **Change order type** action before any item has been added. If the cart already has items, require the user to clear/cancel that draft ticket before selecting another type; never silently change a populated ticket's type or discard its fields.
5. Show delivery fields only for Delivery. Show optional table/reference only for Dine-in. Pickup and Take-out should not show delivery-only fields.
6. Keep the item menu and active ticket visible and usable while building the order. Make the primary **Place order** action and running total easy to reach.
7. On phones and tablets, make the order-type start screen and buttons easy to tap, then use a responsive POS layout that does not require scrolling through unrelated fields to add items or place the order.

Use accessible buttons for the first order-type step. The selected type is locked for that ticket; this should be visually clear and should not look like an always-editable tab bar.

## 5. Settings and data safeguards

- Make all settings business-scoped and validate them server-side where applicable. Respect existing owner-only settings permissions.
- Persist enabled order types in the business settings model, with safe defaults for existing businesses. Validate that at least one type remains enabled. Since the user must select a type at the start of every new ticket, do not silently apply a default type.
- Make migrations additive and safe for existing records. Existing orders retain their original type and totals. Do not recalculate or rewrite historical order totals when adding Dine-in. Ensure database constraints, APIs, and backend validation all accept the new type.
- Preserve sample/demo data isolation and do not copy demo records into shared production storage.
- Keep image upload and settings usable for the existing username/email authentication and roles. Staff can use the configured new-order experience, but only authorized roles can manage menu images or settings.
- Keep payment method restrictions and existing delivery-fee settings intact.

## 6. Verification

Use the repository's existing build and test setup and run relevant checks. Verify:

1. Owner can upload, replace, preview, and remove images on both existing and new menu items; reload and sign in again to confirm persistence.
2. Large/unsupported image uploads are rejected or handled clearly, and items without images remain usable.
3. Image/no-image, tile/list, tile size, and enabled order-type settings persist per business and work on phone, tablet, and desktop.
4. Search, category filters, favorites, item ordering, and add-to-ticket work in both tile and list views.
5. The empty New order screen initially shows only enabled order-type buttons and no items or ticket fields. No type is preselected; tapping a button opens a ticket locked to that type.
6. Pickup, Take-out, Delivery, and Dine-in can each be created when enabled; disabled types are unavailable in New order. Pickup and Take-out remain distinct in ticket labels and reports.
7. Dine-in and Take-out do not show or charge delivery fees or require a rider/address, and their types are shown correctly on tickets, receipts, and reports.
8. Existing orders and existing sample/live data remain intact and retain their totals.
9. The selector-first POS flow is clear and touch-friendly on mobile/tablet, with no clipped controls or fields from other order types. Changing type cannot silently discard a populated draft.

At completion, summarize what changed, migrations or storage setup needed, checks actually run, and any production setup that remains. Do not claim production readiness if Supabase storage or configuration has not been deployed and verified.
Images, Order Display Settings, and Dine-In

Improve the existing Urban Casero operations app in this repository. Inspect the current menu, order-entry workflow, settings, data model, Supabase persistence, role permissions, and mobile layouts before editing. Extend the existing app; preserve existing orders, menu items, employee access, sample data, and live/shared workspace behavior. Do not replace the app with a new scaffold.

## 1. Add an image option for every menu item

- In menu management, make it possible to add, replace, preview, and remove an image for every item, both when creating and editing an item.
- Images are optional per item. Items without an uploaded image must continue to display cleanly using a consistent fallback graphic or initials.
- Validate supported image types and file size. Resize/compress large uploads where practical, preserve aspect ratio, and show clear upload/progress/error states.
- Persist image references in the existing backend/storage approach. For Supabase, use a private or appropriately scoped Storage bucket with policies that restrict writes to authorized business owners and reads to signed-in members of the same business. Do not store large base64 image strings in the main database or browser local storage.
- Preserve current images and data during migration. If images are unavailable in sample data, show the fallback without breaking ordering.

## 2. Add owner settings for new-order item display

Add a clear **New order display** section in Settings with owner controls for:

- **Item appearance:** show images or use a compact no-image presentation.
- **Layout:** choose a tile/grid view or a list view.
- **Default tile size:** compact, standard, or large when tile view is selected.
- **Visible order types:** choose which of Pickup, Delivery, and Dine-in are available in New order. Support one or more active types, and prevent disabling every type.
- Provide sensible defaults consistent with the current business setup. Settings should persist per business, load correctly after refresh and sign-in on another device, and apply only to the new-order screen.
- Apply the image/layout settings consistently and responsively on desktop, tablet, and mobile. Keep category filtering, search, favorites, manual item order, item price, and add-to-ticket interactions working in both layouts.
- In list view, make each row easy to scan and tap, with item name, category, price, optional thumbnail, and a clear add control. In tile view, use the selected size and optional image without cropping important content.

## 3. Add Dine-in as an order type

- Add **Dine-in** alongside Pickup and Delivery throughout order creation, order tickets, order detail, receipts, reports, and any relevant filters.
- Make the backend fully ready to create and persist Dine-in orders. Update the canonical order type in application types, database schema/constraints, Supabase RPCs or Edge Functions, validation schemas, read/write queries, and any generated database types. A Dine-in order must survive reload, sign-in on another device, and shared-workspace synchronization.
- Add additive database migrations for Dine-in and Take-out. Backfill nothing unless required; existing Pickup and Delivery records and their stored totals must remain unchanged. Ensure old records remain valid and new writes accept only supported order types with a clear error.
- Update server-side order creation and mutation validation so Dine-in and Take-out are accepted and correctly validated. Enforce that all non-delivery types have no delivery area, delivery fee, delivery address requirement, or rider assignment; reject inconsistent payloads instead of trusting the UI to omit those fields.
- Update all backend queries, filters, reports, exports, status transitions, payment workflows, and receipt data generation that assume only Pickup or Delivery. Confirm Dine-in and Take-out orders are included in sales and payment totals once, and never receive a delivery fee accidentally.
- Keep the order type in the ticket/order model and preserve existing Pickup/Delivery records unchanged.
- Dine-in and Take-out must not require a delivery area, delivery fee, rider assignment, or delivery address. Hide those fields for these types and do not charge a delivery fee.
- Provide a simple optional table number or dine-in reference field if useful to identify the customer/order. Do not require a table-management subsystem for this MVP.
- Keep customer name/contact requirements consistent with the current POS workflow; do not add unnecessary fields just because the order is dine-in.
- Ensure status transitions and role permissions handle Dine-in sensibly. Do not show delivery-only rider actions for Dine-in tickets.
- Update payment, receipt, and analytics calculations so Dine-in orders behave like other sales, with no accidental delivery charge.

## 4. Change the new-order workflow to selector-first

Replace the current order type tabs/dropdown with a dedicated first step, like a point-of-sale register:

1. With no active ticket, show a labeled **Order type** heading and only large, touch-friendly buttons for types enabled in Settings. Do not show the menu, categories, cart, customer form, delivery fields, tabs, or other order controls on this initial screen.
2. Do not preselect a type. The user must deliberately select one before starting the ticket.
3. After selection, lock that type for the ticket and open the POS workspace: menu/search/categories and item tiles or list become available, with the active ticket and relevant order fields alongside or below. Show the chosen type clearly in the ticket header.
4. Provide a deliberate **Change order type** action before any item is added. If the cart has items, require the user to clear/cancel that draft ticket before choosing another type; never silently change a populated ticket or discard its data.
5. Show delivery fields only for Delivery, optional table/reference only for Dine-in, and no delivery-only fields for Pickup or Take-out.
6. Keep the menu and active ticket visible while building the order. Make the primary **Place order** action and running total easy to reach.
7. On phones and tablets, keep the type selection and key POS actions touch-friendly and avoid forcing the user through irrelevant fields.

Use accessible buttons for the first order-type step. The selected type is locked for that ticket; it should not look like an always-editable tab bar.

## 5. Settings and data safeguards

- Make all settings business-scoped and validate them server-side where applicable. Respect existing owner-only settings permissions.
- Persist enabled order types in business settings with safe defaults for existing businesses. Validate that at least one type remains enabled. Since the user selects a type at the start of every ticket, do not silently apply a default type.
- Make migrations additive and safe for existing records. Existing orders retain their original type and totals. Do not recalculate or rewrite historical order totals when adding Dine-in. Ensure database constraints, APIs, and backend validation all accept the new type.
- Preserve sample/demo data isolation and do not copy demo records into shared production storage.
- Keep image upload and settings usable for the existing username/email authentication and roles. Staff can use the configured new-order experience, but only authorized roles can manage menu images or settings.
- Keep payment method restrictions and existing delivery-fee settings intact.

## 6. Verification

Use the repository's existing build and test setup and run relevant checks. Verify:

1. Owner can upload, replace, preview, and remove images on both existing and new menu items; reload and sign in again to confirm persistence.
2. Large/unsupported image uploads are rejected or handled clearly, and items without images remain usable.
3. Image/no-image, tile/list, tile size, and enabled order-type settings persist per business and work on phone, tablet, and desktop.
4. Search, category filters, favorites, item ordering, and add-to-ticket work in both tile and list views.
5. The empty New order screen initially shows only enabled order-type buttons and no items or ticket fields. No type is preselected; tapping a button opens a ticket locked to that type.
6. Pickup, Take-out, Delivery, and Dine-in can each be created when enabled; disabled types are unavailable. Pickup and Take-out remain distinct on tickets and reports.
7. Dine-in and Take-out do not show or charge delivery fees or require a rider/address, and their types appear correctly on tickets, receipts, and reports.
8. Existing orders and existing sample/live data remain intact and retain their totals.
9. The selector-first POS workflow is touch-friendly on mobile/tablet, with no clipped controls or irrelevant fields. Changing type cannot silently discard a populated draft.

At completion, summarize what changed, migrations or storage setup needed, checks actually run, and any production setup that remains. Do not claim production readiness if Supabase storage or configuration has not been deployed and verified.
