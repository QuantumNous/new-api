@echo off
echo Building frontend...
cd web
call bun install
set DISABLE_ESLINT_PLUGIN=true
set /p VITE_REACT_APP_VERSION=<..\VERSION
call bun run build