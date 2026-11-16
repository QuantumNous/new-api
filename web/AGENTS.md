# Front-end development specifications

This document defines the development specifications and best practices for front-end projects for development and AI assistants to follow. The specific dependencies and scripts are subject to `package.json`.

---

## 1. Project Overview

### Technology stack

| Category | Technology |
| ---------- | ----------------------------------------------------------------- |
| Package Management | Bun |
| Framework | React 19, TypeScript |
| Data and requests | @tanstack/react-query, axios, Zustand |
| routing | @tanstack/react-router |
| Tables and lists | @tanstack/react-table, @tanstack/react-virtual |
| Internationalization | i18next, react-i18next, English-only interpolation |
| Date | Day.js |
| UI & Style | Base UI, Hugeicons, Tailwind CSS, clsx/class-variance-authority |
| Form | React Hook Form, Zod |
| Charts | @visactor/vchart, @visactor/react-vchart |
| Tools | qrcode.react, oxfmt, oxlint, vitest (optional) |

Prioritize reusing existing components and capabilities of the project (see [3.3 Components](#33-Components)); if there is no suitable implementation in the project, then evaluate installed dependencies and mature and well-maintained open source libraries. Only implement it yourself when reuse, combination or reasonable expansion still cannot meet the needs, and explain the specific capability gaps.

---

## 2. Directory

- Project overview
- Contents
- Development conventions
  - [3.1 Internationalization](#31-Internationalization)
  - [3.2 Coding style and type](#32-Coding style and type)
  - [3.3 Components](#33-Components)
  - [3.4 Performance](#34-Performance)
  - [3.5 Status Management](#35-Status Management)
  - [3.6 API request](#36-api-request)
  - [3.7 Form](#37-Form)
  - [3.8 Routing](#38-Routing)
  - [3.9 Error handling](#39-Error handling)
  - [3.10 Style](#310-Style)
  - [3.11 File Organization](#311-File Organization)
  - [3.12 Accessibility](#312-Accessibility)
  - [3.13 Security](#313-Security)
  - [3.14 Test](#314-Test)
  - [3.15 Dependency Management](#315-Dependency Management)
  - [3.16 Build and Deployment](#316-Build and Deployment)
- [4. Collaboration and Submission](#4Collaboration and Submission)
- [Update Log](#Update Log)

---

## 3. Development specifications

### 3.1 English-only interface

English is the only supported language. Follow `../../ENGLISH_ONLY_POLICY.md`. Keep existing `t()` calls for interpolation and compatibility, and maintain English resource entries where needed. Do not add translated bundles, language detection, or language selectors. Use the shared `toIntlLocale()` adapter, which always returns English, for interface-derived formatting. Tests must verify English output even when old preferences or browser headers request another language.

### 3.2 Code style and type

- **Expression**: Disable nested ternary expressions at 2 levels or above; use `if-else`, early return or extraction function instead. Single-layer ternary can be retained, but it needs to be simple.
- **Readability**: Control the complexity of the function loop, and split complex logic into small functions; the naming of variables and functions must be meaningful and follow conventional conventions such as camel case.
- **TypeScript**: Avoid `any`, prefer concrete types or `unknown`; explicitly type parameters and return values; use `import type { X } from '...'` for type-only imports.
- **Type checking**: Type checking (such as `bun check -b`) must be performed every time TypeScript or TSX code is changed; if a type error occurs, it must be repaired until there is no error and must not be left behind.
- **Lint check**: Before each code change is completed, lint checks must be performed on the files involved and all lint errors in these files must be repaired; no errors must be left behind. warnings can be handled based on change scope and risk assessment.
- **Destructuring**: Do not deconstruct objects unless necessary, especially props of components; it is clearer to use `props.xxx` directly to avoid unnecessary destructuring that increases code complexity.

### 3.3 Components

**Retrieve first, then reuse, and finally add (mandatory)**

- **Pre-development search**: Before adding or modifying the UI, you must read the project `shadcn-ui` skill, use `rg --files` / `rg` to retrieve `src/components/` and related `src/features/`; also check `src/hooks/` when common interactions are involved. Search by purpose and behavior, not just the name of the component to be added. Read the candidate component's implementation, props, and actual call examples before deciding on a solution.
- **Reuse order**: Give priority to using project business packages that meet the scenario; when capabilities are insufficient, first evaluate existing props, slots, combination methods or compatible extensions. When business encapsulation is indeed not applicable, use the existing basic component combination in `src/components/ui/`. Only when there are still capability gaps within the project will the introduction of components or new implementations be evaluated; checking external registries cannot replace in-project searches.
- **Reuse to the behavior layer**: Only using basic components such as `Button`, `Dialog`, and `AlertDialog` does not mean that the corresponding common capabilities such as copying, confirmation, and pop-up window layout have been reused. When an existing business encapsulation can cover it, this encapsulation must be used, and it is prohibited to reassemble the same set of interactions, states, and styles within the feature.
- **New conditions**: Before adding an alternative implementation, the specific capabilities that the candidate component lacks must be clarified, and the candidate path and the reasons why it cannot be reused, combined, or compatible with extensions must be recorded in the change description or PR. Differences in copywriting, icons, sizes, colors or pages do not constitute a reason for repeated implementation; priority is given to handling these differences through existing APIs and theme conventions.
- **Reasonable combination**: It is allowed to add new feature components that carry business data, permissions, events and content, but the common UI and interaction must continue to be reused. When extending public components, you need to maintain the existing calling behavior. You cannot stuff irrelevant business logic into a single page, and you cannot create overly general abstractions to eliminate a small amount of similar code.
- **Basic element boundary**: In the business code, controls such as buttons, input boxes, selectors, and pop-ups that are covered by basic components must use project components. You cannot hand-write equivalent controls or directly bypass the encapsulation and call the underlying library. Native elements can be used for ordinary semantic layouts, hidden fields, and special controls that cannot be expressed by existing components; special controls must still explain capability gaps and meet accessibility requirements.

The following are commonly used search entries. This table cannot be regarded as a complete list of components:

| Scenario | Priority check item entry |
| -------------------------------- | ------------------------------------------------------------------------------------ |
| Universal pop-up window layout | `@/components/dialog` |
| Deletion, Dangerous Operations and General Confirmation | `@/components/confirm-dialog` |
| Copy button interacts with clipboard | `@/components/copy-button`, `@/hooks/use-copy-to-clipboard` |
| Empty state, loading state, error state | `@/components/empty-state`, `@/components/loading-state`, `@/components/error-state` |
| Table, paging, toolbar and list layout | `@/components/data-table`, first read the directory's `README.md` and public export |
| Basic controls such as buttons, inputs, selections, and prompts | `@/components/ui/`, subject to `components.json` and local implementation |

- Use functional components and Hooks, single responsibility; component props must have clear types (interfaces or type aliases).
- **Props usage**: Do not deconstruct component props unless necessary. Use `props.xxx` directly to access properties to keep the code clear (see [3.2 Code Style and Type](#32-Code Style and Type) for details).
- When a single file exceeds about 200 lines, consider splitting sub-components or extracting logic to custom Hooks; the type definition can be in the same file as the component or placed in `types` in the same module.

### 3.4 Performance

- **React**: Use `useMemo` and `useCallback` appropriately to reduce invalid re-rendering; avoid creating new objects/arrays in the rendering path; use `React.memo` when necessary.
- **Code Splitting**: Use `React.lazy` and dynamic `import` for on-demand loading to control the first screen and routing volume.
- **Resources**: Choose appropriate formats and sizes for images, consider virtual scrolling (such as @tanstack/react-virtual) for large lists, and consider lazy loading for large numbers of images.

### 3.5 Status Management

- Use Zustand's `create` to define the store and define clear types for state and actions.
- Prioritize using selectors to subscribe within components to avoid redundant rendering caused by whole store subscriptions, for example: `const user = useAuthStore((s) => s.auth.user)`.
- The state that needs to be persisted is read and written to localStorage in the store and restored during initialization.
- Store is placed in `src/stores/` according to function. The responsibilities of a single file are clear and the naming is clear.

### 3.6 API request

- **React Query**: Use `useQuery` for data acquisition, and `useMutation` for change; configure a unique `queryKey` for each query (recommended array form, consistent level); do `invalidateQueries` for related queries in `onSuccess`, which can cooperate with optimistic updates. Server-side errors are handled uniformly through `handleServerError` (see [3.9 Error Handling](#39-Error Handling) for details).
- **Axios**: Use the project's unified `api` instance (including `baseURL`, `headers`, `withCredentials: true`); GET default request deduplication, special requests can be turned off through configuration; authentication refresh and request retry are handled in the interceptor; ordinary error prompts are the responsibility of the final failure callback of Query/Mutation or the direct caller.

### 3.7 Form

- Use React Hook Form + Zod: Define the schema under `lib/` in the function module, and use `z.infer` to export the form type; `useForm` cooperates with `@hookform/resolvers/zod` for verification.
- The submission logic is placed in `onSubmit` to display the loading and error status; after success, the scene resets the form or closes the pop-up window. Server-side verification errors are mapped to corresponding fields and displayed (for field-level error display methods, see [3.9 Error Handling](#39-Error Handling)).

### 3.8 Routing

- Using TanStack Router, the routing file is located in `src/routes/` and defined by `createFileRoute`; the search parameters are verified with Zod schema + `validateSearch`.
- Perform authentication and redirection in `beforeLoad` to avoid unnecessary requests; nested structures use layout routing and `_authenticated` as prefixes, and sub-routes are rendered through `<Outlet />`.
- Navigate using `useNavigate` or `Link` to maintain type safety and avoid direct manipulation of `window.location`.

### 3.9 Error handling

- **Server-side error**: Use `handleServerError(error, fallbackMessage?)` uniformly, and give priority to retaining the specific reasons on the server side. The same failure will only be prompted once when propagating along `cause`; different operations will be prompted separately even if the copywriting is the same. Disables writing the full Axios error object (possibly containing credentials) directly to the console.
- **Prompt Attribution**: Ordinary request interceptors do not play Toast. Use the shared `createAppQueryClient` to prompt when Query/Mutation ultimately fails; Mutation's custom `onError` is responsible for its own prompts or form errors. No error will be reported during automatic retry and active cancellation. `meta.errorToast: false` turns off automatic prompts, and the page can still actively call the error handling function.
- **Business Failure**: Retain the original API response contract; Query uses `requireServerSuccess` to check `success: false`, or use `createServerError(response, fallbackMessage?)` at the business layer to throw an error and retain the source. Direct requests must explicitly handle failure responses and Promise rejections; Mutation that needs to display failure status must not treat the failure result as a successful save.
- **Authentication Compatible**: Preserves stable error code mapping and security messages of `AuthOperationError`, without unraveling their sources to display blocked details. Maintain existing refresh, jump, and one-time authorization non-replay constraints.
- **Display**: Use unified methods such as `toast.error`; routing-level errors are handled by `errorComponent`, providing friendly error pages and recording information for easy troubleshooting.
- **Form**: After the verification and server-side errors are mapped to fields, they are displayed below the fields; use `form.setError` and other methods consistent with the form library.

### 3.10 Style

- Mainly use Tailwind tool classes, and use `cn()` to merge dynamic class names; avoid inline styles in non-dynamic scenarios.
- Responsiveness uses mobile first and Tailwind breakpoints (`sm:`, `md:`, `lg:`, etc.); themes and dark colors use CSS variables and `dark:`, custom styles are concentrated in `src/styles/`, and as little custom CSS is written in components as possible.

### 3.11 File Organization

- **Function module**: placed in `src/features/<feature>/`, containing `components/`, `lib/`, `hooks/`, as well as on-demand `api.ts`, `types.ts`, `constants.ts`, entrance components, etc.
- **General**: put `src/components/` for general components, `src/lib/` for general tools and types; component files PascalCase, tool/type files kebab-case or `types.ts`, types are named with PascalCase and `export type`.

### 3.12 Accessibility

- Use semantic HTML (such as `header`, `nav`, `main`, `footer`), and form associated inputs with `label`.
- Ensure that the keyboard is operable and the focus sequence is reasonable; use ARIA (such as `aria-label`, `aria-expanded`, `aria-hidden`) when necessary; add `aria-hidden="true"` to decorative icons, and provide text equivalents for important information.
- Contrast ratio meets WCAG 2.1 AA (at least 4.5:1 for text).

### 3.13 Security

- Authentication and permissions are verified at the routing and interface layers; secondary confirmations are added for sensitive operations.
- Data verification is performed on both the front and back ends (such as Zod), and only the front-end verification is not trusted; sensitive information is not stored in the front-end, environment variables are used for configuration, and hard-coded keys are prohibited.
- Rely on React's default escape, use `dangerouslySetInnerHTML` with caution; use `withCredentials` across domains and cookies and handle CSRF according to backend requirements.

### 3.14 Test

- Tool function and pure logic first unit test (Vitest), test file `*.test.ts`; components use React Testing Library to test interaction and behavior to avoid testing implementation details.
- When adding new functions, fixing defects, or modifying existing behaviors, tests must be added or updated simultaneously; when fixing bugs, you must first write a failed use case that can stably reproduce the problem, then implement the repair and confirm that the use case is passed.
- When modifying the layout, size, scroll positioning, focus management, keyboard operation, selected state, disabled state, loading state, empty state, error state or responsive behavior of front-end components, corresponding regression tests must be added to cover the user-visible behavior protected by this change to prevent subsequent adjustments from reintroducing problems.
- Tests of functional modules or component modules must be placed in the `__tests__/` directory exclusive to the module, such as `src/components/model-group-selector/__tests__/layout.test.ts`; it is prohibited to tile new test files in the same directory as the official code files.
- Test files are named according to the responsibilities under test, such as `layout.test.ts`, `selection.test.ts`, `validation.test.ts`; a test file only covers a clear module or responsibility to avoid the formation of overly large test files across modules.
- Each test case should protect only one describable behavior, and the name must include the triggering condition and expected result; give priority to using clear structures of Arrange, Act, and Assert to avoid mixing multiple irrelevant assertions in a single use case.
- Tests must cover the main success path as well as the critical boundaries and failure paths involved in this change, including empty data, single and multiple data, overlong text, invalid input, disabled status, asynchronous failure and degradation logic; mechanical enumeration of irrelevant inputs for the sake of quantity is not allowed.
- Layout tests should assert clear and stable behavioral contracts, such as fixed sizes, alignment directions, overflow policies, scroll targets, and fallback paths; don't just assert that a component can render, and don't rely on browser pixel errors, browser-private implementations, or fragile full class string snapshots.
- Component interaction testing should query elements from the user's perspective and perform click, input, keyboard, and focus operations, and assert visible results, accessible status, or external callbacks; it is prohibited to directly assert the component's internal state, the number of private function calls, or the DOM hierarchy that has no user meaning.
- Components involving accessibility must override the accessibility name, keyboard operability, and properties such as `aria-expanded`, `aria-selected`, `aria-disabled`, `aria-invalid` that are consistent with the visual state.
- Tests involving i18n copywriting prioritize semantically positioned elements through stable roles, labels, or translation keys to avoid treating the complete display copywriting in a certain language as a fragile assertion unrelated to the business; if the translation content itself is a contract, language switching or fallback behavior should be clearly covered.
- Asynchronous tests must wait for clear interface status or Promise results, and must not use fixed `sleep`, depend on execution time, or create race conditions; timers, network requests, and browser APIs are only controllable mocked at necessary boundaries and restored after each use case.
- Prioritize testing of real code paths; only uncontrollable boundaries such as external network, time, random numbers, storage, or browser APIs can be mocked. It is forbidden to mock the module under test itself, nor to calculate the expected results by copying production logic into the test.
- Test data should use explicit fixtures that are minimal and have business meaning. Global state, cache, localStorage, mocks, and timers must be initialized and cleaned independently within the test to ensure that the test case can be run independently and does not depend on the execution order.
- Snapshot testing should only be used for stable and human-reviewable structural output; interactive components, complex DOMs, and Tailwind class lists must not use large-scale snapshots in place of behavioral assertions.
- Supplementary integration of key processes and E2E (such as MSW simulation API, Playwright/Cypress); target coverage of core functions is more than 80%, focusing on business paths and key branches.
- Tests must protect real user behavior, stable API contracts, or clear regression paths; it is prohibited to add smoke, sleep/timing, random input, log output, or tests that only prove that the code runs for the sake of coverage.
- When adding or significantly rewriting tests, give priority to using the standard assertions and query methods of Vitest and React Testing Library to avoid hand-written universal assertion helper functions; extract test helpers only when expressing project-specific business invariants.
- When cleaning up tests, first merge duplicate scenarios and delete unclear implementation details assertions; if old tests indirectly cover the real contract, they need to be replaced with smaller and more direct behavioral tests.
- At least the affected test files must be run before submission, and the relevant test set, `bun check -b` and lint of the involved files must be executed according to the scope of the impact; test completion must not be declared without seeing the latest passing results.

### 3.15 Dependency management

- Use **Bun**: `bun install`, `bun add <pkg>`, `bun add -d <pkg>`, `bun remove <pkg>`, `bun pm ls`, `bun update`, etc.
- Evaluate the maintenance status, volume and license before adding new dependencies; clearly distinguish production and development dependencies, use `^`/`~` to control versions, and update regularly to obtain security fixes.

### 3.16 Build and Deployment

- Use Rsbuild, see `rsbuild.config.ts` for configuration; the script shall be subject to `package.json` (such as `bun run dev`, `bun run build`, `bun check -b`, `bun run lint`, `bun run format`), and for package management, see [3.15 Dependency Management](#315-Dependency Management).
- For code splitting and lazy loading strategies, see [3.4 Performance] (#34-Performance); use appropriate formats and compression for resources, use `.env` for environment variables and prefix them with `VITE_`, and do not hardcode them in the code.
- **Before release**: Perform typecheck, lint, format checks, complete the production build and check the product volume and environment variable configuration.

---

## 4. Collaboration and submission

- The submitted information must be clear, consistent with the project agreement, and describe the content and reasons for the change in both Chinese and English.
- Changes are subject to code review, compliance with the specifications of this document, and attention to quality, performance, and security.
- Before completing the UI change, you must check whether new components, basic component imports, and handwritten interactions bypass existing business encapsulation; if duplicate implementations are found, they should be reused within the scope of this change. Retained new implementations need to describe the capability gap in the change description. Typecheck, lint and test passing cannot replace this check.
- Update relevant documentation and `AGENTS.md` when major functionality or specification changes occur.

---

## Update log

- **2026-01-28**: Initial version (basic specifications such as internationalization, code, components, types, etc.).
- **2026-01-28**: Supplementary state management, API, forms, routing, error handling, styles, file organization, accessibility, security, testing, dependencies and build deployment specifications.
- **2026-01-29**: Reorganize the document structure, merge duplicate content, and clarify primary and secondary and cross-references.
- **2026-01-31**: Added "type check" requirements in 3.2: After changing TS/TSX, typecheck must be executed and repaired until there are no errors.
- **2026-06-21**: Added "Lint check" requirement in 3.2: all lint errors of the involved files must be fixed before completing code changes.
- **2026-09-06**: Clarify the mandatory retrieval process, business encapsulation priority, new conditions, common entrances and review requirements for component reuse.
