---
title: Comparison
toc: false
---

Choosing a routing solution? This side‑by‑side comparison highlights key features, trade‑offs, and common use cases to help you quickly evaluate how each option fits your project’s needs.

While we aim to provide an accurate and fair comparison, please note that this table may not capture every nuance or recent update of each library. We recommend reviewing the official documentation and trying out each solution to make the most informed decision for your specific use case.

If you find any discrepancies or have suggestions for improvement, please don't hesitate to contribute via the "Edit this page on GitHub" link at the bottom of this page or open an issue in the [TanStack Router GitHub repository](https://github.com/TanStack/router).

Feature/Capability Key:

- ✅ 1st-class, built-in, and ready to use with no added configuration or code
- 🟡 Partial Support (on a scale of 5)
- 🟠 Supported via addon/community package
- 🔶 Possible, but requires custom code/implementation/casting
- 🛑 Not officially supported

<!-- ::start:framework -->

# React

## Comparison | TanStack Router & TanStack Start vs Next.js vs React Router / Remix

|                                                | TanStack Router / Start                          | React Router DOM [_(Website)_][router]                | Next.JS [_(Website)_][nextjs]                         |
| ---------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------- | ----------------------------------------------------- |
| Github Repo / Stars                            | [![][stars-tanstack-router]][gh-tanstack-router] | [![][stars-router]][gh-router]                        | [![][stars-nextjs]][gh-nextjs]                        |
| Bundle Size                                    | [![][bp-tanstack-router]][bpl-tanstack-router]   | [![][bp-router]][bpl-router]                          | ❓                                                    |
| History, Memory & Hash Routers                 | ✅                                               | ✅                                                    | 🛑                                                    |
| Nested / Layout Routes                         | ✅                                               | ✅                                                    | 🟡                                                    |
| Suspense-like Route Transitions                | ✅                                               | ✅                                                    | ✅                                                    |
| Typesafe Routes                                | ✅                                               | 🟡 (1/5)                                              | 🟡                                                    |
| Code-based Routes                              | ✅                                               | ✅                                                    | 🛑                                                    |
| File-based Routes                              | ✅                                               | ✅                                                    | ✅                                                    |
| Virtual/Programmatic File-based Routes         | ✅                                               | ✅                                                    | 🛑                                                    |
| Router Loaders                                 | ✅                                               | ✅                                                    | ✅                                                    |
| SWR Loader Caching                             | ✅                                               | 🛑                                                    | ✅                                                    |
| Route Prefetching                              | ✅                                               | ✅                                                    | ✅                                                    |
| Auto Route Prefetching                         | ✅                                               | ✅                                                    | ✅                                                    |
| Route Prefetching Delay                        | ✅                                               | 🔶                                                    | 🛑                                                    |
| Path Params                                    | ✅                                               | ✅                                                    | ✅                                                    |
| Typesafe Path Params                           | ✅                                               | ✅                                                    | 🛑                                                    |
| Typesafe Route Context                         | ✅                                               | 🛑                                                    | 🛑                                                    |
| Path Param Validation                          | ✅                                               | 🛑                                                    | 🛑                                                    |
| Custom Path Param Parsing/Serialization        | ✅                                               | 🛑                                                    | 🛑                                                    |
| Ranked Routes                                  | ✅                                               | ✅                                                    | ✅                                                    |
| Active Link Customization                      | ✅                                               | ✅                                                    | ✅                                                    |
| Optimistic UI                                  | ✅                                               | ✅                                                    | 🔶                                                    |
| Typesafe Absolute + Relative Navigation        | ✅                                               | 🟡 (1/5 via `buildHref` util)                         | 🟠 (IDE plugin)                                       |
| Route Mount/Transition/Unmount Events          | ✅                                               | 🛑                                                    | 🛑                                                    |
| Devtools                                       | ✅                                               | 🟠                                                    | 🛑                                                    |
| Basic Search Params                            | ✅                                               | ✅                                                    | ✅                                                    |
| Search Param Hooks                             | ✅                                               | ✅                                                    | ✅                                                    |
| `<Link/>`/`useNavigate` Search Param API       | ✅                                               | 🟡 (search-string only via the `to`/`search` options) | 🟡 (search-string only via the `to`/`search` options) |
| JSON Search Params                             | ✅                                               | 🔶                                                    | 🔶                                                    |
| TypeSafe Search Params                         | ✅                                               | 🛑                                                    | 🛑                                                    |
| Search Param Schema Validation                 | ✅                                               | 🛑                                                    | 🛑                                                    |
| Search Param Immutability + Structural Sharing | ✅                                               | 🔶                                                    | 🛑                                                    |
| Custom Search Param parsing/serialization      | ✅                                               | 🔶                                                    | 🛑                                                    |
| Search Param Middleware                        | ✅                                               | 🛑                                                    | 🛑                                                    |
| Suspense Route Elements                        | ✅                                               | ✅                                                    | ✅                                                    |
| Route Error Elements                           | ✅                                               | ✅                                                    | ✅                                                    |
| Route Pending Elements                         | ✅                                               | ✅                                                    | ✅                                                    |
| `<Block>`/`useBlocker`                         | ✅                                               | 🔶 (no hard reloads or cross-origin navigation)       | 🛑                                                    |
| Deferred Primitives                            | ✅                                               | ✅                                                    | ✅                                                    |
| Navigation Scroll Restoration                  | ✅                                               | ✅                                                    | ❓                                                    |
| ElementScroll Restoration                      | ✅                                               | 🛑                                                    | 🛑                                                    |
| Async Scroll Restoration                       | ✅                                               | 🛑                                                    | 🛑                                                    |
| Router Invalidation                            | ✅                                               | ✅                                                    | ✅                                                    |
| Runtime Route Manipulation (Fog of War)        | 🛑                                               | ✅                                                    | ✅                                                    |
| Parallel Routes                                | 🛑                                               | 🛑                                                    | ✅                                                    |
| --                                             | --                                               | --                                                    | --                                                    |
| **Full Stack**                                 | --                                               | --                                                    | --                                                    |
| SSR                                            | ✅                                               | ✅                                                    | ✅                                                    |
| Streaming SSR                                  | ✅                                               | ✅                                                    | ✅                                                    |
| Generic RPCs                                   | ✅                                               | 🛑                                                    | 🛑                                                    |
| Generic RPC Middleware                         | ✅                                               | 🛑                                                    | 🛑                                                    |
| React Server Functions                         | ✅                                               | 🛑                                                    | ✅                                                    |
| React Server Function Middleware               | ✅                                               | 🛑                                                    | 🛑                                                    |
| API Routes                                     | ✅                                               | ✅                                                    | ✅                                                    |
| API Middleware                                 | ✅                                               | ✅                                                    | ✅                                                    |
| React Server Components                        | 🟡 (Experimental)                                | 🟡 (Experimental)                                     | ✅                                                    |
| `<Form>` API                                   | 🛑                                               | ✅                                                    | ✅                                                    |

[bp-tanstack-router]: https://badgen.net/bundlephobia/minzip/@tanstack/react-router
[bpl-tanstack-router]: https://bundlephobia.com/result?p=@tanstack/react-router
[gh-tanstack-router]: https://github.com/tanstack/router
[stars-tanstack-router]: https://img.shields.io/github/stars/tanstack/router?label=%F0%9F%8C%9F
[_]: _
[router]: https://github.com/remix-run/react-router
[bp-router]: https://badgen.net/bundlephobia/minzip/react-router
[gh-router]: https://github.com/remix-run/react-router
[stars-router]: https://img.shields.io/github/stars/remix-run/react-router?label=%F0%9F%8C%9F
[bpl-router]: https://bundlephobia.com/result?p=react-router
[bpl-history]: https://bundlephobia.com/result?p=history
[_]: _
[nextjs]: https://nextjs.org/docs/routing/introduction
[bp-nextjs]: https://badgen.net/bundlephobia/minzip/next.js?label=All
[gh-nextjs]: https://github.com/vercel/next.js
[stars-nextjs]: https://img.shields.io/github/stars/vercel/next.js?label=%F0%9F%8C%9F
[bpl-nextjs]: https://bundlephobia.com/result?p=next

# Solid

---

We don't have a comparison table for Solid just yet. If you're interested in helping us create one, please reach out in the [TanStack Discord](https://tanstack.com/discord) or open a PR with your proposed comparison!

<!-- ::end:framework -->
