import { useState, useEffect, useCallback } from "react";
import { UserX, Unlock, ShieldAlert, Clock, RefreshCw, CheckCircle2 } from "lucide-react";
import {
  fetchBlockedUsers,
  unblockUserAccount,
} from "../../../services/securityGatewayService";
import { toast } from "react-toastify";

const BlockedUsers = () => {
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});

  const loadBlockedUsers = useCallback(async () => {
    try {
      const res = await fetchBlockedUsers();
      setBlockedUsers(res.blockedUsers || []);
    } catch (err) {
      console.error("Failed to load blocked users:", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBlockedUsers();
    const interval = setInterval(loadBlockedUsers, 8000);
    return () => clearInterval(interval);
  }, [loadBlockedUsers]);

  const handleUnblock = async (userId, email) => {
    setActionLoading((prev) => ({ ...prev, [userId]: true }));
    try {
      await unblockUserAccount(userId);
      toast.success(`User ${email} has been successfully unblocked.`);
      setBlockedUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to unblock user.");
    } finally {
      setActionLoading((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const formatRemaining = (seconds) => {
    if (!seconds || seconds <= 0) return "Expiring soon";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs.toString().padStart(2, "0")}s`;
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
      {/* Table Header */}
      <div className="p-5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <UserX className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              Active User Account Restrictions
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {blockedUsers.length} Active
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Account-level temporary blocks (req.user._id). Innocents sharing IP/subnet remain unblocked.
            </p>
          </div>
        </div>

        <button
          onClick={loadBlockedUsers}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 transition flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
            Loading restricted user accounts...
          </div>
        ) : blockedUsers.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400/60" />
            <p className="text-slate-300 font-medium">No accounts are currently restricted.</p>
            <p className="text-xs text-slate-500">
              When authenticated users trigger high-risk security events, their account IDs appear here.
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">User Details</th>
                <th className="py-3 px-4">Reason & Trigger</th>
                <th className="py-3 px-4">Blocked At</th>
                <th className="py-3 px-4">Remaining Time</th>
                <th className="py-3 px-4">Block Source</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {blockedUsers.map((user) => (
                <tr key={user.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-white">{user.fullName || "User"}</div>
                    <div className="text-slate-400 font-mono text-[11px]">{user.email}</div>
                    <div className="text-[10px] text-slate-500 font-mono">ID: {user.id}</div>
                  </td>

                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5 text-red-300 font-medium">
                      <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0 text-red-400" />
                      {user.reason}
                    </div>
                  </td>

                  <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                    {user.blockedAt ? new Date(user.blockedAt).toLocaleTimeString() : "—"}
                  </td>

                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                      <Clock className="w-3 h-3 text-amber-400" />
                      {formatRemaining(user.remainingSeconds)}
                    </span>
                  </td>

                  <td className="py-3 px-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                        user.blockSource === "ADMIN_MANUAL"
                          ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                          : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                      }`}
                    >
                      {user.blockSource || "AI_SECURITY_GATEWAY"}
                    </span>
                  </td>

                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleUnblock(user.id, user.email)}
                      disabled={actionLoading[user.id]}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-600/50 hover:border-emerald-500 transition flex items-center gap-1.5 ml-auto disabled:opacity-50 cursor-pointer"
                    >
                      {actionLoading[user.id] ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <Unlock className="w-3 h-3" />
                      )}
                      UNBLOCK
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default BlockedUsers;
