import React, { useState, useRef, useMemo, useEffect, useCallback } from "react";

// ---------------------------------------------------------------------------
// Component definitions: pin geometry (local coords, unrotated), netlist
// prefix, default SPICE value, and unit label shown in the properties panel.
// ---------------------------------------------------------------------------
const TWO_PIN = [
  { id: "a", dx: -40, dy: 0 },
  { id: "b", dx: 40, dy: 0 },
];
const GND_PIN = [{ id: "a", dx: 0, dy: -20 }];
const MOS_PINS = [
  { id: "d", dx: 0, dy: -40 },
  { id: "g", dx: -40, dy: 0 },
  { id: "s", dx: 0, dy: 40 },
];

const DEFS = {
  resistor: { label: "Resistor", prefix: "R", pins: TWO_PIN, hasValue: true, defaultValue: "1k", unit: "Ω" },
  capacitor: { label: "Capacitor", prefix: "C", pins: TWO_PIN, hasValue: true, defaultValue: "1u", unit: "F" },
  inductor: { label: "Inductor", prefix: "L", pins: TWO_PIN, hasValue: true, defaultValue: "10m", unit: "H" },
  diode: { label: "Diode", prefix: "D", pins: TWO_PIN, hasValue: true, defaultValue: "D1N4148", unit: "" },
  vsource: { label: "V Source", prefix: "V", pins: TWO_PIN, hasValue: true, defaultValue: "5", unit: "V" },
  isource: { label: "I Source", prefix: "I", pins: TWO_PIN, hasValue: true, defaultValue: "1m", unit: "A" },
  ground: { label: "Ground", prefix: "GND", pins: GND_PIN, hasValue: false, defaultValue: "", unit: "" },
  nmos: { label: "NMOS", prefix: "M", pins: MOS_PINS, hasValue: false, defaultValue: "", unit: "" },
  pmos: { label: "PMOS", prefix: "M", pins: MOS_PINS, hasValue: false, defaultValue: "", unit: "" },
};
const PALETTE = ["resistor", "capacitor", "inductor", "diode", "vsource", "isource", "ground", "nmos", "pmos"];

// ---------------------------------------------------------------------------
// Schematic symbol glyphs — reused at full size on canvas and shrunk in the palette.
// ---------------------------------------------------------------------------
function Symbol({ type }) {
  const s = { stroke: "currentColor", strokeWidth: 2, fill: "none" };
  switch (type) {
    case "resistor":
      return (
        <g {...s}>
          <line x1="-40" y1="0" x2="-20" y2="0" />
          <rect x="-20" y="-8" width="40" height="16" />
          <line x1="20" y1="0" x2="40" y2="0" />
        </g>
      );
    case "capacitor":
      return (
        <g {...s}>
          <line x1="-40" y1="0" x2="-6" y2="0" />
          <line x1="-6" y1="-16" x2="-6" y2="16" />
          <line x1="6" y1="-16" x2="6" y2="16" />
          <line x1="6" y1="0" x2="40" y2="0" />
        </g>
      );
    case "inductor":
      return (
        <g {...s}>
          <line x1="-40" y1="0" x2="-24" y2="0" />
          <path d="M -24 0 A 8 8 0 0 1 -8 0" />
          <path d="M -8 0 A 8 8 0 0 1 8 0" />
          <path d="M 8 0 A 8 8 0 0 1 24 0" />
          <line x1="24" y1="0" x2="40" y2="0" />
        </g>
      );
    case "diode":
      return (
        <g style={{ stroke: "currentColor", strokeWidth: 2 }}>
          <line x1="-40" y1="0" x2="-8" y2="0" />
          <polygon points="-8,-12 -8,12 12,0" fill="currentColor" />
          <line x1="12" y1="-12" x2="12" y2="12" />
          <line x1="12" y1="0" x2="40" y2="0" />
        </g>
      );
    case "vsource":
      return (
        <g {...s}>
          <line x1="-40" y1="0" x2="-16" y2="0" />
          <circle cx="0" cy="0" r="16" />
          <text x="0" y="5" textAnchor="middle" fontSize="14" fill="currentColor" stroke="none">V</text>
          <line x1="16" y1="0" x2="40" y2="0" />
        </g>
      );
    case "isource":
      return (
        <g {...s}>
          <line x1="-40" y1="0" x2="-16" y2="0" />
          <circle cx="0" cy="0" r="16" />
          <text x="0" y="5" textAnchor="middle" fontSize="14" fill="currentColor" stroke="none">I</text>
          <line x1="16" y1="0" x2="40" y2="0" />
        </g>
      );
    case "ground":
      return (
        <g style={{ stroke: "currentColor", strokeWidth: 2 }}>
          <line x1="0" y1="-20" x2="0" y2="0" />
          <line x1="-14" y1="0" x2="14" y2="0" />
          <line x1="-9" y1="6" x2="9" y2="6" />
          <line x1="-4" y1="12" x2="4" y2="12" />
        </g>
      );
    case "nmos":
    case "pmos":
      return (
        <g style={{ stroke: "currentColor", strokeWidth: 2, fill: "none" }}>
          <line x1="0" y1="-40" x2="0" y2="-14" />
          <line x1="-14" y1="-14" x2="14" y2="-14" />
          <line x1="-14" y1="-14" x2="-14" y2="14" />
          <line x1="-14" y1="14" x2="14" y2="14" />
          <line x1="0" y1="14" x2="0" y2="40" />
          <line x1="-40" y1="0" x2="-24" y2="0" />
          <line x1="-24" y1="-14" x2="-24" y2="14" />
          {type === "nmos" ? (
            <polygon points="-14,14 -6,10 -6,18" fill="currentColor" />
          ) : (
            <polygon points="-14,-14 -6,-10 -6,-18" fill="currentColor" />
          )}
        </g>
      );
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------
function rotatePoint(dx, dy, deg) {
  const rad = (deg * Math.PI) / 180;
  return { x: dx * Math.cos(rad) - dy * Math.sin(rad), y: dx * Math.sin(rad) + dy * Math.cos(rad) };
}
function pinsOf(c) {
  return DEFS[c.type].pins;
}
function absPin(c, p) {
  const r = rotatePoint(p.dx, p.dy, c.rotation);
  return { x: c.x + r.x, y: c.y + r.y };
}
function snap(v, grid = 20) {
  return Math.round(v / grid) * grid;
}

// ---------------------------------------------------------------------------
// Netlist generation — union-find over wires + coincident pins, ground pins
// collapse to node "0", everything else gets sequential node names.
// ---------------------------------------------------------------------------
function useNetlist(components, wires) {
  return useMemo(() => {
    const parent = {};
    const key = (compId, pinId) => `${compId}:${pinId}`;
    const find = (k) => {
      if (!(k in parent)) parent[k] = k;
      while (parent[k] !== k) {
        parent[k] = parent[parent[k]];
        k = parent[k];
      }
      return k;
    };
    const union = (a, b) => {
      const ra = find(a), rb = find(b);
      if (ra !== rb) parent[ra] = rb;
    };

    components.forEach((c) => pinsOf(c).forEach((p) => find(key(c.id, p.id))));
    wires.forEach((w) => union(key(w.from.compId, w.from.pinId), key(w.to.compId, w.to.pinId)));

    const posMap = {};
    components.forEach((c) =>
      pinsOf(c).forEach((p) => {
        const abs = absPin(c, p);
        const pk = `${Math.round(abs.x)},${Math.round(abs.y)}`;
        const k = key(c.id, p.id);
        if (posMap[pk]) union(posMap[pk], k);
        else posMap[pk] = k;
      })
    );

    const rootIsGround = {};
    components.forEach((c) => {
      if (c.type === "ground") rootIsGround[find(key(c.id, pinsOf(c)[0].id))] = true;
    });

    const nodeNames = {};
    let counter = 1;
    const nodeNameForRoot = (r) => {
      if (rootIsGround[r]) return "0";
      if (!nodeNames[r]) nodeNames[r] = "n" + counter++;
      return nodeNames[r];
    };
    const getPinNode = (compId, pinId) => nodeNameForRoot(find(key(compId, pinId)));

    const typeCounters = {};
    const lines = [];
    let usesMos = false;
    components.forEach((c) => {
      if (c.type === "ground") return;
      typeCounters[c.type] = (typeCounters[c.type] || 0) + 1;
      const num = typeCounters[c.type];
      const nodes = pinsOf(c).map((p) => getPinNode(c.id, p.id));
      const def = DEFS[c.type];
      switch (c.type) {
        case "resistor":
        case "capacitor":
        case "inductor":
        case "diode":
          lines.push(`${def.prefix}${num} ${nodes[0]} ${nodes[1]} ${c.value}`);
          break;
        case "vsource":
          lines.push(`V${num} ${nodes[0]} ${nodes[1]} DC ${c.value}`);
          break;
        case "isource":
          lines.push(`I${num} ${nodes[0]} ${nodes[1]} DC ${c.value}`);
          break;
        case "nmos":
          usesMos = true;
          lines.push(`M${num} ${nodes[0]} ${nodes[1]} ${nodes[2]} ${nodes[2]} NMOS`);
          break;
        case "pmos":
          usesMos = true;
          lines.push(`M${num} ${nodes[0]} ${nodes[1]} ${nodes[2]} ${nodes[2]} PMOS`);
          break;
        default:
          break;
      }
    });

    const header = "* Schematic netlist — generated by EDA Teaching Tool\n";
    const models = usesMos ? ".model NMOS NMOS (LEVEL=1)\n.model PMOS PMOS (LEVEL=1)\n" : "";
    return header + lines.join("\n") + (lines.length ? "\n" : "") + models + ".end";
  }, [components, wires]);
}

// ---------------------------------------------------------------------------
// Main editor
// ---------------------------------------------------------------------------
export default function SchematicEditor() {
  const [components, setComponents] = useState([]);
  const [wires, setWires] = useState([]);
  const [tool, setTool] = useState("select"); // 'select' | 'wire' | 'place'
  const [placeType, setPlaceType] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [wireStart, setWireStart] = useState(null);
  const [idSeq, setIdSeq] = useState(1);
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 1000, h: 640 });
  const svgRef = useRef(null);

  const netlist = useNetlist(components, wires);
  const selected = components.find((c) => c.id === selectedId) || null;

  const toSvgCoords = useCallback((evt) => {
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }, []);

  const isPinConnected = (compId, pinId) =>
    wires.some(
      (w) =>
        (w.from.compId === compId && w.from.pinId === pinId) ||
        (w.to.compId === compId && w.to.pinId === pinId)
    );

  function placeAt(type, x, y) {
    const def = DEFS[type];
    const label = `${def.prefix}${components.filter((c) => c.type === type).length + 1}`;
    setComponents((cs) => [
      ...cs,
      { id: idSeq, type, x: snap(x), y: snap(y), rotation: 0, value: def.defaultValue, label },
    ]);
    setIdSeq((n) => n + 1);
  }

  function handleCanvasClick(evt) {
    const { x, y } = toSvgCoords(evt);
    if (tool === "place" && placeType) {
      placeAt(placeType, x, y);
    } else if (tool === "wire") {
      setWireStart(null);
    } else {
      setSelectedId(null);
    }
  }

  function handleComponentClick(evt, comp) {
    evt.stopPropagation();
    if (tool === "select") setSelectedId(comp.id);
  }

  function handlePinClick(evt, compId, pinId) {
    evt.stopPropagation();
    if (tool !== "wire") return;
    if (!wireStart) {
      setWireStart({ compId, pinId });
    } else if (wireStart.compId === compId && wireStart.pinId === pinId) {
      setWireStart(null);
    } else {
      setWires((ws) => [...ws, { id: idSeq, from: wireStart, to: { compId, pinId } }]);
      setIdSeq((n) => n + 1);
      setWireStart(null);
    }
  }

  function deleteSelected() {
    if (!selectedId) return;
    setComponents((cs) => cs.filter((c) => c.id !== selectedId));
    setWires((ws) => ws.filter((w) => w.from.compId !== selectedId && w.to.compId !== selectedId));
    setSelectedId(null);
  }
  function rotateSelected() {
    if (!selectedId) return;
    setComponents((cs) => cs.map((c) => (c.id === selectedId ? { ...c, rotation: (c.rotation + 90) % 360 } : c)));
  }
  function updateSelectedValue(val) {
    setComponents((cs) => cs.map((c) => (c.id === selectedId ? { ...c, value: val } : c)));
  }
  function zoomBy(factor) {
    setViewBox((v) => {
      const newW = Math.min(2200, Math.max(400, v.w * factor));
      const newH = newW * (640 / 1000);
      const cx = v.x + v.w / 2, cy = v.y + v.h / 2;
      return { x: cx - newW / 2, y: cy - newH / 2, w: newW, h: newH };
    });
  }
  function clearAll() {
    setComponents([]);
    setWires([]);
    setSelectedId(null);
    setWireStart(null);
  }

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") {
        setTool("select");
        setPlaceType(null);
        setWireStart(null);
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        deleteSelected();
      } else if (e.key.toLowerCase() === "r" && selectedId) {
        rotateSelected();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);

  const col = {
    bg: "#0B0F14",
    panel: "#121821",
    panel2: "#0E141B",
    border: "#232C38",
    text: "#E6EDF3",
    dim: "#7C8A9A",
    teal: "#5EEAD4",
    amber: "#FBBF24",
    danger: "#F87171",
    grid: "#1C242F",
  };
  const sans = "Inter, ui-sans-serif, system-ui, sans-serif";
  const mono = "'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace";

  function toolBtnStyle(active) {
    return {
      padding: "6px 10px",
      fontSize: 12,
      fontFamily: sans,
      borderRadius: 6,
      border: `1px solid ${active ? col.amber : col.border}`,
      background: active ? "rgba(251,191,36,0.12)" : col.panel2,
      color: active ? col.amber : col.text,
      cursor: "pointer",
      whiteSpace: "nowrap",
    };
  }

  return (
    <div style={{ width: "100%", height: "100vh", display: "flex", flexDirection: "column", background: col.bg, color: col.text, fontFamily: sans }}>
      {/* Header / toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: `1px solid ${col.border}`, background: col.panel, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginRight: 10 }}>
          Schematic Capture <span style={{ color: col.dim, fontWeight: 400 }}>· EDA Teaching Tool</span>
        </div>
        <button style={toolBtnStyle(tool === "select")} onClick={() => { setTool("select"); setPlaceType(null); }}>Select (Esc)</button>
        <button style={toolBtnStyle(tool === "wire")} onClick={() => { setTool("wire"); setPlaceType(null); }}>Wire</button>
        <button style={toolBtnStyle(false)} onClick={rotateSelected} disabled={!selectedId}>Rotate (R)</button>
        <button style={{ ...toolBtnStyle(false), color: selectedId ? col.danger : col.dim, borderColor: selectedId ? col.danger : col.border }} onClick={deleteSelected} disabled={!selectedId}>Delete</button>
        <span style={{ width: 1, height: 20, background: col.border, margin: "0 4px" }} />
        <button style={toolBtnStyle(false)} onClick={() => zoomBy(0.85)}>Zoom In</button>
        <button style={toolBtnStyle(false)} onClick={() => zoomBy(1 / 0.85)}>Zoom Out</button>
        <span style={{ width: 1, height: 20, background: col.border, margin: "0 4px" }} />
        <button style={{ ...toolBtnStyle(false), color: col.danger, borderColor: col.danger }} onClick={clearAll}>Clear All</button>
      </div>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* Palette */}
        <div style={{ width: 150, borderRight: `1px solid ${col.border}`, background: col.panel, overflowY: "auto", padding: 10 }}>
          <div style={{ fontSize: 11, color: col.dim, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Components</div>
          {PALETTE.map((type) => (
            <button
              key={type}
              onClick={() => { setTool("place"); setPlaceType(type); }}
              style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%", marginBottom: 6,
                padding: "6px 8px", borderRadius: 6, cursor: "pointer",
                border: `1px solid ${tool === "place" && placeType === type ? col.amber : col.border}`,
                background: tool === "place" && placeType === type ? "rgba(251,191,36,0.10)" : col.panel2,
                color: col.text,
              }}
            >
              <svg viewBox="-45 -45 90 90" width="30" height="30" style={{ color: col.teal, flexShrink: 0 }}>
                <Symbol type={type} />
              </svg>
              <span style={{ fontSize: 12 }}>{DEFS[type].label}</span>
            </button>
          ))}
          <div style={{ marginTop: 14, fontSize: 11, color: col.dim, lineHeight: 1.5 }}>
            Pick a part, click the grid to place it (stays armed for more). Switch to <b style={{ color: col.text }}>Wire</b> and click two pins to connect them.
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 99, background: col.amber, display: "inline-block" }} /> unconnected pin
            </div>
            <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 99, background: col.teal, display: "inline-block" }} /> wired pin
            </div>
          </div>
        </div>

        {/* Canvas */}
        <div style={{ flex: 1, position: "relative", background: col.bg }}>
          <svg
            ref={svgRef}
            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
            width="100%"
            height="100%"
            style={{ cursor: tool === "place" ? "copy" : tool === "wire" ? "crosshair" : "default", display: "block" }}
            onClick={handleCanvasClick}
          >
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="1" fill={col.grid} />
              </pattern>
            </defs>
            <rect x={viewBox.x - 200} y={viewBox.y - 200} width={viewBox.w + 400} height={viewBox.h + 400} fill="url(#grid)" />

            {/* wires */}
            {wires.map((w) => {
              const fc = components.find((c) => c.id === w.from.compId);
              const tc = components.find((c) => c.id === w.to.compId);
              if (!fc || !tc) return null;
              const p1 = absPin(fc, pinsOf(fc).find((p) => p.id === w.from.pinId));
              const p2 = absPin(tc, pinsOf(tc).find((p) => p.id === w.to.pinId));
              const midX = (p1.x + p2.x) / 2;
              return (
                <path
                  key={w.id}
                  d={`M ${p1.x} ${p1.y} L ${midX} ${p1.y} L ${midX} ${p2.y} L ${p2.x} ${p2.y}`}
                  stroke={col.teal}
                  strokeWidth="2"
                  fill="none"
                />
              );
            })}

            {/* pending wire indicator */}
            {wireStart &&
              (() => {
                const c = components.find((c) => c.id === wireStart.compId);
                if (!c) return null;
                const p = absPin(c, pinsOf(c).find((p) => p.id === wireStart.pinId));
                return <circle cx={p.x} cy={p.y} r="7" fill="none" stroke={col.amber} strokeWidth="2" />;
              })()}

            {/* components */}
            {components.map((c) => {
              const isSel = c.id === selectedId;
              return (
                <g key={c.id}>
                  <g
                    transform={`translate(${c.x},${c.y}) rotate(${c.rotation})`}
                    style={{ color: isSel ? col.amber : col.text, cursor: tool === "select" ? "pointer" : "default" }}
                    onClick={(e) => handleComponentClick(e, c)}
                  >
                    <Symbol type={c.type} />
                  </g>
                  {DEFS[c.type].hasValue && (
                    <text x={c.x} y={c.y - 26} textAnchor="middle" fontSize="11" fill={col.dim} fontFamily={mono}>
                      {c.label} {c.value}{DEFS[c.type].unit}
                    </text>
                  )}
                  {!DEFS[c.type].hasValue && c.type !== "ground" && (
                    <text x={c.x} y={c.y - 46} textAnchor="middle" fontSize="11" fill={col.dim} fontFamily={mono}>
                      {c.label}
                    </text>
                  )}
                  {/* pins */}
                  {pinsOf(c).map((p) => {
                    const abs = absPin(c, p);
                    const connected = isPinConnected(c.id, p.id);
                    return (
                      <circle
                        key={p.id}
                        cx={abs.x}
                        cy={abs.y}
                        r="5"
                        fill={connected ? col.teal : col.amber}
                        stroke={col.bg}
                        strokeWidth="1"
                        style={{ cursor: tool === "wire" ? "crosshair" : "default" }}
                        onClick={(e) => handlePinClick(e, c.id, p.id)}
                      />
                    );
                  })}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Right panel: properties + netlist */}
        <div style={{ width: 300, borderLeft: `1px solid ${col.border}`, background: col.panel, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ padding: 12, borderBottom: `1px solid ${col.border}` }}>
            <div style={{ fontSize: 11, color: col.dim, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Properties</div>
            {selected ? (
              <div>
                <div style={{ fontSize: 13, marginBottom: 8 }}>
                  <span style={{ color: col.dim }}>Part </span>
                  <b>{selected.label}</b> <span style={{ color: col.dim }}>({DEFS[selected.type].label})</span>
                </div>
                {DEFS[selected.type].hasValue ? (
                  <label style={{ fontSize: 12, color: col.dim, display: "block" }}>
                    Value ({DEFS[selected.type].unit || "—"})
                    <input
                      value={selected.value}
                      onChange={(e) => updateSelectedValue(e.target.value)}
                      style={{
                        display: "block", width: "100%", marginTop: 4, padding: "6px 8px",
                        background: col.panel2, border: `1px solid ${col.border}`, borderRadius: 6,
                        color: col.text, fontFamily: mono, fontSize: 13,
                      }}
                    />
                  </label>
                ) : (
                  <div style={{ fontSize: 12, color: col.dim }}>No editable value for this part yet.</div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: col.dim }}>Select a component to edit its value, rotate, or delete it.</div>
            )}
          </div>

          <div style={{ padding: "10px 12px 4px", fontSize: 11, color: col.dim, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Netlist (live)
          </div>
          <pre
            style={{
              flex: 1, margin: 0, padding: "8px 12px 16px", overflow: "auto",
              fontFamily: mono, fontSize: 12, lineHeight: 1.6, color: "#8FE3B0",
              background: col.panel2, whiteSpace: "pre-wrap", wordBreak: "break-word",
            }}
          >
            {netlist}
            <span style={{ animation: "blink 1s step-start infinite" }}>▋</span>
          </pre>
        </div>
      </div>
      <style>{`@keyframes blink { 50% { opacity: 0; } }`}</style>
    </div>
  );
}
