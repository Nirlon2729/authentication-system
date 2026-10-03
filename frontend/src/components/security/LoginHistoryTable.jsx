import { useState, useEffect } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  Globe,
  Laptop,
  Smartphone,
  Clock,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { getLoginHistory, reviewLoginEvent } from "../../services/authService";

const getRiskBadge = (level) => {
  switch (level) {
    case "CRITICAL":
      return { bg: "#fef2f2", text: "#991b1b", border: "#fecaca", label: "Critical Risk" };
    case "HIGH":
      return { bg: "#fff1f2", text: "#be123c", border: "#fecdd3", label: "High Risk" };
    case "MEDIUM":
      return { bg: "#fffbeb", text: "#b45309", border: "#fde68a", label: "Medium Risk" };
    default:
      return { bg: "#f0fdf4", text: "#166534", border: "#bbf7d0", label: "Low Risk" };
  }
};

const LoginHistoryTable = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState("ALL");
  const [feedback, setFeedback] = useState(null);

  const fetchHistory = async (pageNum = 1) => {
    setLoading(true);
    try {
      const data = await getLoginHistory({ page: pageNum, limit: 10 });
      if (data?.success) {
        setEvents(data.events || []);
        setTotalPages(data.pages || 1);
        setPage(data.currentPage || 1);
      }
    } catch (err) {
      console.error("Failed to load login history:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory(page);
  }, [page]);

  const handleReview = async (eventId, status) => {
    try {
      const res = await reviewLoginEvent(eventId, status);
      if (res?.success) {
        setFeedback({
          type: "success",
          message: status === "RECOGNIZED" ? "Activity confirmed as recognized." : "Activity flagged as suspicious.",
        });
        fetchHistory(page);
      }
    } catch (err) {
      setFeedback({ type: "error", message: err.response?.data?.message || "Failed to update review status." });
    }
  };

  const filteredEvents = events.filter((ev) => {
    if (filter === "SUCCESS") return ev.status === "SUCCESS";
    if (filter === "FAILED") return ev.status === "FAILED";
    if (filter === "SUSPICIOUS") return ev.riskLevel === "HIGH" || ev.riskLevel === "CRITICAL" || ev.riskLevel === "MEDIUM";
    return true;
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: "700", color: "var(--text-primary)" }}>
            Login Activity & History
          </h3>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            Monitor real-time authentication events, device changes, and risk assessments.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              padding: "0.45rem 0.8rem",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-color)",
              background: "var(--bg-primary)",
              color: "var(--text-primary)",
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            <option value="ALL">All Events</option>
            <option value="SUCCESS">Successful Logins</option>
            <option value="FAILED">Failed Attempts</option>
            <option value="SUSPICIOUS">Suspicious & Alerts</option>
          </select>

          <button
            onClick={() => fetchHistory(page)}
            disabled={loading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              padding: "0.45rem 0.85rem",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-color)",
              background: "var(--bg-card)",
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

      {feedback && (
        <div
          style={{
            padding: "0.75rem 1rem",
            marginBottom: "1rem",
            borderRadius: "var(--radius-md)",
            fontSize: "0.85rem",
            background: feedback.type === "success" ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
            color: feedback.type === "success" ? "#059669" : "#dc2626",
            border: `1px solid ${feedback.type === "success" ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)"}`,
          }}
        >
          {feedback.message}
        </div>
      )}

      {loading && events.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
          <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 0.75rem", display: "block" }} />
          Loading security activity logs...
        </div>
      ) : filteredEvents.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "2.5rem 1rem",
            border: "1px dashed var(--border-color)",
            borderRadius: "var(--radius-md)",
            color: "var(--text-secondary)",
            fontSize: "0.9rem",
          }}
        >
          No login activity records match the selected filter.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          {filteredEvents.map((ev) => {
            const badge = getRiskBadge(ev.riskLevel);
            const isSuccess = ev.status === "SUCCESS";
            const locationStr = ev.location?.city && ev.location?.country
              ? `${ev.location.city}, ${ev.location.country}`
              : (ev.location?.country || "Local Network");

            return (
              <div
                key={ev._id}
                style={{
                  background: "var(--bg-primary)",
                  border: `1px solid ${ev.riskLevel === "CRITICAL" || ev.riskLevel === "HIGH" ? badge.border : "var(--border-color)"}`,
                  borderRadius: "var(--radius-md)",
                  padding: "1.1rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.6rem",
                  transition: "var(--transition-fast)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "var(--radius-md)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: isSuccess ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
                        color: isSuccess ? "#059669" : "#dc2626",
                      }}
                    >
                      {isSuccess ? <ShieldCheck size={20} /> : <ShieldAlert size={20} />}
                    </div>

                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span style={{ fontSize: "0.95rem", fontWeight: "700", color: "var(--text-primary)" }}>
                          {ev.provider === "google" ? "Google OAuth Sign-In" : "Email & Password Sign-In"}
                        </span>
                        <span
                          style={{
                            fontSize: "0.72rem",
                            padding: "0.15rem 0.5rem",
                            borderRadius: "var(--radius-full)",
                            fontWeight: "700",
                            background: isSuccess ? "#ecfdf5" : "#fef2f2",
                            color: isSuccess ? "#065f46" : "#991b1b",
                          }}
                        >
                          {isSuccess ? "Authenticated" : "Failed Attempt"}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: "0.15rem" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                          <Clock size={12} />
                          {new Date(ev.timestamp).toLocaleString()}
                        </span>
                        <span>•</span>
                        <span>IP: <code>{ev.ipAddress}</code></span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span
                      style={{
                        padding: "0.25rem 0.65rem",
                        borderRadius: "var(--radius-full)",
                        fontSize: "0.75rem",
                        fontWeight: "700",
                        background: badge.bg,
                        color: badge.text,
                        border: `1px solid ${badge.border}`,
                      }}
                    >
                      {badge.label} ({ev.riskScore}/100)
                    </span>
                  </div>
                </div>

                {/* Device & Location Row */}
                <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", fontSize: "0.82rem", color: "var(--text-secondary)", flexWrap: "wrap", padding: "0.4rem 0", borderTop: "1px solid var(--border-color)" }}>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
                    <Globe size={14} color="var(--primary-600)" />
                    <span>{locationStr}</span>
                  </div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
                    {ev.device === "Mobile" ? <Smartphone size={14} /> : <Laptop size={14} />}
                    <span>{ev.browser} on {ev.operatingSystem} ({ev.device})</span>
                  </div>
                </div>

                {/* Risk Reasons */}
                {ev.riskReasons && ev.riskReasons.length > 0 && (
                  <div style={{ background: "rgba(0,0,0,0.02)", padding: "0.5rem 0.75rem", borderRadius: "var(--radius-sm)", fontSize: "0.78rem" }}>
                    <strong style={{ color: "var(--text-primary)" }}>Detection signals: </strong>
                    <span style={{ color: "var(--text-secondary)" }}>{ev.riskReasons.join(" • ")}</span>
                  </div>
                )}

                {/* User Review Actions */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "0.4rem", borderTop: "1px solid var(--border-color)", fontSize: "0.8rem" }}>
                  <div>
                    {ev.userReviewStatus === "RECOGNIZED" && (
                      <span style={{ color: "#059669", fontWeight: "600", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                        <CheckCircle size={13} /> You confirmed this login
                      </span>
                    )}
                    {ev.userReviewStatus === "SUSPICIOUS" && (
                      <span style={{ color: "#dc2626", fontWeight: "600", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                        <AlertTriangle size={13} /> Reported as suspicious
                      </span>
                    )}
                    {ev.userReviewStatus === "PENDING" && (
                      <span style={{ color: "var(--text-secondary)" }}>Was this you?</span>
                    )}
                  </div>

                  {ev.userReviewStatus === "PENDING" && (
                    <div style={{ display: "flex", gap: "0.4rem" }}>
                      <button
                        onClick={() => handleReview(ev._id, "RECOGNIZED")}
                        style={{
                          padding: "0.25rem 0.6rem",
                          borderRadius: "var(--radius-sm)",
                          border: "1px solid var(--border-color)",
                          background: "var(--bg-card)",
                          fontSize: "0.75rem",
                          fontWeight: "600",
                          color: "#059669",
                          cursor: "pointer",
                        }}
                      >
                        Yes, it's me
                      </button>
                      <button
                        onClick={() => handleReview(ev._id, "SUSPICIOUS")}
                        style={{
                          padding: "0.25rem 0.6rem",
                          borderRadius: "var(--radius-sm)",
                          border: "1px solid rgba(239, 68, 68, 0.3)",
                          background: "rgba(239, 68, 68, 0.08)",
                          fontSize: "0.75rem",
                          fontWeight: "600",
                          color: "#dc2626",
                          cursor: "pointer",
                        }}
                      >
                        No, secure account
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "0.75rem", marginTop: "1rem" }}>
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={{
                  padding: "0.4rem 0.75rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-card)",
                  color: "var(--text-primary)",
                  cursor: page <= 1 ? "not-allowed" : "pointer",
                  opacity: page <= 1 ? 0.5 : 1,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.25rem",
                }}
              >
                <ChevronLeft size={14} /> Previous
              </button>
              <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                style={{
                  padding: "0.4rem 0.75rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-card)",
                  color: "var(--text-primary)",
                  cursor: page >= totalPages ? "not-allowed" : "pointer",
                  opacity: page >= totalPages ? 0.5 : 1,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.25rem",
                }}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LoginHistoryTable;
