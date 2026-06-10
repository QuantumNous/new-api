[CmdletBinding()]
param(
    [ValidateSet('start', 'stop', 'restart', 'status', 'logs', 'rebuild')]
    [string]$Action = 'start'
)

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$composeFile = Join-Path $repoRoot 'docker-compose.local.yml'
$dockerDesktop = 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
$dockerBin = 'C:\Program Files\Docker\Docker\resources\bin\docker.exe'

function Get-DockerCommand {
    $command = Get-Command docker -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }

    if (Test-Path -LiteralPath $dockerBin) {
        return $dockerBin
    }

    throw 'Docker CLI was not found. Install Docker Desktop first.'
}

function Wait-DockerEngine {
    param([string]$Docker)

    & $Docker info *> $null
    if ($LASTEXITCODE -eq 0) {
        return
    }

    if (-not (Test-Path -LiteralPath $dockerDesktop)) {
        throw 'Docker Desktop was not found at the default installation path.'
    }

    Write-Host 'Starting Docker Desktop...'
    if (-not (Get-Process -Name 'Docker Desktop' -ErrorAction SilentlyContinue)) {
        Start-Process -FilePath $dockerDesktop -WindowStyle Hidden
    }

    $deadline = (Get-Date).AddMinutes(3)
    do {
        Start-Sleep -Seconds 3
        & $Docker info *> $null
        if ($LASTEXITCODE -eq 0) {
            Write-Host 'Docker Engine is ready.'
            return
        }
    } while ((Get-Date) -lt $deadline)

    throw 'Docker Engine did not become ready within 3 minutes. After a first-time Docker Desktop installation, restart Windows once and run this command again.'
}

function Invoke-Compose {
    param(
        [string]$Docker,
        [string[]]$Arguments
    )

    & $Docker compose --file $composeFile @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Docker Compose failed with exit code $LASTEXITCODE."
    }
}

function Wait-Application {
    $deadline = (Get-Date).AddMinutes(3)
    do {
        try {
            $response = Invoke-RestMethod -Uri 'http://localhost:3000/api/status' -TimeoutSec 5
            if ($response.success -eq $true) {
                Write-Host 'Application health check passed.'
                return
            }
        } catch {
            Start-Sleep -Seconds 3
            continue
        }

        Start-Sleep -Seconds 3
    } while ((Get-Date) -lt $deadline)

    throw 'Application did not become healthy within 3 minutes. Run the logs action to inspect startup errors.'
}

$docker = Get-DockerCommand
Wait-DockerEngine -Docker $docker
Set-Location -LiteralPath $repoRoot

switch ($Action) {
    'start' {
        Invoke-Compose -Docker $docker -Arguments @('up', '--detach')
        Wait-Application
        Write-Host 'Project is ready: http://localhost:3000'
    }
    'stop' {
        Invoke-Compose -Docker $docker -Arguments @('down')
        Write-Host 'Project containers stopped. Database volumes were preserved.'
    }
    'restart' {
        Invoke-Compose -Docker $docker -Arguments @('down')
        Invoke-Compose -Docker $docker -Arguments @('up', '--detach', '--build')
        Wait-Application
        Write-Host 'Project restarted: http://localhost:3000'
    }
    'status' {
        Invoke-Compose -Docker $docker -Arguments @('ps')
    }
    'logs' {
        Invoke-Compose -Docker $docker -Arguments @('logs', '--follow', '--tail', '200')
    }
    'rebuild' {
        Invoke-Compose -Docker $docker -Arguments @('build', '--no-cache', 'new-api')
        Invoke-Compose -Docker $docker -Arguments @('up', '--detach')
        Wait-Application
        Write-Host 'Project rebuilt: http://localhost:3000'
    }
}
