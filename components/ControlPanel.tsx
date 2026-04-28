'use client';
import { useState, useRef } from 'react';
import { useSimStore, CameraView, ColorVariant, PresetType } from '../store/simulatorStore';
import { buildExport, parseImport } from '../utils/exportImport';

const CAM_VIEWS: { id: CameraView; label: string }[] = [
  { id: 'front', label: 'Vorne' },
  { id: 'back',  label: 'Hinten' },
  { id: 'left',  label: 'Links' },
  { id: 'right', label: 'Rechts' },
  { id: 'top',   label: 'Oben' },
  { id: 'free',  label: 'Frei' },
];

const COLORS: { id: ColorVariant; label: string; swatch: string }[] = [
  { id: 'olive',     label: 'Oliv',          swatch: '#5a6132' },
  { id: 'sand',      label: 'Sand',          swatch: '#c8a96e' },
  { id: 'flecktarn', label: 'Flecktarn',     swatch: '#6e7b50' },
];

const PRESETS: { id: PresetType; label: string }[] = [
  { id: 'a-frame',  label: 'A-Frame' },
  { id: 'lean-to',  label: 'Lean-To' },
  { id: 'diamond',  label: 'Diamond' },
];

export default function ControlPanel() {
  const {
    tarp, controlPanelOpen, toggleControlPanel,
    setTarpConfig, setCameraView, cameraView,
    applyPreset, selectedPreset,
    poles, addPole, removePole,
    ropes, addRope, removeRope,
    anchorPoints,
    exportJSON, importJSON,
  } = useSimStore();

  const [poleHeight, setPoleHeight] = useState('2.00');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const data = buildExport(tarp, anchorPoints, poles, ropes);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tarp-setup.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((txt) => {
      try {
        const { tarp, anchorPoints, poles, ropes } = parseImport(txt);
        importJSON(JSON.stringify({ tarp, anchorPoints, poles, ropes }));
      } catch {
        alert('Ungültige JSON-Datei');
      }
    });
    e.target.value = '';
  };

  const addNewPole = () => {
    const h = parseFloat(poleHeight) || 2;
    addPole({ basePosition: [0, 0], height: Math.max(0.1, h) });
  };

  // ─── Styles ───────────────────────────────────────────────────────────────
  const panel: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    background: 'rgba(20, 24, 14, 0.92)',
    backdropFilter: 'blur(8px)',
    borderBottom: '1px solid #3a4a2a',
    color: '#d4ddb8',
    fontFamily: 'monospace',
    fontSize: 12,
    userSelect: 'none',
  };

  const row: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    padding: '6px 12px',
    borderBottom: '1px solid #2a3a1a',
  };

  const btn = (active = false): React.CSSProperties => ({
    padding: '3px 8px',
    background: active ? '#4a7a2a' : '#2a3a1a',
    border: '1px solid #4a5a3a',
    borderRadius: 3,
    color: active ? '#c8f0a0' : '#a0b080',
    cursor: 'pointer',
    fontSize: 11,
    transition: 'background 0.15s',
  });

  const input: React.CSSProperties = {
    width: 52,
    padding: '2px 4px',
    background: '#1a2010',
    border: '1px solid #3a5a2a',
    borderRadius: 3,
    color: '#c8e0a0',
    fontSize: 11,
  };

  const label: React.CSSProperties = { color: '#7a9a5a', marginRight: 2 };

  const toggleBtn: React.CSSProperties = {
    padding: '4px 10px',
    background: '#1a2a0a',
    border: '1px solid #3a4a2a',
    borderRadius: 3,
    color: '#8aaa6a',
    cursor: 'pointer',
    fontSize: 11,
  };

  return (
    <div style={panel}>
      {/* Header row */}
      <div style={{ ...row, justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 'bold', color: '#a0c070', letterSpacing: 1 }}>
          TARP-AUFBAU SIMULATOR
        </span>
        <button style={toggleBtn} onClick={toggleControlPanel}>
          {controlPanelOpen ? '▲ Einklappen' : '▼ Ausklappen'}
        </button>
      </div>

      {controlPanelOpen && (
        <>
          {/* Row 1: Tarp size + color */}
          <div style={row}>
            <span style={label}>Tarp:</span>

            <span style={label}>B</span>
            <input
              style={input}
              type="number"
              min={0.5} max={10} step={0.25}
              value={tarp.width}
              onChange={(e) => setTarpConfig({ width: parseFloat(e.target.value) || 3 })}
            />
            <span style={label}>m &times;</span>

            <span style={label}>L</span>
            <input
              style={input}
              type="number"
              min={0.5} max={10} step={0.25}
              value={tarp.length}
              onChange={(e) => setTarpConfig({ length: parseFloat(e.target.value) || 3 })}
            />
            <span style={label}>m</span>

            <span style={{ ...label, marginLeft: 12 }}>Farbe:</span>
            {COLORS.map((c) => (
              <button
                key={c.id}
                style={{
                  ...btn(tarp.color === c.id),
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
                onClick={() => setTarpConfig({ color: c.id })}
              >
                <span style={{
                  display: 'inline-block',
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: c.swatch,
                  border: '1px solid #666',
                }} />
                {c.label}
              </button>
            ))}
          </div>

          {/* Row 2: Presets */}
          <div style={row}>
            <span style={label}>Preset:</span>
            {PRESETS.map((p) => (
              <button
                key={p.id}
                style={btn(selectedPreset === p.id)}
                onClick={() => applyPreset(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Row 3: Camera */}
          <div style={row}>
            <span style={label}>Kamera:</span>
            {CAM_VIEWS.map((v) => (
              <button
                key={v.id}
                style={btn(cameraView === v.id)}
                onClick={() => setCameraView(v.id)}
              >
                {v.label}
              </button>
            ))}
          </div>

          {/* Row 4: Poles */}
          <div style={row}>
            <span style={label}>Mast hinzufügen:</span>
            <span style={label}>H</span>
            <input
              style={input}
              type="number"
              min={0.1} max={10} step={0.1}
              value={poleHeight}
              onChange={(e) => setPoleHeight(e.target.value)}
            />
            <span style={label}>m</span>
            <button style={btn()} onClick={addNewPole}>+ Mast</button>

            {poles.length > 0 && (
              <>
                <span style={{ ...label, marginLeft: 12 }}>Entfernen:</span>
                {poles.map((p, i) => (
                  <button key={p.id} style={{ ...btn(), color: '#f08080' }} onClick={() => removePole(p.id)}>
                    Mast {i + 1} ✕
                  </button>
                ))}
              </>
            )}
          </div>

          {/* Row 5: Ropes + Export/Import */}
          <div style={row}>
            <span style={label}>Seile: {ropes.length}</span>
            {ropes.length > 0 && (
              <button
                style={{ ...btn(), color: '#f08080' }}
                onClick={() => ropes.forEach((r) => removeRope(r.id))}
              >
                Alle Seile ✕
              </button>
            )}

            <span style={{ flex: 1 }} />

            <button style={btn()} onClick={handleExport}>↓ JSON Export</button>
            <button
              style={btn()}
              onClick={() => fileRef.current?.click()}
            >
              ↑ JSON Import
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleImport}
            />
          </div>

          {/* Row 6: Help hint */}
          <div style={{ ...row, borderBottom: 'none', color: '#4a6a3a', fontSize: 10 }}>
            Ankerpunkte (rote Kugeln) per Drag &amp; Drop verschieben · Raster: 25 cm
          </div>
        </>
      )}
    </div>
  );
}
