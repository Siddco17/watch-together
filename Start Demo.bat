@echo off
cd /d "%~dp0"
title Watch Together
echo Watch Together — starting the presentation...
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is missing. Install it from https://nodejs.org then try again.
  start https://nodejs.org
  pause
  exit /b 1
)

where git-lfs >nul 2>&1
if not errorlevel 1 git lfs pull >nul 2>&1

if not exist node_modules (
  echo Installing packages (first run only)...
  call npm install
  echo.
)

echo Opening http://localhost:3000
echo Leave this window open during the demo. Close it to stop.
echo.
call npm run present
pause
