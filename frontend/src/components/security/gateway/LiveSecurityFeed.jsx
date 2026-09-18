import { useState, useEffect, useRef } from "react";
import { Terminal, Play, Pause, Trash2, RefreshCw } from "lucide-react";

const LiveSecurityFeed = ({ liveEvents = [], isPaused, onTogglePause }) => {
  const [logs, setLogs] = useState([]);
  const feedRef = useRef(null);

  useEffect(() => {
    if (!isPaused && liveEvents.length > 0) {
      setLogs(liveEvents);
    }
  }, [liveEvents, isPaused]);

  const handleClear = () => {
    setLogs([]);
  };

  return (
    <div className="soc-card" style={{ background: "#0b0f19", border: "1px solid #1e293b", color: "#ffffff" }}>
      <div className="soc-card-header">
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Terminal size={18} color="#38bdf8" />
          <h3 className="soc-card-title" style={{ color: "#ffffff", fontSize: "0.98rem" }}>
            Real-Time Security Event Stream
          </h3>
          <span style={{ fontSize: "0.75rem", color: isPaused ? "#f59e0b" : "#34d399", fontWeight: 700 }}>
            {isPaused ? "⏸️ PAUSED" : "● LIVE MONITORING"}
          </span>
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            type="button"
            onClick={onTogglePause}
            className="sim-btn"
            style={{
              padding: "0.35rem 0.75rem",
              fontSize: "0.78rem",
              background: isPaused ? "#2563eb" : "#334155",
              color: "#ffffff",
              border: "none",
            }}
          >
            {isPaused ? <Play size={13} /> : <Pause size={13} />}
            <span>{isPaused ? "Resume Feed" : "Pause Feed"}</span>
          </button>

          <button
            type="button"
            onClick={handleClear}
            className="sim-btn"
            style={{
              padding: "0.35rem 0.65rem",
              fontSize: "0.78rem",
              background: "#1e293b",
              color: "#94a3b8",
              border: "1px solid #334155",
            }}
            title="Clear Stream View"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <div className="soc-feed-container" ref={feedRef}>
        {logs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2rem", color: "#64748b", fontSize: "0.85rem" }}>
            <RefreshCw size={20} style={{ margin: "0 auto 0.5rem", display: "block", animation: "spin 3s linear infinite" }} />
            Listening for security gateway traffic events...
          </div>
        ) : (
          logs.map((ev, idx) => {
            const timeStr = ev.timestamp
              ? new Date(ev.timestamp).toLocaleTimeString([], { hour12: false })
              : new Date().toLocaleTimeString([], { hour12: false });
            const decisionClass = ev.gatewayDecision || (ev.actionTaken === "BLOCKED" ? "BLOCKED" : "NORMAL");

            return (
              <div key={idx} className={`feed-log-line ${decisionClass}`}>
                <span className="feed-time">[{timeStr}]</span>
                <span
                  style={{
                    fontSize: "0.68rem",
                    padding: "0.15rem 0.4rem",
                    borderRadius: "3px",
                    fontWeight: 800,
                    background: ev.isSimulation
                      ? "rgba(168, 85, 247, 0.25)"
                      : "rgba(59, 130, 246, 0.2)",
                    color: ev.isSimulation ? "#c084fc" : "#60a5fa",
                    marginRight: "0.35rem",
                  }}
                >
                  {ev.isSimulation ? "SIMULATION" : "REAL"}
                </span>
                <span className={`feed-badge ${decisionClass}`}>
                  {decisionClass}
                </span>
                <div className="feed-msg">
                  <strong>{ev.endpoint || "/"}</strong> {ev.httpMethod ? `[${ev.httpMethod}]` : ""}
                  {ev.userEmail ? ` - User: ${ev.userEmail}` : ""}
                  {ev.ipAddress ? ` (${ev.ipAddress})` : ""}
                  {" — "}
                  <span style={{ color: "#94a3b8" }}>{ev.reason || "Traffic evaluated by security gateway"}</span>
                  {ev.riskScore ? (
                    <span style={{ marginLeft: "0.5rem", color: ev.riskScore >= 60 ? "#f87171" : "#fbbf24", fontWeight: 700 }}>
                      [Risk: {ev.riskScore}/100]
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default LiveSecurityFeed;
