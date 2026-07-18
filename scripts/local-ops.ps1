# Local Windows helpers for the authoritative new-api tree (D:\newapi\src).
# Does not touch the production new-api-fixed.exe process.

param(
    [ValidateSet('check', 'backend', 'test-router', 'inventory')]
    [string]$Action = 'check',
    [string]$OutputDirectory = ''
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

function Assert-RepoRoot {
    $prefix = (& git -C $repoRoot rev-parse --show-prefix).Trim()
    if ($prefix -ne '') {
        throw "Run from the authoritative repository root scripts: expected empty git prefix, got '$prefix'"
    }
    $leaf = Split-Path (& git -C $repoRoot rev-parse --show-toplevel).Trim() -Leaf
    if ($leaf -eq '_qn_tmp') {
        throw 'Refusing to operate on the upstream reference tree _qn_tmp'
    }
}

function Invoke-Check {
    Assert-RepoRoot
    Push-Location $repoRoot
    try {
        Write-Host 'gofmt (delivery seam files)...'
        $targets = @(
            'frontend_assets_embedded.go',
            'frontend_assets_external.go',
            'main.go',
            'router/main.go',
            'router/main_test.go',
            'router/web-router.go'
        )
        $dirty = @(gofmt -l @targets)
        if ($dirty.Count -gt 0) {
            throw "gofmt dirty: $($dirty -join ', ')"
        }
        Write-Host 'go test ./router...'
        go test ./router -count=1
        if ($LASTEXITCODE -ne 0) { throw "router tests failed: $LASTEXITCODE" }
        Write-Host 'go test -tags frontend_external .'
        go test -tags frontend_external . -count=1
        if ($LASTEXITCODE -ne 0) { throw "frontend_external tests failed: $LASTEXITCODE" }
        Write-Host 'go vet ./router .'
        go vet ./router .
        if ($LASTEXITCODE -ne 0) { throw "go vet failed: $LASTEXITCODE" }
        Write-Host 'local check OK'
    } finally {
        Pop-Location
    }
}

function Invoke-BackendBuild {
    Assert-RepoRoot
    Push-Location $repoRoot
    try {
        $out = Join-Path $repoRoot 'new-api-backend.exe'
        Write-Host "building pure backend -> $out"
        go build -trimpath -buildvcs=true -tags frontend_external `
            -ldflags "-s -w -X github.com/QuantumNous/new-api/common.Version=$((Get-Content VERSION -Raw).Trim())" `
            -o $out .
        if ($LASTEXITCODE -ne 0) { throw "backend build failed: $LASTEXITCODE" }
        $hash = (Get-FileHash -LiteralPath $out -Algorithm SHA256).Hash.ToLowerInvariant()
        Write-Host "backend=$out size=$((Get-Item $out).Length) sha256=$hash"
        Write-Host 'Run with FRONTEND_MODE=disabled (or redirect). Do not replace production new-api-fixed.exe unless explicitly promoted.'
    } finally {
        Pop-Location
    }
}

function Invoke-Inventory {
    Assert-RepoRoot
    $script = Join-Path $repoRoot 'scripts\build-release.ps1'
    if (-not (Test-Path -LiteralPath $script)) {
        throw "missing $script"
    }
    $outDir = $OutputDirectory
    if ([string]::IsNullOrWhiteSpace($outDir)) {
        $outDir = 'D:\newapi\release-manifests'
    }
    $existing = 'D:\newapi\new-api-fixed.exe'
    if (-not (Test-Path -LiteralPath $existing)) {
        throw "production binary missing: $existing"
    }
    Write-Host "inventory existing binary (AllowDirty diagnostic only) -> $outDir"
    & powershell -NoProfile -ExecutionPolicy Bypass -File $script `
        -ExistingBinary $existing `
        -OutputDirectory $outDir `
        -AllowDirty
    if ($LASTEXITCODE -ne 0) { throw "inventory failed: $LASTEXITCODE" }
}

switch ($Action) {
    'check' { Invoke-Check }
    'backend' { Invoke-BackendBuild }
    'test-router' {
        Assert-RepoRoot
        Push-Location $repoRoot
        try {
            go test ./router -count=1
            if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        } finally { Pop-Location }
    }
    'inventory' { Invoke-Inventory }
}
