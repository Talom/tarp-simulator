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

  // Side views can edit Y (snap to ground / pole height) → re-pinning works.
  // Top view can only edit X/Z, so an unpinned anchor cannot be re-pinned there.
  const draggable =
    cameraView !== 'free' && (pinned || cameraView !== 'top');

  // Unpinned anchors visually track the live cloth vertex — except while the
  // user is actively dragging one, in which case the React-driven `position`
  // prop (= the store position being updated by the drag) takes over.
  useFrame(() => {
    if (pinned || dragging || !meshRef.current || vIdx < 0) return;
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
      if (!draggable) return;
      e.stopPropagation();

      // Unpinned: the store position can drift far from the *visual* (physics)
      // position. Sync it before the drag begins so the drag-capture plane is
      // placed where the user actually clicked.
      if (!pinned && vIdx >= 0 && sharedPhysicsRef.current) {
        const k = vIdx * 3;
        const pos = sharedPhysicsRef.current.positions;
        const newPos: [number, number, number] = [pos[k], pos[k + 1], pos[k + 2]];
        setAnchorPosition(anchor.id, newPos);
        posRef.current = newPos;
      }

      setDragging(true);
      setDraggingAnchor(anchor.id);
    },
    [anchor.id, draggable, pinned, vIdx, setAnchorPosition, setDraggingAnchor],
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
  // ─ Unpinned & idle:        small dim grey (informational, but grabbable)
  // ─ Unpinned & hover/drag:  full size, interactive colours
  // ─ Pinned in free view:    medium grey (no interaction in 3D)
  // ─ Pinned in fixed view:   red / yellow / orange (interactive)
  const interactive = draggable && (hovered || dragging);
  const radius   = pinned || interactive ? 0.07 : 0.04;
  const color    = !pinned && !interactive ? '#5a5a5a'
                 : cameraView === 'free'   ? '#888888'
                 : dragging                ? '#ff8800'
                 : hovered                 ? '#ffcc44'
                 :                           '#ff4444';
  const emissive = !pinned && !interactive ? '#1a1a1a'
                 : cameraView === 'free'   ? '#222222'
                 : dragging                ? '#aa4400'
                 : hovered                 ? '#664400'
                 :                           '#330000';

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
        onPointerOver={draggable ? (e) => { e.stopPropagation(); setHovered(true); } : undefined}
        onPointerOut={draggable ? () => setHovered(false) : undefined}
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
