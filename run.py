#!/usr/bin/env python3
"""
RoboArm Simulator - Fast Python Launcher
Usage:
    python run.py          # Fast 1-click launch (< 1s boot time)
    python run.py --dev    # Development mode with React hot-reload
"""

import sys
import os
import subprocess
import webbrowser
import time

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")

# Prefer backend virtualenv with PyBullet
ENV_PYTHON = os.path.join(BACKEND_DIR, "env", "python.exe" if sys.platform == "win32" else "bin/python")
PYTHON_EXE = ENV_PYTHON if os.path.exists(ENV_PYTHON) else sys.executable

dev_mode = "--dev" in sys.argv or "-d" in sys.argv

print("=" * 56)
print("     ROBOARM 3D ROBOTIC SIMULATOR - FAST LAUNCH")
print("=" * 56)
print(f"[*] Python: {PYTHON_EXE}")

if dev_mode:
    print("[*] Starting Backend (5001) + React Dev Server (3000)...")
    npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
    p_back = subprocess.Popen([PYTHON_EXE, "app.py"], cwd=BACKEND_DIR)
    time.sleep(1.5)
    p_front = subprocess.Popen([npm_cmd, "start"], cwd=FRONTEND_DIR)
    try:
        p_front.wait()
    except KeyboardInterrupt:
        p_front.terminate()
        p_back.terminate()
else:
    print("[*] Launching all-in-one simulator on http://localhost:5001 ...")
    webbrowser.open("http://localhost:5001")
    try:
        subprocess.run([PYTHON_EXE, "app.py"], cwd=BACKEND_DIR)
    except KeyboardInterrupt:
        print("\n[*] Exiting RoboArm Simulator.")
