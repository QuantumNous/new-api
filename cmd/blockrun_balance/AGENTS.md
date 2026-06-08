<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-06-08 | Updated: 2026-06-08 -->

# cmd/blockrun_balance

## Purpose

Standalone CLI that, given a raw secp256k1 private key (hex), derives the corresponding EVM address and queries two on-chain balances on the **Base L2 mainnet** (`https://mainnet.base.org`):

1. Native ETH balance via `eth_getBalance`
2. USDC balance (contract `0x833589fcd6edb6e08f4c7c32d4f71b54bda02913`) via `eth_call` → `balanceOf(address)`

Output is printed to stdout in human-readable form (raw integer units and decimal-formatted amounts). Errors go to stderr with a non-zero exit code.

## Key Files

| File | Description |
|---|---|
| `main.go` | Entire binary: argument parsing, key derivation, two JSON-RPC calls, decimal formatting |

## Subdirectories

None.

## For AI Agents

### Working In This Directory

- **Single file, no internal imports.** All logic is in `main.go`. The only non-stdlib dependency is `github.com/ethereum/go-ethereum/crypto` for `HexToECDSA` and `PubkeyToAddress`.
- **Do not add `common/json.go` imports here.** This binary intentionally avoids the main server module's internal packages. It uses `encoding/json` directly, which is correct for a self-contained tool.
- **JSON-RPC transport is hand-rolled** (`rpcReq` / `rpcResp` structs + `rpcCall` helper) to keep the binary dependency-free beyond go-ethereum/crypto.
- **Decimal formatting:** `formatUnits(n *big.Int, decimals int)` — trims trailing zeros and produces the human-readable string. ETH uses 18 decimals, USDC uses 6.
- **`balanceOf` ABI encoding:** the `data` field is assembled manually as `selector + zero-padded 32-byte address` — no ABI library is used.

### Build & Run

```bash
# Build from repo root
go build -o blockrun_balance ./cmd/blockrun_balance/

# Run (private key without 0x prefix, or with it — both accepted)
./blockrun_balance <64-hex-char-private-key>
```

Example output:
```
Derived EVM address: 0xAbCd...
Base ETH balance (wei): 12340000000000000
Base ETH balance (ETH): 0.01234
USDC (Base) balance (atomic, 6 decimals): 5000000
USDC (Base) balance (USDC): 5
```

### Testing Requirements

No automated tests. Validate by running against Base mainnet or a local fork (e.g., Anvil with `--fork-url https://mainnet.base.org`). The binary exits 2 on bad input and 1 on RPC errors, so CI can catch regressions by checking exit codes with known-invalid inputs.

### Common Patterns

- Usage errors: `fmt.Fprintln(os.Stderr, "usage: ...")` + `os.Exit(2)`
- Runtime errors: `fmt.Fprintf(os.Stderr, ...) ` + `os.Exit(1)`
- ETH balance error is non-fatal (prints to stderr, continues to USDC query); USDC error is fatal.

## Dependencies

### Internal

None.

### External

| Package | Purpose |
|---|---|
| `github.com/ethereum/go-ethereum/crypto` | `HexToECDSA` (parse private key), `PubkeyToAddress` (derive EVM address) |
| `encoding/json` | JSON-RPC request/response encoding (stdlib; `common/json.go` is NOT used here) |
| `math/big` | 256-bit integer arithmetic for on-chain balances |
| `net/http` | HTTP POST to Base JSON-RPC endpoint |

<!-- MANUAL: -->
