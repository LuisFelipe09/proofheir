## 2025-05-18 - [Accessible Step Indicators]
**Learning:** Visual step indicators (e.g., 1-2-3-4 with lines) often lack semantic structure, leaving screen reader users lost in a sequence of numbers or labels without context.
**Action:** Always use `<ol>` for the steps to imply order. Wrap in `<nav aria-label="Progress">`. Use `aria-current="step"` on the active item. Add `sr-only` text like "Completed:", "Current step:", and "Upcoming step:" to convey state non-visually. Hide decorative icons/lines with `aria-hidden="true"`.
