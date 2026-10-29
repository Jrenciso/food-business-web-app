# Claude Code Prompt: App-Wide UI/UX and Design System Refresh

Improve the overall visual quality, consistency, and usability of this food-business POS application. The attached screenshot is one example of the current experience: typography is small and inconsistent, spacing and hierarchy need refinement, and the ticket details modal feels crowded and difficult to scan. Treat this as an **app-wide design and layout improvement**, not a one-module restyle.

Work in the existing application. First inspect its routes, shared layout, design tokens, reusable components, responsive breakpoints, role-based views, and current workflows. Then establish and apply a coherent design system across all enabled modules while preserving the existing product identity and business behavior.

## Goals

- Make the app feel polished, calm, trustworthy, and designed for real fast-paced food-service operations.
- Improve hierarchy so users can quickly identify the page title, primary action, status, important totals, and next step.
- Make text comfortable to read at normal browser zoom, with consistent font families, sizes, weights, line heights, and contrast.
- Use consistent spacing, alignment, borders, radii, shadows, icon sizing, button heights, form controls, badges, cards, tables, empty states, and feedback.
- Keep screens efficient and scannable; use clear grouping and progressive disclosure instead of dense forms, excessive cards, or decoration.
- Preserve the current brand palette and uploaded business logo, while refining tokens and contrast. Continue respecting business-specific appearance settings and avoid hardcoding a theme that overrides user configuration.

## App-wide scope

Audit and update the shared application shell and every existing route/module, including the dashboard, new order/POS, orders and ticket board/list/details, menu, employees, attendance, payroll, reports, settings, business register/day workflows, and rider views. Include shared dialogs, receipts, confirmation screens, toasts, forms, filters, tables, mobile navigation, loading/error states, and role-specific navigation. Apply a single system so the modules look related and predictable.

Do not remove a module, control, field, report, permission, or workflow merely to simplify the design. Respect module enable/disable settings and role permissions. Where a module is disabled, its navigation and dependent UI should follow the app’s existing configuration and not leave broken links or dead-end workflows.

## Design system

Create or refine shared design tokens and reusable components for:

- Typography: a readable, consistent font stack; a deliberate type scale for page titles, section titles, labels, body text, supporting text, and numeric totals. Avoid tiny text for essential content.
- Color: accessible text/background contrast, semantic status colors, and restrained brand accents. Never use color alone to communicate status.
- Layout: consistent page gutters, content widths, section spacing, grid behavior, and responsive breakpoints.
- Controls: buttons with clear primary/secondary/destructive hierarchy, consistent sizes, visible focus, disabled/loading states, and touch-friendly targets.
- Data display: concise status badges, aligned currency values, tables that adapt to smaller screens, consistent cards, and useful empty/loading/error states.
- Feedback: readable toast notifications, inline validation, confirmation prompts for consequential actions, and clear save states.

Prefer extending existing shared styles/components over adding one-off overrides. Keep styles maintainable and avoid regressions in business-specific theme customization.

## Ticket detail modal shown in the screenshot

Use this as a representative improvement:

- Make the modal fit within the viewport, with a stable header and footer and one intentional, independently scrollable content region.
- Improve typography and spacing so ticket identity, order/payment/type badges, customer or delivery details, line items, totals, payments, refund controls, status history, and actions are easy to scan.
- Align item names and prices; format totals consistently; visually distinguish the amount due and payment state.
- Keep long remarks readable and avoid compressing them into narrow columns.
- Keep refund entry collapsed by default as previously requested; retain payment history and the fully-paid state.
- On phones and tablets, use a near-full-screen or full-screen dialog where appropriate, with readable content, accessible close/back controls, and actions that remain reachable without covering form fields.
- Preserve every existing action and permission, including order updates, payment/refund workflows, receipts, download, and edit where the current status allows it.

## Responsive and operational usability

Design mobile-first for the actual operating context: staff may use phones or tablets while taking orders, checking tickets, updating fulfillment, collecting payments, and recording attendance. Desktop remains efficient for owners doing reporting and configuration.

- On phones, prioritize one-column layouts, clear touch targets, concise controls, and persistent primary actions only where they do not obscure content.
- On tablets, use available width intelligently without shrinking text or stretching forms excessively.
- On desktop, maintain readable line lengths and avoid oversized empty regions or unnecessarily wide dialog content.
- Ensure order entry remains fast: category/item navigation, cart/ticket summary, order-type requirements, payment entry, and finalize action should remain easy to reach at every supported width.
- Prevent horizontal page overflow, clipped fields, hidden ticket actions, nested scroll traps, and text overlap.

## Preserve behavior and data

- Treat this as a visual and interaction-quality pass. Do not rewrite backend architecture, change schemas, reset databases, seed data, or alter business rules unless a small change is essential to make an existing control usable; explain any such necessary change.
- Preserve all existing data, order/payment state, payroll and attendance calculations, settings, permissions, integrations, and server-side validation.
- Keep amounts, payment statuses, and operational actions accurate. Do not fake persisted/saved states.
- Do not hardcode demo data or credentials into the interface.

## Implementation and verification

1. Audit the existing app and identify shared design primitives and inconsistent patterns before editing.
2. Define the type scale, spacing, color, control, and layout rules, then apply them consistently through reusable components/tokens.
3. Refine each route and shared overlay without trimming established workflows.
4. Check representative flows for owner, kitchen/chef, and rider roles, including new order, ticket details/status updates, payment/refund, dashboard/report, and attendance/payroll if enabled.
5. Review screenshots or browser rendering at representative phone, tablet, and desktop widths. Fix visual defects found before finishing.
6. Verify keyboard operation, focus visibility, labels, modal behavior, contrast, and status communication. Target WCAG 2.2 AA for common text and controls where practical.
7. Run the project’s existing checks/build and address regressions introduced by this work. Do not claim verification that was not actually performed.

Finish with a concise report of the shared design system changes, modules updated, responsive widths and workflows reviewed, checks run, and any remaining limitations. The result should feel like one carefully designed POS product, not a collection of separately styled pages.
