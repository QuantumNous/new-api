# Official sources

Validated on 2026-04-13.

## TanStack Start

- Server Components guide
  https://tanstack.com/start/latest/docs/framework/react/guide/server-components

- Server Functions guide
  https://tanstack.com/start/latest/docs/framework/react/guide/server-functions

- Execution Model guide
  https://tanstack.com/start/latest/docs/framework/react/guide/execution-model

- Import Protection guide
  https://tanstack.com/start/latest/docs/framework/react/guide/import-protection

## TanStack Router

- Data Loading guide
  https://tanstack.com/router/latest/docs/framework/react/guide/data-loading

## TanStack blog

- React Server Components Your Way
  https://tanstack.com/blog/react-server-components

## Vite

- `@vitejs/plugin-rsc` documentation / discovery entry point
  https://vite.dev/plugins/

## Notes on drift observed during validation

- Current RSC docs and blog use `renderServerComponent`, `createCompositeComponent`, `CompositeComponent`, and low-level Flight APIs from `@tanstack/react-start/rsc`.
- Current Server Functions docs use `.validator(...)`.
- Some current RSC docs snippets still show older `.validator(...)`.
- Older official repo examples may still show `renderRsc` and older config shapes. Prefer the current docs above.
