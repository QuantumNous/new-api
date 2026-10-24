# Start Basic Cloudflare

## Getting Started

### Install the dependencies

```bash
pnpm i
```

### Start the development server

```bash
pnpm dev
```

### Build for Production

```bash
pnpm build
```

### Preview the production build

```bash
pnpm preview
```

### Deploy to Cloudflare

```sh
pnpm run deploy
```

## Accessing bindings

You can access Cloudflare bindings in server functions by using importable `env`:

```ts
import { env } from 'cloudflare:workers'
```

See `src/routes/index.tsx` for an example.
