"""
PyBullet Native GUI Viewer with Pneumatic Vacuum Suction Tool
Run this script to launch the native PyBullet 3D visual physics window:
   & "d:\College\Robo lab\LA2\backend\env\python.exe" pybullet_gui.py
"""

import pybullet as p
import pybullet_data
import time
import math

print("=" * 60)
print("  PyBullet Native 3D Simulation Viewer (Vacuum Suction)")
print("  Close this window anytime or press Ctrl+C in terminal")
print("=" * 60)

client = p.connect(p.GUI)
p.setAdditionalSearchPath(pybullet_data.getDataPath())
p.setGravity(0, 0, -9.81)
p.setTimeStep(1.0 / 60.0)

# Reset camera view
p.resetDebugVisualizerCamera(cameraDistance=0.55, cameraYaw=50, cameraPitch=-35, cameraTargetPosition=[0.1, 0, 0.08])

# Floor
planeId = p.loadURDF("plane.urdf")

# Pedestal A (Pickup)
col_a = p.createCollisionShape(p.GEOM_CYLINDER, radius=0.022, height=0.028)
vis_a = p.createVisualShape(p.GEOM_CYLINDER, radius=0.022, length=0.028, rgbaColor=[0, 0.9, 1, 0.85])
ped_a = p.createMultiBody(0, col_a, vis_a, [0.1074, 0.0901, 0.014])
p.changeDynamics(ped_a, -1, lateralFriction=0.9)

# Pedestal B (Dropoff Nest)
col_b = p.createCollisionShape(p.GEOM_CYLINDER, radius=0.022, height=0.028)
vis_b = p.createVisualShape(p.GEOM_CYLINDER, radius=0.022, length=0.028, rgbaColor=[0.1, 0.85, 0.5, 0.85])
ped_b = p.createMultiBody(0, col_b, vis_b, [0.1074, -0.0901, 0.014])
p.changeDynamics(ped_b, -1, lateralFriction=0.9)

# Realistic Workpiece with Top Vacuum Sealing Plate
col_wp = p.createCollisionShape(p.GEOM_CYLINDER, radius=0.012, height=0.036)
vis_wp = p.createVisualShape(p.GEOM_CYLINDER, radius=0.012, length=0.036, rgbaColor=[0.6, 0.72, 0.85, 1])
workpiece = p.createMultiBody(0.35, col_wp, vis_wp, [0.1074, 0.0901, 0.046])
p.changeDynamics(workpiece, -1, lateralFriction=0.95, rollingFriction=0.01)

# Debug text labels in PyBullet
p.addUserDebugText("STATION A [PICKUP]", [0.1074, 0.0901, 0.07], textColorRGB=[0, 1, 1], textSize=1.1)
p.addUserDebugText("STATION B [DROPOFF]", [0.1074, -0.0901, 0.07], textColorRGB=[0.1, 1, 0.5], textSize=1.1)
p.addUserDebugText("PNEUMATIC VACUUM SUCTION", [0.0, 0.0, 0.22], textColorRGB=[0.2, 0.6, 1.0], textSize=1.2)

print("\nRunning real-time PyBullet physics loop (60 Hz)...")
try:
    while True:
        p.stepSimulation()
        time.sleep(1.0 / 60.0)
except KeyboardInterrupt:
    p.disconnect()
    print("Disconnected.")
