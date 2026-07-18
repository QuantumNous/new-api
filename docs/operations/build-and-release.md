# Build and release boundary

## Authoritative source

Build and release the customized application only from the Git repository at `D:\newapi\src`.
The sibling `D:\newapi\_qn_tmp` directory is an upstream reference clone. It is not a release source
and must not be mixed into the build context.

## Version rules

- `VERSION` is a non-empty development fallback.
- Tagged release workflows use `git describe --tags` and inject the resolved value into
  `github.com/QuantumNous/new-api/common.Version`.
- Go VCS metadata must remain enabled so `go version -m <binary>` records the source revision and
  whether the source tree was modified.
- Go and Bun versions are pinned in quality and release workflows.

## Delivery artifacts

| Artifact | How to build | Frontend assets |
|---|---|---|
| Integrated binary / `Dockerfile` | Default `go build` after building both web themes | Embedded dual theme |
| Pure backend / `Dockerfile.backend` | `go build -tags frontend_external` | None; set `FRONTEND_MODE=disabled` or `redirect` |
| Frontend SPA / `deploy/separated/Dockerfile.frontend` | Bun build of `web/default` + Nginx | Static only; proxies API to backend |

Quality CI exercises all three image paths plus `nginx -t` on the rendered frontend config.
The integrated image remains the default compatibility path.

Local pure-backend example:

```powershell
go build -trimpath -buildvcs=true -tags frontend_external -o new-api-backend.exe .
$env:FRONTEND_MODE = 'disabled'
.\new-api-backend.exe
```

Separated compose example (from repo root):

```bash
docker compose -f deploy/separated/docker-compose.yml build
```

## Windows release evidence

From `D:\newapi\src`, build a release and generate its evidence files:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-release.ps1
```

To inventory an existing binary without rebuilding it:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-release.ps1 `
  -ExistingBinary D:\newapi\new-api-fixed.exe `
  -OutputDirectory D:\newapi\release-manifests `
  -AllowDirty
```

The script writes a SHA-256 file, Go build/dependency inventory, and JSON manifest. It verifies the
embedded VCS revision against the current authoritative repository HEAD. The Go inventory is useful
traceability evidence but is not a standardized SBOM; release signing and a pinned SBOM generator
remain separate release requirements.

Official builds require a clean working tree. `-AllowDirty` exists only for diagnostics and current
binary inventory.
