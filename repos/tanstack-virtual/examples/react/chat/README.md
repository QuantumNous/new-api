# TanStack Virtual React Chat Example

Demonstrates end-anchored virtualization for chat-style UIs:

- starts at the latest message
- keeps the visible message stable when older history is prepended
- follows appended output only when the viewport is already at the latest message
- keeps streaming bottom output pinned as the last row grows

```bash
npm install
npm run dev
```
