@echo off
title J.A.R.V.I.S. — Supplement Leads Operations
color 0B
echo.
echo   JARVIS STARTUP SEQUENCE INITIATED
echo   ====================================
cd /d "%~dp0"

:: Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
  echo   ERROR: Node.js not found.
  echo   Install it from https://nodejs.org
  pause & exit /b 1
)

:: Install dependencies if needed
if not exist "node_modules" (
  echo   Installing dependencies...
  npm install
)

:: Create .env if it doesn't exist
if not exist ".env" (
  echo   Creating .env from template...
  copy .env.example .env
  echo.
  echo   ACTION REQUIRED: Open .env and add your ANTHROPIC_API_KEY
  echo   Then re-run this script.
  notepad .env
  pause & exit /b 0
)

:: Open browser after 2 seconds
start "" cmd /c "timeout /t 2 >nul && start http://localhost:3000"

echo.
echo   J.A.R.V.I.S. starting on http://localhost:3000
echo   Press Ctrl+C to shut down.
echo.
node server.js
