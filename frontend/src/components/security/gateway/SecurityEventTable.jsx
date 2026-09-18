import { useState } from "react";
import { Search, Download, RefreshCw, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { exportSecurityCSV } from "../../../services/securityGatewayService";
import { toast } from "react-toastify";

const SecurityEventTable = ({
  events = [],
  pagination = { total: 0, page: 1, limit: 25, totalPages: 1 },
  loading,
  filters,
  onFilterChange,
  onPageChange,
  onRefresh,
}) => {
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [exporting, setExporting] = useState(false);

  const handleExportCSV = async () => {
    try {
      setExporting(true);
      const blob = await exportSecurityCSV(filters);
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `security_events_${new Date().toISOString().slice(0, 10)}.csv`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Security events CSV exported successfully 📁");
    } catch (err) {
      console.error(err);
      toast.error("Failed to export security events.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="soc-card">
      <div className="soc-card-header">
        <div>
          <h3 className="soc-card-title">Security Event & Traffic Audit Log</h3>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "0.84rem",
              margin: "0.2rem 0 0 0",
            }}
          >
            Comprehensive telemetry containing {pagination.total} security gateway transactions.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={exporting}
            className="sim-btn"
            style={{
              padding: "0.45rem 0.85rem",
              fontSize: "0.8rem",
              background: "var(--bg-subtle)",
            }}
          >
            <Download size={14} />
            <span>{exporting ? "Exporting..." : "Export CSV"}</span>
          </button>

          <button
            type="button"
            onClick={onRefresh}
            className="sim-btn"
            style={{
              padding: "0.45rem 0.65rem",
              fontSize: "0.8rem",
              background: "var(--bg-subtle)",
            }}
            title="Refresh Table"
          >
            <RefreshCw size={14} className={loading ? "spin-icon" : ""} />
          </button>
        </div>
      </div>

      {/* Filter Control Bar */}
      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div style={{ flex: "1 1 220px", position: "relative" }}>
          <Search
            size={15}
            style={{
              position: "absolute",
              left: "0.75rem",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-muted)",
            }}
          />
          <input
            type="text"
            placeholder="Search by IP, client ID, email, or simulation ID..."
            value={filters.search || ""}
            onChange={(e) =>
              onFilterChange({ ...filters, search: e.target.value, page: 1 })
            }
            style={{
              width: "100%",
              padding: "0.55rem 0.75rem 0.55rem 2.2rem",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-color)",
              background: "var(--bg-card)",
              color: "var(--text-primary)",
              fontSize: "0.84rem",
            }}
          />
        </div>

        <select
          value={filters.trafficType || "ALL"}
          onChange={(e) =>
            onFilterChange({ ...filters, trafficType: e.target.value, page: 1 })
          }
          style={{
            padding: "0.55rem 0.75rem",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-color)",
            background: "var(--bg-card)",
            color: "var(--text-primary)",
            fontSize: "0.82rem",
            fontWeight: 600,
          }}
        >
          <option value="ALL">All Traffic Types</option>
          <option value="REAL">Real Traffic Only</option>
          <option value="SIMULATION">Simulation Only</option>
        </select>

        <select
          value={filters.severity || "ALL"}
          onChange={(e) =>
            onFilterChange({ ...filters, severity: e.target.value, page: 1 })
          }
          style={{
            padding: "0.55rem 0.75rem",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-color)",
            background: "var(--bg-card)",
            color: "var(--text-primary)",
            fontSize: "0.82rem",
            fontWeight: 600,
          }}
        >
          <option value="ALL">All Severities</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="CRITICAL">Critical</option>
        </select>

        <select
          value={filters.decision || "ALL"}
          onChange={(e) =>
            onFilterChange({ ...filters, decision: e.target.value, page: 1 })
          }
          style={{
            padding: "0.55rem 0.75rem",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-color)",
            background: "var(--bg-card)",
            color: "var(--text-primary)",
            fontSize: "0.82rem",
            fontWeight: 600,
          }}
        >
          <option value="ALL">All Decisions</option>
          <option value="NORMAL">Normal</option>
          <option value="SUSPICIOUS">Suspicious</option>
          <option value="HIGH_RISK">High Risk</option>
          <option value="CRITICAL">Critical</option>
          <option value="BLOCKED">Blocked</option>
        </select>

        <select
          value={filters.action || "ALL"}
          onChange={(e) =>
            onFilterChange({ ...filters, action: e.target.value, page: 1 })
          }
          style={{
            padding: "0.55rem 0.75rem",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-color)",
            background: "var(--bg-card)",
            color: "var(--text-primary)",
            fontSize: "0.82rem",
            fontWeight: 600,
          }}
        >
          <option value="ALL">All Actions</option>
          <option value="ALLOWED">Allowed</option>
          <option value="MONITORED">Monitored</option>
          <option value="RATE_LIMITED">Rate Limited</option>
          <option value="CHALLENGED">Challenged</option>
          <option value="BLOCKED">Blocked</option>
        </select>

        <select
          value={filters.limit || 25}
          onChange={(e) =>
            onFilterChange({ ...filters, limit: Number(e.target.value), page: 1 })
          }
          style={{
            padding: "0.55rem 0.75rem",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-color)",
            background: "var(--bg-card)",
            color: "var(--text-primary)",
            fontSize: "0.82rem",
            fontWeight: 600,
          }}
        >
          <option value={25}>25 / page</option>
          <option value={50}>50 / page</option>
          <option value={100}>100 / page</option>
        </select>
      </div>

      {/* Table Container */}
      <div className="table-container" style={{ overflowX: "auto" }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Type</th>
              <th>Method & Endpoint</th>
              <th>Client ID / IP</th>
              <th>User / Account</th>
              <th>Status</th>
              <th>Risk Score</th>
              <th>AI Decision</th>
              <th>Action Taken</th>
              <th>Inspector</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={10}
                  style={{
                    textAlign: "center",
                    padding: "2rem",
                    color: "var(--text-muted)",
                  }}
                >
                  <RefreshCw
                    size={24}
                    className="spin-icon"
                    style={{ margin: "0 auto 0.5rem", display: "block" }}
                  />
                  Loading security events...
                </td>
              </tr>
            ) : events.length === 0 ? (
              <tr>
                <td
                  colSpan={10}
                  style={{
                    textAlign: "center",
                    padding: "2rem",
                    color: "var(--text-muted)",
                  }}
                >
                  No security events matching current criteria.
                </td>
              </tr>
            ) : (
              events.map((ev) => (
                <tr key={ev._id || ev.requestId}>
                  <td className="date-cell" style={{ fontSize: "0.78rem" }}>
                    {ev.timestamp
                      ? new Date(ev.timestamp).toLocaleTimeString([], {
                          hour12: false,
                        })
                      : "-"}
                    <div
                      style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}
                    >
                      {ev.timestamp
                        ? new Date(ev.timestamp).toISOString().slice(0, 10)
                        : ""}
                    </div>
                  </td>
                  <td>
                    <span
                      style={{
                        fontSize: "0.68rem",
                        fontWeight: 800,
                        padding: "0.2rem 0.45rem",
                        borderRadius: "4px",
                        background: ev.isSimulation
                          ? "rgba(168, 85, 247, 0.15)"
                          : "rgba(59, 130, 246, 0.15)",
                        color: ev.isSimulation ? "#c084fc" : "#3b82f6",
                        border: ev.isSimulation
                          ? "1px solid rgba(168, 85, 247, 0.3)"
                          : "1px solid rgba(59, 130, 246, 0.3)",
                      }}
                    >
                      {ev.isSimulation ? "SIMULATION" : "REAL"}
                    </span>
                  </td>
                  <td>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.35rem",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.68rem",
                          fontWeight: 800,
                          padding: "0.15rem 0.35rem",
                          borderRadius: "3px",
                          background:
                            ev.httpMethod === "POST" ? "#3b82f6" : "#10b981",
                          color: "#ffffff",
                        }}
                      >
                        {ev.httpMethod || "POST"}
                      </span>
                      <span
                        style={{
                          fontFamily: "monospace",
                          fontSize: "0.78rem",
                          maxWidth: "180px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={ev.endpoint}
                      >
                        {ev.endpoint || "/"}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div>
                      <span
                        style={{
                          fontFamily: "monospace",
                          fontSize: "0.76rem",
                          fontWeight: 700,
                          color: ev.isSimulation ? "#c084fc" : "inherit",
                        }}
                      >
                        {ev.clientIdentifier || "anonymous"}
                      </span>
                      <div
                        style={{
                          fontSize: "0.7rem",
                          color: "var(--text-muted)",
                        }}
                      >
                        {ev.ipAddress || "127.0.0.1"}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span
                      style={{
                        fontSize: "0.78rem",
                        color: ev.userEmail
                          ? "var(--text-primary)"
                          : "var(--text-muted)",
                      }}
                    >
                      {ev.userEmail || "anonymous"}
                    </span>
                  </td>
                  <td>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        color:
                          ev.httpStatus === 403
                            ? "#ef4444"
                            : ev.httpStatus >= 400
                            ? "#f59e0b"
                            : "#10b981",
                      }}
                    >
                      {ev.httpStatus || 200}
                    </span>
                  </td>
                  <td>
                    <span
                      style={{
                        fontWeight: 800,
                        fontSize: "0.82rem",
                        color:
                          (ev.riskScore || 0) >= 60
                            ? "#ef4444"
                            : (ev.riskScore || 0) >= 30
                            ? "#f59e0b"
                            : "#10b981",
                      }}
                    >
                      {ev.riskScore || 0}/100
                    </span>
                  </td>
                  <td>
                    <span className={`sev-badge ${ev.severity || "LOW"}`}>
                      {ev.gatewayDecision || "NORMAL"}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`act-badge ${ev.actionTaken || "ALLOWED"}`}
                    >
                      {ev.actionTaken || "ALLOWED"}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => setSelectedEvent(ev)}
                      className="action-btn"
                      title="Inspect Event Telemetry"
                      style={{
                        padding: "0.35rem",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--border-color)",
                      }}
                    >
                      <Eye size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.75rem",
          paddingTop: "0.75rem",
          borderTop: "1px solid var(--border-color)",
        }}
      >
        <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
          Page {pagination.page} of {pagination.totalPages} ({pagination.total}{" "}
          total events)
        </span>

        <div style={{ display: "flex", gap: "0.35rem" }}>
          <button
            type="button"
            disabled={pagination.page <= 1}
            onClick={() => onPageChange(pagination.page - 1)}
            className="sim-btn"
            style={{ padding: "0.35rem 0.65rem", fontSize: "0.8rem" }}
          >
            <ChevronLeft size={14} />
            <span>Previous</span>
          </button>
          <button
            type="button"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => onPageChange(pagination.page + 1)}
            className="sim-btn"
            style={{ padding: "0.35rem 0.65rem", fontSize: "0.8rem" }}
          >
            <span>Next</span>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Event Inspection Modal */}
      {selectedEvent && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "1rem",
          }}
          onClick={() => setSelectedEvent(null)}
        >
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              borderRadius: "var(--radius-lg)",
              maxWidth: "600px",
              width: "100%",
              padding: "1.75rem",
              boxShadow: "var(--shadow-lg)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1rem",
              }}
            >
              <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>
                Security Event Forensics
              </h3>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "1.2rem",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                }}
              >
                ✕
              </button>
            </div>

            <table
              className="details-table"
              style={{ width: "100%", fontSize: "0.84rem" }}
            >
              <tbody>
                <tr>
                  <td
                    style={{
                      fontWeight: 600,
                      color: "var(--text-muted)",
                      width: "35%",
                    }}
                  >
                    Traffic Type
                  </td>
                  <td>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 800,
                        padding: "0.2rem 0.5rem",
                        borderRadius: "4px",
                        background: selectedEvent.isSimulation
                          ? "rgba(168, 85, 247, 0.15)"
                          : "rgba(59, 130, 246, 0.15)",
                        color: selectedEvent.isSimulation ? "#c084fc" : "#3b82f6",
                      }}
                    >
                      {selectedEvent.isSimulation ? "SIMULATION" : "REAL"}
                    </span>
                  </td>
                </tr>
                {selectedEvent.simulationId && (
                  <tr>
                    <td style={{ fontWeight: 600, color: "var(--text-muted)" }}>
                      Simulation ID
                    </td>
                    <td>
                      <code>{selectedEvent.simulationId}</code>
                    </td>
                  </tr>
                )}
                <tr>
                  <td style={{ fontWeight: 600, color: "var(--text-muted)" }}>
                    Request ID
                  </td>
                  <td>
                    <code>{selectedEvent.requestId || "N/A"}</code>
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600, color: "var(--text-muted)" }}>
                    Event Type
                  </td>
                  <td>
                    <strong>{selectedEvent.eventType}</strong>
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600, color: "var(--text-muted)" }}>
                    Client Fingerprint
                  </td>
                  <td>
                    <code>{selectedEvent.clientIdentifier}</code>
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600, color: "var(--text-muted)" }}>
                    IP Address
                  </td>
                  <td>
                    <code>{selectedEvent.ipAddress}</code>
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600, color: "var(--text-muted)" }}>
                    User Agent
                  </td>
                  <td style={{ wordBreak: "break-all" }}>
                    {selectedEvent.userAgent || "N/A"}
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600, color: "var(--text-muted)" }}>
                    Device / Browser
                  </td>
                  <td>
                    {selectedEvent.browser || "Chrome"} on{" "}
                    {selectedEvent.operatingSystem || "OS"} (
                    {selectedEvent.device || "Desktop"})
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600, color: "var(--text-muted)" }}>
                    Risk Score & Decision
                  </td>
                  <td>
                    <span
                      className={`sev-badge ${
                        selectedEvent.severity || "LOW"
                      }`}
                    >
                      {selectedEvent.gatewayDecision || "NORMAL"} (
                      {selectedEvent.riskScore}/100)
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600, color: "var(--text-muted)" }}>
                    Action Taken
                  </td>
                  <td>
                    <span
                      className={`act-badge ${
                        selectedEvent.actionTaken || "ALLOWED"
                      }`}
                    >
                      {selectedEvent.actionTaken}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600, color: "var(--text-muted)" }}>
                    Reason / Indicator
                  </td>
                  <td>
                    {selectedEvent.reason ||
                      "Evaluated by security gateway baseline"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default SecurityEventTable;
