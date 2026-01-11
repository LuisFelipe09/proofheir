## 2024-05-22 - Visual-First Development Patterns
**Learning:** Many interactive elements (icon-only buttons, custom inputs) are implemented with `div`s or buttons without text labels, relying entirely on visual cues. This makes them inaccessible to screen readers.
**Action:** When creating new components, always start with semantic HTML and ensure every interactive element has an accessible name (either via text content or `aria-label`).
