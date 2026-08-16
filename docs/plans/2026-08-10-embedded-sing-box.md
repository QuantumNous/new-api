# Embedded sing-box Encrypted Proxy Support Implementation Plan

> **For executing agents:** implement this plan task-by-task. Each step uses checkbox (`- [ ]`) syntax. Do not skip steps. Do not batch commits across tasks.

**Goal:** Deliver Issue #55 as two stacked PRs: register the root-module sing-box dependency and protocol set, then route encrypted global proxy traffic through a safely reloadable in-process dialer.

**Architecture:** PR #56 owns the root dependency, protocol registries, Docker build tags, and CI tags. PR #57 builds one outbound-only sing-box Box from the persisted `proxy_config` Option, caches it by a configuration fingerprint, and injects its default outbound dial function into the existing HTTP transport without changing proxy precedence. PR #57 is based on the #56 branch; each PR has its own `.wt/` worktree and remains unmerged for user review.

**Tech stack:** Go 1.25.1/1.26, sing-box v1.12.12, Gin, existing `common` JSON wrappers, `net/http`, GORM Option storage, Go build tags, GitHub Actions.

---

## Premortem

**Hidden assumptions:**
- sing-box v1.12.12 exposes the registry and Box lifecycle APIs used by the reference implementation — compile the registry before adding the dialer and run both tagged and untagged package tests.
- Existing `proxy_config` outbound JSON can be translated to a valid sing-box outbound without changing its persisted shape — reuse the existing controller generation mapping and test every currently supported outbound type.
- Cached HTTP clients may outlive a dialer replacement — publish a new started Box before closing the old Box and keep the old entry when replacement construction fails.

**Irreversible / risky steps:**
- Adding sing-box expands the root dependency graph and final binary — revert the PR commit to roll back; do not modify `modules/relaykit/go.mod`, `modules/relaykit/go.sum`, or vendor files.
- Changing encrypted transport behavior affects all channels — preserve HTTP/SOCKS paths and verify bypass/channel/global precedence before PR review.
- In-process Box instances own network resources — make close idempotent and run focused race tests.

**Spec-misalignment:**
- Issue #55 excludes proxy-node persistence and UI — keep #59–#63 out of both PRs and start them only after #57 review.
- The existing reload endpoint remains available — do not delete or change its response shape.
- Baseline tags exclude QUIC and Tor — use exactly `with_gvisor,with_wireguard,with_utls` in Docker and CI.

**Verify-clause weakness:**
- A root build alone cannot prove relaykit isolation or transport routing — require tagged root build/test, independent relaykit build, and transport/cache assertions.
- A non-nil constructor assertion misses a partially started Box — construct, start, dial a closed endpoint, and close twice in the focused test.

## File structure

New in PR #56:
- `service/singbox_registry.go` — context assembly and baseline outbound, endpoint, DNS transport, and service registries.
- `service/singbox_registry_wg.go` — WireGuard registration under `with_wireguard`.
- `service/singbox_registry_wg_stub.go` — no-op WireGuard hooks under `!with_wireguard`.
- `service/singbox_registry_utls.go` — uTLS/Reality build hook under `with_utls`.
- `service/singbox_registry_utls_stub.go` — no-op uTLS/Reality hook under `!with_utls`.
- `service/singbox_registry_test.go` — registry and minimal Box tests.

Modified in PR #56:
- `go.mod` — add direct `github.com/sagernet/sing-box v1.12.12`; do not change relaykit module files.
- `go.sum` — checksums for the new graph.
- `Dockerfile` — `SINGBOX_TAGS` argument and tagged build.
- `.github/workflows/ci.yml` — matching tags for root vet/build/test.

Modified in PR #57:
- `service/proxy_config.go` — `SingBoxDialer`, Box construction, fingerprinted cache, reload, and close.
- `service/http_client.go` — encrypted scheme branch in `configureProxyTransport`.
- `common/proxy_url.go` — explicit encrypted-scheme allowlist required by the global path.
- `controller/proxy.go` — save-time semantic validation only.
- `service/proxy_config_test.go` — constructor/cache/reload tests.
- `service/http_client_transport_test.go` — transport routing/precedence tests.
- `common/proxy_url_test.go` — scheme validation tests.
- `controller/proxy_test.go` — invalid save does not persist.

## PR #56

### Task 1: Add the root sing-box dependency → verify: module listing reports v1.12.12 and relaykit module files are byte-for-byte unchanged

**Files:** root `go.mod`, root `go.sum` only.

- [ ] Add `github.com/sagernet/sing-box v1.12.12` to the first direct `require` block; run `GOWORK=off go mod tidy` from the root. Do not add a `replace`, vendored tree, or `relaykit` dependency.
- [ ] Run:

```bash
git diff -- apps/api/go.mod apps/api/go.sum modules/relaykit/go.mod modules/relaykit/go.sum
go list -m github.com/sagernet/sing-box
```

Expected: only root module files differ; output contains `github.com/sagernet/sing-box v1.12.12`.
- [ ] Commit:

```bash
git add apps/api/go.mod apps/api/go.sum && git commit -m "build: add sing-box dependency"
```

### Task 2: Register baseline protocols → verify: minimal direct Box construction passes under default and baseline tags

**Files:** create `service/singbox_registry.go`, `service/singbox_registry_test.go`.

- [ ] Implement `newProxyBoxContext(context.Context) context.Context` with `box.Context(ctx, inbound.NewRegistry(), newOutboundRegistry(), newEndpointRegistry(), newDNSTransportRegistry(), boxservice.NewRegistry())`. Register baseline outbound types: direct, block, DNS, selector/urltest, SOCKS, HTTP, Shadowsocks, VMess, Trojan, SSH, ShadowTLS, VLESS, AnyTLS. Register TCP, UDP, TLS, HTTPS, hosts, and local DNS transports. Keep inbounds empty; no port is opened.
- [ ] Test the context with `box.New(box.Options{Context: newProxyBoxContext(context.Background()), Options: option.Options{Outbounds: []option.Outbound{{Type: C.TypeDirect, Tag: "direct"}}, Route: &option.RouteOptions{Final: "direct"}}})`; require no error, close it, and require no network listener.
- [ ] Run `gofmt -w service/singbox_registry.go service/singbox_registry_test.go` and `GOWORK=off go test ./service -run TestSingBoxRegistry -count=1`.
- [ ] Commit:

```bash
git add service/singbox_registry.go service/singbox_registry_test.go && git commit -m "feat: register embedded sing-box protocols"
```

### Task 3: Add optional registration hooks and build configuration → verify: Dockerfile and CI use identical baseline tags and tagged/untagged tests compile

**Files:** create the four optional registry files; modify `Dockerfile` and `.github/workflows/ci.yml`.

- [ ] Add `registerWireGuardOutbound(*outbound.Registry)` and `newEndpointRegistry()` in `singbox_registry_wg.go` under `//go:build with_wireguard`, using `wireguard.RegisterOutbound` and `wireguard.RegisterEndpoint`; add no-op equivalents in the `!with_wireguard` stub.
- [ ] Add `registerUTLS()` in `singbox_registry_utls.go` under `with_utls` and a no-op function in the `!with_utls` stub. uTLS/Reality is a sing-box TLS build capability, not a separate outbound registry; the hook exists only to make the selected build boundary explicit and must not import unavailable symbols. Call the hook from the neutral registry if needed, otherwise keep the hook referenced by a compile-time test so it is not dead code.
- [ ] In `Dockerfile`, add `ARG SINGBOX_TAGS="with_gvisor,with_wireguard,with_utls"` before the Go build and change the root command to `go build -tags "${SINGBOX_TAGS}" ...`.
- [ ] In `.github/workflows/ci.yml`, define the same environment value and pass `-tags "with_gvisor,with_wireguard,with_utls"` to root vet/build/test commands. Leave relaykit commands untagged and independent.
- [ ] Run:

```bash
gofmt -w service/singbox_registry*.go
GOWORK=off go test ./service -run TestSingBoxRegistry -count=1
GOWORK=off go test -tags "with_gvisor,with_wireguard,with_utls" ./service -run TestSingBoxRegistry -count=1
git diff --check
```

Expected: all focused commands pass; no `with_quic` or `with_tor` appears in the new baseline build commands.
- [ ] Commit:

```bash
git add service/singbox_registry*.go Dockerfile .github/workflows/ci.yml && git commit -m "build: configure sing-box protocol tags"
```

### Task 4: Verify PR #56 and prepare the dependent branch → verify: all PR #56 gates pass and `.wt/issue-57-singbox-dialer` is based on the PR #56 branch

**Files:** no source changes unless a preceding task exposed a compile error.

- [ ] Run the complete PR #56 gates:

```bash
GOWORK=off go build -tags "with_gvisor,with_wireguard,with_utls" ./...
GOWORK=off go test -tags "with_gvisor,with_wireguard,with_utls" ./service/...
(cd relaykit && GOWORK=off go build ./...)
git diff --check
```

- [ ] Run codegraph update/detect-changes from the PR #56 worktree and record the changed symbols and impact; do not edit generated graph files into the
 repository.
- [ ] Create the next worktree from the PR #56 branch:

```bash
git worktree add -b feat/singbox-embed-dialer .wt/issue-57-singbox-dialer feat/singbox-embed-registry
```

- [ ] Commit no source changes in this task; the branch pointer itself is the handoff to PR #57.

## PR #57

### Task 5: Build and close a minimal SingBoxDialer → verify: valid direct and encrypted outbound JSON constructs a started Box, delegates DialContext, and closes idempotently

**Files:** create/modify `service/proxy_config.go`, create `service/proxy_config_test.go`.

- [ ] Define `type SingBoxDialer struct` holding the Box, the default outbound tag, a cancel function, and `sync.Once` for close. Expose `BuildSingBoxDialer(config json.RawMessage) (*SingBoxDialer, error)`, `DialContext(context.Context, string, string) (net.Conn, error)`, and `Close() error`.
- [ ] Decode the supplied outbound JSON through `common.Unmarshal`; accept the existing persisted `ProxyConfig` shape by reading `cfg.Outbound`, then map it to a single `option.Outbound` with tag `proxy` using the same type-specific field mapping already used in `controller.GenerateProxyConfig`. Use `option.Options{Log: &option.LogOptions{Disabled: true}, Outbounds: []option.Outbound{outbound}, Route: &option.RouteOptions{Final: "proxy"}}` and `newProxyBoxContext`.
- [ ] Start the Box before returning. `DialContext` must parse `address` with `github.com/sagernet/sing/common/metadata.ParseSocksaddr`, look up the tagged outbound via `d.box.Outbound().Outbound("proxy")`, and delegate `out.DialContext(ctx, network, destination)`. Return an initialization error when the receiver or outbound is absent.
- [ ] `Close` calls Box.Close and context cancellation once; a second call returns nil or the Box's already-closed result without panicking.
- [ ] Tests use `require` for setup/fatal assertions and `assert` for values. Cover malformed JSON, unsupported type, a valid SOCKS5 outbound that starts against a closed endpoint, delegation error, and two close calls.
- [ ] Run:

```bash
gofmt -w service/proxy_config.go service/proxy_config_test.go
GOWORK=off go test -tags "with_gvisor,with_wireguard,with_utls" ./service -run 'TestBuildSingBoxDialer|TestSingBoxDialer' -count=1
```

- [ ] Commit:

```bash
git add service/proxy_config.go service/proxy_config_test.go && git commit -m "feat: add embedded sing-box dialer"
```

### Task 6: Add fingerprinted lazy reload → verify: unchanged configuration reuses one dialer, valid changes replace then close the old dialer, and invalid changes preserve the old one

**Files:** modify `service/proxy_config.go`; extend `service/proxy_config_test.go`.

- [ ] Add a process-local cache guarded by a mutex with the current raw configuration fingerprint and `*SingBoxDialer`; do not use an unsafe atomic pointer for an object whose close lifecycle is coupled to HTTP client construction.
- [ ] Read the existing `proxy_config` Option directly from `model.DB`, return no dialer when missing/disabled/empty global URL, and construct a new dialer only when the stored outbound JSON fingerprint differs.
- [ ] Build the replacement while holding no read lock, then lock and compare the fingerprint again. If another request installed a newer value, close the redundant new dialer and reuse the installed one. Otherwise install the new dialer, unlock, and close the old dialer.
- [ ] On build failure, keep the previous entry and return the error; never clear a known-good dialer. Add a test that changes a valid config to malformed JSON and verifies the old cache remains usable.
- [ ] Add `CloseGlobalSingBoxDialer()` and register it with the existing process shutdown mechanism if one exists; otherwise call it from `ResetProxyClientCache` and test cleanup without altering unrelated shutdown behavior.
- [ ] Run the focused tests with `-race`:

```bash
GOWORK=off go test -race -tags "with_gvisor,with_wireguard,with_utls" ./service -run 'TestGlobalSingBoxDialer' -count=1
```

- [ ] Commit:

```bash
git add service/proxy_config.go service/proxy_config_test.go && git commit -m "feat: reload embedded sing-box dialer safely"
```

### Task 7: Route encrypted schemes through DialContext → verify: encrypted schemes select `transport.DialContext`, set `transport.Proxy` nil, and existing HTTP/SOCKS behavior is unchanged

**Files:** modify `service/http_client.go`, `common/proxy_url.go`; extend `service/http_client_transport_test.go`; create/extend `common/proxy_url_test.go`.

- [ ] Add an explicit encrypted scheme list matching the supported sharing schemes required by Issue #55: `vless`, `vmess`, `trojan`, `ss`, `shadowsocks`, `wireguard`, `anytls`, and `ssh`. In `configureProxyTransport`, add a branch that obtains the current global dialer, assigns `transport.DialContext = dialer.DialContext`, sets `transport.Proxy = nil`, and returns construction errors. Keep HTTP/HTTPS and SOCKS branches byte-for-byte behaviorally equivalent.
- [ ] Extend `common.ParseProxyURLStrict`/`Runtime` only for the global encrypted schemes required by this issue. Preserve host/port checks and reject unsupported schemes; do not turn the parser into a permissive blacklist. If channel-level proxy semantics must remain HTTP/SOCKS-only, separate the global validation path instead of weakening channel validation.
- [ ] Test `configureProxyTransport` with a test dialer seam or a valid local SOCKS outbound fixture; assert encrypted scheme leaves `Proxy == nil` and non-nil `DialContext`, HTTP retains `ProxyURL`, and SOCKS retains context dial behavior. Test bypass still yields a direct client and channel proxy still wins over global proxy.
- [ ] Run:

```bash
gofmt -w service/http_client.go common/proxy_url.go service/http_client_transport_test.go common/proxy_url_test.go
GOWORK=off go test -tags "with_gvisor,with_wireguard,with_utls" ./service ./common -run 'Test.*Proxy|Test.*SingBox' -count=1
```

- [ ] Commit:

```bash
git add service/http_client.go common/proxy_url.go service/http_client_transport_test.go common/proxy_url_test.go && git commit -m "feat: route encrypted proxies through sing-box"
```

### Task 8: Validate sing-box semantics on save → verify: invalid outbound save returns an error and leaves the existing Option unchanged; valid save preserves the response shape

**Files:** modify `controller/proxy.go`; extend/create `controller/proxy_test.go`.

- [ ] Before `model.UpdateOption`, marshal the request with `common.Marshal`, call `service.BuildSingBoxDialer(json.RawMessage(jsonBytes))` only when the proxy is enabled and the outbound/global URL requires sing-box validation, close the temporary dialer, and return the existing API error path on failure. Do not log or return credentials from the error.
- [ ] Keep the existing request struct, `GetProxyConfig`, generator, status, reload handlers, and JSON wrapper usage unchanged. Import `encoding/json` only for `json.RawMessage` type if needed; all marshal/unmarshal operations remain through `common.*`.
- [ ] Test invalid outbound save against an initialized test DB and assert the old Option value remains; test a disabled/empty configuration retains existing behavior and does not require a Box.
- [ ] Run:

```bash
gofmt -w controller/proxy.go controller/proxy_test.go
GOWORK=off go test -tags "with_gvisor,with_wireguard,with_utls" ./controller -run 'Test.*ProxyConfig' -count=1
```

- [ ] Commit:

```bash
git add controller/proxy.go controller/proxy_test.go && git commit -m "feat: validate sing-box proxy config on save"
```

### Task 9: Verify PR #57 and run review gates → verify: all Issue #55 tests/builds pass, CRG reports no unreviewed changed symbols, and both PR branches have review records without merges

**Files:** no source changes unless review identifies a concrete defect; review records may be stored under existing repository review-artifact conventions.

- [ ] Run the full gates:

```bash
GOWORK=off go build -tags "with_gvisor,with_wireguard,with_utls" ./...
GOWORK=off go test -tags "with_gvisor,with_wireguard,with_utls" ./service/... ./controller/... ./common/...
(cd relaykit && GOWORK=off go build ./...)
git diff --check
```

- [ ] Run `codegraph update --brief` and `codegraph detect-changes` from each PR worktree; inspect changed symbols and callers for `configureProxyTransport`, `getGlobalProxyURL`, `UpdateProxyConfig`, and `BuildSingBoxDialer`.
- [ ] Run the CRG review device on the final diff, then perform two review passes: spec compliance and code quality/security. Fix every P0/P1 finding and re-run the affected gates; no review result may be accepted without current evidence.
- [ ] Verify neither branch merges or closes an Issue. Keep both PRs pending user review; do not push or create PRs until the user explicitly authorizes outward-facing GitHub actions.

## Handoff to Issue #58

After #57's implementation and review gates pass, create the independent Issue #58 chain in new `.wt/` worktrees: #59 data layer → #60 probing → #61 APIs → #62 frontend Tab → #63 batch operations. Each child plan must be written from the approved Issue #58 design and must not be started in the Issue #55 worktrees.