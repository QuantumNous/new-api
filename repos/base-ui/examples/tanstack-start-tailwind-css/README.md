# Base UI + TanStack Start

This is a simple [TanStack Start](https://tanstack.com/start/latest/docs/framework/react/overview) app with [Base UI components](https://base-ui.com/react/overview/quick-start) styled using [Tailwind CSS](https://tailwindcss.com/).

## Getting started

[![Edit on CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/p/sandbox/github/mui/base-ui/tree/master/examples/tanstack-start-tailwind-css)

[![Edit on StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/mui/base-ui/tree/master/examples/tanstack-start-tailwind-css)

**Note:** TanStack Start Server Functions used in the combobox example may not work in StackBlitz due to lack of AsyncLocalStorage support.

Or to run it locally:

```bash
pnpm install
pnpm start
```

This starts a [Vite](https://vite.dev) development server at [http://localhost:3000](http://localhost:3000). [Node.js](https://nodejs.org/) version 20.19+ or 22.12+ is required.

## Building for production

To build a production bundle:

```bash
pnpm build
```

To preview the production build:

```bash
pnpm serve
```

## TypeScript

To check the types:

```bash
pnpm typescript
```

## Linting & Formatting

This project uses [ESLint](https://eslint.org/) and [prettier](https://prettier.io/) for linting and formatting. ESLint is configured using [`@tanstack/eslint-config`](https://tanstack.com/config/latest/docs/eslint). The following scripts are available:

```bash
# lint only
pnpm lint
# lint and prettier with autofix
pnpm check
```

## Routing

This app uses [TanStack Router](https://tanstack.com/router) with a file based router. Routes are managed as files in `src/routes`. The router also provides [`loader` functionality](https://tanstack.com/router/latest/docs/framework/react/guide/data-loading#loader-parameters) to load data for a route before it's rendered.
