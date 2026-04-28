'use client';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useSimStore } from '../store/simulatorStore';
import { createTarpGeometry, SUBDIVISIONS } from '../utils/geometry';
import { getTarpTexture } from '../utils/textures';
import {
  createTarpPhysics,
  bilinearInitialize,
  setPinnedPositions,
  stepPhysics,
  TarpPhysicsState,
} from '../utils/tarpPhysics';
import { sharedPhysicsRef } from '../utils/sharedPhysicsRef';

export default function Tarp() {
  const tarpWidth      = useSimStore((s) => s.tarp.width);
  const tarpLength     = useSimStore((s) => s.tarp.length);
  const color          = useSimStore((s) => s.tarp.color);
  const anchorPoints   = useSimStore((s) => s.anchorPoints);
  const poles          = useSimStore((s) => s.poles);
  const physicsVersion = useSimStore((s) => s.physicsVersion);

  const geometry  = useMemo(() => createTarpGeometry(SUBDIVISIONS), []);
  const physicsRef = useRef<TarpPhysicsState | null>(null);

  // Full physics reset: dim change, preset apply, JSON import.
  // bilinearInitialize seeds *all* particles to the new bilinear surface so
  // there is no transient morph from the previous configuration.
  useEffect(() => {
    const phys = createTarpPhysics(tarpWidth, tarpLength);
    bilinearInitialize(phys, anchorPoints);
    setPinnedPositions(phys, anchorPoints, poles);
    physicsRef.current = phys;
    sharedPhysicsRef.current = phys;

    const posAttr = geometry.attributes.position as THREE.BufferAttribute;
    (posAttr.array as Float32Array).set(phys.positions);
    posAttr.needsUpdate = true;
    geometry.computeVertexNormals();
    // anchorPoints / poles intentionally omitted: re-init is triggered by physicsVersion.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tarpWidth, tarpLength, physicsVersion, geometry]);

  // Re-evaluate pin status whenever anchors OR poles change. Pole moves can
  // turn an anchor's previously-valid pin point into thin air (and vice versa).
  useEffect(() => {
    if (physicsRef.current) setPinnedPositions(physicsRef.current, anchorPoints, poles);
  }, [anchorPoints, poles]);

  const material = useMemo(() => {
    const tex = getTarpTexture(color);
    return new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.85,
      metalness: 0,
      side: THREE.DoubleSide,
    });
  }, [color]);

  // Cleanup the module-level reference on unmount so dangling readers don't see stale state.
  useEffect(() => () => { sharedPhysicsRef.current = null; }, []);

  useFrame((_, delta) => {
    const phys = physicsRef.current;
    if (!phys) return;

    // Clamp dt for stability when frame rate drops; run a fixed inner sub-step.
    const dt = Math.min(delta, 1 / 30);
    stepPhysics(phys, dt);

    const posAttr = geometry.attributes.position as THREE.BufferAttribute;
    (posAttr.array as Float32Array).set(phys.positions);
    posAttr.needsUpdate = true;
    geometry.computeVertexNormals();
  });

  return <mesh geometry={geometry} material={material} castShadow receiveShadow />;
}
