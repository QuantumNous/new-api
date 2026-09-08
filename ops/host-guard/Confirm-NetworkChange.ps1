param([Parameter(Mandatory)][ValidatePattern('^[0-9]{8}T[0-9]{6}Z-[0-9a-f]{8}$')][string]$ChangeId)
$ErrorActionPreference = 'Stop'
# A NEW SSH transport proves inbound reachability. Never multiplex an old session.
$rescueKey = Join-Path $env:USERPROFILE '.ssh/ubuntu_140_245_89_202_rdp'
$sshArgs = @('-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','ConnectTimeout=10','-o','ControlMaster=no','-o','ControlPath=none','-i',$rescueKey,'ubuntu@140.245.89.202')
$receiptText = & ssh @sshArgs "sudo -n /usr/local/sbin/hardy-network-guard verify $ChangeId"
if ($LASTEXITCODE -ne 0) { throw '新 SSH 连接或服务端验证失败；不要确认，等待自动回退。' }
$receipt = $receiptText | ConvertFrom-Json
$response = Invoke-WebRequest 'https://hardy777.top/api/status' -TimeoutSec 15
$body = $response.Content | ConvertFrom-Json
if ($response.StatusCode -ne 200 -or $body.data.system_name -ne 'Hardy') { throw '公网接口验证失败；不要确认，等待自动回退。' }
if ($receipt.token -notmatch '^[0-9a-f]{48}$') { throw '无效验收凭据。' }
& ssh @sshArgs "sudo -n /usr/local/sbin/hardy-network-guard confirm $ChangeId $($receipt.token)"
if ($LASTEXITCODE -ne 0) { throw '确认失败，请查询回退状态。' }
