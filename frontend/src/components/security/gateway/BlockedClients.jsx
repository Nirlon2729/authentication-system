import { useState } from "react";
import { CheckCircle, RefreshCw, Unlock, ShieldAlert } from "lucide-react";
import { unblockSecurityClient } from "../../../services/securityGatewayService";
import { toast } from "react-toastify";

const BlockedClients = ({ blockedClients = [], onRefresh }) => {
  const [unblockingId, setUnblockingId] = useState(null);

  const handleUnblock = async (clientId) => {
    try {
      setUnblockingId(clientId);
      const res = await unblockSecurityClient(clientId);
      toast.success(res.message || `Client ${clientId} unblocked successfully.`);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to unblock client.");
    } finally {
      setUnblockingId(null);
    }
  };

  return (
    <div className="soc-card">
      <div className="soc-card-header">
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <ShieldAlert size={20} color="#ef4444" />
          <h3 className="soc-card-title">Active Temporary Blocklist ({blockedClients.length})</h3>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          className="sim-btn"
          style={{
            padding: "0.45rem 0.65rem",
            fontSize: "0.8rem",
            background: "var(--bg-subtle)",
          }}
          title="Refresh Blocklist"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {blockedClients.length === 0 ? (
        <div
          style={{
            padding: "2.5rem 1rem",
            textAlign: "center",
            color: "var(--text-muted)",
          }}
        >
          <CheckCircle
            size={36}
            color="#10b981"
            style={{ margin: "0 auto 0.75rem", display: "block" }}
          />
          <h4
            style={{
              margin: "0 0 0.25rem 0",
              color: "var(--text-primary)",
              fontWeight: 700,
            }}
          >
            No Clients Currently Blocked
          </h4>
          <p style={{ margin: 0, fontSize: "0.84rem" }}>
            The AI Security Gateway has not detected active critical threats requiring temporary IP/fingerprint blocks.
          </p>
        </div>
      ) : (
        <div className="table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Client Identifier</th>
                <th>IP Address</th>
                <th>Trigger Reason</th>
                <th>Risk Score</th>
                <th>Remaining Ban Time</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {blockedClients.map((client) => {
                const isSim =
                  client.isSimulation || client.clientType === "SIMULATION";

                return (
                  <tr key={client.clientId}>
                    <td>
                      <span
                        style={{
                          fontSize: "0.68rem",
                          fontWeight: 800,
                          padding: "0.15rem 0.45rem",
                          borderRadius: "4px",
                          background: isSim
                            ? "rgba(168, 85, 247, 0.2)"
                            : "rgba(239, 68, 68, 0.2)",
                          color: isSim ? "#c084fc" : "#ef4444",
                          border: isSim
                            ? "1px solid rgba(168, 85, 247, 0.3)"
                            : "1px solid rgba(239, 68, 68, 0.3)",
                        }}
                      >
                        {isSim ? "SIMULATION" : "REAL"}
                      </span>
                    </td>
                    <td>
                      <code
                        style={{
                          fontWeight: 700,
                          fontSize: "0.82rem",
                          color: isSim ? "#c084fc" : "inherit",
                        }}
                      >
                        {client.clientId}
                      </code>
                    </td>
                    <td>
                      <code>{client.ipAddress || "127.0.0.1"}</code>
                    </td>
                    <td style={{ fontSize: "0.82rem", maxWidth: "250px" }}>
                      {client.reason || "Automated anomaly detected"}
                    </td>
                    <td>
                      <span className="sev-badge CRITICAL">
                        {client.riskScore || 95}/100
                      </span>
                    </td>
                    <td
                      style={{
                        fontSize: "0.82rem",
                        fontWeight: 700,
                        color: "#f59e0b",
                      }}
                    >
                      {client.remainingSeconds > 0
                        ? `${client.remainingSeconds}s remaining`
                        : "Expiring"}
                    </td>
                    <td>
                      <button
                        type="button"
                        disabled={unblockingId === client.clientId}
                        onClick={() => handleUnblock(client.clientId)}
                        className="sim-btn"
                        style={{
                          padding: "0.35rem 0.75rem",
                          fontSize: "0.78rem",
                          background: "#10b981",
                          color: "#ffffff",
                          border: "none",
                        }}
                      >
                        <Unlock size={13} />
                        <span>
                          {unblockingId === client.clientId
                            ? "Unblocking..."
                            : "Manual Unblock"}
                        </span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default BlockedClients;
