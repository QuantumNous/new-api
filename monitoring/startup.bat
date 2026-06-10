@echo off
REM New API Monitoring Stack - Auto-start script
REM Put this in Windows Startup folder:
REM   Win+R → shell:startup → create shortcut to this file

cd /d "%~dp0"
docker-compose up -d
