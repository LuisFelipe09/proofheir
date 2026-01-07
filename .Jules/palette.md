## 2025-02-20 - Token List Management
**Learning:** The app uses a manual "Add" button pattern for list management (e.g., adding tokens) which is keyboard-unfriendly. Users expect "Enter" to submit.
**Action:** Always add `onKeyDown` handler for Enter key support in these "add item" inputs to improve efficiency.
