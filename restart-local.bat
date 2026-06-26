@echo off
setlocal EnableExtensions
call "%~dp0restart.bat" %*
exit /b %errorlevel%
