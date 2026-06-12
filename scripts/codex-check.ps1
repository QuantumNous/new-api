param(
    [switch]$Security,
    [switch]$Strict
)

$ErrorActionPreference = "Continue"
$failed = $false

function Has-Command($name) {
    return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

function Run-Step($title, $command, [switch]$UseRtk) {
    Write-Host "`n==> $title" -ForegroundColor Cyan

    $finalCommand = $command
    if ($UseRtk -and (Has-Command "rtk")) {
        $finalCommand = "rtk $command"
    }

    Write-Host "> $finalCommand" -ForegroundColor DarkGray
    Invoke-Expression $finalCommand
    if ($LASTEXITCODE -ne 0) {
        Write-Host "失败：$title" -ForegroundColor Red
        $script:failed = $true
    }
}

function Run-IfScriptExists($packageManager, $scriptName) {
    if (!(Test-Path "package.json")) { return }

    try {
        $pkg = Get-Content "package.json" -Raw | ConvertFrom-Json
        if ($pkg.scripts.PSObject.Properties.Name -contains $scriptName) {
            Run-Step "$packageManager $scriptName" "$packageManager run $scriptName" -UseRtk
        }
    } catch {
        Write-Host "无法解析 package.json，跳过 $scriptName" -ForegroundColor Yellow
    }
}

function Detect-PackageManager() {
    if (Test-Path "pnpm-lock.yaml") { return "pnpm" }
    if (Test-Path "yarn.lock") { return "yarn" }
    if (Test-Path "bun.lockb") { return "bun" }
    if (Test-Path "package-lock.json") { return "npm" }
    if (Test-Path "package.json") { return "npm" }
    return $null
}

Write-Host "Codex 项目检查开始" -ForegroundColor Green

if (Has-Command "rtk") {
    Write-Host "RTK 已检测到：日常命令将优先使用 RTK" -ForegroundColor Green
} else {
    Write-Host "未检测到 RTK：将使用原始命令" -ForegroundColor Yellow
}

if (Has-Command "git") {
    Run-Step "Git 状态" "git status --short" -UseRtk
}

$pm = Detect-PackageManager
if ($pm) {
    Write-Host "`n检测到 JS/TS 项目，包管理器：$pm" -ForegroundColor Green
    Run-IfScriptExists $pm "lint"
    Run-IfScriptExists $pm "typecheck"
    Run-IfScriptExists $pm "test"
    Run-IfScriptExists $pm "build"
}

if ((Test-Path "pyproject.toml") -or (Test-Path "requirements.txt") -or (Test-Path "pytest.ini")) {
    Write-Host "`n检测到 Python 项目" -ForegroundColor Green
    if (Has-Command "ruff") { Run-Step "ruff check" "ruff check ." -UseRtk }
    if (Has-Command "mypy") { Run-Step "mypy" "mypy ." -UseRtk }
    if (Has-Command "pytest") { Run-Step "pytest" "pytest" -UseRtk }
}

if (Test-Path "go.mod") {
    Write-Host "`n检测到 Go 项目" -ForegroundColor Green
    if (Has-Command "go") { Run-Step "go test" "go test ./..." -UseRtk }
}

if (Test-Path "Cargo.toml") {
    Write-Host "`n检测到 Rust 项目" -ForegroundColor Green
    if (Has-Command "cargo") {
        Run-Step "cargo test" "cargo test" -UseRtk
        Run-Step "cargo clippy" "cargo clippy --all-targets --all-features" -UseRtk
    }
}

if (Get-ChildItem -Path . -Filter *.sln -ErrorAction SilentlyContinue) {
    Write-Host "`n检测到 .NET 项目" -ForegroundColor Green
    if (Has-Command "dotnet") { Run-Step "dotnet test" "dotnet test" -UseRtk }
}

if ($Security) {
    Write-Host "`n开始阶段性安全扫描（原始输出，不使用 RTK）" -ForegroundColor Magenta

    if (Has-Command "gitleaks") {
        Run-Step "gitleaks" "gitleaks detect --source . --no-banner"
    } else {
        Write-Host "未安装 gitleaks，跳过密钥扫描" -ForegroundColor Yellow
        if ($Strict) { $failed = $true }
    }

    if (Has-Command "semgrep") {
        Run-Step "semgrep" "semgrep scan --config p/security-audit --config p/owasp-top-ten"
    } else {
        Write-Host "未安装 semgrep，跳过 SAST 扫描" -ForegroundColor Yellow
        if ($Strict) { $failed = $true }
    }

    if (Has-Command "trivy") {
        Run-Step "trivy fs" "trivy fs ."
    } else {
        Write-Host "未安装 trivy，跳过依赖/文件系统扫描" -ForegroundColor Yellow
        if ($Strict) { $failed = $true }
    }

    if (Test-Path ".github/workflows") {
        if (Has-Command "zizmor") {
            Run-Step "zizmor" "zizmor .github/workflows"
        } else {
            Write-Host "存在 .github/workflows，但未安装 zizmor，跳过 GitHub Actions 安全扫描" -ForegroundColor Yellow
            if ($Strict) { $failed = $true }
        }
    }
}

if ($failed) {
    Write-Host "`n检查完成：存在失败项" -ForegroundColor Red
    exit 1
}

Write-Host "`n检查完成：未发现失败项" -ForegroundColor Green
exit 0
