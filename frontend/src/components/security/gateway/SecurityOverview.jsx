import {
  Activity,
  ShieldCheck,
  ShieldAlert,
  Users,
  AlertTriangle,
  Lock,
  Radio,
  Zap,
  UserX,
  KeyRound,
  CheckCircle2,
} from "lucide-react";

const SecurityOverview = ({ stats }) => {
  if (!stats) return null;

  const metricCards = [
    {
      label: "Total Requests",
      value: stats.totalRequests?.toLocaleString() || "0",
      icon: <Activity size={22} />,
      colorClass: "soc-icon-blue",
    },
    {
      label: "Requests / Min",
      value: stats.requestsPerMinute?.toLocaleString() || "0",
      icon: <Radio size={22} />,
      colorClass: "soc-icon-cyan",
    },
    {
      label: "Allowed Requests",
      value: stats.allowedRequests?.toLocaleString() || "0",
      icon: <CheckCircle2 size={22} />,
      colorClass: "soc-icon-green",
    },
    {
      label: "Suspicious Traffic",
      value: stats.suspiciousRequests?.toLocaleString() || "0",
      icon: <AlertTriangle size={22} />,
      colorClass: "soc-icon-amber",
    },
    {
      label: "Blocked Requests",
      value: stats.blockedRequests?.toLocaleString() || "0",
      icon: <ShieldAlert size={22} />,
      colorClass: "soc-icon-red",
    },
    {
      label: "Critical Events",
      value: stats.criticalEvents?.toLocaleString() || "0",
      icon: <Zap size={22} />,
      colorClass: "soc-icon-purple",
    },
    {
      label: "Unique Clients",
      value: stats.uniqueClients?.toLocaleString() || "0",
      icon: <Users size={22} />,
      colorClass: "soc-icon-blue",
    },
    {
      label: "Blocked Clients",
      value: stats.activeBlockedClients?.toLocaleString() || "0",
      icon: <UserX size={22} />,
      colorClass: "soc-icon-red",
    },
    {
      label: "Failed Logins",
      value: stats.failedLoginAttempts?.toLocaleString() || "0",
      icon: <Lock size={22} />,
      colorClass: "soc-icon-amber",
    },
    {
      label: "Failed OTPs",
      value: stats.failedOTPAttempts?.toLocaleString() || "0",
      icon: <KeyRound size={22} />,
      colorClass: "soc-icon-purple",
    },
    {
      label: "Active Sessions",
      value: stats.activeSessions?.toLocaleString() || "0",
      icon: <ShieldCheck size={22} />,
      colorClass: "soc-icon-green",
    },
  ];

  return (
    <div className="soc-metrics-grid">
      {metricCards.map((card, idx) => (
        <div key={idx} className="soc-metric-card">
          <div className={`soc-metric-icon ${card.colorClass}`}>
            {card.icon}
          </div>
          <div className="soc-metric-info">
            <span className="soc-metric-label">{card.label}</span>
            <h3 className="soc-metric-value">{card.value}</h3>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SecurityOverview;
