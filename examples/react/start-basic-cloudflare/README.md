# TanStack Start - Cloudflare Example

A TanStack Start example demonstrating deployment to Cloudflare Workers.

- [TanStack Router Docs](https://tanstack.com/router)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)

## Start a new project based on this example

To start a new project based on this example, run:

```sh
npx gitpick TanStack/router/tree/main/examples/react/start-basic-cloudflare start-basic-cloudflare
```

## Getting Started

From your terminal:

```sh
pnpm install
pnpm dev
```

This starts your app in development mode, rebuilding assets on file changes.

## Build

To build the app for production:

```sh
pnpm build
```

## Preview

To preview the production build locally:

```sh
pnpm preview
```

## Deploy to Cloudflare

To deploy your app to Cloudflare Workers:

```sh
pnpm run deploy
```

## Accessing Cloudflare Bindings

You can access Cloudflare bindings in server functions by using importable `env`:

```ts
import { env } from 'cloudflare:workers'
```

See `src/routes/index.tsx` for an example.

## Cloudflare Configuration

This example includes:

- Wrangler configuration for Cloudflare Workers
- Type generation for Cloudflare bindings
- Server-side rendering on the edge
- Access to Cloudflare platform features (KV, D1, R2, etc.)
