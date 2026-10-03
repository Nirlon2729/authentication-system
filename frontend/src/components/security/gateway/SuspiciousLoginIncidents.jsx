import { useState, useEffect } from "react";
import {
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  Clock,
  Globe,
  Laptop,
  CheckCircle2,
  HelpCircle,
  FileText,
} from "lucide-react";
import { getAdminLoginIncidents, updateAdminIncidentStatus } from "../../../services/authService";

const getSeverityBadge = (level) => {
  switch (level) {
    case "CRITICAL":
      return { bg: "#fef2f2", text: "#991b1b", border: "#fecaca" };
    case "HIGH":
      return { bg: "#fff1f2", text: "#be123c", border: "#fecdd3" };
    case "MEDIUM":
      return { bg: "#fffbeb", text: "#b45309", border: "#fde68a" };
    default:
      return { bg: "#f0fdf4", text: "#166534", border: "#bbf7d0" };
  }
};

const getStatusBadge = (status) => {
  switch (status) {
    case "RESOLVED":
      return { bg: "#ecfdf5", text: "#065f46", border: "#a7f3d0", label: "Resolved" };
    case "FALSE_POSITIVE":
      return { bg: "#f1f5f9", text: "#475569", border: "#cbd5e1", label: "False Positive" };
    case "UNDER_INVESTIGATION":
      return { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe", label: "Under Investigation" };
    default:
      return { bg: "#fff7ed", text: "#c2410c", border: "#ffedd5", label: "New Incident" };
  }
};

const SuspiciousLoginIncidents = () => {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [severityFilter, setSeverityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [editingNotesId, setEditingNotesId] = useState(null);
  const [noteText, setNoteText] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const fetchIncidents = async (pageNum = 1) => {
    setLoading(true);
    try {
      const res = await getAdminLoginIncidents({
        page: pageNum,
        limit: 15,
        severity: severityFilter || undefined,
        status: statusFilter || undefined,
        search: searchTerm || undefined,
      });

      if (res?.success) {
        setIncidents(res.incidents || []);
        setTotalPages(res.pages || 1);
        setPage(res.currentPage || 1);
      }
    } catch (err) {
      console.error("Failed to fetch admin incidents:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents(page);
  }, [page, severityFilter, statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchIncidents(1);
  };

  const handleStatusChange = async (incidentId, newStatus) => {
    setActionLoading(true);
    try {
      await updateAdminIncidentStatus(incidentId, { status: newStatus });
      fetchIncidents(page);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update incident.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveNotes = async (incidentId) => {
    setActionLoading(true);
    try {
      const target = incidents.find((i) => i._id === incidentId);
      await updateAdminIncidentStatus(incidentId, {
        status: target?.investigationStatus || "UNDER_INVESTIGATION",
        notes: noteText,
      });
      setEditingNotesId(null);
      fetchIncidents(page);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to save investigation notes.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Filter and Search Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
          background: "var(--bg-card)",
          padding: "1rem 1.25rem",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-color)",
        }}
      >
        <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: "0.5rem", flex: "1 1 300px" }}>
          <div style={{ position: "relative", width: "100%" }}>
            <Search size={16} style={{ position: "absolute", left: "10px", top: "11px", color: "var(--text-secondary)" }} />
            <input
              type="text"
              placeholder="Search user email, IP address, or browser..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem 0.5rem 2.2rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-color)",
                background: "var(--bg-primary)",
                color: "var(--text-primary)",
                fontSize: "0.85rem",
              }}
            />
          </div>
          <button
            type="submit"
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "var(--radius-md)",
              border: "none",
              background: "var(--primary-600)",
              color: "#ffffff",
              fontWeight: "600",
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            Search
          </button>
        </form>

        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <Filter size={14} color="var(--text-secondary)" />
            <select
              value={severityFilter}
              onChange={(e) => {
                setSeverityFilter(e.target.value);
                setPage(1);
              }}
              style={{
                padding: "0.45rem 0.75rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-color)",
                background: "var(--bg-primary)",
                color: "var(--text-primary)",
                fontSize: "0.85rem",
              }}
            >
              <option value="">All Severities</option>
              <option value="CRITICAL">Critical Severity</option>
              <option value="HIGH">High Severity</option>
              <option value="MEDIUM">Medium Severity</option>
            </select>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            style={{
              padding: "0.45rem 0.75rem",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-color)",
              background: "var(--bg-primary)",
              color: "var(--text-primary)",
              fontSize: "0.85rem",
            }}
          >
            <option value="">All Incident Statuses</option>
            <option value="UNDER_INVESTIGATION">Under Investigation</option>
            <option value="RESOLVED">Resolved</option>
            <option value="FALSE_POSITIVE">False Positive</option>
          </select>

          <button
            onClick={() => fetchIncidents(page)}
            disabled={loading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              padding: "0.45rem 0.85rem",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-color)",
              background: "var(--bg-primary)",
              color: "var(--primary-600)",
              fontSize: "0.85rem",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Incident List */}
      {loading && incidents.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--text-secondary)" }}>
          <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 0.75rem", display: "block" }} />
          Loading suspicious login incidents...
        </div>
      ) : incidents.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "3rem 1rem",
            background: "var(--bg-card)",
            borderRadius: "var(--radius-lg)",
            border: "1px dashed var(--border-color)",
            color: "var(--text-secondary)",
            fontSize: "0.95rem",
          }}
        >
          No suspicious login incidents found matching the specified criteria.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {incidents.map((inc) => {
            const sevBadge = getSeverityBadge(inc.riskLevel);
            const statBadge = getStatusBadge(inc.investigationStatus);
            const locationStr = inc.location?.city && inc.location?.country
              ? `${inc.location.city}, ${inc.location.country}`
              : (inc.location?.country || "Local Network");

            return (
              <div
                key={inc._id}
                style={{
                  background: "var(--bg-card)",
                  border: `1px solid ${inc.riskLevel === "CRITICAL" ? "#fca5a5" : "var(--border-color)"}`,
                  borderRadius: "var(--radius-lg)",
                  padding: "1.25rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.85rem",
                }}
              >
                {/* Header row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                      <span style={{ fontSize: "1.05rem", fontWeight: "700", color: "var(--text-primary)" }}>
                        {inc.userEmail}
                      </span>
                      <span
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: "700",
                          padding: "0.15rem 0.55rem",
                          borderRadius: "var(--radius-full)",
                          background: sevBadge.bg,
                          color: sevBadge.text,
                          border: `1px solid ${sevBadge.border}`,
                        }}
                      >
                        {inc.riskLevel} RISK ({inc.riskScore}/100)
                      </span>
                      <span
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: "700",
                          padding: "0.15rem 0.55rem",
                          borderRadius: "var(--radius-full)",
                          background: statBadge.bg,
                          color: statBadge.text,
                          border: `1px solid ${statBadge.border}`,
                        }}
                      >
                        {statBadge.label}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "0.3rem" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                        <Clock size={12} />
                        {new Date(inc.timestamp).toLocaleString()}
                      </span>
                      <span>•</span>
                      <span>Provider: <strong>{inc.provider?.toUpperCase()}</strong></span>
                      <span>•</span>
                      <span>IP: <code>{inc.ipAddress}</code></span>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    <button
                      onClick={() => handleStatusChange(inc._id, "UNDER_INVESTIGATION")}
                      disabled={actionLoading}
                      style={{
                        padding: "0.35rem 0.65rem",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--border-color)",
                        background: "var(--bg-primary)",
                        color: "#1d4ed8",
                        fontSize: "0.75rem",
                        fontWeight: "600",
                        cursor: "pointer",
                      }}
                    >
                      Investigate
                    </button>
                    <button
                      onClick={() => handleStatusChange(inc._id, "RESOLVED")}
                      disabled={actionLoading}
                      style={{
                        padding: "0.35rem 0.65rem",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid rgba(16, 185, 129, 0.3)",
                        background: "rgba(16, 185, 129, 0.08)",
                        color: "#059669",
                        fontSize: "0.75rem",
                        fontWeight: "600",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.25rem",
                      }}
                    >
                      <CheckCircle2 size={12} />
                      Resolve
                    </button>
                    <button
                      onClick={() => handleStatusChange(inc._id, "FALSE_POSITIVE")}
                      disabled={actionLoading}
                      style={{
                        padding: "0.35rem 0.65rem",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--border-color)",
                        background: "var(--bg-primary)",
                        color: "var(--text-secondary)",
                        fontSize: "0.75rem",
                        fontWeight: "600",
                        cursor: "pointer",
                      }}
                    >
                      False Positive
                    </button>
                  </div>
                </div>

                {/* Signals & Device Row */}
                <div style={{ display: "flex", gap: "1.25rem", fontSize: "0.83rem", color: "var(--text-secondary)", flexWrap: "wrap", padding: "0.5rem 0", borderTop: "1px solid var(--border-color)" }}>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                    <Globe size={14} color="var(--primary-600)" />
                    <span>{locationStr}</span>
                  </div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                    <Laptop size={14} />
                    <span>{inc.browser} on {inc.operatingSystem} ({inc.device})</span>
                  </div>
                </div>

                {/* Risk Reasons */}
                {inc.riskReasons && inc.riskReasons.length > 0 && (
                  <div style={{ background: "var(--bg-primary)", padding: "0.6rem 0.85rem", borderRadius: "var(--radius-md)", fontSize: "0.8rem" }}>
                    <strong style={{ color: "var(--text-primary)" }}>Contributing Signals:</strong>
                    <ul style={{ margin: "0.3rem 0 0", paddingLeft: "1.2rem", color: "var(--text-secondary)" }}>
                      {inc.riskReasons.map((r, idx) => (
                        <li key={idx}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Investigation Notes */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", borderTop: "1px solid var(--border-color)", paddingTop: "0.5rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--text-secondary)", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                      <FileText size={13} /> Investigation Notes
                    </span>
                    {editingNotesId !== inc._id && (
                      <button
                        onClick={() => {
                          setEditingNotesId(inc._id);
                          setNoteText(inc.investigationNotes || "");
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--primary-600)",
                          fontSize: "0.75rem",
                          fontWeight: "600",
                          cursor: "pointer",
                        }}
                      >
                        {inc.investigationNotes ? "Edit Notes" : "+ Add Note"}
                      </button>
                    )}
                  </div>

                  {editingNotesId === inc._id ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      <textarea
                        rows={2}
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Enter investigation notes (do not include passwords or raw tokens)..."
                        style={{
                          width: "100%",
                          padding: "0.5rem",
                          borderRadius: "var(--radius-md)",
                          border: "1px solid var(--border-color)",
                          background: "var(--bg-primary)",
                          color: "var(--text-primary)",
                          fontSize: "0.82rem",
                        }}
                      />
                      <div style={{ display: "flex", gap: "0.4rem", justifyContent: "flex-end" }}>
                        <button
                          onClick={() => setEditingNotesId(null)}
                          style={{
                            padding: "0.3rem 0.65rem",
                            borderRadius: "var(--radius-sm)",
                            border: "1px solid var(--border-color)",
                            background: "var(--bg-primary)",
                            fontSize: "0.75rem",
                            cursor: "pointer",
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveNotes(inc._id)}
                          style={{
                            padding: "0.3rem 0.65rem",
                            borderRadius: "var(--radius-sm)",
                            border: "none",
                            background: "var(--primary-600)",
                            color: "#ffffff",
                            fontSize: "0.75rem",
                            fontWeight: "600",
                            cursor: "pointer",
                          }}
                        >
                          Save Notes
                        </button>
                      </div>
                    </div>
                  ) : inc.investigationNotes ? (
                    <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-primary)", fontStyle: "italic", background: "var(--bg-primary)", padding: "0.4rem 0.75rem", borderRadius: "var(--radius-sm)" }}>
                      "{inc.investigationNotes}"
                    </p>
                  ) : (
                    <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                      No investigation notes recorded.
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SuspiciousLoginIncidents;
