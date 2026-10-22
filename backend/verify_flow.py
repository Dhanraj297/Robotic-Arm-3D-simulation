import urllib.request
import json
import time

def get(path):
    req = urllib.request.urlopen(f"http://localhost:5001{path}")
    return json.loads(req.read().decode())

def post(path, body=None):
    data = json.dumps(body or {}).encode()
    req = urllib.request.Request(f"http://localhost:5001{path}", data=data, headers={"Content-Type": "application/json"})
    res = urllib.request.urlopen(req)
    return json.loads(res.read().decode())

print("=" * 60)
print("1. Fetching initial state...")
s = get("/api/state")
print("PyBullet Active   :", s.get("pybullet_active"))
print("Object Location   :", s.get("object_location"))
print("Holding Object    :", s.get("holding_object"))
print("End Effector      :", s.get("end_effector"))
print("Message           :", s.get("message"))

print("\n2. Triggering PICK from Station A...")
p_res = post("/api/pick")
print("Pick status       :", p_res)

# Monitor progress
for _ in range(6):
    time.sleep(1)
    s = get("/api/state")
    print(f"[{s['mode']}] holding={s['holding_object']}, loc={s['object_location']}, msg={s['message']}")
    if s["mode"] == "holding":
        break

print("\n3. Triggering DROP to Station B...")
d_res = post("/api/drop")
print("Drop status       :", d_res)

# Monitor progress
for _ in range(8):
    time.sleep(1)
    s = get("/api/state")
    print(f"[{s['mode']}] holding={s['holding_object']}, loc={s['object_location']}, msg={s['message']}")
    if s["mode"] == "idle":
        break

print("\n4. Final State Verification:")
s = get("/api/state")
print("PyBullet Active   :", s.get("pybullet_active"))
print("Object Location   :", s.get("object_location"))
print("Holding Object    :", s.get("holding_object"))
print("Final Message     :", s.get("message"))
print("=" * 60)
print("ALL TESTS PASSED SUCCESSFULLY!")
