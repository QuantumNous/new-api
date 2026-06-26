@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT=%~dp0"
cd /d "%ROOT%"

set "RUNTIME_DIR=%ROOT%.runtime"
set "LOG_DIR=%ROOT%logs"
set "PID_FILE=%RUNTIME_DIR%\new-api.pid"
set "EXE_PATH=%RUNTIME_DIR%\new-api.exe"
set "OUT_LOG=%LOG_DIR%\new-api.out.log"
set "ERR_LOG=%LOG_DIR%\new-api.err.log"
set "FORCE_FRONTEND_BUILD=0"

if /I "%~1"=="rebuild" (
  set "FORCE_FRONTEND_BUILD=1"
)

call :ensure_command go
if errorlevel 1 exit /b 1
call :ensure_command powershell
if errorlevel 1 exit /b 1

if not exist "%RUNTIME_DIR%" mkdir "%RUNTIME_DIR%"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"
if not exist "%ROOT%data" mkdir "%ROOT%data"

if not exist "%ROOT%.env" (
  call :create_env
  if errorlevel 1 exit /b 1
)

call :read_port

if exist "%PID_FILE%" (
  set "RUN_PID="
  for /f "usebackq delims=" %%P in ("%PID_FILE%") do set "RUN_PID=%%P"
  if defined RUN_PID (
    powershell -NoProfile -Command "if (Get-Process -Id !RUN_PID! -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
    if not errorlevel 1 (
      echo Service is already running with PID !RUN_PID!.
      echo Use stop.bat or restart.bat first.
      exit /b 1
    )
  )
)

set "NEED_FRONTEND_BUILD=0"
if "%FORCE_FRONTEND_BUILD%"=="1" set "NEED_FRONTEND_BUILD=1"
if "%NEED_FRONTEND_BUILD%"=="0" (
  powershell -NoProfile -Command "if ((Test-Path -LiteralPath '%ROOT%web\default\dist\index.html') -and (Test-Path -LiteralPath '%ROOT%web\classic\dist\index.html')) { exit 0 } else { exit 1 }"
  if errorlevel 1 set "NEED_FRONTEND_BUILD=1"
)

if "%NEED_FRONTEND_BUILD%"=="1" (
  call :ensure_command bun
  if errorlevel 1 exit /b 1
  call :ensure_command node
  if errorlevel 1 exit /b 1

  echo Installing frontend dependencies...
  pushd "%ROOT%web"
  call bun install --frozen-lockfile --linker=hoisted
  if errorlevel 1 goto :fail
  popd

  echo Building default frontend...
  pushd "%ROOT%web\default"
  call bun run build
  if errorlevel 1 goto :fail
  popd

  echo Building classic frontend...
  pushd "%ROOT%web\classic"
  call bun run build
  if errorlevel 1 goto :fail
  popd
) else (
  echo Frontend dist already exists, skipping frontend rebuild.
  echo Run "start.bat rebuild" to rebuild frontend assets.
)

echo Building backend executable...
go build -o "%EXE_PATH%" .
if errorlevel 1 goto :fail

if exist "%PID_FILE%" del "%PID_FILE%" >nul 2>&1

echo Starting service on port %APP_PORT%...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$proc = Start-Process -FilePath '%EXE_PATH%' -WorkingDirectory '%ROOT%' -ArgumentList '--port','%APP_PORT%','--log-dir','%LOG_DIR%' -RedirectStandardOutput '%OUT_LOG%' -RedirectStandardError '%ERR_LOG%' -PassThru; Set-Content -Path '%PID_FILE%' -Value $proc.Id"
if errorlevel 1 goto :fail

powershell -NoProfile -Command "Start-Sleep -Seconds 2"

set "RUN_PID="
for /f "usebackq delims=" %%P in ("%PID_FILE%") do set "RUN_PID=%%P"
if not defined RUN_PID goto :fail

powershell -NoProfile -Command "if (Get-Process -Id !RUN_PID! -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if errorlevel 1 (
  echo Service exited too early. Please check:
  echo   %OUT_LOG%
  echo   %ERR_LOG%
  exit /b 1
)

echo Service started successfully.
echo URL: http://localhost:%APP_PORT%/
echo PID: !RUN_PID!
echo STDOUT: %OUT_LOG%
echo STDERR: %ERR_LOG%
exit /b 0

:ensure_command
where %~1 >nul 2>&1
if errorlevel 1 (
  echo Missing required command: %~1
  exit /b 1
)
exit /b 0

:create_env
for /f "usebackq delims=" %%S in (`powershell -NoProfile -Command "[guid]::NewGuid().ToString('N')"`) do set "SESSION_SECRET=%%S"
for /f "usebackq delims=" %%S in (`powershell -NoProfile -Command "[guid]::NewGuid().ToString('N')"`) do set "CRYPTO_SECRET=%%S"
> "%ROOT%.env" echo PORT=3000
>> "%ROOT%.env" echo SQLITE_PATH=data/new-api.db?_busy_timeout=30000
>> "%ROOT%.env" echo SESSION_SECRET=!SESSION_SECRET!
>> "%ROOT%.env" echo CRYPTO_SECRET=!CRYPTO_SECRET!
>> "%ROOT%.env" echo TZ=Asia/Shanghai
echo Created .env with local SQLite defaults.
exit /b 0

:read_port
set "APP_PORT=3000"
if not exist "%ROOT%.env" exit /b 0
for /f "usebackq tokens=1,* delims==" %%A in ("%ROOT%.env") do (
  if /I "%%~A"=="PORT" set "APP_PORT=%%~B"
)
if not defined APP_PORT set "APP_PORT=3000"
exit /b 0

:fail
if exist "%PID_FILE%" del "%PID_FILE%" >nul 2>&1
echo Startup failed.
exit /b 1
