import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
const API = (typeof window !== 'undefined' && window.location.port === '3000')
  ? 'http://localhost:5001'
  : (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5001');
const UI_THROTTLE_MS = 40; // update UI at most 25fps — 3D lerps at 60fps

export function useRoboArm() {
  const [armState, setArmState] = useState({
    joints: {
      base:        { angle: 0,   min: -180, max: 180,  label: 'Base Rotation' },
      shoulder:    { angle: 45,  min: -90,  max: 90,   label: 'Shoulder' },
      elbow:       { angle: -30, min: -135, max: 135,  label: 'Elbow' },
      wrist_pitch: { angle: 0,   min: -90,  max: 90,   label: 'Wrist Pitch' },
      wrist_roll:  { angle: 0,   min: -180, max: 180,  label: 'Wrist Roll' },
      gripper:     { angle: 0,   min: 0,    max: 100,  label: 'Vacuum Suction (%)' },
    },
    mode: 'idle',
    control_mode: 'auto',
    holding_object: false,
    suction_active: false,
    vacuum_kpa: 0.0,
    object_location: 'station_a',
    object_pos: { x: 107.4, y: 6.0, z: 90.1 },
    target_place_pos: { x: 107.4, y: 6.0, z: -90.1 },
    can_grab: false,
    distance_to_part: 0,
    animation_active: false,
    speed: 5,
    end_effector: { x: 0, y: 0, z: 0 },
    message: 'Connecting...',
  });

  const [connected, setConnected] = useState(false);
  const socketRef    = useRef(null);
  const pendingState = useRef(null);   // latest WS message
  const rafRef       = useRef(null);   // requestAnimationFrame handle
  const lastFlush    = useRef(0);

  // ── Throttled flush to React state ────────────────────────────────
  const scheduleFlush = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const now = Date.now();
      if (now - lastFlush.current < UI_THROTTLE_MS) {
        scheduleFlush(); // try again next frame
        return;
      }
      lastFlush.current = now;
      if (pendingState.current) {
        setArmState(pendingState.current);
        pendingState.current = null;
      }
    });
  }, []);

  // ── WebSocket ─────────────────────────────────────────────────────
  useEffect(() => {
    const socket = io(API, {
      transports: ['websocket', 'polling'],
      reconnectionDelay: 500,
      reconnectionAttempts: 10,
    });
    socketRef.current = socket;

    socket.on('connect',    () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('arm_state',  (state) => {
      pendingState.current = state;
      scheduleFlush();
    });

    return () => {
      socket.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [scheduleFlush]);

  // ── API helpers ───────────────────────────────────────────────────
  const api = useCallback(async (path, method = 'POST', body = null) => {
    try {
      const res = await fetch(`${API}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : null,
      });
      return await res.json();
    } catch (e) {
      console.error('API error:', e);
    }
  }, []);

  const pick          = useCallback(() => api('/api/pick'),  [api]);
  const drop          = useCallback(() => api('/api/drop'),  [api]);
  const manualGrab    = useCallback((force = false) => api('/api/manual_grab', 'POST', { force }), [api]);
  const manualRelease = useCallback(() => api('/api/manual_release', 'POST'), [api]);
  const placeObject   = useCallback((x, z) => api('/api/place_object', 'POST', { x, z }), [api]);
  const home          = useCallback(() => api('/api/home'),  [api]);
  const reset         = useCallback(() => api('/api/reset'), [api]);
  const resetObject   = useCallback((location = 'station_a') => api('/api/reset_object', 'POST', { location }), [api]);
  const setSpeed      = useCallback((speed) => api('/api/speed', 'POST', { speed }), [api]);
  const setJoint      = useCallback((joint, delta = null, angle = null) => {
    const body = delta !== null ? { delta } : { angle };
    return api(`/api/joint/${joint}`, 'POST', body);
  }, [api]);

  // ── Send keyboard commands via WebSocket (lower latency than HTTP) ─
  const sendKey = useCallback((key) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('key_command', { key });
    }
  }, []);

  return {
    armState,
    connected,
    pick,
    drop,
    manualGrab,
    manualRelease,
    placeObject,
    home,
    reset,
    resetObject,
    setSpeed,
    setJoint,
    sendKey
  };
}
