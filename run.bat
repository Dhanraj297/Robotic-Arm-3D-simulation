@echo off
title RoboArm 3D Simulator
setlocal enabledelayedexpansion

echo ========================================================
echo        ROBOARM 3D ROBOTIC SIMULATOR - FAST LAUNCH
echo ========================================================
echo.

:: Detect Python executable (prefer backend\env with PyBullet physics)
set "PYTHON_EXE=python"
if exist "%~dp0backend\env\python.exe" (
    set "PYTHON_EXE=%~dp0backend\env\python.exe"
    echo [*] Using high-performance PyBullet physics engine.
) else (
    echo [*] Using system Python.
)

:: Check for development flag (--dev or -d)
if "%1"=="--dev" goto :DEV_MODE
if "%1"=="-d" goto :DEV_MODE

:: ── FAST 1-CLICK MODE (< 1 second boot time) ──────────────
echo [*] Starting all-in-one simulator on http://localhost:5001 ...
echo [*] Auto-opening your browser in 2 seconds...
echo.

:: Launch default browser
start "" "http://localhost:5001"

:: Start server directly in current window
cd /d "%~dp0backend"
"%PYTHON_EXE%" app.py
goto :EOF

:: ── DEV MODE (With React Hot-Reloading on Port 3000) ───────
:DEV_MODE
echo [*] DEV MODE ACTIVATED: Starting Backend + React Dev Server...
start "RoboArm Backend" cmd /k "cd /d "%~dp0backend" && "%PYTHON_EXE%" app.py"
timeout /t 2 /nobreak >nul
start "RoboArm Frontend" cmd /k "cd /d "%~dp0frontend" && npm.cmd start"
echo.
echo Dev services launched:
echo   - Backend API: http://localhost:5001
echo   - React Dev:   http://localhost:3000
echo.
pause
