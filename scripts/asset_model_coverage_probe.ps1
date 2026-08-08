param(
    [Parameter(Mandatory = $true)]
    [string]$ImagePath1,

    [Parameter(Mandatory = $true)]
    [string]$ImagePath2,

    [ValidateSet("fast", "pro")]
    [string]$ModelSlot = "fast"
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

$script:DeadlineUtc = [DateTime]::UtcNow.AddMinutes(10)
$script:MaxImageUploadBytes = 20 * 1024 * 1024

function Get-RequiredEnv {
    param([string]$Name)
    $value = [Environment]::GetEnvironmentVariable($Name)
    if ([string]::IsNullOrWhiteSpace($value)) {
        throw "Missing required environment variable: $Name"
    }
    return $value.Trim()
}

function Assert-BeforeDeadline {
    param([string]$Phase)
    if ([DateTime]::UtcNow -ge $script:DeadlineUtc) {
        throw "Probe deadline exceeded during $Phase"
    }
}

function Get-DeadlineTimeoutSec {
    param([string]$Phase)
    $remaining = [int][Math]::Floor(($script:DeadlineUtc - [DateTime]::UtcNow).TotalSeconds)
    if ($remaining -le 0) {
        throw "$Phase failed: probe deadline exceeded"
    }
    return $remaining
}

function Get-ElapsedMs {
    param([DateTime]$StartUtc)
    return [int64]([DateTime]::UtcNow - $StartUtc).TotalMilliseconds
}

function Get-PublicProperty {
    param(
        [object]$Object,
        [string]$Name
    )

    if ($null -eq $Object) {
        return $null
    }
    if ($Object -is [System.Collections.IDictionary]) {
        if ($Object.Contains($Name)) {
            return $Object[$Name]
        }
        return $null
    }

    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property) {
        return $null
    }
    return $property.Value
}

function New-ProbeError {
    param(
        [string]$Phase,
        [object]$ErrorRecord
    )

    $statusCode = $null
    try {
        if ($ErrorRecord.Exception.Response -and $ErrorRecord.Exception.Response.StatusCode) {
            $statusCode = [int]$ErrorRecord.Exception.Response.StatusCode
        }
    } catch {
        $statusCode = $null
    }

    if ($statusCode) {
        return "$Phase failed with HTTP $statusCode"
    }
    return "$Phase failed"
}

function Invoke-JsonRequest {
    param(
        [ValidateSet("GET", "POST")]
        [string]$Method,
        [string]$Uri,
        [hashtable]$Headers,
        [string]$Phase,
        [object]$Body = $null
    )

    try {
        $timeoutSec = Get-DeadlineTimeoutSec $Phase
        if ($null -eq $Body) {
            return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $Headers -TimeoutSec $timeoutSec
        }
        $json = $Body | ConvertTo-Json -Depth 20 -Compress
        return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $Headers -ContentType "application/json" -Body $json -TimeoutSec $timeoutSec
    } catch {
        throw (New-ProbeError $Phase $_)
    }
}

function Invoke-CompatibleWebRequest {
    param(
        [ValidateSet("GET", "POST")]
        [string]$Method,
        [string]$Uri,
        [hashtable]$Headers,
        [int]$TimeoutSec,
        [string]$ContentType = "",
        [object]$Body = $null,
        [hashtable]$Form = $null
    )

    $request = @{
        Method = $Method
        Uri = $Uri
        Headers = $Headers
        TimeoutSec = $TimeoutSec
    }

    $webRequestCommand = Get-Command Invoke-WebRequest
    if ($webRequestCommand.Parameters.ContainsKey("UseBasicParsing")) {
        $request.UseBasicParsing = $true
    }
    if ($Form) {
        $request.Form = $Form
    }
    if (-not [string]::IsNullOrWhiteSpace($ContentType)) {
        $request.ContentType = $ContentType
    }
    if ($null -ne $Body) {
        $request.Body = $Body
    }

    return Invoke-WebRequest @request
}

function ConvertFrom-UploadResponse {
    param([object]$Response)
    if ($Response -is [string]) {
        return $Response | ConvertFrom-Json
    }
    $content = Get-PublicProperty $Response "Content"
    if (-not [string]::IsNullOrWhiteSpace([string]$content)) {
        return $content | ConvertFrom-Json
    }
    return $Response
}

function Get-ImageMimeType {
    param([System.IO.FileInfo]$File)
    switch ($File.Extension.ToLowerInvariant()) {
        ".jpg" { return "image/jpeg" }
        ".jpeg" { return "image/jpeg" }
        ".png" { return "image/png" }
        ".webp" { return "image/webp" }
        ".gif" { return "image/gif" }
        ".bmp" { return "image/bmp" }
        default { return "application/octet-stream" }
    }
}

function Assert-ProbeImageFileAllowed {
    param([System.IO.FileInfo]$File)

    if ($File.Length -gt $script:MaxImageUploadBytes) {
        throw "asset upload file too large"
    }

    $mimeType = Get-ImageMimeType $File
    if (-not $mimeType.StartsWith("image/")) {
        throw "asset upload media type unsupported"
    }
}

function Invoke-AssetUploadWithManualMultipart {
    param(
        [string]$Uri,
        [hashtable]$Headers,
        [System.IO.FileInfo]$File
    )

    $timeoutSec = Get-DeadlineTimeoutSec "asset upload"
    Assert-ProbeImageFileAllowed $File
    $mimeType = Get-ImageMimeType $File
    $boundary = "----flatkey-probe-" + ([Guid]::NewGuid().ToString("N"))
    $lineBreak = "`r`n"
    $prefix =
        "--$boundary$lineBreak" +
        "Content-Disposition: form-data; name=`"asset_type`"$lineBreak$lineBreak" +
        "Image$lineBreak" +
        "--$boundary$lineBreak" +
        "Content-Disposition: form-data; name=`"file`"; filename=`"$($File.Name)`"$lineBreak" +
        "Content-Type: $mimeType$lineBreak$lineBreak"
    $suffix = "$lineBreak--$boundary--$lineBreak"
    $prefixBytes = [System.Text.Encoding]::ASCII.GetBytes($prefix)
    $fileBytes = [System.IO.File]::ReadAllBytes($File.FullName)
    $suffixBytes = [System.Text.Encoding]::ASCII.GetBytes($suffix)
    $body = New-Object byte[] ($prefixBytes.Length + $fileBytes.Length + $suffixBytes.Length)
    [Buffer]::BlockCopy($prefixBytes, 0, $body, 0, $prefixBytes.Length)
    [Buffer]::BlockCopy($fileBytes, 0, $body, $prefixBytes.Length, $fileBytes.Length)
    [Buffer]::BlockCopy($suffixBytes, 0, $body, $prefixBytes.Length + $fileBytes.Length, $suffixBytes.Length)

    return Invoke-CompatibleWebRequest -Method POST -Uri $Uri -Headers $Headers -ContentType "multipart/form-data; boundary=$boundary" -Body $body -TimeoutSec $timeoutSec
}

function Invoke-AssetUpload {
    param(
        [string]$BaseUrl,
        [hashtable]$Headers,
        [string]$Path
    )

    try {
        $file = Get-Item -LiteralPath $Path
        Assert-ProbeImageFileAllowed $file
        $uri = "$BaseUrl/v1/assets/upload"
        $start = [DateTime]::UtcNow
        $webRequestCommand = Get-Command Invoke-WebRequest
        if ($webRequestCommand.Parameters.ContainsKey("Form")) {
            $timeoutSec = Get-DeadlineTimeoutSec "asset upload"
            $response = Invoke-CompatibleWebRequest -Method POST -Uri $uri -Headers $Headers -Form @{
                file = $file
                asset_type = "Image"
            } -TimeoutSec $timeoutSec
        } else {
            $response = Invoke-AssetUploadWithManualMultipart -Uri $uri -Headers $Headers -File $file
        }
        $uploadMs = Get-ElapsedMs $start
        $json = ConvertFrom-UploadResponse $response
        $assetId = Get-PublicProperty $json "id"
        if ([string]::IsNullOrWhiteSpace([string]$assetId)) {
            throw "asset upload response did not include public id"
        }
        return [ordered]@{
            id = [string]$assetId
            bytes = [int64]$file.Length
            upload_ms = $uploadMs
            status = $null
            terminal_ms = $null
            active_ms = $null
        }
    } catch {
        throw (New-ProbeError "asset upload" $_)
    }
}

function Set-AssetTerminalResult {
    param(
        [System.Collections.IDictionary]$Asset,
        [string]$Status,
        [DateTime]$AcceptedAtUtc
    )

    $terminalMs = Get-ElapsedMs $AcceptedAtUtc.ToUniversalTime()
    $Asset["status"] = $Status
    $Asset["terminal_ms"] = $terminalMs
    if ($Status -eq "Active") {
        $Asset["active_ms"] = $terminalMs
    } else {
        $Asset["active_ms"] = $null
    }
}

function Wait-AssetsTerminal {
    param(
        [string]$BaseUrl,
        [hashtable]$Headers,
        [System.Collections.IDictionary[]]$Assets,
        [DateTime[]]$AcceptedAtUtc
    )

    if ($Assets.Count -ne $AcceptedAtUtc.Count) {
        throw "asset status polling failed"
    }

    $terminal = New-Object bool[] $Assets.Count
    $remaining = $Assets.Count

    while ($remaining -gt 0) {
        Assert-BeforeDeadline "asset status polling"
        for ($index = 0; $index -lt $Assets.Count; $index++) {
            if ($terminal[$index]) {
                continue
            }

            $asset = $Assets[$index]
            $assetId = Get-PublicProperty $asset "id"
            $statusResponse = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/v1/assets/$assetId" -Headers $Headers -Phase "asset status"
            $status = [string](Get-PublicProperty $statusResponse "status")
            if ($status -in @("Active", "Failed", "Expired")) {
                Set-AssetTerminalResult -Asset $asset -Status $status -AcceptedAtUtc $AcceptedAtUtc[$index]
                $terminal[$index] = $true
                $remaining--
            }
        }

        if ($remaining -gt 0) {
            Start-Sleep -Seconds 1
        }
    }
}

function Get-PublicTaskId {
    param([object]$Response)
    $taskId = Get-PublicProperty $Response "task_id"
    if ($taskId) { return [string]$taskId }
    $id = Get-PublicProperty $Response "id"
    if ($id) { return [string]$id }
    $data = Get-PublicProperty $Response "data"
    $dataTaskId = Get-PublicProperty $data "task_id"
    if ($dataTaskId) { return [string]$dataTaskId }
    $dataId = Get-PublicProperty $data "id"
    if ($dataId) { return [string]$dataId }
    return ""
}

function Get-PublicTaskStatus {
    param([object]$Response)
    $status = Get-PublicProperty $Response "status"
    if ($status) { return [string]$status }
    $data = Get-PublicProperty $Response "data"
    $dataStatus = Get-PublicProperty $data "status"
    if ($dataStatus) { return [string]$dataStatus }
    return ""
}

function Test-TaskTerminalSucceeded {
    param([string]$Status)
    $normalized = $Status.Trim().ToLowerInvariant()
    return $normalized -in @("success", "completed", "succeeded")
}

function Wait-TaskTerminal {
    param(
        [string]$BaseUrl,
        [hashtable]$Headers,
        [System.Collections.IDictionary]$Task,
        [string]$TaskId,
        [DateTime]$AcceptedAtUtc
    )

    $terminalStatuses = @("SUCCESS", "FAILURE", "completed", "failed", "succeeded", "cancelled", "canceled", "expired")
    $start = $AcceptedAtUtc.ToUniversalTime()
    while ($true) {
        Assert-BeforeDeadline "task polling"
        $taskResponse = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/v1/videos/$TaskId" -Headers $Headers -Phase "task status"
        $status = Get-PublicTaskStatus $taskResponse
        $Task["status"] = $status
        if ($terminalStatuses -contains $status) {
            $Task["terminal_ms"] = Get-ElapsedMs $start
            return
        }
        Start-Sleep -Seconds 1
    }
}

$baseUrl = (Get-RequiredEnv "FLATKEY_BASE_URL").TrimEnd("/")
$apiKey = Get-RequiredEnv "FLATKEY_TEST_API_KEY"
$fastModel = Get-RequiredEnv "FAST_MODEL"
$proModel = Get-RequiredEnv "PRO_MODEL"
$selectedModel = $fastModel
if ($ModelSlot -eq "pro") {
    $selectedModel = $proModel
}

$headers = @{
    Authorization = "Bearer $apiKey"
}

$result = [ordered]@{
    model = $selectedModel
    assets = @()
    task = [ordered]@{
        create_ms = $null
        accepted = $false
        terminal_ms = $null
        status = $null
    }
}

try {
    $asset1 = Invoke-AssetUpload -BaseUrl $baseUrl -Headers $headers -Path $ImagePath1
    $asset1AcceptedAtUtc = [DateTime]::UtcNow
    $result.assets = @($result.assets + $asset1)
    $asset2 = Invoke-AssetUpload -BaseUrl $baseUrl -Headers $headers -Path $ImagePath2
    $asset2AcceptedAtUtc = [DateTime]::UtcNow
    $result.assets = @($result.assets + $asset2)
    Wait-AssetsTerminal -BaseUrl $baseUrl -Headers $headers -Assets @($asset1, $asset2) -AcceptedAtUtc @($asset1AcceptedAtUtc, $asset2AcceptedAtUtc)

    $asset1Status = Get-PublicProperty $asset1 "status"
    $asset2Status = Get-PublicProperty $asset2 "status"
    if (($asset1Status -ne "Active") -or ($asset2Status -ne "Active")) {
        $result.task.status = "asset_not_active"
        $result | ConvertTo-Json -Depth 20
        exit 2
    }

    $createBody = [ordered]@{
        model = $selectedModel
        content = @(
            [ordered]@{
                type = "text"
                text = "Two reference portraits in a calm treatment room, cinematic shallow depth of field, stable camera movement."
            },
            [ordered]@{
                type = "image_url"
                role = "reference_image"
                image_url = [ordered]@{ url = "asset://$($asset1.id)" }
            },
            [ordered]@{
                type = "image_url"
                role = "reference_image"
                image_url = [ordered]@{ url = "asset://$($asset2.id)" }
            }
        )
        resolution = "480p"
        ratio = "16:9"
        duration = 4
        generate_audio = $true
    }

    $createStart = [DateTime]::UtcNow
    $createResponse = Invoke-JsonRequest -Method POST -Uri "$baseUrl/v1/videos" -Headers $headers -Phase "video create" -Body $createBody
    $taskAcceptedAtUtc = [DateTime]::UtcNow
    $taskId = Get-PublicTaskId $createResponse
    $result.task.create_ms = Get-ElapsedMs $createStart
    $result.task.status = Get-PublicTaskStatus $createResponse
    $result.task.accepted = -not [string]::IsNullOrWhiteSpace($taskId)

    if (-not $result.task.accepted) {
        if ([string]::IsNullOrWhiteSpace($result.task.status)) {
            $result.task.status = "missing_task_id"
        }
        $result | ConvertTo-Json -Depth 20
        exit 3
    }

    Wait-TaskTerminal -BaseUrl $baseUrl -Headers $headers -Task $result.task -TaskId $taskId -AcceptedAtUtc $taskAcceptedAtUtc
    $result | ConvertTo-Json -Depth 20
    if (-not (Test-TaskTerminalSucceeded $result.task.status)) {
        exit 4
    }
} catch {
    $result.error = [string]$_.Exception.Message
    $result | ConvertTo-Json -Depth 20
    exit 1
}
