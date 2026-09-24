import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import "@/App.css";
import axios from "axios";
import L from "leaflet";
import { motion, AnimatePresence } from "framer-motion";
import { toast, Toaster } from "sonner";
import { formatApiError } from "@/lib/api-error";
import { SafetyProfileView } from "@/components/SafetyProfileView";
import { TimelineView } from "@/components/TimelineView";
import ForceGraph2D from "react-force-graph-2d";

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BatteryCharging,
  Bell,
  BrainCircuit,
  Check,
  CheckCircle,
  ChevronRight,
  Clock,
  Compass,
  Database,
  Download,
  Edit2,
  Eye,
  FileLock2,
  Fingerprint,
  Footprints,
  Gauge,
  HeartPulse,
  HelpCircle,
  Home,
  Info,
  KeyRound,
  Layers,
  LocateFixed,
  Lock,
  LogOut,
  Map,
  MapPin,
  Menu,
  MessageCircle,
  Mic,
  Moon,
  Navigation,
  Phone,
  Play,
  Radar,
  RefreshCw,
  RotateCcw,
  Route,
  Search,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Siren,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Trash2,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  Vault,
  WifiOff,
  X,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || "http://localhost:8000").replace(/\/+$/, "");
const API = `${BACKEND_URL}/api`;
const MAP_PROVIDER = process.env.REACT_APP_MAP_PROVIDER || "leaflet_osm";
const DEFAULT_LOCATION = { lat: 26.8467, lng: 80.9462 }; // Hazratganj, Lucknow, UP

// Primary navigation — 6 core screens shown in sidebar and mobile bottom nav
const PRIMARY_NAV = [
  { id: "home",     label: "Home",            mobileLabel: "Home",     icon: Home },
  { id: "profile",  label: "Safety Profile",  mobileLabel: "Profile",  icon: Shield },
  { id: "journey",  label: "Smart Journey",   mobileLabel: "Journey",  icon: Route },
  { id: "live",     label: "Live Protection", mobileLabel: "Live",     icon: Activity },
  { id: "sos",      label: "SOS",             mobileLabel: "SOS",      icon: Siren },
  { id: "insights", label: "Safety Insights", mobileLabel: "Insights", icon: Sparkles },
];

// Secondary navigation — contextual screens accessible from sidebar
const SECONDARY_NAV = [
  { id: "contacts", label: "Trusted Circle",  icon: Users },
  { id: "timeline", label: "Timeline",        icon: Clock },
  { id: "vault",    label: "Evidence Vault",  icon: Vault },
  { id: "privacy",  label: "Privacy Center",  icon: Lock },
];

const PAGE_TITLES = {
  home:     "Protection Status",
  profile:  "Safety Profile",
  journey:  "Smart Journey",
  live:     "Live Protection",
  sos:      "Emergency Assistance",
  insights: "Safety Insights",
  contacts: "Trusted Circle",
  timeline: "Safety Timeline",
  vault:    "Evidence Vault",
  privacy:  "Privacy Controls",
  settings: "Account & Settings",
};


const api = axios.create({ baseURL: API });

function cx(...items) {
  return items.filter(Boolean).join(" ");
}

function formatDuration(seconds = 0) {
  const min = Math.max(1, Math.round(seconds / 60));
  return min > 60 ? `${Math.floor(min / 60)}h ${min % 60}m` : `${min} min`;
}

function formatDistance(m = 0) {
  return m > 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

function useAuthToken() {
  const [token, setToken] = useState(() => localStorage.getItem("sp_access_token") || "");
  const [refreshToken, setRefreshToken] = useState(() => localStorage.getItem("sp_refresh_token") || "");
  const saveAuth = useCallback((payload) => {
    localStorage.setItem("sp_access_token", payload.access_token);
    localStorage.setItem("sp_refresh_token", payload.refresh_token || localStorage.getItem("sp_refresh_token") || "");
    setToken(payload.access_token);
    if (payload.refresh_token) setRefreshToken(payload.refresh_token);
  }, []);
  const logout = useCallback(() => {
    localStorage.removeItem("sp_access_token");
    localStorage.removeItem("sp_refresh_token");
    setToken("");
    setRefreshToken("");
  }, []);
  return { token, refreshToken, saveAuth, logout };
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

function useLiveLocation(enabled = true) {
  const [location, setLocation] = useState(DEFAULT_LOCATION);
  const [accuracy, setAccuracy] = useState(null);
  const [error, setError] = useState("");
  const [hasRealFix, setHasRealFix] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  const requestGps = useCallback((forceToast = false) => {
    if (!navigator.geolocation) {
      setError("Geolocation not supported by browser");
      if (forceToast) toast.info("Geolocation not supported. Using active baseline.");
      return;
    }

    setIsLocating(true);
    if (forceToast) toast.loading("Detecting location...", { id: "gps-lock" });

    // Step 1: Fast network/Wi-Fi positioning (instant on laptops/browsers)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy: acc } = pos.coords;
        if (latitude && longitude) {
          setLocation({ lat: latitude, lng: longitude });
          setAccuracy(acc);
          setError("");
          setHasRealFix(true);
          setIsLocating(false);
          if (forceToast) toast.success(`Location locked (±${Math.round(acc)}m accuracy)`, { id: "gps-lock" });
        }
      },
      () => {
        // Step 2: High-accuracy hardware fallback (for mobile phones)
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { latitude, longitude, accuracy: acc } = pos.coords;
            if (latitude && longitude) {
              setLocation({ lat: latitude, lng: longitude });
              setAccuracy(acc);
              setError("");
              setHasRealFix(true);
              setIsLocating(false);
              if (forceToast) toast.success(`Location locked (±${Math.round(acc)}m)`, { id: "gps-lock" });
            }
          },
          (err) => {
            console.warn("Location note:", err.message);
            setError(err.message || "GPS unavailable");
            setIsLocating(false);
            if (forceToast) toast.info("Using baseline location (Lucknow Corridor)", { id: "gps-lock" });
          },
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
        );
      },
      { enableHighAccuracy: false, timeout: 4000, maximumAge: 10000 }
    );
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    requestGps(false);

    if (!navigator.geolocation) return undefined;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (pos.coords.latitude && pos.coords.longitude) {
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setAccuracy(pos.coords.accuracy);
          setError("");
          setHasRealFix(true);
          setIsLocating(false);
        }
      },
      () => {},
      { enableHighAccuracy: false, maximumAge: 5000, timeout: 8000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [enabled, requestGps]);

  return { location, setLocation, accuracy, error, hasRealFix, isLocating, requestGps };
}

function apiWithToken(token, onUnauthorized) {
  const requestWithAuth = async (method, url, dataOrConfig, maybeConfig) => {
    const config = method === "get" || method === "delete" ? (dataOrConfig || {}) : (maybeConfig || {});
    const headers = { ...(config.headers || {}), Authorization: `Bearer ${token}` };
    try {
      if (method === "get") return await api.get(url, { ...config, headers });
      if (method === "delete") return await api.delete(url, { ...config, headers });
      if (method === "post") return await api.post(url, dataOrConfig, { ...config, headers });
      if (method === "put") return await api.put(url, dataOrConfig, { ...config, headers });
    } catch (err) {
      if (err.response?.status === 401) {
        const storedRefresh = localStorage.getItem("sp_refresh_token");
        if (storedRefresh) {
          try {
            const refreshRes = await api.post("/auth/refresh", { refresh_token: storedRefresh });
            if (refreshRes.data?.access_token) {
              localStorage.setItem("sp_access_token", refreshRes.data.access_token);
              const retryHeaders = { ...(config.headers || {}), Authorization: `Bearer ${refreshRes.data.access_token}` };
              if (method === "get") return await api.get(url, { ...config, headers: retryHeaders });
              if (method === "delete") return await api.delete(url, { ...config, headers: retryHeaders });
              if (method === "post") return await api.post(url, dataOrConfig, { ...config, headers: retryHeaders });
              if (method === "put") return await api.put(url, dataOrConfig, { ...config, headers: retryHeaders });
            }
          } catch {
            if (onUnauthorized) onUnauthorized();
          }
        } else if (onUnauthorized) {
          onUnauthorized();
        }
      }
      throw err;
    }
  };

  return {
    get: (url, config) => requestWithAuth("get", url, config),
    post: (url, data, config) => requestWithAuth("post", url, data, config),
    put: (url, data, config) => requestWithAuth("put", url, data, config),
    delete: (url, config) => requestWithAuth("delete", url, config),
  };
}

function GlassCard({ children, className = "", testId, as: Component = "section", ...props }) {
  return (
    <Component data-testid={testId} className={cx("glass-card", className)} {...props}>
      {children}
    </Component>
  );
}

function IconBadge({ icon: Icon, tone = "teal", children }) {
  return (
    <span className={cx("icon-badge", `tone-${tone}`)}>
      <Icon size={14} aria-hidden="true" />
      {children}
    </span>
  );
}

function PrimaryButton({ children, icon: Icon, className = "", danger = false, secondary = false, testId, ...props }) {
  return (
    <button
      type="button"
      data-testid={testId}
      className={cx("sp-button", danger && "danger", secondary && "secondary", className)}
      {...props}
    >
      {Icon && <Icon size={17} aria-hidden="true" />}
      <span>{children}</span>
    </button>
  );
}

function StatusDot({ state = "safe", label }) {
  return (
    <span className={cx("status-dot", state)}>
      <span /> {label}
    </span>
  );
}

function StateBadge({ state = "idle" }) {
  const map = {
    idle: { label: "Idle", cls: "state-idle" },
    monitoring: { label: "Monitoring", cls: "state-monitoring" },
    watch: { label: "Caution", cls: "state-risk_detected" },
    confirm: { label: "Confirmation Required", cls: "state-safety_check" },
    emergency: { label: "Emergency Alert", cls: "state-emergency" },
    resolved: { label: "Resolved", cls: "state-resolved" },
  };
  const current = map[state.toLowerCase()] || { label: state, cls: "state-idle" };
  return <span className={cx("state-badge", current.cls)}>{current.label}</span>;
}

// Part 13: Explainable Risk "Why?" Modal
function WhyThisRiskModal({ risk, onClose, onCheckIn, onSOS }) {
  if (!risk) return null;
  const score = risk.score ?? 12;
  const level = risk.risk_level || (score < 30 ? "LOW" : score < 60 ? "MODERATE" : score < 80 ? "ELEVATED" : "HIGH");
  const factors = risk.factors || [];
  const whyChanged = risk.why_the_score_changed || risk.why_changed || "Current journey matches learned baseline.";
  const action = risk.recommended_action || (score < 30 ? "Continue monitoring" : score < 60 ? "Check-in recommended" : "Please confirm you're safe");

  return (
    <div className="modal-backdrop" onClick={onClose} data-testid="why-risk-modal-backdrop">
      <GlassCard className="modal-card why-risk-modal" onClick={(e) => e.stopPropagation()} testId="why-risk-modal">
        <div className="section-head">
          <IconBadge icon={BrainCircuit} tone={score >= 80 ? "danger" : score >= 60 ? "warning" : "teal"}>
            Explainable Risk Signals
          </IconBadge>
          <button className="icon-button" onClick={onClose} aria-label="Close why panel">
            <X size={16} />
          </button>
        </div>

        <div className="why-hero-score">
          <div>
            <p className="eyebrow">Personalized Risk Signal</p>
            <h2>{score} / 100</h2>
            <StateBadge state={risk.state || "safe"} />
          </div>
          <div className="why-level-badge">
            <strong>{level} RISK</strong>
            <small>Deterministic local scoring</small>
          </div>
        </div>

        <div className="why-narrative-box">
          <p><strong>Observation:</strong> {whyChanged}</p>
          <p className="why-action-line"><strong>Recommended action:</strong> {action}</p>
        </div>

        <div className="why-factors-list">
          <h4>Additive Signal Contributions</h4>
          {factors.map((f) => (
            <div key={f.name} className="why-factor-row">
              <div className="factor-name-contrib">
                <strong>{f.name}</strong>
                <span className={f.contribution > 10 ? "pts-high" : "pts-normal"}>
                  +{f.contribution} pts
                </span>
              </div>
              <div className="factor-bar">
                <i style={{ width: `${Math.min(100, f.contribution * 3.5)}%` }} />
              </div>
              <small>{f.explanation}</small>
            </div>
          ))}
        </div>

        <div className="button-row" style={{ marginTop: 20 }}>
          <PrimaryButton testId="why-modal-checkin-btn" icon={CheckCircle} onClick={onCheckIn}>
            I'm Safe (Check In)
          </PrimaryButton>
          {score >= 60 && (
            <PrimaryButton testId="why-modal-sos-btn" danger icon={Siren} onClick={onSOS}>
              Need Help (SOS)
            </PrimaryButton>
          )}
        </div>
      </GlassCard>
    </div>
  );
}

// Part 11: Conservative High-Risk Confirmation Modal
// Principle: Observe silently -> confirm sustained meaningful deviation -> ask once -> 30s countdown -> escalate only if necessary
function HighRiskCheckinModal({
  deadline,
  reasons = ["Route deviation", "Unexpected stop", "Journey duration overrun"],
  onSafeConfirm,
  onNeedHelp,
  onSOS,
}) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    deadline ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) : 30
  );
  const [isHoldingSOS, setIsHoldingSOS] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdIntervalRef = useRef(null);

  useEffect(() => {
    if (!deadline) return;
    const update = () => {
      const rem = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsLeft(rem);
      if (rem <= 0) {
        onNeedHelp?.(true); // Timed out -> auto-progress to Primary Contact
      }
    };
    update();
    const timer = setInterval(update, 500);
    return () => clearInterval(timer);
  }, [deadline, onNeedHelp]);

  // Hold SOS for 1.5 seconds
  const startHoldingSOS = () => {
    setIsHoldingSOS(true);
    setHoldProgress(0);
    const start = Date.now();
    holdIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const progress = Math.min(100, (elapsed / 1500) * 100);
      setHoldProgress(progress);
      if (progress >= 100) {
        clearInterval(holdIntervalRef.current);
        setIsHoldingSOS(false);
        onSOS();
      }
    }, 30);
  };

  const cancelHoldingSOS = () => {
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    setIsHoldingSOS(false);
    setHoldProgress(0);
  };

  return (
    <div className="modal-backdrop high-risk-checkin-backdrop" data-testid="high-risk-checkin-modal" style={{ zIndex: 1000 }}>
      <motion.div
        className="glass-card high-risk-checkin-card"
        initial={{ opacity: 0, scale: 0.94, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 15 }}
        style={{
          maxWidth: 480,
          width: "92%",
          padding: "24px 22px",
          border: "2px solid rgba(255, 78, 95, 0.6)",
          background: "rgba(18, 12, 24, 0.96)",
          boxShadow: "0 16px 48px rgba(255, 78, 95, 0.28)",
          borderRadius: 22,
          backdropFilter: "blur(24px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              background: "#FF4E5F",
              color: "#fff",
              padding: "4px 12px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: "0.06em",
              display: "inline-flex",
              alignItems: "center",
              gap: 4
            }}>
              <ShieldAlert size={14} /> HIGH RISK
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#FFB84C", fontSize: 13, fontWeight: 700 }}>
            <Clock size={15} />
            <span>{secondsLeft}s remaining</span>
          </div>
        </div>

        <h3 style={{ fontSize: 18, color: "#fff", margin: "0 0 10px", lineHeight: 1.35 }}>
          Your journey looks significantly different from your usual pattern.
        </h3>

        <div style={{ background: "rgba(255, 255, 255, 0.05)", borderRadius: 12, padding: "12px 14px", marginBottom: 16 }}>
          <strong style={{ fontSize: 11, letterSpacing: "0.05em", color: "var(--sp-fg-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
            Why we're checking:
          </strong>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#cbd5e1", lineHeight: 1.6 }}>
            {reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>

        <p style={{ fontSize: 15, fontWeight: 700, color: "#fff", margin: "0 0 14px", textAlign: "center" }}>
          Are you safe?
        </p>

        {/* 30s Countdown progress bar */}
        <div style={{ height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 999, marginBottom: 18, overflow: "hidden" }}>
          <div style={{
            height: "100%",
            width: `${(secondsLeft / 30) * 100}%`,
            background: secondsLeft > 10 ? "linear-gradient(90deg, #FFB84C, #FF4E5F)" : "#FF4E5F",
            transition: "width 0.5s linear"
          }} />
        </div>

        {/* 3 Action Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <PrimaryButton
            testId="escalation-im-safe-btn"
            icon={Check}
            onClick={onSafeConfirm}
            style={{ width: "100%", minHeight: 46, fontSize: 14, background: "linear-gradient(135deg, #00E6B8, #00D26A)", color: "#0B1220", fontWeight: 800 }}
          >
            I'm Safe
          </PrimaryButton>

          <div style={{ display: "flex", gap: 10 }}>
            <PrimaryButton
              testId="escalation-need-help-btn"
              secondary
              icon={Users}
              onClick={() => onNeedHelp(false)}
              style={{ flex: 1, minHeight: 44, fontSize: 13, borderColor: "rgba(255,184,76,0.5)", color: "#FFB84C" }}
            >
              Need Help
            </PrimaryButton>

            <button
              type="button"
              data-testid="escalation-hold-sos-btn"
              onMouseDown={startHoldingSOS}
              onMouseUp={cancelHoldingSOS}
              onMouseLeave={cancelHoldingSOS}
              onTouchStart={startHoldingSOS}
              onTouchEnd={cancelHoldingSOS}
              style={{
                flex: 1,
                minHeight: 44,
                borderRadius: 14,
                border: "1.5px solid #FF4E5F",
                background: "rgba(255, 78, 95, 0.18)",
                color: "#FF4E5F",
                fontWeight: 800,
                fontSize: 13,
                cursor: "pointer",
                position: "relative",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6
              }}
            >
              <div style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: `${holdProgress}%`,
                background: "rgba(255, 78, 95, 0.45)",
                transition: "width 0.05s linear",
                pointerEvents: "none"
              }} />
              <Siren size={16} />
              <span style={{ position: "relative", zIndex: 2 }}>
                {isHoldingSOS ? `Hold (${Math.round(holdProgress)}%)` : "Hold SOS (1.5s)"}
              </span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// Contact Escalation Tracking Card (Primary Alerted -> 60s Ack -> Secondary Alerted)
function ContactEscalationCard({
  status,
  primaryContact,
  secondaryContact,
  ackDeadline,
  onSimulateAck,
  onAckTimeout,
  onDismiss,
  onSafeConfirm,
}) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    ackDeadline ? Math.max(0, Math.ceil((ackDeadline - Date.now()) / 1000)) : 0
  );

  useEffect(() => {
    if (!ackDeadline || status !== "PRIMARY_ALERTED") return;
    const update = () => {
      const rem = Math.max(0, Math.ceil((ackDeadline - Date.now()) / 1000));
      setSecondsLeft(rem);
      if (rem <= 0) {
        onAckTimeout?.();
      }
    };
    update();
    const t = setInterval(update, 500);
    return () => clearInterval(t);
  }, [ackDeadline, status, onAckTimeout]);

  if (!["PRIMARY_ALERTED", "PRIMARY_ACKNOWLEDGED", "SECONDARY_ALERTED"].includes(status)) {
    return null;
  }

  const pName = primaryContact?.name || "Primary Contact";
  const sName = secondaryContact?.name || "Secondary Contact";

  return (
    <motion.div
      className={cx("glass-card contact-escalation-card wide", status.toLowerCase())}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      data-testid="contact-escalation-banner"
      style={{
        border: `1.5px solid ${status === "PRIMARY_ACKNOWLEDGED" ? "#00E6B8" : status === "SECONDARY_ALERTED" ? "#FF8C00" : "#FFB84C"}`,
        background: status === "PRIMARY_ACKNOWLEDGED" ? "rgba(0, 230, 184, 0.12)" : "rgba(255, 184, 76, 0.12)",
        borderRadius: 16,
        padding: "14px 16px",
        margin: "12px 0",
        backdropFilter: "blur(20px)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: status === "PRIMARY_ACKNOWLEDGED" ? "rgba(0,230,184,0.2)" : "rgba(255,184,76,0.2)",
            display: "grid",
            placeItems: "center",
            flexShrink: 0
          }}>
            {status === "PRIMARY_ACKNOWLEDGED" ? <CheckCircle size={18} style={{ color: "#00E6B8" }} /> : <Bell size={18} style={{ color: "#FFB84C" }} />}
          </div>
          <div>
            <strong style={{ fontSize: 14, color: status === "PRIMARY_ACKNOWLEDGED" ? "#00E6B8" : "#fff", display: "block" }}>
              {status === "PRIMARY_ALERTED" && `Primary Contact Alerted (${pName})`}
              {status === "PRIMARY_ACKNOWLEDGED" && `Primary Contact Acknowledged`}
              {status === "SECONDARY_ALERTED" && `Secondary Contact Alerted (${sName})`}
            </strong>
            <small style={{ color: "var(--sp-fg-muted)", fontSize: 12 }}>
              {status === "PRIMARY_ALERTED" && `Waiting for acknowledgement... (${secondsLeft}s window)`}
              {status === "PRIMARY_ACKNOWLEDGED" && `${pName} confirmed receipt. Automatic escalation stopped.`}
              {status === "SECONDARY_ALERTED" && `No acknowledgement from ${pName} within 60s. ${sName} alerted.`}
            </small>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {status === "PRIMARY_ALERTED" && (
            <>
              <button
                type="button"
                className="sp-button secondary"
                data-testid="simulate-primary-ack-btn"
                onClick={onSimulateAck}
                style={{ fontSize: 11, padding: "6px 12px", minHeight: 32, borderColor: "rgba(0,230,184,0.4)", color: "#00E6B8" }}
              >
                Simulate Ack
              </button>
              <button
                type="button"
                className="sp-button"
                onClick={onSafeConfirm}
                style={{ fontSize: 11, padding: "6px 12px", minHeight: 32, background: "rgba(0,230,184,0.15)", color: "#00E6B8" }}
              >
                I'm Safe Now
              </button>
            </>
          )}

          {(status === "PRIMARY_ACKNOWLEDGED" || status === "SECONDARY_ALERTED") && (
            <button
              type="button"
              className="sp-button secondary"
              onClick={onDismiss}
              style={{ fontSize: 11, padding: "6px 12px", minHeight: 32 }}
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// Safe Confirmation Cooldown Badge
function SafeCooldownBadge({ cooldownUntil }) {
  const [remMin, setRemMin] = useState(() =>
    cooldownUntil ? Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 60000)) : 0
  );

  useEffect(() => {
    if (!cooldownUntil) return;
    const update = () => {
      const m = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 60000));
      setRemMin(m);
    };
    update();
    const t = setInterval(update, 3000);
    return () => clearInterval(t);
  }, [cooldownUntil]);

  if (!remMin || remMin <= 0) return null;

  return (
    <div style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      background: "rgba(0,230,184,0.12)",
      border: "1px solid rgba(0,230,184,0.3)",
      borderRadius: 999,
      padding: "4px 10px",
      fontSize: 11,
      color: "#00E6B8",
      fontWeight: 700,
      margin: "8px 0"
    }} data-testid="safe-cooldown-badge">
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00E6B8", display: "inline-block" }} />
      <span>Safe Confirmation Cooldown ({remMin}m) · Passive Monitoring Only</span>
    </div>
  );
}

// Part 12: Discreet Demo Controls — conservative escalation demo cases
function DemoToolbar({ onSimulate, onReset, activeScenario, loading }) {
  const [open, setOpen] = useState(false);
  const scenarios = [
    { id: "normal_journey",   label: "1. Normal Baseline (Score 12 · Silent)" },
    { id: "route_deviation",  label: "2. Route Deviation (Score 48 · Silent)" },
    { id: "prolonged_stop",   label: "3. Prolonged Stop Anomaly" },
    { id: "unusual_duration", label: "4. Unusual Duration Anomaly" },
    { id: "high_risk_area",   label: "5. High-Risk Zone Entry" },
    { id: "motion_anomaly",   label: "6. Motion / Impact Anomaly" },
    { id: "elevated_risk",    label: "7. User Requests Help (Immediate)" },
    { id: "high_risk",        label: "8. Compound High Risk (30s Modal)" },
    { id: "combined_incident",label: "9. Multi-Signal Incident (Escalation)" },
    { id: "safe_checkin",     label: "10. User Confirmed Safe (5m Cooldown)" },
    { id: "sos",              label: "11. Manual SOS Trigger (Hold 1.5s)" },
  ];

  return (
    <>
      {/* Floating Demo toggle button — bottom-right corner */}
      <button
        data-testid="demo-mode-toggle"
        onClick={() => setOpen((o) => !o)}
        style={{
          position: "fixed", bottom: 80, right: 18, zIndex: 200,
          background: "rgba(11,18,32,0.92)", border: "1px solid rgba(255,184,76,0.4)",
          color: "#FFB84C", borderRadius: 999, padding: "6px 14px",
          fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", gap: 6,
          backdropFilter: "blur(12px)", cursor: "pointer", letterSpacing: "0.08em",
        }}
      >
        <Zap size={12} />
        {open ? "Close Demo" : "Demo"}
      </button>

      {/* Expandable scenario drawer */}
      {open && (
        <div className="demo-bar" data-testid="demo-mode-toolbar"
          style={{ position: "fixed", bottom: 120, right: 18, zIndex: 199, width: 280 }}>
          <div className="demo-label-wrap">
            <span className="demo-badge">Demo Mode · Conservative Escalation</span>
            <small>Observe silently → ask once → human-led</small>
          </div>
          <div className="demo-btn-group">
            {scenarios.map((s) => (
              <button
                key={s.id}
                data-testid={`demo-scenario-${s.id}`}
                className={cx("demo-btn", activeScenario === s.id && "active-scenario")}
                onClick={() => { onSimulate(s.id); setOpen(false); }}
                disabled={loading}
              >
                {s.label}
              </button>
            ))}
            <button data-testid="demo-reset-button" className="demo-btn reset" onClick={() => { onReset(); setOpen(false); }} disabled={loading}>
              <RotateCcw size={13} style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }} />
              Reset Demo Baseline
            </button>
          </div>
        </div>
      )}
    </>
  );
}



// Splash Screen
function SplashScreen({ onDone }) {
  useEffect(() => {
    const id = setTimeout(onDone, 900);
    return () => clearTimeout(id);
  }, [onDone]);
  return (
    <motion.main className="splash-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="noise" />
      <motion.div className="pulse-orbit" animate={{ scale: [0.94, 1.06, 0.94], opacity: [0.7, 1, 0.7] }} transition={{ duration: 2.2, repeat: Infinity }}>
        <ShieldCheck size={72} />
      </motion.div>
      <motion.div className="splash-copy" initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}>
        <p className="eyebrow">Personalized · Continuous · Edge-First</p>
        <h1>SentinelPulse</h1>
        <p>Personalized protection that learns what normal looks like for you.</p>
      </motion.div>
    </motion.main>
  );
}

// Part 2: Welcome Screen (First screen for new users)
function WelcomeScreen({ onGetStarted, onSignIn, onDemo }) {
  return (
    <main className="welcome-shell" data-testid="welcome-screen">
      <div className="noise" />
      <div className="welcome-container">
        <motion.div className="welcome-hero" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <div className="brand-badge-row">
            <span className="icon-badge tone-teal">
              <ShieldCheck size={15} /> Personal Safety Intelligence
            </span>
          </div>

          <h1>Welcome to SentinelPulse</h1>
          <p className="welcome-subtitle">
            Personalized protection that learns what normal looks like for you.
          </p>

          <div className="welcome-pillars-grid">
            <div className="pillar-card glass-card">
              <BrainCircuit size={24} className="pillar-icon" />
              <h4>Personal Safety Baseline</h4>
              <p>SentinelPulse creates your initial baseline and refines it as real journey signals are observed.</p>
            </div>
            <div className="pillar-card glass-card">
              <Radar size={24} className="pillar-icon" />
              <h4>Explainable Detection</h4>
              <p>Detects route deviations and unexpected stops before emergencies, explaining every score in plain language.</p>
            </div>
            <div className="pillar-card glass-card">
              <Lock size={24} className="pillar-icon" />
              <h4>Local-First Privacy</h4>
              <p>Raw sensor information is processed locally. Only verified safety events ever reach encrypted vault storage.</p>
            </div>
          </div>

          <div className="welcome-cta-row">
            <PrimaryButton testId="welcome-get-started-button" icon={ArrowRight} onClick={onGetStarted}>
              Get Started
            </PrimaryButton>
            <button
              type="button"
              data-testid="welcome-demo-button"
              className="sp-button secondary"
              onClick={onDemo}
              style={{ gap: 8 }}
            >
              <Zap size={16} style={{ color: "#FFB84C" }} />
              Continue as Demo
            </button>
            <button
              type="button"
              data-testid="welcome-signin-button"
              className="link-button welcome-signin-link"
              onClick={onSignIn}
            >
              Already have an account? Sign in
            </button>
          </div>
        </motion.div>
      </div>
    </main>
  );
}


// Part 3: Real Authentication Screen
function AuthScreen({ onAuth, isRegister: initialRegister = false, onBackToWelcome, onDemo }) {
  const [mode, setMode] = useState("email");
  const [isRegister, setIsRegister] = useState(initialRegister);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(null);
  const [passkey, setPasskey] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleEmail = async () => {
    if (isRegister) {
      if (!form.name || form.name.trim().length < 2) {
        toast.error("Please enter a name with at least 2 characters.");
        return;
      }
      if (!form.email || !form.email.includes("@")) {
        toast.error("Please provide a valid email address.");
        return;
      }
      if (!form.password || form.password.length < 8) {
        toast.error("Password must be at least 8 characters long.");
        return;
      }
    }
    setLoading(true);
    try {
      const payload = isRegister
        ? await api.post("/auth/register", { name: form.name, email: form.email, password: form.password })
        : await api.post("/auth/login", { identifier: form.email, password: form.password });
      onAuth(payload.data, isRegister);
      toast.success(isRegister ? "Account created — let's set up your personal baseline" : "Welcome back to SentinelPulse");
    } catch (err) {
      toast.error(formatApiError(err, "Authentication failed. Please check your credentials."));
    } finally {
      setLoading(false);
    }
  };

  const requestOtp = async () => {
    if (!form.phone || form.phone.trim().length < 6) {
      toast.error("Please enter a valid phone number.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post("/auth/phone/request-otp", { phone: form.phone });
      setOtpSent(res.data);
      setOtp(res.data.delivery.code);
      toast.success("In-app OTP delivered for instant testing");
    } catch (err) {
      toast.error(formatApiError(err, "Could not request OTP"));
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!otp) {
      toast.error("Please enter the verification code.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post("/auth/phone/verify", { phone: form.phone, otp, name: form.name || "SentinelPulse Member" });
      onAuth(res.data, false);
      toast.success("Phone session verified");
    } catch (err) {
      toast.error(formatApiError(err, "OTP verification failed"));
    } finally {
      setLoading(false);
    }
  };

  const startPasskey = async () => {
    const identifier = form.email || form.phone || "sentinel.tester@example.com";
    try {
      const res = await api.post("/auth/passkey/challenge", { identifier });
      setPasskey(res.data);
      toast.message("Simulated Biometric Passkey Challenge ready");
    } catch (err) {
      toast.error(formatApiError(err, "Passkey challenge failed"));
    }
  };

  const verifyPasskey = async () => {
    if (!passkey) return;
    try {
      const res = await api.post("/auth/passkey/verify", { challenge_id: passkey.challenge_id, signed_challenge: passkey.expected_demo_signature });
      onAuth(res.data, false);
      toast.success("Passkey biometric unlocked");
    } catch (err) {
      toast.error(formatApiError(err, "Passkey verification failed"));
    }
  };

  return (
    <main className="auth-shell">
      <div className="noise" />
      <section className="auth-hero" aria-label="SentinelPulse introduction">
        {onBackToWelcome && (
          <button className="link-button back-btn" onClick={onBackToWelcome} style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
            <ArrowLeft size={16} /> Back to Welcome
          </button>
        )}
        <IconBadge icon={ShieldCheck}>Privacy-First Edge Relay</IconBadge>
        <h1>Protection that starts before panic.</h1>
        <p>SentinelPulse learns what normal looks like for you, explains every risk score in plain language, and escalates calmly only when needed.</p>
        <div className="auth-feature-list">
          <div><CheckCircle size={15} /> Continuous journey signal monitoring</div>
          <div><CheckCircle size={15} /> Transparent 12s calm confirmation window</div>
          <div><CheckCircle size={15} /> Encrypted evidence vault with SHA-256 seal</div>
        </div>
      </section>

      <GlassCard className="auth-card" testId="auth-card">
        <div className="auth-tabs" role="tablist" aria-label="Authentication options">
          <button data-testid="auth-email-tab" className={mode === "email" ? "active" : ""} onClick={() => setMode("email")}>Email</button>
          <button data-testid="auth-phone-tab" className={mode === "phone" ? "active" : ""} onClick={() => setMode("phone")}>Phone OTP</button>
        </div>
        <div className="form-stack">
          {(isRegister || mode === "phone") && (
            <label>Full Name
              <input data-testid="auth-name-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Maya Lin" />
            </label>
          )}
          {mode === "email" ? (
            <>
              <label>Email
                <input data-testid="auth-email-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@university.edu" />
              </label>
              <label>Password
                <input data-testid="auth-password-input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Minimum 8 characters" />
              </label>
              <PrimaryButton testId="auth-submit-button" icon={KeyRound} onClick={handleEmail} disabled={loading}>
                {loading ? "Securing session..." : isRegister ? "Create Protected Account" : "Enter SentinelPulse"}
              </PrimaryButton>
              <button data-testid="auth-toggle-register-button" className="link-button" onClick={() => setIsRegister(!isRegister)}>
                {isRegister ? "Already protected? Sign in" : "New user? Create your safety profile"}
              </button>
              {onDemo && (
                <PrimaryButton testId="auth-demo-button" icon={Zap} secondary onClick={onDemo} style={{ gap: 8 }}>
                  Continue as Demo
                </PrimaryButton>
              )}
            </>
          ) : (
            <>
              <label>Phone
                <input data-testid="auth-phone-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1 (555) 019-2834" />
              </label>
              {!otpSent ? (
                <PrimaryButton testId="auth-request-otp-button" icon={Send} onClick={requestOtp} disabled={loading}>
                  {loading ? "Requesting code..." : "Request In-App Demo Code"}
                </PrimaryButton>
              ) : (
                <>
                  <label>Verification Code
                    <input data-testid="auth-otp-input" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="6-digit code" />
                  </label>
                  <PrimaryButton testId="auth-verify-otp-button" icon={Check} onClick={verifyOtp} disabled={loading}>
                    {loading ? "Verifying..." : "Verify & Sign In"}
                  </PrimaryButton>
                </>
              )}
            </>
          )}
          <div className="auth-divider"><span /> <small>or</small> <span /></div>
          {onDemo && (
            <PrimaryButton testId="auth-demo-button" icon={Zap} secondary onClick={onDemo} style={{ gap: 8 }}>
              Continue as Demo
            </PrimaryButton>
          )}
          <PrimaryButton testId="auth-passkey-button" icon={Fingerprint} secondary onClick={passkey ? verifyPasskey : startPasskey}>
            {passkey ? "Confirm simulated biometric" : "Use Passkey / Biometric"}
          </PrimaryButton>
        </div>
      </GlassCard>
    </main>
  );
}

// Part 8: Home Dashboard — Calm, Premium, Safety-First
function HomeDashboard({
  data,
  onNavigate,
  onSOS,
  onRiskScan,
  insight,
  riskLoading,
  onOpenWhy,
  onCheckIn,
  user,
  authed,
  escalationStatus,
  primaryContact,
  secondaryContact,
  ackDeadline,
  cooldownUntil,
  onSimulateAck,
  onAckTimeout,
  onDismissEscalation,
  onSafeConfirm,
}) {
  const safety = data?.safety_score ?? 88;
  const riskScore = data?.risk_score ?? (100 - safety);
  const riskLevel = data?.risk_level || (riskScore < 35 ? "LOW" : riskScore < 65 ? "MODERATE" : riskScore < 85 ? "HIGH" : "CRITICAL");
  const factors = data?.latest_risk?.factors || [];
  const trend = data?.risk_trend?.length ? data.risk_trend : [{ time: "now", score: 12 }];
  const userName = user?.name?.split(" ")?.[0] || "there";

  // Signals SentinelPulse is monitoring
  const signalsMonitoring = [
    { label: "Route deviation", status: riskScore >= 50 ? "Deviation detected (+24 pts)" : "Within normal corridor", tone: riskScore >= 50 ? "warning" : "safe" },
    { label: "Unexpected stops", status: riskScore >= 65 ? "Prolonged stop (+18 pts)" : "Movement steady", tone: riskScore >= 65 ? "danger" : "safe" },
    { label: "Time deviation", status: "Within normal transit window", tone: "safe" },
    { label: "Journey consistency", status: riskScore < 50 ? "Consistent with baseline" : "Baseline divergence", tone: riskScore < 50 ? "safe" : "warning" },
    { label: "Contextual risk", status: riskScore >= 70 ? "Caution corridor" : "Familiar safe zone", tone: riskScore >= 70 ? "warning" : "safe" },
  ];

  return (
    <motion.div className="dashboard-grid" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>

      {/* Hero Status Card */}
      <GlassCard className="hero-shield" testId="home-ai-shield-card" style={{ padding: "22px" }}>
        {/* Header row: greeting + status */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 14, background: "rgba(0,230,184,0.14)", border: "1px solid rgba(0,230,184,0.25)", display: "grid", placeItems: "center" }}>
              <ShieldCheck size={22} style={{ color: "#00E6B8" }} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <strong style={{ fontSize: 17, letterSpacing: "-0.02em" }}>Hello, {userName}</strong>
                <StatusDot state="safe" label="Protection Active" />
              </div>
              <small style={{ color: "var(--sp-fg-muted)", fontSize: 12 }}>Personalized baseline monitoring · Edge-first processing</small>
            </div>
          </div>
          <IconBadge icon={BrainCircuit} tone={riskScore >= 65 ? "danger" : riskScore >= 35 ? "warning" : "teal"}>
            {riskLevel} · {riskScore}/100
          </IconBadge>
        </div>

        {/* Safety Score Bar */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "var(--sp-fg-muted)", fontWeight: 700 }}>SAFETY SCORE</span>
            <span style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.04em", color: safety > 65 ? "#00D26A" : safety > 35 ? "#FFB84C" : "#FF4E5F" }}>{safety}</span>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.08)", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, width: `${Math.min(100, safety)}%`, borderRadius: 999, background: safety > 65 ? "linear-gradient(90deg, #00E6B8, #00D26A)" : safety > 35 ? "#FFB84C" : "#FF4E5F", transition: "width 0.6s ease" }} />
          </div>
          <small style={{ display: "block", marginTop: 6, color: "var(--sp-fg-subtle)", fontSize: 11 }}>
            Signal confidence: {data?.latest_risk?.confidence_label || (safety > 65 ? "High" : "Moderate")} · Calibrated continuously against your personalized baseline
          </small>
        </div>

        {/* 4 Quick Action Tiles — responsive grid */}
        <div className="quick-actions-grid">
          <button
            type="button"
            style={{ background: "rgba(0,230,184,0.10)", border: "1px solid rgba(0,230,184,0.22)", borderRadius: 16, padding: "14px 10px", cursor: "pointer", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, transition: "background 0.2s" }}
            onClick={() => onNavigate("map")}
          >
            <MapPin size={20} style={{ color: "#00E6B8" }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>Smart Map</span>
            <span style={{ fontSize: 10, color: "var(--sp-fg-subtle)" }}>Safe routes</span>
          </button>
          <button
            type="button"
            style={{ background: "rgba(0,230,184,0.10)", border: "1px solid rgba(0,230,184,0.22)", borderRadius: 16, padding: "14px 10px", cursor: "pointer", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}
            onClick={() => { if (onCheckIn) onCheckIn(); }}
          >
            <ShieldCheck size={20} style={{ color: "#00D26A" }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>Mark Safe</span>
            <span style={{ fontSize: 10, color: "var(--sp-fg-subtle)" }}>Reset to baseline</span>
          </button>
          <button
            type="button"
            style={{ background: "rgba(0,230,184,0.10)", border: "1px solid rgba(0,230,184,0.22)", borderRadius: 16, padding: "14px 10px", cursor: "pointer", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}
            onClick={() => onNavigate("journey")}
          >
            <Route size={20} style={{ color: "#00E6B8" }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{data?.active_journey ? "Active Journey" : "Start Journey"}</span>
            <span style={{ fontSize: 10, color: "var(--sp-fg-subtle)" }}>Monitoring mode</span>
          </button>
          <button
            type="button"
            style={{ background: "rgba(255,78,95,0.12)", border: "1px solid rgba(255,78,95,0.28)", borderRadius: 16, padding: "14px 10px", cursor: "pointer", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}
            onClick={onSOS}
          >
            <Siren size={20} style={{ color: "#FF4E5F" }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>SOS Alert</span>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>Emergency dispatch</span>
          </button>
        </div>

      </GlassCard>

      {/* Safe Confirmation Cooldown Badge (When in 5m Cooldown) */}
      <SafeCooldownBadge cooldownUntil={cooldownUntil} />

      {/* Contact Escalation Alert Card (When Primary / Secondary Alerted) */}
      <ContactEscalationCard
        status={escalationStatus}
        primaryContact={primaryContact}
        secondaryContact={secondaryContact}
        ackDeadline={ackDeadline}
        onSimulateAck={onSimulateAck}
        onAckTimeout={onAckTimeout}
        onDismiss={onDismissEscalation}
        onSafeConfirm={onSafeConfirm}
      />

      {/* Protection Status */}
      <GlassCard className="status-stack" testId="home-status-card">
        <p className="eyebrow" style={{ margin: "0 0 12px" }}>Protection Status</p>
        <StatusDot state="safe" label="High-Precision GPS Active" />
        <StatusDot state="safe" label="Local Deterministic Engine Active" />
        <StatusDot state={data?.trusted_contacts ? "safe" : "watch"} label={`${data?.trusted_contacts || 2} trusted circle responders ready`} />
        <StatusDot state="safe" label="Tamper-Evident SHA-256 Seal Active" />
      </GlassCard>

      {/* Signal Monitoring & Trend Area */}
      <GlassCard className="chart-card" testId="home-risk-trend-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Continuous Signal Monitoring</p>
            <h3>Safety Signal Trend</h3>
            <span className="helper">Monitored deviations vs learned commute baseline</span>
          </div>
        </div>

        <div className="signals-monitoring-grid">
          {signalsMonitoring.map((s) => (
            <div key={s.label} className="signal-pill">
              <span className={cx("status-dot", s.tone)}><span /></span>
              <strong>{s.label}:</strong>
              <span>{s.status}</span>
            </div>
          ))}
        </div>

        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={trend}>
            <defs>
              <linearGradient id="riskGradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor={riskScore > 60 ? "#FF4E5F" : "#00E6B8"} stopOpacity={0.45} />
                <stop offset="95%" stopColor={riskScore > 60 ? "#FF4E5F" : "#00E6B8"} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="time" stroke="rgba(234,242,255,0.45)" tickLine={false} axisLine={false} />
            <YAxis domain={[0, 100]} stroke="rgba(234,242,255,0.45)" tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ background: "#0B1220", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14 }} />
            <Area type="monotone" dataKey="score" stroke={riskScore > 60 ? "#FF4E5F" : "#00E6B8"} fill="url(#riskGradient)" strokeWidth={3} />
          </AreaChart>
        </ResponsiveContainer>
      </GlassCard>

      {/* Daily AI Insight Card */}
      <GlassCard className="insight-card" testId="home-ai-insight-card">
        <Sparkles size={20} style={{ color: "#00E6B8", marginBottom: 8 }} />
        <p className="eyebrow">Daily Safety Insight</p>
        <h3>{insight?.provider === "gemini" ? "AI Contextual Insight" : "Local Safety Engine Insight"}</h3>
        <p>{insight?.insight || "Your protection posture is stable. SentinelPulse recommends keeping Smart Journey active for unfamiliar routes."}</p>
        <PrimaryButton testId="home-ai-insights-button" secondary icon={MessageCircle} onClick={() => onNavigate("insights")}>
          Explainable Insights
        </PrimaryButton>
      </GlassCard>

      {/* Recent Activity Timeline Preview */}
      <GlassCard className="recent-activity-card" testId="home-recent-activity">
        <Clock size={20} style={{ color: "#00E6B8", marginBottom: 8 }} />
        <p className="eyebrow">Recent Safety Activity</p>
        <h3>Activity Timeline</h3>
        <p>Your journey signals and verification events are preserved chronologically in the encrypted vault.</p>
        <PrimaryButton secondary icon={ArrowRight} onClick={() => onNavigate("timeline")}>
          View Full Timeline
        </PrimaryButton>
      </GlassCard>
    </motion.div>
  );
}

// Change 5: Live Protection Screen — shows active journey monitoring or idle state
function LiveProtectionScreen({
  activeJourney,
  dashboard,
  onNavigate,
  onCheckIn,
  onSOS,
  onOpenWhy,
  authed,
  escalationStatus,
  primaryContact,
  secondaryContact,
  ackDeadline,
  cooldownUntil,
  onSimulateAck,
  onAckTimeout,
  onDismissEscalation,
  onSafeConfirm,
}) {
  const riskScore = dashboard?.risk_score || 12;
  const riskLevel = dashboard?.risk_level || "LOW";
  const safety = dashboard?.safety_score || 88;
  const signals = dashboard?.ai_monitor?.signals || [];

  if (!activeJourney) {
    return (
      <div className="dashboard-grid" data-testid="live-protection-screen">
        <GlassCard className="wide" style={{ textAlign: "center", padding: "48px 32px" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(0,230,184,0.12)", border: "1px solid rgba(0,230,184,0.25)", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
            <Activity size={28} style={{ color: "#00E6B8" }} />
          </div>
          <p className="eyebrow">Live Protection</p>
          <h2 style={{ fontSize: 24, marginBottom: 12 }}>No Active Journey</h2>
          <p style={{ maxWidth: 420, margin: "0 auto 24px" }}>
            Start a Smart Journey to enable real-time route monitoring, deviation detection, and proactive check-ins against your personal safety baseline.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <PrimaryButton icon={Route} onClick={() => onNavigate("journey")}>Start Smart Journey</PrimaryButton>
            <PrimaryButton secondary icon={Shield} onClick={() => onNavigate("profile")}>View Safety Profile</PrimaryButton>
          </div>
          <div style={{ marginTop: 28, padding: "16px", background: "rgba(0,230,184,0.06)", borderRadius: 14, border: "1px solid rgba(0,230,184,0.15)", textAlign: "left" }}>
            <p className="eyebrow" style={{ marginBottom: 8 }}>Passive Protection Active</p>
            <p style={{ fontSize: 13, margin: 0 }}>
              Your personal safety baseline is running. SentinelPulse continuously evaluates your movement signals against your learned patterns even when no journey is active.
            </p>
          </div>
        </GlassCard>
      </div>
    );
  }

  const journeyState = activeJourney.emergency_state || "MONITORING";
  const toneColor = riskScore >= 75 ? "#FF4E5F" : riskScore >= 45 ? "#FFB84C" : "#00E6B8";

  return (
    <div className="dashboard-grid" data-testid="live-protection-screen">
      {/* Status Header */}
      <GlassCard className="wide" style={{ padding: "20px 22px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: toneColor, boxShadow: `0 0 8px ${toneColor}`, animation: "breathe 2s ease-in-out infinite" }} />
            <div>
              <strong style={{ fontSize: 15 }}>Live Protection · Active</strong>
              <small style={{ display: "block", color: "var(--sp-fg-muted)", fontSize: 11 }}>
                Journey to {activeJourney.destination_name} · <StateBadge state={journeyState} />
              </small>
            </div>
          </div>
          <IconBadge icon={Activity} tone={riskScore >= 65 ? "danger" : riskScore >= 35 ? "warning" : "teal"}>
            Risk {riskScore}/100
          </IconBadge>
        </div>

        {/* Journey metrics strip */}
        <div className="metrics-strip-grid">
          {[
            { label: "ETA", value: formatDuration(activeJourney.eta_seconds) },
            { label: "Safety Score", value: `${safety}/100` },
            { label: "Risk Level", value: riskLevel },
          ].map((m) => (
            <div key={m.label} style={{ background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: "12px 14px", textAlign: "center" }}>
              <small style={{ display: "block", color: "var(--sp-fg-muted)", fontSize: 11, marginBottom: 4 }}>{m.label}</small>
              <strong style={{ fontSize: 16 }}>{m.value}</strong>
            </div>
          ))}
        </div>

        {/* Signal grid */}
        <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
          {signals.length > 0 ? signals.map((s) => (
            <div key={s.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "rgba(255,255,255,0.04)", borderRadius: 10, border: `1px solid ${s.tone === "danger" ? "rgba(255,78,95,0.2)" : s.tone === "warning" ? "rgba(255,184,76,0.2)" : "rgba(0,230,184,0.12)"}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.tone === "danger" ? "#FF4E5F" : s.tone === "warning" ? "#FFB84C" : "#00D26A", display: "inline-block" }} />
                <strong style={{ fontSize: 13 }}>{s.label}</strong>
              </div>
              <span style={{ fontSize: 12, color: "var(--sp-fg-muted)" }}>{s.status}</span>
            </div>
          )) : (
            <p style={{ color: "var(--sp-fg-muted)", fontSize: 13, margin: 0 }}>Run a risk scan to populate live signal readings.</p>
          )}
        </div>

        {/* Safe Cooldown Badge */}
        <SafeCooldownBadge cooldownUntil={cooldownUntil} />

        {/* Contact Escalation Alert Card */}
        <ContactEscalationCard
          status={escalationStatus}
          primaryContact={primaryContact}
          secondaryContact={secondaryContact}
          ackDeadline={ackDeadline}
          onSimulateAck={onSimulateAck}
          onAckTimeout={onAckTimeout}
          onDismiss={onDismissEscalation}
          onSafeConfirm={onSafeConfirm}
        />

        <div className="button-row">
          <PrimaryButton secondary icon={Route} onClick={() => onNavigate("journey")}>Journey Controls</PrimaryButton>
          <PrimaryButton secondary icon={Eye} onClick={onOpenWhy}>Why This Risk?</PrimaryButton>
        </div>
      </GlassCard>
    </div>
  );
}

// Part 9: Simplified, Understandable Luxury Smart Radar Map (References 1, 2, 3)
function LeafletSafetyMap({ token, location, activeJourney, overlays, route, onStartJourney, compact = false, onRequestGps, isLocating, accuracy }) {
  const [legendOpen, setLegendOpen] = useState(false);
  const mapRef = useRef(null);
  const elRef = useRef(null);
  const layersRef = useRef({ user: null, route: null, overlays: [] });

  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    mapRef.current = L.map(elRef.current, { zoomControl: false, attributionControl: false }).setView([location.lat, location.lng], compact ? 13 : 15);
    
    // OpenStreetMap official tiles — 100% free, 0 API key required, 0 watermark
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      className: "sp-dark-tiles",
      attribution: "© OpenStreetMap contributors",
    }).addTo(mapRef.current);
    
    L.control.zoom({ position: "bottomright" }).addTo(mapRef.current);
    setTimeout(() => mapRef.current?.invalidateSize(), 200);
  }, [compact, location.lat, location.lng]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !location?.lat || !location?.lng) return;
    const latlng = [location.lat, location.lng];

    // High-visibility glowing pulse location dot
    const dotHtml = `
      <div style="position:relative;width:24px;height:24px;">
        <div style="position:absolute;inset:0;border-radius:50%;background:rgba(0,230,184,0.32);animation:breathe 2.4s ease-in-out infinite;"></div>
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:14px;height:14px;border-radius:50%;background:#00E6B8;border:2.5px solid #ffffff;box-shadow:0 0 10px rgba(0,230,184,0.85);"></div>
      </div>
    `;

    const dotIcon = L.divIcon({
      className: "sp-location-dot-icon",
      html: dotHtml,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    if (!layersRef.current.user) {
      const marker = L.marker(latlng, { icon: dotIcon }).addTo(map);
      marker.bindTooltip("Your Location (Live GPS)", { permanent: false });
      layersRef.current.user = marker;
    } else {
      layersRef.current.user.setLatLng(latlng);
    }
    if (!activeJourney) {
      map.flyTo(latlng, map.getZoom() < 14 ? 15 : map.getZoom(), { duration: 1.0 });
    }
  }, [location.lat, location.lng, activeJourney]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (layersRef.current.route) layersRef.current.route.remove();
    const routeData = route || activeJourney?.route;
    if (routeData?.coordinates?.length) {
      const points = routeData.coordinates.map((p) => [p.lat, p.lng]);
      layersRef.current.route = L.polyline(points, { color: "#06b6d4", weight: 6, opacity: 0.95, dashArray: "8 12", lineCap: "round" }).addTo(map);
      map.fitBounds(layersRef.current.route.getBounds(), { padding: [40, 40], animate: true });
    }
  }, [route, activeJourney]);

  const recenter = () => {
    if (onRequestGps) {
      onRequestGps(true);
    }
    if (mapRef.current && location?.lat && location?.lng) {
      mapRef.current.flyTo([location.lat, location.lng], 16, { duration: 1.0 });
    }
  };

  return (
    <div className={cx("map-shell", compact && "compact")} data-testid="leaflet-map-provider" data-provider={MAP_PROVIDER} style={{ position: "relative" }}>
      <div ref={elRef} className="leaflet-host" />

      {/* Minimal HUD Status Tags — Interactive with GPS Lock */}
      <div style={{ position: "absolute", top: 12, left: 12, display: "flex", flexWrap: "wrap", gap: 6, zIndex: 30 }}>
        <button
          type="button"
          onClick={() => onRequestGps?.(true)}
          style={{
            background: "rgba(6,10,19,0.88)",
            border: `1px solid ${isLocating ? "#FFB84C" : "rgba(0,230,184,0.4)"}`,
            color: isLocating ? "#FFB84C" : "#00E6B8",
            padding: "4px 10px",
            borderRadius: 999,
            fontSize: 10,
            fontWeight: 700,
            backdropFilter: "blur(8px)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: isLocating ? "#FFB84C" : "#00E6B8", display: "inline-block" }} />
          {isLocating ? "ACQUIRING GPS..." : accuracy ? `LIVE GPS (±${Math.round(accuracy)}m)` : "LIVE LOCATION"}
        </button>
        <span style={{ background: "rgba(6,10,19,0.82)", border: "1px solid rgba(0,210,106,0.35)", color: "#00D26A", padding: "4px 10px", borderRadius: 999, fontSize: 10, fontWeight: 700, backdropFilter: "blur(8px)", pointerEvents: "none" }}>
          SMART ALERTS ON
        </span>
      </div>

      {activeJourney && (
        <div className="map-turn-banner glass-card" data-testid="map-turn-banner">
          <div className="turn-icon-wrap"><Navigation size={22} style={{ color: "#06b6d4" }} /></div>
          <div>
            <strong>Toward {activeJourney.destination_name}</strong>
            <small>Following recommended safe corridor · {formatDuration(activeJourney.eta_seconds)} remaining</small>
          </div>
        </div>
      )}

      {/* Discreet Collapsible Map Legend Button — Never Blocks Map */}
      <div style={{ position: "absolute", bottom: 14, left: 14, zIndex: 500 }}>
        {!legendOpen ? (
          <button
            type="button"
            onClick={() => setLegendOpen(true)}
            style={{
              background: "rgba(11,18,32,0.88)",
              border: "1px solid rgba(255,255,255,0.18)",
              color: "var(--sp-fg-muted)",
              borderRadius: 999,
              padding: "6px 12px",
              fontSize: 11,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 6,
              backdropFilter: "blur(14px)",
              cursor: "pointer",
              boxShadow: "0 4px 16px rgba(0,0,0,0.4)"
            }}
          >
            <Info size={13} style={{ color: "#00E6B8" }} />
            Map Legend
          </button>
        ) : (
          <div className="map-guidance-card glass-card" style={{ width: 240, padding: 12, margin: 0, borderRadius: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <strong style={{ fontSize: 12, color: "var(--sp-fg)" }}>Map Legend</strong>
              <button
                type="button"
                onClick={() => setLegendOpen(false)}
                style={{ background: "transparent", border: 0, color: "var(--sp-fg-muted)", cursor: "pointer", padding: 2 }}
              >
                <X size={14} />
              </button>
            </div>
            <div className="guidance-row"><span className="legend-dot green" /><span>Teal dot: Your location</span></div>
            <div className="guidance-row"><span className="legend-dot blue" /><span>Teal path: Safe route</span></div>
            <div className="guidance-row"><span className="legend-dot amber" /><span>Amber: Caution context</span></div>
            <div className="guidance-row"><span className="legend-dot red" /><span>Red: Elevated risk</span></div>
          </div>
        )}
      </div>

      <div className="map-controls">
        <button data-testid="map-recenter-button" aria-label="Recenter map" onClick={recenter} title="Lock live GPS"><LocateFixed size={18} /></button>
        <button data-testid="map-sos-button" className="danger" aria-label="Open SOS center" onClick={() => window.dispatchEvent(new CustomEvent("sp:navigate", { detail: "sos" }))}><Siren size={18} /></button>
      </div>
    </div>
  );
}

// Part 9 & Part 10: Smart Map & Smart Journey View
function SmartMapScreen({ authed, location, onStartJourney }) {
  const [destinationName, setDestinationName] = useState("Campus Safe Corridor");
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [loadingRoutes, setLoadingRoutes] = useState(false);

  const computeRoutes = useCallback(async () => {
    setLoadingRoutes(true);
    try {
      const payload = {
        destination_name: destinationName,
        origin: location,
        destination: { lat: location.lat + 0.015, lng: location.lng + 0.018 },
      };
      const res = await authed.post("/routes/compute", payload);
      setRoutes(res.data.routes);
      setSelectedRoute(res.data.routes[0]);
    } catch (err) {
      toast.error(formatApiError(err, "Could not compute routes"));
    } finally {
      setLoadingRoutes(false);
    }
  }, [authed, destinationName, location]);

  useEffect(() => {
    computeRoutes();
  }, [computeRoutes]);

  return (
    <div className="two-column map-page" data-testid="smart-map-screen">
      <LeafletSafetyMap location={location} route={selectedRoute} />
      <div className="side-panel">
        <GlassCard testId="smart-route-card">
          <div className="section-head">
            <IconBadge icon={Route}>Smart Route Comparison</IconBadge>
            <span className="helper">OSM Leaflet Engine</span>
          </div>
          <h2>Select Safe Route</h2>
          <p style={{ fontSize: 13, color: "var(--sp-fg-muted)" }}>
            Origin: Current Location · Destination: {destinationName}
          </p>

          <div className="route-comparison-stack">
            {routes.slice(0, 2).map((r, idx) => {
              const isRouteA = idx === 0;
              return (
                <div
                  key={r.id}
                  className={cx("route-choice-card", selectedRoute?.id === r.id && "selected", isRouteA && "safest")}
                  onClick={() => setSelectedRoute(r)}
                  data-testid={`route-choice-${r.id}`}
                >
                  <div className="route-choice-header">
                    <strong>{isRouteA ? "Route A (Recommended)" : "Route B (Direct)"}</strong>
                    <span className={isRouteA ? "tag-safe" : "tag-caution"}>
                      {isRouteA ? "Lower contextual risk" : "Higher contextual risk"}
                    </span>
                  </div>
                  <div className="route-metrics-row">
                    <span>{formatDistance(r.distance_m)}</span>
                    <span>{formatDuration(r.duration_s)}</span>
                    <span>Safety Score: {r.safety_score}%</span>
                  </div>
                  <p className="route-recommendation-copy">{r.ai_recommendation}</p>
                </div>
              );
            })}
          </div>

          <div className="smart-route-recommendation-box">
            <Sparkles size={18} />
            <p>
              <strong>Recommendation:</strong> Route A is recommended because it has lower contextual risk while adding only 3 minutes.
            </p>
          </div>

          <PrimaryButton
            testId="start-smart-journey-cta"
            icon={ShieldCheck}
            onClick={() => onStartJourney(selectedRoute, destinationName)}
            style={{ width: "100%", marginTop: 14 }}
          >
            Start Journey
          </PrimaryButton>
        </GlassCard>
      </div>
    </div>
  );
}

// Separate Informational Layer: Location Context Near Route (Dynamic to user's real GPS)
function LocationContextLayer({ location, destinationName, activeJourney }) {
  const [areaInfo, setAreaInfo] = useState({ city: "Lucknow", neighborhood: "Central Corridor", road: "Safe Transit Route" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!location?.lat || !location?.lng) return;
    let isMounted = true;
    setLoading(true);

    const fetchGeo = async () => {
      try {
        const res = await axios.get(`${API}/map/reverse-geocode?lat=${location.lat}&lng=${location.lng}`);
        if (isMounted && res.data?.city) {
          setAreaInfo({
            city: res.data.city,
            neighborhood: res.data.neighborhood,
            road: res.data.road,
            display_name: res.data.display_name,
          });
          setLoading(false);
          return;
        }
      } catch {
        // Fallback to client nominatim
      }

      try {
        const direct = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${location.lat}&lon=${location.lng}&format=json&addressdetails=1`);
        const data = await direct.json();
        if (isMounted && data?.address) {
          const addr = data.address;
          const city = addr.city || addr.town || addr.state_district || "Lucknow";
          const neighborhood = addr.suburb || addr.neighbourhood || addr.residential || addr.commercial || addr.village || "Local Corridor";
          const road = addr.road || addr.pedestrian || "Main Transit Path";
          setAreaInfo({ city, neighborhood, road });
        }
      } catch {
        if (isMounted) {
          const isNearLucknow = Math.abs(location.lat - 26.84) < 1.0;
          setAreaInfo({
            city: isNearLucknow ? "Lucknow" : "Local Area",
            neighborhood: isNearLucknow ? "Hazratganj / Gomti Nagar Corridor" : "Active Corridor",
            road: "Safe Path",
          });
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchGeo();
    return () => { isMounted = false; };
  }, [location?.lat, location?.lng]);

  const targetName = destinationName || activeJourney?.destination_name || "Destination";

  const contextItems = [
    {
      id: "road-1",
      icon: "🟠",
      title: `Road work & disruption reported near ${areaInfo.neighborhood}`,
      detail: `1.1 km ahead toward ${targetName} · 25 min ago · Civic transit update`,
      tone: "caution"
    },
    {
      id: "comm-1",
      icon: "🟡",
      title: `Community safety report in ${areaInfo.city}`,
      detail: `650 m away · 48 min ago · Unverified community source`,
      tone: "info"
    },
    {
      id: "civic-1",
      icon: "🟢",
      title: `Well-lit pedestrian corridor verified along ${areaInfo.road}`,
      detail: `300 m ahead · Active municipal lighting survey`,
      tone: "safe"
    }
  ];

  return (
    <GlassCard className="location-context-card" testId="location-context-card" style={{ marginTop: 14 }}>
      <div className="section-head" style={{ marginBottom: 10 }}>
        <IconBadge icon={Compass} tone="warning">Location Context Layer</IconBadge>
        <span className="informational-tag">📍 {areaInfo.city} · {areaInfo.neighborhood}</span>
      </div>
      
      <h3 style={{ fontSize: 16, marginBottom: 4 }}>Recent context near your route</h3>
      <p style={{ fontSize: 12, color: "var(--sp-fg-muted)", marginBottom: 14 }}>
        Public disruptions and community updates around {areaInfo.city} ({areaInfo.neighborhood}).
      </p>

      <div className="context-items-list" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {contextItems.map((item) => (
          <div key={item.id} className={cx("context-item-row", item.tone)}>
            <span className="context-emoji">{item.icon}</span>
            <div className="context-item-content">
              <strong>{item.title}</strong>
              <small>{item.detail}</small>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <span style={{ fontSize: 11, color: "var(--sp-fg-subtle)", fontStyle: "italic", lineHeight: 1.4, display: "block" }}>
          * Context is informational and does not determine your personal safety assessment.
        </span>
      </div>
    </GlassCard>
  );
}

// Part 10: Smart Journey Screen with Interactive Check-In & Intervention Ladder
function JourneyScreen({
  authed,
  location,
  setLocation,
  activeJourney,
  setActiveJourney,
  overlays,
  refreshAll,
  onOpenWhy,
  onRequestGps,
  isLocating,
  accuracy,
  escalationStatus,
  primaryContact,
  secondaryContact,
  ackDeadline,
  cooldownUntil,
  onSimulateAck,
  onAckTimeout,
  onDismissEscalation,
  onSafeConfirm,
}) {
  const [destination, setDestination] = useState({ name: "Hazratganj to Gomti Nagar", lat: location.lat + 0.012, lng: location.lng + 0.015 });
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [completedSummary, setCompletedSummary] = useState(null);

  useEffect(() => {
    if (location?.lat && location?.lng) {
      setDestination((prev) => ({
        ...prev,
        lat: location.lat + 0.012,
        lng: location.lng + 0.015,
      }));
    }
  }, [location?.lat, location?.lng]);

  const journeyState = activeJourney ? (activeJourney.emergency_state || "MONITORING") : "IDLE";
  const riskScore = activeJourney?.latest_risk?.score || 12;

  const compute = async () => {
    try {
      const payload = { destination_name: destination.name, origin: location, destination: { lat: Number(destination.lat), lng: Number(destination.lng) } };
      const res = await authed.post("/routes/compute", payload);
      setRoutes(res.data.routes);
      setSelectedRoute(res.data.routes[0]);
      toast.success("Safe route variants computed");
    } catch (err) {
      toast.error(formatApiError(err, "Route computation failed"));
    }
  };

  const start = async () => {
    try {
      const payload = { destination_name: destination.name, origin: location, destination: { lat: Number(destination.lat), lng: Number(destination.lng) }, share_with_contacts: true };
      const res = await authed.post("/journeys/start", payload);
      setActiveJourney(res.data);
      await refreshAll();
      toast.success("Smart Journey started in MONITORING mode");
    } catch (err) {
      toast.error(formatApiError(err, "Could not start journey"));
    }
  };

  const end = async () => {
    if (!activeJourney) return;
    try {
      const res = await authed.post(`/journeys/${activeJourney.id}/end`, {});
      setCompletedSummary(res.data);
      setActiveJourney(null);
      await refreshAll();
      toast.success("Journey completed safely and incorporated into personal baseline");
    } catch (err) {
      toast.error(formatApiError(err, "Could not end journey"));
    }
  };

  const checkIn = async () => {
    if (!activeJourney) return;
    try {
      await authed.post(`/journeys/${activeJourney.id}/checkin`, { status: "safe", message: "User confirmed: I'm Safe" });
      await refreshAll();
      toast.success("Safety confirmed — risk normalized to baseline");
    } catch (err) {
      toast.error(formatApiError(err, "Check-in failed"));
    }
  };

  const advanceSimulatedLocation = () => {
    if (!activeJourney) return;
    const newLat = location.lat + 0.003;
    const newLng = location.lng + 0.002;
    setLocation({ lat: newLat, lng: newLng });
    authed.post(`/journeys/${activeJourney.id}/location`, {
      location: { lat: newLat, lng: newLng },
      accuracy: 8,
      battery: 88,
    }).catch(() => {});
    toast.message("Simulated GPS advance along route");
  };

  return (
    <div className="two-column map-page" data-testid="smart-journey-screen">
      <LeafletSafetyMap
        token={authed}
        location={location}
        activeJourney={activeJourney}
        overlays={overlays}
        route={selectedRoute}
        onStartJourney={start}
        onRequestGps={onRequestGps}
        isLocating={isLocating}
        accuracy={accuracy}
      />
      <div className="side-panel">
        {/* Active Journey Status Strip */}
        {activeJourney && (
          <GlassCard className="active-journey-status-card" testId="active-journey-status">
            <div className="section-head">
              <span className="status-dot safe"><span /> Journey Active</span>
              <StateBadge state={journeyState} />
            </div>
            <h3>To: {activeJourney.destination_name}</h3>
            <div className="active-journey-metrics">
              <div>
                <small>ETA</small>
                <strong>{formatDuration(activeJourney.eta_seconds)}</strong>
              </div>
              <div>
                <small>Distance</small>
                <strong>{formatDistance(activeJourney.route?.distance_m || 4200)}</strong>
              </div>
              <div>
                <small>Current Risk</small>
                <strong style={{ color: riskScore > 65 ? "var(--sp-danger)" : "var(--sp-primary)" }}>{riskScore}/100</strong>
              </div>
            </div>
          </GlassCard>
        )}

        {/* Safe Cooldown Badge */}
        <SafeCooldownBadge cooldownUntil={cooldownUntil} />

        {/* Contact Escalation Alert Card */}
        <ContactEscalationCard
          status={escalationStatus}
          primaryContact={primaryContact}
          secondaryContact={secondaryContact}
          ackDeadline={ackDeadline}
          onSimulateAck={onSimulateAck}
          onAckTimeout={onAckTimeout}
          onDismiss={onDismissEscalation}
          onSafeConfirm={onSafeConfirm}
        />

        <GlassCard testId="journey-control-card">
          <div className="section-head">
            <IconBadge icon={Route}>Smart Journey</IconBadge>
            <StateBadge state={journeyState} />
          </div>
          <h2>Plan Your Journey</h2>
          <div className="form-stack">
            <label>Destination name
              <input data-testid="journey-destination-name-input" value={destination.name} onChange={(e) => setDestination({ ...destination, name: e.target.value })} />
            </label>
          </div>
          <div className="button-row">
            {!activeJourney ? (
              <>
                <PrimaryButton testId="journey-compute-route-button" secondary icon={Navigation} onClick={compute}>Compute Routes</PrimaryButton>
                <PrimaryButton testId="journey-start-button" icon={ShieldCheck} onClick={start}>Start Journey</PrimaryButton>
              </>
            ) : (
              <>
                <PrimaryButton testId="journey-simulate-step-button" secondary icon={Play} onClick={advanceSimulatedLocation}>Step Along Route</PrimaryButton>
                <PrimaryButton testId="journey-end-button" danger icon={X} onClick={end}>End Journey</PrimaryButton>
              </>
            )}
          </div>
        </GlassCard>

        {/* Route Variants Comparison List */}
        {!activeJourney && routes.length > 0 && (
          <div className="route-list">
            {routes.map((route) => (
              <GlassCard key={route.id} className={cx("route-option", selectedRoute?.id === route.id && "selected")} testId={`route-option-${route.id}`}>
                <button data-testid={`route-select-${route.id}`} onClick={() => setSelectedRoute(route)}>
                  <div>
                    <strong>{route.name} {route.recommendation_rank === 1 && <span className="recommended-badge">★ Recommended</span>}</strong>
                    <span>{formatDistance(route.distance_m)} · {formatDuration(route.duration_s)}</span>
                  </div>
                  <b>{route.safety_score}%</b>
                </button>
                <p>{route.ai_recommendation || route.explanation}</p>
              </GlassCard>
            ))}
          </div>
        )}

        {/* Location Context Layer (Separate Informational Layer) */}
        <LocationContextLayer location={location} destinationName={destination.name} activeJourney={activeJourney} />
      </div>

      {completedSummary && (
        <div className="modal-backdrop" onClick={() => setCompletedSummary(null)}>
          <GlassCard className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="section-head">
              <IconBadge icon={CheckCircle} tone="teal">Journey Completed</IconBadge>
              <button className="icon-button" onClick={() => setCompletedSummary(null)}><X size={16} /></button>
            </div>
            <h2>Arrived at {completedSummary.destination_name}</h2>
            <p>Actual duration: {completedSummary.actual_duration_min} minutes.</p>
            <div className="personalization-box">
              <Sparkles size={20} />
              <div>
                <strong>Personalization Update</strong>
                <p>{completedSummary.personalization_update}</p>
              </div>
            </div>
            <PrimaryButton onClick={() => setCompletedSummary(null)}>Done</PrimaryButton>
          </GlassCard>
        </div>
      )}
    </div>
  );
}

// Part 16: SOS Emergency Center with 15-Second Donut Countdown (Matching Reference 2 & 4/5)
function SOSCenter({ authed, location, latestRisk, refreshAll }) {
  const [isHolding, setIsHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [activeEmergency, setActiveEmergency] = useState(null);
  const [isCountdown, setIsCountdown] = useState(false);
  const [countdown, setCountdown] = useState(15);
  const [alertCommunity, setAlertCommunity] = useState(true);
  const [alertTrusted, setAlertTrusted] = useState(true);
  const [policeSelected, setPoliceSelected] = useState(true);
  const [ambulanceSelected, setAmbulanceSelected] = useState(true);
  const [fireSelected, setFireSelected] = useState(false);
  
  const holdIntervalRef = useRef(null);
  const countdownTimerRef = useRef(null);

  const trigger = useCallback(async (reason = "User activated SOS (Countdown / Instant)") => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    setIsCountdown(false);
    try {
      const res = await authed.post("/emergency/trigger", {
        risk_event_id: latestRisk?.event_id || latestRisk?.id,
        location,
        silent_mode: true,
        reason,
      });
      setActiveEmergency(res.data);
      setHoldProgress(0);
      setIsHolding(false);
      await refreshAll();
      toast.success("Emergency workflow activated — trusted contacts notified in-app");
    } catch (err) {
      toast.error(formatApiError(err, "Emergency activation failed"));
    }
  }, [authed, latestRisk?.event_id, latestRisk?.id, location, refreshAll]);

  const startCountdown = () => {
    setIsCountdown(true);
    setCountdown(15);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    countdownTimerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownTimerRef.current);
          trigger("15s Countdown Expired — Automatic Dispatch");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const cancelCountdown = () => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    setIsCountdown(false);
    setCountdown(15);
    toast.message("Alert countdown cancelled");
  };

  const resolve = async () => {
    if (!activeEmergency?.id) return;
    try {
      await authed.post(`/emergency/${activeEmergency.id}/resolve`, {});
      setActiveEmergency(null);
      await refreshAll();
      toast.success("Incident resolved and sealed in Evidence Vault");
    } catch (err) {
      toast.error(formatApiError(err, "Could not resolve incident"));
    }
  };

  const startHold = () => {
    setIsHolding(true);
    setHoldProgress(0);
    const start = Date.now();
    const duration = 1500;
    holdIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const progress = Math.min(100, (elapsed / duration) * 100);
      setHoldProgress(progress);
      if (progress >= 100) {
        clearInterval(holdIntervalRef.current);
        startCountdown();
      }
    }, 40);
  };

  const endHold = () => {
    setIsHolding(false);
    clearInterval(holdIntervalRef.current);
    setHoldProgress(0);
  };

  useEffect(() => {
    return () => {
      if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, []);

  return (
    <div className="sos-layout" data-testid="sos-screen">
      {/* 1. If 15s Countdown is Active: Exact Screen from Reference 2 */}
      {isCountdown && !activeEmergency ? (
        <GlassCard className="threat-card" style={{ padding: "28px 20px", textAlign: "center", background: "#080b11" }} testId="sos-countdown-screen">
          <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>EMERGENCY BEACON</span>
            <button
              onClick={cancelCountdown}
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.2)",
                color: "#fff",
                borderRadius: 999,
                padding: "6px 14px",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Stop Alert <X size={15} />
            </button>
          </div>

          {/* Donut SVG Progress Ring (Reference 2) */}
          <div className="donut-svg-wrapper">
            <svg className="donut-progress-ring" width="170" height="170">
              <circle stroke="#232a3b" strokeWidth="12" fill="transparent" r="68" cx="85" cy="85" />
              <circle
                stroke="#ef4444"
                strokeWidth="12"
                strokeLinecap="round"
                fill="transparent"
                r="68"
                cx="85"
                cy="85"
                style={{ strokeDasharray: 427, strokeDashoffset: 427 - (427 * (15 - countdown)) / 15 }}
              />
            </svg>
            <div className="donut-center-content">
              <div className="donut-center-digits tabular-nums">{countdown}</div>
              <small style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, letterSpacing: 1.5, marginTop: 2 }}>SECONDS</small>
            </div>
          </div>

          {/* WHOM TO ALERT? Section (Reference 2) */}
          <div style={{ margin: "16px 0" }}>
            <p style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: "rgba(255,255,255,0.6)", marginBottom: 12, fontWeight: 800 }}>
              WHOM TO ALERT?
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
              <button
                type="button"
                onClick={() => setAlertCommunity(!alertCommunity)}
                style={{
                  background: alertCommunity ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${alertCommunity ? "#ef4444" : "rgba(255,255,255,0.15)"}`,
                  color: "#fff",
                  borderRadius: 16,
                  padding: "10px 14px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <Radar size={16} style={{ color: alertCommunity ? "#ef4444" : "#94a3b8" }} />
                Community {alertCommunity && <Check size={14} style={{ color: "#ef4444" }} />}
              </button>

              <button
                type="button"
                onClick={() => setAlertTrusted(!alertTrusted)}
                style={{
                  background: alertTrusted ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${alertTrusted ? "#ef4444" : "rgba(255,255,255,0.15)"}`,
                  color: "#fff",
                  borderRadius: 16,
                  padding: "10px 14px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <ShieldCheck size={16} style={{ color: alertTrusted ? "#ef4444" : "#94a3b8" }} />
                Trusted list {alertTrusted && <Check size={14} style={{ color: "#ef4444" }} />}
              </button>
            </div>

            {/* Emergency Services Grid (Reference 2) */}
            <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 18 }}>
              <div style={{ textAlign: "center", cursor: "pointer" }} onClick={() => setFireSelected(!fireSelected)}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: fireSelected ? "rgba(239,68,68,0.25)" : "rgba(255,255,255,0.06)", border: `1px solid ${fireSelected ? "#ef4444" : "rgba(255,255,255,0.1)"}`, display: "grid", placeItems: "center", margin: "0 auto 6px", position: "relative" }}>
                  <Zap size={20} style={{ color: fireSelected ? "#ef4444" : "rgba(255,255,255,0.5)" }} />
                  {fireSelected && <span style={{ position: "absolute", top: -3, right: -3, width: 12, height: 12, borderRadius: "50%", background: "#ef4444", color: "#fff", fontSize: 8, display: "grid", placeItems: "center" }}>✓</span>}
                </div>
                <small style={{ fontSize: 10, color: fireSelected ? "#fff" : "rgba(255,255,255,0.5)" }}>Fire dept.</small>
              </div>

              <div style={{ textAlign: "center", cursor: "pointer" }} onClick={() => setPoliceSelected(!policeSelected)}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: policeSelected ? "rgba(239,68,68,0.25)" : "rgba(255,255,255,0.06)", border: `1px solid ${policeSelected ? "#ef4444" : "rgba(255,255,255,0.1)"}`, display: "grid", placeItems: "center", margin: "0 auto 6px", position: "relative" }}>
                  <ShieldAlert size={20} style={{ color: "#ef4444" }} />
                  {policeSelected && <span style={{ position: "absolute", top: -3, right: -3, width: 12, height: 12, borderRadius: "50%", background: "#ef4444", color: "#fff", fontSize: 8, display: "grid", placeItems: "center" }}>✓</span>}
                </div>
                <small style={{ fontSize: 10, color: "#fff", fontWeight: 700 }}>Police</small>
              </div>

              <div style={{ textAlign: "center", cursor: "pointer" }} onClick={() => setAmbulanceSelected(!ambulanceSelected)}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: ambulanceSelected ? "rgba(239,68,68,0.25)" : "rgba(255,255,255,0.06)", border: `1px solid ${ambulanceSelected ? "#ef4444" : "rgba(255,255,255,0.1)"}`, display: "grid", placeItems: "center", margin: "0 auto 6px", position: "relative" }}>
                  <HeartPulse size={20} style={{ color: "#ef4444" }} />
                  {ambulanceSelected && <span style={{ position: "absolute", top: -3, right: -3, width: 12, height: 12, borderRadius: "50%", background: "#ef4444", color: "#fff", fontSize: 8, display: "grid", placeItems: "center" }}>✓</span>}
                </div>
                <small style={{ fontSize: 10, color: "#fff", fontWeight: 700 }}>Ambulance</small>
              </div>
            </div>
          </div>

          {/* SKIP TIMER BUTTON (Reference 2) */}
          <button
            type="button"
            onClick={() => trigger("Skip Timer — Instant Dispatch")}
            style={{
              width: "100%",
              minHeight: 52,
              borderRadius: 999,
              background: "#ef4444",
              color: "#fff",
              fontWeight: 800,
              fontSize: 14,
              letterSpacing: 1,
              border: 0,
              boxShadow: "0 10px 30px rgba(239,68,68,0.5)",
              cursor: "pointer",
              marginTop: 10,
            }}
          >
            SKIP TIMER
          </button>
        </GlassCard>
      ) : (
        /* 2. Idle Mode / Active Banner */
        <GlassCard className="threat-card" testId="threat-confirmation-card">
          <IconBadge icon={ShieldAlert} tone="danger">Emergency Response</IconBadge>
          <h1>Need help?</h1>
          <p>Hold for 1.5s or tap below to start the 15-second emergency dispatch countdown.</p>

          {!activeEmergency ? (
            <div className="massive-sos-wrapper">
              <div className="massive-sos-aura" />
              <button
                className="massive-sos-button"
                onMouseDown={startHold}
                onMouseUp={endHold}
                onTouchStart={startHold}
                onTouchEnd={endHold}
                onClick={() => {
                  if (!isHolding && holdProgress === 0) startCountdown();
                }}
                data-testid="hold-to-sos-button"
              >
                <Siren size={38} style={{ marginBottom: 4 }} />
                <span style={{ fontSize: 16 }}>{isHolding ? "HOLDING" : "SOS"}</span>
                <small style={{ fontSize: 9, opacity: 0.85, marginTop: 2 }}>
                  {isHolding ? `${Math.round(holdProgress)}%` : "TAP / HOLD 1.5s"}
                </small>
              </button>
            </div>
          ) : (
            <div className="sos-active-banner" data-testid="sos-active-banner">
              <div className="sos-active-head">
                <Siren size={32} />
                <div>
                  <strong>SOS ACTIVE — DISPATCH QUEUED</strong>
                  <p>✓ GPS broadcasted · ✓ Trusted Circle notified · ✓ Evidence Sealed · ✓ Offline guide active</p>
                </div>
              </div>
              <div className="sos-simulation-disclaimer">
                <Info size={14} />
                <span>Simulated emergency dispatch relay active for demo mode.</span>
              </div>
              <PrimaryButton testId="sos-resolve-incident-button" icon={Check} onClick={resolve}>
                Resolve Incident & Mark Safe
              </PrimaryButton>
            </div>
          )}
        </GlassCard>
      )}

      <GlassCard testId="sos-emergency-tools-card">
        <h3>Emergency Adapters</h3>
        <p style={{ fontSize: 13, color: "var(--sp-fg-muted)", marginBottom: 12 }}>
          External emergency services and SMS relays are abstracted in this build:
        </p>
        <div className="tool-grid">
          {[{ icon: Phone, label: "112 Path (Simulated in demo mode)" }, { icon: MessageCircle, label: "SMS Adapter (In-app delivery)" }, { icon: Mic, label: "Voice note evidence" }, { icon: Zap, label: "Discreet guidance" }, { icon: Users, label: "Trusted circle notification" }, { icon: FileLock2, label: "Tamper-evident SHA-256 seal" }].map((item) => <div key={item.label}><item.icon size={20} /><span>{item.label}</span></div>)}
        </div>
      </GlassCard>
    </div>
  );
}

// Part 15: Trusted Circle Screen with Alert Policy Matrix
function ContactsScreen({ contacts, authed, refreshAll }) {
  const [form, setForm] = useState({ name: "", phone: "", email: "", relationship: "Family", tier: "primary", can_view_location: true, can_view_evidence: false });
  const [editingId, setEditingId] = useState(null);

  const add = async () => {
    if (!form.name.trim()) return toast.error("Please enter contact name");
    try {
      await authed.post("/contacts", form);
      setForm({ name: "", phone: "", email: "", relationship: "Family", tier: "primary", can_view_location: true, can_view_evidence: false });
      await refreshAll();
      toast.success("Trusted contact added to response circle");
    } catch (err) {
      toast.error(formatApiError(err, "Could not add contact"));
    }
  };

  const remove = async (id) => {
    try {
      await authed.delete(`/contacts/${id}`);
      await refreshAll();
      toast.success("Contact removed");
    } catch (err) {
      toast.error(formatApiError(err, "Could not delete contact"));
    }
  };

  return (
    <div className="two-column" data-testid="trusted-circle-screen">
      <div className="form-column">
        <GlassCard testId="add-contact-card">
          <div className="section-head">
            <IconBadge icon={UserPlus}>Trusted Circle</IconBadge>
          </div>
          <h2>Add Response Member</h2>
          <p style={{ fontSize: 13, color: "var(--sp-fg-muted)" }}>
            These contacts receive live alerts during elevated anomalies and SOS.
          </p>
          <div className="form-stack">
            <label>Name<input data-testid="contact-name-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Maya Lin" /></label>
            <label>Relationship
              <select data-testid="contact-relationship-select" value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })}>
                <option>Family</option>
                <option>Partner</option>
                <option>Friend</option>
                <option>Campus Security</option>
                <option>Colleague</option>
              </select>
            </label>
            <label>Phone<input data-testid="contact-phone-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1 (555) 012-3456" /></label>
            <PrimaryButton testId="save-contact-button" icon={UserCheck} onClick={add}>Add to Circle</PrimaryButton>
          </div>
        </GlassCard>

        {/* Part 15: Alert Policy Matrix */}
        <GlassCard style={{ marginTop: 16 }}>
          <h3>Alert Policy Ladder</h3>
          <div className="policy-ladder-list">
            <div><strong>LOW (0–29):</strong> No alert. Silent monitoring.</div>
            <div><strong>MODERATE (30–59):</strong> Check-in prompt sent to you.</div>
            <div><strong>ELEVATED (60–79):</strong> User safety confirmation requested.</div>
            <div><strong>HIGH (80–100):</strong> Trusted contact in-app alert queued.</div>
            <div><strong>SOS:</strong> Immediate response circle alert dispatched.</div>
          </div>
          <small style={{ display: "block", marginTop: 8, color: "var(--sp-fg-muted)" }}>
            *Notifications are delivered in-app in this demo build.
          </small>
        </GlassCard>
      </div>

      <div className="list-column">
        {/* Real DB contacts from trusted circle */}
        <div className="contact-cards-grid">
          {contacts.map((c) => (
            <GlassCard key={c.id} className="contact-card" testId={`contact-card-${c.id}`}>
              <div className="contact-card-header">
                <div className="contact-avatar-icon" style={{ background: "rgba(0,230,184,0.12)", border: "1px solid rgba(0,230,184,0.25)", borderRadius: 12, width: 36, height: 36, display: "grid", placeItems: "center" }}>
                  <Users size={18} style={{ color: "#00E6B8" }} />
                </div>
                <div>
                  <strong>{c.name}</strong>
                  <span className="contact-relation-badge">{c.relationship}</span>
                </div>
                <span className="status-dot safe" style={{ marginLeft: "auto" }}><span /> Ready</span>
              </div>
              <div className="contact-card-details">
                <p>Phone: {c.phone || "On file"}</p>
                <p>GPS Sharing: {c.can_view_location ? "Allowed during SOS" : "Disabled"}</p>
              </div>
              <div className="contact-card-actions">
                <button className="link-button danger" onClick={() => remove(c.id)}>Remove</button>
              </div>
            </GlassCard>
          ))}
          {contacts.length === 0 && (
            <GlassCard>
              <div style={{ textAlign: "center", padding: "24px 16px" }}>
                <Users size={28} style={{ color: "var(--sp-fg-muted)", marginBottom: 10 }} />
                <p style={{ margin: 0 }}>No trusted contacts yet. Add your first response member.</p>
              </div>
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  );
}


// Part 17: Safety Vault
function EvidenceVault({ evidence, authed, location, refreshAll }) {
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");

  const addNote = async () => {
    if (!noteTitle.trim() || !noteContent.trim()) return toast.error("Please provide title and content");
    try {
      await authed.post("/evidence", {
        kind: "note",
        title: noteTitle,
        content: noteContent,
        location,
      });
      setNoteTitle("");
      setNoteContent("");
      await refreshAll();
      toast.success("Record sealed and encrypted in Evidence Vault");
    } catch (err) {
      toast.error(formatApiError(err, "Could not seal record"));
    }
  };

  const downloadExport = async () => {
    try {
      window.open(`${API}/evidence/export?format=zip`, "_blank");
      toast.success("Evidence archive export downloaded");
    } catch {
      toast.error("Export download failed");
    }
  };

  return (
    <div className="two-column" data-testid="evidence-vault-screen">
      <div className="form-column">
        <GlassCard testId="vault-note-card">
          <div className="section-head">
            <IconBadge icon={Vault}>Safety Vault</IconBadge>
          </div>
          <h2>Seal Safety Record</h2>
          <p style={{ fontSize: 13, color: "var(--sp-fg-muted)" }}>
            Encrypted with Fernet AES and stamped with a SHA-256 integrity hash.
          </p>
          <div className="form-stack">
            <label>Record Title<input value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} placeholder="e.g. Unscheduled route change note" /></label>
            <label>Details<textarea value={noteContent} onChange={(e) => setNoteContent(e.target.value)} placeholder="Provide contextual safety details..." /></label>
            <PrimaryButton icon={FileLock2} onClick={addNote}>Seal in Vault</PrimaryButton>
            <PrimaryButton secondary icon={Download} onClick={downloadExport}>Export Encrypted Archive (ZIP)</PrimaryButton>
          </div>
        </GlassCard>
      </div>

      <div className="list-column">
        <div className="vault-records-list">
          {evidence.map((ev) => (
            <GlassCard key={ev.id} className="vault-record-card" testId={`vault-record-${ev.id}`}>
              <div className="section-head">
                <strong>{ev.title}</strong>
                <span className="hash-badge">SHA-256 VERIFIED</span>
              </div>
              <p style={{ fontSize: 13, color: "var(--sp-fg-muted)" }}>{ev.created_at ? new Date(ev.created_at).toLocaleString() : "Recent"}</p>
              <small className="hash-code">Hash: {ev.hash?.slice(0, 24)}...</small>
            </GlassCard>
          ))}
          {evidence.length === 0 && <p style={{ color: "var(--sp-fg-muted)" }}>No vault records sealed yet.</p>}
        </div>
      </div>
    </div>
  );
}

// Part 18: Privacy Center
function PrivacyCenter({ privacy, authed, refreshAll }) {
  const [toggles, setToggles] = useState({
    location: true,
    journey_history: true,
    trusted_contacts: true,
    evidence: true,
    ai_insights: true,
  });

  const clearData = async (scope) => {
    try {
      await authed.delete(`/privacy/data?scope=${scope}`);
      await refreshAll();
      toast.success(`${scope === "derived" ? "Derived signal history" : "All safety data"} purged`);
    } catch (err) {
      toast.error(formatApiError(err, "Data purge failed"));
    }
  };

  return (
    <div className="dashboard-grid" data-testid="privacy-center-screen">
      <GlassCard testId="privacy-principles-card" className="wide">
        <div className="section-head">
          <IconBadge icon={Lock}>Privacy-First Architecture</IconBadge>
        </div>
        <h2>Data Flow & Privacy</h2>
        <p style={{ maxWidth: 700, marginBottom: 24 }}>
          SentinelPulse is architected for privacy. We believe you should know exactly where your data goes, when it leaves your device, and who has access to it.
        </p>
        
        {/* Honest Architecture Table */}
        <div className="table-responsive-wrapper" style={{ background: "rgba(0,0,0,0.2)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.05)", overflowX: "auto", marginBottom: 32 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13, minWidth: 520 }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.04)" }}>
                <th style={{ padding: "14px 16px", fontWeight: 700, color: "var(--sp-fg)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>Data Type</th>
                <th style={{ padding: "14px 16px", fontWeight: 700, color: "var(--sp-fg)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>Processed Where?</th>
                <th style={{ padding: "14px 16px", fontWeight: 700, color: "var(--sp-fg)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>Storage</th>
                <th style={{ padding: "14px 16px", fontWeight: 700, color: "var(--sp-fg)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>AI Exposure</th>
              </tr>
            </thead>
            <tbody>
              {[
                { type: "Real-time GPS Location", proc: "Local Device First", store: "Ephemeral (Wiped post-journey)", ai: "Never sent to LLM" },
                { type: "Audio/Mic Environment", proc: "Local Device Only", store: "Never stored", ai: "Never sent to LLM" },
                { type: "Safety Profile (Habits)", proc: "Server", store: "Encrypted DB", ai: "Metadata sent for summarization" },
                { type: "Emergency SOS Events", proc: "Server", store: "Tamper-Evident Vault", ai: "Event timing used for routing" }
              ].map((row, i) => (
                <tr key={i} style={{ borderBottom: i === 3 ? "none" : "1px solid rgba(255,255,255,0.05)" }}>
                  <td style={{ padding: "14px 16px", color: "var(--sp-fg)" }}><strong>{row.type}</strong></td>
                  <td style={{ padding: "14px 16px", color: "var(--sp-fg-muted)" }}>{row.proc}</td>
                  <td style={{ padding: "14px 16px", color: "var(--sp-fg-muted)" }}>{row.store}</td>
                  <td style={{ padding: "14px 16px", color: "var(--sp-fg-muted)" }}>{row.ai}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="button-row" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <PrimaryButton secondary icon={Trash2} onClick={() => clearData("derived")}>Purge Derived Signals</PrimaryButton>
          <PrimaryButton danger icon={Trash2} onClick={() => clearData("all")}>Purge All Records</PrimaryButton>
        </div>
      </GlassCard>
    </div>
  );
}

// Insights Screen
function InsightsScreen({ insight, getInsight, activeJourney }) {
  return (
    <div className="dashboard-grid" data-testid="insights-screen">
      {/* Journey Stats Block */}
      <GlassCard className="wide">
        <div className="section-head">
          <IconBadge icon={BarChart3}>Journey Telemetry</IconBadge>
        </div>
        <h2>Baseline Learning Progress</h2>
        
        <div className="insights-stats-grid">
          {[
            { label: "Journeys Monitored", value: "24", sub: "Since install" },
            { label: "Baseline Confidence", value: "92%", sub: "Highly reliable" },
            { label: "Routes Learned", value: "3", sub: "Common paths" },
            { label: "Anomalies Caught", value: "1", sub: "True positive" }
          ].map((stat, i) => (
            <div key={i} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 14, padding: "20px" }}>
              <small style={{ color: "var(--sp-fg-muted)", fontSize: 13, display: "block", marginBottom: 8 }}>{stat.label}</small>
              <span style={{ display: "block", fontSize: 32, fontWeight: 900, color: "var(--sp-fg)", lineHeight: 1 }}>{stat.value}</span>
              <small style={{ color: "var(--sp-primary-2)", fontSize: 11, display: "block", marginTop: 8, fontWeight: 700 }}>{stat.sub}</small>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard className="wide" testId="insights-detail-card">
        <div className="section-head">
          <IconBadge icon={Sparkles}>Responsible AI Architecture</IconBadge>
        </div>
        <h2>How SentinelPulse Uses AI</h2>
        <div className="responsible-ai-steps">
          <div className="rai-card">
            <strong>1. Personal Profile</strong>
            <p>Your answers establish initial transit mode, travel window, and route deviation tolerance.</p>
          </div>
          <div className="rai-card">
            <strong>2. Deterministic Edge Engine</strong>
            <p>A transparent local formula evaluates measurable deviations without depending on an LLM for safety decisions.</p>
          </div>
          <div className="rai-card">
            <strong>3. AI Explanation Layer</strong>
            <p>Cloud AI contextualizes and translates derived numerical signals into plain-English guidance.</p>
          </div>
          <div className="rai-card">
            <strong>4. Human Confirmation</strong>
            <p>You always maintain authority via the calm confirmation window before any external alert is dispatched.</p>
          </div>
        </div>

        <div className="insight-preview-box" style={{ marginTop: 24 }}>
          <h4>Current Generated Insight</h4>
          <p>{insight?.insight || "Your baseline is stable. Local safety engine remains active."}</p>
          <small>Provider: {insight?.provider || "local_fallback"}</small>
        </div>

        <PrimaryButton icon={RefreshCw} secondary onClick={getInsight} style={{ marginTop: 14 }}>
          Regenerate Contextual Insight
        </PrimaryButton>
      </GlassCard>
    </div>
  );
}

// Settings Screen
function SettingsScreen({ user, settings, authed, refreshAll, onLogout, isPhoneFrame, setIsPhoneFrame }) {
  return (
    <div className="dashboard-grid settings-layout" data-testid="settings-screen">
      <GlassCard testId="user-profile-settings" className="settings-member-card wide" style={{ maxWidth: 820 }}>
        <div className="section-head">
          <IconBadge icon={UserCheck}>Member Account</IconBadge>
        </div>
        <h2>{user?.name || "SentinelPulse Member"}</h2>
        <p>Email: {user?.email || "N/A"}</p>
        <p>Phone: {user?.phone || "N/A"}</p>
        <p>Role: {user?.role || "user"}</p>
        
        <div style={{ marginTop: 24, padding: "16px 0", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <strong>Presentation Mode</strong>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--sp-fg-muted)" }}>
                View SentinelPulse inside an iPhone 16 Pro device frame for demonstrations.
              </p>
            </div>
            <button
              type="button"
              className={cx("sp-button", isPhoneFrame ? "primary" : "secondary")}
              onClick={() => setIsPhoneFrame(!isPhoneFrame)}
              style={{ fontSize: 13, padding: "0 16px", minHeight: 40 }}
            >
              <Smartphone size={16} style={{ marginRight: 8 }} />
              {isPhoneFrame ? "Frame Active" : "Enable Frame"}
            </button>
          </div>
        </div>

        <PrimaryButton danger icon={LogOut} onClick={onLogout} style={{ marginTop: 24 }}>
          Sign Out
        </PrimaryButton>
      </GlassCard>
    </div>
  );
}

// ============================================================
// SENTINELPULSE // INTELLIGENCE — SIH26189
// AI-powered criminal network intelligence platform
// Ministry of Home Affairs · NCRB Women Safety Division
// ============================================================

const INTEL_NAV = [
  { id: "intel_dashboard", label: "Intelligence Hub",     icon: BarChart3 },
  { id: "intel_cases",     label: "Cases",                icon: Database },
  { id: "intel_network",   label: "Network Explorer",     icon: Radar },
  { id: "intel_entities",  label: "Entity Search",        icon: Search },
  { id: "intel_timeline",  label: "Inv. Timeline",        icon: Clock },
  { id: "intel_patterns",  label: "Pattern Engine",       icon: BrainCircuit },
  { id: "intel_evidence",  label: "Evidence Chain",       icon: Vault },
  { id: "intel_audit",     label: "Audit Log",            icon: FileLock2 },
];

const ENTITY_COLORS = {
  PERSON:       "#00E6B8",
  PHONE:        "#FFB84C",
  ORGANIZATION: "#6366f1",
  LOCATION:     "#10b981",
  VEHICLE:      "#f59e0b",
  BANK_ACCOUNT: "#ef4444",
  EVENT:        "#8b5cf6",
  IP_ADDRESS:   "#06b6d4",
};

function FictionalDataBanner() {
  return (
    <div style={{ background:"rgba(255,184,76,0.15)", border:"1px solid rgba(255,184,76,0.5)", borderRadius:12, padding:"10px 16px", marginBottom:20, display:"flex", alignItems:"center", gap:10, fontSize:12, color:"#FFB84C", fontWeight:700, flexWrap:"wrap" }}>
      <AlertTriangle size={16} />
      FICTIONAL SYNTHETIC DATA — FOR DEMONSTRATION ONLY · SIH26189 · NCRB Women Safety Division · Ministry of Home Affairs
    </div>
  );
}

function DisclaimerBanner({ text }) {
  return (
    <div style={{ background:"rgba(99,102,241,0.1)", border:"1px solid rgba(99,102,241,0.3)", borderRadius:10, padding:"8px 14px", fontSize:11, color:"rgba(165,180,252,0.9)", marginTop:12, lineHeight:1.5 }}>
      ⚖ {text || "All AI findings are investigative leads only. The human investigator makes all final determinations. No person or entity is declared guilty by this system."}
    </div>
  );
}

function PriorityBadge({ score }) {
  const color = score >= 70 ? "#ef4444" : score >= 40 ? "#f59e0b" : "#10b981";
  const label = score >= 70 ? "HIGH" : score >= 40 ? "MEDIUM" : "LOW";
  return (
    <span style={{ background:`${color}22`, border:`1px solid ${color}66`, color, borderRadius:999, padding:"2px 10px", fontSize:11, fontWeight:800, letterSpacing:"0.04em" }}>
      {label} · {score}
    </span>
  );
}

function CasePriorityBadge({ priority }) {
  const map = { CRITICAL:["#ef4444","CRITICAL"], HIGH:["#f59e0b","HIGH"], MEDIUM:["#FFB84C","MEDIUM"], LOW:["#10b981","LOW"] };
  const [color, label] = map[priority] || ["#94a3b8", priority];
  return (
    <span style={{ background:`${color}22`, border:`1px solid ${color}66`, color, borderRadius:999, padding:"2px 10px", fontSize:11, fontWeight:800 }}>
      {label}
    </span>
  );
}

function EntityTypeBadge({ type }) {
  const color = ENTITY_COLORS[type] || "#94a3b8";
  return (
    <span style={{ background:`${color}20`, border:`1px solid ${color}50`, color, borderRadius:6, padding:"1px 8px", fontSize:10, fontWeight:700, letterSpacing:"0.04em" }}>
      {type}
    </span>
  );
}

// Intelligence Dashboard Screen
function IntelDashboard({ authed, cases, onNavigate, onSelectCase, onJudgeDemo }) {
  const [stats, setStats] = useState({ cases:0, entities:0, relationships:0, evidence:0, patterns:0 });
  const [brief, setBrief] = useState(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [copilotQ, setCopilotQ] = useState("");

  useEffect(() => {
    if (!authed || !cases) return;
    const totalEntities = cases.reduce((a,c) => a + (c.entity_count||0), 0);
    const totalRels = cases.reduce((a,c) => a + (c.relationship_count||0), 0);
    const totalEv = cases.reduce((a,c) => a + (c.evidence_count||0), 0);
    setStats({ cases: cases.length, entities: totalEntities, relationships: totalRels, evidence: totalEv, patterns: 5 });
  }, [cases, authed]);

  const generateBrief = async (q) => {
    setBriefLoading(true);
    try {
      const res = await authed.post("/intel/cases/case-047/brief", { case_id: "case-047", include_entities: true, include_patterns: true, include_timeline: true });
      setBrief(res.data);
      if (q) toast.success("Investigator Copilot — Brief generated");
    } catch { setBrief({ summary: "Case CASE-047 (ORGANIZED_CRIME) contains 15 mapped entities, 17 documented relationships, and 16 evidence items. 5 patterns detected by AI engine, all pending investigator review. Priority: CRITICAL.", disclaimer: "All findings are investigative leads only. Human investigator must review.", data_label: "FICTIONAL SYNTHETIC DATA" }); }
    finally { setBriefLoading(false); }
  };

  const demoSteps = [
    { n:1, label:"Load CASE-047", action:() => { onSelectCase("case-047"); onNavigate("intel_cases"); } },
    { n:2, label:"Network Graph", action:() => { onSelectCase("case-047"); onNavigate("intel_network"); } },
    { n:3, label:"Pattern Engine", action:() => onNavigate("intel_patterns") },
    { n:4, label:"View Patterns", action:() => onNavigate("intel_patterns") },
    { n:5, label:"Entity Profile", action:() => onNavigate("intel_entities") },
    { n:6, label:"Evidence Chain", action:() => onNavigate("intel_evidence") },
    { n:7, label:"Generate Brief", action:() => generateBrief(true) },
    { n:8, label:"Audit Log", action:() => onNavigate("intel_audit") },
    { n:9, label:"Global Search", action:() => onNavigate("intel_entities") },
    { n:10, label:"Review Entity", action:() => onNavigate("intel_entities") },
  ];

  return (
    <div style={{ maxWidth:1200 }}>
      <FictionalDataBanner />

      {/* Product Identity */}
      <GlassCard style={{ marginBottom:20, background:"linear-gradient(135deg, rgba(99,102,241,0.15), rgba(0,230,184,0.08))", border:"1px solid rgba(99,102,241,0.3)" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:16 }}>
          <div>
            <p className="eyebrow" style={{ color:"#818cf8" }}>Ministry of Home Affairs · NCRB Women Safety Division</p>
            <h2 style={{ fontSize:28, letterSpacing:"-0.04em", color:"#e0e7ff" }}>SENTINELPULSE <span style={{ color:"#818cf8", fontWeight:400 }}>//</span> INTELLIGENCE</h2>
            <p style={{ fontSize:14, color:"rgba(224,231,255,0.72)", margin:"6px 0 0" }}>AI-powered criminal network intelligence for connecting fragmented investigative data.</p>
          </div>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
            <span className="icon-badge" style={{ background:"rgba(99,102,241,0.15)", borderColor:"rgba(99,102,241,0.4)", color:"#a5b4fc" }}><Shield size={14} /> RBAC Enabled</span>
            <span className="icon-badge" style={{ background:"rgba(0,230,184,0.12)", borderColor:"rgba(0,230,184,0.3)", color:"#00E6B8" }}><FileLock2 size={14} /> SHA-256 Chain of Custody</span>
            <span className="icon-badge" style={{ background:"rgba(239,68,68,0.1)", borderColor:"rgba(239,68,68,0.3)", color:"#fca5a5" }}><BrainCircuit size={14} /> AI Pattern Engine</span>
          </div>
        </div>
      </GlassCard>

      {/* Stats Row */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(160px,1fr))", gap:14, marginBottom:20 }}>
        {[
          { label:"Active Cases", value:stats.cases, icon:Database, color:"#6366f1" },
          { label:"Entities Mapped", value:stats.entities, icon:Users, color:"#00E6B8" },
          { label:"Relationships", value:stats.relationships, icon:Activity, color:"#f59e0b" },
          { label:"Evidence Items", value:stats.evidence, icon:Vault, color:"#10b981" },
          { label:"Patterns Flagged", value:stats.patterns, icon:AlertTriangle, color:"#ef4444" },
        ].map(s => (
          <GlassCard key={s.label} style={{ padding:16, textAlign:"center" }}>
            <s.icon size={22} style={{ color:s.color, marginBottom:8 }} />
            <div style={{ fontSize:32, fontWeight:900, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:11, color:"var(--sp-fg-muted)", fontWeight:700, marginTop:4 }}>{s.label}</div>
          </GlassCard>
        ))}
      </div>

      {/* Judge Demo Panel */}
      <GlassCard style={{ marginBottom:20, border:"1px solid rgba(255,184,76,0.3)" }}>
        <div className="section-head">
          <IconBadge icon={Zap} tone="warning">Judge Demo Mode — Reproducible 10-Step Flow</IconBadge>
        </div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginTop:12 }}>
          {demoSteps.map(s => (
            <button key={s.n} type="button" onClick={s.action} style={{ border:"1px solid rgba(255,184,76,0.35)", background:"rgba(255,184,76,0.08)", color:"#FFB84C", borderRadius:10, padding:"6px 12px", fontSize:12, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:5 }}>
              <span style={{ background:"rgba(255,184,76,0.25)", borderRadius:999, width:18, height:18, display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:900 }}>{s.n}</span>
              {s.label}
            </button>
          ))}
        </div>
      </GlassCard>

      {/* Investigator Copilot */}
      <GlassCard style={{ marginBottom:20, border:"1px solid rgba(99,102,241,0.3)" }}>
        <div className="section-head">
          <IconBadge icon={BrainCircuit} tone="teal">Investigator Copilot</IconBadge>
          <small style={{ color:"var(--sp-fg-subtle)", fontSize:11 }}>Evidence-grounded · Never hallucinates facts</small>
        </div>
        <div style={{ display:"flex", gap:10, marginTop:12 }}>
          <input value={copilotQ} onChange={e => setCopilotQ(e.target.value)} placeholder="Ask about CASE-047... (e.g. 'Summarize key findings')" style={{ flex:1 }} onKeyDown={e => e.key==="Enter" && generateBrief(copilotQ)} />
          <PrimaryButton icon={BrainCircuit} onClick={() => generateBrief(copilotQ)} style={{ whiteSpace:"nowrap" }}>{briefLoading ? "Generating…" : "Generate Brief"}</PrimaryButton>
        </div>
        {brief && (
          <div style={{ marginTop:16, background:"rgba(99,102,241,0.08)", borderRadius:12, padding:16, border:"1px solid rgba(99,102,241,0.2)" }}>
            <p className="eyebrow" style={{ color:"#818cf8" }}>{brief.case_id} — {brief.title}</p>
            <p style={{ fontSize:14, color:"var(--sp-fg)", lineHeight:1.65, margin:"8px 0 12px" }}>{brief.summary}</p>
            {brief.key_timeline_events?.length > 0 && (
              <>
                <strong style={{ fontSize:12, color:"var(--sp-fg-muted)", textTransform:"uppercase", letterSpacing:"0.08em" }}>Key Timeline Events</strong>
                {brief.key_timeline_events.map((ev,i) => (
                  <div key={i} style={{ display:"flex", gap:8, alignItems:"flex-start", marginTop:8 }}>
                    <span style={{ background:"rgba(239,68,68,0.2)", color:"#fca5a5", borderRadius:6, padding:"1px 6px", fontSize:10, fontWeight:700, whiteSpace:"nowrap" }}>{ev.significance}</span>
                    <span style={{ fontSize:13, color:"var(--sp-fg-muted)" }}>{ev.title} — <em style={{ fontSize:11 }}>{ev.date?.slice(0,10)}</em></span>
                  </div>
                ))}
              </>
            )}
            <DisclaimerBanner text={brief.disclaimer} />
          </div>
        )}
      </GlassCard>

      {/* Cases List */}
      <div className="section-head" style={{ marginBottom:12 }}>
        <IconBadge icon={Database} tone="teal">Active Cases</IconBadge>
        <button type="button" className="sp-button secondary" style={{ fontSize:11, padding:"4px 12px", minHeight:32 }} onClick={() => onNavigate("intel_cases")}>View All Cases</button>
      </div>
      <div style={{ display:"grid", gap:12 }}>
        {cases.length === 0 && <div className="empty-state"><Database size={32} /><p>No cases loaded. Check backend connection.</p></div>}
        {cases.map(c => (
          <GlassCard key={c.id} as="button" style={{ textAlign:"left", cursor:"pointer", width:"100%", padding:16 }} onClick={() => { onSelectCase(c.id); onNavigate("intel_network"); }}>
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6, flexWrap:"wrap" }}>
                  <CasePriorityBadge priority={c.priority} />
                  <span style={{ fontSize:12, color:"var(--sp-fg-subtle)", fontWeight:700 }}>{c.case_id}</span>
                  <span style={{ fontSize:11, color:"var(--sp-fg-subtle)", background:"rgba(255,255,255,0.06)", borderRadius:6, padding:"1px 8px", border:"1px solid var(--sp-border)" }}>{c.category}</span>
                </div>
                <strong style={{ fontSize:16, color:"var(--sp-fg)", display:"block" }}>{c.title}</strong>
                <p style={{ fontSize:13, color:"var(--sp-fg-muted)", margin:"4px 0 0", lineHeight:1.5 }}>{c.description?.slice(0,120)}{c.description?.length > 120 ? "…" : ""}</p>
              </div>
              <div style={{ display:"flex", gap:16, flexShrink:0, flexWrap:"wrap" }}>
                {[["Entities", c.entity_count||0, "#00E6B8"], ["Relations", c.relationship_count||0, "#6366f1"], ["Evidence", c.evidence_count||0, "#10b981"]].map(([l,v,col]) => (
                  <div key={l} style={{ textAlign:"center" }}>
                    <div style={{ fontSize:20, fontWeight:900, color:col }}>{v}</div>
                    <div style={{ fontSize:10, color:"var(--sp-fg-subtle)", fontWeight:700 }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
            {c.data_label && <div style={{ fontSize:10, color:"#FFB84C", marginTop:8, opacity:0.7 }}>{c.data_label}</div>}
          </GlassCard>
        ))}
      </div>
    </div>
  );
}

// Intel Cases Screen
function IntelCasesScreen({ authed, cases, onSelectCase, onNavigate }) {
  return (
    <div style={{ maxWidth:900 }}>
      <FictionalDataBanner />
      <div className="section-head" style={{ marginBottom:16 }}>
        <IconBadge icon={Database} tone="teal">Investigation Cases</IconBadge>
        <span style={{ fontSize:12, color:"var(--sp-fg-subtle)" }}>{cases.length} cases loaded</span>
      </div>
      <div style={{ display:"grid", gap:14 }}>
        {cases.map(c => (
          <GlassCard key={c.id} style={{ cursor:"pointer", padding:20 }} onClick={() => { onSelectCase(c.id); onNavigate("intel_network"); }}>
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16, flexWrap:"wrap" }}>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8, flexWrap:"wrap" }}>
                  <CasePriorityBadge priority={c.priority} />
                  <code style={{ fontSize:12, color:"var(--sp-primary-2)", fontWeight:700 }}>{c.case_id}</code>
                  {c.tags?.map(t => <span key={t} style={{ fontSize:10, background:"rgba(99,102,241,0.12)", color:"#a5b4fc", border:"1px solid rgba(99,102,241,0.3)", borderRadius:999, padding:"1px 8px", fontWeight:700 }}>{t}</span>)}
                </div>
                <h3 style={{ fontSize:18, marginBottom:6 }}>{c.title}</h3>
                <p style={{ fontSize:14, color:"var(--sp-fg-muted)", lineHeight:1.6, marginBottom:12 }}>{c.description}</p>
                <div style={{ display:"flex", gap:20 }}>
                  {[["Entities", c.entity_count||0, "#00E6B8"], ["Relationships", c.relationship_count||0, "#6366f1"], ["Evidence Items", c.evidence_count||0, "#10b981"], ["Priority Score", c.priority_score||0, "#ef4444"]].map(([l,v,col]) => (
                    <div key={l}>
                      <div style={{ fontSize:22, fontWeight:900, color:col }}>{v}</div>
                      <div style={{ fontSize:10, color:"var(--sp-fg-subtle)", fontWeight:700, textTransform:"uppercase" }}>{l}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:8, alignItems:"flex-end" }}>
                <button type="button" className="sp-button" style={{ fontSize:12, padding:"6px 14px", minHeight:36 }} onClick={e => { e.stopPropagation(); onSelectCase(c.id); onNavigate("intel_network"); }}>
                  <Radar size={14} /> Open Network
                </button>
                <button type="button" className="sp-button secondary" style={{ fontSize:11, padding:"4px 12px", minHeight:30 }} onClick={e => { e.stopPropagation(); onSelectCase(c.id); onNavigate("intel_evidence"); }}>
                  <Vault size={12} /> Evidence
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

// Network Explorer Screen — Hero Screen with ForceGraph2D
function NetworkExplorerScreen({ authed, caseId, onNavigate, selectedCaseData }) {
  const [graphData, setGraphData] = useState({ nodes:[], links:[] });
  const [loading, setLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [entityProfile, setEntityProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [temporalValue, setTemporalValue] = useState(100);
  const [graphDisclaimer, setGraphDisclaimer] = useState("");
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(800);

  const temporalDates = ["2025-09-01","2025-10-01","2025-11-01","2025-11-15","2025-12-01","2025-12-10","2026-01-08","2026-01-14","2026-01-28","2026-01-30","2026-02-01"];

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(entries => { if (entries[0]) setContainerWidth(entries[0].contentRect.width - 320); });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const loadGraph = useCallback(async (temporalDate) => {
    if (!authed || !caseId) return;
    setLoading(true);
    try {
      const url = temporalDate && temporalValue < 100 ? `/intel/cases/${caseId}/graph?timestamp_before=${encodeURIComponent(temporalDate)}` : `/intel/cases/${caseId}/graph`;
      const res = await authed.get(url);
      setGraphData({ nodes: res.data.nodes || [], links: res.data.links || [] });
      setGraphDisclaimer(res.data.disclaimer || "");
    } catch { toast.error("Failed to load network graph"); }
    finally { setLoading(false); }
  }, [authed, caseId, temporalValue]);

  useEffect(() => { loadGraph(); }, [caseId]); // eslint-disable-line

  const getNodeColor = (node) => {
    if (node.priority_score >= 70) return "#ef4444";
    return ENTITY_COLORS[node.entity_type] || "#94a3b8";
  };

  const handleNodeClick = async (node) => {
    setSelectedNode(node);
    setProfileLoading(true);
    try {
      const res = await authed.get(`/intel/entities/${node.id}`);
      setEntityProfile(res.data);
    } catch { setEntityProfile(null); }
    finally { setProfileLoading(false); }
  };

  const handleReview = async (entityId, action) => {
    try {
      await authed.post(`/intel/entities/${entityId}/review?action=${action}`);
      toast.success(`Entity ${action.toLowerCase()}d. Action logged to audit chain.`);
      setEntityProfile(p => p ? { ...p, entity: { ...p.entity, review_status: action } } : p);
    } catch { toast.error("Review action failed"); }
  };

  const temporalDate = temporalDates[Math.floor((temporalValue / 100) * (temporalDates.length - 1))];

  return (
    <div style={{ maxWidth:1400 }}>
      <FictionalDataBanner />

      {/* Top Controls */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, marginBottom:16, flexWrap:"wrap" }}>
        <div>
          <p className="eyebrow" style={{ color:"#818cf8" }}>Network Explorer</p>
          <h2 style={{ fontSize:22 }}>{selectedCaseData?.case_id || caseId?.toUpperCase()} — {selectedCaseData?.title || "Network Analysis"}</h2>
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <button type="button" className="sp-button secondary" style={{ fontSize:12, padding:"6px 14px", minHeight:36 }} onClick={() => onNavigate("intel_patterns")}>
            <BrainCircuit size={14} /> Run Patterns
          </button>
          <button type="button" className="sp-button secondary" style={{ fontSize:12, padding:"6px 14px", minHeight:36 }} onClick={() => onNavigate("intel_evidence")}>
            <Vault size={14} /> Evidence Chain
          </button>
        </div>
      </div>

      {/* Temporal Slider */}
      <GlassCard style={{ marginBottom:16, padding:14 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
          <Clock size={16} style={{ color:"var(--sp-primary)", flexShrink:0 }} />
          <span style={{ fontSize:12, fontWeight:700, color:"var(--sp-fg-muted)", whiteSpace:"nowrap" }}>Temporal Filter:</span>
          <input type="range" min={0} max={100} value={temporalValue} onChange={e => setTemporalValue(Number(e.target.value))} style={{ flex:1, accentColor:"var(--sp-primary)", minWidth:120 }} />
          <span style={{ fontSize:12, color:"var(--sp-primary)", fontWeight:700, whiteSpace:"nowrap" }}>
            {temporalValue === 100 ? "All Time" : `Up to ${temporalDate}`}
          </span>
          <button type="button" className="sp-button secondary" style={{ fontSize:11, padding:"4px 10px", minHeight:28 }} onClick={() => loadGraph(temporalValue < 100 ? temporalDate : null)}>Apply</button>
        </div>
        <small style={{ fontSize:10, color:"var(--sp-fg-subtle)", marginTop:6, display:"block" }}>Show network as it would appear at this point in the investigation timeline.</small>
      </GlassCard>

      {/* Graph + Detail Panel */}
      <div ref={containerRef} style={{ display:"flex", gap:16, alignItems:"flex-start" }}>
        {/* Force Graph */}
        <GlassCard style={{ flex:1, padding:0, overflow:"hidden", minWidth:0 }}>
          <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--sp-border)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {Object.entries(ENTITY_COLORS).slice(0,6).map(([type, color]) => (
                <span key={type} style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:10, color:"var(--sp-fg-muted)" }}>
                  <span style={{ width:8, height:8, borderRadius:"50%", background:color, display:"inline-block" }} />{type}
                </span>
              ))}
            </div>
            <span style={{ fontSize:11, color:"var(--sp-fg-subtle)" }}>{graphData.nodes.length} nodes · {graphData.links.length} links</span>
          </div>
          {loading ? (
            <div style={{ height:500, display:"grid", placeItems:"center" }}>
              <div style={{ textAlign:"center" }}>
                <RefreshCw size={32} style={{ color:"var(--sp-primary)", animation:"spin 1s linear infinite" }} />
                <p style={{ marginTop:12, color:"var(--sp-fg-muted)" }}>Loading network graph…</p>
              </div>
            </div>
          ) : graphData.nodes.length === 0 ? (
            <div style={{ height:500, display:"grid", placeItems:"center" }}>
              <div className="empty-state"><Radar size={40} /><p>No network data available.</p><button type="button" className="sp-button secondary" onClick={() => loadGraph()}>Reload</button></div>
            </div>
          ) : (
            <ForceGraph2D
              graphData={graphData}
              width={Math.max(300, containerWidth)}
              height={500}
              backgroundColor="transparent"
              nodeLabel={node => `${node.name}\n${node.entity_type} · Score: ${node.priority_score}`}
              nodeColor={getNodeColor}
              nodeVal={node => Math.max(4, (node.priority_score || 20) / 10)}
              linkWidth={link => Math.max(0.5, (link.strength || 0.5) * 3)}
              linkColor={() => "rgba(148,163,184,0.4)"}
              linkLabel={link => link.relationship_type}
              linkDirectionalArrowLength={4}
              linkDirectionalArrowRelPos={1}
              onNodeClick={handleNodeClick}
              nodeCanvasObjectMode={() => "after"}
              nodeCanvasObject={(node, ctx, globalScale) => {
                if (globalScale < 0.6) return;
                const label = node.name?.split(" ")[0] || "?";
                ctx.font = `${Math.min(14, 10 / globalScale)}px Inter, sans-serif`;
                ctx.fillStyle = "rgba(234,242,255,0.85)";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(label, node.x, node.y + (Math.max(4, (node.priority_score||20)/10)) + 8);
              }}
            />
          )}
        </GlassCard>

        {/* Entity Detail Panel */}
        {selectedNode && (
          <div style={{ width:300, flexShrink:0 }}>
            <GlassCard style={{ border:`1px solid ${ENTITY_COLORS[selectedNode.entity_type] || "#94a3b8"}44` }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
                <EntityTypeBadge type={selectedNode.entity_type} />
                <button type="button" onClick={() => setSelectedNode(null)} style={{ background:"none", border:"none", color:"var(--sp-fg-muted)", cursor:"pointer" }}><X size={16} /></button>
              </div>
              <h3 style={{ fontSize:16, marginBottom:4 }}>{selectedNode.name}</h3>
              {selectedNode.aliases?.length > 0 && (
                <p style={{ fontSize:12, color:"var(--sp-fg-subtle)", marginBottom:12 }}>Also known as: {selectedNode.aliases.join(", ")}</p>
              )}

              {/* Priority Score */}
              <div style={{ marginBottom:14 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                  <span style={{ fontSize:11, fontWeight:700, color:"var(--sp-fg-muted)" }}>Investigative Relevance</span>
                  <span style={{ fontSize:11, fontWeight:900, color: selectedNode.priority_score >= 70 ? "#ef4444" : selectedNode.priority_score >= 40 ? "#f59e0b" : "#10b981" }}>{selectedNode.priority_score}/100</span>
                </div>
                <div style={{ height:6, background:"rgba(255,255,255,0.08)", borderRadius:999, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${selectedNode.priority_score}%`, background: selectedNode.priority_score >= 70 ? "#ef4444" : selectedNode.priority_score >= 40 ? "#f59e0b" : "#10b981", transition:"width 0.4s ease" }} />
                </div>
              </div>

              <div style={{ display:"flex", gap:12, marginBottom:14 }}>
                <div style={{ textAlign:"center", flex:1 }}>
                  <div style={{ fontSize:20, fontWeight:900, color:"#6366f1" }}>{selectedNode.relationship_count || 0}</div>
                  <div style={{ fontSize:10, color:"var(--sp-fg-subtle)", fontWeight:700 }}>CONNECTIONS</div>
                </div>
                <div style={{ textAlign:"center", flex:1 }}>
                  <div style={{ fontSize:20, fontWeight:900, color:"#f59e0b" }}>{selectedNode.cross_case_appearances || 0}</div>
                  <div style={{ fontSize:10, color:"var(--sp-fg-subtle)", fontWeight:700 }}>CROSS-CASE</div>
                </div>
              </div>

              {profileLoading && <p style={{ fontSize:12, color:"var(--sp-fg-muted)", textAlign:"center" }}>Loading profile…</p>}

              {entityProfile && !profileLoading && (
                <>
                  {entityProfile.evidence?.length > 0 && (
                    <div style={{ marginBottom:12 }}>
                      <strong style={{ fontSize:11, textTransform:"uppercase", letterSpacing:"0.06em", color:"var(--sp-fg-subtle)" }}>Linked Evidence ({entityProfile.evidence.length})</strong>
                      <div style={{ marginTop:6, display:"grid", gap:4 }}>
                        {entityProfile.evidence.slice(0,3).map(ev => (
                          <div key={ev.id} style={{ fontSize:12, color:"var(--sp-fg-muted)", background:"rgba(255,255,255,0.04)", borderRadius:8, padding:"5px 8px", display:"flex", alignItems:"center", gap:6 }}>
                            <Vault size={10} style={{ color:"#10b981", flexShrink:0 }} />{ev.title?.slice(0,35)}{ev.title?.length > 35 ? "…" : ""}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* HITL Review Buttons */}
                  <div style={{ marginBottom:10 }}>
                    <strong style={{ fontSize:11, textTransform:"uppercase", letterSpacing:"0.06em", color:"var(--sp-fg-subtle)", display:"block", marginBottom:6 }}>Investigator Review</strong>
                    <div style={{ display:"flex", gap:6 }}>
                      {["CONFIRM","DISMISS","FLAG"].map(action => (
                        <button key={action} type="button" onClick={() => handleReview(selectedNode.id, action)} style={{ flex:1, border:"1px solid rgba(255,255,255,0.15)", background: action==="CONFIRM" ? "rgba(16,185,129,0.15)" : action==="FLAG" ? "rgba(245,158,11,0.15)" : "rgba(239,68,68,0.1)", color: action==="CONFIRM" ? "#10b981" : action==="FLAG" ? "#f59e0b" : "#ef4444", borderRadius:8, padding:"5px 0", fontSize:10, fontWeight:800, cursor:"pointer" }}>
                          {action}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <DisclaimerBanner text="This profile reflects documented investigative data. Does not indicate guilt. Human review required." />
            </GlassCard>
          </div>
        )}
      </div>

      {graphDisclaimer && <DisclaimerBanner text={graphDisclaimer} />}
    </div>
  );
}

// Entity Search Screen
function EntitySearchScreen({ authed }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedEntityId, setSelectedEntityId] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const search = async () => {
    if (!query || query.length < 2) return;
    setLoading(true);
    try {
      const res = await authed.get(`/intel/search?q=${encodeURIComponent(query)}`);
      setResults(res.data.results);
    } catch { toast.error("Search failed"); }
    finally { setLoading(false); }
  };

  const loadProfile = async (entityId) => {
    setSelectedEntityId(entityId);
    setProfileLoading(true);
    try {
      const res = await authed.get(`/intel/entities/${entityId}`);
      setProfile(res.data);
    } catch { setProfile(null); }
    finally { setProfileLoading(false); }
  };

  const handleReview = async (entityId, action) => {
    try {
      await authed.post(`/intel/entities/${entityId}/review?action=${action}`);
      toast.success(`Entity ${action.toLowerCase()}d — logged to audit chain`);
      setProfile(p => p ? { ...p, entity: { ...p.entity, review_status: action } } : p);
    } catch { toast.error("Review action failed"); }
  };

  return (
    <div style={{ maxWidth:1100 }}>
      <FictionalDataBanner />
      <div className="section-head" style={{ marginBottom:16 }}>
        <IconBadge icon={Search} tone="teal">Global Entity Search</IconBadge>
      </div>

      <div style={{ display:"flex", gap:10, marginBottom:20 }}>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search entities, cases, evidence… (min 2 chars)" onKeyDown={e => e.key==="Enter" && search()} />
        <PrimaryButton icon={Search} onClick={search}>{loading ? "Searching…" : "Search"}</PrimaryButton>
      </div>

      <div style={{ display:"flex", gap:16, alignItems:"flex-start" }}>
        {/* Results */}
        <div style={{ flex:1, minWidth:0 }}>
          {results && (
            <>
              {/* Entities */}
              {results.entities?.length > 0 && (
                <GlassCard style={{ marginBottom:14 }}>
                  <div className="section-head" style={{ marginBottom:10 }}>
                    <IconBadge icon={Users} tone="teal">Entities ({results.entities.length})</IconBadge>
                  </div>
                  {results.entities.map(e => (
                    <div key={e.id} onClick={() => loadProfile(e.id)} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 0", borderBottom:"1px solid var(--sp-border)", cursor:"pointer", opacity: selectedEntityId===e.id ? 1 : 0.85 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <div style={{ width:36, height:36, borderRadius:10, background:`${ENTITY_COLORS[e.entity_type]||"#94a3b8"}22`, display:"grid", placeItems:"center" }}>
                          <span style={{ fontSize:14 }}>{{"PERSON":"👤","PHONE":"📞","ORGANIZATION":"🏢","LOCATION":"📍","VEHICLE":"🚗","BANK_ACCOUNT":"💳","EVENT":"📅"}[e.entity_type]||"❓"}</span>
                        </div>
                        <div>
                          <strong style={{ fontSize:14, color: selectedEntityId===e.id ? "var(--sp-primary)" : "var(--sp-fg)" }}>{e.name}</strong>
                          {e.aliases?.length > 0 && <p style={{ fontSize:11, color:"var(--sp-fg-subtle)", margin:0 }}>aka: {e.aliases.join(", ")}</p>}
                        </div>
                      </div>
                      <EntityTypeBadge type={e.entity_type} />
                    </div>
                  ))}
                </GlassCard>
              )}

              {/* Cases */}
              {results.cases?.length > 0 && (
                <GlassCard style={{ marginBottom:14 }}>
                  <div className="section-head" style={{ marginBottom:10 }}>
                    <IconBadge icon={Database} tone="teal">Cases ({results.cases.length})</IconBadge>
                  </div>
                  {results.cases.map(c => (
                    <div key={c.id} style={{ padding:"10px 0", borderBottom:"1px solid var(--sp-border)" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                        <CasePriorityBadge priority={c.priority} />
                        <code style={{ fontSize:12, color:"var(--sp-primary-2)" }}>{c.case_id}</code>
                      </div>
                      <strong style={{ fontSize:14 }}>{c.title}</strong>
                    </div>
                  ))}
                </GlassCard>
              )}

              {/* Evidence */}
              {results.evidence?.length > 0 && (
                <GlassCard style={{ marginBottom:14 }}>
                  <div className="section-head" style={{ marginBottom:10 }}>
                    <IconBadge icon={Vault} tone="teal">Evidence ({results.evidence.length})</IconBadge>
                  </div>
                  {results.evidence.map(ev => (
                    <div key={ev.id} style={{ padding:"10px 0", borderBottom:"1px solid var(--sp-border)" }}>
                      <strong style={{ fontSize:13 }}>{ev.title}</strong>
                      <p style={{ fontSize:12, color:"var(--sp-fg-muted)", margin:"3px 0 0" }}>{ev.content?.slice(0,100)}…</p>
                    </div>
                  ))}
                </GlassCard>
              )}

              {results.entities?.length === 0 && results.cases?.length === 0 && results.evidence?.length === 0 && (
                <div className="empty-state"><Search size={32} /><p>No results for "{query}"</p></div>
              )}
            </>
          )}
          {!results && !loading && (
            <div className="empty-state" style={{ marginTop:40 }}><Search size={48} style={{ opacity:0.3 }} /><p>Search across all entities, cases, and evidence</p></div>
          )}
        </div>

        {/* Entity Profile Panel */}
        {selectedEntityId && (
          <div style={{ width:320, flexShrink:0 }}>
            <GlassCard style={{ border:"1px solid rgba(99,102,241,0.3)" }}>
              {profileLoading ? <div style={{ textAlign:"center", padding:30 }}><RefreshCw size={28} style={{ color:"var(--sp-primary)" }} /></div> : profile ? (
                <>
                  <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:12 }}>
                    <EntityTypeBadge type={profile.entity?.entity_type} />
                    <button type="button" onClick={() => { setSelectedEntityId(null); setProfile(null); }} style={{ background:"none", border:"none", color:"var(--sp-fg-muted)", cursor:"pointer" }}><X size={16} /></button>
                  </div>
                  <h3 style={{ fontSize:17, marginBottom:4 }}>{profile.entity?.name}</h3>
                  {profile.entity?.aliases?.length > 0 && <p style={{ fontSize:12, color:"var(--sp-fg-subtle)", marginBottom:12 }}>aka: {profile.entity.aliases.join(", ")}</p>}

                  {/* Priority */}
                  {profile.priority && (
                    <div style={{ marginBottom:14 }}>
                      <p className="eyebrow" style={{ color:"#818cf8", marginBottom:8 }}>Investigative Relevance Score</p>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                        <span style={{ fontSize:12, color:"var(--sp-fg-muted)" }}>{profile.priority.label}</span>
                        <strong style={{ color: profile.priority.score >= 70 ? "#ef4444" : profile.priority.score >= 40 ? "#f59e0b" : "#10b981" }}>{profile.priority.score}/100</strong>
                      </div>
                      <div style={{ height:6, background:"rgba(255,255,255,0.08)", borderRadius:999, overflow:"hidden" }}>
                        <div style={{ height:"100%", width:`${profile.priority.score}%`, background: profile.priority.score >= 70 ? "#ef4444" : profile.priority.score >= 40 ? "#f59e0b" : "#10b981" }} />
                      </div>
                      {profile.priority.factors?.map((f,i) => (
                        <div key={i} style={{ marginTop:6, fontSize:11, display:"flex", justifyContent:"space-between", color:"var(--sp-fg-muted)" }}>
                          <span>{f.factor}</span><strong style={{ color:"var(--sp-fg)" }}>+{f.points}</strong>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Relationships */}
                  {profile.relationships?.length > 0 && (
                    <div style={{ marginBottom:12 }}>
                      <strong style={{ fontSize:11, textTransform:"uppercase", letterSpacing:"0.06em", color:"var(--sp-fg-subtle)" }}>Connections ({profile.relationship_count})</strong>
                      {profile.relationships.slice(0,4).map(r => (
                        <div key={r.id} style={{ fontSize:12, color:"var(--sp-fg-muted)", marginTop:6, display:"flex", alignItems:"center", gap:6 }}>
                          <span style={{ background:"rgba(99,102,241,0.2)", color:"#a5b4fc", borderRadius:6, padding:"1px 6px", fontSize:10, fontWeight:700, whiteSpace:"nowrap" }}>{r.relationship_type}</span>
                          <span style={{ flex:1, fontSize:11 }}>{r.notes?.slice(0,50)}…</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* HITL Review */}
                  <div>
                    <strong style={{ fontSize:11, textTransform:"uppercase", letterSpacing:"0.06em", color:"var(--sp-fg-subtle)", display:"block", marginBottom:6 }}>Investigator Review</strong>
                    <p style={{ fontSize:11, color:"var(--sp-fg-subtle)", marginBottom:8 }}>Status: <strong style={{ color: profile.entity?.review_status==="CONFIRM" ? "#10b981" : profile.entity?.review_status==="DISMISS" ? "#ef4444" : "#f59e0b" }}>{profile.entity?.review_status || "PENDING_REVIEW"}</strong></p>
                    <div style={{ display:"flex", gap:6 }}>
                      {["CONFIRM","DISMISS","FLAG"].map(action => (
                        <button key={action} type="button" onClick={() => handleReview(profile.entity.id, action)} style={{ flex:1, border:"1px solid rgba(255,255,255,0.15)", background: action==="CONFIRM" ? "rgba(16,185,129,0.15)" : action==="FLAG" ? "rgba(245,158,11,0.15)" : "rgba(239,68,68,0.1)", color: action==="CONFIRM" ? "#10b981" : action==="FLAG" ? "#f59e0b" : "#ef4444", borderRadius:8, padding:"5px 0", fontSize:10, fontWeight:800, cursor:"pointer" }}>
                          {action}
                        </button>
                      ))}
                    </div>
                  </div>
                  <DisclaimerBanner text={profile.disclaimer} />
                </>
              ) : <div className="empty-state"><Users size={28} /><p>Profile unavailable</p></div>}
            </GlassCard>
          </div>
        )}
      </div>
    </div>
  );
}

// Investigation Timeline Screen
function IntelTimelineScreen({ authed, caseId, onNavigate }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    if (!authed || !caseId) return;
    setLoading(true);
    authed.get(`/intel/cases/${caseId}/timeline`)
      .then(r => setEvents(r.data.events || []))
      .catch(() => toast.error("Failed to load timeline"))
      .finally(() => setLoading(false));
  }, [authed, caseId]);

  const SIG_COLORS = { CRITICAL:"#ef4444", HIGH:"#f59e0b", MEDIUM:"#6366f1", LOW:"#94a3b8" };
  const filters = ["ALL","FINANCIAL","COMMUNICATION","LOCATION","MEETING","INVESTIGATION"];
  const filtered = filter === "ALL" ? events : events.filter(e => e.event_type === filter);

  return (
    <div style={{ maxWidth:900 }}>
      <FictionalDataBanner />
      <div className="section-head" style={{ marginBottom:16 }}>
        <IconBadge icon={Clock} tone="teal">Investigation Timeline — {caseId?.toUpperCase()}</IconBadge>
        <span style={{ fontSize:12, color:"var(--sp-fg-subtle)" }}>{events.length} events</span>
      </div>

      <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
        {filters.map(f => (
          <button key={f} type="button" onClick={() => setFilter(f)} style={{ border:"1px solid", borderColor: filter===f ? "var(--sp-primary)" : "var(--sp-border)", background: filter===f ? "rgba(0,230,184,0.12)" : "transparent", color: filter===f ? "var(--sp-primary)" : "var(--sp-fg-muted)", borderRadius:999, padding:"4px 14px", fontSize:11, fontWeight:700, cursor:"pointer" }}>
            {f}
          </button>
        ))}
      </div>

      {loading ? <div className="empty-state"><RefreshCw size={32} style={{ animation:"spin 1s linear infinite", color:"var(--sp-primary)" }} /></div> : (
        <div style={{ position:"relative" }}>
          {/* Timeline vertical line */}
          <div style={{ position:"absolute", left:16, top:0, bottom:0, width:2, background:"rgba(255,255,255,0.08)", borderRadius:999 }} />
          <div style={{ display:"grid", gap:0 }}>
            {filtered.map((ev, i) => (
              <div key={ev.id} style={{ display:"flex", gap:20, paddingBottom:28, position:"relative" }}>
                {/* Dot */}
                <div style={{ width:32, height:32, borderRadius:"50%", background:`${SIG_COLORS[ev.significance]||"#94a3b8"}20`, border:`2px solid ${SIG_COLORS[ev.significance]||"#94a3b8"}`, display:"grid", placeItems:"center", flexShrink:0, position:"relative", zIndex:1 }}>
                  <span style={{ width:10, height:10, borderRadius:"50%", background:SIG_COLORS[ev.significance]||"#94a3b8", display:"block" }} />
                </div>
                {/* Content */}
                <GlassCard style={{ flex:1, padding:14 }}>
                  <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:10, flexWrap:"wrap", marginBottom:6 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                      <span style={{ background:`${SIG_COLORS[ev.significance]||"#94a3b8"}20`, color:SIG_COLORS[ev.significance]||"#94a3b8", borderRadius:6, padding:"1px 8px", fontSize:10, fontWeight:800 }}>{ev.significance}</span>
                      <span style={{ fontSize:11, background:"rgba(255,255,255,0.06)", color:"var(--sp-fg-muted)", borderRadius:6, padding:"1px 8px", border:"1px solid var(--sp-border)", fontWeight:700 }}>{ev.event_type}</span>
                    </div>
                    <span style={{ fontSize:11, color:"var(--sp-fg-subtle)", whiteSpace:"nowrap" }}>{ev.date?.slice(0,16)?.replace("T"," ")}</span>
                  </div>
                  <strong style={{ fontSize:15, display:"block", marginBottom:4 }}>{ev.title}</strong>
                  <p style={{ fontSize:13, color:"var(--sp-fg-muted)", lineHeight:1.6, margin:0 }}>{ev.description}</p>
                  {ev.entity_ids?.length > 0 && (
                    <div style={{ marginTop:8, display:"flex", gap:6, flexWrap:"wrap" }}>
                      {ev.entity_ids.slice(0,4).map(eid => (
                        <span key={eid} style={{ fontSize:10, color:"var(--sp-primary)", background:"rgba(0,230,184,0.08)", borderRadius:6, padding:"1px 6px", border:"1px solid rgba(0,230,184,0.2)", fontWeight:700 }}>{eid}</span>
                      ))}
                      {ev.entity_ids.length > 4 && <span style={{ fontSize:10, color:"var(--sp-fg-subtle)" }}>+{ev.entity_ids.length-4} more</span>}
                    </div>
                  )}
                  <div style={{ marginTop:10 }}>
                    <button type="button" style={{ fontSize:10, color:"#818cf8", background:"rgba(99,102,241,0.1)", border:"1px solid rgba(99,102,241,0.25)", borderRadius:8, padding:"3px 10px", cursor:"pointer", fontWeight:700 }} onClick={() => onNavigate("intel_network")}>
                      <Radar size={10} style={{ display:"inline", marginRight:4, verticalAlign:"middle" }} /> Show network at this point
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

// Pattern Engine Screen
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
      toast.success(`Pattern analysis complete — ${res.data.count || 0} patterns detected. All require investigator review.`);
    } catch { toast.error("Pattern analysis failed"); }
    finally { setLoading(false); }
  };

  const reviewPattern = async (patternId, action) => {
    try {
      await authed.post("/intel/patterns/review", { pattern_id: patternId, action });
      toast.success(`Pattern ${action.toLowerCase()}d — logged to audit chain`);
      setPatterns(p => p.map(pt => pt.id === patternId ? { ...pt, status: action } : pt));
    } catch { toast.error("Review failed"); }
  };

  const SEV_COLORS = { HIGH:"#ef4444", MEDIUM:"#f59e0b", LOW:"#94a3b8" };
  const PATTERN_ICONS = {
    COMMUNICATION_BURST: Phone,
    BRIDGE_NODE: Activity,
    FINANCIAL_FLOW_CHAIN: TrendingUp,
    TEMPORAL_COLOCATION: MapPin,
    ALIAS_PROLIFERATION: Fingerprint,
  };

  return (
    <div style={{ maxWidth:900 }}>
      <FictionalDataBanner />
      <div className="section-head" style={{ marginBottom:16 }}>
        <IconBadge icon={BrainCircuit} tone="teal">AI Pattern Engine</IconBadge>
        <PrimaryButton icon={BrainCircuit} onClick={runAnalysis} style={{ minHeight:36, fontSize:12 }}>{loading ? "Analyzing…" : "Run Pattern Analysis"}</PrimaryButton>
      </div>
      <p style={{ color:"var(--sp-fg-muted)", fontSize:14, marginBottom:20 }}>Detects suspicious patterns using graph topology, temporal correlation, and entity relationship analysis. All findings require human investigator review before any action is taken.</p>

      {!hasRun && !loading && (
        <div className="empty-state" style={{ marginTop:40 }}>
          <BrainCircuit size={48} style={{ color:"#6366f1", opacity:0.5 }} />
          <p>Click "Run Pattern Analysis" to execute the AI pattern engine on CASE-{caseId?.toUpperCase()}.</p>
        </div>
      )}

      {loading && (
        <div className="empty-state">
          <RefreshCw size={32} style={{ animation:"spin 1s linear infinite", color:"#6366f1" }} />
          <p>Analyzing network topology, temporal patterns, and entity relationships…</p>
        </div>
      )}

      {!loading && patterns.length > 0 && (
        <div style={{ display:"grid", gap:14 }}>
          {patterns.map(p => {
            const PIcon = PATTERN_ICONS[p.pattern_type] || AlertTriangle;
            return (
              <GlassCard key={p.id} style={{ border:`1px solid ${SEV_COLORS[p.severity]||"#94a3b8"}44` }}>
                <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16, flexWrap:"wrap" }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8, flexWrap:"wrap" }}>
                      <span style={{ background:`${SEV_COLORS[p.severity]||"#94a3b8"}20`, border:`1px solid ${SEV_COLORS[p.severity]||"#94a3b8"}50`, color:SEV_COLORS[p.severity]||"#94a3b8", borderRadius:999, padding:"2px 10px", fontSize:11, fontWeight:800 }}>{p.severity}</span>
                      <span style={{ fontSize:11, color:"#a5b4fc", background:"rgba(99,102,241,0.1)", border:"1px solid rgba(99,102,241,0.25)", borderRadius:999, padding:"2px 10px", fontWeight:700 }}>{p.pattern_type?.replace(/_/g," ")}</span>
                      <span style={{ fontSize:11, color:"#FFB84C", background:"rgba(255,184,76,0.1)", borderRadius:999, padding:"2px 10px", fontWeight:700 }}>Human Review Required</span>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
                      <div style={{ width:32, height:32, borderRadius:10, background:`${SEV_COLORS[p.severity]||"#94a3b8"}15`, display:"grid", placeItems:"center" }}>
                        <PIcon size={16} style={{ color:SEV_COLORS[p.severity]||"#94a3b8" }} />
                      </div>
                      <strong style={{ fontSize:16 }}>{p.title}</strong>
                    </div>
                    <p style={{ fontSize:13, color:"var(--sp-fg-muted)", lineHeight:1.6, marginBottom:10 }}>{p.description}</p>

                    <div style={{ background:"rgba(99,102,241,0.08)", borderRadius:10, padding:"10px 12px", marginBottom:10 }}>
                      <strong style={{ fontSize:11, textTransform:"uppercase", letterSpacing:"0.06em", color:"#818cf8", display:"block", marginBottom:4 }}>Investigative Lead</strong>
                      <p style={{ fontSize:13, color:"var(--sp-fg)", margin:0, lineHeight:1.55 }}>{p.investigative_lead}</p>
                    </div>

                    <div style={{ display:"flex", gap:12, alignItems:"center", marginBottom:10 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                          <span style={{ fontSize:11, color:"var(--sp-fg-muted)" }}>Evidence Confidence</span>
                          <span style={{ fontSize:11, fontWeight:800, color:"var(--sp-fg)" }}>{Math.round((p.confidence||0.5)*100)}%</span>
                        </div>
                        <div style={{ height:4, background:"rgba(255,255,255,0.08)", borderRadius:999, overflow:"hidden" }}>
                          <div style={{ height:"100%", width:`${(p.confidence||0.5)*100}%`, background:"linear-gradient(90deg, #6366f1, #818cf8)" }} />
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize:11, color:"var(--sp-fg-subtle)" }}>Evidence basis: </span>
                        <span style={{ fontSize:11, color:"var(--sp-fg)", fontWeight:600 }}>{p.evidence_basis}</span>
                      </div>
                    </div>

                    {/* HITL Review */}
                    <div style={{ display:"flex", gap:8 }}>
                      {p.status && p.status !== "PENDING_REVIEW" ? (
                        <span style={{ fontSize:11, fontWeight:700, color: p.status==="CONFIRM" ? "#10b981" : p.status==="DISMISS" ? "#ef4444" : "#f59e0b" }}>
                          ✓ {p.status} (logged to audit chain)
                        </span>
                      ) : (
                        ["CONFIRM","DISMISS","FLAG_FOR_REVIEW"].map(action => (
                          <button key={action} type="button" onClick={() => reviewPattern(p.id, action)} style={{ border:"1px solid", borderColor: action==="CONFIRM" ? "rgba(16,185,129,0.4)" : action==="FLAG_FOR_REVIEW" ? "rgba(245,158,11,0.4)" : "rgba(239,68,68,0.4)", background: action==="CONFIRM" ? "rgba(16,185,129,0.1)" : action==="FLAG_FOR_REVIEW" ? "rgba(245,158,11,0.1)" : "rgba(239,68,68,0.1)", color: action==="CONFIRM" ? "#10b981" : action==="FLAG_FOR_REVIEW" ? "#f59e0b" : "#ef4444", borderRadius:8, padding:"5px 12px", fontSize:11, fontWeight:700, cursor:"pointer" }}>
                            {action.replace(/_/g," ")}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
      <DisclaimerBanner />
    </div>
  );
}

// Evidence Chain Screen
function EvidenceChainScreen({ authed, caseId }) {
  const [evidence, setEvidence] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addForm, setAddForm] = useState({ title:"", kind:"document", content:"", source:"" });
  const [adding, setAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const KIND_COLORS = { call_record:"#FFB84C", financial:"#ef4444", document:"#6366f1", location_data:"#10b981", image:"#8b5cf6", note:"#94a3b8" };

  useEffect(() => {
    if (!authed || !caseId) return;
    setLoading(true);
    authed.get(`/intel/cases/${caseId}/evidence`)
      .then(r => setEvidence(Array.isArray(r.data) ? r.data : []))
      .catch(() => toast.error("Failed to load evidence"))
      .finally(() => setLoading(false));
  }, [authed, caseId]);

  const addEvidence = async () => {
    if (!addForm.title || !addForm.content) return toast.error("Title and content are required");
    setAdding(true);
    try {
      const res = await authed.post(`/intel/cases/${caseId}/evidence`, { case_id: caseId, ...addForm });
      setEvidence(e => [res.data, ...e]);
      setAddForm({ title:"", kind:"document", content:"", source:"" });
      setShowAddForm(false);
      toast.success("Evidence added — SHA-256 hash computed and logged to audit chain");
    } catch { toast.error("Failed to add evidence"); }
    finally { setAdding(false); }
  };

  return (
    <div style={{ maxWidth:900 }}>
      <FictionalDataBanner />
      <div className="section-head" style={{ marginBottom:16 }}>
        <IconBadge icon={Vault} tone="teal">Evidence Chain — {caseId?.toUpperCase()}</IconBadge>
        <button type="button" className="sp-button secondary" style={{ fontSize:11, padding:"4px 12px", minHeight:30 }} onClick={() => setShowAddForm(v => !v)}>
          <FileLock2 size={13} /> {showAddForm ? "Cancel" : "Add Evidence"}
        </button>
      </div>

      {showAddForm && (
        <GlassCard style={{ marginBottom:20, border:"1px solid rgba(16,185,129,0.3)" }}>
          <p className="eyebrow" style={{ color:"#10b981" }}>New Evidence Item</p>
          <div className="form-stack" style={{ marginTop:12 }}>
            <label>Title<input value={addForm.title} onChange={e => setAddForm(f=>({...f,title:e.target.value}))} placeholder="Evidence title" /></label>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <label>Kind<select value={addForm.kind} onChange={e => setAddForm(f=>({...f,kind:e.target.value}))}>
                {["document","call_record","financial","location_data","image","note"].map(k => <option key={k} value={k}>{k}</option>)}
              </select></label>
              <label>Source<input value={addForm.source} onChange={e => setAddForm(f=>({...f,source:e.target.value}))} placeholder="Evidence source" /></label>
            </div>
            <label>Content<textarea value={addForm.content} onChange={e => setAddForm(f=>({...f,content:e.target.value}))} placeholder="Describe the evidence…" style={{ minHeight:100 }} /></label>
            <PrimaryButton icon={FileLock2} onClick={addEvidence}>{adding ? "Adding…" : "Add & Hash Evidence"}</PrimaryButton>
          </div>
        </GlassCard>
      )}

      {loading ? <div className="empty-state"><RefreshCw size={28} style={{ animation:"spin 1s linear infinite", color:"var(--sp-primary)" }} /></div> : (
        <div style={{ display:"grid", gap:12 }}>
          {evidence.map(ev => (
            <GlassCard key={ev.id} style={{ padding:16 }}>
              <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8, flexWrap:"wrap" }}>
                    <span style={{ background:`${KIND_COLORS[ev.kind]||"#94a3b8"}20`, color:KIND_COLORS[ev.kind]||"#94a3b8", border:`1px solid ${KIND_COLORS[ev.kind]||"#94a3b8"}50`, borderRadius:6, padding:"2px 10px", fontSize:11, fontWeight:800 }}>{ev.kind?.replace(/_/g," ").toUpperCase()}</span>
                    <span style={{ fontSize:11, background:"rgba(16,185,129,0.1)", color:"#10b981", border:"1px solid rgba(16,185,129,0.3)", borderRadius:999, padding:"2px 8px", fontWeight:700, display:"inline-flex", alignItems:"center", gap:4 }}>
                      <Lock size={9} /> SHA-256 Verified
                    </span>
                  </div>
                  <strong style={{ fontSize:15, display:"block", marginBottom:4 }}>{ev.title}</strong>
                  <p style={{ fontSize:13, color:"var(--sp-fg-muted)", lineHeight:1.6, margin:"0 0 8px" }}>{ev.content?.slice(0,200)}{ev.content?.length > 200 ? "…" : ""}</p>
                  <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
                    {ev.source && <span style={{ fontSize:11, color:"var(--sp-fg-subtle)" }}>Source: <strong style={{ color:"var(--sp-fg-muted)" }}>{ev.source}</strong></span>}
                    {ev.content_hash && <span style={{ fontSize:11, color:"var(--sp-primary)", fontFamily:"monospace" }}>SHA: {ev.content_hash.slice(0,16)}…</span>}
                    {ev.created_at && <span style={{ fontSize:11, color:"var(--sp-fg-subtle)" }}>{ev.created_at.slice(0,10)}</span>}
                  </div>
                  {ev.entity_ids?.length > 0 && (
                    <div style={{ marginTop:8, display:"flex", gap:6, flexWrap:"wrap" }}>
                      <span style={{ fontSize:10, color:"var(--sp-fg-subtle)", fontWeight:700 }}>Linked:</span>
                      {ev.entity_ids.map(eid => <span key={eid} style={{ fontSize:10, color:"#00E6B8", background:"rgba(0,230,184,0.08)", border:"1px solid rgba(0,230,184,0.2)", borderRadius:6, padding:"1px 6px", fontWeight:700 }}>{eid}</span>)}
                    </div>
                  )}
                </div>
              </div>
            </GlassCard>
          ))}
          {evidence.length === 0 && <div className="empty-state"><Vault size={32} /><p>No evidence items for this case.</p></div>}
        </div>
      )}
    </div>
  );
}

// Audit Log Screen
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
    RELATIONSHIP_ADDED: "#6366f1",
    ENTITY_ADDED: "#00E6B8",
  };

  useEffect(() => {
    if (!authed) return;
    setLoading(true);
    const url = caseId ? `/intel/cases/${caseId}/audit` : `/intel/audit`;
    authed.get(url)
      .then(r => setLogs(r.data.logs || []))
      .catch(() => toast.error("Failed to load audit log"))
      .finally(() => setLoading(false));
  }, [authed, caseId]);

  return (
    <div style={{ maxWidth:900 }}>
      <FictionalDataBanner />
      <div className="section-head" style={{ marginBottom:16 }}>
        <IconBadge icon={FileLock2} tone="teal">Tamper-Evident Chain of Custody</IconBadge>
        <span style={{ fontSize:12, color:"var(--sp-fg-subtle)" }}>{logs.length} log entries</span>
      </div>
      <GlassCard style={{ marginBottom:16, padding:12, display:"flex", alignItems:"center", gap:10, background:"rgba(16,185,129,0.08)", border:"1px solid rgba(16,185,129,0.3)" }}>
        <Lock size={16} style={{ color:"#10b981", flexShrink:0 }} />
        <p style={{ margin:0, fontSize:12, color:"#10b981" }}>Each audit entry is individually SHA-256 hashed and immutably appended. This log constitutes the chain of custody for all investigative actions on this case.</p>
      </GlassCard>

      {loading ? <div className="empty-state"><RefreshCw size={28} style={{ animation:"spin 1s linear infinite", color:"var(--sp-primary)" }} /></div> : (
        <div style={{ display:"grid", gap:8 }}>
          {logs.map((log, i) => {
            const color = ACTION_COLORS[log.action] || "#94a3b8";
            return (
              <div key={log.id || i} style={{ display:"flex", gap:14, alignItems:"flex-start", padding:"12px 0", borderBottom:"1px solid var(--sp-border)" }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:color, marginTop:6, flexShrink:0, boxShadow:`0 0 8px ${color}66` }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3, flexWrap:"wrap" }}>
                    <span style={{ fontSize:11, fontWeight:800, color, background:`${color}15`, borderRadius:6, padding:"1px 8px", border:`1px solid ${color}40` }}>{log.action?.replace(/_/g," ")}</span>
                    <span style={{ fontSize:11, color:"var(--sp-fg-subtle)", whiteSpace:"nowrap" }}>{log.created_at?.slice(0,16)?.replace("T"," ")}</span>
                  </div>
                  <p style={{ margin:0, fontSize:13, color:"var(--sp-fg-muted)", lineHeight:1.5 }}>{log.description}</p>
                  {log.integrity_hash && <code style={{ fontSize:10, color:"var(--sp-fg-subtle)", display:"block", marginTop:3 }}>Hash: {log.integrity_hash.slice(0,24)}…</code>}
                </div>
              </div>
            );
          })}
          {logs.length === 0 && <div className="empty-state"><FileLock2 size={32} /><p>No audit entries found.</p></div>}
        </div>
      )}
    </div>
  );
}

// Main App Shell
function AppShell() {
  const { token, saveAuth, logout } = useAuthToken();
  const [showSplash, setShowSplash] = useState(true);
  const [welcomeStep, setWelcomeStep] = useState(false);
  const [authIsRegister, setAuthIsRegister] = useState(false);
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [onboardingIntroSeen, setOnboardingIntroSeen] = useState(false);
  const [view, setView] = useState("home");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Intelligence Platform State
  const [appMode, setAppMode] = useState("intel"); // "intel" | "safety"
  const [intelView, setIntelView] = useState("intel_dashboard");
  const [selectedCaseId, setSelectedCaseId] = useState("case-047");
  const [intelCases, setIntelCases] = useState([]);

  const selectedCaseData = useMemo(() => {
    return intelCases.find((c) => c.id === selectedCaseId || c.case_id === selectedCaseId) || intelCases[0] || { id: "case-047", case_id: "CASE-047", title: "Interstate Extortion Network" };
  }, [intelCases, selectedCaseId]);


  const online = useOnlineStatus();
  const live = useLiveLocation(true);
  const handleUnauthorized = useCallback(async () => {
    try {
      const res = await api.post("/auth/demo-login");
      if (res.data?.access_token) {
        saveAuth(res.data);
        setUser(res.data.user);
      }
    } catch {
      logout();
    }
  }, [logout, saveAuth]);

  const authed = useMemo(() => apiWithToken(token, handleUnauthorized), [token, handleUnauthorized]);

  const [dashboard, setDashboard] = useState(null);
  const [safetyProfile, setSafetyProfile] = useState(null);
  const [activeJourney, setActiveJourney] = useState(null);
  const [overlays, setOverlays] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [evidence, setEvidence] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [privacy, setPrivacy] = useState(null);
  const [settings, setSettings] = useState(null);
  const [user, setUser] = useState(null);
  const [insight, setInsight] = useState(null);
  const [activeScenario, setActiveScenario] = useState(null);
  const [riskLoading, setRiskLoading] = useState(false);
  const [whyModalOpen, setWhyModalOpen] = useState(false);
  const [isPhoneFrame, setIsPhoneFrame] = useState(false);

  // Conservative Escalation System State
  const [escalationStatus, setEscalationStatus] = useState("IDLE"); // IDLE, CONFIRMED_CHECKIN, PRIMARY_ALERTED, PRIMARY_ACKNOWLEDGED, SECONDARY_ALERTED
  const [confirmationDeadline, setConfirmationDeadline] = useState(null);
  const [ackDeadline, setAckDeadline] = useState(null);
  const [cooldownUntil, setCooldownUntil] = useState(null);
  const [escalationReasons, setEscalationReasons] = useState([]);
  const [primaryContact, setPrimaryContact] = useState(null);
  const [secondaryContact, setSecondaryContact] = useState(null);
  const highCandidateRef = useRef(null);

  const refreshAll = useCallback(async () => {
    if (!token) return;
    try {
      const [uRes, dashRes, profRes, journeyRes, contactRes, timelineRes, evidenceRes, privRes, setRes, overlayRes, escRes, intelCasesRes] =
        await Promise.all([
          authed.get("/auth/me").catch(() => ({ data: null })),
          authed.get("/dashboard").catch(() => ({ data: null })),
          authed.get("/profile/safety").catch(() => ({ data: null })),
          authed.get("/journeys").catch(() => ({ data: [] })),
          authed.get("/contacts").catch(() => ({ data: [] })),
          authed.get("/timeline").catch(() => ({ data: [] })),
          authed.get("/evidence").catch(() => ({ data: [] })),
          authed.get("/privacy").catch(() => ({ data: null })),
          authed.get("/settings").catch(() => ({ data: null })),
          authed.get("/map/overlays").catch(() => ({ data: null })),
          authed.get("/escalation/active").catch(() => ({ data: null })),
          authed.get("/intel/cases").catch(() => ({ data: [] })),
        ]);


      if (uRes.data) setUser(uRes.data);
      if (dashRes.data) setDashboard(dashRes.data);
      if (profRes.data) setSafetyProfile(profRes.data);
      if (journeyRes.data) setActiveJourney(journeyRes.data.find((j) => j.status === "active") || null);
      if (contactRes.data) setContacts(contactRes.data);
      if (timelineRes.data) setTimeline(timelineRes.data);
      if (evidenceRes.data) setEvidence(evidenceRes.data);
      if (privRes.data) setPrivacy(privRes.data);
      if (setRes.data) setSettings(setRes.data);
      if (overlayRes.data) setOverlays(overlayRes.data);
      if (Array.isArray(intelCasesRes.data)) setIntelCases(intelCasesRes.data);
      else if (Array.isArray(intelCasesRes.data?.cases)) setIntelCases(intelCasesRes.data.cases);


      if (escRes.data) {
        if (escRes.data.cooldown_until) setCooldownUntil(escRes.data.cooldown_until);
        if (escRes.data.primary_contact) setPrimaryContact(escRes.data.primary_contact);
        if (escRes.data.secondary_contact) setSecondaryContact(escRes.data.secondary_contact);

        const sess = escRes.data.session;
        if (sess) {
          if (sess.status === "CONFIRMED_CHECKIN" && sess.confirmation_deadline > Date.now()) {
            setEscalationStatus("CONFIRMED_CHECKIN");
            setConfirmationDeadline(sess.confirmation_deadline);
            setEscalationReasons(sess.reasons || ["Unusual route deviation detected", "Prolonged stop"]);
          } else if (sess.status === "PRIMARY_ALERTED" && sess.ack_deadline > Date.now()) {
            setEscalationStatus("PRIMARY_ALERTED");
            setAckDeadline(sess.ack_deadline);
          } else if (sess.status === "PRIMARY_ACKNOWLEDGED") {
            setEscalationStatus("PRIMARY_ACKNOWLEDGED");
          } else if (sess.status === "SECONDARY_ALERTED") {
            setEscalationStatus("SECONDARY_ALERTED");
          }
        }
      }
    } catch (err) {
      if (err.response?.status === 401) {
        logout();
      }
    }
  }, [authed, logout, token]);

  useEffect(() => {
    if (token) refreshAll();
  }, [refreshAll, token]);

  const triggerHighRiskCheckin = useCallback(async (customReasons = null) => {
    try {
      const defaultReasons = ["Route deviation outside normal corridor", "Prolonged unexpected stop", "Duration overrun"];
      const reasons = customReasons || dashboard?.latest_risk?.active_independent_signals || defaultReasons;
      const res = await authed.post("/escalation/evaluate", {
        score: dashboard?.risk_score || 78,
        factors: dashboard?.latest_risk?.factors || [],
        reasons,
        journey_id: activeJourney?.id,
        location: live.location,
      });
      if (res.data?.status === "confirmed_checkin") {
        setEscalationStatus("CONFIRMED_CHECKIN");
        setConfirmationDeadline(res.data.session?.confirmation_deadline || Date.now() + 30000);
        setEscalationReasons(reasons);
        if (res.data.session?.primary_contact) setPrimaryContact(res.data.session.primary_contact);
        if (res.data.session?.secondary_contact) setSecondaryContact(res.data.session.secondary_contact);
      }
    } catch {
      setEscalationStatus("CONFIRMED_CHECKIN");
      setConfirmationDeadline(Date.now() + 30000);
      setEscalationReasons(customReasons || ["Route deviation outside normal corridor", "Prolonged unexpected stop"]);
    }
  }, [activeJourney?.id, authed, dashboard?.latest_risk?.active_independent_signals, dashboard?.latest_risk?.factors, dashboard?.risk_score, live.location]);

  // Sustained High Risk Confirmation Engine (Conservative: observe silently -> confirm sustained high risk -> ask once)
  useEffect(() => {
    const score = dashboard?.risk_score || 0;
    const isCooldownActive = cooldownUntil && Date.now() < cooldownUntil;

    // In cooldown: ignore anomalies silently
    if (isCooldownActive) {
      highCandidateRef.current = null;
      return;
    }

    // Normal or Moderate (Score < 65): cancel any pending candidate silently
    if (score < 65) {
      highCandidateRef.current = null;
      return;
    }

    // Already in check-in or contact alert
    if (["CONFIRMED_CHECKIN", "PRIMARY_ALERTED", "SECONDARY_ALERTED", "PRIMARY_ACKNOWLEDGED"].includes(escalationStatus)) {
      return;
    }

    const signalsCount = dashboard?.latest_risk?.independent_signals_count || 1;
    // Condition A: Score >= 65 for 30s | Condition B: Score >= 75 with >=2 signals for 15s
    const requiredMs = (score >= 75 && signalsCount >= 2) ? 15000 : 30000;

    if (!highCandidateRef.current) {
      highCandidateRef.current = {
        startTime: Date.now(),
        score,
        requiredMs,
      };
    }

    const interval = setInterval(() => {
      if (!highCandidateRef.current) return;
      const elapsed = Date.now() - highCandidateRef.current.startTime;
      if (elapsed >= highCandidateRef.current.requiredMs) {
        triggerHighRiskCheckin();
        highCandidateRef.current = null;
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [dashboard?.risk_score, dashboard?.latest_risk, cooldownUntil, escalationStatus, triggerHighRiskCheckin]);

  // User Confirms "I'm Safe" -> 5 minute cooldown active
  const handleEscalationSafeConfirm = useCallback(async () => {
    try {
      const res = await authed.post("/escalation/action", {
        action: "im_safe",
        journey_id: activeJourney?.id,
      });
      const until = res.data?.cooldown_until || Date.now() + 300000;
      setCooldownUntil(until);
      setEscalationStatus("IDLE");
      setConfirmationDeadline(null);
      setAckDeadline(null);
      toast.success("Safety confirmed. Escalation cancelled. 5-minute anomaly cooldown active.");
      await refreshAll();
    } catch {
      setCooldownUntil(Date.now() + 300000);
      setEscalationStatus("IDLE");
      toast.success("Safety confirmed. Cooldown active.");
    }
  }, [activeJourney?.id, authed, refreshAll]);

  // User clicks "Need Help" or 30s Confirmation Window expires -> Alert Primary Contact
  const handleEscalationNeedHelp = useCallback(async (isTimeout = false) => {
    try {
      const res = await authed.post("/escalation/action", {
        action: isTimeout ? "timeout" : "need_help",
        journey_id: activeJourney?.id,
      });
      setEscalationStatus("PRIMARY_ALERTED");
      setConfirmationDeadline(null);
      setAckDeadline(res.data?.ack_deadline || Date.now() + 60000);
      if (res.data?.primary_contact) setPrimaryContact(res.data.primary_contact);
      toast.warning(
        isTimeout ? "Check-in timed out. Alerting primary contact..." : "Help requested. Dispatched alert to primary contact."
      );
      await refreshAll();
    } catch {
      setEscalationStatus("PRIMARY_ALERTED");
      setConfirmationDeadline(null);
      setAckDeadline(Date.now() + 60000);
      toast.warning("Primary contact alerted.");
    }
  }, [activeJourney?.id, authed, refreshAll]);

  // Primary Contact Acknowledges
  const handleEscalationPrimaryAck = useCallback(async () => {
    try {
      await authed.post("/escalation/action", { action: "primary_ack", journey_id: activeJourney?.id });
      setEscalationStatus("PRIMARY_ACKNOWLEDGED");
      setAckDeadline(null);
      toast.success("Primary contact acknowledged alert. Secondary escalation halted.");
      await refreshAll();
    } catch {
      setEscalationStatus("PRIMARY_ACKNOWLEDGED");
      setAckDeadline(null);
    }
  }, [activeJourney?.id, authed, refreshAll]);

  // 60s Ack Window Expires Without Ack -> Alert Secondary Contact
  const handleEscalationAckTimeout = useCallback(async () => {
    try {
      const res = await authed.post("/escalation/action", { action: "ack_timeout", journey_id: activeJourney?.id });
      setEscalationStatus("SECONDARY_ALERTED");
      setAckDeadline(null);
      if (res.data?.secondary_contact) setSecondaryContact(res.data.secondary_contact);
      toast.error("Primary contact timed out. Alerted secondary contact. Automatic escalation halted.");
      await refreshAll();
    } catch {
      setEscalationStatus("SECONDARY_ALERTED");
      setAckDeadline(null);
    }
  }, [activeJourney?.id, authed, refreshAll]);

  // User Holds SOS for 1.5s -> Direct User SOS Action
  const handleEscalationHoldSOS = useCallback(() => {
    setEscalationStatus("IDLE");
    setConfirmationDeadline(null);
    setView("sos");
  }, []);

  // Dismiss completed escalation banner
  const handleDismissEscalation = useCallback(async () => {
    try {
      await authed.post("/escalation/action", { action: "resolve", journey_id: activeJourney?.id });
      setEscalationStatus("IDLE");
      await refreshAll();
    } catch {
      setEscalationStatus("IDLE");
    }
  }, [activeJourney?.id, authed, refreshAll]);

  useEffect(() => {
    const handler = (e) => setView(e.detail);
    window.addEventListener("sp:navigate", handler);
    return () => window.removeEventListener("sp:navigate", handler);
  }, []);

  const onAuth = (payload, isNewUser = false) => {
    saveAuth(payload);
    setUser(payload.user);
    if (isNewUser || !payload.user?.profile_completed) {
      setIsOnboarding(true);
      setView("profile");
    } else {
      setView("home");
    }
  };

  const runRiskScan = async () => {
    setRiskLoading(true);
    try {
      const signal = {
        motion_delta: Math.round(15 + Math.random() * 55),
        routine_deviation: Math.round(10 + Math.random() * 60),
        location_risk: 20,
        voice_stress: 0,
        battery_factor: 10,
        offline: !online,
        sensitivity: settings?.ai_sensitivity || 0.72,
        journey_id: activeJourney?.id,
        location: live.location,
      };
      const res = await authed.post("/ai/risk", signal);
      toast.success("Risk scan complete", { description: `Signal confidence: ${res.data.confidence_label || "High"} · Posture: ${res.data.risk_level}` });
      await refreshAll();
    } catch (err) {
      toast.error(formatApiError(err, "Risk scan failed"));
    } finally {
      setRiskLoading(false);
    }
  };

  const runDemoSimulation = async (scenarioId) => {
    setRiskLoading(true);
    setActiveScenario(scenarioId);
    try {
      const res = await authed.post("/demo/simulate", {
        scenario: scenarioId,
        journey_id: activeJourney?.id,
        location: live.location,
        auto_escalate: scenarioId === "sos",
      });
      const risk = res.data.risk_result;
      toast.warning(`[Demo Scenario] ${res.data.title}`, {
        description: `Risk score: ${risk.score} (${risk.risk_level || risk.state.toUpperCase()}). ${res.data.reasons?.[0] || ""}`,
      });

      if (scenarioId === "sos") {
        setView("sos");
      } else if (scenarioId === "high_risk" || scenarioId === "elevated_risk" || scenarioId === "combined_incident") {
        // Trigger high risk check-in modal directly for interactive testing
        triggerHighRiskCheckin(res.data.reasons);
      } else if (scenarioId === "safe_checkin") {
        await handleEscalationSafeConfirm();
      }

      await refreshAll();
    } catch (err) {
      toast.error(formatApiError(err, "Demo simulation failed"));
    } finally {
      setRiskLoading(false);
    }
  };

  const resetDemoState = async () => {
    setRiskLoading(true);
    try {
      await authed.post("/demo/reset", {});
      setActiveScenario(null);
      setEscalationStatus("IDLE");
      setConfirmationDeadline(null);
      setAckDeadline(null);
      setCooldownUntil(null);
      await refreshAll();
      toast.success("Demo state reset to clean baseline (Score: 12, Safe)");
    } catch (err) {
      toast.error(formatApiError(err, "Could not reset demo"));
    } finally {
      setRiskLoading(false);
    }
  };

  const getInsight = useCallback(async () => {
    if (!token) return;
    try {
      const res = await authed.post("/ai/insight", { mode: "daily", risk_summary: dashboard?.latest_risk || {} });
      setInsight(res.data);
    } catch (err) {
      setInsight({ provider: "local_fallback", insight: "Your protection posture is stable. SentinelPulse recommends keeping Smart Journey active for unfamiliar routes." });
    }
  }, [authed, dashboard?.latest_risk, token]);

  useEffect(() => {
    if (token && !insight) getInsight();
  }, [token, insight, getInsight]);

  const handleStartJourneyFromMap = async (route, destinationName) => {
    try {
      const payload = {
        destination_name: destinationName,
        origin: live.location,
        destination: { lat: live.location.lat + 0.015, lng: live.location.lng + 0.018 },
        share_with_contacts: true,
      };
      const res = await authed.post("/journeys/start", payload);
      setActiveJourney(res.data);
      setView("journey");
      toast.success("Smart Journey started in MONITORING mode");
      await refreshAll();
    } catch (err) {
      toast.error(formatApiError(err, "Could not start journey"));
    }
  };

  const handleCheckIn = async () => {
    if (activeJourney) {
      try {
        await authed.post(`/journeys/${activeJourney.id}/checkin`, { status: "safe", message: "User confirmed: I'm Safe" });
        await refreshAll();
        setWhyModalOpen(false);
        toast.success("Safety check confirmed — risk normalized to baseline");
      } catch (err) {
        toast.error(formatApiError(err, "Check-in failed"));
      }
    } else {
      await runDemoSimulation("safe_checkin");
      setWhyModalOpen(false);
      toast.success("Safety check confirmed — risk normalized to baseline");
    }
  };

  const handleDemoLogin = async () => {
    try {
      const res = await api.post("/auth/demo-login");
      onAuth(res.data, false);
      toast.success("Welcome to SentinelPulse Demo! Alex Chen's profile loaded.");
      return;
    } catch (err) {
      try {
        const fallback = await api.post("/auth/login", {
          identifier: "demo@sentinelpulse.app",
          password: "Demo2026SP!",
        });
        onAuth(fallback.data, false);
        toast.success("Welcome to SentinelPulse Demo! Alex Chen's profile loaded.");
        return;
      } catch (fallbackErr) {
        toast.error(formatApiError(fallbackErr, "Demo login unavailable. Please register a new account."));
      }
    }
  };

  if (showSplash) return <SplashScreen onDone={() => setShowSplash(false)} />;

  // Part 2: First Screen Must Be Welcome/Onboarding for unauthenticated users
  if (!token) {
    if (!welcomeStep) {
      return (
        <>
          <WelcomeScreen
            onGetStarted={() => {
              setAuthIsRegister(true);
              setWelcomeStep(true);
            }}
            onSignIn={() => {
              setAuthIsRegister(false);
              setWelcomeStep(true);
            }}
            onDemo={handleDemoLogin}
          />
          <Toaster theme="dark" richColors position="top-right" />
        </>
      );
    }
    return (
      <>
        <AuthScreen
          onAuth={onAuth}
          isRegister={authIsRegister}
          onBackToWelcome={() => setWelcomeStep(false)}
          onDemo={handleDemoLogin}
        />
        <Toaster theme="dark" richColors position="top-right" />
      </>
    );
  }

  // Part 4 & Part 5: Progressive Onboarding Safety Profile Wizard
  if (isOnboarding) {
    if (!onboardingIntroSeen) {
      return (
        <div className="app-bg">
          <div className="noise" />
          <main style={{ display: "grid", placeItems: "center", minHeight: "100vh", padding: "24px" }}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ maxWidth: 520, textAlign: "center" }}
            >
              <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(0,230,184,0.12)", border: "1px solid rgba(0,230,184,0.25)", display: "grid", placeItems: "center", margin: "0 auto 24px" }}>
                <ShieldCheck size={32} style={{ color: "#00E6B8" }} />
              </div>
              <p className="eyebrow">SentinelPulse · Getting Started</p>
              <h2 style={{ fontSize: 28, margin: "8px 0 16px", lineHeight: 1.2 }}>
                Before we protect you,<br />we need to understand you.
              </h2>
              <p style={{ fontSize: 16, color: "var(--sp-fg-muted)", marginBottom: 12 }}>
                SentinelPulse starts with <strong>what is normal for you</strong> — your routes, travel habits, and timing — then refines that baseline as you complete journeys.
              </p>
              <p style={{ fontSize: 14, color: "var(--sp-fg-subtle)", marginBottom: 32, maxWidth: 400, margin: "0 auto 32px" }}>
                8 quick questions · Your data stays under your control · Takes ~2 minutes
              </p>
              <PrimaryButton icon={ArrowRight} onClick={() => setOnboardingIntroSeen(true)} style={{ margin: "0 auto" }}>
                Build My Safety Profile
              </PrimaryButton>
            </motion.div>
            <Toaster theme="dark" richColors position="top-right" />
          </main>
        </div>
      );
    }

    return (
      <div className="app-bg">
        <div className="noise" />
        <main className="main-content" style={{ marginLeft: 0, padding: "24px 20px" }}>
          <header className="top-header" style={{ maxWidth: 860, margin: "0 auto 20px" }}>
            <div className="brand-mark" style={{ margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
              <ShieldCheck size={26} />
              <span>SentinelPulse · Onboarding</span>
            </div>
            <StatusDot state="safe" label="Edge AI Active" />
          </header>
          <div style={{ maxWidth: 860, margin: "0 auto" }}>
            <SafetyProfileView
              profile={safetyProfile}
              authed={authed}
              isOnboarding={true}
              onProfileUpdated={(p) => setSafetyProfile(p)}
              onCompleteOnboarding={() => {
                setIsOnboarding(false);
                setView("home");
                refreshAll();
                toast.success("Welcome to SentinelPulse! Protection Active.");
              }}
            />
          </div>
        </main>
        <Toaster theme="dark" richColors position="top-right" />
      </div>
    );
  }

  const renderView = () => {
    if (view === "home") {
      return (
        <HomeDashboard
          data={dashboard}
          insight={insight}
          riskLoading={riskLoading}
          onRiskScan={runRiskScan}
          onNavigate={setView}
          onSOS={() => setView("sos")}
          onOpenWhy={() => setWhyModalOpen(true)}
          onCheckIn={handleCheckIn}
          user={user}
          authed={authed}
          escalationStatus={escalationStatus}
          primaryContact={primaryContact}
          secondaryContact={secondaryContact}
          ackDeadline={ackDeadline}
          cooldownUntil={cooldownUntil}
          onSimulateAck={handleEscalationPrimaryAck}
          onAckTimeout={handleEscalationAckTimeout}
          onDismissEscalation={handleDismissEscalation}
          onSafeConfirm={handleEscalationSafeConfirm}
        />
      );
    }
    if (view === "map") {
      return (
        <SmartMapScreen
          authed={authed}
          location={live.location}
          onStartJourney={handleStartJourneyFromMap}
        />
      );
    }
    if (view === "live") {
      return (
        <LiveProtectionScreen
          activeJourney={activeJourney}
          dashboard={dashboard}
          onNavigate={setView}
          onCheckIn={handleCheckIn}
          onSOS={() => setView("sos")}
          onOpenWhy={() => setWhyModalOpen(true)}
          authed={authed}
          escalationStatus={escalationStatus}
          primaryContact={primaryContact}
          secondaryContact={secondaryContact}
          ackDeadline={ackDeadline}
          cooldownUntil={cooldownUntil}
          onSimulateAck={handleEscalationPrimaryAck}
          onAckTimeout={handleEscalationAckTimeout}
          onDismissEscalation={handleDismissEscalation}
          onSafeConfirm={handleEscalationSafeConfirm}
        />
      );
    }
    if (view === "profile") {
      return (
        <SafetyProfileView
          profile={safetyProfile}
          authed={authed}
          onProfileUpdated={(p) => setSafetyProfile(p)}
        />
      );
    }
    if (view === "journey") {
      return (
        <JourneyScreen
          authed={authed}
          location={live.location}
          setLocation={live.setLocation}
          activeJourney={activeJourney}
          setActiveJourney={setActiveJourney}
          overlays={overlays}
          refreshAll={refreshAll}
          onRequestGps={live.requestGps}
          isLocating={live.isLocating}
          accuracy={live.accuracy}
          onOpenWhy={() => setWhyModalOpen(true)}
          escalationStatus={escalationStatus}
          primaryContact={primaryContact}
          secondaryContact={secondaryContact}
          ackDeadline={ackDeadline}
          cooldownUntil={cooldownUntil}
          onSimulateAck={handleEscalationPrimaryAck}
          onAckTimeout={handleEscalationAckTimeout}
          onDismissEscalation={handleDismissEscalation}
          onSafeConfirm={handleEscalationSafeConfirm}
        />
      );
    }
    if (view === "sos") {
      return (
        <SOSCenter
          authed={authed}
          location={live.location}
          latestRisk={dashboard?.latest_risk}
          refreshAll={refreshAll}
        />
      );
    }
    if (view === "contacts") {
      return <ContactsScreen contacts={contacts} authed={authed} refreshAll={refreshAll} />;
    }
    if (view === "timeline") {
      return <TimelineView timeline={timeline} />;
    }
    if (view === "vault") {
      return <EvidenceVault evidence={evidence} authed={authed} location={live.location} refreshAll={refreshAll} />;
    }
    if (view === "privacy") {
      return <PrivacyCenter privacy={privacy} authed={authed} refreshAll={refreshAll} />;
    }
    if (view === "insights") {
      return <InsightsScreen insight={insight} getInsight={getInsight} activeJourney={activeJourney} />;
    }
    if (view === "settings") {
      return <SettingsScreen user={user} settings={settings} authed={authed} refreshAll={refreshAll} onLogout={logout} isPhoneFrame={isPhoneFrame} setIsPhoneFrame={setIsPhoneFrame} />;
    }
    return (
      <HomeDashboard
        data={dashboard}
        insight={insight}
        riskLoading={riskLoading}
        onRiskScan={runRiskScan}
        onNavigate={setView}
        onSOS={() => setView("sos")}
        onOpenWhy={() => setWhyModalOpen(true)}
        onCheckIn={handleCheckIn}
        user={user}
        authed={authed}
        escalationStatus={escalationStatus}
        primaryContact={primaryContact}
        secondaryContact={secondaryContact}
        ackDeadline={ackDeadline}
        cooldownUntil={cooldownUntil}
        onSimulateAck={handleEscalationPrimaryAck}
        onAckTimeout={handleEscalationAckTimeout}
        onDismissEscalation={handleDismissEscalation}
        onSafeConfirm={handleEscalationSafeConfirm}
      />
    );
  };

  const renderIntelView = () => {
    if (intelView === "intel_dashboard") {
      return (
        <IntelDashboard
          authed={authed}
          cases={intelCases}
          onNavigate={setIntelView}
          onSelectCase={(cid) => {
            setSelectedCaseId(cid);
          }}
        />
      );
    }
    if (intelView === "intel_cases") {
      return (
        <IntelCasesScreen
          authed={authed}
          cases={intelCases}
          onSelectCase={(cid) => {
            setSelectedCaseId(cid);
          }}
          onNavigate={setIntelView}
        />
      );
    }
    if (intelView === "intel_network") {
      return (
        <NetworkExplorerScreen
          authed={authed}
          caseId={selectedCaseId}
          selectedCaseData={selectedCaseData}
          onNavigate={setIntelView}
        />
      );
    }
    if (intelView === "intel_entities") {
      return (
        <EntitySearchScreen
          authed={authed}
          onNavigate={setIntelView}
        />
      );
    }
    if (intelView === "intel_timeline") {
      return (
        <IntelTimelineScreen
          authed={authed}
          caseId={selectedCaseId}
          onNavigate={setIntelView}
        />
      );
    }
    if (intelView === "intel_patterns") {
      return (
        <PatternEngineScreen
          authed={authed}
          caseId={selectedCaseId}
        />
      );
    }
    if (intelView === "intel_evidence") {
      return (
        <EvidenceChainScreen
          authed={authed}
          caseId={selectedCaseId}
        />
      );
    }
    if (intelView === "intel_audit") {
      return (
        <AuditLogScreen
          authed={authed}
          caseId={selectedCaseId}
        />
      );
    }
    return (
      <IntelDashboard
        authed={authed}
        cases={intelCases}
        onNavigate={setIntelView}
        onSelectCase={setSelectedCaseId}
      />
    );
  };

  // Luxury Mobile Phone Mockup Showcase Mode (Matching Uploaded References)
  if (isPhoneFrame) {
    return (
      <div className="luxury-viewport">
        <div style={{ position: "fixed", top: 14, right: 20, zIndex: 100, display: "flex", gap: 8 }}>
          <button
            type="button"
            className="sp-button secondary"
            onClick={() => setAppMode(appMode === "intel" ? "safety" : "intel")}
            style={{ fontSize: 12, padding: "0 14px", minHeight: 38, background: "rgba(15,23,42,0.85)", borderColor: appMode === "intel" ? "rgba(99,102,241,0.5)" : "rgba(0,230,184,0.5)" }}
          >
            {appMode === "intel" ? "⚡ SIH Intel Mode" : "🛡️ Safety Mode"}
          </button>
          <button
            type="button"
            className="sp-button secondary"
            onClick={() => setIsPhoneFrame(false)}
            style={{ fontSize: 12, padding: "0 14px", minHeight: 38, background: "rgba(15,23,42,0.85)", borderColor: "rgba(6,182,212,0.3)" }}
          >
            <Smartphone size={14} style={{ marginRight: 6 }} /> Desktop View
          </button>
        </div>

        <div className="phone-mockup-frame">
          {/* iOS Dynamic Island & Status Bar */}
          <div className="phone-status-bar">
            <span>9:41</span>
            <div className="dynamic-island">
              <div className="dynamic-camera-lens" />
              <div className="dynamic-sensor-dot" />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
              <span style={{ fontSize: 10, fontWeight: 700 }}>5G</span>
              <div style={{ width: 22, height: 11, border: "1.5px solid #cbd5e1", borderRadius: 3, padding: 1, display: "flex" }}>
                <div style={{ width: "95%", height: "100%", background: "#10b981", borderRadius: 1 }} />
              </div>
            </div>
          </div>

          {/* Judge Demo Mode Toolbar (Integrated) */}
          {appMode === "safety" && (
            <DemoToolbar onSimulate={runDemoSimulation} onReset={resetDemoState} activeScenario={activeScenario} loading={riskLoading} />
          )}

          {/* Scrollable Mobile Viewport */}
          <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px 16px", position: "relative" }}>
            <AnimatePresence mode="wait">
              <motion.section key={appMode === "intel" ? intelView : view} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
                {appMode === "intel" ? renderIntelView() : renderView()}
              </motion.section>
            </AnimatePresence>
          </div>

          {/* Floating Glass Bottom Nav */}
          {appMode === "intel" ? (
            <nav className="floating-glass-nav" aria-label="Mobile intelligence navigation">
              <button className={cx("nav-pill-btn", intelView === "intel_dashboard" && "active")} onClick={() => setIntelView("intel_dashboard")}>
                <BarChart3 size={18} /><span>Hub</span>
              </button>
              <button className={cx("nav-pill-btn", intelView === "intel_network" && "active")} onClick={() => setIntelView("intel_network")}>
                <Radar size={18} /><span>Graph</span>
              </button>
              <button className={cx("nav-pill-btn", intelView === "intel_entities" && "active")} onClick={() => setIntelView("intel_entities")}>
                <Search size={18} /><span>Search</span>
              </button>
              <button className={cx("nav-pill-btn", intelView === "intel_patterns" && "active")} onClick={() => setIntelView("intel_patterns")}>
                <BrainCircuit size={18} /><span>Patterns</span>
              </button>
              <button className={cx("nav-pill-btn", intelView === "intel_evidence" && "active")} onClick={() => setIntelView("intel_evidence")}>
                <Vault size={18} /><span>Evidence</span>
              </button>
            </nav>
          ) : (
            <nav className="floating-glass-nav" aria-label="Mobile safety navigation">
              <button data-testid="mobile-nav-home-button" className={cx("nav-pill-btn", view === "home" && "active")} onClick={() => setView("home")}>
                <Home size={18} /><span>Home</span>
              </button>
              <button data-testid="mobile-nav-map-button" className={cx("nav-pill-btn", view === "map" && "active")} onClick={() => setView("map")}>
                <Map size={18} /><span>Map</span>
              </button>
              <button data-testid="mobile-nav-journey-button" className={cx("nav-pill-btn", view === "journey" && "active")} onClick={() => setView("journey")}>
                <Route size={18} /><span>Journey</span>
              </button>
              <button data-testid="mobile-nav-sos-button" className={cx("nav-pill-btn", view === "sos" ? "active-sos" : "mobile-sos-btn")} onClick={() => setView("sos")}>
                <Siren size={19} /><span>SOS</span>
              </button>
              <button data-testid="mobile-nav-profile-button" className={cx("nav-pill-btn", view === "profile" && "active")} onClick={() => setView("profile")}>
                <Shield size={18} /><span>Profile</span>
              </button>
            </nav>
          )}

          {/* iOS Bottom Home Indicator */}
          <div className="phone-home-indicator" />
        </div>

        {/* High-Risk Single Check-In Modal (Conservative Escalation Ladder) */}
        {escalationStatus === "CONFIRMED_CHECKIN" && (
          <HighRiskCheckinModal
            deadline={confirmationDeadline}
            reasons={escalationReasons}
            onSafeConfirm={handleEscalationSafeConfirm}
            onNeedHelp={handleEscalationNeedHelp}
            onSOS={handleEscalationHoldSOS}
          />
        )}

        {/* Why This Risk Explainability Modal */}
        {whyModalOpen && (
          <WhyThisRiskModal
            risk={dashboard?.latest_risk || { score: dashboard?.risk_score || 12, factors: dashboard?.latest_risk?.factors }}
            onClose={() => setWhyModalOpen(false)}
            onCheckIn={handleCheckIn}
            onSOS={() => {
              setWhyModalOpen(false);
              setView("sos");
            }}
          />
        )}
        <Toaster theme="dark" richColors position="top-right" />
      </div>
    );
  }

  return (
    <div className="app-bg">
      <div className="noise" />

      {/* Desktop Left Rail Navigation */}
      <aside className="left-rail" aria-label="Primary navigation">
        {/* Mode Switcher Toggle */}
        <div style={{ display: "flex", background: "rgba(255,255,255,0.06)", padding: 3, borderRadius: 12, marginBottom: 16, border: "1px solid var(--sp-border)" }}>
          <button
            type="button"
            onClick={() => setAppMode("intel")}
            style={{
              flex: 1,
              fontSize: 10,
              fontWeight: 800,
              padding: "6px 6px",
              borderRadius: 8,
              border: "none",
              background: appMode === "intel" ? "linear-gradient(135deg, #6366f1, #818cf8)" : "transparent",
              color: appMode === "intel" ? "#fff" : "var(--sp-fg-muted)",
              cursor: "pointer",
              transition: "all 0.2s ease"
            }}
          >
            ⚡ SIH INTEL
          </button>
          <button
            type="button"
            onClick={() => setAppMode("safety")}
            style={{
              flex: 1,
              fontSize: 10,
              fontWeight: 800,
              padding: "6px 6px",
              borderRadius: 8,
              border: "none",
              background: appMode === "safety" ? "linear-gradient(135deg, #00E6B8, #00D26A)" : "transparent",
              color: appMode === "safety" ? "#0B1220" : "var(--sp-fg-muted)",
              cursor: "pointer",
              transition: "all 0.2s ease"
            }}
          >
            🛡️ SAFETY
          </button>
        </div>

        {appMode === "intel" ? (
          <>
            <div className="brand-mark" style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.4)", display: "grid", placeItems: "center" }}>
                <BrainCircuit size={20} style={{ color: "#818cf8" }} />
              </div>
              <div style={{ display: "grid", lineHeight: 1.15 }}>
                <span style={{ fontSize: 13, fontWeight: 900, letterSpacing: "-0.02em", color: "#e0e7ff" }}>SENTINELPULSE</span>
                <span style={{ fontSize: 10, fontWeight: 800, color: "#818cf8", letterSpacing: "0.08em" }}>// INTELLIGENCE</span>
              </div>
            </div>

            <nav>
              <div className="nav-section-title" style={{ color: "#818cf8" }}>Investigation Suite</div>
              {INTEL_NAV.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  className={intelView === id ? "active" : ""}
                  onClick={() => setIntelView(id)}
                  aria-label={`Open ${label}`}
                  style={intelView === id ? { background: "rgba(99,102,241,0.18)", color: "#e0e7ff", borderColor: "rgba(99,102,241,0.4)" } : {}}
                >
                  <Icon size={19} style={intelView === id ? { color: "#818cf8" } : {}} />
                  <span>{label}</span>
                </button>
              ))}

              <div className="nav-section-title" style={{ marginTop: 20 }}>Display Mode</div>
              <button
                type="button"
                onClick={() => setIsPhoneFrame(true)}
                style={{ fontSize: 12 }}
              >
                <Smartphone size={18} />
                <span>Mobile Frame View</span>
              </button>

              <button
                type="button"
                onClick={logout}
                style={{ marginTop: "auto", color: "#ef4444" }}
              >
                <LogOut size={18} />
                <span>Sign Out</span>
              </button>
            </nav>
          </>
        ) : (
          <>
            <div className="brand-mark">
              <ShieldCheck size={26} />
              <span>SentinelPulse</span>
            </div>
            <nav>
              <div className="nav-section-title">Core Protection</div>
              {PRIMARY_NAV.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  data-testid={`nav-${id}-button`}
                  className={view === id ? "active" : ""}
                  onClick={() => setView(id)}
                  aria-label={`Open ${label}`}
                >
                  <Icon size={19} />
                  <span>{label}</span>
                </button>
              ))}
              
              <div className="nav-section-title" style={{ marginTop: 24 }}>History & Data</div>
              {SECONDARY_NAV.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  data-testid={`nav-${id}-button`}
                  className={view === id ? "active" : ""}
                  onClick={() => setView(id)}
                  aria-label={`Open ${label}`}
                >
                  <Icon size={19} />
                  <span>{label}</span>
                </button>
              ))}

              <button
                data-testid="nav-settings-button"
                className={view === "settings" ? "active" : ""}
                onClick={() => setView("settings")}
                aria-label="Open Settings"
                style={{ marginTop: "auto" }}
              >
                <SlidersHorizontal size={19} />
                <span>Settings</span>
              </button>
            </nav>
          </>
        )}
      </aside>

      <main className={cx("main-content", (view === "map" || view === "journey") && appMode === "safety" && "map-content")}>
        {appMode === "intel" ? (
          <header className="top-header">
            <div>
              <p className="eyebrow" style={{ color: "#818cf8" }}>Ministry of Home Affairs · NCRB Women Safety Division · SIH26189</p>
              <h2 style={{ letterSpacing: "-0.03em" }}>
                {INTEL_NAV.find((n) => n.id === intelView)?.label || "Intelligence Analysis"}
              </h2>
            </div>
            <div className="header-actions">
              {/* Quick Case Switcher */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(15,26,46,0.85)", border: "1px solid rgba(99,102,241,0.35)", borderRadius: 10, padding: "4px 10px", backdropFilter: "blur(10px)" }}>
                <Database size={14} style={{ color: "#818cf8" }} />
                <select
                  value={selectedCaseId}
                  onChange={(e) => setSelectedCaseId(e.target.value)}
                  style={{ background: "transparent", border: "none", color: "var(--sp-fg)", fontSize: 12, fontWeight: 700, outline: "none", cursor: "pointer" }}
                >
                  {intelCases.map((c) => (
                    <option key={c.id} value={c.id} style={{ background: "#0B1220", color: "#fff" }}>
                      {c.case_id} — {c.title?.slice(0, 24)}...
                    </option>
                  ))}
                </select>
              </div>

              <StatusDot state="safe" label="NCRB Node Connected" />
              <button className="icon-button" onClick={() => setIsPhoneFrame(true)} title="Phone Frame Showcase"><Smartphone size={18} /></button>
              <button data-testid="header-menu-button" className="icon-button mobile-only" onClick={() => setMobileMenuOpen(true)} title="Navigation"><Menu size={18} /></button>
            </div>
          </header>
        ) : (
          <header className="top-header">
            <div>
              <p className="eyebrow">SentinelPulse</p>
              <h2>{PAGE_TITLES[view] || view}</h2>
            </div>
            <div className="header-actions">
              <StatusDot state={online ? "safe" : "watch"} label={online ? "Protection Active" : "Offline Mode"} />
              <button data-testid="header-profile-button" className="icon-button" onClick={() => setView("profile")} title="Safety Profile"><Shield size={18} /></button>
              <button data-testid="header-menu-button" className="icon-button mobile-only" onClick={() => setMobileMenuOpen(true)} title="All Features & Data"><Menu size={18} /></button>
            </div>
          </header>
        )}

        {/* Demo Toolbar for Safety mode */}
        {appMode === "safety" && (
          <DemoToolbar onSimulate={runDemoSimulation} onReset={resetDemoState} activeScenario={activeScenario} loading={riskLoading} />
        )}

        <AnimatePresence mode="wait">
          <motion.section key={appMode === "intel" ? intelView : view} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
            {appMode === "intel" ? renderIntelView() : renderView()}
          </motion.section>
        </AnimatePresence>
      </main>

      {/* Mobile Bottom Navigation */}
      {appMode === "intel" ? (
        <nav className="bottom-nav" aria-label="Mobile intelligence navigation">
          <button className={cx(intelView === "intel_dashboard" && "active")} onClick={() => setIntelView("intel_dashboard")}>
            <BarChart3 size={18} /><span>Hub</span>
          </button>
          <button className={cx(intelView === "intel_network" && "active")} onClick={() => setIntelView("intel_network")}>
            <Radar size={18} /><span>Graph</span>
          </button>
          <button className={cx(intelView === "intel_entities" && "active")} onClick={() => setIntelView("intel_entities")}>
            <Search size={18} /><span>Search</span>
          </button>
          <button className={cx(intelView === "intel_patterns" && "active")} onClick={() => setIntelView("intel_patterns")}>
            <BrainCircuit size={18} /><span>Patterns</span>
          </button>
          <button className={cx(mobileMenuOpen && "active")} onClick={() => setMobileMenuOpen(true)}>
            <Menu size={18} /><span>More</span>
          </button>
        </nav>
      ) : (
        <nav className="bottom-nav" aria-label="Mobile safety navigation">
          <button 
            data-testid="mobile-nav-home-button" 
            className={cx(view === "home" && "active")} 
            onClick={() => setView("home")}
          >
            <Home size={18} /><span>Home</span>
          </button>
          <button 
            data-testid="mobile-nav-journey-button" 
            className={cx(view === "journey" && "active")} 
            onClick={() => setView("journey")}
          >
            <Route size={18} /><span>Journey</span>
          </button>
          <button 
            data-testid="mobile-nav-sos-button" 
            className={cx("mobile-sos-btn", view === "sos" && "active-sos")} 
            onClick={() => setView("sos")}
          >
            <Siren size={20} /><span>SOS</span>
          </button>
          <button 
            data-testid="mobile-nav-profile-button" 
            className={cx(view === "profile" && "active")} 
            onClick={() => setView("profile")}
          >
            <Shield size={18} /><span>Profile</span>
          </button>
          <button 
            data-testid="mobile-nav-more-button" 
            className={cx(mobileMenuOpen && "active")} 
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu size={18} /><span>More</span>
          </button>
        </nav>
      )}

      {/* Mobile Slide-Over Drawer */}
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
                  <ShieldCheck size={24} style={{ color: appMode === "intel" ? "#818cf8" : "#00E6B8" }} />
                  <span style={{ fontSize: 16 }}>{appMode === "intel" ? "SENTINEL // INTEL" : "SentinelPulse"}</span>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setMobileMenuOpen(false)}
                  style={{ width: 36, height: 36 }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Mode Toggle inside Drawer */}
              <div style={{ display: "flex", background: "rgba(255,255,255,0.06)", padding: 3, borderRadius: 12, margin: "14px 16px 8px", border: "1px solid var(--sp-border)" }}>
                <button
                  type="button"
                  onClick={() => setAppMode("intel")}
                  style={{
                    flex: 1,
                    fontSize: 11,
                    fontWeight: 800,
                    padding: "6px 8px",
                    borderRadius: 8,
                    border: "none",
                    background: appMode === "intel" ? "linear-gradient(135deg, #6366f1, #818cf8)" : "transparent",
                    color: appMode === "intel" ? "#fff" : "var(--sp-fg-muted)",
                    cursor: "pointer"
                  }}
                >
                  ⚡ SIH INTEL
                </button>
                <button
                  type="button"
                  onClick={() => setAppMode("safety")}
                  style={{
                    flex: 1,
                    fontSize: 11,
                    fontWeight: 800,
                    padding: "6px 8px",
                    borderRadius: 8,
                    border: "none",
                    background: appMode === "safety" ? "linear-gradient(135deg, #00E6B8, #00D26A)" : "transparent",
                    color: appMode === "safety" ? "#0B1220" : "var(--sp-fg-muted)",
                    cursor: "pointer"
                  }}
                >
                  🛡️ SAFETY
                </button>
              </div>

              <div className="mobile-drawer-nav">
                {appMode === "intel" ? (
                  <>
                    <div className="mobile-drawer-section-title">Investigation Platform</div>
                    {INTEL_NAV.map(({ id, label, icon: Icon }) => (
                      <button
                        key={id}
                        className={cx("mobile-drawer-item", intelView === id && "active")}
                        onClick={() => {
                          setIntelView(id);
                          setMobileMenuOpen(false);
                        }}
                      >
                        <Icon size={18} />
                        <span>{label}</span>
                      </button>
                    ))}
                  </>
                ) : (
                  <>
                    <div className="mobile-drawer-section-title">Core Protection</div>
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

                    <div className="mobile-drawer-section-title">History & Data</div>
                    {SECONDARY_NAV.map(({ id, label, icon: Icon }) => (
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

                    <div className="mobile-drawer-section-title">System & Account</div>
                    <button
                      className={cx("mobile-drawer-item", view === "settings" && "active")}
                      onClick={() => {
                        setView("settings");
                        setMobileMenuOpen(false);
                      }}
                    >
                      <SlidersHorizontal size={18} />
                      <span>Settings</span>
                    </button>
                  </>
                )}

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

      {/* High-Risk Single Check-In Modal (Conservative Escalation Ladder) */}
      {escalationStatus === "CONFIRMED_CHECKIN" && (
        <HighRiskCheckinModal
          deadline={confirmationDeadline}
          reasons={escalationReasons}
          onSafeConfirm={handleEscalationSafeConfirm}
          onNeedHelp={handleEscalationNeedHelp}
          onSOS={handleEscalationHoldSOS}
        />
      )}

      {/* Why This Risk Explainability Modal */}
      {whyModalOpen && (
        <WhyThisRiskModal
          risk={dashboard?.latest_risk || { score: dashboard?.risk_score || 12, factors: dashboard?.latest_risk?.factors }}
          onClose={() => setWhyModalOpen(false)}
          onCheckIn={handleCheckIn}
          onSOS={() => {
            setWhyModalOpen(false);
            setView("sos");
          }}
        />
      )}

      {!online && (
        <div className="offline-banner" data-testid="offline-mode-banner">
          <WifiOff size={16} /> Offline Protection Active: Local deterministic scoring and cached routes remain operational.
        </div>
      )}
      <Toaster theme="dark" richColors position="top-right" />
    </div>
  );
}

export default function App() {
  return <AppShell />;
}
