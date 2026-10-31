# Secure URL handling

When a provider fetches a URL with `getFromApi`, always set the `validateUrl`
flag explicitly so every call site makes a visible trust decision. The option
is optional in the type only for backwards compatibility with external callers
of `@ai-sdk/provider-utils`; omitting it behaves like `false` (no validation),
so provider code in this repository must never leave it out. The
`ai-sdk/require-validate-url` oxlint rule (`tools/oxlint-plugin-ai-sdk`)
enforces this in CI: `pnpm check` fails for any `getFromApi` call without an
explicit `validateUrl`.

## Deciding `true` vs `false`

The test: **does the URL's host (or scheme) come from the provider's response
body?**

- **`validateUrl: true`** — the host comes from response-body data (a download
  URL like `json.audio.url` / `image.url`, or a polling URL like
  `finalPrediction.urls.get`). It is attacker-influenceable, so it is routed
  through `fetchWithValidatedRedirects`, which rejects private/loopback/link-local
  targets and re-validates every redirect hop. Blocked URLs throw
  `DownloadError`.
- **`validateUrl: false`** — the URL is built from a developer-configured
  endpoint (`${config.baseURL}/…`, `config.url({ path })`, `${baseUrl.origin}/…`)
  with at most a path segment or id interpolated. The host is fixed by config, so
  there is nothing to validate, and validating it would break legitimate
  self-hosted / localhost base URLs. (Path-only injection is not SSRF — the host
  cannot be changed.)

> If the host, or anything beyond a path segment, comes from a response body →
> `validateUrl: true`.

## Self-hosted deployments: `trustedOrigin`

A response URL often points back at the developer-configured endpoint itself
(a polling URL on the API host, a download URL on a self-hosted server). When
that endpoint is private — a localhost Replicate-compatible cog server, an
internal fal deployment — `validateUrl: true` would reject exactly the host the
developer configured. Pass `trustedOrigin` with the configured base URL so
hops that are same-origin with it skip target validation; every other hop is
still validated:

```ts
await getFromApi({
  url: pollUrl, // from the response body
  validateUrl: true,
  trustedOrigin: this.config.baseURL,
  // …
});
```

This is safe because a URL same-origin with the configured endpoint is exactly
what a config-derived `validateUrl: false` request would fetch anyway.
`trustedOrigin` must always be a developer-configured value — never derive it
from response data.

## Credentials

When an untrusted URL may legitimately carry the API key on its first hop (e.g.
a same-host polling URL), pass `credentialedOrigin` so headers are sent **only**
when the URL is same-origin with it:

```ts
await getFromApi({
  url: pollUrl, // from the response body
  validateUrl: true,
  credentialedOrigin: this.config.baseURL,
  trustedOrigin: this.config.baseURL,
  headers: authHeaders,
  successfulResponseHandler,
  failedResponseHandler,
  fetch: this.config.fetch,
});
```

## Limitations and deployment hardening

The guard does string/literal checks only — it does not resolve DNS, so
hostnames that resolve to private addresses and DNS rebinding are out of scope
and cannot be closed inside the cross-runtime provider utilities. The user-facing
explanation, and how a server deployment closes those gaps (network egress
restriction, or injecting a Node `fetch` that pins the resolved IP at connect
time), lives in the public docs:
[Secure URL Fetching](../content/docs/06-advanced/11-secure-url-fetching.mdx).
