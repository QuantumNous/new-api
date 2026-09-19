---
id: authentication-overview
title: Authentication
---

## Authentication vs Authorization

- **Authentication**: Who is this user? (Login/logout, identity verification)
- **Authorization**: What can this user do? (Permissions, roles, access control)

## Architecture Overview

### Full-Stack Authentication Model

**Server-Side (Secure)**

- Session storage and validation
- User credential verification
- Database operations
- Token generation/verification
- Protected API endpoints

**Client-Side (Public)**

- Authentication state management
- Route protection logic
- Login/logout user interface
- Redirect handling

**Isomorphic (Both)**

- Route loaders checking auth state
- Shared validation logic
- User profile data access

### Session Management Patterns

**HTTP-Only Cookies (Recommended)**

- Most secure approach - not accessible via JavaScript
- Automatic browser handling
- Built-in CSRF protection with `sameSite`
- Best for traditional web applications

**JWT Tokens**

- Stateless authentication
- Good for API-first applications
- Requires careful handling to avoid XSS vulnerabilities
- Consider refresh token rotation

**Server-Side Sessions**

- Centralized session control
- Easy to revoke sessions
- Requires session storage (database, Redis)
- Good for applications requiring immediate session control

### Route Protection Architecture

**Layout Route Pattern (Recommended)**

- Protect entire route subtrees with parent layout routes
- Centralized authentication logic
- Automatic protection for all child routes
- Clean separation of authenticated vs public routes

**Component-Level Protection**

- Conditional rendering within components
- More granular control over UI states
- Good for mixed public/private content on same route
- Requires careful handling to prevent layout shifts

**Data/API Protection (Security Boundary)**

- Authorize every server function, server route, or API endpoint that reads or writes private data
- Reject unauthorized requests even if no protected route was loaded first
- Treat route guards as UX and navigation control, not as the data boundary

### State Management Patterns

**Server-Driven State (Recommended)**

- Authentication state sourced from server on each request
- Always up-to-date with server state
- Works seamlessly with SSR
- Best security - server is source of truth

**Context-Based State**

- Client-side authentication state management
- Good for third-party auth providers (Auth0, Firebase)
- Requires careful synchronization with server state
- Consider for highly interactive client-first applications

**Hybrid Approach**

- Initial state from server, client-side updates
- Balance between security and UX
- Periodic server-side validation

## Authentication Options

### 🏢 Partner Solutions

- **[WorkOS](https://workos.com)**
- **[Clerk](https://clerk.dev)**

### 🛠️ DIY Authentication

Build your own authentication system using TanStack Start's server functions and session management. Start with the [Authentication Server Primitives](./authentication-server-primitives.md) guide — it covers session cookies (`HttpOnly`/`Secure`/`SameSite`/`__Host-`), session lookup as middleware, OAuth `state` + PKCE, password-reset enumeration defense, CSRF, rate limiting, and session rotation, with the WRONG/CORRECT patterns that catch the common mistakes.

- **Full Control**: Complete customization over authentication flow
- **Server Primitives**: Sessions, OAuth, CSRF, rate limiting — see [Authentication Server Primitives](./authentication-server-primitives.md)
- **Session Management**: HTTP-only cookies via `setResponseHeader`, read with `getRequestHeader`
- **Type Safety**: End-to-end type safety for authentication state

### 🌐 Other Excellent Options

**Open Source & Community Solutions:**

- **[Better Auth](https://www.better-auth.com/)** - Modern, TypeScript-first authentication library
- **[Auth.js](https://authjs.dev/)** (formerly NextAuth.js) - Popular authentication library for React

**Hosted Services:**

- **[Supabase Auth](https://supabase.com/auth)** - Open source Firebase alternative with built-in auth
- **[Auth0](https://auth0.com/)** - Established authentication platform with extensive features
- **[Firebase Auth](https://firebase.google.com/docs/auth)** - Google's authentication service

## Partner Solutions

### WorkOS - Enterprise Authentication

<a href="https://workos.com/" alt="WorkOS Logo">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/tanstack/tanstack.com/main/src/images/workos-white.svg" width="280">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/tanstack/tanstack.com/main/src/images/workos-black.svg" width="280">
    <img alt="WorkOS logo" src="https://raw.githubusercontent.com/tanstack/tanstack.com/main/src/images/workos-black.svg" width="280">
  </picture>
</a>

- **Single Sign-On (SSO)** - SAML, OIDC, and OAuth integrations
- **Directory Sync** - SCIM provisioning with Active Directory and Google Workspace
- **Multi-factor Authentication** - Enterprise-grade security options
- **Compliance Ready** - SOC 2, GDPR, and CCPA compliant

[Visit WorkOS →](https://workos.com/) | [View example →](https://github.com/TanStack/router/tree/main/examples/react/start-workos)

### Clerk - Complete Authentication Platform

<a href="https://go.clerk.com/wOwHtuJ" alt="Clerk Logo">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/tanstack/tanstack.com/main/src/images/clerk-logo-dark.svg" width="280">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/tanstack/tanstack.com/main/src/images/clerk-logo-light.svg" width="280">
    <img alt="Clerk logo" src="https://raw.githubusercontent.com/tanstack/tanstack.com/main/src/images/clerk-logo-light.svg" width="280">
  </picture>
</a>

- **Ready-to-use UI Components** - Sign-in, sign-up, user profile, and organization management
- **Social Logins** - Google, GitHub, Discord, and 20+ providers
- **Multi-factor Authentication** - SMS, TOTP, and backup codes
- **Organizations & Teams** - Built-in support for team-based applications

[Visit Clerk →](https://go.clerk.com/wOwHtuJ) | [Sign up free →](https://go.clerk.com/PrSDXti) | [View example →](https://github.com/TanStack/router/tree/main/examples/react/start-clerk-basic)

## Examples

**Partner Solutions:**

- [Clerk Integration](https://github.com/TanStack/router/tree/main/examples/react/start-clerk-basic)
- [WorkOS Integration](https://github.com/TanStack/router/tree/main/examples/react/start-workos)

**DIY Implementations:**

- [Basic Auth with Prisma](https://github.com/TanStack/router/tree/main/examples/react/start-basic-auth)
- [Supabase Auth](https://github.com/TanStack/router/tree/main/examples/react/start-supabase-basic)

**Client-Side Examples:**

- [Basic Authentication](https://github.com/TanStack/router/tree/main/examples/react/authenticated-routes)
- [Firebase Auth](https://github.com/TanStack/router/tree/main/examples/react/authenticated-routes-firebase)

## Architecture Decision Guide

### Choosing an Authentication Approach

**Partner Solutions:**

- Focus on your core business logic
- Enterprise features (SSO, compliance)
- Managed security and updates
- Pre-built UI components

**OSS Solutions:**

- Community-driven development
- Specific customizations
- Self-hosted solutions
- Avoid vendor lock-in

**DIY Implementation:**

- Complete control over the auth flow
- Custom security requirements
- Specific business logic needs
- Full ownership of authentication data

### Production Auth Checklist

- Use HTTPS in production and set a strong session secret.
- Store sessions in `HttpOnly`, `Secure`, `SameSite` cookies. Do not store session tokens in `localStorage` or `sessionStorage`.
- Enforce auth in every server function, server route, or API endpoint that reads or writes private user, tenant, or account data. Use `beforeLoad` for page UX, not as the data boundary.
- Use `.validator()` on every server function that accepts input.
- Hash passwords with bcrypt, scrypt, or Argon2. For missing users, verify against a dummy hash and return the same login/reset message.
- Rate limit login, registration, and password-reset endpoints.
- Use CSRF or same-origin protections for non-GET server functions and server routes.
- Log authentication events and monitor failures.
- Test direct unauthenticated calls to protected server functions; they should reject before returning data.

## Next Steps

- **Partner solutions** → [Clerk](https://go.clerk.com/wOwHtuJ) or [WorkOS](https://workos.com/)
- **DIY implementation** → [Authentication Guide](./authentication.md)
- **Examples** → [Working implementations](https://github.com/TanStack/router/tree/main/examples/react)

## Resources

**Implementation Guides:**

- [Authentication Server Primitives](./authentication-server-primitives.md) — sessions, cookies, OAuth, CSRF, rate limiting (the server half)
- [Authentication Patterns](./authentication.md)
- [Router Authentication Guide](/router/latest/docs/framework/react/guide/authenticated-routes)

**Foundation Concepts:**

- [Execution Model](./execution-model.md)
- [Server Functions](./server-functions.md)

**Step-by-Step Tutorials:**

- [Router How-to Guides](/router/latest/docs/framework/react/how-to/README.md#authentication)
