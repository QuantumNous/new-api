---
id: getting-started
title: Getting Started
redirect_from:
  - /framework/react/quick-start
---

## Start a new project

### Use TanStack Builder

The best way to get started with TanStack Start is [TanStack Builder](https://tanstack.com/builder). It's the AI-first setup flow and the easiest way to get to a working project fast.

### Use the CLI

If you'd rather scaffold locally or want a backup path, use the TanStack CLI:

```bash
npx @tanstack/cli@latest create
```

You'll be prompted to choose your package manager and optional add-ons like Tailwind CSS and ESLint.

### Start from an example

If you'd rather begin from a working codebase, clone one of the official examples.

To start with the [Basic](https://github.com/TanStack/router/tree/main/examples/react/start-basic) example:

```bash
npx gitpick TanStack/router/tree/main/examples/react/start-basic start-basic
cd start-basic
npm install
npm run dev
```

To use a different example, replace `start-basic` with one of the slugs below.

#### Examples

- [Basic](https://github.com/TanStack/router/tree/main/examples/react/start-basic) (`start-basic`)
- [Basic + Auth](https://github.com/TanStack/router/tree/main/examples/react/start-basic-auth) (`start-basic-auth`)
- [Counter](https://github.com/TanStack/router/tree/main/examples/react/start-counter) (`start-counter`)
- [Basic + React Query](https://github.com/TanStack/router/tree/main/examples/react/start-basic-react-query) (`start-basic-react-query`)
- [Clerk Auth](https://github.com/TanStack/router/tree/main/examples/react/start-clerk-basic) (`start-clerk-basic`)
- [Convex + Trellaux](https://github.com/TanStack/router/tree/main/examples/react/start-convex-trellaux) (`start-convex-trellaux`)
- [Supabase](https://github.com/TanStack/router/tree/main/examples/react/start-supabase-basic) (`start-supabase-basic`)
- [Trellaux](https://github.com/TanStack/router/tree/main/examples/react/start-trellaux) (`start-trellaux`)
- [WorkOS](https://github.com/TanStack/router/tree/main/examples/react/start-workos) (`start-workos`)
- [Material UI](https://github.com/TanStack/router/tree/main/examples/react/start-material-ui) (`start-material-ui`)

Each example page also includes a StackBlitz preview so you can inspect it before cloning.

To clone a different example manually, replace `EXAMPLE_SLUG` below with the slug you want to use:

```bash
npx gitpick TanStack/router/tree/main/examples/react/EXAMPLE_SLUG my-new-project
cd my-new-project
npm install
npm run dev
```

If you want to clone and deploy quickly, use the **Deploy to Netlify** button on an example's page.

### Build from scratch

If you want to wire everything up by hand, follow [Build a project from scratch](./build-from-scratch).

## Migrate an existing project from another framework

- If you want to learn Start from a clean slate first, use one of the new-project options above.
- Refer to a migration guide for your specific framework:
  - [Next.js](./migrate-from-next-js)
  - Remix 2 / React Router 7 "Framework Mode" (coming soon!)

## Next Steps

Once you've created, cloned, or deployed a project, continue to the [Routing](./guide/routing) guide.

## Other Router Examples

If you want Router-focused examples that are not Start-specific, these are useful references:

- [Quickstart (file-based)](https://github.com/TanStack/router/tree/main/examples/react/quickstart-file-based)
- [Basic (file-based)](https://github.com/TanStack/router/tree/main/examples/react/basic-file-based)
- [Kitchen Sink (file-based)](https://github.com/TanStack/router/tree/main/examples/react/kitchen-sink-file-based)
- [Kitchen Sink + React Query (file-based)](https://github.com/TanStack/router/tree/main/examples/react/kitchen-sink-react-query-file-based)
- [Location Masking](https://github.com/TanStack/router/tree/main/examples/react/location-masking)
- [Authenticated Routes](https://github.com/TanStack/router/tree/main/examples/react/authenticated-routes)
- [Scroll Restoration](https://github.com/TanStack/router/tree/main/examples/react/scroll-restoration)
- [Deferred Data](https://github.com/TanStack/router/tree/main/examples/react/deferred-data)
- [Navigation Blocking](https://github.com/TanStack/router/tree/main/examples/react/navigation-blocking)
- [View Transitions](https://github.com/TanStack/router/tree/main/examples/react/view-transitions)
- [With tRPC](https://github.com/TanStack/router/tree/main/examples/react/with-trpc)
- [With tRPC + React Query](https://github.com/TanStack/router/tree/main/examples/react/with-trpc-react-query)
