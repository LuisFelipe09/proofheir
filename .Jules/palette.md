# Palette's Journal 🎨

## 2024-10-27 - Input Error Association
**Learning:** Custom form inputs in this codebase (like in `TokenSelector`) often display visual error messages without programmatic association, leaving screen reader users unaware of validation failures.
**Action:** When rendering conditional error messages, always assign them an ID and link them to the input using `aria-describedby`. Add `role="alert"` to the error container for immediate announcement.
