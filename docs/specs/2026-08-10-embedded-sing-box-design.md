---
title: embedded sing-box encrypted proxy support
date: 2026-08-10
status: draft
---

# Embedded sing-box Encrypted Proxy Support — Design

## Problem

new-api's global proxy currently relies on the existing HTTP/SOCKS transport path and an external sing-box container for encrypted outbound protocols. That requires Docker socket and lifecycle integration, does not work reliably on deployments that cannot expose another container port, and makes configuration reload depend on an external process. Issue #55 replaces that path with an in-process sing-box outbound dialer while preserving the existing proxy configuration UI, option key, endpoint shapes, and proxy precedence.

## Goals

- Add `github.com/sagernet/sing-box` to the root Go module without changing the independently buildable `relaykit` module.
- Register the baseline outbound protocols needed for HTTP, SOCKS, Shadowsocks, VMess, VLESS, Trojan, SSH, ShadowTLS, AnyTLS, and WireGuard.
- Build a minimal sing-box instance containing one outbound, a route whose final outbound is that outbound, and the minimum DNS configuration required by sing-box; do not create an inbound.
- Route supported encrypted global-proxy schemes through an in-process `SingBoxDialer` assigned to `http.Transport.DialContext`, with `http.Transport.Proxy` unset.
- Lazily build and reuse one dialer per current persisted outbound configuration; on a configuration change, build the replacement before atomically publishing it, then close the old instance.
- Keep the old dialer when replacement construction fails, and return a safe error without interrupting existing traffic.
- Validate sing-box outbound semantics when the admin saves the existing proxy configuration.
- Preserve `BypassProxy → channel proxy → global proxy → direct` precedence and all existing proxy configuration, generation, download, copy, status, reload, and route behavior.
- Verify tagged root builds/tests and the independent `relaykit` build before each parent PR is reviewed.

## Non-goals

- No proxy-node persistence, sharing-link parsing, health tracking, node management API, frontend Tab, or batch operations; those belong to Issue #58 and its dependent Issues #59–#63.
- No frontend changes or route changes.
- No mixed or TUN inbound.
- No `with_quic` or `with_tor` build tags; Hysteria2/TUIC support requiring qpack pinning is deferred to a separate design.
- No change to the `proxy_config` Option key, its stored shape, or `getGlobalProxyURL()` semantics.
- No change to channel-level proxy parsing or priority logic.
- No vendored sing-box copy or `replace` directive.

## Constraints

- Follow the repository's Go 1.22+, Gin, GORM, JSON-wrapper, and security conventions in `AGENTS.md`.
- The root build uses `CGO_ENABLED=0` and the baseline tags `with_gvisor,with_wireguard,with_utls`; Dockerfile and CI must use the same tags.
- `newProxyBoxContext` and protocol registration must use sing-box's public registration APIs for the selected version (`v1.12.x`, locked to the version accepted by the repository build); no fork-specific imports.
- Box lifecycle is shared by concurrent HTTP requests. Publication must not expose a partially started Box, and closing must occur only after the replacement is published.
- No proxy URL, credential, or outbound secret may be logged or returned by the save/status APIs.
- Existing non-encrypted proxy schemes continue through their current implementation; supported encrypted schemes must never use `http.Transport.Proxy`.
- Work is delivered as two stacked PRs: #56 (`feat/singbox-embed-registry`) based on `main`, then #57 (`feat/singbox-embed-dialer`) based on #56. Each PR gets its own `.wt/` worktree and remains unmerged until user review.

## Approach

Issue #55 is split into two narrowly scoped, dependent PRs.

### PR #56: dependency and registry

Add the direct sing-box module requirement to the root `go.mod` and update `go.sum` through the Go toolchain. Add a registry adapter in `service/singbox_registry.go` that creates the sing-box context and registers the baseline outbound and DNS transport types. Optional registration is isolated behind build-tag pairs: the WireGuard implementation and `!with_wireguard` stub, plus the uTLS/Reality-related implementation and `!with_utls` stub. The untagged registry calls the optional hooks so the caller does not have build-tag conditionals. Dockerfile and CI build commands receive a single `SINGBOX_TAGS` value defaulting to `with_gvisor,with_wireguard,with_utls`. This PR defines only the registration boundary; it does not alter proxy URL validation or HTTP transport behavior.

### PR #57: dialer and reload

Add `SingBoxDialer` in `service/proxy_config.go`. Its constructor accepts the persisted outbound JSON, decodes it through `common.Unmarshal`, wraps it in the smallest valid sing-box configuration, creates the registered context, constructs and starts `box.Box`, and obtains the default outbound's `DialContext`. `DialContext` delegates to that outbound, and `Close` stops the Box exactly once. A synchronized global cache stores the current configuration fingerprint and dialer. The first encrypted global-proxy request loads the persisted Option lazily. Later requests reuse the dialer when the fingerprint is unchanged. A changed configuration is rebuilt outside the publication critical section; successful construction is published before the old dialer is closed. A failed rebuild leaves the old cache entry available and returns the construction error for the current request.

`configureProxyTransport` keeps its current switch for HTTP/HTTPS/SOCKS. It adds the sing-box scheme whitelist and obtains the cached dialer for encrypted schemes, assigning the dialer to `transport.DialContext` and clearing `transport.Proxy`. The save controller performs a build-and-close validation before persisting a new outbound. Existing reload behavior is retained for compatibility but no longer serves as the mechanism for encrypted outbound application. A process shutdown hook closes the cached dialer.

### Data flow

```text
admin save
  → validate existing request shape
  → BuildSingBoxDialer(outbound JSON), close validation Box
  → persist unchanged proxy_config Option

channel request
  → existing BypassProxy/channel-proxy precedence
  → global proxy URL scheme
  → encrypted scheme: load persisted outbound + fingerprint
  → build/reuse started SingBoxDialer
  → http.Transport.DialContext
  → sing-box default outbound
```

### Failure handling

- Malformed JSON, unsupported outbound type, missing required fields, or failed Box startup returns a normal API/transport error with sing-box's safe validation context; secrets are not included.
- A save validation failure prevents the Option update.
- A reload construction failure retains the last known-good dialer and logs only the error class/context permitted by existing logging conventions.
- `Close` is idempotent, and shutdown tolerates no configured dialer.

## Alternatives considered

### Keep the external sing-box container

Rejected. It preserves Docker socket, volume, port, and SIGHUP coupling and fails the deployment constraint that motivated Issue #55.

### Build a custom protocol dialer for each scheme

Rejected. It duplicates sing-box's protocol implementations, increases security and maintenance surface, and would not cover the required encrypted protocol set. The in-process sing-box library is the existing reference architecture.

### Rebuild a new Box for every request

Rejected. It avoids shared lifecycle state but allocates and starts protocol stacks per request, adds avoidable latency, and makes concurrent close/rebuild races more likely. A fingerprinted lazy cache is the minimum state needed for reuse and safe reload.

## Testing

PR #56 must demonstrate:

- `go build -tags "with_gvisor,with_wireguard,with_utls" ./...` succeeds.
- Tagged service tests pass, including direct registry construction and optional build-tag selection where the repository's sing-box API permits deterministic assertions.
- `cd relaykit && GOWORK=off go build ./...` succeeds with the relaykit module unchanged.
- Dockerfile and CI contain the same default tag list and no `with_quic`/`with_tor` baseline.

PR #57 must add deterministic tests for:

- valid minimal outbound construction and delegation shape;
- malformed JSON and invalid outbound configuration rejection;
- encrypted scheme routing to `DialContext` with `Transport.Proxy == nil`;
- lazy reuse for the same persisted configuration;
- successful replacement followed by old-dialer close;
- failed replacement preserving the old dialer;
- save validation rejecting invalid configuration while preserving the old Option value;
- existing bypass/channel/global precedence behavior remaining unchanged.

The required gates for PR #57 are:

```text
go build -tags "with_gvisor,with_wireguard,with_utls" ./...
go test -tags "with_gvisor,with_wireguard,with_utls" ./service/... ./controller/...
cd relaykit && GOWORK=off go build ./...
```

A manual smoke test uses the existing admin proxy configuration page: save a valid encrypted outbound, issue one channel request, change the outbound, issue another request without restarting, and verify through the existing proxy/test endpoint or controlled dialer fixture that the second request uses the replacement. The test also exercises the direct/bypass path to ensure it does not use the global dialer.

## Open questions

None. The user's approved decisions are: complete Issue #55 first; use strict stacked PRs; do not merge or close Issues; do not enable QUIC/Tor; preserve the existing configuration page and proxy precedence.
