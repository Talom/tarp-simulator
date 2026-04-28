'use client';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useSimStore, CameraView } from '../store/simulatorStore';

type ControlsRef = {
  enabled: boolean;
  target: THREE.Vector3;
  update: () => void;
};

const VIEWS: Record<CameraView, { pos: [number, number, number]; target: [number, number, number] } | null> = {
  front:  { pos: [0, 2.5, 9],    target: [0, 1, 0] },
  back:   { pos: [0, 2.5, -9],   target: [0, 1, 0] },
  left:   { pos: [-9, 2.5, 0],   target: [0, 1, 0] },
  right:  { pos: [9, 2.5, 0],    target: [0, 1, 0] },
  top:    { pos: [0, 11, 0.001], target: [0, 0, 0] },
  free:   null,
};

export default function CameraController() {
  const cameraView = useSimStore((s) => s.cameraView);
  const draggingAnchor = useSimStore((s) => s.draggingAnchorId);
  const { camera } = useThree();

  const controlsRef = useRef<ControlsRef | null>(null);
  const targetPos = useRef(new THREE.Vector3(0, 2.5, 9));
  const targetLookAt = useRef(new THREE.Vector3(0, 1, 0));
  const transitioning = useRef(false);

  useEffect(() => {
    const view = VIEWS[cameraView];
    if (view) {
      targetPos.current.set(...view.pos);
      targetLookAt.current.set(...view.target);
      transitioning.current = true;
      if (controlsRef.current) controlsRef.current.enabled = false;
    } else {
      if (controlsRef.current) controlsRef.current.enabled = true;
      transitioning.current = false;
    }
  }, [cameraView]);

  useFrame(() => {
    if (!transitioning.current) return;
    camera.position.lerp(targetPos.current, 0.12);
    if (controlsRef.current) {
      controlsRef.current.target.lerp(targetLookAt.current, 0.12);
      controlsRef.current.update();
    }
    if (camera.position.distanceTo(targetPos.current) < 0.01) {
      camera.position.copy(targetPos.current);
      if (controlsRef.current) {
        controlsRef.current.target.copy(targetLookAt.current);
        controlsRef.current.update();
      }
      transitioning.current = false;
    }
  });

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
