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
