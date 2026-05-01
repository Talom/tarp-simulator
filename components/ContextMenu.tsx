'use client';
import { useEffect, useMemo, useRef } from 'react';
import { useSimStore } from '../store/simulatorStore';
import { isAnchorPinPoint } from '../utils/tarpPhysics';

// Floating right-click menu for tie points (anchors) and poles.
// Lets the user attach the element to its nearest fixpoint (ground or
// pole top) or detach it from its current attachment.
export default function ContextMenu() {
  const contextMenu                  = useSimStore((s) => s.contextMenu);
  const closeContextMenu             = useSimStore((s) => s.closeContextMenu);
  const anchorPoints                 = useSimStore((s) => s.anchorPoints);
  const poles                        = useSimStore((s) => s.poles);
  const attachAnchorToNearestFixpoint = useSimStore((s) => s.attachAnchorToNearestFixpoint);
  const detachAnchorFromFixpoint     = useSimStore((s) => s.detachAnchorFromFixpoint);
  const attachNearestAnchorToPole    = useSimStore((s) => s.attachNearestAnchorToPole);
  const detachAnchorsFromPole        = useSimStore((s) => s.detachAnchorsFromPole);

  const menuRef = useRef<HTMLDivElement | null>(null);

  // Dismiss on Escape, or on any click outside the menu.
  useEffect(() => {
    if (!contextMenu) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeContextMenu(); };
    const onDown = (e: PointerEvent) => {
      if (menuRef.current && menuRef.current.contains(e.target as Node)) return;
      closeContextMenu();
    };
    window.addEventListener('keydown', onKey);
    // Use a microtask delay so the same click that opened the menu doesn't
    // immediately close it.
    const t = window.setTimeout(() => {
      window.addEventListener('pointerdown', onDown);
    }, 0);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
      window.clearTimeout(t);
    };
  }, [contextMenu, closeContextMenu]);

  // Compute current attach-state and the action set BEFORE the early return.
  // `useMemo` must run unconditionally to keep hook order stable.
  const info = useMemo(() => {
    if (!contextMenu) return null;
    if (contextMenu.target.type === 'anchor') {
      const a = anchorPoints.find((x) => x.id === contextMenu.target.id);
      if (!a) return null;
      const attached = isAnchorPinPoint(a.position, poles);
      return { kind: 'anchor' as const, attached, label: 'Tie Point' };
    } else {
      const pole = poles.find((p) => p.id === contextMenu.target.id);
      if (!pole) return null;
      const top: [number, number, number] = [pole.basePosition[0], pole.height, pole.basePosition[1]];
      const attached = anchorPoints.some((a) => {
        const dx = a.position[0] - top[0];
        const dy = a.position[1] - top[1];
        const dz = a.position[2] - top[2];
        return dx * dx + dy * dy + dz * dz <= 1e-4;
      });
      return { kind: 'pole' as const, attached, label: 'Mast' };
    }
  }, [contextMenu, anchorPoints, poles]);

  if (!contextMenu || !info) return null;

  // Clamp menu to viewport so it doesn't overflow at screen edges
  const MENU_W = 220;
  const MENU_H = 70;
  const x = Math.min(contextMenu.x, window.innerWidth  - MENU_W - 4);
  const y = Math.min(contextMenu.y, window.innerHeight - MENU_H - 4);

  const handle = (action: () => void) => {
    action();
    closeContextMenu();
  };

  const target = contextMenu.target;

  const onAttach = () => {
    if (target.type === 'anchor') {
      handle(() => attachAnchorToNearestFixpoint(target.id));
    } else {
      handle(() => attachNearestAnchorToPole(target.id));
    }
  };

  const onDetach = () => {
    if (target.type === 'anchor') {
      handle(() => detachAnchorFromFixpoint(target.id));
    } else {
      handle(() => detachAnchorsFromPole(target.id));
    }
  };

  const wrap: React.CSSProperties = {
    position: 'fixed',
    top: y,
    left: x,
    zIndex: 200,
    minWidth: MENU_W,
    background: 'rgba(20, 24, 14, 0.97)',
    border: '1px solid #4a5a3a',
    borderRadius: 4,
    boxShadow: '0 6px 18px rgba(0,0,0,0.45)',
    color: '#d4ddb8',
    fontFamily: 'monospace',
    fontSize: 12,
    userSelect: 'none',
    padding: 4,
  };

  const header: React.CSSProperties = {
    padding: '4px 8px',
    color: '#7a9a5a',
    borderBottom: '1px solid #2a3a1a',
    marginBottom: 4,
    fontSize: 11,
    letterSpacing: 0.5,
  };

  const item = (enabled: boolean): React.CSSProperties => ({
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '6px 10px',
    background: 'transparent',
    border: 'none',
    color: enabled ? '#c8e0a0' : '#5a6a4a',
    cursor: enabled ? 'pointer' : 'not-allowed',
    fontFamily: 'inherit',
    fontSize: 12,
    borderRadius: 2,
  });

  // Stop bubbling so the global pointerdown dismiss handler doesn't fire.
  const stop = (e: React.PointerEvent | React.MouseEvent) => e.stopPropagation();

  return (
    <div
      ref={menuRef}
      style={wrap}
      onPointerDown={stop}
      onContextMenu={(e) => { e.preventDefault(); stop(e); }}
    >
      <div style={header}>{info.label}</div>

      <button
        type="button"
        style={item(!info.attached)}
        disabled={info.attached}
        onClick={onAttach}
        onPointerEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = info.attached ? 'transparent' : '#2a3a1a'; }}
        onPointerLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
      >
        An nächsten Fixpunkt anbinden
      </button>

      <button
        type="button"
        style={item(info.attached)}
        disabled={!info.attached}
        onClick={onDetach}
        onPointerEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = info.attached ? '#2a3a1a' : 'transparent'; }}
        onPointerLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
      >
        Vom Fixpunkt lösen
      </button>
    </div>
  );
}
