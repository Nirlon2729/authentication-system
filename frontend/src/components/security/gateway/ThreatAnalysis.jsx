import { Shield, Target, AlertTriangle, UserX } from "lucide-react";

const ThreatAnalysis = ({ analytics }) => {
  if (!analytics) return null;

  const {
    riskScoreDistribution = [],
    attackTypeDistribution = [],
    topTargetedEndpoints = [],
    topClients = [],
  } = analytics;

  const totalRiskCount = riskScoreDistribution.reduce((acc, cur) => acc + (cur.count || 0), 0) || 1;
  const totalAttackCount = attackTypeDistribution.reduce((acc, cur) => acc + (cur.count || 0), 0) || 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div className="soc-charts-row">
        {/* Risk Score Distribution */}
        <div className="soc-card">
          <div className="soc-card-header">
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Shield size={18} color="#f59e0b" />
              <h4 className="soc-card-title">AI Risk Score Distribution</h4>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", marginTop: "0.5rem" }}>
            {riskScoreDistribution.map((item, idx) => {
              const pct = Math.round(((item.count || 0) / totalRiskCount) * 100);
              return (
                <div key={idx} style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", fontWeight: 600 }}>
                    <span>{item.label}</span>
                    <span style={{ color: "var(--text-muted)" }}>{item.count} events ({pct}%)</span>
                  </div>
                  <div style={{ height: "8px", background: "var(--bg-subtle)", borderRadius: "4px", overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${pct}%`,
                        background: item.color,
                        borderRadius: "4px",
                        transition: "width 0.4s ease",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Attack / Event Type Distribution */}
        <div className="soc-card">
          <div className="soc-card-header">
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <AlertTriangle size={18} color="#ef4444" />
              <h4 className="soc-card-title">Security Event Categories</h4>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", maxHeight: "260px", overflowY: "auto" }}>
            {attackTypeDistribution.map((cat, idx) => {
              const pct = Math.round(((cat.count || 0) / totalAttackCount) * 100);
              return (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.8rem", padding: "0.35rem 0.5rem", borderRadius: "4px", background: "var(--bg-subtle)" }}>
                  <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{cat.type}</span>
                  <span className="sev-badge LOW" style={{ background: "var(--bg-card)" }}>
                    {cat.count} ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="soc-charts-row">
        {/* Top Targeted Endpoints */}
        <div className="soc-card">
          <div className="soc-card-header">
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Target size={18} color="#3b82f6" />
              <h4 className="soc-card-title">Top Targeted Endpoints</h4>
            </div>
          </div>

          {topTargetedEndpoints.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: "0.84rem", padding: "1rem" }}>
              No high-risk targeted endpoints recorded.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {topTargetedEndpoints.map((ep, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.65rem 0.85rem",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-card)",
                    fontSize: "0.84rem",
                  }}
                >
                  <code style={{ fontWeight: 700, color: "var(--text-primary)" }}>{ep.endpoint}</code>
                  <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
                    <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{ep.count} hits</span>
                    <span className="sev-badge HIGH">Risk: {ep.maxRisk}/100</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Abnormal Clients */}
        <div className="soc-card">
          <div className="soc-card-header">
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <UserX size={18} color="#ec4899" />
              <h4 className="soc-card-title">Top Abnormal Clients</h4>
            </div>
          </div>

          {topClients.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: "0.84rem", padding: "1rem" }}>
              No abnormal client behavior recorded.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {topClients.map((c, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.65rem 0.85rem",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-card)",
                    fontSize: "0.84rem",
                  }}
                >
                  <div>
                    <code style={{ fontWeight: 700, color: "var(--text-primary)" }}>#{c.clientId.slice(0, 10)}...</code>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>IP: {c.ipAddress}</div>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <span className="sev-badge CRITICAL">Score: {c.avgRiskScore}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ThreatAnalysis;
