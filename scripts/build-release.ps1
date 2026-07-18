[CmdletBinding()]
param(
  [string]$ExistingBinary = "",
  [string]$OutputDirectory = "artifacts",
  [switch]$SkipWebBuild,
  [switch]$AllowDirty
)

$ErrorActionPreference = "Stop"

function Assert-ExitCode([string]$Step) {
  if ($LASTEXITCODE -ne 0) {
    throw "$Step failed with exit code $LASTEXITCODE"
  }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path.TrimEnd("\")
$gitRoot = (& git -C $repoRoot rev-parse --show-toplevel).Trim().Replace("/", "\").TrimEnd("\")
Assert-ExitCode "git root detection"
if (-not [string]::Equals($repoRoot, $gitRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Build root mismatch: expected $repoRoot, got $gitRoot"
}
if ((Split-Path $repoRoot -Leaf) -eq "_qn_tmp") {
  throw "Refusing to build from the upstream reference tree"
}

$versionFile = Join-Path $repoRoot "VERSION"
$versionFallback = (Get-Content -LiteralPath $versionFile -Raw).Trim()
if ([string]::IsNullOrWhiteSpace($versionFallback)) {
  throw "VERSION must not be empty"
}

$head = (& git -C $repoRoot rev-parse HEAD).Trim()
Assert-ExitCode "git revision detection"
$branch = (& git -C $repoRoot branch --show-current).Trim()
Assert-ExitCode "git branch detection"
$describe = (& git -C $repoRoot describe --tags --always --dirty).Trim()
Assert-ExitCode "git version detection"
$statusLines = @(& git -C $repoRoot status --porcelain)
Assert-ExitCode "git status detection"
$isDirty = $statusLines.Count -gt 0
if ($isDirty -and -not $AllowDirty) {
  throw "Release builds require a clean working tree. Use -AllowDirty only for diagnostics."
}

if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
  throw "OutputDirectory must not be empty"
}
if (-not [System.IO.Path]::IsPathRooted($OutputDirectory)) {
  $OutputDirectory = Join-Path $repoRoot $OutputDirectory
}
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$OutputDirectory = (Resolve-Path $OutputDirectory).Path

$version = if ([string]::IsNullOrWhiteSpace($describe)) { $versionFallback } else { $describe }
$buildCommand = "existing-binary"
$isExistingBinary = -not [string]::IsNullOrWhiteSpace($ExistingBinary)

if (-not $isExistingBinary) {
  if (-not $SkipWebBuild) {
    $oldFrontendVersion = $env:VITE_REACT_APP_VERSION
    $oldDisableEslint = $env:DISABLE_ESLINT_PLUGIN
    Push-Location (Join-Path $repoRoot "web")
    try {
      & bun install --frozen-lockfile
      Assert-ExitCode "bun install"
      $env:VITE_REACT_APP_VERSION = $version
      $env:DISABLE_ESLINT_PLUGIN = "true"
      Push-Location "default"
      try {
        & bun run build
        Assert-ExitCode "default frontend build"
      } finally {
        Pop-Location
      }
      Push-Location "classic"
      try {
        & bun run build
        Assert-ExitCode "classic frontend build"
      } finally {
        Pop-Location
      }
    } finally {
      Pop-Location
      $env:VITE_REACT_APP_VERSION = $oldFrontendVersion
      $env:DISABLE_ESLINT_PLUGIN = $oldDisableEslint
    }
  } else {
    foreach ($indexPath in @("web\default\dist\index.html", "web\classic\dist\index.html")) {
      if (-not (Test-Path -LiteralPath (Join-Path $repoRoot $indexPath))) {
        throw "Missing embedded frontend asset: $indexPath"
      }
    }
  }

  $safeVersion = [regex]::Replace($version, "[^0-9A-Za-z._-]", "_")
  $artifactPath = Join-Path $OutputDirectory "new-api-$safeVersion.exe"
  $ldflags = "-s -w -X 'github.com/QuantumNous/new-api/common.Version=$version'"
  Push-Location $repoRoot
  try {
    & go build -trimpath -buildvcs=true -ldflags $ldflags -o $artifactPath .
    Assert-ExitCode "Go release build"
  } finally {
    Pop-Location
  }
  $buildCommand = "go build -trimpath -buildvcs=true -ldflags <version>"
} else {
  $artifactPath = (Resolve-Path $ExistingBinary).Path
}

$artifact = Get-Item -LiteralPath $artifactPath
$hash = Get-FileHash -Algorithm SHA256 -LiteralPath $artifactPath
$buildInfo = (& go version -m $artifactPath 2>&1 | Out-String).Trim()
Assert-ExitCode "Go build info extraction"
$revisionMatch = [regex]::Match($buildInfo, "vcs\.revision=([0-9a-fA-F]+)")
$modifiedMatch = [regex]::Match($buildInfo, "vcs\.modified=(true|false)")
$moduleVersionMatch = [regex]::Match($buildInfo, "(?m)^\s*mod\s+\S+\s+(\S+)")
$embeddedRevision = if ($revisionMatch.Success) { $revisionMatch.Groups[1].Value } else { "" }
$embeddedModified = if ($modifiedMatch.Success) { $modifiedMatch.Groups[1].Value } else { "unknown" }
$embeddedModuleVersion = if ($moduleVersionMatch.Success) { $moduleVersionMatch.Groups[1].Value } else { "" }
$revisionMatchesHead = $embeddedRevision -ne "" -and $embeddedRevision -eq $head

$goVersion = (& go version).Trim()
Assert-ExitCode "Go version detection"
$bunVersion = "unavailable"
if (Get-Command bun -ErrorAction SilentlyContinue) {
  $bunVersion = (& bun --version).Trim()
  Assert-ExitCode "Bun version detection"
}
$signatureStatus = "not-applicable"
if (Get-Command Get-AuthenticodeSignature -ErrorAction SilentlyContinue) {
  $signatureStatus = [string](Get-AuthenticodeSignature -LiteralPath $artifactPath).Status
}

$artifactFileName = $artifact.Name
$buildInfoPath = Join-Path $OutputDirectory ($artifactFileName + ".buildinfo.txt")
$checksumPath = Join-Path $OutputDirectory ($artifactFileName + ".sha256")
$manifestPath = Join-Path $OutputDirectory ($artifactFileName + ".manifest.json")
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($buildInfoPath, $buildInfo + [Environment]::NewLine, $utf8NoBom)
[System.IO.File]::WriteAllText($checksumPath, $hash.Hash.ToLowerInvariant() + "  " + $artifactFileName + [Environment]::NewLine, $utf8NoBom)

$manifest = [ordered]@{
  schemaVersion = 1
  generatedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
  artifact = [ordered]@{
    fileName = $artifactFileName
    path = $artifact.FullName
    sizeBytes = $artifact.Length
    sha256 = $hash.Hash.ToLowerInvariant()
    authenticodeStatus = $signatureStatus
  }
  source = [ordered]@{
    authoritativeRoot = $repoRoot
    branch = $branch
    currentHead = $head
    currentDescribe = $describe
    currentWorkingTreeDirty = $isDirty
    embeddedRevision = $embeddedRevision
    embeddedModified = $embeddedModified
    embeddedModuleVersion = $embeddedModuleVersion
    embeddedRevisionMatchesCurrentHead = $revisionMatchesHead
  }
  build = [ordered]@{
    command = $buildCommand
    versionFallback = $versionFallback
    resolvedVersion = $(if ($isExistingBinary) { "not-derived-from-current-tree" } else { $version })
    goVersion = $goVersion
    bunVersion = $bunVersion
  }
  evidence = [ordered]@{
    buildInfo = $buildInfoPath
    checksum = $checksumPath
    dependencyInventoryFormat = "go version -m"
    standardizedSbomGenerated = $false
  }
}
$manifestJson = $manifest | ConvertTo-Json -Depth 6
[System.IO.File]::WriteAllText($manifestPath, $manifestJson + [Environment]::NewLine, $utf8NoBom)

Write-Output "artifact=$artifactPath"
Write-Output "manifest=$manifestPath"
Write-Output "checksum=$checksumPath"
Write-Output "build_info=$buildInfoPath"
Write-Output "embedded_revision_matches_head=$revisionMatchesHead"
