param([string]$TaskName='HardyImageUpscaleWorker')
$ErrorActionPreference='Stop'
$runner=Join-Path $PSScriptRoot 'run-worker.ps1'
if (!(Test-Path (Join-Path $PSScriptRoot 'config.json'))) { throw 'Missing private config.json' }
$existing=Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing -and $existing.State -eq 'Running') {
    if (Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'worker-state') -Filter '*.json' -ErrorAction SilentlyContinue) { throw 'Worker is processing a job; wait before reinstalling' }
    Stop-ScheduledTask -TaskName $TaskName
    for ($attempt=0; $attempt -lt 20; $attempt++) {
        if ((Get-ScheduledTask -TaskName $TaskName).State -ne 'Running') { break }
        Start-Sleep -Milliseconds 250
    }
    if ((Get-ScheduledTask -TaskName $TaskName).State -eq 'Running') { throw 'Previous worker has not stopped' }
}
$workerScript=Join-Path $PSScriptRoot 'worker.py'
Get-CimInstance Win32_Process -Filter "name='python.exe'" |
    Where-Object { $_.CommandLine -and $_.CommandLine.Contains($workerScript) } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
$principal=New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType S4U -RunLevel Limited
$action=New-ScheduledTaskAction -Execute "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$runner`"" -WorkingDirectory $PSScriptRoot
$startupTrigger=New-ScheduledTaskTrigger -AtStartup
$watchdogTrigger=New-ScheduledTaskTrigger -Once -At ((Get-Date).AddMinutes(1)) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 3650)
$settings=New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable -WakeToRun -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName $TaskName -Action $action -Principal $principal -Trigger @($startupTrigger,$watchdogTrigger) -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName $TaskName
Get-ScheduledTask -TaskName $TaskName | Select-Object TaskName,State
