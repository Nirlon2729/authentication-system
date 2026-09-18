import { useState, useEffect } from "react";
import { ShieldAlert, Clock, AlertCircle, CheckCircle2 } from "lucide-react";

const AccountRestrictedModal = ({
  isOpen,
  onClose,
  blockedUntil,
  remainingSeconds = 900,
  reason = "Suspicious automated activity detected.",
}) => {
  const [timeLeft, setTimeLeft] = useState(remainingSeconds);

  useEffect(() => {
    setTimeLeft(remainingSeconds);
  }, [remainingSeconds]);

  useEffect(() => {
    if (!isOpen || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen, timeLeft]);

  if (!isOpen) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedRemaining = `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;

  const formattedBlockedUntil = blockedUntil
    ? new Date(blockedUntil).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "--:--";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-red-700/60 rounded-2xl max-w-md w-full p-6 shadow-2xl shadow-red-950/40 text-center relative overflow-hidden">
        {/* Top decorative hazard accent */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-600 via-amber-500 to-red-600" />

        {/* Icon & Title */}
        <div className="mx-auto w-14 h-14 rounded-2xl bg-red-500/15 border border-red-500/40 flex items-center justify-center text-red-400 mb-4 animate-pulse">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-300 border border-red-500/30 mb-2">
          <AlertCircle className="w-3.5 h-3.5" />
          SECURITY STATUS: TEMPORARY RESTRICTION
        </div>

        <h3 className="text-xl font-bold text-white tracking-tight mb-2">
          Account Temporarily Restricted
        </h3>

        <p className="text-sm text-slate-300 mb-6 leading-relaxed">
          {reason}
        </p>

        {/* Countdown & Timing Info Card */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 mb-6 grid grid-cols-2 gap-4">
          <div className="text-center border-r border-slate-800/80 pr-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Blocked Until
            </span>
            <span className="text-base font-bold text-slate-200 font-mono">
              {formattedBlockedUntil}
            </span>
          </div>

          <div className="text-center pl-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Time Remaining
            </span>
            <div className="flex items-center justify-center gap-1.5 text-amber-400 font-mono text-base font-bold">
              <Clock className="w-4 h-4" />
              <span>{formattedRemaining}</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/40 rounded-lg p-3 text-xs text-slate-400 text-left mb-6 border border-slate-800 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
          <span>
            This restriction protects your account from unauthorized brute-force attempts. Once the countdown expires, access is automatically restored.
          </span>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 px-4 rounded-xl text-sm font-bold text-white bg-slate-800 hover:bg-slate-700 transition border border-slate-700 cursor-pointer"
        >
          Acknowledge & Close
        </button>
      </div>
    </div>
  );
};

export default AccountRestrictedModal;
