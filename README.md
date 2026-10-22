# 🤖 6-DOF Robotic Arm 3D Digital Twin & Physics Simulator

[![React](https://img.shields.io/badge/React-18.x-61dafb?logo=react&logoColor=black)](https://reactjs.org/)
[![Three.js](https://img.shields.io/badge/Three.js-r128-black?logo=three.js)](https://threejs.org/)
[![Python](https://img.shields.io/badge/Python-3.10+-3776ab?logo=python&logoColor=white)](https://www.python.org/)
[![PyBullet](https://img.shields.io/badge/PyBullet-3.25+-ff6f00)](https://pybullet.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-Real--Time-010101?logo=socket.io)](https://socket.io/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

An industrial-grade, full-stack **6-DOF Robotic Arm 3D Digital Twin and Physics Simulator**. Built with **React 18**, **Three.js / React Three Fiber**, **Flask**, **Socket.IO**, and the **PyBullet Physics Engine**, this simulator provides full forward and inverse kinematics, real rigid-body dynamics, realistic pneumatic vacuum suction tooling, free 3D workcell placement, and dual keyboard/gamepad controller interaction.

---

## 🌟 Key Highlights

- **🦾 6-DOF Articulated Robotic Arm**: Fully modeled 5-axis articulated manipulator with industrial CNC steel aesthetics, joint pivot spheres, accent rings, and real-time angle readouts.
- **💨 Pneumatic Vacuum Suction Tool Head**: Industrial vacuum manifold block, polyurethane airline, digital sensor gauge, and multi-convolution accordion silicone bellows cup that dynamically compresses upon vacuum seal.
- **⚡ PyBullet Rigid-Body Dynamics**: Integrated physics backend simulating gravity, inertia, contact friction, restitution, and physical workpiece attachment.
- **📐 Real-Time Kinematics Engine**:
  - **Forward Kinematics (FK)**: Computes real-time end-effector tip $(X, Y, Z)$ coordinates with sub-millimeter precision.
  - **Inverse Kinematics (IK)**: Damped Least-Squares solver capable of automatically reaching and descending onto any coordinate in the circular workcell.
- **🔄 Dual Operation Modes**:
  - **⚡ Autonomous Cycle**: Automated trajectory planning to pick the workpiece from anywhere in the workcell, lift, transfer, place at destination, and return home.
  - **🕹️ Manual Suction Control**: Direct joint jogging with live contact-distance measurement down to 0.1 mm, touch-activated vacuum grab (<kbd>G</kbd>) with automatic clearance lift, and release (<kbd>H</kbd>).
- **📍 Free Circular Workcell Placement**: Click anywhere on the 3D circular floor disc ($R \le 195\,\text{mm}$) to relocate the workpiece with a holographic cyan target reticle.
- **🎨 Futuristic Cyberpunk Dashboard**: 60 FPS client-side interpolation, OrbitControls, interactive joint sliders, and responsive telemetry panels.

---

## 🏛️ System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React 18 + Three.js)                  │
│                                                                        │
│   [OrbitControls 3D Viewport]        [Telemetry & Control Dashboard]   │
│   - Three.js 6-DOF Manipulator       - Joint Sliders & Speed Control   │
│   - Bellows Suction Tool Head        - Vacuum Gauge (-85 kPa / 0 kPa)  │
│   - Realistic Steel Workpiece        - Auto Cycle / Manual Suction     │
│   - Interactive Workcell Floor       - Free Placement Preset Matrix    │
│   - Real-time Keyboard Listener      - Live End-Effector FK Readout    │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
              WebSocket State Sync │ (bidirectional < 50ms)
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        BACKEND (Flask + Socket.IO)                     │
│                                                                        │
│   - State Manager (Thread-Safe)      - Forward Kinematics (FK)         │
│   - Smooth Trajectory Interpolation  - Inverse Kinematics (IK Solver)  │
│   - REST API & WebSocket Handlers    - Contact Distance Evaluator      │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
             Rigid-Body Simulation │ Step (60 Hz)
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     PHYSICS ENGINE (PyBullet 3.25)                     │
│                                                                        │
│   - Ground Plane & Table             - Contact Friction Dynamics       │
│   - Fixture Pedestals (A & B)        - Workpiece Rigid Body (0.35 kg)  │
│   - Vacuum Gripper Constraint Locks  - Gravity & Inelastic Collisions  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🦾 Kinematics & Manipulator Specifications

| Joint / Link | Axis | Range | Length | Description |
| :--- | :---: | :---: | :---: | :--- |
| **Base Joint** | Yaw ($Y$) | $-180^\circ \text{ to } +180^\circ$ | — | Turntable rotation on heavy steel foundation |
| **Shoulder Joint** | Pitch ($Z$) | $-90^\circ \text{ to } +90^\circ$ | $L_1 = 100\,\text{mm}$ | Primary boom arm elevation |
| **Elbow Joint** | Pitch ($Z$) | $-135^\circ \text{ to } +135^\circ$ | $L_2 = 80\,\text{mm}$ | Forearm articulation |
| **Wrist Pitch** | Pitch ($Z$) | $-90^\circ \text{ to } +90^\circ$ | $L_3 = 60\,\text{mm}$ | End-effector pitch orientation |
| **Wrist Roll** | Roll ($Y$) | $-180^\circ \text{ to } +180^\circ$ | — | Tool axial rotation |
| **Suction Cup Head** | — | — | $36\,\text{mm}$ | Silicone bellows cup + manifold ($L_{\text{tool}} = 96\,\text{mm}$) |

### Forward Kinematics (FK)
$$\alpha_1 = \theta_{\text{shoulder}}, \quad \alpha_2 = \alpha_1 + \theta_{\text{elbow}}, \quad \alpha_3 = \alpha_2 + \theta_{\text{wrist\_pitch}}$$
$$R = -L_1 \sin(\alpha_1) - L_2 \sin(\alpha_2) - L_3 \sin(\alpha_3)$$
$$Y = 44 + L_1 \cos(\alpha_1) + L_2 \cos(\alpha_2) + L_3 \cos(\alpha_3)$$
$$X = R \cos(\theta_{\text{base}}), \quad Z = -R \sin(\theta_{\text{base}})$$

---

## 🕹️ Controls & Key Bindings

### Keyboard Controls
| Key | Action | Description |
| :---: | :--- | :--- |
| <kbd>A</kbd> / <kbd>D</kbd> | **Base $\leftarrow / \rightarrow$** | Rotate base turntable left / right |
| <kbd>W</kbd> / <kbd>S</kbd> | **Shoulder $\uparrow / \downarrow$** | Elevate / lower shoulder boom |
| <kbd>Q</kbd> / <kbd>E</kbd> | **Elbow $+ / -$** | Extend / curl elbow joint |
| <kbd>R</kbd> / <kbd>F</kbd> | **Wrist Pitch $+ / -$** | Tilt suction tool head up / down |
| <kbd>Z</kbd> / <kbd>X</kbd> | **Wrist Roll $+ / -$** | Rotate suction tool head axially |
| <kbd>G</kbd> | **🧲 Manual Suction Grab** | Seal vacuum ($-85\,\text{kPa}$), lock part, and execute clearance lift |
| <kbd>H</kbd> | **💨 Vacuum Release / Drop** | Vent vacuum ($0\,\text{kPa}$) and deposit part at current position |
| <kbd>P</kbd> | **▲ Auto Suction Pick** | Autonomously align, descend, grab, and lift from anywhere |
| <kbd>O</kbd> | **▼ Auto Suction Place** | Autonomously transfer, lower, release, and return Home |
| <kbd>Space</kbd> | **🏠 Standby Home** | Smoothly return arm to neutral standby pose |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v16 or higher) & `npm`
- **Python** (v3.10 or higher)

---

### Quick Launch (Windows)

Simply double-click the included batch launcher:
```bat
START_ROBOARM.bat
```
This automatically starts the Flask PyBullet backend on port `5001` and the React frontend on port `3001`, then opens your default browser.

---

### Manual Setup

#### 1. Backend Setup
```bash
cd backend
python -m venv env
# On Windows:
.\env\Scripts\activate
# On Linux/macOS:
source env/bin/activate

pip install -r requirements.txt
python app.py
```
*Backend runs on `http://localhost:5001`.*

#### 2. Frontend Setup
```bash
cd frontend
npm install
npm start
```
*Frontend opens at `http://localhost:3001`.*

---

## 📡 REST & WebSocket API

| Endpoint | Method | Payload | Description |
| :--- | :---: | :---: | :--- |
| `/api/state` | `GET` | — | Returns full telemetry (joints, end-effector, vacuum, part pos) |
| `/api/joint/<name>` | `POST` | `{"angle": 45}` or `{"delta": 5}` | Moves a single joint to target angle or by delta |
| `/api/pick` | `POST` | — | Initiates automated IK pick sequence |
| `/api/drop` | `POST` | — | Initiates automated IK transfer and placement sequence |
| `/api/manual_grab` | `POST` | `{"force": false}` | Engages suction and locks workpiece if within contact range |
| `/api/manual_release` | `POST` | — | Vents suction and drops workpiece at current coordinates |
| `/api/place_object` | `POST` | `{"x": 140.0, "z": 0.0}` | Repositions workpiece anywhere in the circular workcell |
| `/api/home` | `POST` | — | Smoothly animates arm back to standby home position |
| `/api/reset` | `POST` | — | Resets arm and workpiece back to Station A initial state |

---

## 📂 Project Structure

```
├── backend/
│   ├── app.py                 # Flask server, WebSocket handlers, kinematics & state manager
│   ├── pybullet_engine.py     # PyBullet rigid-body physics, constraints & collisions
│   ├── arduino_controller.py  # Hardware microcontroller serial bridge
│   └── requirements.txt       # Python dependencies (Flask, Flask-SocketIO, pybullet, numpy)
│
├── frontend/
│   ├── public/
│   │   └── index.html         # Web application shell & metadata
│   ├── src/
│   │   ├── App.js             # Main dashboard UI, mode switcher, and key bindings
│   │   ├── RoboArm3D.js       # Three.js 6-DOF arm model, suction cup & workcell scene
│   │   ├── useRoboArm.js      # WebSocket state sync & REST API client hook
│   │   ├── useGamepad.js      # HTML5 Gamepad API controller hook with haptic rumble
│   │   ├── index.css          # Cyberpunk dark industrial design system
│   │   └── index.js           # React root mounting point
│   └── package.json           # React & Three.js dependencies
│
├── START_ROBOARM.bat          # 1-click launcher for frontend and backend
├── .gitignore                 # Excludes node_modules, Python virtual environments & build artifacts
└── README.md                  # Complete project documentation
```

---

## 📜 License

Distributed under the **MIT License**. Feel free to use, modify, and distribute for educational, research, and commercial applications.
