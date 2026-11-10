@echo off
cd /d "%~dp0"
where py >nul 2>&1
if errorlevel 1 (
  python tools\serve.py --port 8000
) else (
  py tools\serve.py --port 8000
)
pause
