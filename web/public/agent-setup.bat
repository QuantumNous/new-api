@echo off
chcp 65001 >nul
setlocal
set "NEWAPI_SETUP_SCRIPT=%~f0"
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "$text=[IO.File]::ReadAllText($env:NEWAPI_SETUP_SCRIPT);$marker='# NEWAPI_AGENT_SETUP_PAYLOAD';$index=$text.LastIndexOf($marker);if($index -lt 0){Write-Error '未找到安装脚本内容';exit 1};Invoke-Expression $text.Substring($index+$marker.Length)"
set "NEWAPI_SETUP_EXIT=%ERRORLEVEL%"
if not "%NEWAPI_SETUP_EXIT%"=="0" (
  echo.
  echo 配置失败。请查看上方错误信息；原有配置已尽可能保持不变。
  pause
)
exit /b %NEWAPI_SETUP_EXIT%
# NEWAPI_AGENT_SETUP_PAYLOAD
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$GatewayUrl = 'https://ai.nekocore.cn'
$ProviderName = 'NekoAI'
$DshModel = 'gpt-5.6-sol'
$DshCredentialRef = 'NEWAPI_API_KEY'
$DshProviderId = 'new-api'

function Write-Heading([string]$Text) {
  Write-Host ''
  Write-Host $Text -ForegroundColor Cyan
}

function Write-Detail([string]$Text) {
  Write-Host "  $Text" -ForegroundColor DarkGray
}

function Ensure-Directory([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
  }
}

function Backup-File([string]$Path, [string]$Stamp) {
  if (Test-Path -LiteralPath $Path) {
    $backup = "$Path.bak-$Stamp"
    Copy-Item -LiteralPath $Path -Destination $backup -Force
    Write-Detail "备份：$backup"
  }
}

function Write-Utf8File([string]$Path, [string]$Content) {
  $temporary = "$Path.tmp-$([Guid]::NewGuid().ToString('N'))"
  $encoding = New-Object System.Text.UTF8Encoding($false)
  try {
    [IO.File]::WriteAllText($temporary, $Content, $encoding)
    Move-Item -LiteralPath $temporary -Destination $Path -Force
  } finally {
    if (Test-Path -LiteralPath $temporary) {
      Remove-Item -LiteralPath $temporary -Force
    }
  }
}

function Read-JsonObject([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) {
    return [pscustomobject]@{}
  }
  $raw = [IO.File]::ReadAllText($Path).Trim()
  if ([string]::IsNullOrWhiteSpace($raw)) {
    return [pscustomobject]@{}
  }
  $value = $raw | ConvertFrom-Json
  if ($null -eq $value) {
    return [pscustomobject]@{}
  }
  if ($value -isnot [pscustomobject]) {
    throw "配置文件不是有效的 JSON 对象：$Path"
  }
  return $value
}

function Set-ObjectProperty($Object, [string]$Name, $Value) {
  $property = $Object.PSObject.Properties[$Name]
  if ($null -eq $property) {
    $Object | Add-Member -MemberType NoteProperty -Name $Name -Value $Value
  } else {
    $property.Value = $Value
  }
}

function Get-OrCreateObject($Object, [string]$Name) {
  $property = $Object.PSObject.Properties[$Name]
  if ($null -eq $property -or $null -eq $property.Value) {
    $child = [pscustomobject]@{}
    Set-ObjectProperty $Object $Name $child
    return $child
  }
  if ($property.Value -isnot [pscustomobject]) {
    throw "$Name 必须是 JSON 对象。"
  }
  return $property.Value
}

function Remove-ObjectProperty($Object, [string]$Name) {
  if ($null -ne $Object.PSObject.Properties[$Name]) {
    $Object.PSObject.Properties.Remove($Name)
  }
}

function ConvertTo-TomlString([string]$Value) {
  return '"' + $Value.Replace('\', '\\').Replace('"', '\"') + '"'
}

function Update-CodexConfig([string]$Path, [string]$BaseUrl, [string]$ApiKey, [string]$Stamp) {
  Backup-File $Path $Stamp
  $text = ''
  if (Test-Path -LiteralPath $Path) {
    $text = [IO.File]::ReadAllText($Path)
  }
  $lines = New-Object System.Collections.Generic.List[string]
  foreach ($line in (($text -replace "`r`n", "`n") -split "`n")) {
    $lines.Add($line)
  }

  $withoutProvider = New-Object System.Collections.Generic.List[string]
  $skippingProvider = $false
  foreach ($line in $lines) {
    if ($line -match '^\s*\[\[?\s*model_providers\.newapi(?:\.[^\]]*)?\s*\]\]?\s*(?:#.*)?$') {
      $skippingProvider = $true
      continue
    }
    if ($line -match '^\s*\[') {
      $skippingProvider = $false
    }
    if (-not $skippingProvider) {
      $withoutProvider.Add($line)
    }
  }

  $topLevelEnd = $withoutProvider.Count
  for ($index = 0; $index -lt $withoutProvider.Count; $index++) {
    if ($withoutProvider[$index] -match '^\s*\[') {
      $topLevelEnd = $index
      break
    }
  }

  $output = New-Object System.Collections.Generic.List[string]
  $hasProvider = $false
  $hasModel = $false
  for ($index = 0; $index -lt $topLevelEnd; $index++) {
    $line = $withoutProvider[$index]
    if ($line -match '^\s*model_provider\s*=') {
      if (-not $hasProvider) {
        $output.Add('model_provider = "newapi"')
        $hasProvider = $true
      }
      continue
    }
    if ($line -match '^\s*model\s*=') {
      if (-not $hasModel) {
        $output.Add($line)
        $hasModel = $true
      }
      continue
    }
    $output.Add($line)
  }
  for ($index = $topLevelEnd; $index -lt $withoutProvider.Count; $index++) {
    $output.Add($withoutProvider[$index])
  }

  $prefix = New-Object System.Collections.Generic.List[string]
  if (-not $hasProvider) {
    $prefix.Add('model_provider = "newapi"')
  }
  if (-not $hasModel) {
    $prefix.Add('model = "gpt-5.6-sol"')
  }
  if ($prefix.Count -gt 0) {
    $output.InsertRange(0, $prefix)
  }

  while ($output.Count -gt 0 -and [string]::IsNullOrWhiteSpace($output[$output.Count - 1])) {
    $output.RemoveAt($output.Count - 1)
  }
  $output.Add('')
  $output.Add('[model_providers.newapi]')
  $output.Add("name = `"$ProviderName`"")
  $output.Add(('base_url = ' + (ConvertTo-TomlString ($BaseUrl + '/v1'))))
  $output.Add('wire_api = "responses"')
  $output.Add(('experimental_bearer_token = ' + (ConvertTo-TomlString $ApiKey)))
  Write-Utf8File $Path (($output -join "`r`n") + "`r`n")
}

function Update-ClaudeSettings([string]$Path, [string]$BaseUrl, [string]$ApiKey, [string]$Stamp) {
  Backup-File $Path $Stamp
  $settings = Read-JsonObject $Path
  $environment = Get-OrCreateObject $settings 'env'
  Set-ObjectProperty $environment 'ANTHROPIC_BASE_URL' $BaseUrl
  Set-ObjectProperty $environment 'ANTHROPIC_AUTH_TOKEN' $ApiKey
  Remove-ObjectProperty $environment 'ANTHROPIC_API_KEY'
  Remove-ObjectProperty $environment 'CLAUDE_CODE_USE_BEDROCK'
  Remove-ObjectProperty $environment 'CLAUDE_CODE_USE_VERTEX'
  Write-Utf8File $Path (($settings | ConvertTo-Json -Depth 100) + "`r`n")
}

function Update-EnvFile([string]$Path, [hashtable]$Values, [string]$Stamp) {
  Backup-File $Path $Stamp
  $lines = @()
  if (Test-Path -LiteralPath $Path) {
    $lines = [IO.File]::ReadAllLines($Path)
  }
  $seen = @{}
  $output = New-Object System.Collections.Generic.List[string]
  foreach ($line in $lines) {
    if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=') {
      $name = $matches[1]
      if ($Values.ContainsKey($name)) {
        if (-not $seen.ContainsKey($name)) {
          $output.Add("$name=$($Values[$name])")
          $seen[$name] = $true
        }
        continue
      }
    }
    $output.Add($line)
  }
  foreach ($name in $Values.Keys) {
    if (-not $seen.ContainsKey($name)) {
      $output.Add("$name=$($Values[$name])")
    }
  }
  Write-Utf8File $Path (($output -join "`r`n") + "`r`n")
}

function Update-GeminiConfig([string]$Directory, [string]$BaseUrl, [string]$ApiKey, [string]$Model, [string]$Stamp) {
  Ensure-Directory $Directory
  $settingsPath = Join-Path $Directory 'settings.json'
  Backup-File $settingsPath $Stamp
  $settings = Read-JsonObject $settingsPath
  $security = Get-OrCreateObject $settings 'security'
  $auth = Get-OrCreateObject $security 'auth'
  Set-ObjectProperty $auth 'selectedType' 'gemini-api-key'
  $modelObject = Get-OrCreateObject $settings 'model'
  Set-ObjectProperty $modelObject 'name' $Model
  Write-Utf8File $settingsPath (($settings | ConvertTo-Json -Depth 100) + "`r`n")

  $envValues = @{
    GEMINI_API_KEY = $ApiKey
    GOOGLE_GEMINI_BASE_URL = $BaseUrl
    GEMINI_MODEL = $Model
  }
  Update-EnvFile (Join-Path $Directory '.env') $envValues $Stamp
}

function Get-YamlIndent([string]$Line) {
  if ([string]::IsNullOrWhiteSpace($Line)) {
    return -1
  }
  return $Line.Length - $Line.TrimStart(' ').Length
}

function Test-YamlKey([string]$Line, [int]$Indent, [string]$Key) {
  if ((Get-YamlIndent $Line) -ne $Indent) {
    return $false
  }
  $trimmed = $Line.Trim()
  $separator = $trimmed.IndexOf(':')
  if ($separator -lt 0) {
    return $false
  }
  $name = $trimmed.Substring(0, $separator).Trim().Trim("'`"")
  return $name -eq $Key
}

function Test-EffectiveLine([string]$Line) {
  return -not [string]::IsNullOrWhiteSpace($Line) -and -not $Line.TrimStart().StartsWith('#')
}

function Get-ActiveBlockEnd($Lines, [int]$Start, [int]$Limit, [int]$ParentIndent) {
  for ($index = $Start + 1; $index -lt $Limit; $index++) {
    if (-not (Test-EffectiveLine $Lines[$index])) {
      continue
    }
    if ((Get-YamlIndent $Lines[$index]) -le $ParentIndent) {
      return $index
    }
  }
  return $Limit
}

function Get-TopLevelEntries($Lines) {
  $starts = New-Object System.Collections.Generic.List[int]
  for ($index = 0; $index -lt $Lines.Count; $index++) {
    if ($Lines[$index].StartsWith('-')) {
      $starts.Add($index)
    }
  }
  $entries = @()
  for ($index = 0; $index -lt $starts.Count; $index++) {
    $end = if ($index + 1 -lt $starts.Count) { $starts[$index + 1] } else { $Lines.Count }
    $entries += [pscustomobject]@{ Start = $starts[$index]; End = $end }
  }
  return $entries
}

function Find-DshEntry($Lines, [string]$Id) {
  foreach ($entry in (Get-TopLevelEntries $Lines)) {
    if ((Get-DshEntryId $Lines $entry) -eq $Id) {
      return $entry
    }
  }
  return $null
}

function Get-DshEntryId($Lines, $Entry) {
  $first = [regex]::Match($Lines[$Entry.Start], '^-\s+id\s*:\s*([^\s#]+)')
  if ($first.Success) {
    return $first.Groups[1].Value.Trim("'").Trim('"')
  }
  for ($index = $Entry.Start + 1; $index -lt $Entry.End; $index++) {
    if (-not (Test-YamlKey $Lines[$index] 2 'id')) {
      continue
    }
    return $Lines[$index].Trim().Substring(3).Trim().Trim("'").Trim('"')
  }
  return $null
}

function Test-DshEntryConfig($Lines, $Entry) {
  for ($index = $Entry.Start + 1; $index -lt $Entry.End; $index++) {
    if (-not (Test-YamlKey $Lines[$index] 2 'config')) {
      continue
    }
    $separator = $Lines[$index].IndexOf(':')
    $value = $Lines[$index].Substring($separator + 1).Split('#')[0].Trim()
    if (-not [string]::IsNullOrWhiteSpace($value) -and $value -notin @('null', '~')) {
      return $true
    }
    for ($nested = $index + 1; $nested -lt $Entry.End; $nested++) {
      if ((Test-EffectiveLine $Lines[$nested]) -and (Get-YamlIndent $Lines[$nested]) -gt 2) {
        return $true
      }
    }
    return $false
  }
  return $false
}

function Assert-DshProvidersNotShadowed([string]$DshHome) {
  $path = Join-Path $DshHome 'cordis.patch.yml'
  if (-not (Test-Path -LiteralPath $path)) {
    return
  }
  $text = [IO.File]::ReadAllText($path)
  if ([string]::IsNullOrWhiteSpace($text)) {
    return
  }
  $lines = New-Object System.Collections.Generic.List[string]
  foreach ($line in (($text -replace "`r`n", "`n") -replace "`r", "`n").Split("`n")) {
    $lines.Add($line)
  }
  foreach ($entry in (Get-TopLevelEntries $lines)) {
    if ((Get-DshEntryId $lines $entry) -eq 'llm-pi-ai' -and (Test-DshEntryConfig $lines $entry)) {
      throw "供应商被 home 级补丁覆盖，请先在该文件里移除 llm-pi-ai 的 config：$path"
    }
  }
}

function ConvertTo-YamlScalar([string]$Value) {
  return "'" + $Value.Replace("'", "''") + "'"
}

function Get-DshProviderLines([string]$BaseUrl) {
  return @(
    "      $DshProviderId`:",
    "        displayName: $ProviderName",
    "        apiKeyEnv: $DshCredentialRef",
    '        api: openai-completions',
    "        baseURL: $(ConvertTo-YamlScalar ($BaseUrl + '/v1'))",
    '        compat:',
    '          supportsDeveloperRole: false',
    '          maxTokensField: max_tokens',
    '        models:',
    "          - id: $DshModel"
  )
}

function Get-DshLlmEntryLines([string]$BaseUrl) {
  return @(
    '- id: llm-pi-ai',
    "  name: '@deepseek-ai/dsh-llm-pi-ai'",
    '  config:',
    '    providers:'
  ) + (Get-DshProviderLines $BaseUrl)
}

function Get-DshDefaultEntryLines {
  return @(
    '- id: agent-default-model',
    "  name: '@deepseek-ai/dsh-agent-default-model'",
    '  config:',
    "    provider: $DshProviderId",
    "    model: $DshModel"
  )
}

function Update-DshLlmEntry($Lines, [string]$BaseUrl) {
  $entry = Find-DshEntry $Lines 'llm-pi-ai'
  if ($null -eq $entry) {
    $Lines.AddRange([string[]](Get-DshLlmEntryLines $BaseUrl))
    return
  }
  $config = $null
  for ($index = $entry.Start + 1; $index -lt $entry.End; $index++) {
    if (Test-YamlKey $Lines[$index] 2 'config') {
      $config = $index
      break
    }
  }
  if ($null -eq $config -or $Lines[$config].Trim() -ne 'config:') {
    $Lines.RemoveRange($entry.Start, $entry.End - $entry.Start)
    $Lines.InsertRange($entry.Start, [string[]](Get-DshLlmEntryLines $BaseUrl))
    return
  }
  $configEnd = Get-ActiveBlockEnd $Lines $config $entry.End 2
  $providers = $null
  for ($index = $config + 1; $index -lt $configEnd; $index++) {
    if (Test-YamlKey $Lines[$index] 4 'providers') {
      $providers = $index
      break
    }
  }
  if ($null -eq $providers) {
    $insertAt = $configEnd
    while ($insertAt -gt $config + 1 -and [string]::IsNullOrWhiteSpace($Lines[$insertAt - 1])) {
      $insertAt--
    }
    $Lines.InsertRange($insertAt, [string[]](@('    providers:') + (Get-DshProviderLines $BaseUrl)))
    return
  }
  if ($Lines[$providers].Trim() -ne 'providers:') {
    $Lines[$providers] = '    providers:'
  }
  $providersEnd = Get-ActiveBlockEnd $Lines $providers $configEnd 4
  $provider = $null
  for ($index = $providers + 1; $index -lt $providersEnd; $index++) {
    if (Test-YamlKey $Lines[$index] 6 $DshProviderId) {
      $provider = $index
      break
    }
  }
  if ($null -ne $provider) {
    $providerEnd = Get-ActiveBlockEnd $Lines $provider $providersEnd 6
    $Lines.RemoveRange($provider, $providerEnd - $provider)
    $Lines.InsertRange($provider, [string[]](Get-DshProviderLines $BaseUrl))
    return
  }
  $insertAt = $providersEnd
  while ($insertAt -gt $providers + 1 -and [string]::IsNullOrWhiteSpace($Lines[$insertAt - 1])) {
    $insertAt--
  }
  $Lines.InsertRange($insertAt, [string[]](Get-DshProviderLines $BaseUrl))
}

function Update-DshDefaultEntry($Lines) {
  $entry = Find-DshEntry $Lines 'agent-default-model'
  if ($null -eq $entry) {
    $Lines.AddRange([string[]](Get-DshDefaultEntryLines))
    return
  }
  $config = $null
  for ($index = $entry.Start + 1; $index -lt $entry.End; $index++) {
    if (Test-YamlKey $Lines[$index] 2 'config') {
      $config = $index
      break
    }
  }
  if ($null -eq $config -or $Lines[$config].Trim() -ne 'config:') {
    $Lines.RemoveRange($entry.Start, $entry.End - $entry.Start)
    $Lines.InsertRange($entry.Start, [string[]](Get-DshDefaultEntryLines))
    return
  }
  $configEnd = Get-ActiveBlockEnd $Lines $config $entry.End 2
  foreach ($pair in @(@('provider', $DshProviderId), @('model', $DshModel))) {
    $existing = $null
    for ($index = $config + 1; $index -lt $configEnd; $index++) {
      if (Test-YamlKey $Lines[$index] 4 $pair[0]) {
        $existing = $index
        break
      }
    }
    $replacement = "    $($pair[0]): $($pair[1])"
    if ($null -eq $existing) {
      $Lines.Insert($configEnd, $replacement)
      $configEnd++
    } else {
      $Lines[$existing] = $replacement
    }
  }
}

function Update-DshPatch([string]$Path, [string]$BaseUrl, [string]$Stamp, [bool]$RestoreHeadlessCredentials = $false) {
  Backup-File $Path $Stamp
  $text = if (Test-Path -LiteralPath $Path) { [IO.File]::ReadAllText($Path) } else { "[]`n" }
  $lines = New-Object System.Collections.Generic.List[string]
  foreach ($line in (($text -replace "`r`n", "`n") -replace "`r", "`n").Split("`n")) {
    $lines.Add($line)
  }
  for ($index = $lines.Count - 1; $index -ge 0; $index--) {
    if ($lines[$index].Trim() -eq '[]' -and $lines[$index].Length -eq $lines[$index].TrimStart(' ').Length) {
      $lines.RemoveAt($index)
    }
  }
  Update-DshLlmEntry $lines $BaseUrl
  Update-DshDefaultEntry $lines
  if ($RestoreHeadlessCredentials -and $null -eq (Find-DshEntry $lines 'credentials')) {
    $lines.AddRange([string[]](@('- id: credentials', '  disabled: false')))
  }
  Write-Utf8File $Path (($lines -join "`n").TrimEnd() + "`n")
}

function Update-DshCredentials([string]$Path, [string]$ApiKey, [string]$Stamp) {
  Backup-File $Path $Stamp
  $text = if (Test-Path -LiteralPath $Path) { [IO.File]::ReadAllText($Path) } else { '' }
  $lines = New-Object System.Collections.Generic.List[string]
  foreach ($line in (($text -replace "`r`n", "`n") -replace "`r", "`n").Split("`n")) {
    $lines.Add($line)
  }
  $value = ConvertTo-YamlScalar $ApiKey
  $hasContent = $false
  foreach ($line in $lines) {
    if (-not [string]::IsNullOrWhiteSpace($line)) {
      $hasContent = $true
      break
    }
  }
  if (-not $hasContent) {
    Write-Utf8File $Path ("version: 1`n`nrefs:`n  $DshCredentialRef`: $value`n")
    return
  }

  $refs = $null
  for ($index = 0; $index -lt $lines.Count; $index++) {
    if (Test-YamlKey $lines[$index] 0 'refs') {
      $refs = $index
      break
    }
  }
  if ($null -ne $refs) {
    $refsEnd = Get-ActiveBlockEnd $lines $refs $lines.Count 0
    $existing = $null
    for ($index = $refs + 1; $index -lt $refsEnd; $index++) {
      if (Test-YamlKey $lines[$index] 2 $DshCredentialRef) {
        $existing = $index
        break
      }
    }
    $replacement = "  $DshCredentialRef`: $value"
    if ($null -eq $existing) {
      $insertAt = $refsEnd
      while ($insertAt -gt $refs + 1 -and [string]::IsNullOrWhiteSpace($lines[$insertAt - 1])) {
        $insertAt--
      }
      $lines.Insert($insertAt, $replacement)
    } else {
      $lines[$existing] = $replacement
    }
  } else {
    $structured = $false
    foreach ($line in $lines) {
      if ((Test-YamlKey $line 0 'version') -or (Test-YamlKey $line 0 'records')) {
        $structured = $true
        break
      }
    }
    if ($structured) {
      $records = $null
      for ($index = 0; $index -lt $lines.Count; $index++) {
        if (Test-YamlKey $lines[$index] 0 'records') {
          $records = $index
          break
        }
      }
      $insertAt = if ($null -eq $records) { $lines.Count } else { $records }
      while ($insertAt -gt 0 -and [string]::IsNullOrWhiteSpace($lines[$insertAt - 1])) {
        $insertAt--
      }
      $Lines.InsertRange($insertAt, [string[]](@('refs:', "  $DshCredentialRef`: $value", '')))
    } else {
      $existing = $null
      for ($index = 0; $index -lt $lines.Count; $index++) {
        if (Test-YamlKey $lines[$index] 0 $DshCredentialRef) {
          $existing = $index
          break
        }
      }
      if ($null -eq $existing) {
        $lines.Add("$DshCredentialRef`: $value")
      } else {
        $lines[$existing] = "$DshCredentialRef`: $value"
      }
    }
  }
  Write-Utf8File $Path (($lines -join "`n").TrimEnd() + "`n")
}

function Update-DshConfig([string]$DshHome, [string]$BaseUrl, [string]$ApiKey, [string]$Stamp) {
  Assert-DshProvidersNotShadowed $DshHome
  $profilesRoot = Join-Path $DshHome 'profiles'
  $profilePaths = @(
    (Join-Path $profilesRoot 'web'),
    (Join-Path $profilesRoot 'desktop')
  )
  foreach ($name in @('headless', 'acp')) {
    $path = Join-Path $profilesRoot $name
    if (Test-Path -LiteralPath $path) {
      $profilePaths += $path
    }
  }

  $credentialsPath = Join-Path $DshHome '.credentials.yaml'
  Update-DshCredentials $credentialsPath $ApiKey $Stamp
  $patchPaths = @()
  foreach ($profilePath in $profilePaths) {
    Ensure-Directory $profilePath
    $patchPath = Join-Path $profilePath 'cordis.patch.yml'
    Update-DshPatch $patchPath $BaseUrl $Stamp ((Split-Path -Leaf $profilePath) -eq 'headless')
    $patchPaths += $patchPath
  }
  return [pscustomobject]@{ CredentialsPath = $credentialsPath; PatchPaths = $patchPaths }
}

function Normalize-BaseUrl([string]$Value) {
  $normalized = $Value.Trim()
  while ($normalized.EndsWith('/')) {
    $normalized = $normalized.Substring(0, $normalized.Length - 1)
  }
  if ($normalized.EndsWith('/v1', [StringComparison]::OrdinalIgnoreCase)) {
    $normalized = $normalized.Substring(0, $normalized.Length - 3).TrimEnd('/')
  }
  return $normalized
}

try {
  Write-Host ''
  Write-Host "$ProviderName - Windows 客户端配置" -ForegroundColor White
  Write-Host '为 NekoAI 配置 Claude Code、Codex CLI、Gemini CLI 或 DeepSeek Harness。' -ForegroundColor DarkGray

  Write-Heading '第 1 步 - 选择客户端'
  Write-Host '  1. Claude Code'
  Write-Host '  2. Codex CLI'
  Write-Host '  3. Gemini CLI'
  Write-Host '  4. DeepSeek Harness'
  $choice = ''
  while ($choice -notin @('1', '2', '3', '4')) {
    $choice = (Read-Host '  请选择 1-4').Trim()
  }

  Write-Heading '第 2 步 - 粘贴 API Key'
  $secureKey = Read-Host '  API Key（输入已隐藏）' -AsSecureString
  $bstr = [IntPtr]::Zero
  try {
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
    $apiKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    if ($bstr -ne [IntPtr]::Zero) {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
  }
  $apiKey = $apiKey.Trim()
  if ([string]::IsNullOrWhiteSpace($apiKey)) {
    throw 'API Key 不能为空。'
  }
  if ($apiKey.StartsWith('Bearer ', [StringComparison]::OrdinalIgnoreCase)) {
    $apiKey = $apiKey.Substring(7).Trim()
  }
  if (-not $apiKey.StartsWith('sk-', [StringComparison]::OrdinalIgnoreCase)) {
    $apiKey = 'sk-' + $apiKey
  } elseif (-not $apiKey.StartsWith('sk-', [StringComparison]::Ordinal)) {
    $apiKey = 'sk-' + $apiKey.Substring(3)
  }

  $baseUrl = Normalize-BaseUrl $GatewayUrl
  Write-Detail "网关地址：$baseUrl"
  $parsedUrl = $null
  if (-not [Uri]::TryCreate($baseUrl, [UriKind]::Absolute, [ref]$parsedUrl) -or ($parsedUrl.Scheme -ne 'http' -and $parsedUrl.Scheme -ne 'https')) {
    throw '请输入完整的 http:// 或 https:// 网关地址。'
  }

  Write-Host ''
  Write-Host '正在写入配置...' -ForegroundColor Cyan
  Write-Host 'API Key 将以明文形式保存在所选客户端的配置文件中。' -ForegroundColor DarkGray
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'

  if ($choice -eq '1') {
    $directory = Join-Path $env:USERPROFILE '.claude'
    Ensure-Directory $directory
    $path = Join-Path $directory 'settings.json'
    Update-ClaudeSettings $path $baseUrl $apiKey $stamp
    Write-Host ''
    Write-Host 'Claude Code 配置完成。' -ForegroundColor Green
    Write-Detail "配置文件：$path"
    Write-Detail '请重启 Claude Code 以应用配置。'
  } elseif ($choice -eq '2') {
    $codexHome = [string]$env:CODEX_HOME
    if ([string]::IsNullOrWhiteSpace($codexHome)) {
      $codexHome = Join-Path $env:USERPROFILE '.codex'
    }
    Ensure-Directory $codexHome
    $path = Join-Path $codexHome 'config.toml'
    Update-CodexConfig $path $baseUrl $apiKey $stamp
    Write-Host ''
    Write-Host 'Codex CLI 配置完成。' -ForegroundColor Green
    Write-Detail "配置文件：$path"
    Write-Detail '请打开新终端并运行 codex 以应用配置。'
  } elseif ($choice -eq '3') {
    $directory = Join-Path $env:USERPROFILE '.gemini'
    Update-GeminiConfig $directory $baseUrl $apiKey 'gemini-2.5-pro' $stamp
    Write-Host ''
    Write-Host 'Gemini CLI 配置完成。' -ForegroundColor Green
    Write-Detail "配置文件：$(Join-Path $directory 'settings.json')"
    Write-Detail "环境文件：$(Join-Path $directory '.env')"
    Write-Detail '请重启 Gemini CLI 以应用配置。'
  } else {
    $dshHome = [string]$env:DSH_HOME
    if ([string]::IsNullOrWhiteSpace($dshHome)) {
      $dshHome = Join-Path $env:USERPROFILE '.dsh'
    }
    Ensure-Directory $dshHome
    $result = Update-DshConfig $dshHome $baseUrl $apiKey $stamp
    Write-Host ''
    Write-Host 'DeepSeek Harness 配置完成。' -ForegroundColor Green
    Write-Detail "凭据文件：$($result.CredentialsPath)"
    foreach ($patchPath in $result.PatchPaths) {
      Write-Detail "配置文件：$patchPath"
    }
    Write-Detail '请重启 DSH 以应用配置。'
  }

  Write-Host ''
  Write-Host '全部完成。备份文件已保存在原配置旁边。' -ForegroundColor Green
  exit 0
} catch {
  Write-Host ''
  Write-Host ('配置失败：' + $_.Exception.Message) -ForegroundColor Red
  exit 1
}
