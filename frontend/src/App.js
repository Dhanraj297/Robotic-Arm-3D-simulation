import React, { useEffect, useRef, useCallback, memo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { useRoboArm } from './useRoboArm';
import RoboArm3D from './RoboArm3D';

// Memoize so joint-angle changes don't re-mount the whole 3D scene
const MemoArm = memo(RoboArm3D);

// ─── Joint Slider Component ─────────────────────────────────────────────────
function JointSlider({ name, joint, onDelta }) {
  const pct = ((joint.angle - joint.min) / (joint.max - joint.min)) * 100;
  const style = { '--fill': `${pct}%` };

  return (
    <div className="joint-row">
      <div className="joint-header">
        <span className="joint-label">{joint.label}</span>
        <span className="joint-value">{joint.angle.toFixed(1)}°</span>
      </div>
      <div className="joint-slider-wrap">
        <button className="joint-btn" onClick={() => onDelta(name, -5)}>−</button>
        <input
          type="range"
          min={joint.min}
          max={joint.max}
          step={1}
          value={joint.angle}
          style={style}
          onChange={e => onDelta(name, null, parseFloat(e.target.value))}
        />
        <button className="joint-btn" onClick={() => onDelta(name, +5)}>+</button>
      </div>
    </div>
  );
}

// ─── Keyboard Map Component ─────────────────────────────────────────────────
function KeyMap() {
  const keys = [
    { keys: ['A', 'D'],    desc: 'Base ← →' },
    { keys: ['W', 'S'],    desc: 'Shoulder ↑ ↓' },
    { keys: ['Q', 'E'],    desc: 'Elbow +/−' },
    { keys: ['R', 'F'],    desc: 'Wrist Pitch +/−' },
    { keys: ['Z', 'X'],    desc: 'Wrist Roll +/−' },
    { keys: ['G'],         desc: 'Suction Grab (Manual)' },
    { keys: ['H'],         desc: 'Release / Drop (Manual)' },
    { keys: ['P'],         desc: 'Suction Pick (Auto)' },
    { keys: ['O'],         desc: 'Suction Place (Auto)' },
    { keys: ['Space'],     desc: 'Go Home' },
  ];

  return (
    <div className="kbd-grid">
      {keys.map((k, i) => (
        <React.Fragment key={i}>
          <div className="kbd-pair">
            {k.keys.map(key => (
              <span key={key} className="kbd">{key}</span>
            ))}
          </div>
          <span className="kbd-desc">{k.desc}</span>
        </React.Fragment>
      ))}
    </div>
  );
}


// ─── FK Display ─────────────────────────────────────────────────────────────
function FKDisplay({ ee }) {
  return (
    <div className="fk-grid">
      {[
        { axis: 'X', val: ee?.x ?? 0, cls: 'fk-x' },
        { axis: 'Y', val: ee?.y ?? 0, cls: 'fk-y' },
        { axis: 'Z', val: ee?.z ?? 0, cls: 'fk-z' },
      ].map(({ axis, val, cls }) => (
        <div className="fk-card" key={axis}>
          <div className={`fk-axis ${cls}`}>{axis}</div>
          <div className="fk-val">{val.toFixed(1)}</div>
        </div>
      ))}
    </div>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  const {
    armState,
    connected,
    pick,
    drop,
    manualGrab,
    manualRelease,
    placeObject,
    home,
    reset,
    setSpeed,
    setJoint,
    sendKey,
  } = useRoboArm();

  const {
    joints,
    mode,
    holding_object,
    object_location,
    object_pos,
    can_grab,
    distance_to_part,
    animation_active,
    speed,
    end_effector,
    message,
    suction_active,
    vacuum_kpa,
  } = armState;

  const [controlTab, setControlTab] = useState('auto'); // 'auto' | 'manual'
  const keyboardRef = useRef(null);

  const handleKeyDown = useCallback((e) => {
    if (e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
    const key = e.key.toLowerCase();
    const controlled = ['w','a','s','d','q','e','r','f','z','x','g','h','p','o',' '];
    if (controlled.includes(key) || e.key === ' ') {
      e.preventDefault();
      sendKey(e.key === ' ' ? ' ' : e.key);
    }
  }, [sendKey]);

  // Global key listener so keys like G, H, W, A, S, D work immediately even after clicking 3D canvas
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleSlider = useCallback((jointName, delta, angle) => {
    setJoint(jointName, delta, angle);
  }, [setJoint]);

  const modeClass = `mode-${mode}`;
  const JOINT_ORDER = ['base', 'shoulder', 'elbow', 'wrist_pitch', 'wrist_roll', 'gripper'];

  const wpX = object_pos?.x ?? 107.4;
  const wpZ = object_pos?.z ?? 90.1;
  const distA = Math.hypot(wpX - 107.4, wpZ - 90.1);
  const distB = Math.hypot(wpX - 107.4, wpZ + 90.1);
  const isAtA = !holding_object && (object_location === 'station_a' || distA < 16);
  const isAtB = !holding_object && (object_location === 'station_b' || distB < 16);

  const partStatusText = holding_object
    ? 'Sealed on Suction Cup (-85 kPa)'
    : isAtA
    ? 'Seated on Station A (Pickup)'
    : isAtB
    ? 'Seated on Station B (Dropoff)'
    : `Floor (${wpX.toFixed(0)}, ${wpZ.toFixed(0)})`;

  return (
    <div
      className="app-container"
      ref={keyboardRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{ outline: 'none' }}
    >
      {/* ── Header ─────────────────────────────────── */}
      <header className="header">
        <div className="header-logo">
          <div className="logo-icon">🤖</div>
          <span className="logo-title">ROBOARM SIM</span>
        </div>

        <div className="header-status">
          <div className={`status-dot ${connected ? 'connected' : 'disconnected'}`}/>
          <span style={{ color: connected ? 'var(--accent-green)' : 'var(--accent-red)', fontSize: 13 }}>
            {connected ? 'CONNECTED' : 'DISCONNECTED'}
          </span>
          {armState.pybullet_active && (
            <span className="pybullet-badge">
              <span className="pybullet-dot"/> PYBULLET PHYSICS
            </span>
          )}
        </div>

        <div className="header-controls">
          <button className="btn btn-home" style={{ fontSize: 9, padding: '6px 12px', flex: 'none' }}
            onClick={home} disabled={animation_active}>
            🏠 Home
          </button>
          <button className="btn btn-reset" style={{ fontSize: 9, padding: '6px 12px', flex: 'none' }}
            onClick={reset} disabled={animation_active}>
            ↺ Reset
          </button>
        </div>
      </header>

      {/* ── Left Panel: Joint Controls ──────────────── */}
      <aside className="left-panel">
        {/* Joint Sliders */}
        <div className="section">
          <div className="section-header">
            <span className="section-icon">⚙️</span>
            <span className="section-title">Joint Controls</span>
          </div>
          <div className="section-body">
            {JOINT_ORDER.map(name => joints[name] ? (
              <JointSlider
                key={name}
                name={name}
                joint={joints[name]}
                onDelta={(n, delta, angle) => handleSlider(n, delta !== null ? delta : null, angle !== undefined ? angle : null)}
              />
            ) : null)}
          </div>
        </div>

        {/* Speed Control */}
        <div className="section">
          <div className="section-header">
            <span className="section-icon">⚡</span>
            <span className="section-title">Speed</span>
          </div>
          <div className="section-body">
            <div className="speed-row">
              <span className="speed-label">Speed</span>
              <input
                type="range" min={1} max={20} step={1}
                value={speed}
                style={{ '--fill': `${((speed - 1) / 19) * 100}%`, flex: 1 }}
                onChange={e => setSpeed(parseInt(e.target.value))}
              />
              <span className="speed-val">{speed}</span>
            </div>
          </div>
        </div>

        {/* FK Display */}
        <div className="section">
          <div className="section-header">
            <span className="section-icon">📐</span>
            <span className="section-title">End Effector (mm)</span>
          </div>
          <div className="section-body">
            <FKDisplay ee={end_effector} />
          </div>
        </div>
      </aside>

      {/* ── 3D Canvas ──────────────────────────────────── */}
      <main className="canvas-container">
        <Canvas
          camera={{ position: [320, 220, 320], fov: 42, near: 1, far: 2000 }}
          gl={{
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance',
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.4,
          }}
          dpr={Math.min(window.devicePixelRatio, 2)}
        >
          {/* Lighting */}
          <ambientLight intensity={0.8} color="#c8dff5" />
          <directionalLight
            position={[150, 350, 200]} intensity={2.5}
            color="#ffffff"
          />
          <directionalLight
            position={[-200, 200, -100]} intensity={1.0}
            color="#a0c8ff"
          />
          <pointLight position={[0, 250, 0]}  intensity={1.2} color="#00eeff" distance={600} />
          <pointLight position={[200, 120, 200]} intensity={0.8} color="#c084fc" distance={500} />
          <pointLight position={[-100, 80, -200]} intensity={0.6} color="#60a5fa" distance={400} />
          <hemisphereLight skyColor="#1e40af" groundColor="#0f172a" intensity={0.6} />

          {/* Stars */}
          <Stars radius={500} depth={60} count={1500} factor={2} saturation={0.5} fade speed={0.4}/>

          {/* Ground grid */}
          <Grid
            args={[800, 800]}
            position={[0, -22, 0]}
            cellSize={40}
            cellThickness={0.4}
            cellColor="#1e3a5f"
            sectionSize={200}
            sectionThickness={1.2}
            sectionColor="#00eeff"
            fadeDistance={700}
            fadeStrength={1.5}
            infiniteGrid
          />

          {/* Arm & Workcell Simulation */}
          <MemoArm
            joints={joints}
            holdingObject={holding_object}
            objectLocation={object_location}
            objectPos={object_pos}
            suctionActive={suction_active || holding_object}
            canGrab={can_grab}
            onFloorClick={(x, z) => placeObject(x, z)}
          />

          <OrbitControls
            enablePan enableZoom enableRotate
            maxDistance={900} minDistance={80}
            target={[0, 90, 0]}
            dampingFactor={0.08}
            enableDamping
          />
        </Canvas>

        {/* Overlays */}
        <div className="canvas-overlay">
          <div className={`mode-badge ${modeClass}`}>{mode.toUpperCase()}</div>
          <div className="msg-bar">💬 {message || 'Ready'}</div>
        </div>
      </main>

      {/* ── Right Panel: Mode Switcher, Actions, Workpiece & Keymap ── */}
      <aside className="right-panel">
        {/* Mode Selector Tabs: Auto vs Manual */}
        <div className="mode-tabs">
          <button
            className={`mode-tab-btn ${controlTab === 'auto' ? 'active auto' : ''}`}
            onClick={() => setControlTab('auto')}
          >
            ⚡ Automatic Cycle
          </button>
          <button
            className={`mode-tab-btn ${controlTab === 'manual' ? 'active manual' : ''}`}
            onClick={() => setControlTab('manual')}
          >
            🕹️ Manual Suction
          </button>
        </div>

        {/* Vacuum & Workpiece Status */}
        <div className="section">
          <div className="section-header">
            <span className="section-icon">💨</span>
            <span className="section-title">Vacuum & Workpiece</span>
          </div>
          <div className="section-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className={`object-indicator ${holding_object ? 'held' : (isAtB ? 'station-b' : (isAtA ? 'station-a' : 'free'))}`}>
              <div className="object-dot"/>
              <span style={{ fontWeight: 600 }}>{partStatusText}</span>
            </div>

            {/* Vacuum gauge status pill */}
            <div className="vacuum-gauge-row">
              <span className="vacuum-gauge-label">Vacuum Pressure:</span>
              <span className={`vacuum-gauge-val ${suction_active || holding_object ? 'sealed' : 'vented'}`}>
                {vacuum_kpa ? `${vacuum_kpa.toFixed(1)} kPa` : (suction_active || holding_object ? '-85.0 kPa' : '0.0 kPa (Vented)')}
              </span>
            </div>

            <div className="station-pills-row">
              <div className={`station-pill ${isAtA ? 'active-a' : ''}`}>
                <span className="pill-dot"/> Station A
              </div>
              <div className={`station-pill ${holding_object ? 'active-held' : ''}`}>
                <span className="pill-dot"/> Suction Cup
              </div>
              <div className={`station-pill ${isAtB ? 'active-b' : ''}`}>
                <span className="pill-dot"/> Station B
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls Card (Switches according to selected tab) */}
        <div className="section">
          <div className="section-header">
            <span className="section-icon">🎮</span>
            <span className="section-title">{controlTab === 'auto' ? 'Automatic Actions' : 'Manual Suction Controls'}</span>
          </div>
          <div className="section-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {controlTab === 'auto' ? (
              /* Automatic Pick & Place */
              <div className="btn-row">
                <button
                  className="btn btn-pick"
                  onClick={pick}
                  disabled={animation_active || holding_object}
                >
                  <span>▲</span> AUTO SUCTION PICK
                </button>
                <button
                  className="btn btn-drop"
                  onClick={drop}
                  disabled={animation_active || !holding_object}
                >
                  <span>▼</span> AUTO PLACE
                </button>
              </div>
            ) : (
              /* Manual Grab & Release */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Proximity / Distance readout */}
                <div className={`proximity-banner ${can_grab ? 'in-range' : 'far'}`}>
                  <span>
                    {!holding_object
                      ? (can_grab ? '🟢 In Range: Ready to grab' : `Distance to Part: ${distance_to_part} mm`)
                      : '🔵 Vacuum Active: Move anywhere'}
                  </span>
                  <span style={{ fontSize: 10, color: '#94a3b8' }}>
                    {!holding_object ? '(Press G)' : '(Press H)'}
                  </span>
                </div>

                <div className="btn-row">
                  <button
                    className={`btn btn-grab ${can_grab ? 'ready' : ''}`}
                    onClick={() => manualGrab(true)}
                    disabled={animation_active || holding_object}
                    title="Engage vacuum suction to grab workpiece"
                  >
                    <span>🧲</span> MANUAL GRAB
                  </button>
                  <button
                    className="btn btn-release"
                    onClick={manualRelease}
                    disabled={animation_active || !holding_object}
                    title="Vent vacuum and drop workpiece at current arm spot"
                  >
                    <span>💨</span> RELEASE / DROP
                  </button>
                </div>
              </div>
            )}

            {/* Free Placement on Circular Area */}
            <div style={{ borderTop: '1px solid var(--border-dim)', paddingTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 10, fontFamily: 'Orbitron, sans-serif', color: 'var(--accent-cyan)', letterSpacing: 1 }}>
                  📍 Relocate Part
                </span>
                <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>Circular Area</span>
              </div>
              <div className="preset-spots-grid">
                <button
                  className="btn-spot"
                  onClick={() => placeObject(107.4, 90.1)}
                  disabled={animation_active || holding_object}
                >
                  Station A
                </button>
                <button
                  className="btn-spot"
                  onClick={() => placeObject(140.0, 0.0)}
                  disabled={animation_active || holding_object}
                >
                  Front (0°)
                </button>
                <button
                  className="btn-spot"
                  onClick={() => placeObject(107.4, -90.1)}
                  disabled={animation_active || holding_object}
                >
                  Station B
                </button>
                <button
                  className="btn-spot"
                  onClick={() => placeObject(0.0, 140.0)}
                  disabled={animation_active || holding_object}
                >
                  Left
                </button>
                <button
                  className="btn-spot"
                  onClick={() => placeObject(165.0, 50.0)}
                  disabled={animation_active || holding_object}
                >
                  Outer Ring
                </button>
                <button
                  className="btn-spot"
                  onClick={() => placeObject(0.0, -140.0)}
                  disabled={animation_active || holding_object}
                >
                  Right
                </button>
              </div>
              <p className="placement-hint" style={{ marginTop: 6 }}>
                <span>💡</span> Click anywhere on circular floor to place
              </p>
            </div>

            {/* Utility buttons */}
            <div className="btn-row" style={{ marginTop: 2 }}>
              <button
                className="btn btn-home"
                onClick={home}
                disabled={animation_active}
              >
                🏠 Home
              </button>
              <button
                className="btn btn-reset"
                onClick={reset}
                disabled={animation_active}
              >
                ↺ Reset All
              </button>
            </div>
          </div>
        </div>

        {/* Input Controls */}
        <div className="section">
          <div className="section-header">
            <span className="section-icon">⌨️</span>
            <span className="section-title">Controls</span>
          </div>
          <div className="section-body">
            <KeyMap />
            <p className="tooltip-help" style={{ marginTop: 10 }}>
              Click 3D area, then use keyboard to drive
            </p>
          </div>
        </div>

        {/* Joint Angles Summary */}
        <div className="section">
          <div className="section-header">
            <span className="section-icon">📊</span>
            <span className="section-title">Angle Readout</span>
          </div>
          <div className="section-body">
            {JOINT_ORDER.map(name => joints[name] ? (
              <div key={name} style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '3px 0', borderBottom: '1px solid var(--border-dim)',
                fontSize: 11,
              }}>
                <span style={{ color: 'var(--text-secondary)' }}>{joints[name].label}</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-cyan)' }}>
                  {joints[name].angle.toFixed(1)}°
                </span>
              </div>
            ) : null)}
          </div>
        </div>
      </aside>
    </div>
  );
}
