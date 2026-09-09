---
name: new-api-user
description: Locate the current new-api source for a user's requested self-service action, derive its API contract, and carry it out with the supplied access token.
---

# new-api user source navigation

Start from the user's request. Use this guide to find the implementation in the official [QuantumNous/new-api repository](https://github.com/QuantumNous/new-api), then derive the operation from that code.

## Common capability entrypoints

Start with the matching row, then trace its current route and handler using the steps below. These are source locations to inspect; obtain the current request and response from the linked implementation.

| Capability | Find the client call | Confirm the implementation |
| --- | --- | --- |
| Account and preferences | [profile/api.ts](https://raw.githubusercontent.com/QuantumNous/new-api/main/web/src/features/profile/api.ts) and its callers | [controller/user.go](https://raw.githubusercontent.com/QuantumNous/new-api/main/controller/user.go) |
| Personal model API keys | [keys/api.ts](https://raw.githubusercontent.com/QuantumNous/new-api/main/web/src/features/keys/api.ts) and the imported form types | [controller/token.go](https://raw.githubusercontent.com/QuantumNous/new-api/main/controller/token.go) |
| Displayed model prices | [pricing/api.ts](https://raw.githubusercontent.com/QuantumNous/new-api/main/web/src/features/pricing/api.ts) | [controller/pricing.go](https://raw.githubusercontent.com/QuantumNous/new-api/main/controller/pricing.go), then the referenced model pricing implementation |
| Wallet and billing history | [wallet/api.ts](https://raw.githubusercontent.com/QuantumNous/new-api/main/web/src/features/wallet/api.ts) | Follow the matched route into [controller/topup.go](https://raw.githubusercontent.com/QuantumNous/new-api/main/controller/topup.go), [controller/user.go](https://raw.githubusercontent.com/QuantumNous/new-api/main/controller/user.go), or the provider handler it names |
| Personal subscriptions | [subscriptions/api.ts](https://raw.githubusercontent.com/QuantumNous/new-api/main/web/src/features/subscriptions/api.ts), selecting its self-service calls | [controller/subscription.go](https://raw.githubusercontent.com/QuantumNous/new-api/main/controller/subscription.go) |
| Usage and audit records | [usage-logs/api.ts](https://raw.githubusercontent.com/QuantumNous/new-api/main/web/src/features/usage-logs/api.ts) or [audit/api.ts](https://raw.githubusercontent.com/QuantumNous/new-api/main/web/src/features/usage-logs/audit/api.ts), selecting the current-user scope | [controller/log.go](https://raw.githubusercontent.com/QuantumNous/new-api/main/controller/log.go) or `GetAuditLogs` in [controller/access_token.go](https://raw.githubusercontent.com/QuantumNous/new-api/main/controller/access_token.go) |

## Find the relevant implementation

1. **Locate the feature.** Open [web/src/features](https://github.com/QuantumNous/new-api/tree/main/web/src/features) and select the directory matching the user's object or UI terminology. Read its API call and the page, hook or form that calls it. Continue once you have the request path and the code constructing its inputs.
2. **Trace the route.** Find that path in [router/api-router.go](https://raw.githubusercontent.com/QuantumNous/new-api/main/router/api-router.go), following registrations in [router/](https://github.com/QuantumNous/new-api/tree/main/router) when needed. Combine parent groups with the route's local path and follow the attached middleware. Continue once the full route, handler and ownership checks are identified.
3. **Read the contract.** Open the handler in [controller/](https://github.com/QuantumNous/new-api/tree/main/controller). Follow its input types, validators, called service/model functions and response helpers only as needed. Determine the method, URL, required headers, accepted inputs, defaults, units, update semantics and actual success/error response. Frontend calls help locate the flow; the backend implementation decides what it accepts and returns.
4. **Perform the request.** Resolve the current-account identity and authentication flow from [middleware/auth.go](https://raw.githubusercontent.com/QuantumNous/new-api/main/middleware/auth.go) and the corresponding handlers. Use the supplied instance URL and token within that account's actual permissions. Execute the user's requested action, interpret the response using the code just read, and verify any changed state before reporting the result.

When a route introduces additional authorization or verification, follow its middleware and controller checks before calling it. A browser-only requirement needs the user's browser flow.

## Source-reading shortcuts

- Fetch any known file as plain text with `https://raw.githubusercontent.com/QuantumNous/new-api/main/<path>`.
- If a feature is unclear or a path has moved, use the [repository tree](https://api.github.com/repos/QuantumNous/new-api/git/trees/main?recursive=1) to find filenames, then search the relevant files for the object, request-path fragment or symbol already found. With a checkout, use `rg -n '<symbol-or-path-fragment>' web/src/features router controller`.
- If a client call leaves request headers or response handling unclear, follow its imports into [web/src/lib/http-client.ts](https://raw.githubusercontent.com/QuantumNous/new-api/main/web/src/lib/http-client.ts).
- When the handler delegates pagination or response formatting, read `GetPageQuery` in [common/page_info.go](https://raw.githubusercontent.com/QuantumNous/new-api/main/common/page_info.go) or the referenced `ApiSuccess`/`ApiError` helper in [common/gin.go](https://raw.githubusercontent.com/QuantumNous/new-api/main/common/gin.go).
- Use a matching deployment tag or commit when known; otherwise start from `main`. Keep reads on the same revision. If the live instance contradicts the source, resolve the version or missing contract before retrying a write.

Fetch GitHub source without the instance access token. Send that token only to the supplied instance; keep it out of repository files and reported output. If a write's outcome is uncertain, read the current state before retrying.

For an administrator's request beyond their own account, continue with [new-api-admin](../new-api-admin/SKILL.md) after verifying the relevant authority.
