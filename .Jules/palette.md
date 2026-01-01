## 2024-05-24 - Inline Styles & Form Accessibility
**Learning:** Heavily inline-styled components (like `ClaimCard.tsx`) often miss semantic HTML attributes because developers focus on visual properties in JS objects rather than standard HTML structure. This leads to `label` elements missing `htmlFor` and inputs missing `id`s, breaking screen reader associations.
**Action:** When auditing legacy or rapid-prototype code using inline styles, prioritize checking basic HTML form semantics which are easily overlooked in the visual noise of `style={{...}}`.
