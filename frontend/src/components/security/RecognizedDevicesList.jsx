import { useState, useEffect } from "react";
import {
  Laptop,
  Smartphone,
  Globe,
  Trash2,
  CheckCircle,
  RefreshCw,
  Clock,
  Shield,
} from "lucide-react";
import { getRecognizedDevices, revokeRecognizedDevice } from "../../services/authService";

const RecognizedDevicesList = () => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const data = await getRecognizedDevices();
      if (data?.success) {
        setDevices(data.devices || []);
      }
    } catch (err) {
      console.error("Failed to fetch recognized devices:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const handleRevoke = async (deviceId) => {
    if (!window.confirm("Are you sure you want to revoke recognition for this device? Any active login sessions on this device will be terminated immediately.")) {
      return;
    }

    setActionLoading(deviceId);
    try {
      const res = await revokeRecognizedDevice(deviceId);
      if (res?.success) {
        setFeedback({
          type: "success",
          message: `Device recognition revoked. ${res.terminatedSessionsCount || 0} associated session(s) terminated.`,
        });
        fetchDevices();
      }
    } catch (err) {
      setFeedback({
        type: "error",
        message: err.response?.data?.message || "Failed to revoke device.",
      });
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: "700", color: "var(--text-primary)" }}>
            Recognized Devices & Browsers
          </h3>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            Devices you have previously signed in from. Revoking a device terminates its active sessions.
          </p>
        </div>

        <button
          onClick={fetchDevices}
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

      {loading && devices.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
          <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 0.75rem", display: "block" }} />
          Loading recognized devices...
        </div>
      ) : devices.length === 0 ? (
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
          No recognized devices registered yet. Devices are registered upon successful authentication.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          {devices.map((dev) => {
            const isMobile = dev.device?.toLowerCase() === "mobile";
            const locationStr = dev.lastLocation?.city && dev.lastLocation?.country
              ? `${dev.lastLocation.city}, ${dev.lastLocation.country}`
              : (dev.lastLocation?.country || "Local Network");

            return (
              <div
                key={dev._id || dev.deviceId}
                style={{
                  background: "var(--bg-primary)",
                  border: `1px solid ${dev.isCurrent ? "var(--primary-600)" : "var(--border-color)"}`,
                  borderRadius: "var(--radius-md)",
                  padding: "1.1rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "1rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "var(--radius-md)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: dev.isCurrent ? "rgba(37, 99, 235, 0.12)" : "rgba(100, 116, 139, 0.12)",
                      color: dev.isCurrent ? "var(--primary-600)" : "#64748b",
                    }}
                  >
                    {isMobile ? <Smartphone size={22} /> : <Laptop size={22} />}
                  </div>

                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontSize: "0.95rem", fontWeight: "700", color: "var(--text-primary)" }}>
                        {dev.browser} on {dev.operatingSystem}
                      </span>
                      {dev.isCurrent && (
                        <span
                          style={{
                            fontSize: "0.72rem",
                            padding: "0.15rem 0.55rem",
                            borderRadius: "var(--radius-full)",
                            fontWeight: "700",
                            background: "#ecfdf5",
                            color: "#065f46",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.25rem",
                          }}
                        >
                          <CheckCircle size={10} /> Current Device
                        </span>
                      )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "0.25rem", flexWrap: "wrap" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                        <Globe size={13} color="var(--primary-600)" />
                        {locationStr}
                      </span>
                      <span>•</span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                        <Clock size={13} />
                        Last active: {new Date(dev.lastSeenAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  {!dev.isCurrent && (
                    <button
                      onClick={() => handleRevoke(dev.deviceId)}
                      disabled={actionLoading === dev.deviceId}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.35rem",
                        padding: "0.45rem 0.8rem",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                        background: "rgba(239, 68, 68, 0.06)",
                        color: "#dc2626",
                        fontSize: "0.8rem",
                        fontWeight: "600",
                        cursor: "pointer",
                      }}
                    >
                      <Trash2 size={13} />
                      <span>{actionLoading === dev.deviceId ? "Revoking..." : "Revoke Device"}</span>
                    </button>
                  )}
                  {dev.isCurrent && (
                    <span style={{ fontSize: "0.8rem", color: "#059669", fontWeight: "600", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                      <Shield size={14} /> Active Protection
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

export default RecognizedDevicesList;
