# Default frontend library boundaries

- Scope: React components in `web/`, especially forms, server state, local stores, and translated UI
- Dependency refs: React `v19.2.7`, Base UI `v1.6.0`, React Query `5.101.2`, React Hook Form `v7.82.0`, Zod `v4.4.3`, Zustand `v5.0.14`, i18next `v26.3.6`, react-i18next `v17.0.10`
- Project evidence: `web/src/components/ui/`, `web/src/features/`, `web/src/routes/`, `web/src/stores/`, and `web/AGENTS.md`
- Upstream implementation: `repos/base-ui/packages/react/src/form/Form.tsx`, `repos/tanstack-query/packages/react-query/src/useQuery.ts`, `repos/tanstack-query/packages/react-query/src/useBaseQuery.ts`, `repos/react-hook-form/src/useForm.ts`, `repos/zod/packages/zod/src/v4/classic/schemas.ts`, `repos/zustand/src/react.ts`, `repos/react-i18next/src/useTranslation.js`
- Upstream tests/examples: `repos/base-ui/packages/react/src/form/Form.test.tsx`, `repos/tanstack-query/packages/react-query/src/__tests__/useQuery.test.tsx`, `repos/react-hook-form/src/__tests__/useForm.test.tsx`, `repos/zod/packages/zod/src/v4/classic/tests/`, `repos/zustand/tests/basic.test.tsx`, `repos/react-i18next/test/useTranslation.spec.jsx`

## Observed patterns

- Base UI components preserve native semantics while coordinating compound-component state. Its Form tests interact by accessible role, assert focus and `aria-invalid`, and verify submitted values rather than private state. Project wrappers should retain those semantics when adding styling or composition.
- React Query's React hook delegates lifecycle tracking to a query observer. Its tests create an isolated `QueryClient`, exercise pending/success/error transitions through rendered output, and clear the client after each case. Stable hierarchical query keys are the identity boundary; mutations invalidate or update the matching cache entries.
- React Hook Form keeps form state behind `useForm` and exposes explicit registration, submission, reset, and field-error operations. Pair it with a Zod schema through the existing resolver, infer the TypeScript form type from the schema, and map server validation failures to fields rather than maintaining a second form-state model.
- Zustand's React binding is selector-based through `useSyncExternalStore`. Its tests show that components subscribed to one slice do not re-render for unrelated slice changes. Components should subscribe to the smallest stable value or action they need instead of the entire store.
- `useTranslation` subscribes to i18next changes and refreshes the bound translator when language or resources change. A component that renders user-facing text should call the hook itself; using a translator captured outside React loses that reactive lifecycle.

## Project adaptation

- Prefer project components in `web/src/components/ui/` over importing raw primitives directly into feature code when a wrapper already exists.
- Follow the project's React Query error handling, API client, query-key, and invalidation conventions before applying a generic upstream example.
- All user-facing text still uses the project's flat English-source i18n keys and all six locale files. The upstream namespace examples do not replace the local translation layout.
- Use TypeScript types and public package exports. React internals under `repos/react/` explain behavior but are not application APIs.
- Tests should use accessible queries and assert visible state, keyboard/focus behavior, callbacks, or cache-visible outcomes. Avoid assertions on hook internals or component implementation details.

## Avoid

- Styling a Base UI wrapper in a way that drops refs, event handlers, labels, focus behavior, or ARIA state.
- Copying server data into Zustand or component state when React Query already owns its lifecycle.
- Subscribing a component to an entire Zustand store for one field or action.
- Keeping React Hook Form values in parallel local state without a concrete integration need.
- Calling a non-reactive global translation function for text that must update when the language changes.

## Verification

From `web/`, run `bun run typecheck`, lint the changed files with the configured `bun run lint` command, and run any focused Vitest/React Testing Library tests covering the behavior. For UI changes, verify accessible roles, labels, focus, disabled/loading states, and translated output in addition to the happy path.
