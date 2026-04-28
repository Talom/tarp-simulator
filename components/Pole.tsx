'use client';
import { useRef, useState } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { useSimStore, Pole as PoleData } from '../store/simulatorStore';
import { snapToGrid } from '../utils/geometry';

// Poles are dragged with the same invisible-plane approach as anchor points.
function PoleDragPlane({
  polePos,
  onMove,
  onEnd,
}: {
  polePos: [number, number];
  onMove: (x: number, z: number) => void;
  onEnd: () => void;
}) {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[polePos[0], 0, polePos[1]]}
      onPointerMove={(e) => { e.stopPropagation(); onMove(e.point.x, e.point.z); }}
      onPointerUp={(e) => { e.stopPropagation(); onEnd(); }}
    >
      <planeGeometry args={[500, 500]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

function PoleObject({ pole }: { pole: PoleData }) {
  const setPoleBase = useSimStore((s) => s.setPoleBase);
  const setDraggingPole = useSimStore((s) => s.setDraggingPole);
  const snapGrid = useSimStore((s) => s.snapGrid);

  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);

  const baseRef = useRef(pole.basePosition);
  baseRef.current = pole.basePosition;

  const [bx, bz] = pole.basePosition;
  const midY = pole.height / 2;

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setDragging(true);
    setDraggingPole(pole.id);
  };

  const onMove = (x: number, z: number) => {
    setPoleBase(pole.id, [snapToGrid(x, snapGrid), snapToGrid(z, snapGrid)]);
  };

  const onEnd = () => {
    setDragging(false);
    setDraggingPole(null);
  };

  return (
    <group position={[bx, 0, bz]}>
      {dragging && (
        <PoleDragPlane polePos={baseRef.current} onMove={onMove} onEnd={onEnd} />
      )}

      {/* Shaft */}
      <mesh
        position={[0, midY, 0]}
        castShadow
        onPointerDown={onPointerDown}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={() => setHovered(false)}
      >
        <cylinderGeometry args={[0.025, 0.03, pole.height, 8]} />
        <meshStandardMaterial
          color={hovered ? '#d4aa70' : '#8b6914'}
          roughness={0.7}
          metalness={0.2}
        />
      </mesh>

      {/* Top cap */}
      <mesh position={[0, pole.height, 0]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color="#c8a050" roughness={0.4} metalness={0.5} />
      </mesh>

      {/* Ground spike */}
      <mesh position={[0, -0.05, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.02, 0.1, 6]} />
        <meshStandardMaterial color="#555" roughness={0.8} />
      </mesh>
    </group>
  );
}

export default function Poles() {
  const poles = useSimStore((s) => s.poles);
  return (
    <>
      {poles.map((p) => (
        <PoleObject key={p.id} pole={p} />
      ))}
    </>
  );
}
