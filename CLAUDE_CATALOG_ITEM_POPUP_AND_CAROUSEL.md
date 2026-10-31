# Claude Code Prompt: Product Detail Popup and Auto-Sliding Catalog Carousel

Improve the customer-facing catalog/order experience in the existing application. When a user chooses to add a product, first show the existing product detail popup with its description and selection details. Also make the **Browse the catalog** carousel advance automatically at a calm, readable pace.

Inspect the current catalog, product-card actions, product detail dialog, cart state, and carousel implementation before changing code. Reuse the existing components, design system, product data, and cart/order logic. Implement this in the real app, not as a mockup.

## Product selection and add-to-cart flow

- Every product-add entry point must open the product detail popup first, including an **Add to cart** button or plus icon on a product card. Do not directly add the item to the cart from the card and bypass the popup.
- The popup should present the product image when available, item name, description, price, available choices/modifiers (including applicable wing flavors/extras), quantity controls, and any required selections using the existing product model.
- The user confirms with a clear **Add to cart** action inside the popup. Do not add the product until required choices are valid and the user confirms.
- If the user clicks a product card itself, open the same popup. Avoid creating two different detail experiences for card-click and add-button actions.
- Clearly show the updated item subtotal/price when quantity or priced modifiers change. Preserve correct item identity, selected modifiers, notes, quantity, and pricing in the cart.
- Prevent duplicate additions from double-clicks or repeated submission while the add action is processing. Show a concise success confirmation after a successful add.
- Provide a clear close/cancel action. Closing without confirming must not change the cart. Preserve the current cart if the dialog is opened for another product.
- Support editing an existing cart line using the same detail popup if the existing app already supports that flow; preserve its current behavior and update that line rather than creating a duplicate.
- Keep the popup responsive and accessible: on phone use a comfortable full-width/bottom-sheet or near-full-screen dialog; on tablet/desktop use a centered dialog. Ensure keyboard focus, Escape/close behavior, labels, validation feedback, and touch-sized controls work.

## Browse-the-catalog carousel

- Automatically advance one slide every **5 seconds**. Make this interval a named constant or existing setting so it can be changed without hunting through component logic.
- Provide visible previous/next controls and position indicators that support keyboard, screen-reader, and touch interaction. If slides represent categories or featured items, make the current position clear.
- Pause automatic movement while the user hovers over the carousel, focuses or interacts with it, touches/drags it, or when the page is hidden. Resume only after a reasonable idle period; do not move a slide while the user is reading or operating controls.
- Respect `prefers-reduced-motion`: disable automatic sliding for users who request reduced motion while keeping manual controls available.
- Stop timers cleanly when the component unmounts or the catalog route changes. Avoid overlapping timers, stale state, or unnecessary rerenders.
- Ensure touch swipes, arrows, and automatic movement do not conflict. Keep controls visible and usable at phone, tablet, and desktop widths.
- Do not auto-advance a single-slide or empty carousel. When the user manually changes slides, restart the 5-second interval from that interaction.

## Preserve existing behavior

- Do not change the source of truth for menu items, prices, modifiers, inventory/availability, cart totals, discounts, taxes/fees, order types, or checkout/payment behavior.
- Do not create orders or payments from the catalog popup. It only configures and adds items to the current cart.
- Keep disabled/unavailable items unavailable and apply the existing order-type and role rules.
- Do not seed, reset, or modify existing business or customer records.

## Implementation and verification

1. Trace all product-card and add-to-cart entry points so none bypass the detail popup.
2. Reuse the existing product detail component and cart mutation logic, adding a single consistent entry flow.
3. Implement the 5-second carousel interval with cleanup, user-interaction pause, and reduced-motion support.
4. Verify products with no modifiers, required modifiers, priced extras, quantity changes, cancel/close, repeated clicks, and existing cart contents.
5. Verify carousel manual controls, automatic advance timing, pause/resume, hidden-tab behavior, reduced motion, one/zero-slide cases, and phone/tablet/desktop layouts.
6. Run relevant existing checks/build and report files changed and scenarios actually verified.
