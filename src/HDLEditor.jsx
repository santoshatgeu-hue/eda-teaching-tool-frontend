import React, { useState, useEffect } from "react";

const DEFAULT_DESIGN = `module counter(input clk, input rst, output reg [3:0] count);
  always @(posedge clk or posedge rst) begin
    if (rst) count <= 0;
    else count <= count + 1;
  end
endmodule
`;

const DEFAULT_TESTBENCH = `\`timescale 1ns/1ps
module tb;
  reg clk = 0, rst = 1;
  wire [3:0] count;
  counter dut(.clk(clk), .rst(rst), .count(count));
  always #5 clk = ~clk;
  initial begin
    $dumpfile("out.vcd");
    $dumpvars(0, tb);
    #12 rst = 0;
    #100 $finish;
  end
endmodule
`;

// ---------------------------------------------------------------------------
// Digital timing-diagram renderer. 1-bit signals draw as a stepped square
// wave; multi-bit signals draw as a labeled "bus" row (value text between
// transitions), which is the conventional way tools like GTKWave show buses.
// ---------------------------------------------------------------------------
function DigitalWaveform({ signals, endTime, col, mono }) {
  if (!signals || !signals.length || !endTime) return null;
  const rowH = 34, labelW = 90, w = 560, plotW = w - labelW - 16;
  const sx = (t) => labelW + (t / endTime) * plotW;

  return (
    <svg width={w} height={rowH * signals.length + 10} style={{ background: "#0E141B", borderRadius: 6 }}>
      {signals.map((sig, i) => {
        const y = i * rowH + rowH / 2;
        const top = y - 10, bot = y + 10;
        const pts = sig.points;
        if (!pts.length) return null;

        if (sig.width === 1) {
          let stepPath = `M ${sx(pts[0].time)} ${pts[0].value === 1 ? top : bot}`;
          for (let idx = 1; idx < pts.length; idx++) {
            const prevLevel = pts[idx - 1].value === 1 ? top : bot;
            const level = pts[idx].value === 1 ? top : bot;
            const x = sx(pts[idx].time);
            stepPath += ` L ${x} ${prevLevel} L ${x} ${level}`;
          }
          const lastLevel = pts[pts.length - 1].value === 1 ? top : bot;
          stepPath += ` L ${sx(endTime)} ${lastLevel}`;
          return (
            <g key={sig.name}>
              <text x="4" y={y + 4} fontSize="11" fill={col.dim} fontFamily={mono}>{sig.name}</text>
              <path d={stepPath} fill="none" stroke={col.teal} strokeWidth="1.5" />
            </g>
          );
        }

        // multi-bit bus row: rectangles with value labels between transitions
        return (
          <g key={sig.name}>
            <text x="4" y={y + 4} fontSize="11" fill={col.dim} fontFamily={mono}>{sig.name}</text>
            {pts.map((p, idx) => {
              const x1 = sx(p.time);
              const x2 = idx + 1 < pts.length ? sx(pts[idx + 1].time) : sx(endTime);
              return (
                <g key={idx}>
                  <rect x={x1} y={top} width={Math.max(1, x2 - x1)} height={bot - top} fill="none" stroke={col.amber} strokeWidth="1" />
                  {x2 - x1 > 18 && (
                    <text x={(x1 + x2) / 2} y={y + 3} fontSize="9" fill={col.amber} textAnchor="middle" fontFamily={mono}>
                      {p.value === null ? "x" : p.value}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

export default function HDLEditor({ externalDesign } = {}) {
  const [design, setDesign] = useState(DEFAULT_DESIGN);
  const [testbench, setTestbench] = useState(DEFAULT_TESTBENCH);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (externalDesign) setDesign(externalDesign);
  }, [externalDesign]);

  const HDL_API_URL = (import.meta.env.VITE_HDL_API_URL || "").replace(/\/$/, "");

  const col = {
    bg: "#0B0F14", panel: "#121821", panel2: "#0E141B", border: "#232C38",
    text: "#E6EDF3", dim: "#7C8A9A", teal: "#5EEAD4", amber: "#FBBF24", danger: "#F87171",
  };
  const sans = "Inter, ui-sans-serif, system-ui, sans-serif";
  const mono = "'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace";

  async function runSimulation() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      if (!HDL_API_URL) throw new Error("HDL backend not configured — set VITE_HDL_API_URL");
      const resp = await fetch(`${HDL_API_URL}/api/simulate-hdl`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ design, testbench }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) throw new Error(data.error || data.detail || `Simulation failed (HTTP ${resp.status})`);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const textareaStyle = {
    width: "100%", height: "100%", resize: "none", border: "none", outline: "none",
    background: col.panel2, color: col.text, fontFamily: mono, fontSize: 13,
    lineHeight: 1.6, padding: 12, boxSizing: "border-box",
  };

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: col.bg, color: col.text, fontFamily: sans }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: `1px solid ${col.border}`, background: col.panel }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>
          HDL Editor <span style={{ color: col.dim, fontWeight: 400 }}>· EDA Teaching Tool</span>
        </div>
        <div style={{ flex: 1 }} />
        <button
          onClick={runSimulation}
          disabled={loading}
          style={{
            padding: "7px 16px", fontSize: 13, fontFamily: sans, borderRadius: 6, cursor: loading ? "default" : "pointer",
            border: `1px solid ${col.teal}`, background: "rgba(94,234,212,0.10)", color: col.teal, opacity: loading ? 0.5 : 1,
          }}
        >
          {loading ? "Running…" : "Run Simulation"}
        </button>
      </div>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", borderRight: `1px solid ${col.border}` }}>
          <div style={{ padding: "6px 12px", fontSize: 11, color: col.dim, textTransform: "uppercase", letterSpacing: 0.5, background: col.panel, borderBottom: `1px solid ${col.border}` }}>
            Design
          </div>
          <textarea spellCheck="false" value={design} onChange={(e) => setDesign(e.target.value)} style={{ ...textareaStyle, flex: 1 }} />
          <div style={{ padding: "6px 12px", fontSize: 11, color: col.dim, textTransform: "uppercase", letterSpacing: 0.5, background: col.panel, borderTop: `1px solid ${col.border}`, borderBottom: `1px solid ${col.border}` }}>
            Testbench
          </div>
          <textarea spellCheck="false" value={testbench} onChange={(e) => setTestbench(e.target.value)} style={{ ...textareaStyle, flex: 1 }} />
        </div>

        <div style={{ width: 620, display: "flex", flexDirection: "column", background: col.panel }}>
          <div style={{ padding: "6px 12px", fontSize: 11, color: col.dim, textTransform: "uppercase", letterSpacing: 0.5, borderBottom: `1px solid ${col.border}` }}>
            Console
          </div>
          <pre style={{ margin: 0, padding: 12, fontFamily: mono, fontSize: 12, lineHeight: 1.6, color: error ? col.danger : "#8FE3B0", background: col.panel2, minHeight: 90, maxHeight: 160, overflow: "auto", whiteSpace: "pre-wrap" }}>
            {error ? `⚠ ${error}` : result ? (result.stdout || "(no stdout)") : "Run a simulation to see output here."}
          </pre>

          <div style={{ padding: "6px 12px", fontSize: 11, color: col.dim, textTransform: "uppercase", letterSpacing: 0.5, borderTop: `1px solid ${col.border}`, borderBottom: `1px solid ${col.border}` }}>
            Waveform
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
            {result && result.hasWaveform ? (
              <DigitalWaveform signals={result.signals} endTime={result.endTime} col={col} mono={mono} />
            ) : (
              <div style={{ fontSize: 12, color: col.dim }}>
                No waveform yet — make sure your testbench calls <code>$dumpfile("out.vcd")</code> and <code>$dumpvars(...)</code>.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
