# deploy.ps1 — Deploy & New VPS Setup Script
# 
# Normal deploy (frontend only):
#   .\deploy.ps1
#
# New VPS first-time setup:
#   .\deploy.ps1 -VPS "NEW_VPS_IP" -Pass "NEW_VPS_PASSWORD" -Setup
#
# Deploy to different VPS:
#   .\deploy.ps1 -VPS "NEW_VPS_IP" -Pass "NEW_VPS_PASSWORD"

param(
    [string]$VPS        = "167.71.221.150",
    [string]$Pass       = "KinetiMart@2026#AI",
    [string]$RemotePath = "/opt/new-api",
    [string]$GitRepo    = "https://github.com/Ibne360/new-api.git",
    [switch]$Setup      # Use this flag for brand new VPS first-time setup
)

$puttyDir = "C:\Program Files\PuTTY"
$plink    = "$puttyDir\plink.exe"
$pscp     = "$puttyDir\pscp.exe"
$zip      = "$env:TEMP\dist_deploy.zip"

# ─────────────────────────────────────────────
# NEW VPS FIRST-TIME SETUP
# ─────────────────────────────────────────────
if ($Setup) {
    Write-Host "=== NEW VPS SETUP MODE ===" -ForegroundColor Yellow
    Write-Host "VPS: $VPS" -ForegroundColor Cyan

    Write-Host "`n[1/4] Installing Docker..." -ForegroundColor Cyan
    & $plink -ssh -pw $Pass -batch "root@$VPS" @"
curl -fsSL https://get.docker.com | sh
apt install -y docker-compose-plugin unzip
echo "Docker installed!"
docker --version
"@

    Write-Host "`n[2/4] Cloning project from GitHub..." -ForegroundColor Cyan
    & $plink -ssh -pw $Pass -batch "root@$VPS" @"
mkdir -p $RemotePath
cd $RemotePath
git clone $GitRepo . || git pull
echo "Code ready!"
"@

    Write-Host "`n[3/4] Creating .env file with all secrets..." -ForegroundColor Cyan
    & $plink -ssh -pw $Pass -batch "root@$VPS" @"
cat > $RemotePath/.env << 'ENVEOF'
R2_ACCOUNT_ID=0108921b1b971f36300efe56a649d703
R2_ACCESS_KEY_ID=867eaa3128ddf90b3f058a69fc8a4b88
R2_SECRET_ACCESS_KEY=a960447d796dd2e5bbfec447432c4de91866aeb40124c9438b05f773a21570c8
R2_BUCKET_NAME=topapimodel
R2_PUBLIC_URL=https://pub-f31d2ac5cf924356bd6b45ae32a1417f.r2.dev
BINANCE_UID=171616261
BINANCE_API_KEY=FJkfB0moW3bjaBFR6EuSST4dprYABaM3UmF89ERUHWnIPLMMITSQ3SQPBWz09SKW
BINANCE_API_SECRET=eMNab6t5iVnffbO3jxJ2G2gKMMKnmPO7WcB0GrHX3ptddCDXGvjj0tjSBBTXtxRA
SQL_DSN=postgresql://postgres.cdujrvruwtyroxrmssew:RF_KeJDq4%23%23eL.8@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require
ENVEOF
echo ".env created!"
cat $RemotePath/.env | grep -v SECRET | grep -v KEY | grep -v PASSWORD
"@

    Write-Host "`n[4/4] Starting app (Redis only — no local Postgres needed)..." -ForegroundColor Cyan
    & $plink -ssh -pw $Pass -batch "root@$VPS" @"
cd $RemotePath
docker compose up -d redis
echo "Waiting for Redis..."
sleep 5
docker compose up -d new-api
sleep 8
docker logs new-api 2>&1 | grep -E "started|PostgreSQL|ERROR" | head -5
echo "SETUP COMPLETE!"
"@

    Write-Host "`n=== NEW VPS SETUP DONE! ===" -ForegroundColor Green
    Write-Host "Website: http://${VPS}:3000" -ForegroundColor Yellow
    Write-Host "Now run normal deploy to build & upload frontend:" -ForegroundColor White
    Write-Host "  .\deploy.ps1 -VPS `"$VPS`" -Pass `"$Pass`"" -ForegroundColor Cyan
    exit 0
}

# ─────────────────────────────────────────────
# NORMAL FRONTEND DEPLOY
# ─────────────────────────────────────────────
Write-Host "=== Step 1: Build frontend locally ===" -ForegroundColor Cyan
Set-Location "d:\new-api\web\default"
bun run build
if ($LASTEXITCODE -ne 0) { Write-Host "Build failed!" -ForegroundColor Red; exit 1 }

Write-Host "=== Step 2: Zip dist folder ===" -ForegroundColor Cyan
Set-Location "d:\new-api"
Compress-Archive -Path "web\default\dist\*" -DestinationPath $zip -Force
Write-Host "Zip size: $([Math]::Round((Get-Item $zip).Length/1MB, 1)) MB"

Write-Host "=== Step 3: Upload zip to VPS ===" -ForegroundColor Cyan
& $pscp -pw $Pass -batch $zip "root@${VPS}:${RemotePath}/dist_deploy.zip"

Write-Host "=== Step 4: Extract on VPS ===" -ForegroundColor Cyan
& $plink -ssh -pw $Pass -batch "root@$VPS" @"
rm -rf ${RemotePath}/web/default/dist
mkdir -p ${RemotePath}/web/default/dist
cd ${RemotePath}/web/default/dist && unzip -q ${RemotePath}/dist_deploy.zip
echo "Files: \$(find ${RemotePath}/web/default/dist -type f | wc -l)"
"@

Write-Host "=== Step 5: Docker build + up ===" -ForegroundColor Cyan
& $plink -ssh -pw $Pass -batch "root@$VPS" @"
cd ${RemotePath}
docker compose build new-api 2>&1 | tail -5
docker compose up -d new-api
echo DEPLOY_OK
"@

Write-Host "=== Done! ===" -ForegroundColor Green
