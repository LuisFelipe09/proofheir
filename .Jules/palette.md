## 2026-01-13 - Stepper Accessibility Pattern
**Learning:** Progress steppers implemented as `div`s with `onClick` are inaccessible to keyboard and screen reader users. They lack semantic structure (`ol`, `li`) and interactive roles (`button`, `aria-current`).
**Action:** Use `<nav aria-label="Progress">` wrapping an `<ol>`. Use `<button>` for interactive steps with `aria-current="step"` for the active one. Ensure connecting lines are `aria-hidden`.

## 2026-01-13 - Hidden Context Regression
**Learning:** Hiding visual labels with `aria-hidden="true"` removes them from the accessibility tree. If the alternative text (e.g., in `sr-only` span) doesn't include the full context (like the step title), the content becomes meaningless to screen reader users (e.g., hearing "Step 1" instead of "Step 1: Welcome").
**Action:** Always verify that `sr-only` replacements contain at least the same information as the visual text they replace.
