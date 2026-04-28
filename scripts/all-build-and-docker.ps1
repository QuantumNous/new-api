# GQ API - Build & Docker Script
# This script will:
# 1. Switch to gqapi_release branch and pull latest code
# 2. Build frontend (web folder)
# 3. Update version number
# 4. Build the Docker image
# 5. Push to Docker Hub (beyondandforever/gq-api)

param(
    [string]$dockerHubUsername = "beyondandforever",
    [string]$imageName = "gq-api",
    [string]$version = "v0.13.2",
    [switch]$skipPush = $false,
    [switch]$skipFrontendBuild = $false,
    [switch]$skipGitPull = $false
)

# Get the project root directory (parent of scripts folder)
$scriptPath = $PSScriptRoot
$projectRoot = Split-Path $scriptPath -Parent
$webRoot = Join-Path $projectRoot "web"

# Function to generate version
function Get-NewVersion {
    param(
        [string]$projectRoot
    )
    
    $dateStr = Get-Date -Format "yyyyMMdd"
    $shortHash = git -C $projectRoot rev-parse --short HEAD 2>$null
    if (-not $shortHash) {
        $shortHash = "local"
    }
    return "$dateStr-$shortHash"
}

# Function to check if command exists
function Test-Command {
    param([string]$command)
    $null -ne (Get-Command $command -ErrorAction SilentlyContinue)
}

# Function to run command and check exit code
function Invoke-BuildStep {
    param(
        [string]$stepName,
        [scriptblock]$scriptBlock
    )
    
    Write-Host "`n>>> $stepName ..." -ForegroundColor Cyan
    try {
        & $scriptBlock
        if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne $null) {
            throw "Step failed with exit code: $LASTEXITCODE"
        }
        Write-Host "✓ $stepName completed" -ForegroundColor Green
    } catch {
        Write-Error "✗ $stepName failed: $_"
        throw
    }
}

# Main script
try {
    Write-Host "==========================================" -ForegroundColor Yellow
    Write-Host "GQ API - Build & Docker Script" -ForegroundColor Yellow
    Write-Host "==========================================" -ForegroundColor Yellow
    Write-Host "Project root: $projectRoot" -ForegroundColor Gray
    Write-Host "Web root: $webRoot" -ForegroundColor Gray
    
    # Change to project root directory
    Set-Location $projectRoot
    
    # Step 1: Git operations (switch to release branch and pull)
    if (-not $skipGitPull) {
        Invoke-BuildStep "Git: Switch to gqapi_release branch" {
            git checkout gqapi_release
        }
        
        Invoke-BuildStep "Git: Pull latest code" {
            git pull origin gqapi_release
        }
    } else {
        Write-Host "`n>>> Skipping git operations (--skipGitPull)" -ForegroundColor Yellow
    }
    
    # Step 2: Build frontend
    if (-not $skipFrontendBuild) {
        if (-not (Test-Path $webRoot)) {
            throw "Web folder not found at: $webRoot"
        }
        
        Set-Location $webRoot
        
        # Check if node_modules exists, if not run npm install
        if (-not (Test-Path "node_modules")) {
            Invoke-BuildStep "Frontend: Install dependencies" {
                npm install
            }
        }
        
        Invoke-BuildStep "Frontend: Build production bundle" {
            npm run build
        }
        
        # Return to project root
        Set-Location $projectRoot
    } else {
        Write-Host "`n>>> Skipping frontend build (--skipFrontendBuild)" -ForegroundColor Yellow
    }
    
    # Step 3: Determine version
    if ([string]::IsNullOrEmpty($version)) {
        $version = Get-NewVersion -projectRoot $projectRoot
        Write-Host "`n>>> Auto-generated version: $version" -ForegroundColor Cyan
    } else {
        Write-Host "`n>>> Using specified version: $version" -ForegroundColor Cyan
    }
    
    # Step 4: Update VERSION file
    Invoke-BuildStep "Update VERSION file" {
        $versionFile = Join-Path $projectRoot "VERSION"
        $version | Set-Content $versionFile -NoNewline
        Write-Host "  VERSION file updated: $version"
    }
    
    # Step 5: Build Docker image
    $imageTag = "${dockerHubUsername}/${imageName}:${version}"
    $latestTag = "${dockerHubUsername}/${imageName}:latest"
    
    Invoke-BuildStep "Build Docker image" {
        docker build -t $imageTag -t $latestTag .
        Write-Host "  Image tags:"
        Write-Host "    - $imageTag"
        Write-Host "    - $latestTag"
    }
    
    # Step 6: Push to Docker Hub (optional)
    if (-not $skipPush) {
        Invoke-BuildStep "Push Docker image to Hub" {
            docker push $imageTag
            docker push $latestTag
            Write-Host "  Pushed: $imageTag"
            Write-Host "  Pushed: $latestTag"
        }
        
        Write-Host "`n==========================================" -ForegroundColor Green
        Write-Host "✓ All operations completed successfully!" -ForegroundColor Green
        Write-Host "==========================================" -ForegroundColor Green
        Write-Host "Version: $version" -ForegroundColor White
        Write-Host "Docker image: $imageTag" -ForegroundColor White
        Write-Host "  Pull with: docker pull $imageTag" -ForegroundColor Gray
        Write-Host "==========================================" -ForegroundColor Green
    } else {
        Write-Host "`n==========================================" -ForegroundColor Green
        Write-Host "✓ Build completed (push skipped)" -ForegroundColor Green
        Write-Host "==========================================" -ForegroundColor Green
        Write-Host "Version: $version" -ForegroundColor White
        Write-Host "Docker image: $imageTag" -ForegroundColor White
        Write-Host "  To push later: docker push $imageTag" -ForegroundColor Gray
        Write-Host "==========================================" -ForegroundColor Green
    }
    
} catch {
    Write-Host "`n==========================================" -ForegroundColor Red
    Write-Error "Build failed: $_"
    Write-Host "==========================================" -ForegroundColor Red
    exit 1
}