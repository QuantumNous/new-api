@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT=%~dp0"
cd /d "%ROOT%"

set "RUNTIME_DIR=%ROOT%.runtime"
set "PID_FILE=%RUNTIME_DIR%\new-api.pid"

call :read_port

set "STOPPED=0"

if exist "%PID_FILE%" (
  set "RUN_PID="
  for /f "usebackq delims=" %%P in ("%PID_FILE%") do set "RUN_PID=%%P"
  if defined RUN_PID (
    powershell -NoProfile -Command "if (Get-Process -Id !RUN_PID! -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
    if not errorlevel 1 (
      echo Stopping PID !RUN_PID!...
      taskkill /PID !RUN_PID! /T /F >nul 2>&1
      if not errorlevel 1 set "STOPPED=1"
    )
  )
  del "%PID_FILE%" >nul 2>&1
)

for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "$procIds = Get-NetTCPConnection -State Listen -LocalPort %APP_PORT% -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; foreach ($procId in $procIds) { $procId }"`) do (
  echo Stopping process on port %APP_PORT%: %%P
  taskkill /PID %%P /T /F >nul 2>&1
  if not errorlevel 1 set "STOPPED=1"
)

if "%STOPPED%"=="1" (
  echo Service stopped.
) else (
  echo No running service found on PID file or port %APP_PORT%.
)

exit /b 0

:read_port
set "APP_PORT=3000"
if not exist "%ROOT%.env" exit /b 0
for /f "usebackq tokens=1,* delims==" %%A in ("%ROOT%.env") do (
  if /I "%%~A"=="PORT" set "APP_PORT=%%~B"
)
if not defined APP_PORT set "APP_PORT=3000"
exit /b 0
