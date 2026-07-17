# Security Risk Acceptance

## GO-2026-5932

- **Reviewed:** 2026-07-17
- **Review by:** 2026-10-17
- **Module:** `golang.org/x/crypto@v0.52.0`
- **Affected package:** `golang.org/x/crypto/openpgp`
- **Decision:** Temporarily accepted as unreachable.

`govulncheck -show verbose ./...` reports zero symbol-level and zero package-level vulnerabilities. The repository does not import `openpgp`; the advisory appears only because another safe `x/crypto` package keeps the module in the dependency graph. The advisory has no fixed version.

Revoke this acceptance immediately if `openpgp` becomes reachable, a transitive dependency starts importing it, or a maintained replacement/fixed release becomes available. CI continues to run `govulncheck` on every pull request so either change becomes visible.
