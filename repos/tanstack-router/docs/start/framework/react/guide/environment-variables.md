---
id: environment-variables
title: Environment Variables
---

Learn how to securely configure and use environment variables in your TanStack Start application across different contexts (server functions, client code, and build processes).

> **Read env per-request, not at module scope.** On Cloudflare Workers and other edge SSR runtimes, env vars are injected at request time — module-level `process.env.X` reads run before the env exists and evaluate to `undefined` even on the server. Always read `process.env` inside `.handler()`, middleware `.server()`, server-route handlers, or other per-request callbacks. Reading at module scope also risks inlining secrets into the client bundle. (On Cloudflare Workers specifically, the canonical way to read env from anywhere — including module scope — is the [`cloudflare:workers` env binding](https://developers.cloudflare.com/workers/configuration/environment-variables/).)

## Quick Start

TanStack Start automatically loads `.env` files and makes variables available in both server and client contexts with proper security boundaries. Server code can read unprefixed variables from `process.env`; client code can only read variables exposed by your build tool's public prefix.

<!-- ::start:tabs variant="bundler" -->

# Vite

```bash
# .env
DATABASE_URL=postgresql://user:pass@localhost:5432/mydb
VITE_APP_NAME=My TanStack Start App
```

```typescript
// Server function - can access any environment variable
const getUser = createServerFn().handler(async () => {
  const db = await connect(process.env.DATABASE_URL) // ✅ Server-only
  return db.user.findFirst()
})

// Client component - only VITE_ prefixed variables
export function AppHeader() {
  return <h1>{import.meta.env.VITE_APP_NAME}</h1> // ✅ Client-safe
}
```

# Rsbuild

```bash
# .env
DATABASE_URL=postgresql://user:pass@localhost:5432/mydb
PUBLIC_APP_NAME=My TanStack Start App
```

```typescript
// Server function - can access any environment variable
const getUser = createServerFn().handler(async () => {
  const db = await connect(process.env.DATABASE_URL) // ✅ Server-only
  return db.user.findFirst()
})

// Client component - only PUBLIC_ prefixed variables by default
export function AppHeader() {
  return <h1>{import.meta.env.PUBLIC_APP_NAME}</h1> // ✅ Client-safe
}
```

<!-- ::end:tabs -->

## Environment Variable Contexts

### Server-Side Context (Server Functions & API Routes)

Server functions can access **any** environment variable using `process.env`:

```typescript
import { createServerFn } from '@tanstack/react-start'

// Database connection (server-only)
const connectToDatabase = createServerFn().handler(async () => {
  const connectionString = process.env.DATABASE_URL // No prefix needed
  const apiKey = process.env.EXTERNAL_API_SECRET // Stays on server

  // These variables are never exposed to the client
  return await database.connect(connectionString)
})

// Authentication (server-only)
const authenticateUser = createServerFn()
  .validator(z.object({ token: z.string() }))
  .handler(async ({ data }) => {
    const jwtSecret = process.env.JWT_SECRET // Server-only
    return jwt.verify(data.token, jwtSecret)
  })
```

### Client-Side Context (Components & Client Code)

Client code can only access variables with your build tool's public prefix.

<!-- ::start:tabs variant="bundler" -->

# Vite

Vite exposes variables with the `VITE_` prefix:

```typescript
// Client configuration
export function ApiProvider({ children }: { children: React.ReactNode }) {
  const apiUrl = import.meta.env.VITE_API_URL     // ✅ Public
  const apiKey = import.meta.env.VITE_PUBLIC_KEY  // ✅ Public

  // This would be undefined (security feature):
  // const secret = import.meta.env.DATABASE_URL   // ❌ Undefined

  return (
    <ApiContext.Provider value={{ apiUrl, apiKey }}>
      {children}
    </ApiContext.Provider>
  )
}

// Feature flags
export function FeatureGatedComponent() {
  const enableNewFeature = import.meta.env.VITE_ENABLE_NEW_FEATURE === 'true'

  if (!enableNewFeature) return null

  return <NewFeature />
}
```

# Rsbuild

Rsbuild exposes variables with the `PUBLIC_` prefix by default:

```typescript
// Client configuration
export function ApiProvider({ children }: { children: React.ReactNode }) {
  const apiUrl = import.meta.env.PUBLIC_API_URL // ✅ Public
  const apiKey = import.meta.env.PUBLIC_KEY // ✅ Public

  // This would be undefined (security feature):
  // const secret = import.meta.env.DATABASE_URL // ❌ Undefined

  return (
    <ApiContext.Provider value={{ apiUrl, apiKey }}>
      {children}
    </ApiContext.Provider>
  )
}

// Feature flags
export function FeatureGatedComponent() {
  const enableNewFeature = import.meta.env.PUBLIC_ENABLE_NEW_FEATURE === 'true'

  if (!enableNewFeature) return null

  return <NewFeature />
}
```

<!-- ::end:tabs -->

## Environment File Setup

### File Hierarchy (Loaded in Order)

TanStack Start automatically loads environment files in this order:

```
.env.local          # Local overrides (add to .gitignore)
.env.production     # Production-specific variables
.env.development    # Development-specific variables
.env                # Default variables (commit to git)
```

### Example Setup

**.env** (committed to repository):

```bash
# Public configuration (Vite uses VITE_; Rsbuild uses PUBLIC_ by default)
VITE_APP_NAME=My TanStack Start App
VITE_API_URL=https://api.example.com
VITE_SENTRY_DSN=https://...
PUBLIC_APP_NAME=My TanStack Start App
PUBLIC_API_URL=https://api.example.com
PUBLIC_SENTRY_DSN=https://...

# Server configuration templates
DATABASE_URL=postgresql://localhost:5432/myapp_dev
REDIS_URL=redis://localhost:6379
```

**.env.local** (add to .gitignore):

```bash
# Override for local development
DATABASE_URL=postgresql://user:password@localhost:5432/myapp_local
STRIPE_SECRET_KEY=sk_test_...
JWT_SECRET=your-local-secret
```

**.env.production**:

```bash
# Production overrides
VITE_API_URL=https://api.myapp.com
PUBLIC_API_URL=https://api.myapp.com
DATABASE_POOL_SIZE=20
```

## Common Patterns

### Database Configuration

```typescript
// src/lib/database.ts
import { createServerFn } from '@tanstack/react-start'

const getDatabaseConnection = createServerFn().handler(async () => {
  const config = {
    url: process.env.DATABASE_URL,
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10'),
    ssl: process.env.NODE_ENV === 'production',
  }

  return createConnection(config)
})
```

### Authentication Provider Setup

```typescript
// src/lib/auth.ts (Server)
export const authConfig = {
  secret: process.env.AUTH_SECRET,
  providers: {
    auth0: {
      domain: process.env.AUTH0_DOMAIN,
      clientId: process.env.AUTH0_CLIENT_ID,
      clientSecret: process.env.AUTH0_CLIENT_SECRET, // Server-only
    }
  }
}

// src/components/AuthProvider.tsx (Client)
export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <Auth0Provider
      domain={import.meta.env.VITE_AUTH0_DOMAIN}
      clientId={import.meta.env.VITE_AUTH0_CLIENT_ID}
      // No client secret here - it stays on the server
    >
      {children}
    </Auth0Provider>
  )
}
```

### External API Integration

```typescript
// src/lib/external-api.ts
import { createServerFn } from '@tanstack/react-start'

// Server-side API calls (can use secret keys)
const fetchUserData = createServerFn()
  .validator(z.object({ userId: z.string() }))
  .handler(async ({ data }) => {
    const response = await fetch(
      `${process.env.EXTERNAL_API_URL}/users/${data.userId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.EXTERNAL_API_SECRET}`,
          'Content-Type': 'application/json',
        },
      },
    )

    return response.json()
  })

// Client-side API calls (public endpoints only)
export function usePublicData() {
  const apiUrl = import.meta.env.VITE_PUBLIC_API_URL

  return useQuery({
    queryKey: ['public-data'],
    queryFn: () => fetch(`${apiUrl}/public/stats`).then((r) => r.json()),
  })
}
```

### Feature Flags and Configuration

```typescript
// src/config/features.ts
export const featureFlags = {
  enableNewDashboard: import.meta.env.VITE_ENABLE_NEW_DASHBOARD === 'true',
  enableAnalytics: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
  debugMode: import.meta.env.VITE_DEBUG_MODE === 'true',
}

// Usage in components
export function Dashboard() {
  if (featureFlags.enableNewDashboard) {
    return <NewDashboard />
  }

  return <LegacyDashboard />
}
```

## Type Safety

### TypeScript Declarations

Create `src/env.d.ts` to add type safety:

<!-- ::start:tabs variant="bundler" -->

# Vite

```typescript
/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Client-side environment variables
  readonly VITE_APP_NAME: string
  readonly VITE_API_URL: string
  readonly VITE_AUTH0_DOMAIN: string
  readonly VITE_AUTH0_CLIENT_ID: string
  readonly VITE_SENTRY_DSN?: string
  readonly VITE_ENABLE_NEW_DASHBOARD?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Server-side environment variables
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      readonly DATABASE_URL: string
      readonly REDIS_URL: string
      readonly JWT_SECRET: string
      readonly AUTH0_CLIENT_SECRET: string
      readonly STRIPE_SECRET_KEY: string
      readonly NODE_ENV: 'development' | 'production' | 'test'
    }
  }
}

export {}
```

# Rsbuild

```typescript
/// <reference types="@rsbuild/core/types" />

interface ImportMetaEnv {
  // Client-side environment variables
  readonly PUBLIC_APP_NAME: string
  readonly PUBLIC_API_URL: string
  readonly PUBLIC_AUTH0_DOMAIN: string
  readonly PUBLIC_AUTH0_CLIENT_ID: string
  readonly PUBLIC_SENTRY_DSN?: string
  readonly PUBLIC_ENABLE_NEW_DASHBOARD?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Server-side environment variables
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      readonly DATABASE_URL: string
      readonly REDIS_URL: string
      readonly JWT_SECRET: string
      readonly AUTH0_CLIENT_SECRET: string
      readonly STRIPE_SECRET_KEY: string
      readonly NODE_ENV: 'development' | 'production' | 'test'
    }
  }
}

export {}
```

<!-- ::end:tabs -->

### Runtime Validation

Use Zod for runtime validation of environment variables:

```typescript
// src/config/env.ts
import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  NODE_ENV: z.enum(['development', 'production', 'test']),
})

const clientEnvSchema = z.object({
  VITE_APP_NAME: z.string(),
  VITE_API_URL: z.string().url(),
  VITE_AUTH0_DOMAIN: z.string(),
  VITE_AUTH0_CLIENT_ID: z.string(),
})

// Validate server environment
// NOTE: Module-level parse runs at module load. Fine for Node.js;
// on Cloudflare Workers (and other edge runtimes) `process.env` is
// empty at module load, so wrap this in a function and call it
// inside `.handler()` instead:
//
//   export const getServerEnv = () => envSchema.parse(process.env)
//
// Then read `getServerEnv()` per-request from server functions/middleware.
export const serverEnv = envSchema.parse(process.env)

// Validate client environment (build-time, always safe)
export const clientEnv = clientEnvSchema.parse(import.meta.env)
```

## Security Best Practices

### 1. Never Expose Secrets to Client

```typescript
// ❌ WRONG - Secret exposed to client bundle
const config = {
  apiKey: import.meta.env.VITE_SECRET_API_KEY, // This will be in your JS bundle!
}

// ✅ CORRECT - Keep secrets on server
const getApiData = createServerFn().handler(async () => {
  const response = await fetch(apiUrl, {
    headers: { Authorization: `Bearer ${process.env.SECRET_API_KEY}` },
  })
  return response.json()
})
```

### 2. Use Appropriate Prefixes

```bash
# ✅ Server-only (no prefix)
DATABASE_URL=postgresql://...
JWT_SECRET=super-secret-key
STRIPE_SECRET_KEY=sk_live_...

# ✅ Client-safe (Vite uses VITE_; Rsbuild uses PUBLIC_ by default)
VITE_APP_NAME=My App
VITE_API_URL=https://api.example.com
VITE_SENTRY_DSN=https://...
PUBLIC_APP_NAME=My App
PUBLIC_API_URL=https://api.example.com
PUBLIC_SENTRY_DSN=https://...
```

### 3. Validate Required Variables

```typescript
// src/config/validation.ts
const requiredServerEnv = ['DATABASE_URL', 'JWT_SECRET'] as const

const requiredClientEnv = ['VITE_APP_NAME', 'VITE_API_URL'] as const // Use PUBLIC_ names for Rsbuild

// Validate on server startup
for (const key of requiredServerEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
}

// Validate client environment at build time
for (const key of requiredClientEnv) {
  if (!import.meta.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
}
```

## Production Checklist

- [ ] All sensitive variables are server-only (no `VITE_` or `PUBLIC_` prefix)
- [ ] Client variables use your build tool's public prefix (`VITE_` for Vite, `PUBLIC_` for Rsbuild)
- [ ] `.env.local` is in `.gitignore`
- [ ] Production environment variables are configured on hosting platform
- [ ] Required environment variables are validated at startup
- [ ] No hardcoded secrets in source code
- [ ] Database URLs use connection pooling in production
- [ ] API keys are rotated regularly

## Common Problems

### Environment Variable is Undefined

**Problem**: `import.meta.env.MY_VARIABLE` returns `undefined`

**Solutions**:

1. **Add correct prefix**: Use your build tool's public prefix (e.g. `VITE_MY_VARIABLE` for Vite or `PUBLIC_MY_VARIABLE` for Rsbuild)
2. **Restart development server** after adding new variables
3. **Check file location**: `.env` file must be in project root
4. **Verify build tool configuration**: Ensure variables are properly injected

**Example**:

```bash
# ❌ Won't work in client code
API_KEY=abc123

# ✅ Works in client code
VITE_API_KEY=abc123

# ❌ Won't bundle the variable (assuming it is not set in the environment of the build)
npm run build

# ✅ Works in client code and will bundle the variable for production
VITE_API_KEY=abc123 npm run build
```

### Runtime Client Environment Variables in Production

**Problem**: If public client variables are replaced at bundle time only, how to make runtime variables available on the client?

**Solutions**:

Pass variables from the server down to the client:

```tsx
const getRuntimeVar = createServerFn({ method: 'GET' }).handler(() => {
  return process.env.MY_RUNTIME_VAR // notice `process.env` on the server, and no public prefix
})

export const Route = createFileRoute('/')({
  loader: async () => {
    const foo = await getRuntimeVar()
    return { foo }
  },
  component: RouteComponent,
})

function RouteComponent() {
  const { foo } = Route.useLoaderData()
  // ... use your variable however you want
}
```

### Variable Not Updating

**Problem**: Environment variable changes aren't reflected

**Solutions**:

1. Restart development server
2. Check if you're modifying the correct `.env` file
3. Verify file hierarchy (`.env.local` overrides `.env`)

### TypeScript Errors

**Problem**: `Property 'VITE_MY_VAR' does not exist on type 'ImportMetaEnv'` or `Property 'PUBLIC_MY_VAR' does not exist on type 'ImportMetaEnv'`

**Solution**: Add to `src/env.d.ts`:

```typescript
interface ImportMetaEnv {
  readonly VITE_MY_VAR: string
  readonly PUBLIC_MY_VAR: string
}
```

### Security: Secret Exposed to Client

**Problem**: Sensitive data appearing in client bundle

**Solutions**:

1. Remove `VITE_` or `PUBLIC_` prefix from sensitive variables
2. Move sensitive operations to server functions
3. Use build tools to verify no secrets in client bundle

### Build Errors in Production

**Problem**: Missing environment variables in production build

**Solutions**:

1. Configure variables on hosting platform
2. Validate required variables at build time
3. Use deployment-specific `.env` files

## Server Build Configuration

### Static `NODE_ENV` Replacement

By default, TanStack Start statically replaces `process.env.NODE_ENV` in **server builds** at build time. This enables dead code elimination (tree-shaking) for development-only code paths in your server bundle.

**Why this matters:** Vite automatically replaces `process.env.NODE_ENV` in client builds, but server builds run in Node.js where `process.env` is a real runtime object. Without static replacement, code like this would remain in your production server bundle:

```typescript
if (process.env.NODE_ENV === 'development') {
  // This code would NOT be eliminated without static replacement
  enableDevTools()
  logDebugInfo()
}
```

With static replacement enabled (the default), the build tool sees `"production" === 'development'` and eliminates the entire block.

### Configuring Static Replacement

The replacement is controlled by the `server.build.staticNodeEnv` option:

<!-- ::start:tabs variant="bundler" -->

# Vite

```ts title="vite.config.ts"
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    tanstackStart({
      server: {
        build: {
          // Replace process.env.NODE_ENV at build time (default: true)
          staticNodeEnv: true,
        },
      },
    }),
    viteReact(),
  ],
})
```

# Rsbuild

```ts title="rsbuild.config.ts"
import { defineConfig } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'
import { tanstackStart } from '@tanstack/react-start/plugin/rsbuild'

export default defineConfig({
  plugins: [
    pluginReact(),
    tanstackStart({
      server: {
        build: {
          // Replace process.env.NODE_ENV at build time (default: true)
          staticNodeEnv: true,
        },
      },
    }),
  ],
})
```

<!-- ::end:tabs -->

The replacement value is determined in this order:

1. `process.env.NODE_ENV` at build time (if set)
2. The build tool's `mode` (e.g., from `--mode staging`)
3. `"production"` (fallback)

### When to Disable Static Replacement

Set `staticNodeEnv: false` if you need `NODE_ENV` to remain dynamic at runtime:

```ts
tanstackStart({
  server: {
    build: {
      staticNodeEnv: false, // Keep NODE_ENV dynamic at runtime
    },
  },
})
```

Common reasons to disable:

- **Same build, multiple environments**: Deploying one build artifact to staging and production
- **Runtime environment detection**: Code that must check the actual runtime environment
- **Testing production builds locally**: Running production builds with `NODE_ENV=development`

> **Note:** Disabling static replacement means development-only code paths will remain in your production bundle and be evaluated at runtime.

> **Important:** If you disable `staticNodeEnv`, you **must** set `NODE_ENV=production` at runtime when running your server in production. Without this, React (and possibly other libraries) will run in development mode, which is significantly slower and includes extra warnings and checks not intended for production use.

## Related Resources

- [Code Execution Patterns](./code-execution-patterns.md) - Learn about server vs client code execution
- [Server Functions](./server-functions.md) - Learn more about server-side code
- [Hosting](./hosting.md) - Platform-specific environment variable configuration
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html) - Official Vite documentation
- [Rsbuild Environment Variables](https://rsbuild.dev/guide/advanced/env-vars) - Official Rsbuild documentation
