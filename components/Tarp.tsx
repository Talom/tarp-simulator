'use client';
import { useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useSimStore } from '../store/simulatorStore';
import { createTarpGeometry, updateTarpGeometry, SUBDIVISIONS } from '../utils/geometry';
import { getTarpTexture } from '../utils/textures';

export default function Tarp() {
  const anchorPoints = useSimStore((s) => s.anchorPoints);
  const color = useSimStore((s) => s.tarp.color);

  // Create geometry once and immediately populate it with the initial anchor positions.
  const geometry = useMemo(() => {
    const geo = createTarpGeometry(SUBDIVISIONS);
    updateTarpGeometry(geo, anchorPoints, SUBDIVISIONS);
    return geo;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally only on mount – updates handled by the effect below

  // Re-compute vertex positions whenever anchor points move.
  useEffect(() => {
    updateTarpGeometry(geometry, anchorPoints, SUBDIVISIONS);
  }, [anchorPoints, geometry]);

  // Procedural material – regenerated when the colour variant changes.
  const material = useMemo(() => {
    const tex = getTarpTexture(color);
    return new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.85,
      metalness: 0,
      side: THREE.DoubleSide,
    });
  }, [color]);

  return <mesh geometry={geometry} material={material} castShadow receiveShadow />;
}
