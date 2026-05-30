$ErrorActionPreference = "Stop"

$base = "http://127.0.0.1:3000"
$adminUser = "root"
$adminPass = "Test12345!"
$dashKey = "sk-65cef572bc6e4b06ab77b5e768bac6c2"
$resultPath = "F:\aicoding\newapi\work\test_tts_billing_result.json"

function Invoke-Json {
  param(
    [string]$Method,
    [string]$Url,
    $Body = $null,
    $WebSession = $null,
    [hashtable]$Headers = @{}
  )

  $params = @{
    Method = $Method
    Uri = $Url
    Headers = $Headers
    UseBasicParsing = $true
  }
  if ($null -ne $WebSession) {
    $params.WebSession = $WebSession
  }
  if ($null -ne $Body) {
    $params.ContentType = "application/json"
    $params.Body = ($Body | ConvertTo-Json -Depth 20 -Compress)
  }

  $resp = Invoke-WebRequest @params
  if ([string]::IsNullOrWhiteSpace($resp.Content)) {
    return $null
  }
  return ($resp.Content | ConvertFrom-Json)
}

$setupStatus = Invoke-Json -Method "GET" -Url "$base/api/setup"
if (-not $setupStatus.data.status) {
  $setupResp = Invoke-Json -Method "POST" -Url "$base/api/setup" -Body @{
    username = $adminUser
    password = $adminPass
    confirmPassword = $adminPass
    SelfUseModeEnabled = $false
    DemoSiteEnabled = $false
  }
} else {
  $setupResp = $setupStatus
}

$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$loginResp = Invoke-Json -Method "POST" -Url "$base/api/user/login" -WebSession $session -Body @{
  username = $adminUser
  password = $adminPass
}

$userId = [int]$loginResp.data.id
$authHeaders = @{ "New-Api-User" = "$userId" }

$selfBefore = Invoke-Json -Method "GET" -Url "$base/api/user/self" -WebSession $session -Headers $authHeaders

$channelName = "Ali Qwen TTS Billing Test"
$allChannels = Invoke-Json -Method "GET" -Url "$base/api/channel/?p=0" -WebSession $session -Headers $authHeaders
$existingChannels = @($allChannels.data.items | Where-Object { $_.name -eq $channelName })
foreach ($ch in $existingChannels) {
  Invoke-WebRequest -Method "DELETE" -Uri "$base/api/channel/$($ch.id)" -Headers $authHeaders -WebSession $session -UseBasicParsing | Out-Null
}

$addChannelResp = Invoke-Json -Method "POST" -Url "$base/api/channel/" -WebSession $session -Headers $authHeaders -Body @{
  mode = "single"
  channel = @{
    name = $channelName
    type = 17
    key = $dashKey
    base_url = "https://dashscope.aliyuncs.com"
    models = "qwen3-tts-flash,qwen-tts,qwen-tts-latest,qwen-voice-enrollment"
    group = "default"
    status = 1
    priority = 0
    weight = 0
    other = ""
    setting = ""
  }
}

$channelsAfter = Invoke-Json -Method "GET" -Url "$base/api/channel/?p=0" -WebSession $session -Headers $authHeaders
$channel = @($channelsAfter.data.items | Where-Object { $_.name -eq $channelName }) | Select-Object -First 1

$tokenName = "tts-billing-test-token"
$allTokensBefore = Invoke-Json -Method "GET" -Url "$base/api/token/?p=0" -WebSession $session -Headers $authHeaders
$existingTokens = @($allTokensBefore.data.items | Where-Object { $_.name -eq $tokenName })
foreach ($tk in $existingTokens) {
  Invoke-WebRequest -Method "DELETE" -Uri "$base/api/token/$($tk.id)" -Headers $authHeaders -WebSession $session -UseBasicParsing | Out-Null
}

$addTokenResp = Invoke-Json -Method "POST" -Url "$base/api/token/" -WebSession $session -Headers $authHeaders -Body @{
  name = $tokenName
  remain_quota = 1000000
  unlimited_quota = $false
  expired_time = -1
  model_limits_enabled = $false
  model_limits = ""
  group = "default"
  cross_group_retry = $false
}

$tokensAfter = Invoke-Json -Method "GET" -Url "$base/api/token/?p=0" -WebSession $session -Headers $authHeaders
$token = @($tokensAfter.data.items | Where-Object { $_.name -eq $tokenName }) | Select-Object -First 1
$tokenKeyResp = Invoke-Json -Method "POST" -Url "$base/api/token/$($token.id)/key" -WebSession $session -Headers $authHeaders
$apiToken = $tokenKeyResp.data.key

$selfMid = Invoke-Json -Method "GET" -Url "$base/api/user/self" -WebSession $session -Headers $authHeaders
$quotaBefore = $selfMid.data.quota

$ttsHeaders = @{ "Authorization" = "Bearer $apiToken" }
$ttsBody = @{
  model = "qwen3-tts-flash"
  input = "Hello from new-api billing verification."
  voice = "Cherry"
  response_format = "mp3"
  metadata = @{ language_type = "English" }
}

$ttsResp = Invoke-WebRequest -Method "POST" -Uri "$base/v1/audio/speech" -Headers $ttsHeaders -ContentType "application/json" -Body ($ttsBody | ConvertTo-Json -Depth 10 -Compress) -UseBasicParsing -TimeoutSec 120

Start-Sleep -Seconds 3
$selfAfter = Invoke-Json -Method "GET" -Url "$base/api/user/self" -WebSession $session -Headers $authHeaders
$quotaAfter = $selfAfter.data.quota
$logs = Invoke-Json -Method "GET" -Url "$base/api/log/?p=0" -WebSession $session -Headers $authHeaders
$latestLog = $logs.data.items | Where-Object { $_.model_name -eq "qwen3-tts-flash" } | Select-Object -First 1

$result = [ordered]@{
  setup_success = $setupResp.success
  login_success = $loginResp.success
  user_id = $userId
  quota_before = $quotaBefore
  add_channel = $addChannelResp.success
  channel_id = $channel.id
  add_token = $addTokenResp.success
  token_id = $token.id
  tts_status = $ttsResp.StatusCode
  tts_content_type = $ttsResp.Headers["Content-Type"]
  tts_bytes = $ttsResp.RawContentLength
  quota_after = $quotaAfter
  quota_delta = ($quotaBefore - $quotaAfter)
  latest_log = $latestLog
}

$result | ConvertTo-Json -Depth 20 | Set-Content -Path $resultPath -Encoding UTF8
Write-Output "DONE"
