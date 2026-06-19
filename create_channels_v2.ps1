# ============================================
# Alibaba Bulk Channel Creator v2
# Cookie-based authentication
# ============================================

# Step 1: এখানে তোমার info দাও
$sessionCookie = "MTc4MTQ3MjAwNHxEWDhFQVFMX2dBQUJFQUVRQUFEX3dmLUFBQVlHYzNSeWFXNW5EQWNBQldkeWIzVndCbk4wY21sdVp3d0pBQWRrWldaaGRXeDBCbk4wY21sdVp3d05BQXR2WVhWMGFGOXpkR0YwWlFaemRISnBibWNNRGdBTWQwOVJRa3gyVFhZeFZqSlVCbk4wY21sdVp3d0VBQUpwWkFOcGJuUUVBZ0FDQm5OMGNtbHVad3dLQUFoMWMyVnlibUZ0WlFaemRISnBibWNNREFBS2EybHVaWFJwYldGeWRBWnpkSEpwYm1jTUJnQUVjbTlzWlFOcGJuUUVBd0RfeUFaemRISnBibWNNQ0FBR2MzUmhkSFZ6QTJsdWRBUUNBQUk9fAiA1mxnlWBzEx6rVGG56jciPDwbPrb8YLiv23OqvwZP"   # Browser থেকে copy করা session cookie
$userId = 1                      # তোমার Admin User ID (সাধারণত 1)
$alibabaKey = "sk-4fc27cde61a64eeda7c0958461b6314c"
$baseUrl = "https://topapimodel.com"
$userModel = "claude-opus-4.8"
$channelTag = "Anthropic"
$baseUrlField = "https://ws-gbnowfivva3rg7rk.ap-southeast-1.maas.aliyuncs.com"

# Step 2: Priority অনুযায়ী Qwen models
$models = @(
    "qwen3-235b-a22b",
    "qwen3-235b-a22b-thinking-2507",
    "qwen3-235b-a22b-instruct-2507",
    "qwen3.5-397b-a17b",
    "qwen3-coder-480b-a35b-instruct",
    "qwen3.7-max",
    "qwen3.7-max-2026-06-08",
    "qwen3.7-max-2026-05-20",
    "qwen3.7-max-preview",
    "qwen3-max",
    "qwen3-max-2026-01-23",
    "qwen3-max-preview",
    "qvq-max",
    "qwen3-vl-235b-a22b-thinking",
    "deepseek-v4-pro",
    "deepseek-v3.2",
    "deepseek-v4-flash",
    "glm-5.1",
    "qwen3.7-plus",
    "qwen3.7-plus-2026-05-26",
    "qwen3.6-plus",
    "qwen3.6-plus-2026-04-02",
    "qwen3.5-plus",
    "qwen3.5-plus-2026-04-20",
    "qwen3.5-plus-2026-02-15",
    "qwen3.6-27b",
    "qwen3.5-122b-a10b",
    "qwen3-coder-plus",
    "qwen3-coder-plus-2025-09-23",
    "qwen3-coder-plus-2025-07-22",
    "qwen3-coder-next",
    "qwen3.5-35b-a3b",
    "qwen3-32b",
    "qwen3-30b-a3b-thinking-2507",
    "qwen3-30b-a3b",
    "qwen3-30b-a3b-instruct-2507",
    "qwen3-next-80b-a3b-thinking",
    "qwen3-coder-30b-a3b-instruct",
    "qwen3-coder-flash",
    "qwen3.6-35b-a3b",
    "qwen3-vl-30b-a3b-thinking",
    "qwen3.5-27b",
    "qwen3-14b",
    "qwen3-8b",
    "qwq-plus",
    "qwen-max",
    "qwen-plus-latest",
    "qwen-plus",
    "qwen3.6-flash",
    "qwen3.5-flash",
    "qwen-turbo",
    "qwen-flash"
)

$total = $models.Count
$priority = $total

Write-Host "Total $total channels will be created for: $userModel" -ForegroundColor Cyan
Write-Host ""

$headers = @{
    "Content-Type" = "application/json"
    "Cookie"       = "session=$sessionCookie"
    "New-Api-User" = "$userId"
}

$success = 0
$fail = 0

foreach ($model in $models) {
    $paddedPriority = $priority.ToString().PadLeft(2, '0')
    $channelName = "ANT-$userModel-P$paddedPriority"
    $modelMapping = '{"' + $userModel + '":"' + $model + '"}'

    $body = @{
        name          = $channelName
        type          = 17
        key           = $alibabaKey
        base_url      = $baseUrlField
        models        = $userModel
        group         = "default"
        model_mapping = $modelMapping
        tag           = $channelTag
        priority      = $priority
        auto_ban      = 1
        weight        = 0
    } | ConvertTo-Json

    try {
        $r = Invoke-RestMethod `
            -Uri "$baseUrl/api/channel/" `
            -Method POST `
            -Headers $headers `
            -Body $body

        if ($r.success -eq $true) {
            Write-Host "OK [P$paddedPriority] $channelName -> $model" -ForegroundColor Green
            $success++
        }
        else {
            Write-Host "FAIL [P$paddedPriority] $channelName : $($r.message)" -ForegroundColor Red
            $fail++
        }
    }
    catch {
        Write-Host "ERROR [P$paddedPriority] $channelName : $_" -ForegroundColor Red
        $fail++
    }

    $priority--
    Start-Sleep -Milliseconds 300
}

Write-Host ""
Write-Host "Done! Success: $success, Failed: $fail" -ForegroundColor Cyan
