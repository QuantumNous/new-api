---
id: start-vs-nextjs
title: TanStack Start vs Next.js
---

Choosing between TanStack Start and Next.js isn't just about features - it's about understanding what each framework optimizes for and how those decisions cascade through your entire development experience.

This page explains the fundamental differences, addresses common misconceptions, and helps you make an informed decision. For a feature-by-feature matrix, see the [full comparison table](./comparison). Ready to switch? See the [migration guide](./migrate-from-next-js).

**A note on benchmarks:** If someone quotes performance numbers comparing Start and Next without methodology, app complexity, hosting details, and configuration specifics - those numbers are meaningless. Comparisons must assume best practices on both sides. You can't give Next the benefit of optimized usage while assuming Start users misconfigure things.

## Two Different Visions of React

Both frameworks want to help you build great React applications. But they start from different assumptions about what "great" means.

### Next.js: The Platform Play

Next.js optimizes for **Vercel's vision of the web**: server-first rendering, tight platform integration, and automatic optimizations that work best on their infrastructure.

The core bet: most web content is static or near-static. Server Components should be the default. Interactivity is the exception you opt into. The framework should make decisions for you, and those decisions should be optimized for their infrastructure.

This works well if:

- You're deploying to Vercel and want tight platform integration
- Your app is content-heavy with islands of interactivity
- You want the framework to make architectural decisions for you

### TanStack Start: The Developer-First Play

TanStack Start optimizes for **developer control and correctness**: type safety everywhere, explicit over implicit, composable primitives, and deployment freedom.

The core bet: developers know their apps better than frameworks do. Server rendering is an optimization you opt into where it makes sense. The framework should give you powerful primitives and get out of your way.

This works well if:

- You want your deployment target to be a decision you make, not one the framework makes for you
- Your app is highly interactive
- You value type safety and explicit control
- You want to understand exactly what your code is doing

## The Mental Model Gap

This is the most important difference to understand. Everything else flows from it.

### Both SSR - Different Defaults for Interactivity

Let's be clear: both frameworks SSR by default, and both support static generation and React Server Components. The difference isn't capability - it's how you access those capabilities and how much control you have.

**Next.js** defaults to Server Components. Every component is a Server Component unless you add `"use client"`. Server Components can't use state, effects, or event handlers - so the path to interactivity requires understanding the framework's implicit boundaries, caching layers, and serialization rules.

**TanStack Start** defaults to interactive components (traditional React). Your components SSR and hydrate, ready for state and event handlers out of the box. You opt into Server Components where they provide value - for heavy static content, keeping secrets server-side, or reducing bundle size.

Both approaches get you to the same destination. The question is: which direction feels like swimming upstream for _your_ app?

Consider:

- If most of your components need state, effects, or event handlers, Next's defaults mean constant `"use client"` annotations and thinking about serialization boundaries
- If most of your content is static, Start lets you explicitly opt those components into server-only rendering - with clearer control over caching and hydration
- Either way, Start gives you more granular control over _how_ things render, not just _where_

### Implicit vs Explicit

Both frameworks handle the fundamentals - code splitting, caching, SSR, static optimization. The difference is visibility and predictability. **Next.js** layers implicit behaviors: multi-layer server-side caching with a history of breaking changes and community frustration, data fetching conventions tied to file structure, optimizations that require understanding the framework's internals to override.

**TanStack Start** is explicit without being verbose. Loader functions, cache configuration, middleware chains - they're visible in your code, not hidden behind conventions. This doesn't mean more code; it means the code you write maps directly to what happens at runtime.

## Architecture Deep Dive

### The Build Pipeline

**Next.js** uses a custom build system (historically Webpack, now Turbopack). It's tightly integrated with their architecture, which enables optimizations but limits flexibility. Turbopack has improved dev speed, but it's still no match for Vite or Rsbuild.

**TanStack Start** supports Vite and Rsbuild. This means:

- Faster dev server startup
- Faster HMR
- Access to modern plugin ecosystems
- Standard tooling that transfers to other projects

### The Runtime

**Next.js** ships a substantial runtime to support Server Components, server-side caching, automatic optimizations, and the App Router's conventions. This runtime has real weight.

**TanStack Start** ships a minimal runtime. The router is powerful but lean. Server functions are thin RPC wrappers. There's no framework magic layer between you and React.

Bundle size isn't everything, but it's the baseline everything else builds on. Start's architecture is designed to minimize runtime overhead - even with RSC support, the runtime stays lean. Much of Next's bundle weight is architectural tax, not feature weight.

### The Type System

**Next.js** has TypeScript support. **TanStack Start** is built around TypeScript.

The difference matters:

- In Next.js, the boundary between client and server creates type gaps. Server Actions can receive data that doesn't match what TypeScript expects. You need runtime validation to be safe.
- In Start, server functions have end-to-end type safety. Input validation, return types, middleware context, route parameters - all checked at compile time.

In the age of AI-assisted development, end-to-end type safety should be non-negotiable. Types aren't just "nice for DX" - they're correctness guarantees that prevent production errors.

## Routing

This is where TanStack shines brightest. TanStack Router (which powers Start) is the most powerful, type-safe router in any framework.

**Features Next.js doesn't have:**

- **Typesafe search params** - Define, validate, and parse search params with full type inference. Next gives you `?foo=bar` as strings; Start gives you validated, typed objects
- **Search param validation & middleware** - Transform and validate search params at the route level
- **Typesafe path params** - Path params are inferred and validated, not just `string | string[]`
- **Typesafe route context** - Pass typed context down through nested routes
- **Path param validation & custom parsing** - Parse `/users/123` as a number, validate it exists
- **Route mount/transition/unmount events** - Hook into the route lifecycle
- **Code-based routes** - Define routes in code when file-based doesn't fit
- **Built-in devtools** - Inspect router state, cache, and pending navigations
- **Element scroll restoration** - Restore scroll position for specific elements, not just the page
- **Navigation blocking** - `useBlocker` for unsaved changes warnings

**Type safety that actually works:**

- Route paths are fully typed - typos are compile errors
- Links validate their destinations - no broken links in production
- Loaders know their route context - no guessing what data is available
- Search params are typed end-to-end - from URL to component

Next.js has file-based routing that works, but the type safety is superficial (an IDE plugin for link hints) compared to TanStack Router's compile-time guarantees.

**First-class integrations:**

TanStack Router was designed from the ground up for isomorphism and hydration. This makes it the foundation for first-class integrations with TanStack Query and other data-fetching libraries. In Next, you wire up Query manually; in Start, it's a supported pattern with official integrations.

See the [full router comparison](/router/latest/docs/framework/react/comparison) for the complete feature matrix.

## The Caching Question

Caching is where the philosophical differences become most visible.

### Next.js: Implicit and Server-Side

Next.js caches aggressively by default (or did - they've changed this multiple times). The caching happens in layers:

- Request memoization
- Data cache
- Full route cache
- Router cache

Each layer has its own invalidation semantics. The system has been rewritten multiple times with community criticism for being unpredictable. Next 15 simplified the defaults, but the fundamental complexity of server-side RSC stream caching remains.

When people talk about "component caching," they're referring to caching serialized RSC streams on the server. This is more complicated than most realize:

- You're caching text streams with complex invalidation semantics
- This happens in lambda-style environments with their own constraints
- Granular invalidation requires explicit tagging setup
- Cache misses cascade through the component tree in ways that aren't always predictable

**Ask anyone claiming server-side component caching is special:** "How do you invalidate a cached RSC stream when a data dependency changes?" Most can't answer clearly.

### TanStack Start: RSCs Are Just Data

Start treats Server Component output the same as any other data flowing through your app. There's no special "component cache" with its own semantics - RSC payloads are data, and you cache data however you want:

- **TanStack Router** - Built-in SWR-style caching with `staleTime` and `gcTime`
- **TanStack Query** - Full-featured async state management
- **CDN caching** - Standard HTTP cache headers at the edge
- **Redis, database, whatever** - It's just data; use your existing infrastructure

```tsx
export const Route = createFileRoute('/posts/$postId')({
  loader: async ({ params }) => fetchPost(params.postId),
  staleTime: 10_000, // Fresh for 10 seconds
  gcTime: 5 * 60_000, // Keep in memory for 5 minutes
})
```

This is the same SWR pattern TanStack Query has battle-tested across millions of applications. No new mental model. No framework-specific caching semantics to learn. No chasing ghosts.

The caching layers are well-understood and compose naturally:

- Client-side SWR caching (built into the router)
- CDN caching at the edge (standard HTTP semantics)
- Server-side caching where you want it (explicit, opt-in)

You already know how to cache data. Start doesn't make you learn a new way.

### The Bottom Line on RSCs

Start has full RSC support with feature parity to Next.js. The difference is mental model and cognitive overhead.

In Next, RSCs are the paradigm - you build around them, think about them constantly, manage their boundaries everywhere. In Start, RSCs are just another data primitive. Fetch them, cache them, compose them - using patterns you already know from TanStack Query and Router.

We call our approach **Composite Components** - server-produced React components that the client can fetch, cache, stream, and assemble. The client owns composition; the server ships UI pieces. No new mental model. No framework-specific caching semantics. Just data flowing through tools you already understand.

For the full deep-dive, see [Composite Components: Server Components with Client-Led Composition](https://tanstack.com/blog/composite-components).

## Server Functions vs Server Actions

Both frameworks let you call server code from the client. The approaches differ significantly.

### Next.js Server Actions

```tsx
'use server'

export async function createPost(formData: FormData) {
  const title = formData.get('title')
  // No compile-time type safety on inputs
  return db.posts.create({ title })
}
```

Server Actions integrate with forms and transitions. They're convenient for simple cases but provide limited type safety at the boundary.

### TanStack Server Functions

```tsx
export const createPost = createServerFn({ method: 'POST' })
  .validator(z.object({ title: z.string().min(1) }))
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    // data is typed and validated
    // context comes from middleware, also typed
    return db.posts.create({ title: data.title })
  })
```

Server functions give you:

- **Input validation** - Define schemas, get runtime validation and compile-time types
- **Middleware** - Composable, works on both client and server
- **Full type inference** - From input to output to error handling
- **Explicit RPC** - Clear mental model of what's happening

**Security note:** Start's architecture doesn't parse Flight data on the server - payloads flow one direction (server to client). Recent React security advisories around RSC serialization vulnerabilities don't apply to Start's model.

## Where Next.js Has the Advantage

Next.js has been around longer. That's not a technical advantage, but it creates real ecosystem effects:

**More content** - More tutorials, more Stack Overflow answers, more blog posts, more example repos. When you Google a problem, you're more likely to find a Next-specific answer.

**Mindshare** - Next is the default recommendation in many circles. That means more developers have used it, which means more content, which reinforces the cycle.

**Vercel integration** - Next.js is built by Vercel, so new Vercel platform features often ship with Next.js support first. That said, Start works great on Vercel too - you're not giving up preview deployments or edge functions by choosing Start. You're just not locked into Vercel as the only first-class option.

**Built-in image/font optimization** - Start supports image optimization via pluggable solutions (like [Unpic](https://unpic.pics/)), but it's not built-in. Whether "built-in" is better than "pluggable" depends on whether you want the framework making that choice for you.

None of these are technical superiority - they're ecosystem and business model advantages. On the technical merits, we're confident in Start's approach.

## What Start Does Better

With RSC support, the question isn't "what does Start lack?" - it's: **"Why give up Start's router, type safety, caching design, and simpler mental model for Next's API design?"**

**Type safety** - End-to-end, not bolted on. This prevents bugs and enables confident refactoring.

**Routing** - The most powerful, type-safe router in any framework. Search params, path params, loaders, middleware - all fully typed.

**Caching model** - Explicit SWR primitives you already understand if you've used TanStack Query. No implicit layers to debug.

**Dev experience** - Vite and Rsbuild are fast. Instant startup, fast HMR, lower resource usage. This compounds over a workday - and even more so when AI agents are iterating on your code in tight loops.

**Deployment as a feature** - Start treats deployment flexibility as a first-class feature. Cloudflare, Netlify, AWS, Fly, Railway, your own servers - they're all equally supported. Your app works the same everywhere because it's built on standards, not platform-specific optimizations. This means you can:

- Choose hosting based on price, performance, or proximity to your users
- Switch providers without rewriting deployment logic
- Run the same code in development, staging, and production across different platforms
- Avoid accumulating platform-specific patterns that create friction later

**Middleware** - Composable middleware that works at both the request level AND the server function level, on both client and server.

**Debugging** - Predictable execution. When something breaks, you can trace it. No abstraction layers hiding behavior.

## Summary

| Aspect               | TanStack Start                       | Next.js                               |
| -------------------- | ------------------------------------ | ------------------------------------- |
| **Philosophy**       | Developer control, explicit patterns | Platform integration, conventions     |
| **Components**       | Interactive by default, opt into RSC | Server Components by default          |
| **Type safety**      | End-to-end, compile-time             | TypeScript support with boundary gaps |
| **Server functions** | Typed, validated, middleware support | Untyped boundary, no middleware       |
| **Caching**          | Explicit SWR primitives              | Multi-layer implicit caching          |
| **Build tool**       | Vite or Rsbuild                      | Turbopack/Webpack                     |
| **Deployment**       | Equal support everywhere             | Optimized for Vercel                  |
| **Routing**          | Best-in-class type safety            | File-based, basic types               |
| **RSC**              | Supported                            | Supported                             |
| **Maturity**         | 2+ years, approaching 1.0            | 8+ years, historically unstable APIs  |

---

> **Ready to try Start?** See the [Getting Started guide](./getting-started) or [migrate from Next.js](./migrate-from-next-js).
