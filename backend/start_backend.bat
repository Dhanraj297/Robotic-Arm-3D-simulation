@echo off
title RoboArm Backend
echo Starting RoboArm Python Backend...
cd /d "%~dp0"
if exist "env\python.exe" (
    env\python.exe app.py
) else (
    python app.py
)
pause
