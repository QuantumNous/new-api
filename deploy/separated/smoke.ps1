# Same-origin separated stack smoke checks (Windows PowerShell).
# Usage:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\deploy\separated\smoke.ps1
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\deploy\separated\smoke.ps1 -FrontendBase http://127.0.0.1:8080
param(
    [string]$FrontendBase = 'http://127.0.0.1:8080'
)

$ErrorActionPreference = 'Stop'
$FrontendBase = $FrontendBase.TrimEnd('/')
$pass = 0
$fail = 0

function Invoke-Check {
    param(
        [string]$Name,
        [scriptblock]$Body
    )
    try {
        & $Body
        Write-Host "PASS  $Name"
        $script:pass++
    } catch {
        Write-Host "FAIL  $Name : $($_.Exception.Message)"
        $script:fail++
    }
}

Write-Host "Smoke against $FrontendBase"

Invoke-Check 'frontend-healthz' {
    $r = Invoke-WebRequest -UseBasicParsing -Uri "$FrontendBase/frontend-healthz" -TimeoutSec 15
    if ($r.StatusCode -ne 200) { throw "status $($r.StatusCode)" }
    if ($r.Content -notmatch '"status"\s*:\s*"ok"') { throw 'missing status ok' }
}

Invoke-Check 'spa index' {
    $r = Invoke-WebRequest -UseBasicParsing -Uri "$FrontendBase/" -TimeoutSec 15
    if ($r.StatusCode -ne 200) { throw "status $($r.StatusCode)" }
}

Invoke-Check 'api status via proxy' {
    $r = Invoke-WebRequest -UseBasicParsing -Uri "$FrontendBase/api/status" -TimeoutSec 15
    if ($r.StatusCode -ne 200) { throw "status $($r.StatusCode)" }
    if ($r.Content -notmatch '\{') { throw 'non-json body' }
}

Invoke-Check 'v1 without token is 401' {
    try {
        Invoke-WebRequest -UseBasicParsing -Uri "$FrontendBase/v1/models" -TimeoutSec 15 | Out-Null
        throw 'expected 401'
    } catch {
        $resp = $_.Exception.Response
        if (-not $resp) { throw $_ }
        $code = [int]$resp.StatusCode
        if ($code -ne 401) { throw "status $code" }
    }
}

Invoke-Check 'readyz via proxy' {
    $r = Invoke-WebRequest -UseBasicParsing -Uri "$FrontendBase/readyz" -TimeoutSec 15
    if ($r.StatusCode -ne 200) { throw "status $($r.StatusCode)" }
    if ($r.Content -notmatch '"status"') { throw 'missing status field' }
}

Invoke-Check 'metrics blocked on edge' {
    try {
        Invoke-WebRequest -UseBasicParsing -Uri "$FrontendBase/metrics" -TimeoutSec 15 | Out-Null
        throw 'expected 404'
    } catch {
        $resp = $_.Exception.Response
        if (-not $resp) { throw $_ }
        $code = [int]$resp.StatusCode
        if ($code -ne 404) { throw "status $code" }
    }
}

Write-Host ""
Write-Host "passed=$pass failed=$fail"
if ($fail -ne 0) { exit 1 }
