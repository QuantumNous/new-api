---
id: getting-started
title: Getting Started
redirect_from:
  - /framework/solid/quick-start
---

## Start a new project

### Use TanStack Builder

The best way to get started with TanStack Start is [TanStack Builder](https://tanstack.com/builder). It's the AI-first setup flow and the easiest way to get to a working project fast.

### Use the CLI

If you'd rather scaffold locally or want a backup path, use the TanStack CLI:

```bash
npx @tanstack/cli@latest create --framework solid
```

You'll be prompted to choose your package manager and optional add-ons like Tailwind CSS and ESLint.

### Start from an example

If you'd rather begin from a working codebase, clone one of the official examples.

To start with the [Basic](https://github.com/TanStack/router/tree/main/examples/solid/start-basic) example:

```bash
npx gitpick TanStack/router/tree/main/examples/solid/start-basic start-basic
cd start-basic
npm install
npm run dev
```

To use a different example, replace `start-basic` with one of the slugs below.

#### Examples

- [Bare](https://github.com/TanStack/router/tree/main/examples/solid/start-bare) (`start-bare`)
- [Basic](https://github.com/TanStack/router/tree/main/examples/solid/start-basic) (`start-basic`)
- [Basic Static](https://github.com/TanStack/router/tree/main/examples/solid/start-basic-static) (`start-basic-static`)
- [Counter](https://github.com/TanStack/router/tree/main/examples/solid/start-counter) (`start-counter`)

Each example page also includes a StackBlitz preview so you can inspect it before cloning.

To clone a different example manually, replace `EXAMPLE_SLUG` below with the slug you want to use:

```bash
npx gitpick TanStack/router/tree/main/examples/solid/EXAMPLE_SLUG my-new-project
cd my-new-project
npm install
npm run dev
```

If you want to clone and deploy quickly, use the **Deploy to Netlify** button on an example's page.

### Build from scratch

If you want to wire everything up by hand, follow [Build a project from scratch](./build-from-scratch).

## Next Steps

Once you've created, cloned, or deployed a project, continue to the [Routing](./guide/routing) guide.
