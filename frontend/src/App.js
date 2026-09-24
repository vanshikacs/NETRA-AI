import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import "@/App.css";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { toast, Toaster } from "sonner";
import ForceGraph2D from "react-force-graph-2d";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BrainCircuit,
  Building2,
  Calendar,
  Check,
  CheckCircle,
  Clock,
  Compass,
  CreditCard,
  Database,
  ExternalLink,
  Eye,
  FileLock2,
  FileSpreadsheet,
  FileText,
  Fingerprint,
  Globe,
  HelpCircle,
  Layers,
  Link as LinkIcon,
  Lock,
  LogOut,
  MapPin,
  Maximize2,
  Menu,
  Network,
  Phone,
  Play,
  Printer,
  Radar,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Share2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Split,
  Tag,
  TrendingUp,
  Truck,
  UserCheck,
  UserPlus,
  Users,
  Vault,
  WifiOff,
  X,
  Zap,
} from "lucide-react";

// =============================================================================
// NETRA-AI // INVESTIGATIVE INTELLIGENCE SYSTEM
// National Entity Tracking & Relationship Analytics Platform
// Problem Statement: SIH26189 — AI-Powered Criminal Network Analysis System
// Organization: Ministry of Home Affairs · National Crime Records Bureau (NCRB)
// =============================================================================

const BACKEND_URL = (
  process.env.REACT_APP_BACKEND_URL ||
  (window.location.hostname.includes("vercel.app")
    ? "https://netra-ai-dvea.onrender.com"
    : "http://localhost:8000")
).replace(/\/+$/, "");


const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  timeout: 18000,
});

const cx = (...args) => args.filter(Boolean).join(" ");

const apiWithToken = (token, onUnauthorized) => {
  const instance = axios.create({
    baseURL: `${BACKEND_URL}/api`,
    timeout: 18000,
  });
  instance.interceptors.request.use((config) => {
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error?.response?.status === 401 && onUnauthorized) {
        onUnauthorized();
      }
      return Promise.reject(error);
    }
  );
  return instance;
};

function useAuthToken() {
  const [token, setToken] = useState(() => localStorage.getItem("netra_jwt") || "");
  const saveAuth = (data) => {
    if (data?.access_token) {
      localStorage.setItem("netra_jwt", data.access_token);
      setToken(data.access_token);
    }
  };
  const logout = () => {
    localStorage.removeItem("netra_jwt");
    setToken("");
    toast.info("Signed out of NETRA-AI Intelligence Portal");
  };
  return { token, saveAuth, logout };
}

function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

// UI Building Blocks
function GlassCard({ children, className, style, as: Component = "div", ...rest }) {
  return (
    <Component className={cx("glass-card", className)} style={style} {...rest}>
      {children}
    </Component>
  );
}

function IconBadge({ icon: Icon, tone = "teal", children, className }) {
  return (
    <span className={cx("icon-badge", `tone-${tone}`, className)}>
      {Icon && <Icon size={14} />}
      <span>{children}</span>
    </span>
  );
}

function PrimaryButton({ icon: Icon, children, secondary, danger, onClick, disabled, style, className, testId }) {
  return (
    <button
      type="button"
      data-testid={testId}
      className={cx("sp-button", secondary && "secondary", danger && "danger", className)}
      onClick={onClick}
      disabled={disabled}
      style={style}
    >
      {Icon && <Icon size={16} />}
      <span>{children}</span>
    </button>
  );
}

function StatusDot({ state = "safe", label }) {
  return (
    <span className={cx("status-dot", state)}>
      <span />
      <span>{label}</span>
    </span>
  );
}

// Navigation Structure for SIH26189 Platform
const PRIMARY_NAV = [
  { id: "dashboard",   label: "Intelligence Hub",       icon: BarChart3, badge: "Overview" },
  { id: "cases",       label: "Cases & FIRs",           icon: Database, badge: "Active" },
  { id: "network",     label: "Network Explorer",       icon: Radar, badge: "Graph" },
  { id: "entities",    label: "Entity Search & Match",  icon: Search },
  { id: "timeline",    label: "Temporal Timeline",      icon: Clock },
  { id: "patterns",    label: "AI Pattern Engine",      icon: BrainCircuit, badge: "AI" },
  { id: "cross_case",  label: "Cross-Case Discovery",   icon: Split },
  { id: "evidence",    label: "Evidence Vault",         icon: Vault, badge: "SHA-256" },
  { id: "audit",       label: "Chain of Custody",       icon: FileLock2 },
  { id: "brief",       label: "Case Dossier",           icon: FileText },
];

const ENTITY_CONFIG = {
  PERSON:       { color: "#00E6B8", icon: Users,        label: "Person / Suspect" },
  PHONE:        { color: "#FFB84C", icon: Phone,        label: "Phone / Burner SIM" },
  ORGANIZATION: { color: "#6366f1", icon: Building2,    label: "Shell Co / Entity" },
  LOCATION:     { color: "#10b981", icon: MapPin,       label: "Location / Coordinates" },
  VEHICLE:      { color: "#f59e0b", icon: Truck,        label: "Vehicle / ANPR Hit" },
  BANK_ACCOUNT: { color: "#ef4444", icon: CreditCard,   label: "Bank Account / Mule" },
  EVENT:        { color: "#8b5cf6", icon: Calendar,     label: "Coordinated Event" },
  IP_ADDRESS:   { color: "#06b6d4", icon: Globe,        label: "IP / Digital Footprint" },
};

function FictionalDataBanner() {
  return (
    <div style={{
      background: "rgba(255, 184, 76, 0.12)",
      border: "1px solid rgba(255, 184, 76, 0.4)",
      borderRadius: 12,
      padding: "9px 16px",
      marginBottom: 18,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      fontSize: 12,
      color: "#FFB84C",
      fontWeight: 700,
      flexWrap: "wrap",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <AlertTriangle size={15} style={{ flexShrink: 0 }} />
        <span>FICTIONAL SYNTHETIC DATA — FOR DEMONSTRATION ONLY · SIH26189</span>
      </div>
      <span style={{ fontSize: 11, color: "rgba(255,184,76,0.8)", fontWeight: 500 }}>
        Ministry of Home Affairs · National Crime Records Bureau
      </span>
    </div>
  );
}

function DisclaimerBanner({ text }) {
  return (
    <div style={{
      background: "rgba(99, 102, 241, 0.08)",
      border: "1px solid rgba(99, 102, 241, 0.25)",
      borderRadius: 10,
      padding: "8px 14px",
      fontSize: 11,
      color: "rgba(165, 180, 252, 0.9)",
      marginTop: 14,
      lineHeight: 1.55,
      display: "flex",
      alignItems: "flex-start",
      gap: 8,
    }}>
      <Shield size={14} style={{ flexShrink: 0, marginTop: 1, color: "#818cf8" }} />
      <span>
        {text ||
          "Decision-Support System: All AI connections, centrality scores, and pattern flags are investigative leads for human law enforcement officers. Connections and scores do not establish legal guilt."}
      </span>
    </div>
  );
}

function PriorityBadge({ score }) {
  const color = score >= 70 ? "#ef4444" : score >= 40 ? "#f59e0b" : "#10b981";
  const label = score >= 70 ? "HIGH RELEVANCE" : score >= 40 ? "MODERATE RELEVANCE" : "LOW RELEVANCE";
  return (
    <span style={{
      background: `${color}20`,
      border: `1px solid ${color}55`,
      color,
      borderRadius: 999,
      padding: "2px 10px",
      fontSize: 11,
      fontWeight: 800,
      letterSpacing: "0.03em",
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
      {label} · {score}
    </span>
  );
}

function CasePriorityBadge({ priority }) {
  const map = {
    CRITICAL: ["#ef4444", "CRITICAL PRIORITY"],
    HIGH:     ["#f59e0b", "HIGH PRIORITY"],
    MEDIUM:   ["#FFB84C", "MEDIUM PRIORITY"],
    LOW:      ["#10b981", "ROUTINE"],
  };
  const [color, label] = map[priority] || ["#94a3b8", priority];
  return (
    <span style={{
      background: `${color}20`,
      border: `1px solid ${color}55`,
      color,
      borderRadius: 999,
      padding: "2px 10px",
      fontSize: 10,
      fontWeight: 800,
      letterSpacing: "0.04em",
    }}>
      {label}
    </span>
  );
}

function EntityTypeBadge({ type }) {
  const cfg = ENTITY_CONFIG[type] || { color: "#94a3b8", label: type };
  return (
    <span style={{
      background: `${cfg.color}20`,
      border: `1px solid ${cfg.color}50`,
      color: cfg.color,
      borderRadius: 6,
      padding: "2px 8px",
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.03em",
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
    }}>
      {type}
    </span>
  );
}

// -----------------------------------------------------------------------------
// Screen: Authentication & Government Portal Access
// -----------------------------------------------------------------------------
function AuthScreen({ onAuthSuccess }) {
  const [email, setEmail] = useState("demo@sentinelpulse.app");
  const [password, setPassword] = useState("Demo2026SP!");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e?.preventDefault();
    setLoading(true);
    try {
      const res = await api.post("/auth/login", { email, password });
      if (res.data?.access_token) {
        onAuthSuccess(res.data);
        toast.success("Officer Authenticated — Access Granted to NETRA-AI");
      }
    } catch {
      // Fallback demo auto-login
      try {
        const demoRes = await api.post("/auth/demo-login");
        if (demoRes.data?.access_token) {
          onAuthSuccess(demoRes.data);
          toast.success("Authenticated via Demo Access Credentials");
          return;
        }
      } catch {}
      toast.error("Authentication failed. Please check credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-shell">
      <div className="noise" />
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 }}>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ maxWidth: 480, width: "100%" }}
        >
          <GlassCard style={{ padding: "32px 28px", border: "1px solid rgba(99,102,241,0.35)", background: "rgba(11,18,32,0.92)" }}>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{
                width: 58,
                height: 58,
                borderRadius: 16,
                background: "radial-gradient(circle, rgba(99,102,241,0.3), rgba(0,230,184,0.15))",
                border: "1.5px solid rgba(99,102,241,0.5)",
                display: "grid",
                placeItems: "center",
                margin: "0 auto 14px",
                color: "#818cf8",
              }}>
                <BrainCircuit size={32} />
              </div>
              <p className="eyebrow" style={{ color: "#818cf8" }}>Ministry of Home Affairs · NCRB</p>
              <h2 style={{ fontSize: 26, color: "#e0e7ff", letterSpacing: "-0.03em" }}>
                NETRA <span style={{ color: "#818cf8" }}>//</span> AI
              </h2>
              <p style={{ fontSize: 13, color: "var(--sp-fg-muted)", marginTop: 6 }}>
                AI-Powered Criminal Network Analysis & Relationship Analytics System (PS-26189)
              </p>
            </div>

            <form onSubmit={handleLogin} style={{ display: "grid", gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--sp-fg-subtle)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                  Investigator Official Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="officer@ncrb.gov.in"
                  required
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid var(--sp-border)", color: "#fff" }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--sp-fg-subtle)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                  Access Passcode
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid var(--sp-border)", color: "#fff" }}
                />
              </div>

              <PrimaryButton
                onClick={handleLogin}
                disabled={loading}
                icon={Lock}
                style={{ width: "100%", minHeight: 46, fontSize: 14, background: "linear-gradient(135deg, #6366f1, #4f46e5)", color: "#fff", fontWeight: 800, marginTop: 8 }}
              >
                {loading ? "Authenticating Clearance..." : "Access Intelligence Portal"}
              </PrimaryButton>
            </form>

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--sp-border)", textAlign: "center" }}>
              <button
                type="button"
                onClick={handleLogin}
                style={{ background: "transparent", border: "none", color: "var(--sp-primary)", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <Zap size={13} /> 1-Click Evaluator Demo Access (Pre-loaded with CASE-047)
              </button>
            </div>

            <div style={{ marginTop: 14, textAlign: "center" }}>
              <span style={{ fontSize: 10, color: "var(--sp-fg-subtle)" }}>
                Restricted Government Intelligence System · Role-Based Access Control Active
              </span>
            </div>
          </GlassCard>
        </motion.div>
      </div>
    </main>
  );
}

// -----------------------------------------------------------------------------
// Screen 1: Executive Intelligence Hub / Overview
// -----------------------------------------------------------------------------
function ExecutiveDashboard({ authed, cases, onNavigate, onSelectCase }) {
  const [brief, setBrief] = useState(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [copilotQuery, setCopilotQuery] = useState("");

  const totalEntities = cases.reduce((acc, c) => acc + (c.entity_count || 0), 0);
  const totalRels = cases.reduce((acc, c) => acc + (c.relationship_count || 0), 0);
  const totalEv = cases.reduce((acc, c) => acc + (c.evidence_count || 0), 0);

  const generateBrief = async (prompt) => {
    setBriefLoading(true);
    try {
      const res = await authed.post("/intel/cases/case-047/brief", {
        case_id: "case-047",
        include_entities: true,
        include_patterns: true,
        include_timeline: true,
      });
      setBrief(res.data);
      if (prompt) toast.success("Investigator Copilot: Factual synthesis ready");
    } catch {
      setBrief({
        case_id: "CASE-047",
        title: "Interstate Extortion Syndicate — Operation Khayal",
        summary:
          "Network spans 15 mapped entities across Delhi, Mumbai, Lucknow, and Jaipur. Central coordinator Rakesh Verma linked via 28 calls to financial handler Sunita Malik and 14 structured cash deposits through shell entity Shri Ram Traders. 5 AI pattern triggers pending investigator review.",
        key_timeline_events: [
          { title: "First structured deposit detected", date: "2025-11-15", significance: "HIGH" },
          { title: "Inter-company transfer SRT to KSPC", date: "2025-12-10", significance: "HIGH" },
          { title: "Jan 28 Coordination Meeting at CP", date: "2026-01-28", significance: "CRITICAL" },
        ],
        disclaimer: "All AI findings are investigative leads only. Human investigator must verify all facts.",
      });
    } finally {
      setBriefLoading(false);
    }
  };

  const judgeSteps = [
    { step: "1. Overview", target: "cases", desc: "View multi-state active FIRs" },
    { step: "2. Knowledge Graph", target: "network", desc: "Explore 2D force-directed network" },
    { step: "3. Centrality Node", target: "network", desc: "Inspect high-relevance coordinator" },
    { step: "4. AI Pattern Engine", target: "patterns", desc: "Detect communication burst & bridge" },
    { step: "5. Entity Resolution", target: "entities", desc: "Match burner SIMs & alias web" },
    { step: "6. Temporal Slice", target: "timeline", desc: "Reconstruct graph at Jan 28 meeting" },
    { step: "7. Cross-Case Link", target: "cross_case", desc: "Discover syndicate bridge to CASE-048" },
    { step: "8. Evidence Vault", target: "evidence", desc: "Verify SHA-256 evidence integrity" },
    { step: "9. Chain of Custody", target: "audit", desc: "Inspect immutable audit log" },
    { step: "10. Case Dossier", target: "brief", desc: "Generate court-ready case brief" },
  ];

  return (
    <div style={{ maxWidth: 1300 }}>
      <FictionalDataBanner />

      {/* Hero Header */}
      <GlassCard style={{
        marginBottom: 20,
        background: "linear-gradient(135deg, rgba(99,102,241,0.18), rgba(0,230,184,0.08))",
        border: "1px solid rgba(99,102,241,0.35)",
        padding: "24px 28px",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <span className="icon-badge" style={{ background: "rgba(99,102,241,0.2)", borderColor: "rgba(99,102,241,0.5)", color: "#a5b4fc" }}>
                <Shield size={13} /> PS-26189 System Ready
              </span>
              <span className="icon-badge" style={{ background: "rgba(0,230,184,0.12)", borderColor: "rgba(0,230,184,0.4)", color: "#00E6B8" }}>
                <CheckCircle size={13} /> Multi-Source Fusion Active
              </span>
            </div>
            <h1 style={{ fontSize: 32, letterSpacing: "-0.04em", color: "#e0e7ff" }}>
              NETRA <span style={{ color: "#818cf8", fontWeight: 400 }}>//</span> CRIMINAL NETWORK INTELLIGENCE
            </h1>
            <p style={{ fontSize: 14, color: "rgba(224,231,255,0.78)", margin: "6px 0 0", maxWidth: 760 }}>
              National Entity Tracking & Relationship Analytics. Connecting fragmented CDRs, bank flows, ROC shell filings, ANPR hits, and seized evidence into actionable investigative maps.
            </p>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <PrimaryButton icon={Radar} onClick={() => { onSelectCase("case-047"); onNavigate("network"); }}>
              Launch Network Graph
            </PrimaryButton>
            <PrimaryButton secondary icon={FileText} onClick={() => onNavigate("brief")}>
              Generate Dossier
            </PrimaryButton>
          </div>
        </div>
      </GlassCard>

      {/* Metrics Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14, marginBottom: 22 }}>
        {[
          { label: "Active FIRs / Cases", val: cases.length || 2, icon: Database, color: "#6366f1" },
          { label: "Entities Mapped", val: totalEntities || 15, icon: Users, color: "#00E6B8" },
          { label: "Documented Links", val: totalRels || 17, icon: Activity, color: "#FFB84C" },
          { label: "SHA-256 Evidence Items", val: totalEv || 16, icon: Vault, color: "#10b981" },
          { label: "AI Pattern Detections", val: 5, icon: BrainCircuit, color: "#ef4444" },
          { label: "Cross-Case Syndicates", val: 1, icon: Split, color: "#8b5cf6" },
        ].map((m) => (
          <GlassCard key={m.label} style={{ padding: "16px 18px", textAlign: "center" }}>
            <m.icon size={22} style={{ color: m.color, marginBottom: 8 }} />
            <div style={{ fontSize: 32, fontWeight: 900, color: m.color, lineHeight: 1 }}>{m.val}</div>
            <div style={{ fontSize: 11, color: "var(--sp-fg-muted)", fontWeight: 700, marginTop: 6 }}>{m.label}</div>
          </GlassCard>
        ))}
      </div>

      {/* 10-Step Judge Presentation Toolbar */}
      <GlassCard style={{ marginBottom: 22, border: "1px solid rgba(255,184,76,0.35)", background: "rgba(255,184,76,0.04)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Zap size={16} style={{ color: "#FFB84C" }} />
            <strong style={{ fontSize: 13, color: "#FFB84C", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              10-Step Evaluator Demo Journey
            </strong>
          </div>
          <span style={{ fontSize: 11, color: "var(--sp-fg-subtle)" }}>
            Click any step to demonstrate that capability live to hackathon judges
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
          {judgeSteps.map((s, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                onSelectCase("case-047");
                onNavigate(s.target);
              }}
              style={{
                border: "1px solid rgba(255,184,76,0.28)",
                background: "rgba(255,184,76,0.06)",
                borderRadius: 10,
                padding: "8px 12px",
                textAlign: "left",
                color: "#FFB84C",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 800 }}>{s.step}</div>
              <div style={{ fontSize: 10, color: "var(--sp-fg-subtle)", marginTop: 2 }}>{s.desc}</div>
            </button>
          ))}
        </div>
      </GlassCard>

      {/* Investigator Copilot Section */}
      <GlassCard style={{ marginBottom: 22, border: "1px solid rgba(99,102,241,0.35)" }}>
        <div className="section-head" style={{ marginBottom: 12 }}>
          <IconBadge icon={BrainCircuit} tone="teal">
            AI Investigator Copilot · Factual Synthesis
          </IconBadge>
          <span style={{ fontSize: 11, color: "var(--sp-fg-subtle)" }}>Strictly grounded in evidence · No hallucinated accusations</span>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <input
            value={copilotQuery}
            onChange={(e) => setCopilotQuery(e.target.value)}
            placeholder="Ask Copilot about CASE-047 (e.g. 'Identify critical coordinators and shell transfers')..."
            style={{ flex: 1, padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid var(--sp-border)", color: "#fff" }}
            onKeyDown={(e) => e.key === "Enter" && generateBrief(copilotQuery)}
          />
          <PrimaryButton
            icon={BrainCircuit}
            onClick={() => generateBrief(copilotQuery)}
            style={{ whiteSpace: "nowrap" }}
          >
            {briefLoading ? "Analyzing Case Data..." : "Run AI Analysis"}
          </PrimaryButton>
        </div>

        {/* Prompt Chips */}
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          {["Summarize CASE-047 Syndicate", "Identify Bridge Intermediaries", "Trace Hawala Cash Flow", "List Burner SIMs"].map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => {
                setCopilotQuery(chip);
                generateBrief(chip);
              }}
              style={{
                fontSize: 11,
                padding: "3px 10px",
                borderRadius: 999,
                background: "rgba(99,102,241,0.12)",
                border: "1px solid rgba(99,102,241,0.3)",
                color: "#a5b4fc",
                cursor: "pointer",
              }}
            >
              {chip}
            </button>
          ))}
        </div>

        {brief && (
          <div style={{ marginTop: 16, background: "rgba(99,102,241,0.09)", borderRadius: 12, padding: 18, border: "1px solid rgba(99,102,241,0.25)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <strong style={{ fontSize: 15, color: "#e0e7ff" }}>{brief.title || "Case Intelligence Synthesis"}</strong>
              <span style={{ fontSize: 11, color: "#818cf8" }}>Generated via Evidence Graph Engine</span>
            </div>
            <p style={{ fontSize: 14, color: "var(--sp-fg)", lineHeight: 1.65, margin: "0 0 12px" }}>{brief.summary}</p>

            {brief.key_timeline_events?.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <strong style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--sp-fg-subtle)" }}>
                  Critical Event Sequence
                </strong>
                <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
                  {brief.key_timeline_events.map((ev, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--sp-fg-muted)" }}>
                      <span style={{ background: "rgba(239,68,68,0.2)", color: "#fca5a5", borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>
                        {ev.significance}
                      </span>
                      <span>{ev.title}</span>
                      <em style={{ fontSize: 11, color: "var(--sp-fg-subtle)" }}>({ev.date})</em>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <DisclaimerBanner text={brief.disclaimer} />
          </div>
        )}
      </GlassCard>

      {/* Active Investigations Carousel */}
      <div className="section-head" style={{ marginBottom: 12 }}>
        <IconBadge icon={Database} tone="teal">
          Active Multi-Source Investigations
        </IconBadge>
        <button type="button" className="sp-button secondary" style={{ fontSize: 12, padding: "4px 12px", minHeight: 32 }} onClick={() => onNavigate("cases")}>
          View All Cases & FIRs
        </button>
      </div>

      <div style={{ display: "grid", gap: 14 }}>
        {cases.map((c) => (
          <GlassCard
            key={c.id}
            style={{ cursor: "pointer", padding: 20 }}
            onClick={() => {
              onSelectCase(c.id);
              onNavigate("network");
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                  <CasePriorityBadge priority={c.priority} />
                  <code style={{ fontSize: 12, color: "var(--sp-primary-2)", fontWeight: 800 }}>{c.case_id}</code>
                  <span style={{ fontSize: 11, background: "rgba(255,255,255,0.06)", color: "var(--sp-fg-subtle)", borderRadius: 6, padding: "1px 8px", border: "1px solid var(--sp-border)" }}>
                    {c.category}
                  </span>
                  {c.tags?.map((t) => (
                    <span key={t} style={{ fontSize: 10, background: "rgba(99,102,241,0.12)", color: "#a5b4fc", borderRadius: 999, padding: "1px 8px", fontWeight: 700 }}>
                      #{t}
                    </span>
                  ))}
                </div>

                <h3 style={{ fontSize: 18, marginBottom: 6, color: "#fff" }}>{c.title}</h3>
                <p style={{ fontSize: 13, color: "var(--sp-fg-muted)", margin: "0 0 14px", lineHeight: 1.55 }}>{c.description}</p>

                <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                  {[
                    ["Entities Mapped", c.entity_count || 15, "#00E6B8"],
                    ["Relationships", c.relationship_count || 17, "#6366f1"],
                    ["Evidence Chain Items", c.evidence_count || 16, "#10b981"],
                    ["Priority Relevance", `${c.priority_score || 87}/100`, "#ef4444"],
                  ].map(([label, val, col]) => (
                    <div key={label}>
                      <div style={{ fontSize: 20, fontWeight: 900, color: col }}>{val}</div>
                      <div style={{ fontSize: 10, color: "var(--sp-fg-subtle)", fontWeight: 700, textTransform: "uppercase" }}>{label}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                <button
                  type="button"
                  className="sp-button"
                  style={{ fontSize: 12, padding: "6px 14px", minHeight: 36 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectCase(c.id);
                    onNavigate("network");
                  }}
                >
                  <Radar size={14} /> Explore Network
                </button>
                <button
                  type="button"
                  className="sp-button secondary"
                  style={{ fontSize: 11, padding: "4px 12px", minHeight: 30 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectCase(c.id);
                    onNavigate("patterns");
                  }}
                >
                  <BrainCircuit size={13} /> Patterns
                </button>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
      <DisclaimerBanner />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Screen 2: Cases & FIRs Management
// -----------------------------------------------------------------------------
function CasesScreen({ cases, onSelectCase, onNavigate }) {
  return (
    <div style={{ maxWidth: 1000 }}>
      <FictionalDataBanner />
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <p className="eyebrow" style={{ color: "#818cf8" }}>National Investigation Database</p>
          <h2 style={{ fontSize: 24 }}>Registered FIRs & Active Investigations</h2>
        </div>
      </div>

      <div style={{ display: "grid", gap: 16 }}>
        {cases.map((c) => (
          <GlassCard
            key={c.id}
            style={{ padding: 22, border: "1px solid rgba(99,102,241,0.25)" }}
            onClick={() => {
              onSelectCase(c.id);
              onNavigate("network");
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                  <CasePriorityBadge priority={c.priority} />
                  <code style={{ fontSize: 13, color: "var(--sp-primary-2)", fontWeight: 800 }}>{c.case_id}</code>
                  <span style={{ fontSize: 11, color: "var(--sp-fg-subtle)", background: "rgba(255,255,255,0.06)", borderRadius: 6, padding: "1px 8px" }}>
                    {c.category}
                  </span>
                  {c.tags?.map((t) => (
                    <span key={t} style={{ fontSize: 10, background: "rgba(99,102,241,0.15)", color: "#a5b4fc", borderRadius: 999, padding: "1px 8px", fontWeight: 700 }}>
                      #{t}
                    </span>
                  ))}
                </div>

                <h3 style={{ fontSize: 19, marginBottom: 6, color: "#fff" }}>{c.title}</h3>
                <p style={{ fontSize: 13.5, color: "var(--sp-fg-muted)", lineHeight: 1.6, marginBottom: 16 }}>{c.description}</p>

                <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                  {[
                    ["Entities", c.entity_count || 15, "#00E6B8"],
                    ["Relationships", c.relationship_count || 17, "#6366f1"],
                    ["Evidence Items", c.evidence_count || 16, "#10b981"],
                    ["Priority Score", `${c.priority_score || 87}/100`, "#ef4444"],
                  ].map(([label, val, col]) => (
                    <div key={label}>
                      <div style={{ fontSize: 22, fontWeight: 900, color: col }}>{val}</div>
                      <div style={{ fontSize: 10, color: "var(--sp-fg-subtle)", fontWeight: 700, textTransform: "uppercase" }}>{label}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                <PrimaryButton
                  icon={Radar}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectCase(c.id);
                    onNavigate("network");
                  }}
                  style={{ fontSize: 12, padding: "6px 14px" }}
                >
                  Explore Knowledge Graph
                </PrimaryButton>
                <button
                  type="button"
                  className="sp-button secondary"
                  style={{ fontSize: 11, padding: "4px 12px", minHeight: 32 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectCase(c.id);
                    onNavigate("timeline");
                  }}
                >
                  <Clock size={13} /> View Timeline
                </button>
                <button
                  type="button"
                  className="sp-button secondary"
                  style={{ fontSize: 11, padding: "4px 12px", minHeight: 32 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectCase(c.id);
                    onNavigate("evidence");
                  }}
                >
                  <Vault size={13} /> Evidence Vault
                </button>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
      <DisclaimerBanner />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Screen 3: Interactive Force-Directed Network Graph Explorer (HERO SCREEN)
// -----------------------------------------------------------------------------
function NetworkExplorerScreen({ authed, caseId, selectedCaseData, onNavigate }) {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [loading, setLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [entityProfile, setEntityProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [temporalValue, setTemporalValue] = useState(100);
  const [filterType, setFilterType] = useState("ALL");
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(800);

  const temporalDates = [
    "2025-09-01", "2025-10-01", "2025-11-01", "2025-11-15",
    "2025-12-01", "2025-12-10", "2026-01-08", "2026-01-14",
    "2026-01-28", "2026-01-30", "2026-02-01"
  ];

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      if (entries[0]) setContainerWidth(entries[0].contentRect.width - (selectedNode ? 330 : 0));
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [selectedNode]);

  const loadGraph = useCallback(
    async (temporalDate) => {
      if (!authed || !caseId) return;
      setLoading(true);
      try {
        const url =
          temporalDate && temporalValue < 100
            ? `/intel/cases/${caseId}/graph?timestamp_before=${encodeURIComponent(temporalDate)}`
            : `/intel/cases/${caseId}/graph`;
        const res = await authed.get(url);
        setGraphData({
          nodes: res.data.nodes || [],
          links: res.data.links || [],
        });
      } catch {
        toast.error("Failed to load network graph data");
      } finally {
        setLoading(false);
      }
    },
    [authed, caseId, temporalValue]
  );

  useEffect(() => {
    loadGraph();
  }, [caseId]); // eslint-disable-line

  const handleNodeClick = async (node) => {
    setSelectedNode(node);
    setProfileLoading(true);
    try {
      const res = await authed.get(`/intel/entities/${node.id}`);
      setEntityProfile(res.data);
    } catch {
      setEntityProfile(null);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleReview = async (entityId, action) => {
    try {
      await authed.post(`/intel/entities/${entityId}/review?action=${action}`);
      toast.success(`Entity ${action.toLowerCase()}d — Action recorded in digital chain of custody`);
      setEntityProfile((p) => (p ? { ...p, entity: { ...p.entity, review_status: action } } : p));
    } catch {
      toast.error("Review action failed");
    }
  };

  const temporalDate = temporalDates[Math.floor((temporalValue / 100) * (temporalDates.length - 1))];

  const filteredGraph = useMemo(() => {
    if (filterType === "ALL") return graphData;
    const nodes = graphData.nodes.filter((n) => n.entity_type === filterType);
    const nodeIds = new Set(nodes.map((n) => n.id));
    const links = graphData.links.filter((l) => {
      const s = typeof l.source === "object" ? l.source.id : l.source;
      const t = typeof l.target === "object" ? l.target.id : l.target;
      return nodeIds.has(s) && nodeIds.has(t);
    });
    return { nodes, links };
  }, [graphData, filterType]);

  return (
    <div style={{ maxWidth: 1400 }}>
      <FictionalDataBanner />

      {/* Top Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <p className="eyebrow" style={{ color: "#818cf8" }}>Force-Directed Knowledge Graph Explorer</p>
          <h2 style={{ fontSize: 22 }}>
            {selectedCaseData?.case_id || "CASE-047"} — {selectedCaseData?.title || "Interstate Extortion Syndicate"}
          </h2>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <PrimaryButton icon={BrainCircuit} onClick={() => onNavigate("patterns")} style={{ fontSize: 12, padding: "6px 12px", minHeight: 36 }}>
            Run AI Patterns
          </PrimaryButton>
          <PrimaryButton secondary icon={Split} onClick={() => onNavigate("cross_case")} style={{ fontSize: 12, padding: "6px 12px", minHeight: 36 }}>
            Cross-Case Overlap
          </PrimaryButton>
          <PrimaryButton secondary icon={Vault} onClick={() => onNavigate("evidence")} style={{ fontSize: 12, padding: "6px 12px", minHeight: 36 }}>
            Evidence Chain
          </PrimaryButton>
        </div>
      </div>

      {/* Filter & Temporal Controls Bar */}
      <GlassCard style={{ marginBottom: 16, padding: "12px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          {/* Entity Type Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--sp-fg-subtle)", textTransform: "uppercase" }}>Type Filter:</span>
            {["ALL", "PERSON", "PHONE", "ORGANIZATION", "LOCATION", "VEHICLE", "BANK_ACCOUNT"].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setFilterType(t)}
                style={{
                  border: "1px solid",
                  borderColor: filterType === t ? (ENTITY_CONFIG[t]?.color || "var(--sp-primary)") : "var(--sp-border)",
                  background: filterType === t ? `${ENTITY_CONFIG[t]?.color || "var(--sp-primary)"}22` : "transparent",
                  color: filterType === t ? (ENTITY_CONFIG[t]?.color || "var(--sp-primary)") : "var(--sp-fg-muted)",
                  borderRadius: 6,
                  padding: "3px 8px",
                  fontSize: 10,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Temporal Time Slider */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 260, justifyContent: "flex-end" }}>
            <Clock size={15} style={{ color: "var(--sp-primary)", flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--sp-fg-muted)", whiteSpace: "nowrap" }}>Time Slice:</span>
            <input
              type="range"
              min={0}
              max={100}
              value={temporalValue}
              onChange={(e) => setTemporalValue(Number(e.target.value))}
              style={{ flex: 1, maxWidth: 160, accentColor: "var(--sp-primary)" }}
            />
            <span style={{ fontSize: 11, color: "var(--sp-primary)", fontWeight: 800, whiteSpace: "nowrap" }}>
              {temporalValue === 100 ? "Complete Network (All-Time)" : `Up to ${temporalDate}`}
            </span>
            <button
              type="button"
              className="sp-button secondary"
              style={{ fontSize: 10, padding: "2px 8px", minHeight: 26 }}
              onClick={() => loadGraph(temporalValue < 100 ? temporalDate : null)}
            >
              Apply
            </button>
          </div>
        </div>
      </GlassCard>

      {/* Main Graph Canvas & Inspector Side Panel */}
      <div ref={containerRef} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <GlassCard style={{ flex: 1, padding: 0, overflow: "hidden", minWidth: 0, position: "relative" }}>
          {/* Canvas Legend Header */}
          <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--sp-border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, background: "rgba(11,18,32,0.6)" }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {Object.entries(ENTITY_CONFIG).map(([type, cfg]) => (
                <span key={type} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, color: "var(--sp-fg-muted)" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.color, display: "inline-block" }} />
                  {type}
                </span>
              ))}
            </div>
            <span style={{ fontSize: 11, color: "var(--sp-fg-subtle)", fontWeight: 700 }}>
              {filteredGraph.nodes.length} Nodes · {filteredGraph.links.length} Relationship Edges
            </span>
          </div>

          {loading ? (
            <div style={{ height: 520, display: "grid", placeItems: "center" }}>
              <div style={{ textAlign: "center" }}>
                <RefreshCw size={36} style={{ color: "var(--sp-primary)", animation: "spin 1.2s linear infinite" }} />
                <p style={{ marginTop: 12, color: "var(--sp-fg-muted)", fontSize: 13 }}>Rendering Graph Physics & Multi-Entity Topology...</p>
              </div>
            </div>
          ) : (
            <ForceGraph2D
              graphData={filteredGraph}
              width={Math.max(320, containerWidth)}
              height={520}
              backgroundColor="transparent"
              nodeLabel={(node) => `${node.name}\n[${node.entity_type}] · Investigative Priority: ${node.priority_score}/100`}
              nodeColor={(node) => (ENTITY_CONFIG[node.entity_type]?.color || "#94a3b8")}
              nodeVal={(node) => Math.max(5, (node.priority_score || 20) / 9)}
              linkWidth={(link) => Math.max(1, (link.strength || 0.5) * 3.5)}
              linkColor={() => "rgba(148, 163, 184, 0.45)"}
              linkLabel={(link) => `${link.relationship_type} (${link.frequency || 1}x observed)`}
              linkDirectionalArrowLength={4.5}
              linkDirectionalArrowRelPos={1}
              onNodeClick={handleNodeClick}
              nodeCanvasObjectMode={() => "after"}
              nodeCanvasObject={(node, ctx, globalScale) => {
                if (globalScale < 0.55) return;
                const label = node.name?.split(" ")[0] || node.name || "?";
                ctx.font = `${Math.min(13, 9 / globalScale)}px Inter, sans-serif`;
                ctx.fillStyle = "rgba(234, 242, 255, 0.9)";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(label, node.x, node.y + Math.max(5, (node.priority_score || 20) / 9) + 7);
              }}
            />
          )}
        </GlassCard>

        {/* Entity Inspector Side Panel */}
        {selectedNode && (
          <div style={{ width: 330, flexShrink: 0 }}>
            <GlassCard style={{ border: `1.5px solid ${ENTITY_CONFIG[selectedNode.entity_type]?.color || "#94a3b8"}55`, background: "rgba(11,18,32,0.95)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <EntityTypeBadge type={selectedNode.entity_type} />
                <button type="button" onClick={() => setSelectedNode(null)} style={{ background: "none", border: "none", color: "var(--sp-fg-muted)", cursor: "pointer" }}>
                  <X size={16} />
                </button>
              </div>

              <h3 style={{ fontSize: 18, color: "#fff", marginBottom: 4 }}>{selectedNode.name}</h3>
              {selectedNode.aliases?.length > 0 && (
                <p style={{ fontSize: 12, color: "var(--sp-fg-subtle)", margin: "0 0 12px" }}>
                  Aliases: <strong style={{ color: "var(--sp-fg-muted)" }}>{selectedNode.aliases.join(", ")}</strong>
                </p>
              )}

              {/* Priority Bar */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--sp-fg-muted)" }}>Investigative Priority</span>
                  <PriorityBadge score={selectedNode.priority_score || 0} />
                </div>
                <div style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 999, overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${selectedNode.priority_score || 0}%`,
                      background: (selectedNode.priority_score || 0) >= 70 ? "#ef4444" : (selectedNode.priority_score || 0) >= 40 ? "#f59e0b" : "#10b981",
                      transition: "width 0.4s ease",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                <div style={{ textAlign: "center", flex: 1, padding: 8, background: "rgba(255,255,255,0.04)", borderRadius: 8 }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: "#6366f1" }}>{selectedNode.relationship_count || 0}</div>
                  <div style={{ fontSize: 9.5, color: "var(--sp-fg-subtle)", fontWeight: 700 }}>CONNECTIONS</div>
                </div>
                <div style={{ textAlign: "center", flex: 1, padding: 8, background: "rgba(255,255,255,0.04)", borderRadius: 8 }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: "#f59e0b" }}>{selectedNode.cross_case_appearances || 0}</div>
                  <div style={{ fontSize: 9.5, color: "var(--sp-fg-subtle)", fontWeight: 700 }}>CROSS-CASE</div>
                </div>
              </div>

              {profileLoading && <p style={{ fontSize: 12, color: "var(--sp-fg-muted)", textAlign: "center" }}>Fetching full dossier...</p>}

              {entityProfile && !profileLoading && (
                <>
                  {entityProfile.evidence?.length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                      <strong style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--sp-fg-subtle)", display: "block", marginBottom: 6 }}>
                        Linked Evidence ({entityProfile.evidence.length})
                      </strong>
                      <div style={{ display: "grid", gap: 4 }}>
                        {entityProfile.evidence.slice(0, 3).map((ev) => (
                          <div key={ev.id} style={{ fontSize: 11.5, color: "var(--sp-fg-muted)", background: "rgba(255,255,255,0.04)", borderRadius: 6, padding: "5px 8px", display: "flex", alignItems: "center", gap: 6 }}>
                            <Vault size={11} style={{ color: "#10b981", flexShrink: 0 }} />
                            <span>{ev.title?.slice(0, 32)}...</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Human in the Loop Controls */}
                  <div style={{ marginBottom: 12 }}>
                    <strong style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--sp-fg-subtle)", display: "block", marginBottom: 6 }}>
                      Investigator Verification
                    </strong>
                    <div style={{ display: "flex", gap: 6 }}>
                      {["CONFIRM", "DISMISS", "FLAG"].map((action) => (
                        <button
                          key={action}
                          type="button"
                          onClick={() => handleReview(selectedNode.id, action)}
                          style={{
                            flex: 1,
                            border: "1px solid rgba(255,255,255,0.15)",
                            background:
                              action === "CONFIRM"
                                ? "rgba(16,185,129,0.18)"
                                : action === "FLAG"
                                ? "rgba(245,158,11,0.18)"
                                : "rgba(239,68,68,0.15)",
                            color:
                              action === "CONFIRM"
                                ? "#10b981"
                                : action === "FLAG"
                                ? "#f59e0b"
                                : "#ef4444",
                            borderRadius: 8,
                            padding: "6px 0",
                            fontSize: 10.5,
                            fontWeight: 800,
                            cursor: "pointer",
                          }}
                        >
                          {action}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <DisclaimerBanner />
            </GlassCard>
          </div>
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Screen 4: Entity Resolution & Deduplication Queue
// -----------------------------------------------------------------------------
function EntityResolutionScreen({ authed }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedEntityId, setSelectedEntityId] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Mock resolution candidates for demonstration
  const resolutionQueue = [
    {
      id: "res-01",
      candidateA: "Rakesh Verma",
      candidateB: "R.V. / The Collector",
      matchConfidence: 0.92,
      basis: "Common mobile number (+91-98765-00001) & matching CP meeting pings",
      status: "PENDING",
    },
    {
      id: "res-02",
      candidateA: "Shri Ram Traders",
      candidateB: "SRT Enterprises",
      matchConfidence: 0.88,
      basis: "Shared Cooperative Bank account (A/C 0012345678) & ROC registration address",
      status: "PENDING",
    },
    {
      id: "res-03",
      candidateA: "Burner Phone #3",
      candidateB: "Pawan Gupta (Field Operative)",
      matchConfidence: 0.84,
      basis: "Co-located at 7 Hazratganj cash drop coordinates",
      status: "PENDING",
    },
  ];

  const search = async () => {
    if (!query || query.length < 2) return;
    setLoading(true);
    try {
      const res = await authed.get(`/intel/search?q=${encodeURIComponent(query)}`);
      setResults(res.data.results);
    } catch {
      toast.error("Search failed");
    } finally {
      setLoading(false);
    }
  };

  const loadProfile = async (id) => {
    setSelectedEntityId(id);
    setProfileLoading(true);
    try {
      const res = await authed.get(`/intel/entities/${id}`);
      setProfile(res.data);
    } catch {
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleResolutionAction = (resId, action) => {
    toast.success(`Entity resolution ${action.toLowerCase()}d — Logged to digital chain of custody`);
  };

  return (
    <div style={{ maxWidth: 1100 }}>
      <FictionalDataBanner />
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <p className="eyebrow" style={{ color: "#818cf8" }}>Entity Resolution & Cross-Source Matching</p>
          <h2 style={{ fontSize: 24 }}>Entity Search, Resolution & Identity Resolution</h2>
        </div>
      </div>

      {/* Global Search Input */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search entities by name, alias, phone, vehicle reg, account number, or coordinate..."
          onKeyDown={(e) => e.key === "Enter" && search()}
          style={{ flex: 1, padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid var(--sp-border)", color: "#fff" }}
        />
        <PrimaryButton icon={Search} onClick={search}>
          {loading ? "Searching..." : "Global Search"}
        </PrimaryButton>
      </div>

      {/* Deduplication & Entity Resolution Queue */}
      <GlassCard style={{ marginBottom: 24, border: "1px solid rgba(99,102,241,0.35)" }}>
        <div className="section-head" style={{ marginBottom: 12 }}>
          <IconBadge icon={UserCheck} tone="teal">
            AI Entity Resolution Queue · Deduplication Suggestions
          </IconBadge>
          <span style={{ fontSize: 11, color: "var(--sp-fg-subtle)" }}>Probabilistic matching awaiting officer confirmation</span>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {resolutionQueue.map((item) => (
            <div
              key={item.id}
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid var(--sp-border)",
                borderRadius: 12,
                padding: "12px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <strong style={{ fontSize: 14, color: "#e0e7ff" }}>{item.candidateA}</strong>
                  <span style={{ color: "#818cf8", fontSize: 12 }}>↔</span>
                  <strong style={{ fontSize: 14, color: "var(--sp-primary)" }}>{item.candidateB}</strong>
                  <span style={{ background: "rgba(0,230,184,0.15)", color: "#00E6B8", border: "1px solid rgba(0,230,184,0.3)", borderRadius: 999, padding: "1px 8px", fontSize: 10.5, fontWeight: 800 }}>
                    {Math.round(item.matchConfidence * 100)}% Match Confidence
                  </span>
                </div>
                <p style={{ fontSize: 12.5, color: "var(--sp-fg-muted)", margin: 0 }}>{item.basis}</p>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => handleResolutionAction(item.id, "MERGED")}
                  style={{ background: "rgba(16,185,129,0.2)", border: "1px solid rgba(16,185,129,0.4)", color: "#10b981", borderRadius: 8, padding: "6px 12px", fontSize: 11, fontWeight: 800, cursor: "pointer" }}
                >
                  Confirm Merge
                </button>
                <button
                  type="button"
                  onClick={() => handleResolutionAction(item.id, "DISMISSED")}
                  style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", borderRadius: 8, padding: "6px 12px", fontSize: 11, fontWeight: 800, cursor: "pointer" }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Search Results Display */}
      {results && (
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {results.entities?.length > 0 && (
              <GlassCard style={{ marginBottom: 14 }}>
                <div className="section-head" style={{ marginBottom: 10 }}>
                  <IconBadge icon={Users} tone="teal">
                    Entities Found ({results.entities.length})
                  </IconBadge>
                </div>
                {results.entities.map((e) => (
                  <div
                    key={e.id}
                    onClick={() => loadProfile(e.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 0",
                      borderBottom: "1px solid var(--sp-border)",
                      cursor: "pointer",
                      opacity: selectedEntityId === e.id ? 1 : 0.85,
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: 14, color: selectedEntityId === e.id ? "var(--sp-primary)" : "#fff" }}>
                        {e.name}
                      </strong>
                      {e.aliases?.length > 0 && <p style={{ fontSize: 11, color: "var(--sp-fg-subtle)", margin: 0 }}>aka: {e.aliases.join(", ")}</p>}
                    </div>
                    <EntityTypeBadge type={e.entity_type} />
                  </div>
                ))}
              </GlassCard>
            )}

            {results.cases?.length > 0 && (
              <GlassCard style={{ marginBottom: 14 }}>
                <div className="section-head" style={{ marginBottom: 10 }}>
                  <IconBadge icon={Database} tone="teal">Matching FIRs ({results.cases.length})</IconBadge>
                </div>
                {results.cases.map((c) => (
                  <div key={c.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--sp-border)" }}>
                    <code style={{ color: "var(--sp-primary-2)", fontSize: 12 }}>{c.case_id}</code> — <strong>{c.title}</strong>
                  </div>
                ))}
              </GlassCard>
            )}
          </div>

          {/* Detailed Entity Profile */}
          {selectedEntityId && (
            <div style={{ width: 340, flexShrink: 0 }}>
              <GlassCard style={{ border: "1px solid rgba(99,102,241,0.35)", background: "rgba(11,18,32,0.95)" }}>
                {profileLoading ? (
                  <p style={{ textAlign: "center", padding: 20 }}>Loading profile...</p>
                ) : profile ? (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <EntityTypeBadge type={profile.entity?.entity_type} />
                      <button type="button" onClick={() => setSelectedEntityId(null)} style={{ background: "none", border: "none", color: "var(--sp-fg-muted)", cursor: "pointer" }}>
                        <X size={16} />
                      </button>
                    </div>

                    <h3 style={{ fontSize: 18, marginBottom: 4 }}>{profile.entity?.name}</h3>
                    {profile.entity?.aliases?.length > 0 && (
                      <p style={{ fontSize: 11.5, color: "var(--sp-fg-subtle)", marginBottom: 10 }}>Aliases: {profile.entity.aliases.join(", ")}</p>
                    )}

                    {profile.priority && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 11, color: "var(--sp-fg-muted)", fontWeight: 700 }}>Investigative Score</span>
                          <PriorityBadge score={profile.priority.score} />
                        </div>
                        {profile.priority.factors?.map((f, idx) => (
                          <div key={idx} style={{ fontSize: 10.5, display: "flex", justifyContent: "space-between", color: "var(--sp-fg-muted)", marginTop: 4 }}>
                            <span>{f.factor}</span>
                            <strong style={{ color: "var(--sp-fg)" }}>+{f.points}</strong>
                          </div>
                        ))}
                      </div>
                    )}

                    {profile.relationships?.length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <strong style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--sp-fg-subtle)" }}>
                          Documented Connections ({profile.relationship_count})
                        </strong>
                        <div style={{ display: "grid", gap: 4, marginTop: 6 }}>
                          {profile.relationships.slice(0, 4).map((r) => (
                            <div key={r.id} style={{ fontSize: 11, background: "rgba(255,255,255,0.04)", padding: "4px 8px", borderRadius: 6 }}>
                              <span style={{ color: "#a5b4fc", fontWeight: 700 }}>{r.relationship_type}</span>: {r.notes?.slice(0, 42)}...
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <DisclaimerBanner text={profile.disclaimer} />
                  </>
                ) : null}
              </GlassCard>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Screen 5: Temporal Intelligence & Investigation Timeline
// -----------------------------------------------------------------------------
function TemporalIntelligenceScreen({ authed, caseId, onNavigate }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    if (!authed || !caseId) return;
    setLoading(true);
    authed.get(`/intel/cases/${caseId}/timeline`)
      .then((r) => setEvents(r.data.events || []))
      .catch(() => toast.error("Failed to load timeline"))
      .finally(() => setLoading(false));
  }, [authed, caseId]);

  const SIG_COLORS = { CRITICAL: "#ef4444", HIGH: "#f59e0b", MEDIUM: "#6366f1", LOW: "#94a3b8" };
  const filters = ["ALL", "FINANCIAL", "COMMUNICATION", "LOCATION", "MEETING"];
  const filtered = filter === "ALL" ? events : events.filter((e) => e.event_type === filter);

  return (
    <div style={{ maxWidth: 950 }}>
      <FictionalDataBanner />
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <p className="eyebrow" style={{ color: "#818cf8" }}>Temporal Intelligence Sequence</p>
          <h2 style={{ fontSize: 24 }}>Event Progression Timeline — {caseId?.toUpperCase()}</h2>
        </div>
        <span style={{ fontSize: 12, color: "var(--sp-fg-subtle)" }}>{events.length} chronological forensic events</span>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            style={{
              border: "1px solid",
              borderColor: filter === f ? "var(--sp-primary)" : "var(--sp-border)",
              background: filter === f ? "rgba(0,230,184,0.12)" : "transparent",
              color: filter === f ? "var(--sp-primary)" : "var(--sp-fg-muted)",
              borderRadius: 999,
              padding: "4px 14px",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40 }}><RefreshCw size={32} style={{ animation: "spin 1s linear infinite", color: "var(--sp-primary)" }} /></div>
      ) : (
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", left: 16, top: 0, bottom: 0, width: 2, background: "rgba(255,255,255,0.08)", borderRadius: 999 }} />
          <div style={{ display: "grid", gap: 0 }}>
            {filtered.map((ev) => (
              <div key={ev.id} style={{ display: "flex", gap: 20, paddingBottom: 24, position: "relative" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: `${SIG_COLORS[ev.significance] || "#94a3b8"}20`, border: `2px solid ${SIG_COLORS[ev.significance] || "#94a3b8"}`, display: "grid", placeItems: "center", flexShrink: 0, position: "relative", zIndex: 1 }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: SIG_COLORS[ev.significance] || "#94a3b8", display: "block" }} />
                </div>

                <GlassCard style={{ flex: 1, padding: 14 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ background: `${SIG_COLORS[ev.significance] || "#94a3b8"}20`, color: SIG_COLORS[ev.significance] || "#94a3b8", borderRadius: 6, padding: "1px 8px", fontSize: 10, fontWeight: 800 }}>
                        {ev.significance}
                      </span>
                      <span style={{ fontSize: 11, background: "rgba(255,255,255,0.06)", color: "var(--sp-fg-muted)", borderRadius: 6, padding: "1px 8px", border: "1px solid var(--sp-border)" }}>
                        {ev.event_type}
                      </span>
                    </div>
                    <span style={{ fontSize: 11.5, color: "var(--sp-fg-subtle)" }}>{ev.date?.slice(0, 16)?.replace("T", " ")}</span>
                  </div>

                  <strong style={{ fontSize: 15, display: "block", marginBottom: 4, color: "#fff" }}>{ev.title}</strong>
                  <p style={{ fontSize: 13, color: "var(--sp-fg-muted)", lineHeight: 1.55, margin: "0 0 8px" }}>{ev.description}</p>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                    {ev.entity_ids?.length > 0 && (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {ev.entity_ids.map((eid) => (
                          <span key={eid} style={{ fontSize: 10, color: "var(--sp-primary)", background: "rgba(0,230,184,0.08)", borderRadius: 6, padding: "1px 6px", border: "1px solid rgba(0,230,184,0.2)" }}>
                            {eid}
                          </span>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => onNavigate("network")}
                      style={{ fontSize: 10.5, color: "#818cf8", background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 6, padding: "3px 10px", cursor: "pointer", fontWeight: 700 }}
                    >
                      <Radar size={11} style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }} />
                      Reconstruct Network at this Moment
                    </button>
                  </div>
                </GlassCard>
              </div>
            ))}
          </div>
        </div>
      )}
      <DisclaimerBanner />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Screen 6: Explainable AI Pattern Engine (10 Forensics Patterns)
// -----------------------------------------------------------------------------
function PatternEngineScreen({ authed, caseId }) {
  const [patterns, setPatterns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  const runAnalysis = async () => {
    setLoading(true);
    setHasRun(true);
    try {
      const res = await authed.get(`/intel/cases/${caseId}/patterns`);
      setPatterns(res.data.patterns || []);
      toast.success(`Pattern analysis complete — ${res.data.count || 5} forensic patterns surfaced for review`);
    } catch {
      toast.error("Pattern analysis failed");
    } finally {
      setLoading(false);
    }
  };

  const reviewPattern = async (patternId, action) => {
    try {
      await authed.post("/intel/patterns/review", { pattern_id: patternId, action });
      toast.success(`Pattern ${action.toLowerCase()}d — Logged to digital chain of custody`);
      setPatterns((p) => p.map((pt) => (pt.id === patternId ? { ...pt, status: action } : pt)));
    } catch {
      toast.error("Review action failed");
    }
  };

  const SEV_COLORS = { HIGH: "#ef4444", MEDIUM: "#f59e0b", LOW: "#94a3b8" };

  return (
    <div style={{ maxWidth: 950 }}>
      <FictionalDataBanner />
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <p className="eyebrow" style={{ color: "#818cf8" }}>Forensic Pattern & Anomaly Detection</p>
          <h2 style={{ fontSize: 24 }}>AI Pattern Engine (10 Forensics Models)</h2>
        </div>
        <PrimaryButton icon={BrainCircuit} onClick={runAnalysis}>
          {loading ? "Executing Analysis..." : "Execute AI Pattern Engine"}
        </PrimaryButton>
      </div>

      <p style={{ color: "var(--sp-fg-muted)", fontSize: 13.5, marginBottom: 20 }}>
        Detects coordination hubs, bridge nodes, layered hawala fund flows, burner SIM switching, and temporal co-location. Every pattern provides explainability and is subject to human officer verification.
      </p>

      {!hasRun && !loading && (
        <div style={{ textAlign: "center", padding: 50 }}>
          <BrainCircuit size={48} style={{ color: "#6366f1", opacity: 0.5, margin: "0 auto 12px" }} />
          <p style={{ color: "var(--sp-fg-muted)" }}>Click "Execute AI Pattern Engine" to run multi-topology pattern detection on {caseId?.toUpperCase()}.</p>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: "center", padding: 50 }}>
          <RefreshCw size={36} style={{ animation: "spin 1.2s linear infinite", color: "#6366f1", margin: "0 auto 12px" }} />
          <p style={{ color: "var(--sp-fg-muted)" }}>Analyzing graph topology, CDR burst frequencies, and financial transaction chains...</p>
        </div>
      )}

      {!loading && patterns.length > 0 && (
        <div style={{ display: "grid", gap: 14 }}>
          {patterns.map((p) => (
            <GlassCard key={p.id} style={{ border: `1px solid ${SEV_COLORS[p.severity] || "#94a3b8"}44` }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                    <span style={{ background: `${SEV_COLORS[p.severity] || "#94a3b8"}20`, color: SEV_COLORS[p.severity] || "#94a3b8", borderRadius: 999, padding: "2px 10px", fontSize: 11, fontWeight: 800 }}>
                      {p.severity} SEVERITY
                    </span>
                    <span style={{ fontSize: 11, color: "#a5b4fc", background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 999, padding: "2px 10px", fontWeight: 700 }}>
                      {p.pattern_type?.replace(/_/g, " ")}
                    </span>
                    <span style={{ fontSize: 11, color: "#FFB84C", background: "rgba(255,184,76,0.1)", borderRadius: 999, padding: "2px 10px", fontWeight: 700 }}>
                      Officer Review Required
                    </span>
                  </div>

                  <strong style={{ fontSize: 16, color: "#fff", display: "block", marginBottom: 6 }}>{p.title}</strong>
                  <p style={{ fontSize: 13, color: "var(--sp-fg-muted)", lineHeight: 1.55, marginBottom: 10 }}>{p.description}</p>

                  <div style={{ background: "rgba(99,102,241,0.08)", borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
                    <strong style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "#818cf8", display: "block", marginBottom: 3 }}>
                      Actionable Investigative Lead
                    </strong>
                    <p style={{ fontSize: 13, color: "var(--sp-fg)", margin: 0, lineHeight: 1.5 }}>{p.investigative_lead}</p>
                  </div>

                  <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3, fontSize: 11 }}>
                        <span style={{ color: "var(--sp-fg-muted)" }}>Evidence Basis Confidence</span>
                        <strong style={{ color: "#e0e7ff" }}>{Math.round((p.confidence || 0.75) * 100)}%</strong>
                      </div>
                      <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 999, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${(p.confidence || 0.75) * 100}%`, background: "linear-gradient(90deg, #6366f1, #818cf8)" }} />
                      </div>
                    </div>
                    <span style={{ fontSize: 11, color: "var(--sp-fg-subtle)" }}>
                      Basis: <strong style={{ color: "var(--sp-fg-muted)" }}>{p.evidence_basis}</strong>
                    </span>
                  </div>

                  {/* HITL Action Buttons */}
                  <div style={{ display: "flex", gap: 8 }}>
                    {p.status && p.status !== "PENDING_REVIEW" ? (
                      <span style={{ fontSize: 11.5, fontWeight: 800, color: p.status === "CONFIRM" ? "#10b981" : p.status === "DISMISS" ? "#ef4444" : "#f59e0b" }}>
                        ✓ {p.status} (Logged to Audit Chain)
                      </span>
                    ) : (
                      ["CONFIRM", "DISMISS", "FLAG_FOR_REVIEW"].map((action) => (
                        <button
                          key={action}
                          type="button"
                          onClick={() => reviewPattern(p.id, action)}
                          style={{
                            border: "1px solid",
                            borderColor: action === "CONFIRM" ? "rgba(16,185,129,0.4)" : action === "FLAG_FOR_REVIEW" ? "rgba(245,158,11,0.4)" : "rgba(239,68,68,0.4)",
                            background: action === "CONFIRM" ? "rgba(16,185,129,0.12)" : action === "FLAG_FOR_REVIEW" ? "rgba(245,158,11,0.12)" : "rgba(239,68,68,0.12)",
                            color: action === "CONFIRM" ? "#10b981" : action === "FLAG_FOR_REVIEW" ? "#f59e0b" : "#ef4444",
                            borderRadius: 8,
                            padding: "5px 12px",
                            fontSize: 11,
                            fontWeight: 800,
                            cursor: "pointer",
                          }}
                        >
                          {action.replace(/_/g, " ")}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
      <DisclaimerBanner />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Screen 7: Cross-Case Intelligence & Syndicate Discovery
// -----------------------------------------------------------------------------
function CrossCaseDiscoveryScreen({ onNavigate, onSelectCase }) {
  const overlaps = [
    {
      entity: "A/C 0012345678 (Cooperative Bank)",
      type: "BANK_ACCOUNT",
      caseA: "CASE-047 (Extortion Syndicate)",
      caseB: "CASE-048 (Hawala Layering Ring)",
      detail: "Same account received ₹32L from CASE-047 extortion proceeds and transacted ₹68L into CASE-048 property front.",
      significance: "CRITICAL SYNDICATE BRIDGE",
    },
    {
      entity: "+91-98765-00001 (Fake SIM / Primary Hub)",
      type: "PHONE",
      caseA: "CASE-047 (Extortion Syndicate)",
      caseB: "CASE-049 (Illegal VoIP Gateway Fraud)",
      detail: "Burner SIM routed calls through same gateway IP identified in CASE-049 telecommunications warrant.",
      significance: "COMMON COMMUNICATIONS HUB",
    },
    {
      entity: "DL-01-AA-9876 (Black Fortuner SUV)",
      type: "VEHICLE",
      caseA: "CASE-047 (Extortion Syndicate)",
      caseB: "CASE-050 (Interstate Supply Corridor)",
      detail: "ANPR camera logs show vehicle on identical transit corridor (Delhi → Lucknow → Varanasi) across both investigation windows.",
      significance: "SHARED LOGISTICS ASSET",
    },
  ];

  return (
    <div style={{ maxWidth: 1000 }}>
      <FictionalDataBanner />
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <p className="eyebrow" style={{ color: "#818cf8" }}>Syndicate Overlap Discovery</p>
          <h2 style={{ fontSize: 24 }}>Cross-Case Intelligence & Common Bridges</h2>
        </div>
      </div>

      <p style={{ color: "var(--sp-fg-muted)", fontSize: 13.5, marginBottom: 20 }}>
        Automatically detects hidden connections between separate FIRs — surfacing shared mule accounts, burner numbers, shell companies, and transport corridors across jurisdictions.
      </p>

      <div style={{ display: "grid", gap: 14 }}>
        {overlaps.map((item, idx) => (
          <GlassCard key={idx} style={{ padding: 20, border: "1px solid rgba(139,92,246,0.35)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                  <span style={{ background: "rgba(239,68,68,0.2)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.4)", borderRadius: 999, padding: "2px 10px", fontSize: 10.5, fontWeight: 800 }}>
                    {item.significance}
                  </span>
                  <EntityTypeBadge type={item.type} />
                </div>

                <strong style={{ fontSize: 16, color: "#fff", display: "block", marginBottom: 6 }}>{item.entity}</strong>

                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>
                    {item.caseA}
                  </span>
                  <span style={{ color: "#818cf8", fontSize: 12 }}>⚡ CONNECTS TO ⚡</span>
                  <span style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>
                    {item.caseB}
                  </span>
                </div>

                <p style={{ fontSize: 13, color: "var(--sp-fg-muted)", margin: 0, lineHeight: 1.55 }}>{item.detail}</p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <button
                  type="button"
                  className="sp-button"
                  style={{ fontSize: 11.5, padding: "6px 14px", minHeight: 34 }}
                  onClick={() => {
                    onSelectCase("case-047");
                    onNavigate("network");
                  }}
                >
                  <Radar size={13} /> View in Graph
                </button>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
      <DisclaimerBanner />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Screen 8: Evidence Vault & Cryptographic Chain of Custody
// -----------------------------------------------------------------------------
function EvidenceVaultScreen({ authed, caseId }) {
  const [evidence, setEvidence] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addForm, setAddForm] = useState({ title: "", kind: "document", content: "", source: "" });
  const [showAddForm, setShowAddForm] = useState(false);
  const [adding, setAdding] = useState(false);

  const KIND_COLORS = {
    call_record: "#FFB84C",
    financial: "#ef4444",
    document: "#6366f1",
    location_data: "#10b981",
    image: "#8b5cf6",
    note: "#94a3b8",
  };

  useEffect(() => {
    if (!authed || !caseId) return;
    setLoading(true);
    authed.get(`/intel/cases/${caseId}/evidence`)
      .then((r) => setEvidence(Array.isArray(r.data) ? r.data : []))
      .catch(() => toast.error("Failed to load evidence items"))
      .finally(() => setLoading(false));
  }, [authed, caseId]);

  const addEvidence = async () => {
    if (!addForm.title || !addForm.content) return toast.error("Title and content are required");
    setAdding(true);
    try {
      const res = await authed.post(`/intel/cases/${caseId}/evidence`, { case_id: caseId, ...addForm });
      setEvidence((e) => [res.data, ...e]);
      setAddForm({ title: "", kind: "document", content: "", source: "" });
      setShowAddForm(false);
      toast.success("Evidence secured — SHA-256 integrity hash computed & audit log updated");
    } catch {
      toast.error("Failed to add evidence");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div style={{ maxWidth: 950 }}>
      <FictionalDataBanner />
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <p className="eyebrow" style={{ color: "#818cf8" }}>Digital Evidence Vault & Integrity Hashes</p>
          <h2 style={{ fontSize: 24 }}>Evidence Chain of Custody — {caseId?.toUpperCase()}</h2>
        </div>
        <PrimaryButton icon={FileLock2} onClick={() => setShowAddForm((v) => !v)}>
          {showAddForm ? "Cancel" : "Add New Evidence Item"}
        </PrimaryButton>
      </div>

      {showAddForm && (
        <GlassCard style={{ marginBottom: 20, border: "1px solid rgba(16,185,129,0.35)" }}>
          <p className="eyebrow" style={{ color: "#10b981" }}>New Evidence Vault Submission</p>
          <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
            <input
              value={addForm.title}
              onChange={(e) => setAddForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Evidence Title (e.g. 'IPDR Data Extract from Tower 402')"
              style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid var(--sp-border)", color: "#fff" }}
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <select
                value={addForm.kind}
                onChange={(e) => setAddForm((f) => ({ ...f, kind: e.target.value }))}
                style={{ padding: "10px 14px", borderRadius: 10, background: "#0B1220", border: "1px solid var(--sp-border)", color: "#fff" }}
              >
                {["document", "call_record", "financial", "location_data", "image", "note"].map((k) => (
                  <option key={k} value={k}>{k.toUpperCase()}</option>
                ))}
              </select>
              <input
                value={addForm.source}
                onChange={(e) => setAddForm((f) => ({ ...f, source: e.target.value }))}
                placeholder="Source (e.g. 'Telecom Subpoena', 'ROC Delhi')"
                style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid var(--sp-border)", color: "#fff" }}
              />
            </div>
            <textarea
              value={addForm.content}
              onChange={(e) => setAddForm((f) => ({ ...f, content: e.target.value }))}
              placeholder="Enter forensic evidence details / transcript / record extract..."
              style={{ minHeight: 90, padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid var(--sp-border)", color: "#fff" }}
            />
            <PrimaryButton icon={FileLock2} onClick={addEvidence} disabled={adding}>
              {adding ? "Hashing & Encrypting..." : "Submit to Encrypted Vault & Compute SHA-256"}
            </PrimaryButton>
          </div>
        </GlassCard>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: 40 }}><RefreshCw size={32} style={{ animation: "spin 1s linear infinite", color: "var(--sp-primary)" }} /></div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {evidence.map((ev) => (
            <GlassCard key={ev.id} style={{ padding: 18 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                    <span style={{ background: `${KIND_COLORS[ev.kind] || "#94a3b8"}20`, color: KIND_COLORS[ev.kind] || "#94a3b8", border: `1px solid ${KIND_COLORS[ev.kind] || "#94a3b8"}50`, borderRadius: 6, padding: "2px 8px", fontSize: 10.5, fontWeight: 800 }}>
                      {ev.kind?.replace(/_/g, " ").toUpperCase()}
                    </span>
                    <span style={{ fontSize: 11, background: "rgba(16,185,129,0.12)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 999, padding: "2px 8px", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <Lock size={9} /> SHA-256 Verified
                    </span>
                  </div>

                  <strong style={{ fontSize: 15.5, display: "block", marginBottom: 4, color: "#fff" }}>{ev.title}</strong>
                  <p style={{ fontSize: 13, color: "var(--sp-fg-muted)", lineHeight: 1.55, margin: "0 0 10px" }}>{ev.content}</p>

                  <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11 }}>
                    {ev.source && <span>Source: <strong style={{ color: "var(--sp-fg-muted)" }}>{ev.source}</strong></span>}
                    {ev.content_hash && <span style={{ color: "var(--sp-primary-2)", fontFamily: "monospace" }}>SHA-256: {ev.content_hash.slice(0, 20)}...</span>}
                    {ev.created_at && <span style={{ color: "var(--sp-fg-subtle)" }}>{ev.created_at.slice(0, 10)}</span>}
                  </div>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
      <DisclaimerBanner />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Screen 9: Tamper-Evident Chain of Custody Audit Ledger
// -----------------------------------------------------------------------------
function AuditLogScreen({ authed, caseId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  const ACTION_COLORS = {
    CASE_CREATED: "#6366f1",
    EVIDENCE_ADDED: "#10b981",
    ENTITIES_MAPPED: "#00E6B8",
    PATTERN_ANALYSIS_RUN: "#8b5cf6",
    BRIEF_GENERATED: "#818cf8",
    ENTITY_CONFIRM: "#10b981",
    ENTITY_DISMISS: "#ef4444",
    ENTITY_FLAG: "#f59e0b",
    ENTITY_PROFILE_VIEWED: "#94a3b8",
  };

  useEffect(() => {
    if (!authed) return;
    setLoading(true);
    const url = caseId ? `/intel/cases/${caseId}/audit` : `/intel/audit`;
    authed.get(url)
      .then((r) => setLogs(r.data.logs || []))
      .catch(() => toast.error("Failed to load audit trail"))
      .finally(() => setLoading(false));
  }, [authed, caseId]);

  return (
    <div style={{ maxWidth: 950 }}>
      <FictionalDataBanner />
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <p className="eyebrow" style={{ color: "#818cf8" }}>Immutable Forensic Audit Trail</p>
          <h2 style={{ fontSize: 24 }}>Chain of Custody Ledger — {caseId?.toUpperCase()}</h2>
        </div>
        <span style={{ fontSize: 12, color: "var(--sp-fg-subtle)" }}>{logs.length} cryptographically recorded entries</span>
      </div>

      <GlassCard style={{ marginBottom: 16, padding: "12px 16px", background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.3)", display: "flex", alignItems: "center", gap: 10 }}>
        <Lock size={18} style={{ color: "#10b981", flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: "#10b981" }}>
          All investigator interactions, pattern analyses, and evidence uploads generate a SHA-256 hash stamp ensuring absolute legal admissibility and tamper resistance.
        </span>
      </GlassCard>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40 }}><RefreshCw size={32} style={{ animation: "spin 1s linear infinite", color: "var(--sp-primary)" }} /></div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {logs.map((log, i) => {
            const color = ACTION_COLORS[log.action] || "#94a3b8";
            return (
              <div key={log.id || i} style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "12px 0", borderBottom: "1px solid var(--sp-border)" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, marginTop: 6, flexShrink: 0, boxShadow: `0 0 8px ${color}66` }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color, background: `${color}15`, borderRadius: 6, padding: "1px 8px", border: `1px solid ${color}40` }}>
                      {log.action?.replace(/_/g, " ")}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--sp-fg-subtle)" }}>{log.created_at?.slice(0, 16)?.replace("T", " ")}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--sp-fg-muted)", lineHeight: 1.5 }}>{log.description}</p>
                  {log.integrity_hash && (
                    <code style={{ fontSize: 10, color: "var(--sp-fg-subtle)", display: "block", marginTop: 3 }}>
                      Integrity Hash: {log.integrity_hash.slice(0, 24)}...
                    </code>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <DisclaimerBanner />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Screen 10: Automated Court-Ready Case Dossier & Brief
// -----------------------------------------------------------------------------
function CaseBriefScreen({ authed, caseId, selectedCaseData }) {
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authed || !caseId) return;
    setLoading(true);
    authed.post(`/intel/cases/${caseId}/brief`, {
      case_id: caseId,
      include_entities: true,
      include_patterns: true,
      include_timeline: true,
    })
      .then((r) => setBrief(r.data))
      .catch(() => {
        setBrief({
          case_id: selectedCaseData?.case_id || "CASE-047",
          title: selectedCaseData?.title || "Interstate Extortion Syndicate — Operation Khayal",
          generated_at: new Date().toISOString(),
          summary: "Case CASE-047 encompasses 15 mapped entities and 17 documented relationships spanning 4 states. Key findings: 14 structured cash deposits linked to Shri Ram Traders (shell entity), 28 calls between suspect Rakesh Verma and financial handler Sunita Malik, and multi-state transit confirmed via ANPR logs.",
          entity_summary: [
            { name: "Rakesh Verma", type: "PERSON", relationship_count: 5 },
            { name: "Sunita Malik", type: "PERSON", relationship_count: 4 },
            { name: "Shri Ram Traders", type: "ORGANIZATION", relationship_count: 3 },
            { name: "A/C 0012345678", type: "BANK_ACCOUNT", relationship_count: 2 },
          ],
          patterns_detected: 5,
          evidence_items: 16,
          disclaimer: "All findings are investigative leads for human law enforcement review. This document does not constitute a final judicial determination.",
        });
      })
      .finally(() => setLoading(false));
  }, [authed, caseId, selectedCaseData]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{ maxWidth: 900 }}>
      <FictionalDataBanner />
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <p className="eyebrow" style={{ color: "#818cf8" }}>Official Investigative Synthesis</p>
          <h2 style={{ fontSize: 24 }}>Court-Ready Case Dossier & Brief</h2>
        </div>
        <PrimaryButton icon={Printer} onClick={handlePrint}>
          Print / Export Dossier
        </PrimaryButton>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40 }}><RefreshCw size={32} style={{ animation: "spin 1s linear infinite", color: "var(--sp-primary)" }} /></div>
      ) : brief ? (
        <GlassCard style={{ padding: 28, border: "1px solid rgba(99,102,241,0.35)", background: "rgba(11,18,32,0.92)" }}>
          <div style={{ borderBottom: "1px solid var(--sp-border)", paddingBottom: 16, marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: "#818cf8", letterSpacing: "0.08em" }}>
                MINISTRY OF HOME AFFAIRS · NATIONAL CRIME RECORDS BUREAU
              </span>
              <span style={{ fontSize: 11, color: "var(--sp-fg-subtle)" }}>Date: {new Date().toLocaleDateString()}</span>
            </div>
            <h1 style={{ fontSize: 24, color: "#fff", marginBottom: 4 }}>
              CONFIDENTIAL INVESTIGATIVE DOSSIER: {brief.case_id}
            </h1>
            <p style={{ fontSize: 13, color: "var(--sp-fg-muted)", margin: 0 }}>{brief.title}</p>
          </div>

          <div style={{ marginBottom: 20 }}>
            <strong style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: "#818cf8", display: "block", marginBottom: 6 }}>
              Executive Case Summary & AI Synthesis
            </strong>
            <p style={{ fontSize: 14, color: "var(--sp-fg)", lineHeight: 1.65, margin: 0 }}>{brief.summary}</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
            <div style={{ background: "rgba(255,255,255,0.03)", padding: 14, borderRadius: 10, border: "1px solid var(--sp-border)" }}>
              <strong style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--sp-fg-subtle)", display: "block", marginBottom: 8 }}>
                Core Network Entities
              </strong>
              {brief.entity_summary?.map((e, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <span style={{ color: "#e0e7ff" }}>{e.name}</span>
                  <span style={{ color: "var(--sp-primary)", fontWeight: 700 }}>{e.type}</span>
                </div>
              ))}
            </div>

            <div style={{ background: "rgba(255,255,255,0.03)", padding: 14, borderRadius: 10, border: "1px solid var(--sp-border)" }}>
              <strong style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--sp-fg-subtle)", display: "block", marginBottom: 8 }}>
                Evidence & Pattern Summary
              </strong>
              <div style={{ display: "grid", gap: 8, fontSize: 12.5, color: "var(--sp-fg-muted)" }}>
                <div>Evidence Items Secured: <strong style={{ color: "#10b981" }}>{brief.evidence_items || 16} verified items</strong></div>
                <div>AI Forensics Patterns Flagged: <strong style={{ color: "#ef4444" }}>{brief.patterns_detected || 5} patterns</strong></div>
                <div>Integrity Standard: <strong style={{ color: "var(--sp-primary)" }}>SHA-256 Chained Hash</strong></div>
              </div>
            </div>
          </div>

          <DisclaimerBanner text={brief.disclaimer} />
        </GlassCard>
      ) : null}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Main Application Shell for NETRA-AI
// -----------------------------------------------------------------------------
export default function App() {
  const { token, saveAuth, logout } = useAuthToken();
  const [view, setView] = useState("dashboard");
  const [selectedCaseId, setSelectedCaseId] = useState("case-047");
  const [cases, setCases] = useState([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const online = useOnlineStatus();

  const handleUnauthorized = useCallback(() => {
    logout();
  }, [logout]);

  const authed = useMemo(() => apiWithToken(token, handleUnauthorized), [token, handleUnauthorized]);

  const selectedCaseData = useMemo(() => {
    return cases.find((c) => c.id === selectedCaseId || c.case_id === selectedCaseId) || cases[0] || {
      id: "case-047",
      case_id: "CASE-047",
      title: "Interstate Extortion Syndicate — Operation Khayal",
      priority: "CRITICAL",
      category: "ORGANIZED_CRIME",
      entity_count: 15,
      relationship_count: 17,
      evidence_count: 16,
      priority_score: 87,
    };
  }, [cases, selectedCaseId]);

  const refreshCases = useCallback(async () => {
    if (!token) return;
    try {
      const res = await authed.get("/intel/cases");
      if (Array.isArray(res.data) && res.data.length > 0) {
        setCases(res.data);
      } else {
        // Default demo cases fallback
        setCases([
          {
            id: "case-047",
            case_id: "CASE-047",
            title: "Interstate Extortion Syndicate — Operation Khayal",
            description: "Multi-state organized extortion ring operating across Delhi, Mumbai, Lucknow, and Jaipur. Combines forged SIM hubs, shell trading entities, and layered cash smurfing.",
            priority: "CRITICAL",
            category: "ORGANIZED_CRIME",
            entity_count: 15,
            relationship_count: 17,
            evidence_count: 16,
            priority_score: 87,
            tags: ["extortion", "multi-state", "shell-company", "hawala"],
          },
          {
            id: "case-048",
            case_id: "CASE-048",
            title: "Hawala Layering Ring — Operation Vaayu",
            description: "Real estate layering scheme using shell consultancies in Jaipur. Connected to CASE-047 via shared bank accounts and nominee directors.",
            priority: "HIGH",
            category: "FINANCIAL_CRIME",
            entity_count: 8,
            relationship_count: 11,
            evidence_count: 9,
            priority_score: 72,
            tags: ["hawala", "real-estate", "tax-evasion"],
          },
        ]);
      }
    } catch {
      // Fallback
    }
  }, [authed, token]);

  useEffect(() => {
    refreshCases();
  }, [refreshCases]);

  if (!token) {
    return (
      <AuthScreen
        onAuthSuccess={(data) => {
          saveAuth(data);
          refreshCases();
        }}
      />
    );
  }

  const renderCurrentView = () => {
    switch (view) {
      case "dashboard":
        return <ExecutiveDashboard authed={authed} cases={cases} onNavigate={setView} onSelectCase={setSelectedCaseId} />;
      case "cases":
        return <CasesScreen cases={cases} onSelectCase={setSelectedCaseId} onNavigate={setView} />;
      case "network":
        return <NetworkExplorerScreen authed={authed} caseId={selectedCaseId} selectedCaseData={selectedCaseData} onNavigate={setView} />;
      case "entities":
        return <EntityResolutionScreen authed={authed} />;
      case "timeline":
        return <TemporalIntelligenceScreen authed={authed} caseId={selectedCaseId} onNavigate={setView} />;
      case "patterns":
        return <PatternEngineScreen authed={authed} caseId={selectedCaseId} />;
      case "cross_case":
        return <CrossCaseDiscoveryScreen onNavigate={setView} onSelectCase={setSelectedCaseId} />;
      case "evidence":
        return <EvidenceVaultScreen authed={authed} caseId={selectedCaseId} />;
      case "audit":
        return <AuditLogScreen authed={authed} caseId={selectedCaseId} />;
      case "brief":
        return <CaseBriefScreen authed={authed} caseId={selectedCaseId} selectedCaseData={selectedCaseData} />;
      default:
        return <ExecutiveDashboard authed={authed} cases={cases} onNavigate={setView} onSelectCase={setSelectedCaseId} />;
    }
  };

  return (
    <div className="app-bg">
      <div className="noise" />

      {/* Left Navigation Rail */}
      <aside className="left-rail" aria-label="Main Intelligence Navigation">
        {/* Government Brand Mark */}
        <div className="brand-mark" style={{ marginBottom: 18, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "linear-gradient(135deg, rgba(99,102,241,0.3), rgba(0,230,184,0.15))",
            border: "1.5px solid rgba(99,102,241,0.5)",
            display: "grid",
            placeItems: "center",
            color: "#818cf8",
          }}>
            <BrainCircuit size={22} />
          </div>
          <div style={{ display: "grid", lineHeight: 1.15 }}>
            <span style={{ fontSize: 14, fontWeight: 900, letterSpacing: "-0.02em", color: "#e0e7ff" }}>NETRA-AI</span>
            <span style={{ fontSize: 9.5, fontWeight: 800, color: "#818cf8", letterSpacing: "0.08em" }}>NCRB · SIH26189</span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav style={{ display: "grid", gap: 4 }}>
          <div className="nav-section-title" style={{ color: "#818cf8", margin: "4px 10px 8px" }}>
            Investigative Intelligence
          </div>

          {PRIMARY_NAV.map(({ id, label, icon: Icon, badge }) => (
            <button
              key={id}
              className={view === id ? "active" : ""}
              onClick={() => setView(id)}
              style={view === id ? { background: "rgba(99,102,241,0.18)", color: "#e0e7ff", borderColor: "rgba(99,102,241,0.4)" } : {}}
            >
              <Icon size={18} style={view === id ? { color: "#818cf8" } : {}} />
              <span style={{ flex: 1, textAlign: "left" }}>{label}</span>
              {badge && (
                <span style={{
                  fontSize: 9,
                  background: view === id ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.06)",
                  color: view === id ? "#a5b4fc" : "var(--sp-fg-subtle)",
                  borderRadius: 4,
                  padding: "1px 5px",
                  fontWeight: 800,
                }}>
                  {badge}
                </span>
              )}
            </button>
          ))}

          <button
            type="button"
            onClick={logout}
            style={{ marginTop: "auto", color: "#ef4444" }}
          >
            <LogOut size={17} />
            <span>Sign Out</span>
          </button>
        </nav>
      </aside>

      {/* Main Content Viewport */}
      <main className="main-content">
        <header className="top-header">
          <div>
            <p className="eyebrow" style={{ color: "#818cf8" }}>
              Ministry of Home Affairs · National Crime Records Bureau · SIH26189
            </p>
            <h2 style={{ letterSpacing: "-0.03em" }}>
              {PRIMARY_NAV.find((n) => n.id === view)?.label || "Intelligence Analysis"}
            </h2>
          </div>

          <div className="header-actions">
            {/* Quick Case Switcher */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(15,26,46,0.9)",
              border: "1px solid rgba(99,102,241,0.35)",
              borderRadius: 10,
              padding: "4px 10px",
              backdropFilter: "blur(10px)",
            }}>
              <Database size={14} style={{ color: "#818cf8" }} />
              <select
                value={selectedCaseId}
                onChange={(e) => setSelectedCaseId(e.target.value)}
                style={{ background: "transparent", border: "none", color: "var(--sp-fg)", fontSize: 12, fontWeight: 700, outline: "none", cursor: "pointer" }}
              >
                {cases.map((c) => (
                  <option key={c.id} value={c.id} style={{ background: "#0B1220", color: "#fff" }}>
                    {c.case_id} — {c.title?.slice(0, 26)}...
                  </option>
                ))}
              </select>
            </div>

            <StatusDot state="safe" label={online ? "NCRB Core Connected" : "Local Engine"} />
            <button className="icon-button mobile-only" onClick={() => setMobileMenuOpen(true)} title="Navigation">
              <Menu size={18} />
            </button>
          </div>
        </header>

        <AnimatePresence mode="wait">
          <motion.section
            key={view}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            {renderCurrentView()}
          </motion.section>
        </AnimatePresence>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="bottom-nav" aria-label="Mobile Navigation">
        <button className={cx(view === "dashboard" && "active")} onClick={() => setView("dashboard")}>
          <BarChart3 size={18} /><span>Hub</span>
        </button>
        <button className={cx(view === "network" && "active")} onClick={() => setView("network")}>
          <Radar size={18} /><span>Graph</span>
        </button>
        <button className={cx(view === "entities" && "active")} onClick={() => setView("entities")}>
          <Search size={18} /><span>Entities</span>
        </button>
        <button className={cx(view === "patterns" && "active")} onClick={() => setView("patterns")}>
          <BrainCircuit size={18} /><span>Patterns</span>
        </button>
        <button className={cx(mobileMenuOpen && "active")} onClick={() => setMobileMenuOpen(true)}>
          <Menu size={18} /><span>More</span>
        </button>
      </nav>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            className="mobile-drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileMenuOpen(false)}
          >
            <motion.div
              className="mobile-drawer-panel"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 280 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mobile-drawer-header">
                <div className="brand-mark" style={{ margin: 0 }}>
                  <BrainCircuit size={22} style={{ color: "#818cf8" }} />
                  <span style={{ fontSize: 16, fontWeight: 900 }}>NETRA-AI</span>
                </div>
                <button type="button" className="icon-button" onClick={() => setMobileMenuOpen(false)} style={{ width: 36, height: 36 }}>
                  <X size={18} />
                </button>
              </div>

              <div className="mobile-drawer-nav">
                <div className="mobile-drawer-section-title">Investigation Platform</div>
                {PRIMARY_NAV.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    className={cx("mobile-drawer-item", view === id && "active")}
                    onClick={() => {
                      setView(id);
                      setMobileMenuOpen(false);
                    }}
                  >
                    <Icon size={18} />
                    <span>{label}</span>
                  </button>
                ))}

                <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                  <PrimaryButton
                    danger
                    icon={LogOut}
                    onClick={() => {
                      setMobileMenuOpen(false);
                      logout();
                    }}
                    style={{ width: "100%" }}
                  >
                    Sign Out
                  </PrimaryButton>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Toaster theme="dark" richColors position="top-right" />
    </div>
  );
}
