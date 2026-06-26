@echo off
setlocal EnableExtensions

set "ROOT=%~dp0"
cd /d "%ROOT%"

call "%ROOT%stop.bat"
if errorlevel 1 exit /b 1

call "%ROOT%start.bat" %*
exit /b %errorlevel%
