# Architecture and mental model

## Core model

TanStack Start treats React Server Components as plain React Flight data:

- create them on the server
- return them from a server function or API route
- decode and render them during SSR or on the client
- cache them with whatever already owns the data flow

That matters because the framework is not asking you to move the whole UI tree to the server. RSCs are opt-in fragments that fit into existing Router and Query workflows.

## Boundary model

The fastest way to get TanStack Start RSC wrong is to think “loader = server”.

Use these boundaries instead:

- `createServerFn`: explicit RPC boundary; safe to call from client code because the client gets an RPC stub
- `createServerOnlyFn`: utility that must never run on the client
- route `loader`: orchestration layer that runs on the server for the initial SSR request and in the browser on client navigation unless the route is `ssr: false`

Practical rule: loaders decide _when_ to fetch. Server functions decide _what_ must stay on the server.

## What still works inside RSCs

Do not over-correct and assume RSCs are a stripped-down universe.

- TanStack Router `Link` works inside server components
- CSS Modules and global CSS imports work inside server components
- `React.cache` works for request-scoped memoization inside server components

Use those directly when they simplify the tree.

## When RSCs actually pay off

Use TanStack Start RSCs when one or more of these are true:

- a region is heavy to render but mostly static once delivered
- a server-only dependency should never enter the client bundle
- data fetching and render logic want to live together
- you want progressively streamed HTML for part of the route
- the result can be cached better as a fragment than as an entire page

Do not force RSCs into highly interactive, state-dense client surfaces unless they materially reduce bundle size or remove awkward client/server sync.

## Choosing tree ownership

Think in terms of ownership:

- client-owned UI: plain client components, Query, SPA patterns
- route-owned RSC: route loader fetches a fragment and Router cache owns freshness
- query-owned RSC: Query owns the fragment because its lifecycle is not route-shaped
- mixed ownership: the route owns coarse navigation state, Query owns sub-fragments

The wrong smell is accidental double ownership: one RSC is fetched in a loader, then also separately cached in Query, then only one side is invalidated.

## Composite Components in one sentence

A Composite Component is a server-rendered fragment with placeholders the client fills later.

That makes it the replacement for “I need server-rendered markup here, but I still need client interactivity in the middle of it.”

The client can wrap, nest, reorder, and interleave those fragments instead of accepting a single framework-owned server tree.

## Next App Router translation

Use this mapping when someone is thinking in Next terms:

- Next “server-first tree” -> Start “isomorphic-first app with opt-in RSC fragments”
- Next `'use client'` boundary -> Start Composite Component slot boundary
- Next server actions -> Start explicit `createServerFn({ method: 'POST' })`
- Next framework cache semantics -> Start Router cache, Query cache, and HTTP cache you control directly

The useful mental shift is this: in TanStack Start, RSC is a transport and composition primitive, not the center of gravity for the whole app.

## High-value heuristics

- If the fragment never accepts client content, demote it to `renderServerComponent`.
- If a route-scoped RSC never needs independent refetching, keep it in the loader cache.
- If a fragment is reused across routes or refreshed independently, consider Query ownership.
- If several fragments always share data and invalidate together, bundle them in one server function.
- If one slow fragment blocks everything, stop awaiting it in the loader and defer it.
