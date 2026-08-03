import { useState } from "react";
import SchematicEditor from "./SchematicEditor.jsx";
import HDLEditor from "./HDLEditor.jsx";

export default function App() {
  const [mode, setMode] = useState("analog"); // 'analog' | 'digital'
  const [handoffDesign, setHandoffDesign] = useState(null);

  function sendToHDL(code) {
    setHandoffDesign(code);
    setMode("digital");
  }

  const tabStyle = (active) => ({
    padding: "6px 14px",
    fontSize: 12,
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
    borderRadius: 6,
    border: `1px solid ${active ? "#5EEAD4" : "#232C38"}`,
    background: active ? "rgba(94,234,212,0.10)" : "#121821",
    color: active ? "#5EEAD4" : "#E6EDF3",
    cursor: "pointer",
  });

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", gap: 8, padding: "8px 14px", background: "#0B0F14", borderBottom: "1px solid #232C38" }}>
        <button style={tabStyle(mode === "analog")} onClick={() => setMode("analog")}>Analog / Schematic</button>
        <button style={tabStyle(mode === "digital")} onClick={() => setMode("digital")}>Digital / HDL</button>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        {mode === "analog" ? (
          <SchematicEditor onSendToHDL={sendToHDL} />
        ) : (
          <HDLEditor externalDesign={handoffDesign} />
        )}
      </div>
    </div>
  );
}
