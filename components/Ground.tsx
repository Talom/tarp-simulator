'use client';
import { Grid } from '@react-three/drei';

export default function Ground() {
  return (
    <>
      {/* Solid ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#2a2a1e" roughness={1} metalness={0} />
      </mesh>

      {/* Scale grid – 1 m cells, subdivided into 25 cm */}
      <Grid
        position={[0, 0, 0]}
        args={[60, 60]}
        cellSize={0.25}
        cellThickness={0.4}
        cellColor="#4a5a3a"
        sectionSize={1}
        sectionThickness={1}
        sectionColor="#6a8a5a"
        fadeDistance={30}
        fadeStrength={1}
        infiniteGrid={false}
      />
    </>
  );
}
