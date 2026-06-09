<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-06-08 | Updated: 2026-06-08 -->

# cmd

## Purpose

Houses standalone auxiliary binary programs that are **not** part of the main HTTP server (`main.go`). Each subdirectory is its own `package main` and is built/run independently. These tools are operational utilities — for on-demand diagnostics, one-off blockchain queries, or maintenance scripts — rather than long-running services.

## Key Files

| File/Dir | Description |
|---|---|
| `blockrun_balance/` | CLI that derives an EVM address from a secp256k1 private key and queries its native ETH and USDC balances on the Base L2 chain (see `blockrun_balance/AGENTS.md`) |

## Subdirectories

| Directory | Description |
|---|---|
| `blockrun_balance/` | (see `blockrun_balance/AGENTS.md`) |

## For AI Agents

### Working In This Directory

- Each subdirectory under `cmd/` is fully self-contained: its own `package main`, its own imports, no shared internal packages from the main server unless explicitly imported.
- `cmd/blockrun_balance/main.go` uses `encoding/json` directly (not `common/json.go`) because it is a standalone binary with no dependency on the main application's `common` package. This is intentional and correct — do **not** replace with `common.Marshal`/`common.Unmarshal` unless the binary is refactored to import the main module.
- To build a binary: `go build ./cmd/blockrun_balance/` from the repo root.
- These binaries are **not** embedded in the Docker image that serves the API; they are developer/ops tooling built on demand.

### Testing Requirements

- No automated tests exist for `cmd/` binaries. Validation is by running the binary directly against a live or testnet RPC endpoint.

### Common Patterns

- Minimal dependencies: prefer stdlib + one focused external package per tool.
- Hard-fail on bad input (exit code 2 for usage errors, exit code 1 for runtime errors) using `fmt.Fprintln(os.Stderr, ...)` + `os.Exit(...)`.
- Print human-readable output to stdout; errors to stderr.

## Dependencies

### Internal

None — `cmd/` binaries intentionally do not import the main server's packages.

### External

| Package | Used by |
|---|---|
| `github.com/ethereum/go-ethereum/crypto` | `blockrun_balance` — secp256k1 key parsing and EVM address derivation |

<!-- MANUAL: -->
