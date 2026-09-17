import { useEffect, useState } from "react";
import { Laptop, Smartphone, Monitor, LogOut, ShieldCheck, Clock, Globe } from "lucide-react";
import { getUserSessions, logoutSession } from "../../services/sessionService";
import { toast } from "react-toastify";

const formatLastActive = (date) => {
  const now = new Date();
  const last = new Date(date);
  const seconds = Math.floor((now - last) / 1000);

  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
};

const getDeviceIcon = (deviceStr = "") => {
  const lower = deviceStr.toLowerCase();
  if (lower.includes("mobile") || lower.includes("phone")) {
    return <Smartphone size={22} />;
  }
  if (lower.includes("desktop") || lower.includes("mac") || lower.includes("windows")) {
    return <Monitor size={22} />;
  }
  return <Laptop size={22} />;
};

const ActiveSessions = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [terminatingId, setTerminatingId] = useState(null);

  const handleLogoutSession = async (sessionId) => {
    try {
      setTerminatingId(sessionId);
      await logoutSession(sessionId);
      setSessions((prev) => prev.filter((session) => session._id !== sessionId));
      toast.success("Remote session terminated successfully.");
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || "Failed to terminate session.");
    } finally {
      setTerminatingId(null);
    }
  };

  useEffect(() => {
    const loadSessions = async () => {
      try {
        setLoading(true);
        const response = await getUserSessions();
        setSessions(response.sessions || []);
      } catch (error) {
        console.error(error);
        toast.error("Failed to load active sessions.");
      } finally {
        setLoading(false);
      }
    };

    loadSessions();
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <h2
          style={{
            fontSize: "1.35rem",
            fontWeight: "800",
            color: "var(--text-primary)",
            margin: "0 0 0.35rem 0",
          }}
        >
          Active Device Sessions
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem", margin: 0 }}>
          These devices are currently authenticated to your account. You can revoke access from any session you don't recognize.
        </p>
      </div>

      {loading ? (
        <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
          Loading active device sessions...
        </div>
      ) : sessions.length === 0 ? (
        <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
          No active sessions found.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {sessions.map((session) => (
            <div
              key={session._id}
              style={{
                padding: "1.35rem 1.5rem",
                borderRadius: "var(--radius-lg)",
                border: session.isCurrent
                  ? "1px solid rgba(16, 185, 129, 0.4)"
                  : "1px solid var(--border-color)",
                background: session.isCurrent
                  ? "rgba(16, 185, 129, 0.04)"
                  : "var(--bg-card)",
                boxShadow: "var(--shadow-sm)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "1rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "1.1rem" }}>
                <div
                  style={{
                    width: "46px",
                    height: "46px",
                    borderRadius: "12px",
                    background: session.isCurrent ? "rgba(16, 185, 129, 0.12)" : "var(--bg-hover)",
                    color: session.isCurrent ? "#10b981" : "var(--primary-600)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    border: "1px solid var(--border-color)",
                  }}
                >
                  {getDeviceIcon(session.device || session.operatingSystem)}
                </div>

                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                    <h4
                      style={{
                        margin: 0,
                        fontSize: "0.98rem",
                        fontWeight: "700",
                        color: "var(--text-primary)",
                      }}
                    >
                      {session.browser || "Web Browser"} on {session.operatingSystem || "Device"}
                    </h4>

                    {session.isCurrent && (
                      <span
                        style={{
                          background: "rgba(16, 185, 129, 0.12)",
                          color: "#10b981",
                          padding: "0.2rem 0.6rem",
                          borderRadius: "var(--radius-full)",
                          fontSize: "0.72rem",
                          fontWeight: "700",
                          border: "1px solid rgba(16, 185, 129, 0.25)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.3rem",
                        }}
                      >
                        <ShieldCheck size={12} />
                        <span>Current Device</span>
                      </span>
                    )}

                    {session.rememberMe && (
                      <span
                        style={{
                          background: "rgba(14, 165, 233, 0.12)",
                          color: "#0ea5e9",
                          padding: "0.2rem 0.6rem",
                          borderRadius: "var(--radius-full)",
                          fontSize: "0.72rem",
                          fontWeight: "700",
                          border: "1px solid rgba(14, 165, 233, 0.25)",
                        }}
                      >
                        Remembered
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "1.2rem",
                      marginTop: "0.35rem",
                      fontSize: "0.8rem",
                      color: "var(--text-muted)",
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                      <Globe size={13} />
                      <span>{session.ipAddress || "Localhost IP"}</span>
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                      <Clock size={13} />
                      <span>Active {formatLastActive(session.lastActive)}</span>
                    </span>
                  </div>
                </div>
              </div>

              {!session.isCurrent && (
                <button
                  onClick={() => handleLogoutSession(session._id)}
                  disabled={terminatingId === session._id}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.45rem",
                    padding: "0.55rem 1rem",
                    border: "1px solid var(--danger-border)",
                    borderRadius: "var(--radius-md)",
                    background: "var(--danger-light)",
                    color: "var(--danger)",
                    cursor: "pointer",
                    fontWeight: "700",
                    fontSize: "0.82rem",
                    transition: "var(--transition-fast)",
                  }}
                >
                  <LogOut size={14} />
                  <span>{terminatingId === session._id ? "Terminating..." : "Revoke"}</span>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ActiveSessions;