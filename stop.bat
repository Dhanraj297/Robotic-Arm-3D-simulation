@echo off
title Stop RoboArm Simulator
echo ========================================================
echo          Stopping RoboArm Simulator Services...
echo ========================================================
echo.

:: Stop processes on port 5001
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":5001" ^| findstr "LISTENING"') do (
    echo Terminating backend process (PID %%a)...
    taskkill /f /pid %%a >nul 2>&1
)

:: Stop processes on port 3000 (if dev mode was running)
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":3000" ^| findstr "LISTENING"') do (
    echo Terminating frontend process (PID %%a)...
    taskkill /f /pid %%a >nul 2>&1
)

echo.
echo [*] All RoboArm services stopped.
timeout /t 2 >nul
