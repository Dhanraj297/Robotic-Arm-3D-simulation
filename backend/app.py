"""
RoboArm Backend - Flask + Socket.IO (threading mode)
6-DOF Robotic Arm Simulation with real-time WebSocket state sync,
Analytical Inverse Kinematics for free circular area placement,
Automatic Pick & Place, and Manual Suction Grab & Release.
"""

import os
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import math
import time
import threading
import numpy as np

FRONTEND_BUILD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "build"))
STATIC_DIR = os.path.join(FRONTEND_BUILD_DIR, "static")

app = Flask(
    __name__,
    static_folder=STATIC_DIR if os.path.exists(STATIC_DIR) else None,
    static_url_path="/static"
)
app.config['SECRET_KEY'] = 'roboarm_secret_2024'
CORS(app, origins="*")
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# ─────────────────────────────────────────────────────────────────────────────
#  Constants & Default Positions
# ─────────────────────────────────────────────────────────────────────────────
L1, L2, L3 = 100.0, 80.0, 96.0   # link lengths (mm), L3 includes wrist to suction cup lip

STATION_A_DEFAULT = {"x": 107.4, "y": 6.0, "z": 90.1}
STATION_B_DEFAULT = {"x": 107.4, "y": 6.0, "z": -90.1}

# ─────────────────────────────────────────────────────────────────────────────
#  Arm State (shared across threads — protected by a lock)
# ─────────────────────────────────────────────────────────────────────────────
state_lock = threading.Lock()

arm_state = {
    "joints": {
        "base":        {"angle": 0.0,   "min": -180, "max": 180,  "label": "Base Rotation"},
        "shoulder":    {"angle": 45.0,  "min": -90,  "max": 90,   "label": "Shoulder"},
        "elbow":       {"angle": -30.0, "min": -135, "max": 135,  "label": "Elbow"},
        "wrist_pitch": {"angle": 0.0,   "min": -90,  "max": 90,   "label": "Wrist Pitch"},
        "wrist_roll":  {"angle": 0.0,   "min": -180, "max": 180,  "label": "Wrist Roll"},
        "gripper":     {"angle": 0.0,   "min": 0,    "max": 100,  "label": "Vacuum Suction (%)"},
    },
    "mode": "idle",
    "control_mode": "auto",           # "auto" | "manual"
    "holding_object": False,
    "suction_active": False,
    "vacuum_kpa": 0.0,
    "object_location": "station_a",   # "station_a" | "station_b" | "floor" | "gripper"
    "object_pos": {"x": 107.4, "y": 6.0, "z": 90.1},
    "target_place_pos": {"x": 107.4, "y": 6.0, "z": -90.1},
    "last_picked_from": "station_a",
    "animation_active": False,
    "speed": 5,
    "end_effector": {"x": 0.0, "y": 0.0, "z": 0.0},
    "distance_to_part": 0.0,
    "can_grab": False,
    "message": "Ready — Use Auto Cycle or Manual Suction. Click floor to position part.",
}

# ─────────────────────────────────────────────────────────────────────────────
#  Forward Kinematics
# ─────────────────────────────────────────────────────────────────────────────
def compute_fk(joints):
    base_r  = math.radians(joints["base"]["angle"])
    sh_r    = math.radians(joints["shoulder"]["angle"])
    el_r    = math.radians(joints["elbow"]["angle"])
    wr_r    = math.radians(joints["wrist_pitch"]["angle"])

    a1 = sh_r
    a2 = a1 + el_r
    a3 = a2 + wr_r

    R = -L1*math.sin(a1) - L2*math.sin(a2) - L3*math.sin(a3)
    y = 44.0 + L1*math.cos(a1) + L2*math.cos(a2) + L3*math.cos(a3)

    return {
        "x": round(R * math.cos(base_r), 2),
        "y": round(y, 2),
        "z": round(-R * math.sin(base_r), 2),
    }


def clamp(joint_name, angle):
    j = arm_state["joints"][joint_name]
    return max(j["min"], min(j["max"], float(angle)))


# ─────────────────────────────────────────────────────────────────────────────
#  Inverse Kinematics Solver (Reach anywhere in circular area - Pure Python Math)
# ─────────────────────────────────────────────────────────────────────────────
def _matmul3x3(A, B):
    return [[sum(A[i][k] * B[k][j] for k in range(3)) for j in range(3)] for i in range(3)]

def _matvec3(A, v):
    return [sum(A[i][j] * v[j] for j in range(3)) for i in range(3)]

def _transpose3(A):
    return [[A[j][i] for j in range(3)] for i in range(3)]

def _inv3(M):
    m00, m01, m02 = float(M[0][0]), float(M[0][1]), float(M[0][2])
    m10, m11, m12 = float(M[1][0]), float(M[1][1]), float(M[1][2])
    m20, m21, m22 = float(M[2][0]), float(M[2][1]), float(M[2][2])
    det = (m00 * (m11 * m22 - m12 * m21) -
           m01 * (m10 * m22 - m12 * m20) +
           m02 * (m10 * m21 - m11 * m20))
    if abs(det) < 1e-12:
        return [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]]
    invdet = 1.0 / det
    return [
        [(m11 * m22 - m12 * m21) * invdet, (m02 * m21 - m01 * m22) * invdet, (m01 * m12 - m02 * m11) * invdet],
        [(m12 * m20 - m10 * m22) * invdet, (m00 * m22 - m02 * m20) * invdet, (m02 * m10 - m00 * m12) * invdet],
        [(m10 * m21 - m11 * m20) * invdet, (m01 * m20 - m00 * m21) * invdet, (m00 * m11 - m01 * m10) * invdet],
    ]

def solve_ik(target_x, target_z, target_y, init_guess=(-24.0, -79.0, -64.0)):
    """Solves for (base, shoulder, elbow, wrist_pitch) to reach (target_x, target_y, target_z)."""
    target_r = math.sqrt(target_x**2 + target_z**2)
    base_deg = math.degrees(math.atan2(-target_z, target_x))
    q = [float(init_guess[0]), float(init_guess[1]), float(init_guess[2])]

    for _ in range(60):
        s_rad, e_rad, w_rad = math.radians(q[0]), math.radians(q[1]), math.radians(q[2])
        a1, a2, a3 = s_rad, s_rad + e_rad, s_rad + e_rad + w_rad
        r = -L1*math.sin(a1) - L2*math.sin(a2) - L3*math.sin(a3)
        y = 44.0 + L1*math.cos(a1) + L2*math.cos(a2) + L3*math.cos(a3)
        err = [target_r - r, target_y - y, -165.0 - math.degrees(a3)]
        if math.sqrt(err[0]**2 + err[1]**2) < 0.15:
            break
        d2r = math.pi / 180.0
        dr_ds = (-L1*math.cos(a1) - L2*math.cos(a2) - L3*math.cos(a3)) * d2r
        dr_de = (-L2*math.cos(a2) - L3*math.cos(a3)) * d2r
        dr_dw = (-L3*math.cos(a3)) * d2r
        dy_ds = (-L1*math.sin(a1) - L2*math.sin(a2) - L3*math.sin(a3)) * d2r
        dy_de = (-L2*math.sin(a2) - L3*math.sin(a3)) * d2r
        dy_dw = (-L3*math.sin(a3)) * d2r
        J = [[dr_ds, dr_de, dr_dw], [dy_ds, dy_de, dy_dw], [0.15, 0.15, 0.15]]
        err_w = [err[0], err[1], 0.15 * err[2]]
        JT = _transpose3(J)
        JJT = _matmul3x3(J, JT)
        A = [[JJT[i][j] + (0.16 if i == j else 0.0) for j in range(3)] for i in range(3)]
        invA = _inv3(A)
        temp = _matvec3(invA, err_w)
        dq = _matvec3(JT, temp)
        for i in range(3):
            dq_clamped = max(-10.0, min(10.0, dq[i]))
            q[i] += dq_clamped
        q[0] = max(-85.0, min(45.0, q[0]))
        q[1] = max(-135.0, min(30.0, q[1]))
        q[2] = max(-90.0, min(90.0, q[2]))

    return {
        "base": round(base_deg, 2),
        "shoulder": round(q[0], 2),
        "elbow": round(q[1], 2),
        "wrist_pitch": round(q[2], 2),
        "wrist_roll": 0.0
    }


# ─────────────────────────────────────────────────────────────────────────────
#  PyBullet Physics Engine Integration
# ─────────────────────────────────────────────────────────────────────────────
try:
    from pybullet_engine import get_physics_engine
    physics = get_physics_engine()
    pybullet_available = True
    print("[PyBullet] Physics engine active (rigid-body dynamics & collisions)")
except Exception as e:
    physics = None
    pybullet_available = False
    print(f"[PyBullet] Running fallback mode: {e}")


def broadcast():
    with state_lock:
        ee = compute_fk(arm_state["joints"])
        arm_state["end_effector"] = ee
        arm_state["pybullet_active"] = pybullet_available

        # Calculate distance to workpiece top contact plate
        if not arm_state["holding_object"]:
            wp = arm_state["object_pos"]
            wp_contact_y = wp["y"] + 18.0
            dist = math.sqrt((ee["x"] - wp["x"])**2 + (ee["y"] - wp_contact_y)**2 + (ee["z"] - wp["z"])**2)
            arm_state["distance_to_part"] = round(dist, 1)
            arm_state["can_grab"] = dist <= 75.0
        else:
            arm_state["distance_to_part"] = 0.0
            arm_state["can_grab"] = False

        if physics and arm_state["holding_object"]:
            physics.attach_workpiece_to_gripper(ee)
        elif physics:
            physics.step(1)

        snapshot = {k: v for k, v in arm_state.items()}
    socketio.emit("arm_state", snapshot, namespace="/")


# ─────────────────────────────────────────────────────────────────────────────
#  Smooth Animation
# ─────────────────────────────────────────────────────────────────────────────
def smooth_step(t):
    """Cubic ease in-out."""
    return t * t * (3 - 2 * t)


def animate_multi(targets, steps=35, delay=0.025):
    with state_lock:
        starts = {k: arm_state["joints"][k]["angle"] for k in targets if k in arm_state["joints"]}
    for i in range(steps):
        t = smooth_step((i + 1) / steps)
        with state_lock:
            for joint, target in targets.items():
                if joint in arm_state["joints"]:
                    arm_state["joints"][joint]["angle"] = round(
                        starts[joint] + (target - starts[joint]) * t, 2)
        broadcast()
        time.sleep(delay)


# ─────────────────────────────────────────────────────────────────────────────
#  Realistic Pick & Place Sequences (Supports any coordinate in circular area)
# ─────────────────────────────────────────────────────────────────────────────
def pick_sequence():
    with state_lock:
        arm_state["mode"] = "picking"
        wp = dict(arm_state["object_pos"])
        loc = arm_state.get("object_location", "station_a")
        loc_desc = "Station A" if loc == "station_a" else ("Station B" if loc == "station_b" else f"Floor ({wp['x']:.0f}, {wp['z']:.0f})")
        arm_state["message"] = f"Aligning suction cup over {loc_desc}..."
    broadcast()

    # Target y for workpiece top plate:
    contact_y = 24.0 if wp['y'] > 0 else -2.5
    clearance_y = contact_y + 40.0

    clearance_joints = solve_ik(wp['x'], wp['z'], clearance_y)
    clearance_joints["gripper"] = 0
    contact_joints = solve_ik(wp['x'], wp['z'], contact_y)
    contact_joints["gripper"] = 0

    # Step 1: Align above workpiece at clearance height
    animate_multi(clearance_joints, steps=35)

    with state_lock:
        arm_state["message"] = f"Descending suction cup onto {loc_desc}..."
    broadcast()

    # Step 2: Descend vertically to contact top suction plate
    animate_multi(contact_joints, steps=25)

    with state_lock:
        arm_state["message"] = "Engaging vacuum suction (-85 kPa)..."
    broadcast()

    # Step 3: Vacuum pump pulls vacuum to -85 kPa (gripper 100)
    animate_multi({"gripper": 100}, steps=15)

    with state_lock:
        arm_state["holding_object"] = True
        arm_state["suction_active"] = True
        arm_state["vacuum_kpa"] = -85.0
        arm_state["object_location"] = "gripper"
        arm_state["last_picked_from"] = loc
        arm_state["message"] = "Vacuum sealed (-85 kPa). Lifting workpiece..."
        if physics:
            physics.attach_workpiece_to_gripper(arm_state["end_effector"])
    broadcast()

    # Step 4: Vertical lift back up to clearance
    animate_multi(clearance_joints, steps=25)

    # Step 5: Smooth intermediate transit pose
    animate_multi({
        "shoulder": 20,
        "elbow": -60,
        "wrist_pitch": -20
    }, steps=25)

    with state_lock:
        arm_state["mode"] = "holding"
        arm_state["message"] = "Workpiece secured by vacuum. Ready to place."
        arm_state["animation_active"] = False
    broadcast()


def drop_sequence():
    with state_lock:
        arm_state["mode"] = "dropping"
        last_from = arm_state.get("last_picked_from", "station_a")
        target_dest = dict(arm_state.get("target_place_pos", STATION_B_DEFAULT))

        # Default alternate if target was same as pickup station
        if last_from == "station_a" and abs(target_dest['z'] - 90.1) < 10:
            target_dest = dict(STATION_B_DEFAULT)
        elif last_from == "station_b" and abs(target_dest['z'] + 90.1) < 10:
            target_dest = dict(STATION_A_DEFAULT)

        target_name = "Station B" if abs(target_dest['z'] + 90.1) < 10 else ("Station A" if abs(target_dest['z'] - 90.1) < 10 else f"Floor ({target_dest['x']:.0f}, {target_dest['z']:.0f})")
        arm_state["message"] = f"Transferring workpiece to {target_name}..."
    broadcast()

    contact_y = 24.0 if target_dest['y'] > 0 else -2.5
    clearance_y = contact_y + 40.0

    clearance_joints = solve_ik(target_dest['x'], target_dest['z'], clearance_y)
    clearance_joints["gripper"] = 100
    contact_joints = solve_ik(target_dest['x'], target_dest['z'], contact_y)
    contact_joints["gripper"] = 100

    # Step 1: Swing over destination at clearance height
    animate_multi(clearance_joints, steps=40)

    with state_lock:
        arm_state["message"] = f"Lowering workpiece into {target_name}..."
    broadcast()

    # Step 2: Descend vertically to place on pad
    animate_multi(contact_joints, steps=25)

    with state_lock:
        arm_state["message"] = "Venting vacuum suction (0 kPa)..."
    broadcast()

    # Step 3: Vent vacuum
    animate_multi({"gripper": 0}, steps=15)

    with state_lock:
        arm_state["holding_object"] = False
        arm_state["suction_active"] = False
        arm_state["vacuum_kpa"] = 0.0
        arm_state["object_pos"] = target_dest
        loc = "station_b" if abs(target_dest['z'] + 90.1) < 10 else ("station_a" if abs(target_dest['z'] - 90.1) < 10 else "floor")
        arm_state["object_location"] = loc
        arm_state["last_picked_from"] = loc
        # Set alternate station as next default target
        arm_state["target_place_pos"] = dict(STATION_A_DEFAULT if loc == "station_b" else STATION_B_DEFAULT)
        arm_state["message"] = f"Workpiece seated on {target_name}."
        if physics:
            physics.set_workpiece_position(target_dest['x'], target_dest['y'], target_dest['z'])
    broadcast()

    # Step 4: Vertical clearance lift away
    animate_multi(clearance_joints, steps=25)

    # Step 5: Standby Home pose
    animate_multi({
        "base": 0, "shoulder": 45, "elbow": -30, "wrist_pitch": 0, "gripper": 0
    }, steps=35)

    with state_lock:
        arm_state["mode"] = "idle"
        arm_state["message"] = f"Placement complete at {target_name}. Ready."
        arm_state["animation_active"] = False
    broadcast()


def home_sequence():
    with state_lock:
        arm_state["mode"] = "moving"
        arm_state["message"] = "Homing arm to standby pose..."
    broadcast()

    animate_multi({
        "base": 0, "shoulder": 45, "elbow": -30,
        "wrist_pitch": 0, "wrist_roll": 0
    }, steps=40)

    with state_lock:
        arm_state["mode"] = "idle"
        arm_state["message"] = "Home position reached."
        arm_state["animation_active"] = False
    broadcast()


def _run(fn):
    t = threading.Thread(target=fn, daemon=True)
    t.start()


# ─────────────────────────────────────────────────────────────────────────────
#  REST API
# ─────────────────────────────────────────────────────────────────────────────
@app.route("/api/state", methods=["GET"])
def get_state():
    with state_lock:
        arm_state["end_effector"] = compute_fk(arm_state["joints"])
        return jsonify(dict(arm_state))


@app.route("/api/joint/<joint_name>", methods=["POST"])
def set_joint(joint_name):
    if joint_name not in arm_state["joints"]:
        return jsonify({"error": "Unknown joint"}), 400
    data = request.get_json() or {}
    with state_lock:
        cur = arm_state["joints"][joint_name]["angle"]
        if "angle" in data:
            new_angle = clamp(joint_name, data["angle"])
        else:
            new_angle = clamp(joint_name, cur + data.get("delta", 0))
        arm_state["joints"][joint_name]["angle"] = new_angle
        if joint_name == "gripper":
            arm_state["suction_active"] = new_angle > 40
            arm_state["vacuum_kpa"] = round(-85.0 * (new_angle / 100.0), 1)
    broadcast()
    return jsonify({"joint": joint_name, "angle": new_angle})


@app.route("/api/pick", methods=["POST"])
def pick():
    with state_lock:
        if arm_state["holding_object"]:
            return jsonify({"error": "Already holding object"}), 400
        if arm_state["animation_active"]:
            return jsonify({"error": "Animation in progress"}), 400
        arm_state["animation_active"] = True
    _run(pick_sequence)
    return jsonify({"status": "picking"})


@app.route("/api/drop", methods=["POST"])
def drop():
    with state_lock:
        if not arm_state["holding_object"]:
            return jsonify({"error": "Not holding any object"}), 400
        if arm_state["animation_active"]:
            return jsonify({"error": "Animation in progress"}), 400
        arm_state["animation_active"] = True
    _run(drop_sequence)
    return jsonify({"status": "dropping"})


def do_manual_grab(force=False, lift=True):
    """Executes manual suction grab when suction cup is near or touching workpiece."""
    with state_lock:
        if arm_state["animation_active"]:
            return False, "Animation in progress"
        if arm_state["holding_object"]:
            return False, "Already holding object"

        ee = arm_state["end_effector"]
        wp = arm_state["object_pos"]
        wp_contact_y = wp["y"] + 18.0
        dist = math.sqrt((ee["x"] - wp["x"])**2 + (ee["y"] - wp_contact_y)**2 + (ee["z"] - wp["z"])**2)

        # Allow generous touch contact threshold up to 75mm
        if dist > 75.0 and not force:
            return False, f"Suction cup too far ({dist:.1f} mm). Align over workpiece top."

        arm_state["joints"]["gripper"]["angle"] = 100.0
        arm_state["suction_active"] = True
        arm_state["vacuum_kpa"] = -85.0
        arm_state["holding_object"] = True
        arm_state["object_location"] = "gripper"
        arm_state["message"] = "Manual Suction Engaged (-85 kPa)! Workpiece picked up."
        if physics:
            physics.attach_workpiece_to_gripper(ee)
    broadcast()

    # Gentle clearance lift (+10 deg on shoulder) so workpiece visibly lifts up
    if lift:
        with state_lock:
            cur_sh = arm_state["joints"]["shoulder"]["angle"]
            target_sh = clamp("shoulder", cur_sh + 10.0)
        animate_multi({"shoulder": target_sh}, steps=14, delay=0.015)

    return True, "Suction engaged"


def do_manual_release():
    """Vents suction and places workpiece at current arm coordinates."""
    with state_lock:
        if arm_state["animation_active"]:
            return False, "Animation in progress", None

        ee = arm_state["end_effector"]

        dist_a = math.sqrt((ee["x"] - 107.4)**2 + (ee["z"] - 90.1)**2)
        dist_b = math.sqrt((ee["x"] - 107.4)**2 + (ee["z"] + 90.1)**2)

        if dist_a < 35.0:
            drop_pos = dict(STATION_A_DEFAULT)
            loc = "station_a"
            loc_label = "Station A (Pickup Fixture)"
        elif dist_b < 35.0:
            drop_pos = dict(STATION_B_DEFAULT)
            loc = "station_b"
            loc_label = "Station B (Dropoff Nest)"
        else:
            R = math.sqrt(ee["x"]**2 + ee["z"]**2)
            if R > 195.0:
                scale = 195.0 / (R if R > 0 else 1)
                drop_x = round(ee["x"] * scale, 1)
                drop_z = round(ee["z"] * scale, 1)
            else:
                drop_x = round(ee["x"], 1)
                drop_z = round(ee["z"], 1)
            drop_pos = {"x": drop_x, "y": -20.5, "z": drop_z}
            loc = "floor"
            loc_label = f"Floor Spot ({drop_x:.1f}, {drop_z:.1f})"

        arm_state["joints"]["gripper"]["angle"] = 0.0
        arm_state["suction_active"] = False
        arm_state["vacuum_kpa"] = 0.0
        arm_state["holding_object"] = False
        arm_state["object_pos"] = drop_pos
        arm_state["object_location"] = loc
        arm_state["last_picked_from"] = loc
        arm_state["message"] = f"Suction vented (0 kPa). Workpiece deposited on {loc_label}."
        if physics:
            physics.set_workpiece_position(drop_pos["x"], drop_pos["y"], drop_pos["z"])
    broadcast()
    return True, "Workpiece released", drop_pos


@app.route("/api/manual_grab", methods=["POST"])
def manual_grab():
    data = request.get_json(silent=True) or {}
    force = data.get("force", False)
    success, msg = do_manual_grab(force=force, lift=True)
    if not success:
        return jsonify({"success": False, "message": msg}), 400
    return jsonify({"success": True, "message": msg})


@app.route("/api/manual_release", methods=["POST"])
def manual_release():
    success, msg, drop_pos = do_manual_release()
    if not success:
        return jsonify({"success": False, "message": msg}), 400
    return jsonify({"success": True, "message": msg, "object_pos": drop_pos})


@app.route("/api/place_object", methods=["POST"])
def place_object():
    """Places the workpiece anywhere on the circular floor area or at a station."""
    with state_lock:
        if arm_state["animation_active"] or arm_state["holding_object"]:
            return jsonify({"error": "Cannot reposition while holding or animating"}), 400

        data = request.get_json() or {}
        x = float(data.get("x", 107.4))
        z = float(data.get("z", 90.1))

        dist_a = math.sqrt((x - 107.4)**2 + (z - 90.1)**2)
        dist_b = math.sqrt((x - 107.4)**2 + (z + 90.1)**2)

        if dist_a < 25.0:
            pos = dict(STATION_A_DEFAULT)
            loc = "station_a"
            loc_label = "Station A (Pickup Fixture)"
        elif dist_b < 25.0:
            pos = dict(STATION_B_DEFAULT)
            loc = "station_b"
            loc_label = "Station B (Dropoff Nest)"
        else:
            R = math.sqrt(x**2 + z**2)
            if R > 195.0:
                scale = 195.0 / (R if R > 0 else 1)
                x = round(x * scale, 1)
                z = round(z * scale, 1)
            pos = {"x": round(x, 1), "y": -20.5, "z": round(z, 1)}
            loc = "floor"
            loc_label = f"Circular Floor ({x:.1f}, {z:.1f})"

        arm_state["object_pos"] = pos
        arm_state["object_location"] = loc
        arm_state["last_picked_from"] = loc
        arm_state["message"] = f"Workpiece placed at {loc_label}."
        if physics:
            physics.set_workpiece_position(pos["x"], pos["y"], pos["z"])
    broadcast()
    return jsonify({"success": True, "object_pos": pos, "location": loc})


@app.route("/api/home", methods=["POST"])
def home():
    with state_lock:
        if arm_state["animation_active"]:
            return jsonify({"error": "Animation in progress"}), 400
        arm_state["animation_active"] = True
    _run(home_sequence)
    return jsonify({"status": "homing"})


@app.route("/api/speed", methods=["POST"])
def set_speed():
    data = request.get_json() or {}
    speed = max(1, min(20, int(data.get("speed", 5))))
    with state_lock:
        arm_state["speed"] = speed
    return jsonify({"speed": speed})


@app.route("/api/reset_object", methods=["POST"])
def reset_object():
    with state_lock:
        if arm_state["animation_active"]:
            return jsonify({"error": "Animation in progress"}), 400
        data = request.get_json() or {}
        target_loc = data.get("location", "station_a")
        if target_loc == "station_b":
            pos = dict(STATION_B_DEFAULT)
            loc = "station_b"
        elif target_loc == "floor":
            pos = {"x": 140.0, "y": -20.5, "z": 0.0}
            loc = "floor"
        else:
            pos = dict(STATION_A_DEFAULT)
            loc = "station_a"

        arm_state["holding_object"] = False
        arm_state["suction_active"] = False
        arm_state["vacuum_kpa"] = 0.0
        arm_state["object_location"] = loc
        arm_state["object_pos"] = pos
        arm_state["last_picked_from"] = loc
        arm_state["message"] = f"Workpiece reset to {loc}."
        if physics:
            physics.set_workpiece_position(pos["x"], pos["y"], pos["z"])
    broadcast()
    return jsonify({"status": "ok", "object_location": loc, "object_pos": pos})


@app.route("/api/reset", methods=["POST"])
def reset():
    defaults = {"base": 0.0, "shoulder": 45.0, "elbow": -30.0,
                "wrist_pitch": 0.0, "wrist_roll": 0.0, "gripper": 0.0}
    with state_lock:
        if arm_state["animation_active"]:
            return jsonify({"error": "Animation in progress"}), 400
        for j, v in defaults.items():
            arm_state["joints"][j]["angle"] = float(v)
        arm_state["holding_object"] = False
        arm_state["suction_active"] = False
        arm_state["vacuum_kpa"] = 0.0
        arm_state["object_location"] = "station_a"
        arm_state["object_pos"] = dict(STATION_A_DEFAULT)
        arm_state["target_place_pos"] = dict(STATION_B_DEFAULT)
        arm_state["last_picked_from"] = "station_a"
        arm_state["mode"] = "idle"
        arm_state["message"] = "Arm & workpiece reset to Home / Station A."
        if physics:
            physics.reset_workpiece("station_a")
    broadcast()
    return jsonify({"status": "reset"})


# ─────────────────────────────────────────────────────────────────────────────
#  WebSocket
# ─────────────────────────────────────────────────────────────────────────────
@socketio.on("connect")
def on_connect():
    with state_lock:
        arm_state["end_effector"] = compute_fk(arm_state["joints"])
        snap = dict(arm_state)
    emit("arm_state", snap)
    print("[WS] Client connected")


@socketio.on("key_command")
def on_key_command(data):
    key = str(data.get("key", "")).lower()

    with state_lock:
        step = arm_state["speed"]
        anim_active = arm_state["animation_active"]
        holding = arm_state["holding_object"]

    key_map = {
        "a": ("base",        -step),
        "d": ("base",        +step),
        "w": ("shoulder",    +step),
        "s": ("shoulder",    -step),
        "q": ("elbow",       +step),
        "e": ("elbow",       -step),
        "r": ("wrist_pitch", +step),
        "f": ("wrist_pitch", -step),
        "z": ("wrist_roll",  +step),
        "x": ("wrist_roll",  -step),
    }

    if key in key_map:
        joint, delta = key_map[key]
        with state_lock:
            new_val = clamp(joint, arm_state["joints"][joint]["angle"] + delta)
            arm_state["joints"][joint]["angle"] = new_val
        broadcast()

    elif key == "g":
        # Press G: If touching or near workpiece, grab & pick it!
        if not holding and not anim_active:
            _run(lambda: do_manual_grab(force=False, lift=True))
        elif holding:
            with state_lock:
                arm_state["suction_active"] = True
                arm_state["vacuum_kpa"] = -85.0
            broadcast()

    elif key == "h":
        # Press H: Release / Drop workpiece at current spot
        if holding and not anim_active:
            do_manual_release()
        else:
            with state_lock:
                arm_state["suction_active"] = False
                arm_state["vacuum_kpa"] = 0.0
                arm_state["joints"]["gripper"]["angle"] = 0.0
            broadcast()

    elif key == "p" and not anim_active and not holding:
        with state_lock:
            arm_state["animation_active"] = True
        _run(pick_sequence)

    elif key == "o" and not anim_active and holding:
        with state_lock:
            arm_state["animation_active"] = True
        _run(drop_sequence)

    elif key == " " and not anim_active:
        with state_lock:
            arm_state["animation_active"] = True
        _run(home_sequence)


@socketio.on("disconnect")
def on_disconnect():
    print("[WS] Client disconnected")


# ─────────────────────────────────────────────────────────────────────────────
#  Static React Frontend Serving (Instant 1-Click Launch)
# ─────────────────────────────────────────────────────────────────────────────
FRONTEND_BUILD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "build"))

@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    if path != "" and os.path.exists(os.path.join(FRONTEND_BUILD_DIR, path)):
        return send_from_directory(FRONTEND_BUILD_DIR, path)
    index_file = os.path.join(FRONTEND_BUILD_DIR, "index.html")
    if os.path.exists(index_file):
        return send_from_directory(FRONTEND_BUILD_DIR, "index.html")
    return jsonify({
        "status": "RoboArm Backend Online",
        "message": "Frontend build not found. Run 'npm run build' in frontend directory."
    })


# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 56)
    print("  RoboArm Simulator  —  http://localhost:5001")
    print("=" * 56)
    socketio.run(app, host="0.0.0.0", port=5001, debug=False, allow_unsafe_werkzeug=True)
