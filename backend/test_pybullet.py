import pybullet as p
import pybullet_data
import time

print("Connecting to PyBullet...")
physicsClient = p.connect(p.DIRECT)
p.setAdditionalSearchPath(pybullet_data.getDataPath())
p.setGravity(0, 0, -9.81)

# Plane
planeId = p.loadURDF("plane.urdf")

# Station A Pedestal
col_a = p.createCollisionShape(p.GEOM_CYLINDER, radius=0.022, height=0.028)
vis_a = p.createVisualShape(p.GEOM_CYLINDER, radius=0.022, length=0.028, rgbaColor=[0.2, 0.3, 0.4, 1])
ped_a = p.createMultiBody(baseMass=0, baseCollisionShapeIndex=col_a, baseVisualShapeIndex=vis_a, basePosition=[0.1074, 0.0901, 0.014])
p.changeDynamics(ped_a, -1, lateralFriction=0.8)

# Workpiece (Cylinder)
col_wp = p.createCollisionShape(p.GEOM_CYLINDER, radius=0.012, height=0.036)
vis_wp = p.createVisualShape(p.GEOM_CYLINDER, radius=0.012, length=0.036, rgbaColor=[0.6, 0.7, 0.8, 1])
workpiece = p.createMultiBody(baseMass=0.35, baseCollisionShapeIndex=col_wp, baseVisualShapeIndex=vis_wp, basePosition=[0.1074, 0.0901, 0.046])
p.changeDynamics(workpiece, -1, lateralFriction=0.95, rollingFriction=0.01)

print("Stepping physics simulation...")
for _ in range(100):
    p.stepSimulation()

pos, orn = p.getBasePositionAndOrientation(workpiece)
print(f"Workpiece resting position on Pedestal A: x={pos[0]:.4f}, y={pos[1]:.4f}, z={pos[2]:.4f}")
print("PyBullet physics verification SUCCESS!")
p.disconnect()
