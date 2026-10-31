---
title: How to Use Environment Variables
---

Learn how to configure and use environment variables in your TanStack Router application for API endpoints, feature flags, and build configuration across different bundlers.

## Quick Start

Environment variables in TanStack Router are primarily used for client-side configuration and must follow bundler-specific naming conventions for security.

```bash
# .env
VITE_API_URL=https://api.example.com
VITE_ENABLE_DEVTOOLS=true
```

```typescript
// Route configuration
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/posts')({
  loader: async () => {
    const apiUrl = import.meta.env.VITE_API_URL
    const response = await fetch(`${apiUrl}/posts`)
    return response.json()
  },
  component: PostsList,
})
```

## Environment Variable Access Patterns

### Vite-Based Projects (Most Common)

With Vite, environment variables must be prefixed with `VITE_` to be accessible in client code:

```typescript
// Route loaders
export const Route = createFileRoute('/dashboard')({
  loader: async () => {
    const apiUrl = import.meta.env.VITE_API_URL        // ✅ Works
    const apiKey = import.meta.env.VITE_PUBLIC_API_KEY // ✅ Works

    // This would be undefined (security feature):
    // const secret = import.meta.env.SECRET_KEY        // ❌ Undefined

    return fetchDashboardData(apiUrl, apiKey)
  },
})

// Components
export function ApiStatus() {
  const isDev = import.meta.env.DEV           // ✅ Built-in Vite variable
  const isProd = import.meta.env.PROD         // ✅ Built-in Vite variable
  const mode = import.meta.env.MODE           // ✅ development/production

  return (
    <div>
      Environment: {mode}
      {isDev && <DevToolsPanel />}
    </div>
  )
}
```

### Webpack-Based Projects

Configure webpack's DefinePlugin to inject environment variables. **Note:** Webpack doesn't support `import.meta.env` by default, so use `process.env` patterns:

```typescript
// webpack.config.js
const webpack = require('webpack')

module.exports = {
  plugins: [
    new webpack.DefinePlugin({
      'process.env.API_URL': JSON.stringify(process.env.API_URL),
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
      'process.env.ENABLE_FEATURE': JSON.stringify(process.env.ENABLE_FEATURE),
    }),
  ],
}

// Usage in routes
export const Route = createFileRoute('/api-data')({
  loader: async () => {
    const response = await fetch(`${process.env.API_URL}/data`)
    return response.json()
  },
  component: () => {
    const enableFeature = process.env.ENABLE_FEATURE === 'true'
    return enableFeature ? <NewFeature /> : <OldFeature />
  },
})
```

### Rspack-Based Projects

Rspack uses the `PUBLIC_` prefix convention. **Note:** `import.meta.env` support depends on your Rspack configuration and runtime - you may need to configure `builtins.define` properly:

```bash
# .env
PUBLIC_API_URL=https://api.example.com
PUBLIC_FEATURE_FLAG=true
```

```typescript
// Route usage
export const Route = createFileRoute('/features')({
  loader: async () => {
    const apiUrl = import.meta.env.PUBLIC_API_URL
    return fetch(`${apiUrl}/features`).then(r => r.json())
  },
  component: () => {
    const enableFeature = import.meta.env.PUBLIC_FEATURE_FLAG === 'true'
    return enableFeature ? <NewFeature /> : <OldFeature />
  },
})
```

### ESBuild Projects

Configure defines manually:

```typescript
// build script
import { build } from 'esbuild'

await build({
  entryPoints: ['src/main.tsx'],
  define: {
    'process.env.NODE_ENV': '"production"',
    'process.env.API_URL': `"${process.env.API_URL}"`,
  },
})
```

## Common Patterns

### API Configuration in Route Loaders

```typescript
// src/routes/posts/index.tsx
import { createFileRoute } from '@tanstack/react-router'

const fetchPosts = async () => {
  const baseUrl = import.meta.env.VITE_API_URL
  const apiKey = import.meta.env.VITE_API_KEY

  const response = await fetch(`${baseUrl}/posts`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error('Failed to fetch posts')
  }

  return response.json()
}

export const Route = createFileRoute('/posts/')({
  loader: fetchPosts,
  errorComponent: ({ error }) => (
    <div>Error loading posts: {error.message}</div>
  ),
})
```

### Environment-Based Route Configuration

```typescript
// src/routes/__root.tsx
import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

export const Route = createRootRoute({
  component: () => (
    <>
      <Outlet />
      {/* Only show devtools in development */}
      {import.meta.env.DEV && <TanStackRouterDevtools />}
    </>
  ),
})
```

### Feature Flags in Routes

```typescript
// src/lib/features.ts
export const features = {
  enableNewDashboard: import.meta.env.VITE_ENABLE_NEW_DASHBOARD === 'true',
  enableAnalytics: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
  debugMode: import.meta.env.DEV,
}

// src/routes/dashboard/index.tsx
import { createFileRoute, redirect } from '@tanstack/react-router'
import { features } from '../../lib/features'

export const Route = createFileRoute('/dashboard/')({
  beforeLoad: () => {
    // Redirect to old dashboard if new one is disabled
    if (!features.enableNewDashboard) {
      throw redirect({ to: '/dashboard/legacy' })
    }
  },
  component: NewDashboard,
})
```

### Authentication Configuration

```typescript
// src/lib/auth.ts
export const authConfig = {
  domain: import.meta.env.VITE_AUTH0_DOMAIN,
  clientId: import.meta.env.VITE_AUTH0_CLIENT_ID,
  redirectUri: `${window.location.origin}/callback`,
}

// src/routes/_authenticated.tsx
import { createFileRoute, redirect } from '@tanstack/react-router'
import { authConfig } from '../lib/auth'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    const isAuthenticated = await checkAuthStatus()

    if (!isAuthenticated) {
      // Redirect to auth provider
      const authUrl = `https://${authConfig.domain}/authorize?client_id=${authConfig.clientId}&redirect_uri=${authConfig.redirectUri}`
      window.location.href = authUrl
      return
    }
  },
})
```

### Search Params with Environment Config

```typescript
// src/routes/search.tsx
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const searchSchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
})

export const Route = createFileRoute('/search')({
  validateSearch: searchSchema,
  loader: async ({ search }) => {
    const apiUrl = import.meta.env.VITE_SEARCH_API_URL
    const params = new URLSearchParams({
      q: search.q || '',
      category: search.category || 'all',
      api_key: import.meta.env.VITE_SEARCH_API_KEY,
    })

    const response = await fetch(`${apiUrl}/search?${params}`)
    return response.json()
  },
})
```

## Environment File Setup

### File Hierarchy (Vite)

Vite loads environment files in this order:

```
.env.local          # Local overrides (add to .gitignore)
.env.production     # Production-specific
.env.development    # Development-specific
.env                # Default (commit to git)
```

### Example Configuration

**.env** (committed to repository):

```bash
# API Configuration
VITE_API_URL=https://api.example.com
VITE_API_VERSION=v1

# Feature Flags
VITE_ENABLE_NEW_UI=false
VITE_ENABLE_ANALYTICS=true

# Auth Configuration (public keys only)
VITE_AUTH0_DOMAIN=your-domain.auth0.com
VITE_AUTH0_CLIENT_ID=your-client-id

# Build Configuration
VITE_APP_NAME=TanStack Router App
VITE_APP_VERSION=1.0.0
```

**.env.local** (add to .gitignore):

```bash
# Development overrides
VITE_API_URL=http://localhost:3001
VITE_ENABLE_NEW_UI=true
VITE_DEBUG_MODE=true
```

**.env.production**:

```bash
# Production-specific
VITE_API_URL=https://api.prod.example.com
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_NEW_UI=true
```

## Type Safety

### Vite TypeScript Declarations

Create `src/vite-env.d.ts`:

```typescript
/// <reference types="vite/client" />

interface ImportMetaEnv {
  // API Configuration
  readonly VITE_API_URL: string
  readonly VITE_API_VERSION: string
  readonly VITE_API_KEY?: string

  // Feature Flags
  readonly VITE_ENABLE_NEW_UI: string
  readonly VITE_ENABLE_ANALYTICS: string
  readonly VITE_DEBUG_MODE?: string

  // Authentication
  readonly VITE_AUTH0_DOMAIN: string
  readonly VITE_AUTH0_CLIENT_ID: string

  // App Configuration
  readonly VITE_APP_NAME: string
  readonly VITE_APP_VERSION: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

### Runtime Validation

Use Zod to validate environment variables at startup with fallbacks and optional values:

```typescript
// src/config/env.ts
import { z } from 'zod'

const envSchema = z.object({
  // Required variables
  VITE_API_URL: z.string().url(),
  VITE_AUTH0_DOMAIN: z.string(),
  VITE_AUTH0_CLIENT_ID: z.string(),
  VITE_APP_NAME: z.string(),

  // Optional with defaults
  VITE_API_VERSION: z.string().default('v1'),
  VITE_ENABLE_NEW_UI: z.string().default('false'),
  VITE_ENABLE_ANALYTICS: z.string().default('true'),

  // Optional variables
  VITE_DEBUG_MODE: z.string().optional(),
  VITE_SENTRY_DSN: z.string().optional(),
})

// Validate at app startup with fallbacks
export const env = envSchema.parse({
  ...import.meta.env,
  // Provide fallbacks for missing optional values
  VITE_API_VERSION: import.meta.env.VITE_API_VERSION || 'v1',
  VITE_ENABLE_NEW_UI: import.meta.env.VITE_ENABLE_NEW_UI || 'false',
  VITE_ENABLE_ANALYTICS: import.meta.env.VITE_ENABLE_ANALYTICS || 'true',
})

// Typed helper functions
export const isFeatureEnabled = (flag: keyof typeof env) => {
  return env[flag] === 'true'
}

// Type-safe boolean conversion
export const getBooleanEnv = (
  value: string | undefined,
  defaultValue = false,
): boolean => {
  if (value === undefined) return defaultValue
  return value === 'true'
}
```

### Usage with Type Safety

```typescript
// src/routes/api-data.tsx
import { createFileRoute } from '@tanstack/react-router'
import { env, isFeatureEnabled } from '../config/env'

export const Route = createFileRoute('/api-data')({
  loader: async () => {
    // TypeScript knows these are strings and exist
    const response = await fetch(`${env.VITE_API_URL}/${env.VITE_API_VERSION}/data`)
    return response.json()
  },
  component: () => {
    return (
      <div>
        <h1>{env.VITE_APP_NAME}</h1>
        {isFeatureEnabled('VITE_ENABLE_NEW_UI') && <NewUIComponent />}
      </div>
    )
  },
})
```

## Bundler-Specific Configuration

### Vite Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

export default defineConfig({
  plugins: [
    react(),
    // tanstackRouter generates route tree and enables file-based routing
    tanstackRouter(),
  ],
  // Environment variables are handled automatically
  // Custom environment variable handling:
  define: {
    // Global constants (these become available as global variables)
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
  },
})
```

### Webpack Configuration

```typescript
// webpack.config.js
const { TanStackRouterWebpack } = require('@tanstack/router-webpack-plugin')
const webpack = require('webpack')

module.exports = {
  plugins: [
    // TanStackRouterWebpack generates route tree and enables file-based routing
    new TanStackRouterWebpack(),
    new webpack.DefinePlugin({
      // Inject environment variables (use process.env for Webpack)
      'process.env.API_URL': JSON.stringify(process.env.API_URL),
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
      'process.env.ENABLE_FEATURE': JSON.stringify(process.env.ENABLE_FEATURE),
    }),
  ],
}
```

### Rspack Configuration

```typescript
// rspack.config.js
const { TanStackRouterRspack } = require('@tanstack/router-rspack-plugin')

module.exports = {
  plugins: [
    // TanStackRouterRspack generates route tree and enables file-based routing
    new TanStackRouterRspack(),
  ],
  // Rspack automatically handles PUBLIC_ prefixed variables for import.meta.env
  // Custom handling for additional variables:
  builtins: {
    define: {
      // Define additional variables (these become global replacements)
      'process.env.API_URL': JSON.stringify(process.env.PUBLIC_API_URL),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },
  },
}
```

## Production Checklist

- [ ] All client-exposed variables use appropriate prefix (`VITE_`, `PUBLIC_`, etc.)
- [ ] No sensitive data (API secrets, private keys) in environment variables
- [ ] `.env.local` is in `.gitignore`
- [ ] Production environment variables are configured on hosting platform
- [ ] Required environment variables are validated at build time
- [ ] TypeScript declarations are up to date
- [ ] Feature flags are properly configured for production
- [ ] API URLs point to production endpoints

## Common Problems

### Environment Variable is Undefined

**Problem**: `import.meta.env.MY_VARIABLE` returns `undefined`

**Solutions**:

1. **Add correct prefix**: Use `VITE_` for Vite, `PUBLIC_` for Rspack.
   Vite's default prefix may be changed in the config:
   ```ts
   // vite.config.ts
   export const config = {
     // ...rest of your config
     envPrefix: 'MYPREFIX_', // this means `MYPREFIX_MY_VARIABLE` is the new correct way
   }
   ```
2. **Restart development server** after adding new variables
3. **Check file location**: `.env` file must be in project root
4. **Verify bundler configuration**: Ensure variables are properly injected
5. **Verify variable**:

- **In dev**: is in correct `.env` file or environment
- **For prod**: is in correct `.env` file or current environment **_at bundle time_**. That's right, `VITE_`/`PUBLIC_`-prefixed variables are replaced in a macro-like fashion at bundle time, and will _never_ be read at runtime on your server. This is a common mistake, so make sure this is not your case.

**Example**:

```bash
# ❌ Won't work (no prefix)
API_KEY=abc123

# ✅ Works with Vite
VITE_API_KEY=abc123

# ✅ Works with Rspack
PUBLIC_API_KEY=abc123

# ❌ Won't bundle the variable (assuming it is not set in the environment of the build)
npm run build

# ✅ Works with Vite and will bundle the variable for production
VITE_API_KEY=abc123 npm run build

# ✅ Works with Rspack and will bundle the variable for production
PUBLIC_API_KEY=abc123 npm run build
```

### Runtime Client Environment Variables at Runtime in Production

**Problem**: If `VITE_`/`PUBLIC_` variables are replaced at bundle time only, how to make runtime variables available on the client ?

**Solutions**:

Pass variables from the server down to the client:

1. Add your variable to the correct `env.` file
2. Create an endpoint on your server to read the value from the client

**Example**:

You may use your prefered backend framework/libray, but here it is using Tanstack Start server functions:

```tsx
const getRuntimeVar = createServerFn({ method: 'GET' }).handler(() => {
  return process.env.MY_RUNTIME_VAR // notice `process.env` on the server, and no `VITE_`/`PUBLIC_` prefix
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

**Problem**: Environment variable changes aren't reflected in app

**Solutions**:

1. **Restart development server** - Required for new variables
2. **Check file hierarchy** - `.env.local` overrides `.env`
3. **Clear browser cache** - Hard refresh (Ctrl+Shift+R)
4. **Verify correct file** - Make sure you're editing the right `.env` file

### TypeScript Errors

**Problem**: `Property 'VITE_MY_VAR' does not exist on type 'ImportMetaEnv'`

**Solution**: Add declaration to `src/vite-env.d.ts`:

```typescript
interface ImportMetaEnv {
  readonly VITE_MY_VAR: string
}
```

### Build Errors

**Problem**: Missing environment variables during build

**Solutions**:

1. **Configure CI/CD**: Set variables in build environment
2. **Add validation**: Check required variables at build time
3. **Use .env files**: Ensure production `.env` files exist
4. **Check bundler config**: Verify environment variable injection

### Security Issues

**Problem**: Accidentally exposing sensitive data

**Solutions**:

1. **Never use secrets in client variables** - They're visible in browser
2. **Use server-side proxies** for sensitive API calls
3. **Audit bundle** - Check built files for leaked secrets
4. **Follow naming conventions** - Only prefixed variables are exposed

### Runtime vs Build-time Confusion

**Problem**: Variables not available at runtime

**Solutions**:

1. **Understand static replacement** - Variables are replaced at build time
2. **Use server-side for dynamic values** - Use APIs for runtime configuration
3. **Validate at startup** - Check all required variables exist

### Environment Variables are Always Strings

**Problem**: Unexpected behavior when comparing boolean or numeric values

**Solutions**:

1. **Always compare as strings**: Use `=== 'true'` not `=== true`
2. **Convert explicitly**: Use `parseInt()`, `parseFloat()`, or `Boolean()`
3. **Use helper functions**: Create typed conversion utilities

**Example**:

```typescript
// ❌ Won't work as expected
const isEnabled = import.meta.env.VITE_FEATURE_ENABLED // This is a string!
if (isEnabled) {
  /* Always true if variable exists */
}

// ✅ Correct string comparison
const isEnabled = import.meta.env.VITE_FEATURE_ENABLED === 'true'

// ✅ Safe numeric conversion
const port = parseInt(import.meta.env.VITE_PORT || '3000', 10)

// ✅ Helper function approach
const getBooleanEnv = (value: string | undefined, defaultValue = false) => {
  if (value === undefined) return defaultValue
  return value.toLowerCase() === 'true'
}
```

## Common Next Steps

<!-- [Set Up Authentication](./setup-authentication.md) - Configure auth providers with environment variables -->
<!-- [Deploy to Production](./deploy-to-production.md) - Set up production environment variables -->
<!-- [Set Up API Integration](./setup-api-integration.md) - Configure API endpoints and keys -->

## Related Resources

- [TanStack Router File-Based Routing](../routing/file-based-routing.md) - Learn about route configuration
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html) - Official Vite documentation
- [Webpack DefinePlugin](https://webpack.js.org/plugins/define-plugin/) - Webpack environment configuration
