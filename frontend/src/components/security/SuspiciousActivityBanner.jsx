import { useState, useEffect } from "react";
import { AlertTriangle, ShieldAlert, CheckCircle, ArrowRight } from "lucide-react";
import { getLoginHistory, secureAccount } from "../../services/authService";

const SuspiciousActivityBanner = ({ onReviewClick, onSecured }) => {
  const [suspiciousEvent, setSuspiciousEvent] = useState(null);
  const [securing, setSecuring] = useState(false);
  const [securedMessage, setSecuredMessage] = useState(null);

  useEffect(() => {
    const checkSuspiciousEvents = async () => {
      try {
        const data = await getLoginHistory({ limit: 5 });
        if (data?.success && Array.isArray(data.events)) {
          const urgentEvent = data.events.find(
            (ev) =>
              (ev.riskLevel === "CRITICAL" || ev.riskLevel === "HIGH") &&
              ev.userReviewStatus === "PENDING"
          );
          setSuspiciousEvent(urgentEvent || null);
        }
      } catch (_e) {}
    };

    checkSuspiciousEvents();
  }, []);

  const handleSecureAccount = async () => {
    if (!window.confirm("This will immediately terminate all active sessions across all other devices. Do you want to proceed?")) {
      return;
    }

    setSecuring(true);
    try {
      const res = await secureAccount();
      if (res?.success) {
        setSecuredMessage("Account secured: Other active sessions have been terminated.");
        setSuspiciousEvent(null);
        if (onSecured) onSecured();
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to secure account.");
    } finally {
      setSecuring(false);
    }
  };

  if (securedMessage) {
    return (
      <div
        style={{
          background: "rgba(16, 185, 129, 0.12)",
          border: "1px solid rgba(16, 185, 129, 0.3)",
          borderRadius: "var(--radius-lg)",
          padding: "1rem 1.25rem",
          marginBottom: "1.75rem",
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          color: "#065f46",
          fontSize: "0.9rem",
          fontWeight: "600",
        }}
      >
        <CheckCircle size={20} color="#059669" />
        <span>{securedMessage}</span>
      </div>
    );
  }

  if (!suspiciousEvent) return null;

  const isCritical = suspiciousEvent.riskLevel === "CRITICAL";

  return (
    <div
      style={{
        background: isCritical ? "#fef2f2" : "#fffbeb",
        border: `1px solid ${isCritical ? "#fecaca" : "#fde68a"}`,
        borderRadius: "var(--radius-lg)",
        padding: "1.25rem 1.5rem",
        marginBottom: "1.75rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "1rem",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", maxWidth: "650px" }}>
        <div
          style={{
            width: "42px",
            height: "42px",
            borderRadius: "var(--radius-md)",
            background: isCritical ? "#fee2e2" : "#fef3c7",
            color: isCritical ? "#b91c1c" : "#b45309",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {isCritical ? <ShieldAlert size={24} /> : <AlertTriangle size={24} />}
        </div>

        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span
              style={{
                fontSize: "0.72rem",
                fontWeight: "800",
                textTransform: "uppercase",
                padding: "0.15rem 0.5rem",
                borderRadius: "var(--radius-full)",
                background: isCritical ? "#ef4444" : "#f59e0b",
                color: "#ffffff",
              }}
            >
              {suspiciousEvent.riskLevel} Alert
            </span>
            <strong style={{ fontSize: "0.95rem", color: isCritical ? "#7f1d1d" : "#78350f" }}>
              Unusual sign-in activity detected on your account
            </strong>
          </div>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.83rem", color: isCritical ? "#991b1b" : "#92400e" }}>
            {suspiciousEvent.riskReasons?.[0] || "A sign-in with elevated risk was detected."} Location:{" "}
            <strong>
              {suspiciousEvent.location?.city ? `${suspiciousEvent.location.city}, ` : ""}
              {suspiciousEvent.location?.country || "Local Network"}
            </strong>{" "}
            on {new Date(suspiciousEvent.timestamp).toLocaleDateString()}.
          </p>
        </div>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <button
          onClick={onReviewClick}
          style={{
            padding: "0.5rem 0.9rem",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-color)",
            background: "var(--bg-card)",
            color: "var(--text-primary)",
            fontSize: "0.82rem",
            fontWeight: "700",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.3rem",
          }}
        >
          <span>Review</span>
          <ArrowRight size={13} />
        </button>

        <button
          onClick={handleSecureAccount}
          disabled={securing}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: "var(--radius-md)",
            border: "none",
            background: isCritical ? "#dc2626" : "#d97706",
            color: "#ffffff",
            fontSize: "0.82rem",
            fontWeight: "700",
            cursor: "pointer",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          {securing ? "Securing..." : "Secure My Account"}
        </button>
      </div>
    </div>
  );
};

export default SuspiciousActivityBanner;
