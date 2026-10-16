---
id: authentication-server-primitives
title: Authentication Server Primitives
---

This guide covers the **server-side primitives** for building authentication in TanStack Start: session cookies, session lookup, OAuth, password-reset hardening, CSRF, and rate limiting. It pairs with the [routing-side guide](../../../../router/guide/authenticated-routes.md) (`_authenticated` layout, `beforeLoad`, redirects, RBAC).

If you can use a managed solution like [Clerk](https://go.clerk.com/wOwHtuJ) or [WorkOS](https://workos.com/), prefer that — they handle most of what this guide describes. Read on if you're rolling your own.

## Protect Data First

Authentication has a data/API boundary and a route/UI layer. The data boundary is the security boundary: every server function, server route, or API endpoint that reads or writes private data must authorize the request before returning data or mutating state.

- **Data/API boundary** (this guide): issue and verify session cookies, exchange OAuth codes, hash and verify passwords, rate-limit credential endpoints, defeat user enumeration, and authorize private data access.
- **Route/UI layer** (`router-core/auth-and-guards`): redirect unauthenticated users away from screens they cannot use, gate UI on roles/permissions, surface a login form, and avoid triggering requests that would fail anyway.

> **A route guard is not a data authorization boundary.** Server functions and server routes are API endpoints; they are reachable independently of the route that calls them. Auth must be enforced in the handler or middleware for the endpoint that touches private data. `beforeLoad` is for route UX.

## Session Cookies

The default session storage is an HTTP-only cookie. The cookie can hold:

- An **opaque session ID** that the server looks up in a database (recommended — easy to revoke).
- A **signed/encrypted token** that carries the session payload itself (stateless, but revocation is harder).

Whichever you choose, the cookie flags matter:

```ts
// src/server/session.ts
import {
  getRequestHeader,
  setResponseHeader,
} from '@tanstack/react-start/server'

const SESSION_COOKIE = '__Host-session'
const ONE_DAY = 60 * 60 * 24

export function setSessionCookie(token: string) {
  setResponseHeader(
    'Set-Cookie',
    [
      `${SESSION_COOKIE}=${token}`,
      `HttpOnly`,
      `Secure`,
      `SameSite=Lax`,
      `Path=/`,
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

| Flag             | Why                                                                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `HttpOnly`       | JavaScript can't read the cookie. An XSS bug can't exfiltrate the session.                                                                                   |
| `Secure`         | HTTPS only. Required when using the `__Host-` prefix.                                                                                                        |
| `SameSite=Lax`   | Sent on top-level navigations; blocks most cross-site CSRF on POST. Use `Strict` for higher-risk apps where loss of cross-site GET navigation is acceptable. |
| `__Host-` prefix | Binds the cookie to the exact origin. No `Domain` attribute, `Path=/`, `Secure` required. Defeats subdomain-takeover session fixation.                       |
| `Path=/`         | Required by `__Host-`.                                                                                                                                       |
| `Max-Age`        | Bounded lifetime. Pair with server-side rotation.                                                                                                            |

## Session Lookup as Middleware

Centralize session loading in middleware so every protected handler sees a typed session:

```ts
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

Attach to every protected server function:

```ts
import { createServerFn } from '@tanstack/react-start'
import { authMiddleware } from '~/server/auth-middleware'

export const getMyOrders = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    return db.orders.findMany({ where: { userId: context.session.userId } })
  })
```

## Login

```ts
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

    // Rotate: destroy any existing session, then issue fresh.
    await db.sessions.revokeAllForUser(user.id)
    const token = await db.sessions.create({ userId: user.id })
    setSessionCookie(token)
    return { ok: true }
  })
```

The `Invalid email or password` message is identical for "user not found" and "wrong password". The dummy-hash technique above also makes the timing identical: without it, the no-user branch returns instantly while the wrong-password branch spends ~100ms on the hash compare, leaking account existence over the wire.

## Logout

```ts
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

For OAuth authorization-code flow:

- Generate a one-time random `state` parameter — prevents CSRF on the callback.
- Generate a PKCE `code_verifier`/`code_challenge` pair — defends against authorization-code interception.
- Store both in a short-lived signed cookie keyed to this exact attempt.

```ts
// src/server/oauth.functions.ts
import { createServerFn } from '@tanstack/react-start'
import { redirect } from '@tanstack/react-router'
import { setResponseHeader } from '@tanstack/react-start/server'
import crypto from 'node:crypto'

const OAUTH_STATE_COOKIE = '__Host-oauth'

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

In the callback handler:

1. Read the cookie, verify its signature, and extract `state` + `verifier`.
2. Compare cookie-state to the `state` query param. If they don't match, abort.
3. Exchange the authorization code for an access token, sending `code_verifier` along with it.
4. Fetch the user profile, find/create the local user record, issue a session.
5. Clear the OAuth cookie.

If any of those checks fail, the request did not originate from your `startOAuth` and must be rejected.

## Password Reset: defeat user enumeration

The reset endpoint must NOT tell the caller whether a given email is registered. Returning 200 vs 404 — or even different copy — leaks user existence to anyone who can hit the endpoint.

```ts
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
    // Same response, same body, regardless of existence.
    return { ok: true }
  })
```

Do NOT:

- Return 200 if exists, 404 if not.
- Vary the message ("we sent you a link" vs "no account found").
- Skip the work when the user doesn't exist (timing leak — measurable from the wire).

## CSRF for non-GET RPCs

`SameSite=Lax` on the session cookie blocks most cross-site CSRF for POST/PUT/DELETE. Two cases need explicit defense:

1. **GET-that-mutates** — never. Use POST/PUT/DELETE for any mutation.
2. **POST from a sibling subdomain** — `SameSite=Lax` does not block this; verify the `Origin` header matches your app.

```ts
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

Attach this in `src/start.ts` global `requestMiddleware` so it runs on every non-GET request, including server routes and SSR.

## Rate Limiting Auth Endpoints

A login endpoint without rate limiting is a credential-stuffing target. Limit per IP (and per-account if you can identify the user) with a sliding window or token bucket.

```ts
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
    const allowed = await rateLimiter.consume(
      `rl:${opts.key}:${ip}`,
      opts.max,
      opts.windowMs,
    )
    if (!allowed) throw new Error('Too many requests')
    return next()
  })
}

export const login = createServerFn({ method: 'POST' }).middleware([
  rateLimitMiddleware({ key: 'login', max: 5, windowMs: 60_000 }),
])
// ...
```

## Session Rotation

Whenever the user's privileges change — login, logout, password change, role grant — destroy the old session and issue a new one. This neutralizes session-fixation attacks where an attacker plants their own session ID in the victim's browser before the privilege change.

```ts
// On login: revoke any pre-login session, create fresh.
await db.sessions.revokeAllForUser(user.id)
const token = await db.sessions.create({ userId: user.id })
setSessionCookie(token)

// On password change / role grant:
await db.sessions.revokeAllForUser(user.id)
const token = await db.sessions.create({ userId: user.id })
setSessionCookie(token)
```

## Read Cookies and Env Per Request, Not at Module Scope

Module-scope reads are wrong on two axes:

- **Security:** they can be inlined into the client bundle.
- **Correctness on edge runtimes:** Cloudflare Workers (and others) inject env at request time. Module-level reads run before any request exists and evaluate to `undefined` even on the server.

```ts
// ❌ Wrong
const SESSION_SECRET = process.env.SESSION_SECRET
export function signSession(payload) {
  return sign(payload, SESSION_SECRET)
}

// ✅ Right
export function signSession(payload) {
  return sign(payload, process.env.SESSION_SECRET)
}
```

See [Execution Model: Module-Level `process.env` Reads](./execution-model.md#module-level-processenv-reads) for the full rule.

## See Also

- [Authentication Overview](./authentication-overview.md) — choosing between partner solutions, OSS libraries, and DIY.
- [Authenticated Routes (Router)](../../../../router/guide/authenticated-routes.md) — the routing-side guide.
- [Server Functions](./server-functions.md) — the RPC primitive that auth lives inside.
- [Middleware](./middleware.md) — composing `authMiddleware`.
- [OWASP Cheat Sheets — Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html), [Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).
- [MDN — Set-Cookie](https://developer.mozilla.org/docs/Web/HTTP/Headers/Set-Cookie).
