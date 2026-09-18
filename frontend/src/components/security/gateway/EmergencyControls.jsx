import { useState, useEffect, useCallback } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  Power,
  RefreshCw,
  AlertTriangle,
  Lock,
  Unlock,
} from "lucide-react";
import {
  fetchWebsiteLockdownStatus,
  enableWebsiteLockdown,
  restoreWebsite,
} from "../../../services/securityGatewayService";
import { toast } from "react-toastify";

const EmergencyControls = () => {
  const [status, setStatus] = useState({
    enabled: false,
    mode: "ONLINE",
    reason: "",
    changedByEmail: "",
    changedAt: null,
  });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmType, setConfirmType] = useState("LOCKDOWN"); // "LOCKDOWN" or "RESTORE"
  const [lockdownReason, setLockdownReason] = useState("");
  const [confirmText, setConfirmText] = useState("");

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetchWebsiteLockdownStatus();
      if (res.status) {
        setStatus(res.status);
      }
    } catch (err) {
      console.error("Failed to load lockdown status:", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 10000);
    return () => clearInterval(interval);
  }, [loadStatus]);

  const handleOpenLockdownModal = () => {
    setConfirmType("LOCKDOWN");
    setLockdownReason("Emergency security maintenance");
    setConfirmText("");
    setShowConfirmModal(true);
  };

  const handleOpenRestoreModal = () => {
    setConfirmType("RESTORE");
    setConfirmText("");
    setShowConfirmModal(true);
  };

  const handleConfirmAction = async () => {
    setActionLoading(true);
    try {
      if (confirmType === "LOCKDOWN") {
        const res = await enableWebsiteLockdown({
          reason: lockdownReason.trim() || "Emergency security maintenance",
        });
        setStatus(res.status);
        toast.error("🚨 Global Website Lockdown ACTIVATED. New user logins are paused.");
      } else {
        const res = await restoreWebsite();
        setStatus(res.status);
        toast.success("✅ Website restored to ONLINE mode. Normal user access resumed.");
      }
      setShowConfirmModal(false);
    } catch (err) {
      toast.error(err.response?.data?.message || "Operation failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const isLockdown = status.mode === "LOCKDOWN" || status.enabled;

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-slate-400 flex items-center gap-3">
        <RefreshCw className="w-5 h-5 animate-spin text-cyan-400" />
        <span>Checking emergency website status...</span>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl p-6 mb-6 border transition-all duration-300 shadow-xl ${
        isLockdown
          ? "bg-gradient-to-r from-red-950/70 via-slate-900 to-red-950/50 border-red-600/80 shadow-red-900/30"
          : "bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/40 border-slate-800 shadow-emerald-950/20"
      }`}
    >
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        {/* Left: Status and Information */}
        <div className="flex items-start gap-4">
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-center ${
              isLockdown
                ? "bg-red-500/20 border-red-500/50 text-red-400 animate-pulse"
                : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
            }`}
          >
            {isLockdown ? (
              <ShieldAlert className="w-8 h-8" />
            ) : (
              <ShieldCheck className="w-8 h-8" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Super Admin Emergency Control
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  isLockdown
                    ? "bg-red-500/20 text-red-300 border border-red-500/40"
                    : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isLockdown ? "bg-red-400 animate-ping" : "bg-emerald-400"
                  }`}
                />
                {isLockdown ? "🔴 LOCKDOWN" : "🟢 ONLINE"}
              </span>
            </div>

            <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              Website Access Status:{" "}
              <span className={isLockdown ? "text-red-400" : "text-emerald-400"}>
                {isLockdown ? "Global Lockdown Active" : "Normal Operation"}
              </span>
            </h3>

            {isLockdown ? (
              <div className="mt-2 text-sm text-red-200/90 space-y-0.5">
                <p>
                  <strong className="text-white">Reason:</strong>{" "}
                  {status.reason || "Emergency security maintenance"}
                </p>
                <p className="text-xs text-slate-300">
                  Started by: <span className="font-mono text-cyan-300">{status.changedByEmail || "Super Admin"}</span> •{" "}
                  {status.changedAt ? new Date(status.changedAt).toLocaleTimeString() : "Just now"}
                </p>
                <p className="text-xs text-amber-300/90 mt-1">
                  🔒 New user registrations and standard user logins are paused. Super Admin retains emergency access.
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-400 mt-1">
                All normal user logins, signups, and API services are operating normally without restrictions.
              </p>
            )}
          </div>
        </div>

        {/* Right: Emergency Action Button */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          {isLockdown ? (
            <button
              onClick={handleOpenRestoreModal}
              disabled={actionLoading}
              className="px-5 py-3 rounded-lg font-bold text-sm bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/40 hover:shadow-emerald-900/60 transition-all flex items-center justify-center gap-2 border border-emerald-400/30 disabled:opacity-50 cursor-pointer"
            >
              <Unlock className="w-4 h-4" />
              RESTORE WEBSITE
            </button>
          ) : (
            <button
              onClick={handleOpenLockdownModal}
              disabled={actionLoading}
              className="px-5 py-3 rounded-lg font-bold text-sm bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/50 hover:shadow-red-900/70 transition-all flex items-center justify-center gap-2 border border-red-400/40 disabled:opacity-50 cursor-pointer"
            >
              <Power className="w-4 h-4" />
              STOP WEBSITE
            </button>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-amber-400 mb-4">
              <AlertTriangle className="w-7 h-7 flex-shrink-0" />
              <h4 className="text-lg font-bold text-white">
                {confirmType === "LOCKDOWN"
                  ? "Confirm Emergency Website Lockdown"
                  : "Confirm Website Restoration"}
              </h4>
            </div>

            {confirmType === "LOCKDOWN" ? (
              <div className="space-y-4 text-sm text-slate-300">
                <p className="bg-red-950/50 border border-red-800/60 rounded-lg p-3 text-red-200 text-xs leading-relaxed">
                  ⚠️ <strong>Warning:</strong> Activating website lockdown will immediately disable new logins and signups for all normal users with a safe 503 Maintenance notification. Existing authorized Super Admins will retain emergency controls.
                </p>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Lockdown Reason (Publicly Safe Notice)
                  </label>
                  <input
                    type="text"
                    value={lockdownReason}
                    onChange={(e) => setLockdownReason(e.target.value)}
                    placeholder="e.g. Emergency security investigation"
                    className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-red-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Type <span className="text-red-400 font-mono font-bold">STOP WEBSITE</span> to confirm:
                  </label>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="STOP WEBSITE"
                    className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-red-500 text-sm font-mono"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-sm text-slate-300">
                <p className="bg-emerald-950/40 border border-emerald-800/50 rounded-lg p-3 text-emerald-200 text-xs leading-relaxed">
                  ✅ Restoring the website will immediately re-enable new user logins, registrations, password resets, and all standard operations.
                </p>
                <p>Are you sure you want to restore normal website operations?</p>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={actionLoading}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmAction}
                disabled={
                  actionLoading ||
                  (confirmType === "LOCKDOWN" && confirmText.trim() !== "STOP WEBSITE")
                }
                className={`px-5 py-2 rounded-lg text-sm font-bold text-white transition flex items-center gap-2 ${
                  confirmType === "LOCKDOWN"
                    ? "bg-red-600 hover:bg-red-500 disabled:opacity-40"
                    : "bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40"
                }`}
              >
                {actionLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                {confirmType === "LOCKDOWN" ? (
                  <>
                    <Lock className="w-4 h-4" /> Stop Website Now
                  </>
                ) : (
                  <>
                    <Unlock className="w-4 h-4" /> Restore Website
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmergencyControls;
