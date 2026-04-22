# GQ API - Build & Docker Script
# This script will:
# 1. Update version number
# 2. Build the Docker image
# 3. Push to Docker Hub (beyondandforever/gq-api)

param(
    [string]$dockerHubUsername = "beyondandforever",
    [string]$imageName = "gq-api",
    [string]$version = "",
    [switch]$skipPush = $false
)

# Get the project root directory (parent of scripts folder)
$scriptPath = $PSScriptRoot
$projectRoot = Split-Path $scriptPath -Parent

# Function to generate version
function Get-NewVersion {
    param(
        [string]$projectRoot
    )
    
    $versionFile = Join-Path $projectRoot "VERSION"
    $dateStr = Get-Date -Format "yyyyMMdd"
    $shortHash = git -C $projectRoot rev-parse --short HEAD 2>$null
    if (-not $shortHash) {
        $shortHash = "local"
    }
    return "$dateStr-$shortHash"
}

# Main script
try {
    Write-Host "=========================================="
    Write-Host "GQ API - Build & Docker Script"
    Write-Host "=========================================="
    Write-Host "Project root: $projectRoot"
    
    # Change to project root directory
    Set-Location $projectRoot
    
    # Determine version
    if ([string]::IsNullOrEmpty($version)) {
        $version = Get-NewVersion -projectRoot $projectRoot
    }
    
    Write-Host "Version: $version"
    
    # Update VERSION file
    $versionFile = Join-Path $projectRoot "VERSION"
    $version | Set-Content $versionFile -NoNewline
    Write-Host "Updated VERSION file"
    
    # Build Docker image
    Write-Host "`nBuilding Docker image..."
    $imageTag = "${dockerHubUsername}/${imageName}:${version}"
    $latestTag = "${dockerHubUsername}/${imageName}:latest"
    
    docker build -t $imageTag -t $latestTag .
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Docker build failed!"
        exit 1
    }
    
    Write-Host "`nDocker image built successfully!"
    Write-Host "  - $imageTag"
    Write-Host "  - $latestTag"
    
    if (-not $skipPush) {
        # Push to Docker Hub
        Write-Host "`nPushing to Docker Hub..."
        docker push $imageTag
        docker push $latestTag
        
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Docker push failed!"
            exit 1
        }
        
        Write-Host "`n=========================================="
        Write-Host "All operations completed successfully!"
        Write-Host "Version: $version"
        Write-Host "Docker image: $imageTag"
        Write-Host "=========================================="
    } else {
        Write-Host "`n=========================================="
        Write-Host "Build completed (skip push)"
        Write-Host "Version: $version"
        Write-Host "Docker image: $imageTag"
        Write-Host "=========================================="
    }
    
} catch {
    Write-Error "An error occurred: $_"
    exit 1
}
