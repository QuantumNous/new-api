---
name: start-core/auth-server-primitives
description: >-
  Server-side authentication primitives for TanStack Start: session
  cookies (HttpOnly, Secure, SameSite, __Host- prefix), session
  read/issue/destroy via createServerFn and middleware, OAuth
  authorization-code flow with state and PKCE, password-reset
  enumeration defense, CSRF for non-GET RPCs, rate limiting auth
  endpoints, session rotation on privilege change. Pairs with
  router-core/auth-and-guards for the routing side.
type: sub-skill
library: tanstack-start
library_version: '1.166.2'
requires:
  - start-core
  - start-core/server-functions
  - start-core/middleware
sources:
  - TanStack/router:docs/start/framework/react/guide/authentication-overview.md
  - TanStack/router:docs/start/framework/react/guide/authentication-server-primitives.md
---

# Auth Server Primitives

This skill covers the **server half** of authentication: session storage, cookie issuance, OAuth flow, password-reset hardening, CSRF, rate limiting. For the **routing half** (`_authenticated` layout, `beforeLoad` redirects, RBAC checks), see [router-core/auth-and-guards](../../../../router-core/skills/router-core/auth-and-guards/SKILL.md).

> **CRITICAL**: Protect the data/API boundary first. Server functions, server routes, and other API endpoints that touch private data must enforce auth **inside the handler** or middleware. Route guards are route UX, not the data security boundary.
> **CRITICAL**: Validating the _shape_ of a client-supplied identifier (`z.string().uuid().parse(...)`) is not authorization. A parsed UUID is still _some_ tenant — re-check membership against the session principal before using it.
> **CRITICAL**: Read session/cookies inside `.handler()` or middleware `.server()`, not at module scope. Module-level reads run before requests exist (and are also undefined on Cloudflare Workers).

## Production Checklist

- Enforce auth in every server function, server route, or API endpoint that reads or writes private user, tenant, or account data. Use route `beforeLoad` for page UX, not as the data boundary.
- Use `.validator()` on every server function that accepts input.
- Store sessions in `HttpOnly`, `Secure`, `SameSite` cookies. Do not store session tokens in `localStorage` or `sessionStorage`.
- Hash passwords with bcrypt, scrypt, or Argon2. For missing users, verify against a dummy hash and return the same login/reset message.
- Rate limit login, registration, and password-reset endpoints.
- Use CSRF or same-origin protections for non-GET server functions and server routes.
- Log authentication events and monitor failures.
- Test direct unauthenticated calls to protected server functions; they should reject before returning data.

## Session Cookies

The recommended session storage is an HTTP-only cookie holding either an opaque session ID (with server-side lookup) or a signed/encrypted token. The cookie flags matter — set them all.

```tsx
// src/server/session.ts
import {
  getRequestHeader,
  setResponseHeader,
} from '@tanstack/react-start/server'

const SESSION_COOKIE = '__Host-session' // __Host- prefix binds to the exact origin + path '/'
const ONE_DAY = 60 * 60 * 24

export function setSessionCookie(token: string) {
  setResponseHeader(
    'Set-Cookie',
    [
      `${SESSION_COOKIE}=${token}`,
      `HttpOnly`, // not readable from JS — defeats XSS exfiltration
      `Secure`, // HTTPS only (required for __Host- prefix)
      `SameSite=Lax`, // sent on top-level navigations, blocks most CSRF
      `Path=/`, // required for __Host- prefix
      `Max-Age=${ONE_DAY}`,
    ].join('; '),
  )
}

export function clearSessionCookie() {
  setResponseHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
  )
}

export function readSessionToken(): string | null {
  const header = getRequestHeader('cookie')
  if (!header) return null
  for (const part of header.split(/;\s*/)) {
    // Split only on the FIRST '=' — signed/base64 values often contain '='.
    const eq = part.indexOf('=')
    if (eq === -1) continue
    if (part.slice(0, eq) === SESSION_COOKIE) return part.slice(eq + 1)
  }
  return null
}
```

Flag rationale:

- `HttpOnly` — JavaScript can't read the cookie, so an XSS bug can't steal the session.
- `Secure` — HTTPS only. Required when using `__Host-` prefix.
- `SameSite=Lax` — blocks CSRF on most cross-origin POST/PUT/DELETE. Use `Strict` for highest-security flows where loss of cross-site GET navigation is acceptable.
- `__Host-` prefix — binds the cookie to the exact origin (no Domain attribute, Path must be `/`, Secure must be set). Prevents subdomain takeover from forging a session cookie.
- `Path=/` — required by `__Host-`.
- `Max-Age` — finite lifetime so a stolen cookie isn't useful forever. Pair with server-side session rotation.

## Session Lookup as Middleware

Use middleware to centralize session loading so every protected handler sees a typed session:

```tsx
// src/server/auth-middleware.ts
import { createMiddleware } from '@tanstack/react-start'
import { readSessionToken } from './session'

export const authMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const token = readSessionToken()
    const session = token ? await db.sessions.findValid(token) : null
    if (!session) throw new Error('Unauthorized')
    return next({ context: { session } })
  },
)
```

Attach it to every server function that needs a logged-in user:

```tsx
import { createServerFn } from '@tanstack/react-start'
import { authMiddleware } from '~/server/auth-middleware'

export const getMyOrders = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    return db.orders.findMany({ where: { userId: context.session.userId } })
  })
```

> **Route guards do not cover this.** A `createFileRoute('/_authenticated/orders')` with a `beforeLoad` redirect does NOT protect `getMyOrders` — the RPC is reachable directly whether or not the user ever hits the route. Apply `authMiddleware` (or re-check inside `.handler()`) on every server function that needs auth.

## Issuing a Session on Login

```tsx
// src/server/login.functions.ts
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { setSessionCookie } from './session'

export const login = createServerFn({ method: 'POST' })
  .validator(z.object({ email: z.string().email(), password: z.string() }))
  .handler(async ({ data }) => {
    const user = await db.users.findByEmail(data.email)
    // Always run verifyPasswordHash — even when the user doesn't exist —
    // so the user-not-found branch takes the same time as wrong-password.
    // DUMMY_PASSWORD_HASH is a hash of any throwaway password computed once
    // at startup with the same algorithm/cost as real password hashes.
    const hashToCheck = user?.passwordHash ?? DUMMY_PASSWORD_HASH
    const passwordMatches = await verifyPasswordHash(hashToCheck, data.password)
    const ok = user != null && passwordMatches
    if (!ok) throw new Error('Invalid email or password')

    // ROTATE on privilege change: destroy any existing session, then issue fresh.
    await db.sessions.revokeAllForUser(user.id)
    const token = await db.sessions.create({ userId: user.id })
    setSessionCookie(token)
    return { ok: true }
  })
```

## Logout

```tsx
import { createServerFn } from '@tanstack/react-start'
import { authMiddleware } from '~/server/auth-middleware'
import { clearSessionCookie } from '~/server/session'

export const logout = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await db.sessions.revoke(context.session.id)
    clearSessionCookie()
    return { ok: true }
  })
```

## OAuth: state + PKCE

For OAuth authorization-code flow, generate a one-time `state` (CSRF defense) and a PKCE verifier (defense against authorization-code interception). Store both in a short-lived signed cookie keyed to this exact login attempt.

```tsx
// src/server/oauth.functions.ts
import { createServerFn } from '@tanstack/react-start'
import { redirect } from '@tanstack/react-router'
import {
  getRequestHeader,
  setResponseHeader,
} from '@tanstack/react-start/server'
import crypto from 'node:crypto'

const OAUTH_STATE_COOKIE = '__Host-oauth' // expires fast; one-shot

function base64url(buf: Buffer) {
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

export const startOAuth = createServerFn({ method: 'GET' }).handler(
  async () => {
    const state = base64url(crypto.randomBytes(32))
    const verifier = base64url(crypto.randomBytes(32))
    const challenge = base64url(
      crypto.createHash('sha256').update(verifier).digest(),
    )

    setResponseHeader(
      'Set-Cookie',
      `${OAUTH_STATE_COOKIE}=${signed({ state, verifier })}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,
    )

    throw redirect({
      href:
        `https://provider.example/authorize` +
        `?response_type=code` +
        `&client_id=${process.env.OAUTH_CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(process.env.OAUTH_REDIRECT_URI!)}` +
        `&state=${state}` +
        `&code_challenge=${challenge}` +
        `&code_challenge_method=S256`,
    })
  },
)
```

In the callback handler, **verify the cookie state matches the returned state** and exchange the code with the verifier. If state is missing or doesn't match, abort — the request did not originate from your `startOAuth`.

## Password Reset: defeat user enumeration

When a user requests a reset, do not let the response shape or timing reveal whether the email is registered.

```tsx
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

export const requestPasswordReset = createServerFn({ method: 'POST' })
  .validator(z.object({ email: z.string().email() }))
  .handler(async ({ data }) => {
    const user = await db.users.findByEmail(data.email)
    if (user) {
      const token = await db.passwordResets.issue(user.id)
      await sendResetEmail(user.email, token)
    }
    // Always 200, always the same body, regardless of whether the user exists.
    // The user is told to check their inbox; no confirmation either way.
    return { ok: true }
  })
```

Do NOT:

- Return 200 if exists, 404 if not.
- Use a different message ("we sent you a link" vs "no account found").
- Skip the work when the user doesn't exist (timing leak — measurable from the wire).

## CSRF for non-GET RPCs

`SameSite=Lax` on the session cookie blocks most cross-site CSRF for POST/PUT/DELETE. Two cases need extra defense:

1. **Top-level GET navigation that mutates** — never do this. Always use POST/PUT/DELETE for mutations.
2. **POST from a page on a sibling subdomain** — `SameSite=Lax` does NOT block this; verify the `Origin` header matches your app's origin in middleware.

```tsx
import { createMiddleware } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

export const csrfMiddleware = createMiddleware().server(async ({ next }) => {
  const request = getRequest()
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const origin = request.headers.get('origin')
    // Compare the FULL origin (scheme + host + port) — host alone lets
    // http://example.com pass a check meant for https://example.com.
    if (!origin || new URL(origin).origin !== process.env.APP_ORIGIN) {
      throw new Error('Origin check failed')
    }
  }
  return next()
})
```

Attach this to global request middleware in `src/start.ts` so it covers every non-GET request, including server routes and SSR.

## Rate Limiting Auth Endpoints

A login endpoint without rate limiting is a credential-stuffing target. Limit per-IP (and ideally per-account) with a sliding window.

```tsx
import { createMiddleware } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

function rateLimitMiddleware(opts: {
  key: string
  max: number
  windowMs: number
}) {
  return createMiddleware().server(async ({ next }) => {
    const request = getRequest()
    const ip =
      request.headers.get('cf-connecting-ip') ??
      request.headers.get('x-forwarded-for')?.split(',')[0] ??
      'unknown'
    const bucketKey = `rl:${opts.key}:${ip}`
    const allowed = await rateLimiter.consume(
      bucketKey,
      opts.max,
      opts.windowMs,
    )
    if (!allowed) throw new Error('Too many requests')
    return next()
  })
}

// On the login server function:
export const login = createServerFn({ method: 'POST' }).middleware([
  rateLimitMiddleware({ key: 'login', max: 5, windowMs: 60_000 }),
])
// ...
```

## Session Rotation on Privilege Change

Whenever the user's privileges change — login, logout, role change, password change — **destroy the old session and issue a new one**. This neutralizes session-fixation attacks where an attacker plants their own session ID in the victim's browser before login.

```tsx
// In the login handler (already shown above): destroy any pre-login session, then create a fresh one.
await db.sessions.revokeAllForUser(user.id)
const token = await db.sessions.create({ userId: user.id })
setSessionCookie(token)
```

```tsx
// On password change / role grant:
await db.sessions.revokeAllForUser(user.id) // destroy existing
const token = await db.sessions.create({ userId: user.id }) // issue fresh
setSessionCookie(token)
```

## Common Mistakes

### CRITICAL: Trusting the route guard for server-function auth

```tsx
// WRONG — the RPC is callable directly via POST regardless of the route
export const Route = createFileRoute('/_authenticated/orders')({
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated) throw redirect({ to: '/login' })
  },
})
const getMyOrders = createServerFn({ method: 'GET' }).handler(async () => {
  return db.orders.findMany() // ← anyone can hit the RPC and get all orders
})

// CORRECT — auth enforced on the handler itself
const getMyOrders = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    return db.orders.findMany({ where: { userId: context.session.userId } })
  })
```

### CRITICAL: Treating shape validation as authorization

A parsed UUID is _some_ workspace, not an _authorized_ workspace.

```tsx
// WRONG — UUID is well-formed but the user may not be a member
const getWorkspaceData = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(z.object({ workspaceId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    return db.workspaces.findById(data.workspaceId) // missing membership check!
  })

// CORRECT — verify the session principal has access to that workspace
const getWorkspaceData = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(z.object({ workspaceId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const member = await db.memberships.find({
      userId: context.session.userId,
      workspaceId: data.workspaceId,
    })
    if (!member) throw new Error('Not a member of this workspace')
    return db.workspaces.findById(data.workspaceId)
  })
```

### HIGH: Returning different responses based on email existence

Already covered above — `requestPasswordReset` must return the same body regardless of whether the email matches a user.

### HIGH: Reading cookies/env at module scope

```tsx
// WRONG — module-load time, before any request exists
const SESSION_SECRET = process.env.SESSION_SECRET
export function signSession(payload) {
  return sign(payload, SESSION_SECRET)
}

// CORRECT — read inside per-request callback
export function signSession(payload) {
  return sign(payload, process.env.SESSION_SECRET)
}
```

On Cloudflare Workers and other edge runtimes, the module-level read evaluates to `undefined` even on the server because env is injected per-request. See [start-core/execution-model](../execution-model/SKILL.md).

### MEDIUM: Long-lived sessions with no rotation

A session token that never rotates is functionally a long-lived credential. Rotate on login, logout, password change, and role/permission change.

## Cross-References

- [router-core/auth-and-guards](../../../../router-core/skills/router-core/auth-and-guards/SKILL.md) — the routing side: `_authenticated` layout, `beforeLoad`, `redirect`, RBAC checks.
- [start-core/server-functions](../server-functions/SKILL.md) — how to expose RPCs (and how the route guard does NOT cover them).
- [start-core/middleware](../middleware/SKILL.md) — composing `authMiddleware` and others.
- [start-core/execution-model](../execution-model/SKILL.md) — why module-level env/secret reads are wrong.
