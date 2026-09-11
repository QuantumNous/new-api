param([string]$TaskName='HardyImageUpscaleWorker')
$ErrorActionPreference='Stop'
$runner=Join-Path $PSScriptRoot 'run-worker.ps1'
if (!(Test-Path (Join-Path $PSScriptRoot 'config.json'))) { throw 'Missing private config.json' }
$existing=Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing -and $existing.State -eq 'Running') {
    if (Test-Path (Join-Path $PSScriptRoot 'worker-state\job.json')) { throw 'Worker is processing a job; wait before reinstalling' }
    Stop-ScheduledTask -TaskName $TaskName
    for ($attempt=0; $attempt -lt 20; $attempt++) {
        if ((Get-ScheduledTask -TaskName $TaskName).State -ne 'Running') { break }
        Start-Sleep -Milliseconds 250
    }
    if ((Get-ScheduledTask -TaskName $TaskName).State -eq 'Running') { throw 'Previous worker has not stopped' }
}
$principal=New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType S4U -RunLevel Limited
$action=New-ScheduledTaskAction -Execute "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$runner`"" -WorkingDirectory $PSScriptRoot
$trigger=New-ScheduledTaskTrigger -AtStartup
$settings=New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName $TaskName -Action $action -Principal $principal -Trigger $trigger -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName $TaskName
Get-ScheduledTask -TaskName $TaskName | Select-Object TaskName,State
