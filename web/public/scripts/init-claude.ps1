[CmdletBinding()]
param(
    [string]$ApiProxy = "https://superelite.studio",
    [string]$ApiKey,
    [string]$ProviderName = "superelite",
    [string]$Model,
    [switch]$SkipLaunchCCSwitch
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Output helpers ────────────────────────────────────────────────────────────
function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "[*] $Message" -ForegroundColor Cyan
}

function Write-Ok {
    param([string]$Message)
    Write-Host "[+] $Message" -ForegroundColor Green
}

function Write-WarnLine {
    param([string]$Message)
    Write-Host "[!] $Message" -ForegroundColor Yellow
}

# ── Assertions ────────────────────────────────────────────────────────────────
function Assert-Windows {
    if ([System.Environment]::OSVersion.Platform -ne [System.PlatformID]::Win32NT) {
        throw "This script is for Windows only. Use init-claude.sh on macOS."
    }
}

function Assert-Winget {
    if (-not (Get-Command winget.exe -ErrorAction SilentlyContinue)) {
        throw "winget not found. Please install Microsoft App Installer (winget) first, then re-run this script."
    }
}

# ── TLS / PATH ────────────────────────────────────────────────────────────────
function Enable-Tls12 {
    try {
        $current = [Net.ServicePointManager]::SecurityProtocol
        if (($current -band [Net.SecurityProtocolType]::Tls12) -eq 0) {
            [Net.ServicePointManager]::SecurityProtocol = $current -bor [Net.SecurityProtocolType]::Tls12
        }
    }
    catch {
        Write-WarnLine "Could not explicitly set TLS 1.2. Continuing with current network configuration."
    }
}

function Refresh-SessionPath {
    $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath    = [Environment]::GetEnvironmentVariable("Path", "User")
    $allParts    = @()
    if ($machinePath) { $allParts += $machinePath.Split(";") }
    if ($userPath)    { $allParts += $userPath.Split(";") }

    $deduped = New-Object System.Collections.Generic.List[string]
    foreach ($part in $allParts) {
        if ([string]::IsNullOrWhiteSpace($part)) { continue }
        if (-not $deduped.Contains($part)) { [void]$deduped.Add($part) }
    }
    $env:Path = ($deduped -join ";")
}

# ── Secure input ──────────────────────────────────────────────────────────────
function Convert-SecureStringToPlainText {
    param([Security.SecureString]$SecureString)

    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureString)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    }
    finally {
        if ($ptr -ne [IntPtr]::Zero) {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
        }
    }
}

function Read-RequiredValue {
    param(
        [string]$Prompt,
        [switch]$Secret
    )

    while ($true) {
        if ($Secret) {
            $value = Convert-SecureStringToPlainText (Read-Host -Prompt $Prompt -AsSecureString)
        }
        else {
            $value = Read-Host -Prompt $Prompt
        }

        if (-not [string]::IsNullOrWhiteSpace($value)) {
            return $value.Trim()
        }

        Write-WarnLine "Input cannot be empty. Please try again."
    }
}

# ── Process / web helpers ─────────────────────────────────────────────────────
function Invoke-ExternalProcess {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][string[]]$ArgumentList,
        [switch]$IgnoreExitCode
    )

    $process = Start-Process -FilePath $FilePath -ArgumentList $ArgumentList -Wait -PassThru -NoNewWindow
    if (-not $IgnoreExitCode -and $process.ExitCode -ne 0) {
        $joinedArgs = $ArgumentList -join " "
        throw "Command failed: $FilePath $joinedArgs`nExit code: $($process.ExitCode)"
    }
    return $process.ExitCode
}

function Get-WebText {
    param(
        [Parameter(Mandatory = $true)][string]$Url,
        [hashtable]$Headers
    )

    $params = @{ Uri = $Url }
    if ($Headers) { $params.Headers = $Headers }
    if ((Get-Command Invoke-WebRequest).Parameters.ContainsKey("UseBasicParsing")) {
        $params.UseBasicParsing = $true
    }
    $response = Invoke-WebRequest @params
    $content = $response.Content

    if ($content -is [byte[]]) {
        $encoding = $null
        try {
            $charset = $response.Headers["Content-Type"] -replace '.*charset=([^;]+).*', '$1'
            if ($charset -and $charset -ne $response.Headers["Content-Type"]) {
                $encoding = [System.Text.Encoding]::GetEncoding($charset.Trim())
            }
        }
        catch { }

        if (-not $encoding) {
            $encoding = [System.Text.Encoding]::UTF8
        }

        return $encoding.GetString($content)
    }

    return [string]$content
}

function Download-File {
    param(
        [Parameter(Mandatory = $true)][string]$Url,
        [Parameter(Mandatory = $true)][string]$OutFile,
        [hashtable]$Headers
    )

    $params = @{ Uri = $Url; OutFile = $OutFile }
    if ($Headers) { $params.Headers = $Headers }
    if ((Get-Command Invoke-WebRequest).Parameters.ContainsKey("UseBasicParsing")) {
        $params.UseBasicParsing = $true
    }
    Invoke-WebRequest @params | Out-Null
}

function Invoke-GitHubApi {
    param([Parameter(Mandatory = $true)][string]$Url)

    $headers = @{
        "Accept"     = "application/vnd.github+json"
        "User-Agent" = "PowerShell-Installer"
    }
    return Invoke-RestMethod -Uri $Url -Headers $headers
}

# ── JSON helpers ──────────────────────────────────────────────────────────────
function Backup-FileIfExists {
    param([string]$Path)

    if (Test-Path -LiteralPath $Path) {
        $timestamp  = Get-Date -Format "yyyyMMdd-HHmmss"
        $backupPath = "$Path.bak-$timestamp"
        Copy-Item -LiteralPath $Path -Destination $backupPath -Force
        return $backupPath
    }
    return $null
}

function ConvertTo-OrderedData {
    param([Parameter(ValueFromPipeline = $true)]$InputObject)

    if ($null -eq $InputObject) { return $null }
    if ($InputObject -is [string] -or $InputObject.GetType().IsPrimitive) { return $InputObject }

    if ($InputObject -is [System.Collections.IDictionary]) {
        $result = [ordered]@{}
        foreach ($key in $InputObject.Keys) {
            $result[$key] = ConvertTo-OrderedData $InputObject[$key]
        }
        return $result
    }

    if ($InputObject -is [System.Collections.IEnumerable] -and -not ($InputObject -is [string])) {
        $items = @()
        foreach ($item in $InputObject) { $items += ,(ConvertTo-OrderedData $item) }
        return $items
    }

    $obj = [ordered]@{}
    foreach ($prop in $InputObject.PSObject.Properties) {
        $obj[$prop.Name] = ConvertTo-OrderedData $prop.Value
    }
    return $obj
}

function Get-ExistingJsonObject {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) { return [ordered]@{} }

    $content = Get-Content -LiteralPath $Path -Raw
    if ([string]::IsNullOrWhiteSpace($content)) { return [ordered]@{} }

    try {
        return ConvertTo-OrderedData (ConvertFrom-Json -InputObject $content)
    }
    catch {
        $backup = Backup-FileIfExists -Path $Path
        Write-WarnLine "Invalid JSON detected. Backed up to: $backup"
        return [ordered]@{}
    }
}

# ── Git for Windows ───────────────────────────────────────────────────────────
function Get-GitBashPath {
    $gitCommand = Get-Command git.exe -ErrorAction SilentlyContinue
    if ($gitCommand) {
        $gitCmdDir  = Split-Path -Parent $gitCommand.Source
        $gitRootDir = Split-Path -Parent $gitCmdDir
        $candidate  = Join-Path $gitRootDir "bin\bash.exe"
        if (Test-Path -LiteralPath $candidate) { return $candidate }
    }

    $candidates = @(
        (Join-Path $env:ProgramFiles        "Git\bin\bash.exe"),
        (Join-Path ${env:ProgramFiles(x86)} "Git\bin\bash.exe"),
        (Join-Path $env:LocalAppData        "Programs\Git\bin\bash.exe")
    )
    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path -LiteralPath $candidate)) { return $candidate }
    }
    return $null
}

function Ensure-GitForWindows {
    $gitBash = Get-GitBashPath
    if ($gitBash) {
        Write-Ok "Git for Windows detected."
        [Environment]::SetEnvironmentVariable("CLAUDE_CODE_GIT_BASH_PATH", $gitBash, "User")
        $env:CLAUDE_CODE_GIT_BASH_PATH = $gitBash
        return $gitBash
    }

    Assert-Winget
    Write-Step "Installing Git for Windows (required by Claude Code on Windows)..."

    $wingetArgs = @(
        "install", "--id", "Git.Git", "-e",
        "--source", "winget",
        "--accept-package-agreements", "--accept-source-agreements",
        "--silent", "--disable-interactivity", "--scope", "user"
    )

    $exitCode = Invoke-ExternalProcess -FilePath "winget.exe" -ArgumentList $wingetArgs -IgnoreExitCode
    if ($exitCode -ne 0) {
        Write-WarnLine "User-scope Git install failed. Retrying with default scope."
        $fallbackArgs = @(
            "install", "--id", "Git.Git", "-e",
            "--source", "winget",
            "--accept-package-agreements", "--accept-source-agreements",
            "--silent", "--disable-interactivity"
        )
        Invoke-ExternalProcess -FilePath "winget.exe" -ArgumentList $fallbackArgs
    }

    Refresh-SessionPath
    $gitBash = Get-GitBashPath
    if (-not $gitBash) { throw "bash.exe not found after Git for Windows installation." }

    [Environment]::SetEnvironmentVariable("CLAUDE_CODE_GIT_BASH_PATH", $gitBash, "User")
    $env:CLAUDE_CODE_GIT_BASH_PATH = $gitBash
    Write-Ok "Git for Windows installed."
    return $gitBash
}

# ── Claude Code ───────────────────────────────────────────────────────────────
function Get-LatestClaudeCodeVersion {
    try {
        $info = Invoke-GitHubApi -Url "https://api.github.com/repos/anthropics/claude-code/releases/latest"
        return $info.tag_name -replace '^v', ''
    }
    catch {
        return $null
    }
}

function Ensure-ClaudeCode {
    Write-Step "Checking Claude Code CLI..."

    Refresh-SessionPath
    $claudeCommand = Get-Command claude -ErrorAction SilentlyContinue

    if ($claudeCommand) {
        try {
            $currentVersion = (& $claudeCommand.Source --version 2>$null) -replace '[^\d\.].*', '' | Select-Object -First 1
            $latestVersion  = Get-LatestClaudeCodeVersion
            if ($latestVersion -and $currentVersion -and ($currentVersion.Trim() -eq $latestVersion.Trim())) {
                Write-Ok "Claude Code is already up to date: $currentVersion"
                return
            }
            Write-Step "Updating Claude Code ($currentVersion -> $latestVersion)..."
        }
        catch {
            Write-Step "Installing or updating Claude Code CLI..."
        }
    }
    else {
        Write-Step "Installing Claude Code CLI..."
    }

    $officialScriptOk = $false
    try {
        $installScript = Get-WebText -Url "https://claude.ai/install.ps1"
        if ([string]::IsNullOrWhiteSpace($installScript)) {
            Write-WarnLine "Official install URL returned empty content. Falling back to winget."
        }
        elseif ($installScript.TrimStart().StartsWith("<")) {
            Write-WarnLine "Official install URL returned an HTML page (likely blocked by network). Falling back to winget."
        }
        else {
            Invoke-Expression $installScript
            $officialScriptOk = $true
        }
    }
    catch {
        Write-WarnLine "Failed to fetch or run official install script: $_. Falling back to winget."
    }

    Refresh-SessionPath
    $claudeCommand = Get-Command claude -ErrorAction SilentlyContinue
    if (-not $claudeCommand) {
        Assert-Winget
        if ($officialScriptOk) {
            Write-WarnLine "claude command not found after official script. Falling back to winget."
        }
        $wingetArgs = @(
            "install", "--id", "Anthropic.ClaudeCode", "-e",
            "--source", "winget",
            "--accept-package-agreements", "--accept-source-agreements",
            "--silent", "--disable-interactivity"
        )
        Invoke-ExternalProcess -FilePath "winget.exe" -ArgumentList $wingetArgs
        Refresh-SessionPath
        $claudeCommand = Get-Command claude -ErrorAction SilentlyContinue
    }

    if (-not $claudeCommand) { throw "claude command not found after installation." }

    try {
        $version = & $claudeCommand.Source --version
        if ($LASTEXITCODE -eq 0 -and $version) { Write-Ok "Claude Code is ready: $version" }
        else                                    { Write-Ok "Claude Code installed." }
    }
    catch {
        Write-Ok "Claude Code installed (could not read version in current session)."
    }
}

# ── URL helpers ───────────────────────────────────────────────────────────────
function Normalize-ApiProxy {
    param([Parameter(Mandatory = $true)][string]$Value)

    $uri = $null
    if (-not [Uri]::TryCreate($Value, [UriKind]::Absolute, [ref]$uri)) {
        throw "API Proxy must be a full URL, e.g. https://example.com/v1"
    }
    if ($uri.Scheme -notin @("http", "https")) {
        throw "API Proxy only supports http/https."
    }
    return $uri.AbsoluteUri.TrimEnd("/")
}

function Get-WebsiteUrlFromProxy {
    param([Parameter(Mandatory = $true)][string]$ProxyUrl)

    $uri = [Uri]$ProxyUrl
    return $uri.GetLeftPart([UriPartial]::Authority)
}

# ── Claude settings.json ──────────────────────────────────────────────────────
function Write-ClaudeSettingsFile {
    param(
        [Parameter(Mandatory = $true)][string]$ProxyUrl,
        [Parameter(Mandatory = $true)][string]$Token,
        [string]$ModelName
    )

    Write-Step "Writing Claude Code settings..."

    $claudeDir    = Join-Path $HOME ".claude"
    $settingsPath = Join-Path $claudeDir "settings.json"
    [void](New-Item -ItemType Directory -Force -Path $claudeDir)

    $existing = Get-ExistingJsonObject -Path $settingsPath
    if (-not $existing.Contains("env")) { $existing["env"] = [ordered]@{} }
    if (-not ($existing["env"] -is [System.Collections.IDictionary])) {
        $existing["env"] = ConvertTo-OrderedData $existing["env"]
    }

    $existing["env"]["ANTHROPIC_BASE_URL"]   = $ProxyUrl
    $existing["env"]["ANTHROPIC_AUTH_TOKEN"] = $Token

    if ([string]::IsNullOrWhiteSpace($ModelName)) {
        if ($existing["env"].Contains("ANTHROPIC_MODEL")) {
            [void]$existing["env"].Remove("ANTHROPIC_MODEL")
        }
    }
    else {
        $existing["env"]["ANTHROPIC_MODEL"] = $ModelName
    }

    $backup = Backup-FileIfExists -Path $settingsPath
    $json   = $existing | ConvertTo-Json -Depth 20
    Set-Content -LiteralPath $settingsPath -Value $json -Encoding UTF8

    if ($backup) { Write-Ok "Claude settings updated. Previous file backed up." }
    else         { Write-Ok "Claude settings written." }

    return $settingsPath
}

# ── CC Switch bootstrap config ────────────────────────────────────────────────
function New-EmptyProviderManager {
    return [ordered]@{ providers = [ordered]@{}; current = "" }
}

function Write-CCSwitchBootstrapConfig {
    param(
        [Parameter(Mandatory = $true)][string]$ProxyUrl,
        [Parameter(Mandatory = $true)][string]$Token,
        [Parameter(Mandatory = $true)][string]$ProviderLabel,
        [string]$ModelName
    )

    Write-Step "Preparing CC Switch bootstrap config..."

    $ccSwitchDir = Join-Path $HOME ".cc-switch"
    $dbPath      = Join-Path $ccSwitchDir "cc-switch.db"
    $configPath  = Join-Path $ccSwitchDir "config.json"
    [void](New-Item -ItemType Directory -Force -Path $ccSwitchDir)

    if (Test-Path -LiteralPath $dbPath) {
        Write-WarnLine "Existing CC Switch database detected. Skipping bootstrap to avoid overwriting. To add this proxy, use the in-app 'Add Provider' option."
        return @{ ConfigPath = $configPath; BootstrapWritten = $false; ExistingDatabase = $true }
    }

    $providerId  = "claude-" + ([Guid]::NewGuid().ToString("N").Substring(0, 12))
    $providerEnv = [ordered]@{
        ANTHROPIC_BASE_URL   = $ProxyUrl
        ANTHROPIC_AUTH_TOKEN = $Token
    }
    if (-not [string]::IsNullOrWhiteSpace($ModelName)) {
        $providerEnv["ANTHROPIC_MODEL"] = $ModelName
    }

    $provider = [ordered]@{
        id             = $providerId
        name           = $ProviderLabel
        settingsConfig = [ordered]@{ env = $providerEnv }
        websiteUrl     = Get-WebsiteUrlFromProxy -ProxyUrl $ProxyUrl
        category       = "custom"
        createdAt      = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
        sortIndex      = 0
    }

    $claudeManager = New-EmptyProviderManager
    $claudeManager["providers"][$providerId] = $provider
    $claudeManager["current"] = $providerId

    $config = [ordered]@{
        version  = 2
        claude   = $claudeManager
        codex    = New-EmptyProviderManager
        gemini   = New-EmptyProviderManager
        opencode = New-EmptyProviderManager
        openclaw = New-EmptyProviderManager
    }

    $backup = Backup-FileIfExists -Path $configPath
    $json   = $config | ConvertTo-Json -Depth 20
    Set-Content -LiteralPath $configPath -Value $json -Encoding UTF8

    if ($backup) { Write-Ok "CC Switch bootstrap config written. Previous config.json backed up." }
    else         { Write-Ok "CC Switch bootstrap config written." }

    return @{ ConfigPath = $configPath; BootstrapWritten = $true; ExistingDatabase = $false }
}

# ── CC Switch install ─────────────────────────────────────────────────────────
function Get-LatestCCSwitchWindowsMsi {
    Write-Step "Fetching latest CC Switch Windows installer..."
    $release = Invoke-GitHubApi -Url "https://api.github.com/repos/farion1231/cc-switch/releases/latest"
    $asset   = $release.assets | Where-Object { $_.name -match "Windows\.msi$" } | Select-Object -First 1

    if (-not $asset) { throw "No Windows MSI found in the latest CC Switch release." }

    return @{
        Version     = $release.tag_name
        DownloadUrl = $asset.browser_download_url
        FileName    = $asset.name
    }
}

function Get-CCSwitchExePath {
    $registryRoots = @(
        "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
        "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
        "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*"
    )

    foreach ($root in $registryRoots) {
        $items = Get-ItemProperty -Path $root -ErrorAction SilentlyContinue |
            Where-Object { $_ -and $_.PSObject.Properties["DisplayName"] -and $_.DisplayName -like "CC Switch*" }

        foreach ($item in $items) {
            if ($item.DisplayIcon) {
                $displayIcon = ($item.DisplayIcon -split ",")[0].Trim('"')
                if (Test-Path -LiteralPath $displayIcon) { return $displayIcon }
            }
            if ($item.InstallLocation) {
                $candidate = Join-Path $item.InstallLocation "CC Switch.exe"
                if (Test-Path -LiteralPath $candidate) { return $candidate }
            }
        }
    }

    $candidates = @(
        (Join-Path $env:LocalAppData        "Programs\CC Switch\CC Switch.exe"),
        (Join-Path $env:ProgramFiles        "CC Switch\CC Switch.exe"),
        (Join-Path ${env:ProgramFiles(x86)} "CC Switch\CC Switch.exe")
    )
    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path -LiteralPath $candidate)) { return $candidate }
    }
    return $null
}

function Get-InstalledCCSwitchVersion {
    $registryRoots = @(
        "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
        "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
        "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*"
    )
    foreach ($root in $registryRoots) {
        $item = Get-ItemProperty -Path $root -ErrorAction SilentlyContinue |
            Where-Object { $_ -and $_.PSObject.Properties["DisplayName"] -and $_.DisplayName -like "CC Switch*" } |
            Select-Object -First 1
        if ($item -and $item.PSObject.Properties["DisplayVersion"]) {
            return $item.DisplayVersion -replace '^v', ''
        }
    }
    return $null
}

function Ensure-CCSwitch {
    $latest = Get-LatestCCSwitchWindowsMsi

    $installedVersion = Get-InstalledCCSwitchVersion
    $latestVersion    = $latest.Version -replace '^v', ''

    if ($installedVersion -and ($installedVersion -eq $latestVersion)) {
        $exePath = Get-CCSwitchExePath
        Write-Ok "CC Switch is already up to date: $installedVersion"
        return $exePath
    }

    if ($installedVersion) {
        Write-Step "Updating CC Switch ($installedVersion -> $latestVersion)..."
    }
    else {
        Write-Step "Installing CC Switch ($latestVersion)..."
    }

    $tempDir = Join-Path $env:TEMP ("cc-switch-install-" + [Guid]::NewGuid().ToString("N"))
    [void](New-Item -ItemType Directory -Force -Path $tempDir)
    $msiPath = Join-Path $tempDir $latest.FileName

    try {
        Download-File -Url $latest.DownloadUrl -OutFile $msiPath
        Invoke-ExternalProcess -FilePath "msiexec.exe" -ArgumentList @("/i", $msiPath, "/qn", "/norestart")
    }
    finally {
        Remove-Item -LiteralPath $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    }

    $exePath = Get-CCSwitchExePath
    if ($exePath) { Write-Ok "CC Switch installed." }
    else          { Write-WarnLine "CC Switch installed, but executable path could not be located. Launch it from the Start Menu." }

    return $exePath
}

# ── First-run launch ──────────────────────────────────────────────────────────
function Wait-ForFile {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [int]$TimeoutSeconds = 30
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-Path -LiteralPath $Path) { return $true }
        Start-Sleep -Seconds 1
    }
    return $false
}

function Start-CCSwitchForBootstrap {
    param([string]$ExePath)

    if (-not $ExePath) {
        Write-WarnLine "Cannot auto-launch CC Switch. On first manual launch it will import the generated config."
        return
    }

    Write-Step "Launching CC Switch for first-run import..."
    Start-Process -FilePath $ExePath | Out-Null

    $dbPath = Join-Path (Join-Path $HOME ".cc-switch") "cc-switch.db"
    if (Wait-ForFile -Path $dbPath -TimeoutSeconds 30) {
        Write-Ok "CC Switch first-run initialization complete."
    }
    else {
        Write-WarnLine "CC Switch launched, but database file not detected within 30 seconds. Config will be imported on first manual open."
    }
}

# ═════════════════════════════════════════════════════════════════════════════
# Main
# ═════════════════════════════════════════════════════════════════════════════
Assert-Windows
Enable-Tls12
Refresh-SessionPath

if ([string]::IsNullOrWhiteSpace($ApiProxy)) {
    $ApiProxy = "https://superelite.studio"
}

if ([string]::IsNullOrWhiteSpace($ApiKey)) {
    $ApiKey = Read-RequiredValue -Prompt "Enter API Key" -Secret
}

$ApiProxy = Normalize-ApiProxy -Value $ApiProxy

if ($ProviderName -eq "Custom Claude Proxy") {
    try {
        $hostName = ([Uri]$ApiProxy).Host
        if ($hostName) { $ProviderName = "Claude Proxy - $hostName" }
    }
    catch { }
}

Write-Step "Starting Claude Code + CC Switch installation on Windows..."

$gitBashPath = Ensure-GitForWindows
Write-Ok "Git Bash path: $gitBashPath"

Ensure-ClaudeCode
$claudeSettingsPath = Write-ClaudeSettingsFile -ProxyUrl $ApiProxy -Token $ApiKey -ModelName $Model
$ccSwitchBootstrap  = Write-CCSwitchBootstrapConfig -ProxyUrl $ApiProxy -Token $ApiKey -ProviderLabel $ProviderName -ModelName $Model
$ccSwitchExe        = Ensure-CCSwitch

if (-not $SkipLaunchCCSwitch -and $ccSwitchBootstrap.BootstrapWritten) {
    Start-CCSwitchForBootstrap -ExePath $ccSwitchExe
}
elseif ($SkipLaunchCCSwitch) {
    Write-WarnLine "Auto-launch of CC Switch skipped. Config will be imported on first manual open."
}

Write-Host ""
Write-Host "Installation complete." -ForegroundColor Green
Write-Host "Claude settings file:       $claudeSettingsPath"
Write-Host "CC Switch bootstrap config: $($ccSwitchBootstrap.ConfigPath)"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Run 'claude' to start using Claude Code."
Write-Host "  2. If CC Switch was not auto-launched, open it once manually to complete the import."
if (-not [string]::IsNullOrWhiteSpace($Model)) {
    Write-Host "  3. Model configured: $Model"
}
