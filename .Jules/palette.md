## 2025-02-14 - Semantic Stepper Implementation
**Learning:** Custom step indicators were implemented using only `div`s, making them invisible to screen readers.
**Action:** Replace `div` wrappers with `<nav>` and use `<ol>` for the step list. Use `aria-current="step"` and hidden text to convey status.
