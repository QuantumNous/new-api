# Trello-like example using Convex DB

This is a TanStack Start demo using Convex as the database.
It is similar to the [start-trellaux](https://github.com/TanStack/router/tree/main/examples/react/start-trellaux) example but uses a cloud Convex deployment instead of an in-memory database.

- [TanStack Router Docs](https://tanstack.com/router)
- [Convex Documentation](https://docs.convex.dev)

## Start a new project based on this example

To start a new project based on this example, run:

```sh
npx gitpick TanStack/router/tree/main/examples/react/start-convex-trellaux start-convex-trellaux
```

## Convex

Convex is an open-source, reactive backend made by [convex.dev](https://convex.dev/?utm_source=tanstack), a sponsor of TanStack Start.

This example uses Convex with TanStack Query and TanStack Start to provide:

- Typesafe TanStack Query options factories like `convexQuery` for use with `useQuery`, `useSuspenseQuery` etc.
- Live-updating queries: updates come in over a WebSocket instead of requiring polling
- Automatic query invalidation: when a mutation succeeds all queries it affects update automatically
- Selective optimistic update rollback: when a mutation succeeds only its update will be rolled back, with other optimistic updates reapplied
- Consistent snapshot reads of database state: /messages will never return a foreign key for a /user that doesn't exist until the next fetch

## Getting Started

To run this example:

```sh
pnpm install
pnpm dev
```

## Build

Build for production:

```sh
pnpm build
```

## About This Example

This example demonstrates:

- Convex database integration
- Real-time updates
- Complex UI state management
