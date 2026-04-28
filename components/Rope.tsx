'use client';
import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { useSimStore, Rope as RopeData } from '../store/simulatorStore';

function resolveEndpoint(
  ep: RopeData['from'],
  anchorMap: Map<string, [number, number, number]>,
  poleTopMap: Map<string, [number, number, number]>,
): [number, number, number] | null {
  if (ep.type === 'anchor') return anchorMap.get(ep.id) ?? null;
  if (ep.type === 'pole_top') return poleTopMap.get(ep.id) ?? null;
  return ep.position;
}

interface RopeProps {
  rope: RopeData;
  onRemove?: () => void;
}

export function RopeMesh({ rope }: RopeProps) {
  const anchorPoints = useSimStore((s) => s.anchorPoints);
  const poles = useSimStore((s) => s.poles);

  const anchorMap = useMemo(
    () => new Map(anchorPoints.map((a) => [a.id, a.position] as [string, [number, number, number]])),
    [anchorPoints],
  );

  const poleTopMap = useMemo(
    () =>
      new Map(
        poles.map((p) => [p.id, [p.basePosition[0], p.height, p.basePosition[1]]] as [string, [number, number, number]]),
      ),
    [poles],
  );

  const from = resolveEndpoint(rope.from, anchorMap, poleTopMap);
  const to   = resolveEndpoint(rope.to,   anchorMap, poleTopMap);

  if (!from || !to) return null;

  return (
    <Line
      points={[from, to]}
      color="#c8a050"
      lineWidth={1.5}
      dashed={false}
    />
  );
}

export default function Ropes() {
  const ropes = useSimStore((s) => s.ropes);
  return (
    <>
      {ropes.map((r) => (
        <RopeMesh key={r.id} rope={r} />
      ))}
    </>
  );
}
