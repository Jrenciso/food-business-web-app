# Claude Code Prompt: Improve the Remarks Field Layout

Improve the cramped **Remarks** field in the order interface shown in the attached screenshot. The current text-entry area feels compressed and does not provide enough room to read or enter a useful note. Inspect the relevant order details, payment/refund, and edit forms to identify the remarks field(s) that use this layout, then make a focused UI improvement in the existing app.

## Design and interaction requirements

- Give the remarks input enough vertical space for several lines of text. Use a multiline textarea where remarks can be more than a short label or identifier.
- Make the field easy to find with a clear **Remarks** label and concise, helpful placeholder text. Keep it visually distinct from nearby amount, method, and reference fields.
- On desktop and tablet, place remarks in a comfortable full-width row or section instead of squeezing it into a narrow column beside unrelated controls. Keep related fields grouped logically.
- On phones, make the field span the available width, remain readable, and allow text entry without horizontal scrolling or controls being clipped.
- If the remarks field belongs to the refund controls visible in the screenshot, give the amount and action their own clear layout and let **Reason / reference** or remarks use a wider multiline field. Do not make the refund action overlap or share the text-entry area.
- Preserve entered content when validation fails or a save is retried. Keep existing save, edit, and submission behavior unchanged.
- Ensure labels, focus states, keyboard navigation, validation feedback, and accessible names work correctly. Avoid relying on color alone.
- Match the app’s existing visual style while improving spacing, alignment, readability, and touch-target size.

## Scope and verification

- Inspect existing components and styles before editing; reuse the current design system and avoid duplicate one-off styling where shared form styles are appropriate.
- Do not change order, payment, refund, or permissions logic. This task is a presentation and usability improvement.
- Check the affected form at desktop, tablet, and phone widths. Confirm a long, multi-line remark remains legible, editable, and saved without clipping or being lost.
- Implement the change in the existing application, then report the files changed and the responsive scenarios checked.
