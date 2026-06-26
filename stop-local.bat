@echo off
setlocal EnableExtensions
call "%~dp0stop.bat" %*
exit /b %errorlevel%
