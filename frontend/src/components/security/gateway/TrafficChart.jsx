import { useState } from "react";
import { TrendingUp } from "lucide-react";

const TrafficChart = ({ timelineData = [], currentRange, onRangeChange }) => {
  const [hoveredBucket, setHoveredBucket] = useState(null);

  const ranges = [
    { label: "1 Min", value: "1m" },
    { label: "5 Min", value: "5m" },
    { label: "15 Min", value: "15m" },
    { label: "1 Hour", value: "1h" },
    { label: "24 Hours", value: "24h" },
  ];

  const maxTraffic = Math.max(
    ...timelineData.map((d) => d.total || 0),
    10
  );

  return (
    <div className="soc-card">
      <div className="soc-card-header">
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <TrendingUp size={20} color="#3b82f6" />
          <h3 className="soc-card-title">Real-Time Traffic & Anomaly Analysis</h3>
        </div>

        <div style={{ display: "flex", gap: "0.35rem", background: "var(--bg-subtle)", padding: "0.2rem", borderRadius: "var(--radius-md)" }}>
          {ranges.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => onRangeChange(r.value)}
              style={{
                padding: "0.3rem 0.65rem",
                borderRadius: "var(--radius-sm)",
                border: "none",
                background: currentRange === r.value ? "var(--color-primary)" : "transparent",
                color: currentRange === r.value ? "#ffffff" : "var(--text-secondary)",
                fontSize: "0.78rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "var(--transition-fast)",
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Traffic Legend */}
      <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap", fontSize: "0.78rem", fontWeight: 600 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: "#10b981", display: "inline-block" }}></span>
          Allowed Traffic
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: "#f59e0b", display: "inline-block" }}></span>
          Suspicious (Monitored)
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: "#ef4444", display: "inline-block" }}></span>
          Blocked Requests
        </span>
      </div>

      {/* SVG / Visual Bar Chart */}
      <div style={{ minHeight: "220px", display: "flex", alignItems: "flex-end", gap: "0.5rem", padding: "1rem 0", position: "relative" }}>
        {timelineData.length === 0 ? (
          <div style={{ margin: "auto", color: "var(--text-muted)", fontSize: "0.85rem" }}>
            No traffic data recorded in this timeframe.
          </div>
        ) : (
          timelineData.map((bucket, index) => {
            const allowedHeight = Math.round(((bucket.allowed || 0) / maxTraffic) * 160);
            const suspiciousHeight = Math.round(((bucket.suspicious || 0) / maxTraffic) * 160);
            const blockedHeight = Math.round(((bucket.blocked || 0) / maxTraffic) * 160);
            const isHovered = hoveredBucket === index;

            return (
              <div
                key={index}
                onMouseEnter={() => setHoveredBucket(index)}
                onMouseLeave={() => setHoveredBucket(null)}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  height: "180px",
                  justifyContent: "flex-end",
                  position: "relative",
                  cursor: "pointer",
                }}
              >
                {/* Tooltip */}
                {isHovered && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: "190px",
                      background: "#0f172a",
                      color: "#ffffff",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "6px",
                      fontSize: "0.72rem",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                      whiteSpace: "nowrap",
                      zIndex: 10,
                      pointerEvents: "none",
                      border: "1px solid rgba(255,255,255,0.1)",
                    }}
                  >
                    <div><strong>{bucket.label}</strong></div>
                    <div>Total: {bucket.total} reqs</div>
                    <div style={{ color: "#34d399" }}>Allowed: {bucket.allowed}</div>
                    <div style={{ color: "#fbbf24" }}>Suspicious: {bucket.suspicious}</div>
                    <div style={{ color: "#f87171" }}>Blocked: {bucket.blocked}</div>
                    {bucket.avgRiskScore > 0 && <div>Avg Risk: {bucket.avgRiskScore}/100</div>}
                  </div>
                )}

                {/* Stacked Bars */}
                <div style={{ width: "100%", maxWidth: "24px", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                  {blockedHeight > 0 && (
                    <div
                      style={{
                        height: `${blockedHeight}px`,
                        background: "#ef4444",
                        borderRadius: "2px 2px 0 0",
                        width: "100%",
                      }}
                    />
                  )}
                  {suspiciousHeight > 0 && (
                    <div
                      style={{
                        height: `${suspiciousHeight}px`,
                        background: "#f59e0b",
                        width: "100%",
                      }}
                    />
                  )}
                  {allowedHeight > 0 && (
                    <div
                      style={{
                        height: `${allowedHeight}px`,
                        background: "#10b981",
                        borderRadius: blockedHeight === 0 && suspiciousHeight === 0 ? "2px 2px 0 0" : "0",
                        width: "100%",
                      }}
                    />
                  )}
                  {bucket.total === 0 && (
                    <div
                      style={{
                        height: "4px",
                        background: "var(--border-color)",
                        borderRadius: "2px",
                        width: "100%",
                      }}
                    />
                  )}
                </div>

                <span
                  style={{
                    fontSize: "0.68rem",
                    color: "var(--text-muted)",
                    marginTop: "0.4rem",
                    whiteSpace: "nowrap",
                    transform: "rotate(-30deg)",
                    transformOrigin: "left top",
                  }}
                >
                  {bucket.label}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default TrafficChart;
