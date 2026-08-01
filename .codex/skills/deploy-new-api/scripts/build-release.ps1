[CmdletBinding()]
param(
    [string]$Repository = 'F:\Project\My-Project\new-api',
    [string]$Commit = 'HEAD',
    [string]$OutputDirectory = '',
    [switch]$KeepWorktree,
    [switch]$ForceRebuild,
    [switch]$ValidateOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Invoke-Native {
    param(
        [Parameter(Mandatory)] [string]$Command,
        [Parameter(Mandatory)] [string[]]$Arguments,
        [Parameter(Mandatory)] [string]$WorkingDirectory
    )

    Push-Location -LiteralPath $WorkingDirectory
    try {
        & $Command @Arguments
        if ($LASTEXITCODE -ne 0) {
            throw "$Command failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }
}

function Invoke-NativeCapture {
    param(
        [Parameter(Mandatory)] [string]$Command,
        [Parameter(Mandatory)] [string[]]$Arguments,
        [Parameter(Mandatory)] [string]$WorkingDirectory
    )

    Push-Location -LiteralPath $WorkingDirectory
    try {
        $output = & $Command @Arguments 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "$Command failed with exit code $LASTEXITCODE`: $($output -join [Environment]::NewLine)"
        }
        return ($output -join [Environment]::NewLine).Trim()
    }
    finally {
        Pop-Location
    }
}

foreach ($tool in @('git', 'bun', 'go', 'tar')) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        throw "Required tool is not available: $tool"
    }
}

$repoRoot = (Resolve-Path -LiteralPath $Repository).Path
if (-not (Test-Path -LiteralPath (Join-Path $repoRoot 'go.mod'))) {
    throw "Not a new-api repository: $repoRoot"
}
$buildScriptSha = (Get-FileHash -LiteralPath $PSCommandPath -Algorithm SHA256).Hash.ToLowerInvariant()
$bunVersion = Invoke-NativeCapture -Command 'bun' -Arguments @('--version') -WorkingDirectory $repoRoot
if ($bunVersion -notmatch '^\d+\.\d+\.\d+') {
    throw "Could not parse Bun version: $bunVersion"
}

$commitSha = Invoke-NativeCapture -Command 'git' -Arguments @('-C', $repoRoot, 'rev-parse', "${Commit}^{commit}") -WorkingDirectory $repoRoot
if ($commitSha -notmatch '^[0-9a-f]{40}$') {
    throw "Could not resolve a single commit: $commitSha"
}

$dockerfile = Invoke-NativeCapture -Command 'git' -Arguments @('-C', $repoRoot, 'show', "${commitSha}:Dockerfile") -WorkingDirectory $repoRoot
$dockerfileBlob = Invoke-NativeCapture -Command 'git' -Arguments @('-C', $repoRoot, 'rev-parse', "${commitSha}:Dockerfile") -WorkingDirectory $repoRoot
$frontendLockBlob = Invoke-NativeCapture -Command 'git' -Arguments @('-C', $repoRoot, 'rev-parse', "${commitSha}:web/bun.lock") -WorkingDirectory $repoRoot
if ($dockerfile -notmatch '(?m)^FROM\s+golang:([0-9.]+)-') {
    throw 'Could not determine the required Go version from Dockerfile.'
}
$expectedGoVersion = $Matches[1]
$localGoVersionOutput = Invoke-NativeCapture -Command 'go' -Arguments @('version') -WorkingDirectory $repoRoot
if ($localGoVersionOutput -notmatch '\bgo version go([0-9.]+)\b') {
    throw "Could not parse local Go version: $localGoVersionOutput"
}
$localGoVersion = $Matches[1]
if ($localGoVersion -ne $expectedGoVersion) {
    throw "Go version mismatch: Dockerfile requires $expectedGoVersion, local tool is $localGoVersion"
}
$goExperiment = ''
if ($dockerfile -match '(?m)^ENV\s+GOEXPERIMENT=([A-Za-z0-9,]+)\s*$') {
    $goExperiment = $Matches[1]
}

$shortSha = $commitSha.Substring(0, 12)
$repoParent = Split-Path -Parent $repoRoot
$worktree = Join-Path $repoParent "new-api-build-$commitSha"

$worktreeExists = Test-Path -LiteralPath $worktree

$driveName = ([IO.Path]::GetPathRoot($worktree)).TrimEnd('\').TrimEnd(':')
$buildDrive = Get-PSDrive -Name $driveName
$minimumFreeBytes = 4GB
if ($buildDrive.Free -lt $minimumFreeBytes) {
    throw "The build drive needs at least 4 GiB free; available: $([Math]::Round($buildDrive.Free / 1GB, 2)) GiB"
}

if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
    $OutputDirectory = Join-Path $repoParent 'new-api-releases'
}
$outputRoot = [IO.Path]::GetFullPath($OutputDirectory)
$artifactDirectory = Join-Path $outputRoot $commitSha
$binaryPath = Join-Path $artifactDirectory 'new-api'
$manifestPath = Join-Path $artifactDirectory 'manifest.json'
$archivePath = Join-Path $outputRoot "new-api-$commitSha-linux-amd64.tar.gz"
$partialArchivePath = "$archivePath.partial-$PID"
$artifactExists = (Test-Path -LiteralPath $artifactDirectory) -or (Test-Path -LiteralPath $archivePath)

if ($ValidateOnly) {
    [pscustomobject]@{
        Repository = $repoRoot
        Commit = $commitSha
        Worktree = $worktree
        WorktreeExists = $worktreeExists
        DependencyMode = 'isolated bun install --frozen-lockfile'
        OutputDirectory = $outputRoot
        ArtifactExists = $artifactExists
        FreeGiB = [Math]::Round($buildDrive.Free / 1GB, 2)
        GoVersion = $localGoVersion
        GoExperiment = $goExperiment
        BunVersion = $bunVersion
        FrontendLockBlob = $frontendLockBlob
        BuildScriptSha256 = $buildScriptSha
        Status = 'preflight-passed'
    }
    exit 0
}

$outputRootWithSeparator = $outputRoot.TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
foreach ($target in @($artifactDirectory, $archivePath, $partialArchivePath)) {
    $fullTarget = [IO.Path]::GetFullPath($target)
    if (-not $fullTarget.StartsWith($outputRootWithSeparator, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Artifact path escapes output directory: $fullTarget"
    }
}
if ($worktreeExists -and -not $ForceRebuild) {
    throw "Build worktree already exists: $worktree. Pass -ForceRebuild to remove this exact commit's stale build worktree."
}
if ($worktreeExists -and $ForceRebuild) {
    $expectedWorktree = [IO.Path]::GetFullPath((Join-Path $repoParent "new-api-build-$commitSha"))
    if ([IO.Path]::GetFullPath($worktree) -ne $expectedWorktree) {
        throw "Refusing to clean unexpected worktree path: $worktree"
    }

    $staleNodeModules = Join-Path $worktree 'web\node_modules'
    if (Test-Path -LiteralPath $staleNodeModules) {
        Remove-Item -LiteralPath $staleNodeModules -Recurse -Force
    }
    $registeredWorktrees = Invoke-NativeCapture -Command 'git' -Arguments @('-C', $repoRoot, 'worktree', 'list', '--porcelain') -WorkingDirectory $repoRoot
    $worktreeRecord = 'worktree ' + ($worktree -replace '\\', '/')
    if (($registeredWorktrees -split "`r?`n") -contains $worktreeRecord) {
        Invoke-Native -Command 'git' -Arguments @('-C', $repoRoot, 'worktree', 'remove', '--force', $worktree) -WorkingDirectory $repoRoot
    }
    elseif (Test-Path -LiteralPath $worktree) {
        Remove-Item -LiteralPath $worktree -Recurse -Force
    }
    Invoke-Native -Command 'git' -Arguments @('-C', $repoRoot, 'worktree', 'prune') -WorkingDirectory $repoRoot
}
if ($artifactExists -and -not $ForceRebuild) {
    throw "Artifact already exists for $commitSha. Pass -ForceRebuild to remove it before rebuilding."
}
if ($ForceRebuild) {
    if (Test-Path -LiteralPath $artifactDirectory) {
        Remove-Item -LiteralPath $artifactDirectory -Recurse -Force
    }
    if (Test-Path -LiteralPath $archivePath) {
        Remove-Item -LiteralPath $archivePath -Force
    }
}

$worktreeCreated = $false

try {
    Invoke-Native -Command 'git' -Arguments @('-C', $repoRoot, 'worktree', 'add', '--detach', $worktree, $commitSha) -WorkingDirectory $repoRoot
    $worktreeCreated = $true

    Invoke-Native -Command 'bun' -Arguments @('install', '--frozen-lockfile') -WorkingDirectory (Join-Path $worktree 'web')

    $versionPath = Join-Path $worktree 'VERSION'
    $version = ''
    if (Test-Path -LiteralPath $versionPath) {
        $versionContent = Get-Content -LiteralPath $versionPath -Raw
        if ($null -ne $versionContent) {
            $version = $versionContent.Trim()
        }
    }

    $oldDisableEslint = $env:DISABLE_ESLINT_PLUGIN
    $oldVersion = $env:VITE_REACT_APP_VERSION
    try {
        $env:DISABLE_ESLINT_PLUGIN = 'true'
        $env:VITE_REACT_APP_VERSION = $version
        Invoke-Native -Command 'bun' -Arguments @('run', 'build') -WorkingDirectory (Join-Path $worktree 'web\default')
    }
    finally {
        $env:DISABLE_ESLINT_PLUGIN = $oldDisableEslint
        $env:VITE_REACT_APP_VERSION = $oldVersion
    }

    $classicDist = Join-Path $worktree 'web\classic\dist'
    New-Item -ItemType Directory -Path $classicDist -Force | Out-Null
    $classicPlaceholder = '<!doctype html><html><head><title>New API</title></head><body>Classic frontend build disabled for this deployment.</body></html>'
    [IO.File]::WriteAllText((Join-Path $classicDist 'index.html'), $classicPlaceholder, [Text.UTF8Encoding]::new($false))

    New-Item -ItemType Directory -Path $artifactDirectory -Force | Out-Null
    $oldGoos = $env:GOOS
    $oldGoarch = $env:GOARCH
    $oldCgo = $env:CGO_ENABLED
    $oldExperiment = $env:GOEXPERIMENT
    try {
        $env:GOOS = 'linux'
        $env:GOARCH = 'amd64'
        $env:CGO_ENABLED = '0'
        $env:GOEXPERIMENT = $goExperiment
        $ldflags = "-s -w -X 'github.com/QuantumNous/new-api/common.Version=$version'"
        Invoke-Native -Command 'go' -Arguments @('build', '-buildvcs=false', '-trimpath', '-ldflags', $ldflags, '-o', $binaryPath, '.') -WorkingDirectory $worktree
    }
    finally {
        $env:GOOS = $oldGoos
        $env:GOARCH = $oldGoarch
        $env:CGO_ENABLED = $oldCgo
        $env:GOEXPERIMENT = $oldExperiment
    }

    $stream = [IO.File]::OpenRead($binaryPath)
    try {
        $magicBytes = [byte[]]::new(4)
        if ($stream.Read($magicBytes, 0, 4) -ne 4) {
            throw 'Built binary is too short.'
        }
    }
    finally {
        $stream.Dispose()
    }
    $elfMagic = ($magicBytes | ForEach-Object { $_.ToString('x2') }) -join ''
    if ($elfMagic -ne '7f454c46') {
        throw "Built artifact is not an ELF binary: $elfMagic"
    }

    Invoke-Native -Command 'go' -Arguments @('version', '-m', $binaryPath) -WorkingDirectory $worktree
    $binarySha = (Get-FileHash -LiteralPath $binaryPath -Algorithm SHA256).Hash.ToLowerInvariant()
    $manifest = [ordered]@{
        commit = $commitSha
        short_commit = $shortSha
        version = $version
        target = 'linux/amd64'
        go_version = $localGoVersion
        goexperiment = $goExperiment
        bun_version = $bunVersion
        frontend_lock_blob = $frontendLockBlob
        dockerfile_blob = $dockerfileBlob
        build_script_sha256 = $buildScriptSha
        binary_sha256 = $binarySha
        built_at_utc = [DateTime]::UtcNow.ToString('o')
    } | ConvertTo-Json
    [IO.File]::WriteAllText($manifestPath, $manifest, [Text.UTF8Encoding]::new($false))

    Invoke-Native -Command 'tar' -Arguments @('-czf', $partialArchivePath, '-C', $artifactDirectory, 'new-api', 'manifest.json') -WorkingDirectory $artifactDirectory
    Move-Item -LiteralPath $partialArchivePath -Destination $archivePath
    $archiveSha = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()

    [pscustomobject]@{
        Commit = $commitSha
        Binary = $binaryPath
        BinarySha256 = $binarySha
        Archive = $archivePath
        ArchiveSha256 = $archiveSha
        Manifest = $manifestPath
        BunVersion = $bunVersion
        BuildScriptSha256 = $buildScriptSha
    }
}
finally {
    if (Test-Path -LiteralPath $partialArchivePath) {
        Remove-Item -LiteralPath $partialArchivePath -Force
    }
    if ($worktreeCreated -and -not $KeepWorktree) {
        $isolatedNodeModules = Join-Path $worktree 'web\node_modules'
        if (Test-Path -LiteralPath $isolatedNodeModules) {
            Remove-Item -LiteralPath $isolatedNodeModules -Recurse -Force
        }
        Invoke-Native -Command 'git' -Arguments @('-C', $repoRoot, 'worktree', 'remove', '--force', $worktree) -WorkingDirectory $repoRoot
        Invoke-Native -Command 'git' -Arguments @('-C', $repoRoot, 'worktree', 'prune') -WorkingDirectory $repoRoot
    }
}
