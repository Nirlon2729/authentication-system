import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "../../layouts/DashboardLayout/DashboardLayout";
import {
  Activity,
  Layers,
  UserX,
  Cpu,
  Filter,
  Users,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import SecurityOverview from "../../components/security/gateway/SecurityOverview";
import LiveSecurityFeed from "../../components/security/gateway/LiveSecurityFeed";
import TrafficChart from "../../components/security/gateway/TrafficChart";
import ThreatAnalysis from "../../components/security/gateway/ThreatAnalysis";
import SecurityEventTable from "../../components/security/gateway/SecurityEventTable";
import BlockedClients from "../../components/security/gateway/BlockedClients";
import BlockedUsers from "../../components/security/gateway/BlockedUsers";
import EmergencyControls from "../../components/security/gateway/EmergencyControls";
import AttackSimulator from "../../components/security/gateway/AttackSimulator";
import {
  fetchSecurityStats,
  fetchSecurityEvents,
  fetchLiveSecurityFeed,
  fetchTrafficTimeline,
  fetchThreatAnalytics,
  fetchBlockedClients,
} from "../../services/securityGatewayService";
import "../../styles/pages/securityGateway.css";

const SecurityGateway = () => {
  const { isSuperAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  // Global Traffic Type Filter: "ALL" | "REAL" | "SIMULATION"
  const [trafficType, setTrafficType] = useState("ALL");

  // Telemetry State
  const [stats, setStats] = useState(null);
  const [liveEvents, setLiveEvents] = useState([]);
  const [timelineData, setTimelineData] = useState([]);
  const [currentRange, setCurrentRange] = useState("15m");
  const [threatAnalytics, setThreatAnalytics] = useState(null);
  const [blockedClients, setBlockedClients] = useState([]);

  // Event Table Query State
  const [eventData, setEventData] = useState({
    events: [],
    pagination: { total: 0, page: 1, limit: 25, totalPages: 1 },
  });
  const [filters, setFilters] = useState({
    page: 1,
    limit: 25,
    search: "",
    severity: "ALL",
    decision: "ALL",
    action: "ALL",
    eventType: "ALL",
  });

  // Load complete SOC data with trafficType filter
  const loadDashboardData = useCallback(async () => {
    try {
      const [statsRes, timelineRes, threatsRes, blockedRes, feedRes] = await Promise.all([
        fetchSecurityStats(trafficType),
        fetchTrafficTimeline(currentRange, trafficType),
        fetchThreatAnalytics(trafficType),
        fetchBlockedClients(trafficType),
        fetchLiveSecurityFeed(trafficType),
      ]);

      setStats(statsRes.stats || null);
      setTimelineData(timelineRes.timeline || []);
      setThreatAnalytics(threatsRes.analytics || null);
      setBlockedClients(blockedRes.blockedClients || []);
      if (!isPaused && feedRes.liveEvents) {
        setLiveEvents(feedRes.liveEvents);
      }
    } catch (err) {
      console.error("[SOC Dashboard] Data fetch error:", err.message);
    } finally {
      setLoading(false);
    }
  }, [currentRange, isPaused, trafficType]);

  // Load paginated events
  const loadEvents = useCallback(async () => {
    try {
      const res = await fetchSecurityEvents({ ...filters, trafficType });
      setEventData({
        events: res.events || [],
        pagination: res.pagination || { total: 0, page: 1, limit: 25, totalPages: 1 },
      });
    } catch (err) {
      console.error("[SOC Dashboard] Events fetch error:", err.message);
    }
  }, [filters, trafficType]);

  useEffect(() => {
    loadDashboardData();
    loadEvents();
  }, [loadDashboardData, loadEvents]);

  // Real-time polling fallback loop (every 3.5 seconds)
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(async () => {
      try {
        const feedRes = await fetchLiveSecurityFeed(trafficType);
        if (feedRes.liveEvents) {
          setLiveEvents(feedRes.liveEvents);
        }
        const statsRes = await fetchSecurityStats(trafficType);
        if (statsRes.stats) {
          setStats(statsRes.stats);
        }
      } catch {
        // silent safe fallback
      }
    }, 3500);

    return () => clearInterval(interval);
  }, [isPaused, trafficType]);

  const systemStatus = stats?.systemStatus || {
    status: "ONLINE",
    aiEngine: "READY (In-Process ML Fallback)",
    redis: "FALLBACK_MODE",
    backend: "ONLINE",
    protection: "ACTIVE",
    lastEvent: new Date(),
  };

  return (
    <DashboardLayout>
      <div className="soc-portal-page">
        {/* SOC Center Header & Live Status Bar */}
        <section className="soc-header-banner">
          <div className="soc-banner-left">
            <div className="soc-live-badge-row">
              <span className="soc-pulse-tag online">
                <span className="soc-pulse-dot"></span>
                AI SECURITY GATEWAY ● ONLINE
              </span>
              <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
                Last Event: {new Date(systemStatus.lastEvent || Date.now()).toLocaleTimeString()}
              </span>
            </div>

            <h1 className="soc-title">AI Security Gateway & SOC Center</h1>
            <p className="soc-subtitle">
              Multi-layer anomaly detection, behavioral analytics, automated threat neutralization, and live traffic inspection.
            </p>
          </div>

          <div className="soc-system-status-pills">
            <div className="status-pill-item">
              <span className="pill-label">AI Engine</span>
              <span className="pill-value">{systemStatus.aiEngine}</span>
            </div>

            <div className={`status-pill-item ${systemStatus.redis === "FALLBACK_MODE" ? "fallback-mode" : ""}`}>
              <span className="pill-label">Redis Distributed Blocklist</span>
              <span className="pill-value">
                {systemStatus.redis === "CONNECTED" ? "CONNECTED 🟢" : "REDIS FALLBACK MODE ⚠️"}
              </span>
            </div>

            <div className="status-pill-item">
              <span className="pill-label">Gateway Protection</span>
              <span className="pill-value" style={{ color: "#34d399" }}>ACTIVE 🛡️</span>
            </div>
          </div>
        </section>

        {/* Super Admin Emergency Controls */}
        {isSuperAdmin && <EmergencyControls />}

        {/* Traffic Filter Bar: All Traffic vs Real Traffic vs Simulation Traffic */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            borderRadius: "var(--radius-lg)",
            padding: "0.75rem 1.25rem",
            marginBottom: "1.25rem",
            flexWrap: "wrap",
            gap: "0.75rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Filter size={16} color="#38bdf8" />
            <span style={{ fontSize: "0.85rem", fontWeight: 700 }}>Telemetry Mode:</span>
          </div>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            {[
              { label: "All Traffic", val: "ALL" },
              { label: "Real Traffic Only", val: "REAL" },
              { label: "Simulation Only", val: "SIMULATION" },
            ].map((mode) => (
              <button
                key={mode.val}
                type="button"
                onClick={() => setTrafficType(mode.val)}
                style={{
                  padding: "0.4rem 0.9rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-color)",
                  background:
                    trafficType === mode.val
                      ? mode.val === "SIMULATION"
                        ? "#9333ea"
                        : "var(--color-primary)"
                      : "var(--bg-subtle)",
                  color: trafficType === mode.val ? "#ffffff" : "var(--text-secondary)",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        {/* Live Overview Metric Cards (11 Key Metrics) */}
        <SecurityOverview stats={stats} />

        {/* SOC Tab Navigation */}
        <div className="soc-tab-nav">
          <button
            type="button"
            className={`soc-tab-btn ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            <Activity size={17} />
            <span>Live Monitoring & Charts</span>
          </button>

          <button
            type="button"
            className={`soc-tab-btn ${activeTab === "lab" ? "active" : ""}`}
            onClick={() => setActiveTab("lab")}
          >
            <Cpu size={17} />
            <span>Security Test Lab (Isolated)</span>
          </button>

          <button
            type="button"
            className={`soc-tab-btn ${activeTab === "events" ? "active" : ""}`}
            onClick={() => setActiveTab("events")}
          >
            <Layers size={17} />
            <span>Event & Traffic Logs ({eventData.pagination.total})</span>
          </button>

          <button
            type="button"
            className={`soc-tab-btn ${activeTab === "blocked" ? "active" : ""}`}
            onClick={() => setActiveTab("blocked")}
          >
            <UserX size={17} />
            <span>Blocked Clients ({blockedClients.length})</span>
          </button>

          <button
            type="button"
            className={`soc-tab-btn ${activeTab === "blocked-users" ? "active" : ""}`}
            onClick={() => setActiveTab("blocked-users")}
          >
            <Users size={17} />
            <span>Blocked Users</span>
          </button>
        </div>

        {/* Tab 1: Live Monitoring & Charts */}
        {activeTab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <LiveSecurityFeed
              liveEvents={liveEvents}
              isPaused={isPaused}
              onTogglePause={() => setIsPaused(!isPaused)}
            />

            <TrafficChart
              timelineData={timelineData}
              currentRange={currentRange}
              onRangeChange={(range) => {
                setCurrentRange(range);
                fetchTrafficTimeline(range, trafficType).then((res) =>
                  setTimelineData(res.timeline || [])
                );
              }}
              loading={loading}
            />

            <ThreatAnalysis analytics={threatAnalytics} />
          </div>
        )}

        {/* Tab 2: Security Test Lab */}
        {activeTab === "lab" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <AttackSimulator
              onSimulationComplete={() => {
                loadDashboardData();
                loadEvents();
              }}
            />
            <LiveSecurityFeed
              liveEvents={liveEvents}
              isPaused={isPaused}
              onTogglePause={() => setIsPaused(!isPaused)}
            />
          </div>
        )}

        {/* Tab 3: Security Event & Traffic Table */}
        {activeTab === "events" && (
          <SecurityEventTable
            events={eventData.events}
            pagination={eventData.pagination}
            loading={loading}
            filters={filters}
            onFilterChange={setFilters}
            onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))}
            onRefresh={() => {
              loadEvents();
              loadDashboardData();
            }}
          />
        )}

        {/* Tab 4: Blocked Clients */}
        {activeTab === "blocked" && (
          <BlockedClients
            blockedClients={blockedClients}
            onRefresh={() => {
              fetchBlockedClients(trafficType).then((res) =>
                setBlockedClients(res.blockedClients || [])
              );
              fetchSecurityStats(trafficType).then((res) => setStats(res.stats || null));
            }}
          />
        )}

        {/* Tab 5: Blocked User Accounts (req.user._id) */}
        {activeTab === "blocked-users" && (
          <BlockedUsers />
        )}
      </div>
    </DashboardLayout>
  );
};

export default SecurityGateway;
