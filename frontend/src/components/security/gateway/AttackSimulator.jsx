import { useState, useRef } from "react";
import {
  Play,
  Square,
  RefreshCw,
  Cpu,
  Bot,
  ShieldAlert,
  Zap,
  CheckCircle2,
  Lock,
  KeyRound,
  Layers,
  ShieldCheck,
} from "lucide-react";
import {
  startSecuritySimulation,
  sendSecurityTestTraffic,
  stopSecuritySimulation,
} from "../../../services/securityGatewayService";
import { toast } from "react-toastify";

const AttackSimulator = ({ onSimulationComplete }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [simulationStatus, setSimulationStatus] = useState("IDLE");
  const [activeTestType, setActiveTestType] = useState("");
  const [requestCount, setRequestCount] = useState(25);
  const [intervalMs, setIntervalMs] = useState(250);

  // Dedicated server-minted isolated simulation context
  const [simulationContext, setSimulationContext] = useState(null);

  // Live simulation progress metrics
  const [progress, setProgress] = useState({
    sent: 0,
    allowed: 0,
    suspicious: 0,
    blocked: 0,
    peakRisk: 0,
    avgRisk: 0,
    currentScore: 0,
    currentDecision: "NORMAL",
    currentAction: "ALLOWED",
    activeNodeIndex: 0,
    blockedMessage: "",
  });

  // Final Test Results panel
  const [testResult, setTestResult] = useState(null);

  // Abort controller ref
  const abortControllerRef = useRef(null);
  const stopRequestedRef = useRef(false);
  const activeSimIdRef = useRef(null);

  const pipelineNodes = [
    { label: "BOT / CLIENT TRAFFIC", icon: <Bot size={16} /> },
    { label: "TRAFFIC ANALYZER", icon: <Layers size={16} /> },
    { label: "BEHAVIOR ANALYSIS", icon: <Cpu size={16} /> },
    { label: "AI RISK ENGINE", icon: <Zap size={16} /> },
    { label: "THREAT DETECTED", icon: <ShieldAlert size={16} /> },
    { label: "RATE LIMIT / BLOCK", icon: <Lock size={16} /> },
    { label: "SECURITY EVENT LOGGED", icon: <CheckCircle2 size={16} /> },
    { label: "ADMIN SOC ALERT", icon: <Zap size={16} /> },
  ];

  const handleStartTest = async (testType) => {
    if (isRunning) return;

    setIsRunning(true);
    setSimulationStatus("INITIALIZING");
    setActiveTestType(testType);
    stopRequestedRef.current = false;
    abortControllerRef.current = new AbortController();

    setProgress({
      sent: 0,
      allowed: 0,
      suspicious: 0,
      blocked: 0,
      peakRisk: 0,
      avgRisk: 0,
      currentScore: 0,
      currentDecision: "NORMAL",
      currentAction: "ALLOWED",
      activeNodeIndex: 0,
      blockedMessage: "",
    });

    let simCtx = null;

    try {
      // Step 1: Initialize server-side isolated simulation context with cryptographic authorization
      const initRes = await startSecuritySimulation({
        testType,
        requestCount,
        intervalMs,
      });

      simCtx = initRes.simulation;
      setSimulationContext(simCtx);
      activeSimIdRef.current = simCtx.simulationId;
      setSimulationStatus("RUNNING");

      toast.info(
        `🧪 Isolated Test Environment created: ${simCtx.testClientId} (${requestCount} requests)...`
      );
    } catch (err) {
      console.error("Failed to start simulation:", err);
      toast.error("Failed to initialize security simulation session.");
      setIsRunning(false);
      setSimulationStatus("IDLE");
      return;
    }

    const startTime = Date.now();
    let sent = 0;
    let allowed = 0;
    let suspicious = 0;
    let blocked = 0;
    let peakRisk = 0;
    let totalRisk = 0;
    let blockedMessage = "";
    let detectedPattern = "Normal baseline traffic";

    for (let i = 0; i < requestCount; i++) {
      if (stopRequestedRef.current) break;

      sent++;
      const activeStage = Math.min(pipelineNodes.length - 1, Math.floor(i % 8));

      try {
        const payloadData = {
          testType,
          index: i + 1,
          timestamp: Date.now(),
          simulatedBurst: testType === "BOT_BURST" || testType === "RATE_LIMIT_TEST",
          payloadData:
            testType === "SUSPICIOUS_PAYLOAD"
              ? "SELECT * FROM users WHERE '1'='1'; <script>alert(1)</script>"
              : `Synthetic payload chunk ${i + 1}`,
        };

        // Send synthetic test traffic strictly bearing the isolated simulation authorization headers
        const res = await sendSecurityTestTraffic(payloadData, {
          simulationId: simCtx.simulationId,
          simulationToken: simCtx.simulationToken,
        });

        const evalData = res.evaluation || {};
        const score = evalData.riskScore || 0;
        const decision = evalData.decision || "NORMAL";
        const action = evalData.action || "ALLOWED";

        totalRisk += score;
        peakRisk = Math.max(peakRisk, score);

        if (action === "BLOCKED" || decision === "CRITICAL" || decision === "HIGH_RISK") {
          blocked++;
          blockedMessage = "Automated anomalous traffic detected and synthetic client blocked.";
        } else if (decision === "SUSPICIOUS") {
          suspicious++;
        } else {
          allowed++;
        }

        setProgress({
          sent,
          allowed,
          suspicious,
          blocked,
          peakRisk,
          avgRisk: Math.round(totalRisk / sent),
          currentScore: score,
          currentDecision: decision,
          currentAction: action,
          activeNodeIndex: activeStage,
          blockedMessage,
        });
      } catch (err) {
        // Blocked 403 or 429 response from security gateway for synthetic client
        blocked++;
        const evalData = err.response?.data?.evaluation || {};
        const score = evalData.riskScore || 95;
        const decision = evalData.decision || "CRITICAL";
        const action = evalData.action || "BLOCKED";

        peakRisk = Math.max(peakRisk, score);
        totalRisk += score;
        blockedMessage =
          err.response?.data?.message ||
          "Automated anomalous traffic detected and synthetic client blocked.";
        detectedPattern =
          evalData.reason || "Automated rapid burst & anomalous behavioral pattern";

        setProgress({
          sent,
          allowed,
          suspicious,
          blocked,
          peakRisk,
          avgRisk: Math.round(totalRisk / sent),
          currentScore: score,
          currentDecision: decision,
          currentAction: action,
          activeNodeIndex: 5,
          blockedMessage,
        });
      }

      // Interval delay between synthetic requests
      if (intervalMs > 0 && i < requestCount - 1) {
        await new Promise((r) => setTimeout(r, intervalMs));
      }
    }

    // Step 2: Clean up simulation session on server
    try {
      if (simCtx?.simulationId) {
        await stopSecuritySimulation(simCtx.simulationId);
      }
    } catch {
      // safe fallback
    }

    const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
    const avgRiskScore = sent > 0 ? Math.round(totalRisk / sent) : 0;

    const summary = {
      testName: testType.replace(/_/g, " "),
      simulationId: simCtx?.simulationId || "N/A",
      testClientId: simCtx?.testClientId || "N/A",
      testAccount: simCtx?.testEmail || "N/A",
      syntheticIp: simCtx?.syntheticIp || "N/A",
      startTime: new Date(startTime).toLocaleTimeString(),
      duration: `${durationSeconds}s`,
      requestsGenerated: sent,
      requestsAllowed: allowed,
      requestsFlagged: suspicious,
      requestsBlocked: blocked,
      peakRiskScore: peakRisk,
      averageRiskScore: avgRiskScore,
      detectedPattern:
        blocked > 0
          ? detectedPattern || "Automated rapid burst & anomalous behavioral pattern"
          : suspicious > 0
          ? "Elevated request frequency"
          : "Normal baseline user pattern",
      gatewayAction: blocked > 0 ? "BLOCKED" : suspicious > 0 ? "MONITORED" : "ALLOWED",
    };

    setTestResult(summary);
    setIsRunning(false);
    setSimulationStatus(stopRequestedRef.current ? "STOPPED" : "COMPLETED");
    setActiveTestType("");

    toast.success(`Simulation completed: ${sent} requests evaluated in isolated test context.`);
    if (onSimulationComplete) onSimulationComplete();
  };

  const handleStopTest = async () => {
    stopRequestedRef.current = true;
    setIsRunning(false);
    setSimulationStatus("STOPPED");
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (activeSimIdRef.current) {
      await stopSecuritySimulation(activeSimIdRef.current);
    }
    toast.warn("Simulation stopped by administrator. Temporary test state cleaned.");
    if (onSimulationComplete) onSimulationComplete();
  };

  const handleClearResults = () => {
    setTestResult(null);
    setSimulationContext(null);
    setSimulationStatus("IDLE");
    setProgress({
      sent: 0,
      allowed: 0,
      suspicious: 0,
      blocked: 0,
      peakRisk: 0,
      avgRisk: 0,
      currentScore: 0,
      currentDecision: "NORMAL",
      currentAction: "ALLOWED",
      activeNodeIndex: 0,
      blockedMessage: "",
    });
  };

  return (
    <div className="soc-lab-container">
      <div className="soc-lab-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Cpu size={22} color="#3b82f6" />
            <h3 className="soc-card-title">Security Test Lab (Completely Isolated Environment)</h3>
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.84rem", margin: "0.25rem 0 0 0" }}>
            Generates safe synthetic attack vectors under a dedicated test identity.
            Simulated blocks <strong>never block your real browser, IP, or admin session</strong>.
          </p>
        </div>

        {/* Test Controls / Config */}
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.82rem" }}>
            <span style={{ fontWeight: 600, color: "var(--text-muted)" }}>Requests:</span>
            {[10, 25, 50, 100].map((num) => (
              <button
                key={num}
                type="button"
                disabled={isRunning}
                onClick={() => setRequestCount(num)}
                style={{
                  padding: "0.25rem 0.55rem",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-color)",
                  background: requestCount === num ? "var(--color-primary)" : "var(--bg-subtle)",
                  color: requestCount === num ? "#ffffff" : "var(--text-primary)",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  cursor: isRunning ? "not-allowed" : "pointer",
                }}
              >
                {num}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.82rem" }}>
            <span style={{ fontWeight: 600, color: "var(--text-muted)" }}>Interval:</span>
            {[
              { label: "100ms", val: 100 },
              { label: "250ms", val: 250 },
              { label: "500ms", val: 500 },
              { label: "1s", val: 1000 },
            ].map((intv) => (
              <button
                key={intv.val}
                type="button"
                disabled={isRunning}
                onClick={() => setIntervalMs(intv.val)}
                style={{
                  padding: "0.25rem 0.55rem",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-color)",
                  background: intervalMs === intv.val ? "var(--color-primary)" : "var(--bg-subtle)",
                  color: intervalMs === intv.val ? "#ffffff" : "var(--text-primary)",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  cursor: isRunning ? "not-allowed" : "pointer",
                }}
              >
                {intv.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Dedicated Isolated Simulation Identity Banner */}
      {simulationContext && (
        <div
          style={{
            background: "rgba(168, 85, 247, 0.08)",
            border: "1px solid rgba(168, 85, 247, 0.3)",
            borderRadius: "var(--radius-md)",
            padding: "0.75rem 1rem",
            fontSize: "0.82rem",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "0.6rem",
          }}
        >
          <div>
            <span style={{ color: "var(--text-muted)", display: "block", fontSize: "0.72rem" }}>
              SIMULATION STATUS
            </span>
            <strong
              style={{
                color:
                  simulationStatus === "RUNNING"
                    ? "#38bdf8"
                    : simulationStatus === "COMPLETED"
                    ? "#34d399"
                    : "#fbbf24",
              }}
            >
              ● {simulationStatus}
            </strong>
          </div>
          <div>
            <span style={{ color: "var(--text-muted)", display: "block", fontSize: "0.72rem" }}>
              SIMULATION ID
            </span>
            <strong style={{ fontFamily: "monospace", fontSize: "0.78rem" }}>
              {simulationContext.simulationId.slice(0, 22)}...
            </strong>
          </div>
          <div>
            <span style={{ color: "var(--text-muted)", display: "block", fontSize: "0.72rem" }}>
              SYNTHETIC CLIENT ID
            </span>
            <strong style={{ color: "#c084fc", fontFamily: "monospace" }}>
              {simulationContext.testClientId}
            </strong>
          </div>
          <div>
            <span style={{ color: "var(--text-muted)", display: "block", fontSize: "0.72rem" }}>
              TEST ACCOUNT
            </span>
            <strong style={{ color: "#94a3b8" }}>{simulationContext.testEmail}</strong>
          </div>
          <div>
            <span style={{ color: "var(--text-muted)", display: "block", fontSize: "0.72rem" }}>
              SYNTHETIC IP / VECTOR
            </span>
            <span style={{ fontFamily: "monospace" }}>{simulationContext.syntheticIp}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: "#10b981" }}>
            <ShieldCheck size={16} />
            <span style={{ fontWeight: 600, fontSize: "0.75rem" }}>Real Browser Protected</span>
          </div>
        </div>
      )}

      {/* Simulator Action Buttons Grid */}
      <div className="soc-lab-buttons-grid">
        <button
          type="button"
          disabled={isRunning}
          onClick={() => handleStartTest("NORMAL_TRAFFIC")}
          className="sim-btn primary"
        >
          <Play size={15} />
          <span>Normal Traffic Test</span>
        </button>

        <button
          type="button"
          disabled={isRunning}
          onClick={() => handleStartTest("BOT_BURST")}
          className="sim-btn danger"
        >
          <Bot size={15} />
          <span>Bot Burst Test</span>
        </button>

        <button
          type="button"
          disabled={isRunning}
          onClick={() => handleStartTest("FAILED_LOGIN_SIM")}
          className="sim-btn warning"
        >
          <Lock size={15} />
          <span>Failed Login Simulation</span>
        </button>

        <button
          type="button"
          disabled={isRunning}
          onClick={() => handleStartTest("INVALID_OTP_SIM")}
          className="sim-btn purple"
        >
          <KeyRound size={15} />
          <span>Invalid OTP Simulation</span>
        </button>

        <button
          type="button"
          disabled={isRunning}
          onClick={() => handleStartTest("RATE_LIMIT_TEST")}
          className="sim-btn danger"
        >
          <Zap size={15} />
          <span>Rate Limit Test</span>
        </button>

        <button
          type="button"
          disabled={isRunning}
          onClick={() => handleStartTest("SUSPICIOUS_PAYLOAD")}
          className="sim-btn warning"
        >
          <Layers size={15} />
          <span>Suspicious Payload Test</span>
        </button>

        <button
          type="button"
          disabled={isRunning}
          onClick={() => handleStartTest("MIXED_TRAFFIC")}
          className="sim-btn primary"
        >
          <RefreshCw size={15} />
          <span>Mixed Traffic Test</span>
        </button>

        <button
          type="button"
          disabled={!isRunning}
          onClick={handleStopTest}
          className="sim-btn stop"
        >
          <Square size={15} />
          <span>Stop Test</span>
        </button>

        <button
          type="button"
          onClick={handleClearResults}
          className="sim-btn"
          style={{ background: "var(--bg-subtle)" }}
        >
          <span>Clear Results</span>
        </button>
      </div>

      {/* Live Pipeline Animation Visualizer */}
      <div className="soc-pipeline-visualizer">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span
            style={{
              fontSize: "0.82rem",
              fontWeight: 700,
              color: "#38bdf8",
              textTransform: "uppercase",
            }}
          >
            {isRunning
              ? `▶ SIMULATION RUNNING: ${activeTestType}`
              : "● SIMULATION PIPELINE READY (ISOLATED)"}
          </span>
          <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
            Requests: {progress.sent} / {requestCount}
          </span>
        </div>

        {/* Animated Pipeline Nodes */}
        <div className="pipeline-nodes-row">
          {pipelineNodes.map((node, index) => {
            const isActive = isRunning && progress.activeNodeIndex === index;
            const isThreatNode = index >= 4 && progress.blocked > 0;

            return (
              <div key={index} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <div
                  className={`pipeline-node ${isActive ? "active" : ""} ${
                    isThreatNode ? "threat" : ""
                  }`}
                >
                  {node.icon}
                  <span>{node.label}</span>
                </div>
                {index < pipelineNodes.length - 1 && <span className="pipeline-arrow">→</span>}
              </div>
            );
          })}
        </div>

        {/* Live Counters */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
            gap: "0.75rem",
            paddingTop: "0.5rem",
            borderTop: "1px solid #1e293b",
          }}
        >
          <div>
            <span style={{ fontSize: "0.68rem", color: "#94a3b8" }}>GENERATED</span>
            <div style={{ fontSize: "1.1rem", fontWeight: 800 }}>{progress.sent}</div>
          </div>
          <div>
            <span style={{ fontSize: "0.68rem", color: "#34d399" }}>ALLOWED</span>
            <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#34d399" }}>
              {progress.allowed}
            </div>
          </div>
          <div>
            <span style={{ fontSize: "0.68rem", color: "#fbbf24" }}>SUSPICIOUS</span>
            <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#fbbf24" }}>
              {progress.suspicious}
            </div>
          </div>
          <div>
            <span style={{ fontSize: "0.68rem", color: "#f87171" }}>BLOCKED</span>
            <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#f87171" }}>
              {progress.blocked}
            </div>
          </div>
          <div>
            <span style={{ fontSize: "0.68rem", color: "#94a3b8" }}>RISK SCORE</span>
            <div
              style={{
                fontSize: "1.1rem",
                fontWeight: 800,
                color: progress.currentScore >= 60 ? "#f87171" : "#38bdf8",
              }}
            >
              {progress.currentScore}/100
            </div>
          </div>
          <div>
            <span style={{ fontSize: "0.68rem", color: "#94a3b8" }}>AI DECISION</span>
            <div style={{ fontSize: "0.85rem", fontWeight: 800 }}>
              <span className={`sev-badge ${progress.currentDecision}`}>
                {progress.currentDecision}
              </span>
            </div>
          </div>
          <div>
            <span style={{ fontSize: "0.68rem", color: "#94a3b8" }}>ACTION</span>
            <div style={{ fontSize: "0.85rem", fontWeight: 800 }}>
              <span className={`act-badge ${progress.currentAction}`}>
                {progress.currentAction}
              </span>
            </div>
          </div>
        </div>

        {progress.blockedMessage && (
          <div
            style={{
              background: "rgba(239, 68, 68, 0.15)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              padding: "0.6rem 0.85rem",
              borderRadius: "6px",
              color: "#fca5a5",
              fontSize: "0.82rem",
              fontWeight: 600,
            }}
          >
            ⚠️ {progress.blockedMessage}
          </div>
        )}
      </div>

      {/* Test Results Panel */}
      {testResult && (
        <div
          style={{
            background: "var(--bg-subtle)",
            border: "1px solid var(--border-color)",
            borderRadius: "var(--radius-lg)",
            padding: "1.25rem",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "0.85rem",
            }}
          >
            <h4 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>
              Security Test Report: {testResult.testName}
            </h4>
            <span
              style={{
                fontSize: "0.75rem",
                padding: "0.2rem 0.55rem",
                borderRadius: "4px",
                background: "rgba(168, 85, 247, 0.2)",
                color: "#c084fc",
                fontWeight: 700,
              }}
            >
              CONTROLLED TEST RUN
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "1rem",
              fontSize: "0.84rem",
            }}
          >
            <div>
              <span style={{ color: "var(--text-muted)", display: "block" }}>Simulation ID:</span>
              <strong style={{ fontFamily: "monospace", fontSize: "0.78rem" }}>
                {testResult.simulationId}
              </strong>
            </div>
            <div>
              <span style={{ color: "var(--text-muted)", display: "block" }}>Synthetic Client:</span>
              <strong style={{ color: "#c084fc", fontFamily: "monospace" }}>
                {testResult.testClientId}
              </strong>
            </div>
            <div>
              <span style={{ color: "var(--text-muted)", display: "block" }}>Test Account:</span>
              <strong>{testResult.testAccount}</strong>
            </div>
            <div>
              <span style={{ color: "var(--text-muted)", display: "block" }}>Synthetic IP:</span>
              <strong>{testResult.syntheticIp}</strong>
            </div>
            <div>
              <span style={{ color: "var(--text-muted)", display: "block" }}>Duration:</span>
              <strong>{testResult.duration}</strong>
            </div>
            <div>
              <span style={{ color: "var(--text-muted)", display: "block" }}>
                Requests Generated:
              </span>
              <strong>{testResult.requestsGenerated}</strong>
            </div>
            <div>
              <span style={{ color: "#10b981", display: "block" }}>Requests Allowed:</span>
              <strong>{testResult.requestsAllowed}</strong>
            </div>
            <div>
              <span style={{ color: "#f59e0b", display: "block" }}>Requests Flagged:</span>
              <strong>{testResult.requestsFlagged}</strong>
            </div>
            <div>
              <span style={{ color: "#ef4444", display: "block" }}>Requests Blocked:</span>
              <strong>{testResult.requestsBlocked}</strong>
            </div>
            <div>
              <span style={{ color: "var(--text-muted)", display: "block" }}>Peak Risk Score:</span>
              <strong style={{ color: testResult.peakRiskScore >= 60 ? "#ef4444" : "#10b981" }}>
                {testResult.peakRiskScore}/100
              </strong>
            </div>
            <div>
              <span style={{ color: "var(--text-muted)", display: "block" }}>
                Average Risk Score:
              </span>
              <strong>{testResult.averageRiskScore}/100</strong>
            </div>
            <div>
              <span style={{ color: "var(--text-muted)", display: "block" }}>Gateway Action:</span>
              <strong
                style={{
                  color:
                    testResult.gatewayAction === "BLOCKED"
                      ? "#ef4444"
                      : testResult.gatewayAction === "MONITORED"
                      ? "#f59e0b"
                      : "#10b981",
                }}
              >
                {testResult.gatewayAction}
              </strong>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <span style={{ color: "var(--text-muted)", display: "block" }}>
                Detected Pattern:
              </span>
              <strong>{testResult.detectedPattern}</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttackSimulator;
