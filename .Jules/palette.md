## 2024-05-24 - Form Label Association
**Learning:** React components using inline styles often miss basic HTML accessibility attributes like `htmlFor` and `id`, making forms inaccessible to screen readers.
**Action:** When auditing forms, check for explicit label-input association. If missing, add `id` to inputs and `htmlFor` to labels. Consider `React.useId` for reusable components.
