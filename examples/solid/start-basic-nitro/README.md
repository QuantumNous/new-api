# Start Basic Netlify

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

### Deploy to Netlify

```sh
netlify deploy
```

## Accessing bindings

You can access Cloudflare bindings in server functions by using importable `env`:

```ts
import { env } from 'cloudflare:workers'
```

See `src/routes/index.tsx` for an example.
