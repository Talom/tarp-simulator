'use client';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useSimStore, CameraView } from '../store/simulatorStore';

// Vertical extent (world units) visible in orthographic fixed views
const ORTHO_H = 8;

type ControlsRef = { enabled: boolean; target: THREE.Vector3; update: () => void };

const FIXED_VIEWS: Record<Exclude<CameraView, 'free'>, {
  pos: [number, number, number];
  target: [number, number, number];
}> = {
  front: { pos: [0, 2.5,  14],   target: [0, 2.5, 0] },
  back:  { pos: [0, 2.5, -14],   target: [0, 2.5, 0] },
  left:  { pos: [-14, 2.5, 0],   target: [0, 2.5, 0] },
  right: { pos: [14,  2.5, 0],   target: [0, 2.5, 0] },
  top:   { pos: [0,   14,  0.001], target: [0, 0,   0] },
};

export default function CameraController() {
  const cameraView = useSimStore((s) => s.cameraView);
  const draggingAnchor = useSimStore((s) => s.draggingAnchorId);
  const { camera, set: setThree, size } = useThree();

  const controlsRef = useRef<ControlsRef | null>(null);
  // Capture the initial PerspectiveCamera once (before any swapping)
  const perspRef = useRef<THREE.PerspectiveCamera>(camera as THREE.PerspectiveCamera);
  const orthoRef = useRef<THREE.OrthographicCamera | null>(null);

  useEffect(() => {
    const aspect = size.width / size.height;
    const h = ORTHO_H;
    const w = h * aspect;

    if (cameraView !== 'free') {
      const view = FIXED_VIEWS[cameraView];

      if (!orthoRef.current) {
        orthoRef.current = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0.1, 200);
      } else {
        orthoRef.current.left   = -w / 2;
        orthoRef.current.right  =  w / 2;
        orthoRef.current.top    =  h / 2;
        orthoRef.current.bottom = -h / 2;
      }

      orthoRef.current.position.set(...view.pos);
      orthoRef.current.lookAt(new THREE.Vector3(...view.target));
      orthoRef.current.updateProjectionMatrix();

      setThree({ camera: orthoRef.current });
      if (controlsRef.current) controlsRef.current.enabled = false;
    } else {
      // Restore perspective camera; OrbitControls re-takes over
      setThree({ camera: perspRef.current });
      if (controlsRef.current) {
        controlsRef.current.enabled = true;
        controlsRef.current.update();
      }
    }
  }, [cameraView, size.width, size.height, setThree]);

  return (
    <OrbitControls
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={controlsRef as any}
      makeDefault
      enabled={cameraView === 'free' && !draggingAnchor}
      enableDamping
      dampingFactor={0.08}
      minDistance={1}
      maxDistance={30}
      maxPolarAngle={Math.PI / 2}
    />
  );
}
