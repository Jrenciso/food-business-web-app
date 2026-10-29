# Claude Code Prompt: Fix Unknown Character in Item Quantities

Fix the garbled or unknown character shown before item names in the **Items sold** section of the attached business-day report screenshot. For example, entries currently appear like `1� Oriental Soup` instead of a readable quantity and separator.

## Requirements

- Inspect the report rendering, quantity-formatting code, stored text/data path, and fonts/encoding used by this view. Identify the actual source of the replacement/unknown glyph instead of hiding it with CSS or removing the quantity.
- Display quantities consistently and legibly, such as `1 × Oriental Soup` or the plain-text fallback `1 x Oriental Soup` if the multiplication glyph is not reliably supported by the app’s fonts/rendering pipeline.
- Preserve the actual numeric quantity and item name. Do not alter sales calculations, item aggregation, database records, or export values.
- Check related report, receipt, ticket, CSV, and mobile views for the same encoding or glyph issue when they reuse the formatter. Correct shared formatting only where appropriate.
- Ensure the chosen separator is valid end-to-end: source file encoding, API/data handling, HTML rendering, fonts, and CSV/export encoding where applicable. Do not introduce mojibake or malformed replacement characters.
- Keep the item rows readable and responsive, with quantity/item text aligned consistently and prices unchanged.

Inspect the existing implementation first, then implement a focused fix in the real application. Verify multiple quantities and item names in the business-day report, plus any related views affected by the shared formatter. Report the root cause, files changed, and scenarios checked.
