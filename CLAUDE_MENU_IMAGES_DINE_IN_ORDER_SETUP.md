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
- **Visible order types:** choose which of Pickup, Delivery, and Dine-in are available in New order. Support one or more active types, and prevent disabling every type.
- Provide sensible defaults consistent with the current business setup. Settings should persist per business, load correctly after refresh and sign-in on another device, and apply only to the new-order screen.
- Apply the image/layout settings consistently and responsively on desktop, tablet, and mobile. Keep category filtering, search, favorites, manual item order, item price, and add-to-ticket interactions working in both layouts.
- In list view, make each row easy to scan and tap, with item name, category, price, optional thumbnail, and a clear add control. In tile view, use the selected size and optional image without cropping important content.

## 3. Add Dine-in as an order type

- Add **Dine-in** alongside Pickup and Delivery throughout order creation, order tickets, order detail, receipts, reports, and any relevant filters.
- Make the backend fully ready to create and persist Dine-in orders. Update the canonical order type in application types, database schema/constraints, Supabase RPCs or Edge Functions, validation schemas, read/write queries, and any generated database types. A Dine-in order must survive reload, sign-in on another device, and shared-workspace synchronization.
- Add an additive database migration for the new order type. Backfill nothing unless required; existing Pickup and Delivery records and their stored totals must remain unchanged. Ensure old records remain valid and new writes reject unsupported order types with a clear error.
- Update server-side order creation and mutation validation so Dine-in orders are accepted and correctly validated. Enforce that Dine-in has no delivery area, delivery fee, delivery address requirement, or rider assignment; reject inconsistent payloads instead of trusting the UI to omit those fields.
- Update all backend queries, filters, reports, exports, status transitions, payment workflows, and receipt data generation that assume only Pickup or Delivery. Confirm Dine-in orders are included in sales and payment totals once, and never receive a delivery fee accidentally.
- Keep the order type in the ticket/order model and preserve existing Pickup/Delivery records unchanged.
- Dine-in must not require a delivery area, delivery fee, rider assignment, or delivery address. Hide those fields when Dine-in is selected and do not charge a delivery fee.
- Provide a simple optional table number or dine-in reference field if useful to identify the customer/order. Do not require a table-management subsystem for this MVP.
- Keep customer name/contact requirements consistent with the current POS workflow; do not add unnecessary fields just because the order is dine-in.
- Ensure status transitions and role permissions handle Dine-in sensibly. Do not show delivery-only rider actions for Dine-in tickets.
- Update payment, receipt, and analytics calculations so Dine-in orders behave like other sales, with no accidental delivery charge.

## 4. Change the new-order workflow to selector-first

The current ticket panel uses Pickup and Delivery tabs. Replace that tab interaction with a clear order-type selection step at the top of the ticket panel:

1. Show a labeled **Order type** selector first, with only the types enabled in Settings.
2. Default to the configured default type, or the first enabled type if no default is set.
3. After selection, show the relevant order details and current ticket fields below it; show delivery fields only for Delivery and optional table/reference only for Dine-in.
4. Keep the item menu and ticket visible and usable while changing type. If changing type would invalidate already-entered fields (for example, a delivery location when switching to Pickup), explain the change and preserve or clear only fields that no longer apply.
5. On narrow screens, keep the order-type selector and key ticket actions easy to reach, without making the user scroll past a long list of irrelevant fields.

Use a native/select-style control or accessible custom selector that clearly shows the selected type and available choices. It should read as a configuration choice before order details, not as competing tabs.

## 5. Settings and data safeguards

- Make all settings business-scoped and validate them server-side where applicable. Respect existing owner-only settings permissions.
- Persist enabled order types and the default new-order type in the business settings model, with safe defaults for existing businesses. Validate that at least one type remains enabled and that the configured default is enabled.
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
5. Pickup, Delivery, and Dine-in can each be created when enabled; disabled types are unavailable in New order.
6. Dine-in does not show or charge delivery fees or require a rider/address, and its type is shown correctly on tickets, receipts, and reports.
7. Existing orders and existing sample/live data remain intact and retain their totals.
8. The selector-first order panel is clear and touch-friendly on mobile, with no clipped controls or fields from other order types.

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
- Add an additive database migration for the new order type. Backfill nothing unless required; existing Pickup and Delivery records and their stored totals must remain unchanged. Ensure old records remain valid and new writes reject unsupported order types with a clear error.
- Update server-side order creation and mutation validation so Dine-in orders are accepted and correctly validated. Enforce that Dine-in has no delivery area, delivery fee, delivery address requirement, or rider assignment; reject inconsistent payloads instead of trusting the UI to omit those fields.
- Update all backend queries, filters, reports, exports, status transitions, payment workflows, and receipt data generation that assume only Pickup or Delivery. Confirm Dine-in orders are included in sales and payment totals once, and never receive a delivery fee accidentally.
- Keep the order type in the ticket/order model and preserve existing Pickup/Delivery records unchanged.
- Dine-in must not require a delivery area, delivery fee, rider assignment, or delivery address. Hide those fields when Dine-in is selected and do not charge a delivery fee.
- Provide a simple optional table number or dine-in reference field if useful to identify the customer/order. Do not require a table-management subsystem for this MVP.
- Keep customer name/contact requirements consistent with the current POS workflow; do not add unnecessary fields just because the order is dine-in.
- Ensure status transitions and role permissions handle Dine-in sensibly. Do not show delivery-only rider actions for Dine-in tickets.
- Update payment, receipt, and analytics calculations so Dine-in orders behave like other sales, with no accidental delivery charge.

## 4. Change the new-order workflow to selector-first

The current ticket panel uses Pickup and Delivery tabs. Replace that tab interaction with a clear order-type selection step at the top of the ticket panel:

1. Show a labeled **Order type** selector first, with only the types enabled in Settings.
2. Default to the configured default type, or the first enabled type if no default is set.
3. After selection, show the relevant order details and current ticket fields below it; show delivery fields only for Delivery and optional table/reference only for Dine-in.
4. Keep the item menu and ticket visible and usable while changing type. If changing type would invalidate already-entered fields (for example, a delivery location when switching to Pickup), explain the change and preserve or clear only fields that no longer apply.
5. On narrow screens, keep the order-type selector and key ticket actions easy to reach, without making the user scroll past a long list of irrelevant fields.

Use a native/select-style control or accessible custom selector that clearly shows the selected type and available choices. It should read as a configuration choice before order details, not as competing tabs.

## 5. Settings and data safeguards

- Make all settings business-scoped and validate them server-side where applicable. Respect existing owner-only settings permissions.
- Persist enabled order types and the default new-order type in the business settings model, with safe defaults for existing businesses. Validate that at least one type remains enabled and that the configured default is enabled.
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
5. Pickup, Delivery, and Dine-in can each be created when enabled; disabled types are unavailable in New order.
6. Dine-in does not show or charge delivery fees or require a rider/address, and its type is shown correctly on tickets, receipts, and reports.
7. Existing orders and existing sample/live data remain intact and retain their totals.
8. The selector-first order panel is clear and touch-friendly on mobile, with no clipped controls or fields from other order types.

At completion, summarize what changed, migrations or storage setup needed, checks actually run, and any production setup that remains. Do not claim production readiness if Supabase storage or configuration has not been deployed and verified.
