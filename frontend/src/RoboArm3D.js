import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Cylinder, Sphere, Torus, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';

// ─── Color Palette ───────────────────────────────────────────────────────────
const C_BODY       = '#4e9dd4';   // steel blue — main arm links
const C_BODY2      = '#5bc4e6';   // light blue — shoulder link
const C_BODY3      = '#3a7fc1';   // mid blue — elbow link
const C_JOINT      = '#e8f4fd';   // near-white — joint spheres
const C_ACCENT     = '#00eeff';   // cyan glow
const C_BASE       = '#8a9ab5';   // slate — base plate
const C_TOOL_BODY  = '#1d4ed8';   // royal blue anodized aluminum — vacuum manifold
const C_SUCTION_CUP= '#38bdf8';   // translucent blue industrial silicone suction bellows
const C_HOSE       = '#0284c7';   // blue polyurethane pneumatic airline
const C_STEEL      = '#8fa0b5';   // brushed precision steel
const C_STEEL_DARK = '#334155';   // dark machined steel
const C_HAZARD     = '#f59e0b';   // industrial inspection amber/yellow
const C_GREEN      = '#10b981';   // delivery complete green / vacuum sealed green

function deg2rad(d) { return (d * Math.PI) / 180; }

// ─── Material Presets ────────────────────────────────────────────────────────
const matBody   = { metalness: 0.6,  roughness: 0.32 };
const matJoint  = { metalness: 0.88, roughness: 0.12 };
const matGlow   = { metalness: 0.9,  roughness: 0.05, emissive: C_ACCENT, emissiveIntensity: 0.7 };
const matSteel  = { metalness: 0.88, roughness: 0.22 };
const matDark   = { metalness: 0.82, roughness: 0.35 };

// Station World Positions (derived from kinematics: R=140.2 mm at ±40° base angle)
export const STATION_A_POS = [107.4, 6, 90.1];   // Pickup Station
export const STATION_B_POS = [107.4, 6, -90.1];  // Dropoff Nest

// ─── Base Platform ──────────────────────────────────────────────────────────
function Base() {
  return (
    <group>
      {/* Main disc */}
      <Cylinder args={[58, 68, 16, 40]}>
        <meshStandardMaterial color={C_BASE} {...matBody} />
      </Cylinder>
      {/* Glowing ring */}
      <Torus args={[56, 2.5, 12, 60]} rotation={[Math.PI / 2, 0, 0]} position={[0, 8, 0]}>
        <meshStandardMaterial color={C_ACCENT} {...matGlow} />
      </Torus>
      {/* Riser column */}
      <Cylinder args={[18, 24, 32, 20]} position={[0, 24, 0]}>
        <meshStandardMaterial color='#7a9cbe' {...matBody} />
      </Cylinder>
      {/* Top cap */}
      <Cylinder args={[21, 21, 6, 20]} position={[0, 41, 0]}>
        <meshStandardMaterial color={C_JOINT} {...matJoint} />
      </Cylinder>
      {/* Bolt ring */}
      {[0, 60, 120, 180, 240, 300].map(a => (
        <Cylinder key={a} args={[3.5, 3.5, 6, 6]}
          position={[46 * Math.cos(deg2rad(a)), 0, 46 * Math.sin(deg2rad(a))]}>
          <meshStandardMaterial color='#90aac8' metalness={0.9} roughness={0.1} />
        </Cylinder>
      ))}
    </group>
  );
}

// ─── Glowing Joint Sphere ───────────────────────────────────────────────────
function JointSphere({ radius = 13, primary = false }) {
  return (
    <Sphere args={[radius, 24, 24]}>
      <meshStandardMaterial
        color={primary ? C_ACCENT : C_JOINT}
        emissive={primary ? C_ACCENT : '#88ccee'}
        emissiveIntensity={primary ? 0.8 : 0.3}
        metalness={0.9}
        roughness={0.1}
      />
    </Sphere>
  );
}

// ─── Arm Link ───────────────────────────────────────────────────────────────
function Link({ length, rTop = 7, rBot = 9, color = C_BODY, accentColor = C_ACCENT }) {
  return (
    <group>
      <Cylinder args={[rTop, rBot, length, 16]} position={[0, length / 2, 0]}>
        <meshStandardMaterial color={color} {...matBody} />
      </Cylinder>
      {/* Dual accent stripes */}
      <Cylinder args={[1.5, 1.5, length * 0.75, 8]}
        position={[rBot * 0.85, length / 2, 0]}>
        <meshStandardMaterial color={accentColor} emissive={accentColor}
          emissiveIntensity={0.6} metalness={0.9} roughness={0.05} />
      </Cylinder>
      <Cylinder args={[1.5, 1.5, length * 0.75, 8]}
        position={[-rBot * 0.85, length / 2, 0]}>
        <meshStandardMaterial color={accentColor} emissive={accentColor}
          emissiveIntensity={0.4} metalness={0.9} roughness={0.05} />
      </Cylinder>
    </group>
  );
}

// ─── Realistic Workpiece with Polished Top Suction Sealing Boss ───────────────
export function RealisticWorkpiece({ position = [0, 0, 0], rotation = [0, 0, 0], isHeld = false }) {
  return (
    <group position={position} rotation={rotation}>
      {/* 1. Chamfered bottom lip */}
      <Cylinder args={[12, 10.5, 2.5, 32]} position={[0, 1.25, 0]}>
        <meshStandardMaterial color={C_STEEL} {...matSteel} />
      </Cylinder>

      {/* 2. Main precision cylindrical body */}
      <Cylinder args={[12, 12, 11.5, 32]} position={[0, 8.25, 0]}>
        <meshStandardMaterial color={C_STEEL} {...matSteel} />
      </Cylinder>

      {/* 3. Dark machined cooling/recess rings */}
      <Cylinder args={[12.18, 12.18, 0.7, 32]} position={[0, 4.2, 0]}>
        <meshStandardMaterial color={C_STEEL_DARK} {...matDark} />
      </Cylinder>
      <Cylinder args={[12.18, 12.18, 0.7, 32]} position={[0, 12.5, 0]}>
        <meshStandardMaterial color={C_STEEL_DARK} {...matDark} />
      </Cylinder>

      {/* 4. Industrial Inspection / Hazard Decal Band */}
      <Cylinder args={[12.12, 12.12, 4.5, 32]} position={[0, 8.5, 0]}>
        <meshStandardMaterial color={C_HAZARD} roughness={0.35} metalness={0.3} />
      </Cylinder>
      <Cylinder args={[12.18, 12.18, 0.4, 32]} position={[0, 6.2, 0]}>
        <meshStandardMaterial color='#090d16' roughness={0.5} />
      </Cylinder>
      <Cylinder args={[12.18, 12.18, 0.4, 32]} position={[0, 10.8, 0]}>
        <meshStandardMaterial color='#090d16' roughness={0.5} />
      </Cylinder>

      {/* 5. Intermediate neck cylinder */}
      <Cylinder args={[10.5, 11, 10, 32]} position={[0, 19, 0]}>
        <meshStandardMaterial color={C_STEEL_DARK} metalness={0.8} roughness={0.3} />
      </Cylinder>

      {/* 6. Flanged Top Collar */}
      <Cylinder args={[11.5, 10.5, 5, 32]} position={[0, 26.5, 0]}>
        <meshStandardMaterial color={C_STEEL} {...matSteel} />
      </Cylinder>

      {/* 7. Polished Flat Stainless Suction Sealing Disc (Top sealing face at Y=36) */}
      <Cylinder args={[12, 11.5, 4.5, 32]} position={[0, 31.25, 0]}>
        <meshStandardMaterial color='#cbd5e1' metalness={0.92} roughness={0.15} />
      </Cylinder>
      {/* Mirror-smooth suction sealing target plate */}
      <Cylinder args={[11.8, 11.8, 1.5, 32]} position={[0, 34.25, 0]}>
        <meshStandardMaterial color='#f1f5f9' metalness={0.98} roughness={0.06} />
      </Cylinder>
      {/* Concentric alignment laser crosshair ring */}
      <Torus args={[7, 0.35, 8, 32]} rotation={[Math.PI / 2, 0, 0]} position={[0, 35.1, 0]}>
        <meshStandardMaterial color='#0284c7' roughness={0.2} metalness={0.8} />
      </Torus>

      {/* 8. Contact shadow under object when resting on pedestal */}
      {!isHeld && (
        <Cylinder args={[12.5, 12.5, 0.2, 32]} position={[0, 0.1, 0]}>
          <meshBasicMaterial color='#020617' transparent opacity={0.65} />
        </Cylinder>
      )}
    </group>
  );
}

// ─── Pneumatic Vacuum Suction Tool Head ───────────────────────────────────────
// Industrial vacuum manifold, pneumatic airline, digital gauge, and bellows cup
function PneumaticSuctionGripper({ suctionActive, vacuumLevel = 0 }) {
  const bellowsRef = useRef();

  useFrame(() => {
    if (!bellowsRef.current) return;
    // Compress bellows cup along Y when vacuum suction is active
    const targetScaleY = suctionActive ? 0.86 : 1.0;
    bellowsRef.current.scale.y = THREE.MathUtils.lerp(
      bellowsRef.current.scale.y,
      targetScaleY,
      0.2
    );
  });

  const gaugeGlow = suctionActive ? 1.0 : 0.15;
  const gaugeColor = suctionActive ? C_GREEN : '#475569';

  return (
    <group>
      {/* Wrist Mounting Hub */}
      <Cylinder args={[10, 10, 6, 24]} position={[0, 3, 0]}>
        <meshStandardMaterial color='#94a3b8' metalness={0.9} roughness={0.18} />
      </Cylinder>

      {/* Vacuum Manifold Block */}
      <RoundedBox args={[22, 14, 20]} radius={2} smoothness={4} position={[0, 12, 0]}>
        <meshStandardMaterial color={C_TOOL_BODY} metalness={0.7} roughness={0.25} />
      </RoundedBox>

      {/* Pneumatic Quick-Connect Airline Fitting */}
      <group position={[11, 14, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <Cylinder args={[3.2, 3.2, 5, 16]}>
          <meshStandardMaterial color='#cbd5e1' metalness={0.95} roughness={0.1} />
        </Cylinder>
        {/* Blue Polyurethane Vacuum Hose */}
        <Torus args={[7, 1.4, 8, 24]} position={[0, 4, 0]} rotation={[0, Math.PI / 2, 0]}>
          <meshStandardMaterial color={C_HOSE} roughness={0.35} metalness={0.2} />
        </Torus>
      </group>

      {/* Digital Vacuum Sensor Display on front face */}
      <group position={[0, 12, 10.6]}>
        <RoundedBox args={[14, 7, 1.2]} radius={0.8} smoothness={2}>
          <meshStandardMaterial color='#090d16' roughness={0.9} />
        </RoundedBox>
        {/* Live Vacuum Sensor Screen */}
        <RoundedBox args={[11, 4.5, 0.4]} radius={0.4} smoothness={2} position={[0, 0, 0.6]}>
          <meshStandardMaterial
            color={gaugeColor}
            emissive={gaugeColor}
            emissiveIntensity={gaugeGlow}
            roughness={0.2}
          />
        </RoundedBox>
      </group>

      {/* Annular Status LED Ring around vacuum stem */}
      <Torus args={[9.5, 1.2, 8, 36]} position={[0, 19.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <meshStandardMaterial
          color={gaugeColor}
          emissive={gaugeColor}
          emissiveIntensity={suctionActive ? 1.0 : 0.2}
          metalness={0.9}
        />
      </Torus>

      {/* Stainless Vacuum Stem Pipe */}
      <Cylinder args={[4.5, 4.5, 6, 24]} position={[0, 22, 0]}>
        <meshStandardMaterial color='#e2e8f0' metalness={0.95} roughness={0.1} />
      </Cylinder>

      {/* ── Flexible Accordion Bellows Suction Cup ── */}
      <group ref={bellowsRef} position={[0, 25, 0]}>
        {/* Upper Bellows Convolution */}
        <Cylinder args={[5.5, 9.5, 4, 32]} position={[0, 2, 0]}>
          <meshStandardMaterial
            color={C_SUCTION_CUP}
            roughness={0.35}
            metalness={0.1}
            transparent
            opacity={0.88}
          />
        </Cylinder>
        {/* Middle Bellows Convolution */}
        <Cylinder args={[9.5, 7.5, 3.5, 32]} position={[0, 5.5, 0]}>
          <meshStandardMaterial
            color={C_SUCTION_CUP}
            roughness={0.35}
            metalness={0.1}
            transparent
            opacity={0.88}
          />
        </Cylinder>
        {/* Lower Sealing Flare */}
        <Cylinder args={[7.5, 11.5, 4, 32]} position={[0, 9, 0]}>
          <meshStandardMaterial
            color={C_SUCTION_CUP}
            roughness={0.35}
            metalness={0.1}
            transparent
            opacity={0.88}
          />
        </Cylinder>
        {/* Soft Vacuum Sealing Lip Ring (bottom contact plane at Y = 11 relative to stem) */}
        <Torus args={[11.5, 0.9, 8, 36]} position={[0, 11, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <meshStandardMaterial
            color={suctionActive ? '#38bdf8' : '#0284c7'}
            roughness={0.25}
            metalness={0.2}
            emissive={suctionActive ? '#0284c7' : '#000000'}
            emissiveIntensity={suctionActive ? 0.4 : 0}
          />
        </Torus>
      </group>
    </group>
  );
}

// ─── Industrial Station Pedestal ────────────────────────────────────────────
function StationPedestal({ position, label, hasObject, isDropStation = false }) {
  const activeColor = isDropStation ? C_GREEN : C_ACCENT;
  const ledGlow = hasObject ? 0.9 : 0.15;
  const ledColor = hasObject ? activeColor : (isDropStation ? '#064e3b' : '#083344');

  return (
    <group position={position}>
      {/* Floor mounting flange */}
      <Cylinder args={[26, 30, 6, 32]} position={[0, 3, 0]}>
        <meshStandardMaterial color='#1e293b' metalness={0.7} roughness={0.4} />
      </Cylinder>

      {/* 4 Mounting Hex Bolts */}
      {[0, 90, 180, 270].map(deg => {
        const rad = deg2rad(deg);
        return (
          <Cylinder key={deg} args={[2.5, 2.5, 3.5, 6]}
            position={[22 * Math.cos(rad), 6.5, 22 * Math.sin(rad)]}>
            <meshStandardMaterial color='#94a3b8' metalness={0.92} roughness={0.15} />
          </Cylinder>
        );
      })}

      {/* Heavy cast riser column */}
      <Cylinder args={[18, 22, 18, 32]} position={[0, 15, 0]}>
        <meshStandardMaterial color='#253347' metalness={0.8} roughness={0.35} />
      </Cylinder>

      {/* Polished machined tooling plate (top at Y = 28) */}
      <Cylinder args={[22, 22, 4, 32]} position={[0, 26, 0]}>
        <meshStandardMaterial color='#cbd5e1' metalness={0.92} roughness={0.18} />
      </Cylinder>

      {/* Machined locating recess nest where the workpiece centers itself */}
      <Cylinder args={[13, 14, 1.2, 32]} position={[0, 27.6, 0]}>
        <meshStandardMaterial color='#475569' metalness={0.8} roughness={0.3} />
      </Cylinder>

      {/* Illuminated Status LED Ring */}
      <Torus args={[21, 1.2, 8, 48]} position={[0, 27.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <meshStandardMaterial
          color={ledColor}
          emissive={ledColor}
          emissiveIntensity={ledGlow}
          metalness={0.9}
          roughness={0.1}
        />
      </Torus>

      {/* Floor Safety Zone Ring */}
      <Torus args={[38, 1, 8, 48]} position={[0, 0.4, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <meshStandardMaterial
          color={activeColor}
          emissive={activeColor}
          emissiveIntensity={hasObject ? 0.5 : 0.15}
          transparent
          opacity={0.7}
        />
      </Torus>
    </group>
  );
}

// ─── Workcell Floor Graphics ────────────────────────────────────────────────
function WorkcellMarkings() {
  return (
    <group position={[0, -21.8, 0]}>
      {/* Transfer path guide arc connecting Station A to Station B (radius 140 mm) */}
      <Torus args={[140, 1.4, 8, 64]} rotation={[Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color={C_ACCENT} emissive={C_ACCENT}
          emissiveIntensity={0.35} transparent opacity={0.5} />
      </Torus>
      {/* Outer working envelope arc */}
      <Torus args={[165, 0.8, 8, 64]} rotation={[Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color='#334155' transparent opacity={0.35} />
      </Torus>
    </group>
  );
}

// ─── Main 6-DOF Robotic Arm Simulation with Vacuum Suction Tool ─────────────
const LERP = 0.14;   // 60fps smoothing factor

export default function RoboArm({
  joints,
  holdingObject,
  objectLocation = 'station_a',
  objectPos = { x: 107.4, y: 6.0, z: 90.1 },
  suctionActive = false,
  canGrab = false,
  onFloorClick,
}) {
  const smooth = useRef({
    base: 0, shoulder: 45, elbow: -30,
    wrist_pitch: 0, wrist_roll: 0, gripper: 0,
  });

  const baseRef    = useRef();
  const shoulderRef= useRef();
  const elbowRef   = useRef();
  const wristPRef  = useRef();
  const wristRRef  = useRef();

  const SHOULDER_LEN = 100;
  const ELBOW_LEN    = 80;
  const WRIST_LEN    = 60;

  useFrame(() => {
    const s = smooth.current;
    const j = joints || {};
    const lerp = THREE.MathUtils.lerp;

    s.base        = lerp(s.base,        j.base?.angle        ?? 0,   LERP);
    s.shoulder    = lerp(s.shoulder,    j.shoulder?.angle    ?? 45,  LERP);
    s.elbow       = lerp(s.elbow,       j.elbow?.angle       ?? -30, LERP);
    s.wrist_pitch = lerp(s.wrist_pitch, j.wrist_pitch?.angle ?? 0,   LERP);
    s.wrist_roll  = lerp(s.wrist_roll,  j.wrist_roll?.angle  ?? 0,   LERP);
    s.gripper     = lerp(s.gripper,     j.gripper?.angle     ?? 0,   LERP);

    if (baseRef.current)
      baseRef.current.rotation.y = deg2rad(s.base);

    if (shoulderRef.current)
      shoulderRef.current.rotation.z = deg2rad(s.shoulder);

    if (elbowRef.current)
      elbowRef.current.rotation.z = deg2rad(s.elbow);

    if (wristPRef.current)
      wristPRef.current.rotation.z = deg2rad(s.wrist_pitch);

    if (wristRRef.current)
      wristRRef.current.rotation.y = deg2rad(s.wrist_roll);
  });

  const curPos = objectPos || { x: 107.4, y: 6.0, z: 90.1 };
  const distA = Math.hypot(curPos.x - 107.4, curPos.z - 90.1);
  const distB = Math.hypot(curPos.x - 107.4, curPos.z + 90.1);
  const isAtA = !holdingObject && (objectLocation === 'station_a' || distA < 16);
  const isAtB = !holdingObject && (objectLocation === 'station_b' || distB < 16);
  const isFreeFloor = !holdingObject && !isAtA && !isAtB;
  const isSuctionOn = Boolean(suctionActive || holdingObject);

  const activeWorkpiecePos = isAtA
    ? STATION_A_POS
    : isAtB
    ? STATION_B_POS
    : [curPos.x, curPos.y ?? -20.5, curPos.z];

  return (
    <group>
      {/* ── Interactive Floor Base Disc (Click anywhere to relocate workpiece) ── */}
      <Cylinder
        args={[210, 210, 3, 64]}
        position={[0, -22, 0]}
        onClick={(e) => {
          e.stopPropagation();
          if (onFloorClick) {
            onFloorClick(e.point.x, e.point.z);
          }
        }}
        onPointerOver={() => { document.body.style.cursor = 'crosshair'; }}
        onPointerOut={() => { document.body.style.cursor = 'default'; }}
      >
        <meshStandardMaterial color='#0b1528' metalness={0.25} roughness={0.85} />
      </Cylinder>

      {/* Floor outer glow perimeter ring */}
      <Torus args={[195, 1.5, 8, 72]} position={[0, -20.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color={C_ACCENT} emissive={C_ACCENT} emissiveIntensity={0.4} />
      </Torus>

      {/* Workcell Reachable Working Envelope Arc (R=185 mm) */}
      <Torus args={[185, 0.9, 8, 72]} position={[0, -20.4, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color='#38bdf8' emissive='#38bdf8' emissiveIntensity={0.3} transparent opacity={0.65} />
      </Torus>

      {/* Minimum Reach Limit Arc (R=65 mm) */}
      <Torus args={[65, 0.7, 8, 48]} position={[0, -20.4, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color='#475569' transparent opacity={0.4} />
      </Torus>

      {/* Workcell safety lines and transfer track */}
      <WorkcellMarkings />

      {/* ── Station A: Pickup Pedestal ── */}
      <StationPedestal
        position={[107.4, -22, 90.1]}
        label="STATION A [PICKUP]"
        hasObject={isAtA}
        isDropStation={false}
      />

      {/* ── Station B: Dropoff Pedestal ── */}
      <StationPedestal
        position={[107.4, -22, -90.1]}
        label="STATION B [DROPOFF]"
        hasObject={isAtB}
        isDropStation={true}
      />

      {/* ── Holographic Circular Floor Target Reticle for Free Placement ── */}
      {isFreeFloor && (
        <group position={[activeWorkpiecePos[0], -21.6, activeWorkpiecePos[2]]}>
          <Torus args={[18, 0.9, 8, 36]} rotation={[Math.PI / 2, 0, 0]}>
            <meshStandardMaterial color='#38bdf8' emissive='#00d4ff' emissiveIntensity={0.8} />
          </Torus>
          <Cylinder args={[16, 16, 0.2, 32]} position={[0, 0.1, 0]}>
            <meshBasicMaterial color='#0284c7' transparent opacity={0.3} />
          </Cylinder>
          {/* Crosshair alignment tick marks */}
          {[0, 90, 180, 270].map(deg => {
            const rad = deg2rad(deg);
            return (
              <Cylinder
                key={deg}
                args={[0.6, 0.6, 6, 8]}
                position={[19 * Math.cos(rad), 0.2, 19 * Math.sin(rad)]}
                rotation={[0, 0, Math.PI / 2]}
              >
                <meshBasicMaterial color='#38bdf8' />
              </Cylinder>
            );
          })}
        </group>
      )}

      {/* ── Realistic Workpiece at Rest (when not held) ── */}
      {!holdingObject && (
        <RealisticWorkpiece
          position={activeWorkpiecePos}
          rotation={[0, 0, 0]}
          isHeld={false}
        />
      )}

      {/* ── 6-DOF Robotic Arm Hierarchy ── */}
      <group ref={baseRef}>
        <Base />

        {/* Joint 2: Shoulder */}
        <group position={[0, 44, 0]} ref={shoulderRef}>
          <JointSphere radius={15} primary />
          <Link length={SHOULDER_LEN} rTop={7} rBot={10} color={C_BODY2} />

          {/* Joint 3: Elbow */}
          <group position={[0, SHOULDER_LEN, 0]} ref={elbowRef}>
            <JointSphere radius={12} primary={false} />
            <Link length={ELBOW_LEN} rTop={6} rBot={9} color={C_BODY} />

            {/* Joint 4: Wrist Pitch */}
            <group position={[0, ELBOW_LEN, 0]} ref={wristPRef}>
              <JointSphere radius={10} />

              {/* Joint 5: Wrist Roll */}
              <group ref={wristRRef}>
                <Link length={WRIST_LEN} rTop={5} rBot={7} color={C_BODY3} accentColor='#60a5fa' />

                {/* Joint 6: Pneumatic Suction Tool Assembly */}
                <group position={[0, WRIST_LEN, 0]}>
                  <JointSphere radius={9} primary />

                  {/* Pneumatic Vacuum Gripper Head with Bellows Cup */}
                  <PneumaticSuctionGripper
                    suctionActive={isSuctionOn}
                    vacuumLevel={smooth.current.gripper}
                  />

                  {/* Workpiece Firmly Attached to Suction Cup Lip */}
                  {holdingObject && (
                    <RealisticWorkpiece
                      position={[0, 36.5, 0]}
                      rotation={[0, 0, Math.PI]}
                      isHeld={true}
                    />
                  )}
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
