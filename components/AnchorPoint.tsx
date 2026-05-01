'use client';
import { useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { ThreeEvent, useFrame } from '@react-three/fiber';
import { useSimStore, AnchorPoint } from '../store/simulatorStore';
import { snapToGrid } from '../utils/geometry';
import { isAnchorPinPoint, vertexIndexForAnchor } from '../utils/tarpPhysics';
import { sharedPhysicsRef } from '../utils/sharedPhysicsRef';

// ─── Drag-capture plane ──────────────────────────────────────────────────────

function getDragRotation(cameraView: string): [number, number, number] {
  switch (cameraView) {
    case 'top':
      return [-Math.PI / 2, 0, 0];
    case 'front':
    case 'back':
      return [0, 0, 0];
    case 'left':
    case 'right':
      return [0, Math.PI / 2, 0];
    default:
      return [-Math.PI / 2, 0, 0];
  }
}

function DragCapturePlane({
  cameraView,
  anchorPos,
  onMove,
  onEnd,
}: {
  cameraView: string;
  anchorPos: [number, number, number];
  onMove: (pt: THREE.Vector3) => void;
  onEnd: () => void;
}) {
  const rotation = getDragRotation(cameraView);
  const position: [number, number, number] =
    cameraView === 'top' || cameraView === 'free'
      ? [0, anchorPos[1], 0]
      : cameraView === 'front' || cameraView === 'back'
      ? [0, 0, anchorPos[2]]
      : [anchorPos[0], 0, 0];

  return (
    <mesh
      rotation={rotation}
      position={position}
      onPointerMove={(e) => { e.stopPropagation(); onMove(e.point.clone()); }}
      onPointerUp={(e) => { e.stopPropagation(); onEnd(); }}
    >
      <planeGeometry args={[500, 500]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

// ─── Single anchor sphere ─────────────────────────────────────────────────────

interface AnchorSphereProps {
  anchor: AnchorPoint;
}

export function AnchorSphere({ anchor }: AnchorSphereProps) {
  const setAnchorPosition = useSimStore((s) => s.setAnchorPosition);
  const cameraView        = useSimStore((s) => s.cameraView);
  const snapGrid          = useSimStore((s) => s.snapGrid);
  const setDraggingAnchor = useSimStore((s) => s.setDraggingAnchor);
  const tarpWidth         = useSimStore((s) => s.tarp.width);
  const tarpLength        = useSimStore((s) => s.tarp.length);
  const poles             = useSimStore((s) => s.poles);
  const openContextMenu   = useSimStore((s) => s.openContextMenu);

  const [hovered, setHovered]   = useState(false);
  const [dragging, setDragging] = useState(false);



  // An anchor that doesn't sit on the ground or on a pole top is "in the air"
  // and physics-driven. Its world position comes from the cloth solver, not
  // the store, and the user can't drag it.
  const pinned = isAnchorPinPoint(anchor.position, poles);
  const vIdx   = vertexIndexForAnchor(anchor.id);

  const posRef = useRef<[number, number, number]>(anchor.position);
  posRef.current = anchor.position;

  const meshRef = useRef<THREE.Mesh | null>(null);

  // For unpinned anchors, follow the live cloth vertex every frame.
  useFrame(() => {
    if (pinned || !meshRef.current || vIdx < 0) return;
    const phys = sharedPhysicsRef.current;
    if (!phys) return;
    const k = vIdx * 3;
    meshRef.current.position.set(
      phys.positions[k],
      phys.positions[k + 1],
      phys.positions[k + 2],
    );
  });

  const startDrag = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      // Only left-click drags – right-click is for the context menu.
      if (e.nativeEvent.button !== 0) return;
      if (cameraView === 'free') return;
      if (!pinned) return; // cannot grab in-air anchors – they belong to the cloth
      e.stopPropagation();
      setDragging(true);
      setDraggingAnchor(anchor.id);
    },
    [anchor.id, cameraView, pinned, setDraggingAnchor],
  );

  const onContextMenu = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      e.nativeEvent.preventDefault();
      openContextMenu({ type: 'anchor', id: anchor.id }, e.nativeEvent.clientX, e.nativeEvent.clientY);
    },
    [anchor.id, openContextMenu],
  );

  const endDrag = useCallback(() => {
    setDragging(false);
    setDraggingAnchor(null);
  }, [setDraggingAnchor]);

  const handleMove = useCallback(
    (pt: THREE.Vector3) => {
      const cur = posRef.current;
      let nx = cur[0];
      let ny = cur[1];
      let nz = cur[2];

      const halfW = tarpWidth  / 2;
      const halfL = tarpLength / 2;

      // Valid Y positions: ground (0) or any existing pole top
      const validY = [0, ...poles.map((p) => p.height)];
      const snapY = (raw: number) =>
        validY.reduce((best, y) => (Math.abs(y - raw) < Math.abs(best - raw) ? y : best));

      switch (cameraView) {
        case 'top':
          nx = snapToGrid(pt.x, snapGrid);
          nz = snapToGrid(pt.z, snapGrid);
          break;
        case 'front':
        case 'back':
          nx = snapToGrid(pt.x, snapGrid);
          ny = snapY(pt.y);
          break;
        case 'left':
        case 'right':
          nz = snapToGrid(pt.z, snapGrid);
          ny = snapY(pt.y);
          break;
      }

      nx = Math.max(-halfW, Math.min(halfW, nx));
      nz = Math.max(-halfL, Math.min(halfL, nz));

      setAnchorPosition(anchor.id, [nx, ny, nz]);
    },
    [cameraView, anchor.id, snapGrid, tarpWidth, tarpLength, poles, setAnchorPosition],
  );

  // Visual styling
  // ─ unpinned (in-air): small, dim grey – informational only
  // ─ pinned, free view: medium grey – non-interactive in 3D mode
  // ─ pinned, fixed view: red / yellow / orange (interactive)
  const radius   = pinned ? 0.07 : 0.04;
  const color    = !pinned                ? '#5a5a5a'
                 : cameraView === 'free'  ? '#888888'
                 : dragging               ? '#ff8800'
                 : hovered                ? '#ffcc44'
                 :                          '#ff4444';
  const emissive = !pinned                ? '#1a1a1a'
                 : cameraView === 'free'  ? '#222222'
                 : dragging               ? '#aa4400'
                 : hovered                ? '#664400'
                 :                          '#330000';

  return (
    <>
      {dragging && (
        <DragCapturePlane
          cameraView={cameraView}
          anchorPos={posRef.current}
          onMove={handleMove}
          onEnd={endDrag}
        />
      )}

      <mesh
        ref={meshRef}
        position={anchor.position}
        onPointerDown={startDrag}
        onContextMenu={onContextMenu}
        onPointerOver={pinned ? (e) => { e.stopPropagation(); setHovered(true); } : undefined}
        onPointerOut={pinned ? () => setHovered(false) : undefined}
      >
        <sphereGeometry args={[radius, 12, 12]} />
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={0.4}
          roughness={0.3}
          metalness={0.5}
        />
      </mesh>
    </>
  );

    
}

export default function AnchorPoints() {
  const anchorPoints = useSimStore((s) => s.anchorPoints);
  return (
    <>
      {anchorPoints.map((a) => (
        <AnchorSphere key={a.id} anchor={a} />
      ))}
    </>
  );
}
