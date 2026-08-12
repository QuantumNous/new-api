# TanStack Router — Skill Spec

TanStack Router is a type-safe router for React and Solid applications with built-in SWR caching, JSON-first search params, file-based route generation, and end-to-end type inference. It is client-first/isomorphic — loaders run on the client by default and additionally on the server when used with TanStack Start.

## Domains

| Domain                | Description                                                         | Skills                                              |
| --------------------- | ------------------------------------------------------------------- | --------------------------------------------------- |
| Defining Routes       | Setting up route trees, configuring the router, registering types   | route-setup, migrate-from-react-router              |
| Navigating            | Links, imperative navigation, preloading, blocking                  | navigation                                          |
| Managing URL State    | Search params and path params with validation and serialization     | search-params, path-params                          |
| Loading Data          | Route loaders, SWR caching, external cache coordination, context/DI | data-loading, external-data-loading                 |
| Protecting Routes     | Auth guards, RBAC, beforeLoad redirects                             | auth-and-guards                                     |
| Rendering and Layout  | Code splitting, error/not-found handling, route masking             | code-splitting, not-found-and-errors, route-masking |
| Type Safety           | Inference patterns, narrowing, TS performance                       | type-safety                                         |
| Server-Side Rendering | SSR setup, hydration, head management                               | ssr                                                 |

## Skill Inventory

| Skill                     | Type        | Domain                | What it covers                                                                       | Failure modes |
| ------------------------- | ----------- | --------------------- | ------------------------------------------------------------------------------------ | ------------- |
| route-setup               | core        | defining-routes       | createRouter, file/code/virtual routing, Register, plugin config, ESLint             | 5             |
| navigation                | core        | navigating            | Link, useNavigate, Navigate, preloading, blocking, active states, scroll restoration | 4             |
| search-params             | core        | managing-url-state    | validateSearch, useSearch, middlewares, serialization, adapters                      | 4             |
| path-params               | core        | managing-url-state    | $params, splats, optional params, prefix/suffix patterns                             | 3             |
| data-loading              | core        | loading-data          | loader, loaderDeps, staleTime/gcTime, pending/error, context/DI, deferred            | 5             |
| external-data-loading     | composition | loading-data          | TanStack Query integration, SSR dehydration/hydration, streaming                     | 3             |
| auth-and-guards           | core        | protecting-routes     | beforeLoad redirects, layout auth, RBAC, provider integration                        | 3             |
| code-splitting            | core        | rendering-and-layout  | autoCodeSplitting, .lazy.tsx, getRouteApi, split groupings                           | 4             |
| not-found-and-errors      | core        | rendering-and-layout  | notFound(), notFoundComponent, errorComponent, CatchBoundary                         | 3             |
| route-masking             | core        | rendering-and-layout  | mask option, createRouteMask, unmaskOnReload                                         | 1             |
| type-safety               | core        | type-safety           | Register, from narrowing, TS perf, type utilities                                    | 3             |
| ssr                       | core        | server-side-rendering | RouterClient/Server, streaming, hydration, head management                           | 3             |
| migrate-from-react-router | lifecycle   | defining-routes       | Migration checklist, API mapping, search params conversion                           | 2             |

## Failure Mode Inventory

### route-setup (5 failure modes)

| #   | Mistake                                                | Priority | Source                                  | Cross-skill? |
| --- | ------------------------------------------------------ | -------- | --------------------------------------- | ------------ |
| 1   | Missing router type registration                       | CRITICAL | docs/guide/creating-a-router            | type-safety  |
| 2   | Not committing routeTree.gen.ts                        | HIGH     | docs/faq                                | —            |
| 3   | Wrong route property order breaks type inference       | HIGH     | docs/eslint/create-route-property-order | —            |
| 4   | Placing TanStackRouter plugin after framework plugin   | HIGH     | docs/installation/with-vite             | —            |
| 5   | Using getParentRoute incorrectly in code-based routing | HIGH     | docs/decisions-on-dx                    | —            |

### navigation (4 failure modes)

| #   | Mistake                                                  | Priority | Source                                  | Cross-skill?  |
| --- | -------------------------------------------------------- | -------- | --------------------------------------- | ------------- |
| 1   | Interpolating params into the to string                  | CRITICAL | docs/guide/navigation                   | type-safety   |
| 2   | Using useNavigate instead of Link for clickable elements | MEDIUM   | docs/guide/navigation                   | —             |
| 3   | Not providing from for relative navigation               | HIGH     | docs/guide/navigation                   | —             |
| 4   | Using search as object instead of function loses params  | HIGH     | docs/how-to/navigate-with-search-params | search-params |

### search-params (4 failure modes)

| #   | Mistake                                                | Priority | Source                           | Cross-skill? |
| --- | ------------------------------------------------------ | -------- | -------------------------------- | ------------ |
| 1   | Using zod .catch() instead of adapter fallback()       | HIGH     | docs/guide/search-params         | —            |
| 2   | Returning entire search object from loaderDeps         | HIGH     | docs/guide/data-loading          | data-loading |
| 3   | Passing Date objects in search params                  | HIGH     | docs/how-to/arrays-objects-dates | —            |
| 4   | Parent route missing validateSearch blocks inheritance | MEDIUM   | docs/how-to/share-search-params  | —            |

### path-params (3 failure modes)

| #   | Mistake                                       | Priority | Source                        | Cross-skill? |
| --- | --------------------------------------------- | -------- | ----------------------------- | ------------ |
| 1   | Interpolating path params into `to` string    | CRITICAL | docs/guide/navigation         | navigation   |
| 2   | Using \* for splat routes instead of $        | MEDIUM   | docs/routing/routing-concepts | —            |
| 3   | Using curly braces for basic dynamic segments | MEDIUM   | docs/guide/path-params        | —            |

### data-loading (5 failure modes)

| #   | Mistake                                                          | Priority | Source                    | Cross-skill? |
| --- | ---------------------------------------------------------------- | -------- | ------------------------- | ------------ |
| 1   | Assuming loaders only run on the server                          | CRITICAL | maintainer interview      | ssr          |
| 2   | Not understanding staleTime default is 0                         | MEDIUM   | docs/guide/data-loading   | —            |
| 3   | Using reset() instead of router.invalidate() in error components | HIGH     | docs/guide/data-loading   | —            |
| 4   | Double parentheses missing on createRootRouteWithContext         | HIGH     | docs/guide/data-loading   | —            |
| 5   | Using React hooks in beforeLoad or loader                        | HIGH     | docs/guide/router-context | —            |

### external-data-loading (3 failure modes)

| #   | Mistake                                           | Priority | Source                           | Cross-skill? |
| --- | ------------------------------------------------- | -------- | -------------------------------- | ------------ |
| 1   | Not setting defaultPreloadStaleTime to 0          | HIGH     | docs/guide/external-data-loading | —            |
| 2   | Creating QueryClient outside createRouter for SSR | HIGH     | docs/guide/external-data-loading | —            |
| 3   | Awaiting prefetchQuery in loader blocks rendering | MEDIUM   | docs/integrations/query          | —            |

### auth-and-guards (3 failure modes)

| #   | Mistake                                             | Priority | Source                           | Cross-skill? |
| --- | --------------------------------------------------- | -------- | -------------------------------- | ------------ |
| 1   | Auth check in component instead of beforeLoad       | HIGH     | docs/how-to/setup-authentication | —            |
| 2   | Not re-throwing redirects in try/catch              | HIGH     | docs/guide/authenticated-routes  | —            |
| 3   | Trying to conditionally render root route component | MEDIUM   | docs/faq                         | —            |

### code-splitting (4 failure modes)

| #   | Mistake                                                    | Priority | Source                              | Cross-skill? |
| --- | ---------------------------------------------------------- | -------- | ----------------------------------- | ------------ |
| 1   | Exporting route property functions prevents code splitting | HIGH     | docs/guide/automatic-code-splitting | —            |
| 2   | Trying to code-split the root route                        | MEDIUM   | docs/guide/code-splitting           | —            |
| 3   | Splitting the loader adds double async cost                | MEDIUM   | docs/guide/code-splitting           | —            |
| 4   | Importing Route in code-split files for typed hooks        | HIGH     | docs/guide/code-splitting           | —            |

### not-found-and-errors (3 failure modes)

| #   | Mistake                                              | Priority | Source                      | Cross-skill? |
| --- | ---------------------------------------------------- | -------- | --------------------------- | ------------ |
| 1   | Using deprecated NotFoundRoute                       | HIGH     | docs/guide/not-found-errors | —            |
| 2   | Expecting useLoaderData to work in notFoundComponent | MEDIUM   | docs/guide/not-found-errors | —            |
| 3   | Leaf route cannot handle not-found errors            | MEDIUM   | docs/guide/not-found-errors | —            |

### route-masking (1 failure mode)

| #   | Mistake                                  | Priority | Source                   | Cross-skill? |
| --- | ---------------------------------------- | -------- | ------------------------ | ------------ |
| 1   | Expecting masked URLs to survive sharing | MEDIUM   | docs/guide/route-masking | —            |

### type-safety (3 failure modes)

| #   | Mistake                                             | Priority | Source                 | Cross-skill? |
| --- | --------------------------------------------------- | -------- | ---------------------- | ------------ |
| 1   | Adding type annotations or casts to inferred values | CRITICAL | maintainer interview   | —            |
| 2   | Using un-narrowed LinkProps type                    | HIGH     | docs/guide/type-safety | —            |
| 3   | Not narrowing Link/useNavigate with from            | HIGH     | docs/guide/type-safety | —            |

### ssr (3 failure modes)

| #   | Mistake                                                 | Priority | Source                | Cross-skill?              |
| --- | ------------------------------------------------------- | -------- | --------------------- | ------------------------- |
| 1   | Using browser APIs in loaders without environment check | HIGH     | docs/guide/ssr        | data-loading              |
| 2   | Using hash fragments for server-rendered content        | MEDIUM   | docs/guide/navigation | —                         |
| 3   | Generating Next.js or Remix SSR patterns                | CRITICAL | maintainer interview  | route-setup, data-loading |

### migrate-from-react-router (2 failure modes)

| #   | Mistake                                                | Priority | Source                                      | Cross-skill? |
| --- | ------------------------------------------------------ | -------- | ------------------------------------------- | ------------ |
| 1   | Leaving React Router imports alongside TanStack Router | HIGH     | docs/how-to/migrate-from-react-router       | —            |
| 2   | Using React Router useSearchParams pattern             | HIGH     | docs/installation/migrate-from-react-router | —            |

## Tensions

| Tension                                           | Skills                               | Agent implication                                                                 |
| ------------------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------- |
| Type safety strictness vs rapid prototyping       | type-safety ↔ route-setup            | Agents skip Register declaration or use type casts to silence errors              |
| Client-first loaders vs SSR expectations          | data-loading ↔ ssr                   | Agents put server-only code in client loaders or avoid browser APIs unnecessarily |
| Built-in SWR cache vs external cache coordination | data-loading ↔ external-data-loading | Agents use both caches simultaneously causing stale data or double-fetching       |
| Code splitting granularity vs loader performance  | code-splitting ↔ data-loading        | Agents split everything including loaders, adding latency                         |

## Cross-References

| From                      | To                    | Reason                                                                             |
| ------------------------- | --------------------- | ---------------------------------------------------------------------------------- |
| route-setup               | type-safety           | Register declaration and property order are prerequisites for type inference       |
| navigation                | search-params         | Link search prop directly interacts with search param validation                   |
| data-loading              | search-params         | loaderDeps consumes validated search params as cache keys                          |
| data-loading              | external-data-loading | Understanding built-in caching is prerequisite for external cache coordination     |
| auth-and-guards           | data-loading          | beforeLoad runs before loader — auth context flows into loader via route context   |
| code-splitting            | data-loading          | Loader splitting decisions affect data loading performance                         |
| ssr                       | data-loading          | SSR changes where loaders execute — must handle both environments                  |
| ssr                       | external-data-loading | SSR dehydration/hydration requires special Query setup                             |
| not-found-and-errors      | data-loading          | notFound() in loaders interacts with error boundaries and loader data availability |
| migrate-from-react-router | route-setup           | Migration requires understanding TanStack Router route setup                       |

## Subsystems & Reference Candidates

| Skill         | Subsystems                                    | Reference candidates                                     |
| ------------- | --------------------------------------------- | -------------------------------------------------------- |
| route-setup   | —                                             | file naming conventions (>10 distinct conventions)       |
| search-params | Zod adapter, Valibot adapter, ArkType adapter | search param validation patterns (>10 distinct patterns) |
| All others    | —                                             | —                                                        |

## Recommended Skill File Structure

- **Core skills:** route-setup, navigation, search-params, path-params, data-loading, code-splitting, not-found-and-errors, route-masking, type-safety, ssr, auth-and-guards
- **Framework skills:** None needed separately — React and Solid share the same core API surface. Framework-specific notes belong inline.
- **Lifecycle skills:** migrate-from-react-router
- **Composition skills:** external-data-loading (TanStack Query)
- **Reference files:** search-params (validation patterns), route-setup (file naming conventions)

## Composition Opportunities

| Library               | Integration points                                        | Composition skill needed?                  |
| --------------------- | --------------------------------------------------------- | ------------------------------------------ |
| @tanstack/react-query | Loader coordination, SSR dehydration/hydration, streaming | Yes — external-data-loading                |
| Zod                   | Search param validation                                   | No — covered as subsystem in search-params |
| Valibot               | Search param validation                                   | No — covered as subsystem in search-params |
| ArkType               | Search param validation                                   | No — covered as subsystem in search-params |
