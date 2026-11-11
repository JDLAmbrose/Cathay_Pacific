@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 24 LTS from https://nodejs.org/ and try again.
  pause
  exit /b 1
)
node tools/start.mjs
if errorlevel 1 pause
