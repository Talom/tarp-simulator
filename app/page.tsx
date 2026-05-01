'use client';
import dynamic from 'next/dynamic';
import ControlPanel from '../components/ControlPanel';
import ContextMenu from '../components/ContextMenu';

// Dynamically import the 3D scene to skip SSR (Three.js needs the DOM)
const Scene = dynamic(() => import('../components/Scene'), { ssr: false });

export default function Home() {
  return (
    <div
      style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: '#1a2010' }}
      // Suppress the browser's default context menu so our custom
      // right-click menu can take over.
      onContextMenu={(e) => e.preventDefault()}
    >
      <ControlPanel />
      <div style={{ position: 'absolute', inset: 0 }}>
        <Scene />
      </div>
      <ContextMenu />
    </div>
  );
}
