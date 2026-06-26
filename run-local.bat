@echo off
setlocal EnableExtensions
call "%~dp0start.bat" %*
exit /b %errorlevel%
