'use client';
import { Suspense, Component, ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';

import Ground from './Ground';
import Tarp from './Tarp';
import Poles from './Pole';
import Ropes from './Rope';
import AnchorPoints from './AnchorPoint';
import CameraController from './CameraController';

// ─── WebGL Error Boundary ────────────────────────────────────────────────────
class WebGLErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null };
  static getDerivedStateFromError(e: Error) { return { error: e.message }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 12,
          background: '#1a2010', color: '#c8e0a0', fontFamily: 'monospace',
        }}>
          <div style={{ fontSize: 18, color: '#f08060' }}>WebGL nicht verfügbar</div>
          <div style={{ fontSize: 13, color: '#7a9a5a', maxWidth: 420, textAlign: 'center' }}>
            {this.state.error}
          </div>
          <div style={{ fontSize: 11, color: '#4a6a3a', maxWidth: 420, textAlign: 'center' }}>
            Tipp: Hardwarebeschleunigung im Browser aktivieren
            (chrome://settings/system) oder Firefox/Edge verwenden.
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Lighting ────────────────────────────────────────────────────────────────
function Lighting() {
  return (
    <>
      <ambientLight intensity={0.6} color="#c8e8d0" />
      <directionalLight
        position={[8, 12, 6]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.1}
        shadow-camera-far={60}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />
      <directionalLight position={[-6, 8, -4]} intensity={0.35} color="#d0d8ff" />
      <hemisphereLight args={['#b0c8e0', '#2a3a1a', 0.4]} />
    </>
  );
}

// ─── Main scene ──────────────────────────────────────────────────────────────
export default function Scene() {
  return (
    <WebGLErrorBoundary>
      <Canvas
        shadows
        camera={{ position: [0, 2.5, 9], fov: 50, near: 0.05, far: 200 }}
        style={{ width: '100%', height: '100%', background: '#1a2010' }}
      >
        <Suspense fallback={null}>
          <Lighting />
          <Ground />
          <Tarp />
          <Poles />
          <Ropes />
          <AnchorPoints />
          <CameraController />
        </Suspense>
      </Canvas>
    </WebGLErrorBoundary>
  );
}
