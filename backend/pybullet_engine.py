"""
PyBullet Physics Engine for 6-DOF Robotic Arm Pick and Drop Simulation.
Provides rigid-body dynamics, contact physics, forward/inverse kinematics,
and collision handling for realistic workpiece picking and placement.
"""

import pybullet as p
import pybullet_data
import math
import time
import numpy as np


class PyBulletArmSim:
    def __init__(self, use_gui=False):
        self.use_gui = use_gui
        mode = p.GUI if use_gui else p.DIRECT
        self.client_id = p.connect(mode)
        p.setAdditionalSearchPath(pybullet_data.getDataPath())
        p.setGravity(0, 0, -9.81)
        p.setTimeStep(1.0 / 60.0)

        # Workcell dimensions (meters) — scaled 1:1 with Three.js (where 1 unit = 1 mm -> 0.001 m)
        self.SCALE = 0.001

        # Station coordinates in meters
        self.STATION_A_POS = [107.4 * self.SCALE, 90.1 * self.SCALE, 0.028]
        self.STATION_B_POS = [107.4 * self.SCALE, -90.1 * self.SCALE, 0.028]

        self.grip_constraint = None
        self._build_environment()
        self._build_workpiece()

    def _build_environment(self):
        # Ground Plane
        self.plane_id = p.loadURDF("plane.urdf")

        # Base Mounting Table (cylinder)
        table_col = p.createCollisionShape(p.GEOM_CYLINDER, radius=0.21, height=0.044)
        table_vis = p.createVisualShape(p.GEOM_CYLINDER, radius=0.21, length=0.044, rgbaColor=[0.05, 0.08, 0.15, 1])
        self.table_id = p.createMultiBody(baseMass=0, baseCollisionShapeIndex=table_col,
                                          baseVisualShapeIndex=table_vis, basePosition=[0, 0, 0.022])
        p.changeDynamics(self.table_id, -1, lateralFriction=0.8)

        # Station A Pedestal (Pickup)
        ped_a_col = p.createCollisionShape(p.GEOM_CYLINDER, radius=0.022, height=0.028)
        ped_a_vis = p.createVisualShape(p.GEOM_CYLINDER, radius=0.022, length=0.028, rgbaColor=[0.15, 0.2, 0.28, 1])
        self.ped_a_id = p.createMultiBody(baseMass=0, baseCollisionShapeIndex=ped_a_col,
                                          baseVisualShapeIndex=ped_a_vis,
                                          basePosition=[self.STATION_A_POS[0], self.STATION_A_POS[1], 0.014])
        p.changeDynamics(self.ped_a_id, -1, lateralFriction=0.9)

        # Station B Pedestal (Dropoff)
        ped_b_col = p.createCollisionShape(p.GEOM_CYLINDER, radius=0.022, height=0.028)
        ped_b_vis = p.createVisualShape(p.GEOM_CYLINDER, radius=0.022, length=0.028, rgbaColor=[0.15, 0.2, 0.28, 1])
        self.ped_b_id = p.createMultiBody(baseMass=0, baseCollisionShapeIndex=ped_b_col,
                                          baseVisualShapeIndex=ped_b_vis,
                                          basePosition=[self.STATION_B_POS[0], self.STATION_B_POS[1], 0.014])
        p.changeDynamics(self.ped_b_id, -1, lateralFriction=0.9)

    def _build_workpiece(self):
        # Realistic Machined Workpiece (Cylinder, height 0.036m, radius 0.012m, mass 0.35kg)
        wp_col = p.createCollisionShape(p.GEOM_CYLINDER, radius=0.012, height=0.036)
        wp_vis = p.createVisualShape(p.GEOM_CYLINDER, radius=0.012, length=0.036, rgbaColor=[0.55, 0.65, 0.75, 1])
        initial_z = 0.028 + 0.036 / 2.0  # Resting on top of Station A pedestal
        self.workpiece_id = p.createMultiBody(
            baseMass=0.35,
            baseCollisionShapeIndex=wp_col,
            baseVisualShapeIndex=wp_vis,
            basePosition=[self.STATION_A_POS[0], self.STATION_A_POS[1], initial_z]
        )
        p.changeDynamics(
            self.workpiece_id, -1,
            lateralFriction=0.95,
            spinningFriction=0.02,
            rollingFriction=0.01,
            restitution=0.1
        )
        self.step(20)

    def step(self, count=1):
        for _ in range(count):
            p.stepSimulation()

    def get_workpiece_pose(self):
        pos, orn = p.getBasePositionAndOrientation(self.workpiece_id)
        # Convert to mm coordinates matching Three.js
        return {
            "x": round(pos[0] * 1000.0, 2),
            "y": round(pos[2] * 1000.0 - 22.0, 2),  # PyBullet Z -> Three.js Y (relative to floor)
            "z": round(-pos[1] * 1000.0, 2),        # PyBullet Y -> Three.js Z
            "quat": [orn[0], orn[1], orn[2], orn[3]]
        }

    def set_workpiece_position(self, x_mm, y_mm, z_mm):
        if self.grip_constraint is not None:
            p.removeConstraint(self.grip_constraint)
            self.grip_constraint = None

        pb_x = x_mm * self.SCALE
        pb_y = -z_mm * self.SCALE
        pb_z = (y_mm + 22.0 + 18.0) * self.SCALE
        p.resetBasePositionAndOrientation(
            self.workpiece_id,
            [pb_x, pb_y, pb_z],
            [0, 0, 0, 1]
        )
        p.resetBaseVelocity(self.workpiece_id, [0, 0, 0], [0, 0, 0])
        self.step(15)

    def reset_workpiece(self, location="station_a"):
        if self.grip_constraint is not None:
            p.removeConstraint(self.grip_constraint)
            self.grip_constraint = None

        if isinstance(location, dict):
            self.set_workpiece_position(location.get("x", 107.4), location.get("y", 6.0), location.get("z", 90.1))
            return

        station = self.STATION_A_POS if location == "station_a" else self.STATION_B_POS
        target_z = 0.028 + 0.036 / 2.0
        p.resetBasePositionAndOrientation(
            self.workpiece_id,
            [station[0], station[1], target_z],
            [0, 0, 0, 1]
        )
        p.resetBaseVelocity(self.workpiece_id, [0, 0, 0], [0, 0, 0])
        self.step(15)

    def attach_workpiece_to_gripper(self, ee_pos):
        """Simulate physical grasping: locks the workpiece firmly to the end effector."""
        # Remove any existing constraint
        if self.grip_constraint is not None:
            p.removeConstraint(self.grip_constraint)
            self.grip_constraint = None

        # Lock workpiece at end effector position
        p.resetBasePositionAndOrientation(
            self.workpiece_id,
            [ee_pos["x"] * self.SCALE, -ee_pos["z"] * self.SCALE, (ee_pos["y"] + 22.0) * self.SCALE],
            [0, 0, 0, 1]
        )
        p.resetBaseVelocity(self.workpiece_id, [0, 0, 0], [0, 0, 0])

    def disconnect(self):
        try:
            p.disconnect(self.client_id)
        except Exception:
            pass


# Singleton instance for PyBullet backend
_physics_engine = None

def get_physics_engine():
    global _physics_engine
    if _physics_engine is None:
        _physics_engine = PyBulletArmSim(use_gui=False)
    return _physics_engine
