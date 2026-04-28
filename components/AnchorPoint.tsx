'use client';
import { useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { ThreeEvent } from '@react-three/fiber';
import { useSimStore, AnchorPoint } from '../store/simulatorStore';
import { snapToGrid } from '../utils/geometry';

// ─── Drag-capture plane ──────────────────────────────────────────────────────
// A large invisible mesh oriented so that e.point gives the world position
// on the correct drag plane. Much simpler than manual raycasting.

function getDragRotation(cameraView: string): [number, number, number] {
  switch (cameraView) {
    case 'top':
      return [-Math.PI / 2, 0, 0]; // horizontal (XZ) plane
    case 'front':
    case 'back':
      return [0, 0, 0]; // vertical plane facing Z
    case 'left':
    case 'right':
      return [0, Math.PI / 2, 0]; // vertical plane facing X
    default:
      return [-Math.PI / 2, 0, 0]; // free → horizontal
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
  // Position the plane so it passes through the current anchor position.
  const position: [number, number, number] =
    cameraView === 'top' || cameraView === 'free'
      ? [0, anchorPos[1], 0]
      : cameraView === 'front' || cameraView === 'back'
      ? [0, 0, anchorPos[2]]
      : [anchorPos[0], 0, 0]; // left / right

  return (
    <mesh
      rotation={rotation}
      position={position}
      onPointerMove={(e) => {
        e.stopPropagation();
        onMove(e.point.clone());
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        onEnd();
      }}
    >
      <planeGeometry args={[500, 500]} />
      <meshBasicMaterial
        transparent
        opacity={0}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// ─── Single anchor sphere ─────────────────────────────────────────────────────

interface AnchorSphereProps {
  anchor: AnchorPoint;
}

export function AnchorSphere({ anchor }: AnchorSphereProps) {
  const setAnchorPosition = useSimStore((s) => s.setAnchorPosition);
  const cameraView = useSimStore((s) => s.cameraView);
  const snapGrid = useSimStore((s) => s.snapGrid);
  const setDraggingAnchor = useSimStore((s) => s.setDraggingAnchor);

  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);

  const posRef = useRef<[number, number, number]>(anchor.position);
  posRef.current = anchor.position;

  const startDrag = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      setDragging(true);
      setDraggingAnchor(anchor.id);
    },
    [anchor.id, setDraggingAnchor],
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

      switch (cameraView) {
        case 'top':
        case 'free':
          nx = snapToGrid(pt.x, snapGrid);
          nz = snapToGrid(pt.z, snapGrid);
          break;
        case 'front':
        case 'back':
          nx = snapToGrid(pt.x, snapGrid);
          ny = snapToGrid(Math.max(0, pt.y), snapGrid);
          break;
        case 'left':
        case 'right':
          nz = snapToGrid(pt.z, snapGrid);
          ny = snapToGrid(Math.max(0, pt.y), snapGrid);
          break;
      }

      setAnchorPosition(anchor.id, [nx, ny, nz]);
    },
    [cameraView, anchor.id, snapGrid, setAnchorPosition],
  );

  const [px, py, pz] = anchor.position;

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
        position={[px, py, pz]}
        onPointerDown={startDrag}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshStandardMaterial
          color={dragging ? '#ff8800' : hovered ? '#ffcc44' : '#ff4444'}
          emissive={dragging ? '#aa4400' : hovered ? '#664400' : '#330000'}
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
