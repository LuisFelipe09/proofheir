# Palette's Journal

## 2025-05-18 - Missing Accessibility on Interactive Components
**Learning:** The application uses complex interactive components like steppers and accordions but often lacks proper ARIA attributes for screen readers. For example, the `DelegationCard` has a custom stepper implementation that is visually clear but semantically opaque to screen readers.
**Action:** When creating or modifying complex navigation or status components, always ensure:
1.  Use semantic tags (`<nav>`, `<ol>`, `<button>`) where possible.
2.  Use `aria-current` to indicate active steps.
3.  Use hidden text (`sr-only`) to convey status that is only shown via icons or color (e.g., "Completed").
