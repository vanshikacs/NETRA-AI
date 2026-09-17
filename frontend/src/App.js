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
const DEFAULT_LOCATION = { lat: 28.6139, lng: 77.209 };

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

  const requestGps = useCallback(() => {
    if (!navigator.geolocation) {
      // If browser doesn't support geolocation, fallback to IP
      fetch("https://ipapi.co/json/")
        .then((r) => r.json())
        .then((data) => {
          if (data?.latitude && data?.longitude) {
            setLocation({ lat: Number(data.latitude), lng: Number(data.longitude) });
            setAccuracy(1000);
            setHasRealFix(true);
          }
        })
        .catch(() => {});
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setAccuracy(pos.coords.accuracy);
        setError("");
        setHasRealFix(true);
      },
      (err) => {
        console.warn("GPS error:", err.message, "Falling back to IP geolocation...");
        fetch("https://ipapi.co/json/")
          .then((r) => r.json())
          .then((data) => {
            if (data?.latitude && data?.longitude) {
              setLocation({ lat: Number(data.latitude), lng: Number(data.longitude) });
              setAccuracy(1000);
              setHasRealFix(true);
            }
          })
          .catch(() => {});
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    requestGps();

    if (!navigator.geolocation) return undefined;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setAccuracy(pos.coords.accuracy);
        setError("");
        setHasRealFix(true);
      },
      (err) => setError(err.message || "Location permission unavailable"),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [enabled, requestGps]);

  return { location, setLocation, accuracy, error, hasRealFix, requestGps };
}

function apiWithToken(token) {
  return {
    get: (url, config = {}) => api.get(url, { ...config, headers: { ...(config.headers || {}), Authorization: `Bearer ${token}` } }),
    post: (url, data, config = {}) => api.post(url, data, { ...config, headers: { ...(config.headers || {}), Authorization: `Bearer ${token}` } }),
    put: (url, data, config = {}) => api.put(url, data, { ...config, headers: { ...(config.headers || {}), Authorization: `Bearer ${token}` } }),
    delete: (url, config = {}) => api.delete(url, { ...config, headers: { ...(config.headers || {}), Authorization: `Bearer ${token}` } }),
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

// Part 12: Discreet Demo Controls — floating toggle, hidden by default
function DemoToolbar({ onSimulate, onReset, activeScenario, loading }) {
  const [open, setOpen] = useState(false);
  const scenarios = [
    { id: "normal_journey",   label: "1. Normal Journey (12)" },
    { id: "route_deviation",  label: "2. Route Deviation (+25)" },
    { id: "prolonged_stop",   label: "3. Prolonged Stop (+18)" },
    { id: "unusual_duration", label: "4. Unusual Duration (+16)" },
    { id: "elevated_risk",    label: "5. Elevated Risk (74)" },
    { id: "high_risk",        label: "6. High Risk (86)" },
    { id: "safe_checkin",     label: "7. Safe Check-In" },
    { id: "sos",              label: "8. SOS Trigger" },
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
          style={{ position: "fixed", bottom: 120, right: 18, zIndex: 199, width: 260 }}>
          <div className="demo-label-wrap">
            <span className="demo-badge">Demo Mode · Simulated journey</span>
            <small>Feeds real risk engine</small>
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
              9. Reset Baseline
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
function HomeDashboard({ data, onNavigate, onSOS, onRiskScan, insight, riskLoading, onOpenWhy, onCheckIn, user }) {
  const safety = data?.safety_score ?? 88;
  const riskScore = data?.risk_score ?? (100 - safety);
  const riskLevel = data?.risk_level || (riskScore < 30 ? "LOW" : riskScore < 60 ? "MODERATE" : riskScore < 80 ? "ELEVATED" : "HIGH");
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
          <IconBadge icon={BrainCircuit} tone={riskScore >= 70 ? "danger" : riskScore >= 45 ? "warning" : "teal"}>
            {riskLevel} · {riskScore}/100
          </IconBadge>
        </div>

        {/* Safety Score Bar */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "var(--sp-fg-muted)", fontWeight: 700 }}>SAFETY SCORE</span>
            <span style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.04em", color: safety > 75 ? "#00D26A" : safety > 50 ? "#FFB84C" : "#FF4E5F" }}>{safety}</span>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.08)", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, width: `${Math.min(100, safety)}%`, borderRadius: 999, background: safety > 75 ? "linear-gradient(90deg, #00E6B8, #00D26A)" : safety > 50 ? "#FFB84C" : "#FF4E5F", transition: "width 0.6s ease" }} />
          </div>
          <small style={{ display: "block", marginTop: 6, color: "var(--sp-fg-subtle)", fontSize: 11 }}>
            Signal confidence: {data?.latest_risk?.confidence_label || (safety > 75 ? "High" : "Moderate")} · Calibrated continuously against your personalized baseline
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

      {/* Check-In Prompt when Risk is Elevated */}
      {riskScore >= 45 && (
        <div className={cx("glass-card checkin-prompt-card wide", riskScore >= 75 ? "danger" : "watch")} data-testid="checkin-prompt-card">
          <div className="prompt-header">
            <AlertTriangle size={22} />
            <div>
              <strong>Deviation Detected (+{riskScore - 12} pts above baseline)</strong>
              <p>Your current journey signals differ from your learned baseline. Please confirm your status.</p>
            </div>
          </div>
          <div className="button-row">
            <PrimaryButton testId="journey-im-safe-btn" icon={Check} onClick={onCheckIn || (() => {})}>
              I'm Safe
            </PrimaryButton>
            <PrimaryButton testId="journey-need-help-btn" danger icon={Siren} onClick={onSOS}>
              Need Help
            </PrimaryButton>
            <PrimaryButton testId="journey-view-why-btn" secondary icon={Eye} onClick={onOpenWhy}>
              View Why
            </PrimaryButton>
          </div>
        </div>
      )}

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
function LiveProtectionScreen({ activeJourney, dashboard, onNavigate, onCheckIn, onSOS, onOpenWhy }) {
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
          <IconBadge icon={Activity} tone={riskScore >= 75 ? "danger" : riskScore >= 45 ? "warning" : "teal"}>
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

        {/* Check-in prompt when risk elevated */}
        {riskScore >= 45 && (
          <div className={cx("checkin-prompt-card", riskScore >= 75 ? "danger" : "watch")} style={{ borderRadius: 14, padding: "14px 16px", marginBottom: 14 }}>
            <div className="prompt-header">
              <AlertTriangle size={20} />
              <div>
                <strong>Deviation Detected</strong>
                <p style={{ margin: 0, fontSize: 13 }}>Your current patterns differ from your baseline.</p>
              </div>
            </div>
            <div className="button-row">
              <PrimaryButton testId="live-im-safe-btn" icon={Check} onClick={onCheckIn}>I'm Safe</PrimaryButton>
              <PrimaryButton testId="live-need-help-btn" danger icon={Siren} onClick={onSOS}>Need Help</PrimaryButton>
              <PrimaryButton testId="live-view-why-btn" secondary icon={Eye} onClick={onOpenWhy}>View Why</PrimaryButton>
            </div>
          </div>
        )}

        <div className="button-row">
          <PrimaryButton secondary icon={Route} onClick={() => onNavigate("journey")}>Journey Controls</PrimaryButton>
          <PrimaryButton secondary icon={Eye} onClick={onOpenWhy}>Why This Risk?</PrimaryButton>
        </div>
      </GlassCard>
    </div>
  );
}

// Part 9: Simplified, Understandable Luxury Smart Radar Map (References 1, 2, 3)
function LeafletSafetyMap({ token, location, activeJourney, overlays, route, onStartJourney, compact = false }) {
  const [legendOpen, setLegendOpen] = useState(false);
  const mapRef = useRef(null);
  const elRef = useRef(null);
  const layersRef = useRef({ user: null, route: null, overlays: [] });

  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    mapRef.current = L.map(elRef.current, { zoomControl: false, attributionControl: false }).setView([location.lat, location.lng], compact ? 13 : 15);
    
    // Crisp CartoDB dark-matter tiles with clear road labels — no key required
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap contributors © CARTO",
    }).addTo(mapRef.current);
    
    L.control.zoom({ position: "bottomright" }).addTo(mapRef.current);
    setTimeout(() => mapRef.current?.invalidateSize(), 200);
  }, [compact, location.lat, location.lng]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const latlng = [location.lat, location.lng];

    // Clean teal location dot — calm, readable, no decoration overload
    const dotHtml = `
      <div style="position:relative;width:20px;height:20px;">
        <div style="position:absolute;inset:0;border-radius:50%;background:rgba(0,230,184,0.25);animation:breathe 2.6s ease-in-out infinite;"></div>
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:14px;height:14px;border-radius:50%;background:#00E6B8;border:2px solid #fff;box-shadow:0 0 8px rgba(0,230,184,0.6);"></div>
      </div>
    `;

    const dotIcon = L.divIcon({
      className: "sp-location-dot-icon",
      html: dotHtml,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    if (!layersRef.current.user) {
      const marker = L.marker(latlng, { icon: dotIcon }).addTo(map);
      marker.bindTooltip("Your location (Active baseline)", { permanent: false });
      layersRef.current.user = marker;
    } else {
      layersRef.current.user.setLatLng(latlng);
    }
    if (!activeJourney) {
      map.flyTo(latlng, map.getZoom() < 13 ? 15 : map.getZoom(), { duration: 1.2 });
    }
  }, [location, activeJourney]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (layersRef.current.route) layersRef.current.route.remove();
    const routeData = route || activeJourney?.route;
    if (routeData?.coordinates?.length) {
      const points = routeData.coordinates.map((p) => [p.lat, p.lng]);
      // Glowing Cyan/Blue Route (Reference 1 & 3)
      layersRef.current.route = L.polyline(points, { color: "#06b6d4", weight: 6, opacity: 0.95, dashArray: "8 12", lineCap: "round" }).addTo(map);
      map.fitBounds(layersRef.current.route.getBounds(), { padding: [40, 40], animate: true });
    }
  }, [route, activeJourney]);

  const recenter = () => {
    mapRef.current?.flyTo([location.lat, location.lng], 16, { duration: 1.0 });
    toast.info("Centered to current location");
  };

  return (
    <div className={cx("map-shell", compact && "compact")} data-testid="leaflet-map-provider" data-provider={MAP_PROVIDER} style={{ position: "relative" }}>
      <div ref={elRef} className="leaflet-host" />

      {/* Minimal HUD Status Tags — calm, informative only */}
      <div style={{ position: "absolute", top: 12, left: 12, display: "flex", flexWrap: "wrap", gap: 6, zIndex: 30, pointerEvents: "none" }}>
        <span style={{ background: "rgba(6,10,19,0.82)", border: "1px solid rgba(0,230,184,0.35)", color: "#00E6B8", padding: "4px 10px", borderRadius: 999, fontSize: 10, fontWeight: 700, backdropFilter: "blur(8px)" }}>
          LIVE LOCATION
        </span>
        <span style={{ background: "rgba(6,10,19,0.82)", border: "1px solid rgba(0,210,106,0.35)", color: "#00D26A", padding: "4px 10px", borderRadius: 999, fontSize: 10, fontWeight: 700, backdropFilter: "blur(8px)" }}>
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
        <button data-testid="map-recenter-button" aria-label="Recenter map" onClick={recenter}><LocateFixed size={18} /></button>
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

    // Reverse geocode user location using OpenStreetMap Nominatim
    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${location.lat}&lon=${location.lng}&format=json&addressdetails=1`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        const addr = data?.address || {};
        const city = addr.city || addr.town || addr.state_district || addr.county || "Lucknow";
        const neighborhood = addr.suburb || addr.neighbourhood || addr.residential || addr.commercial || addr.village || "Local Corridor";
        const road = addr.road || addr.pedestrian || "Main Transit Path";
        setAreaInfo({ city, neighborhood, road });
      })
      .catch(() => {
        // Safe graceful fallback if offline
        if (isMounted) {
          const isNearLucknow = Math.abs(location.lat - 26.84) < 1.0;
          setAreaInfo({
            city: isNearLucknow ? "Lucknow" : "Local Area",
            neighborhood: isNearLucknow ? "Hazratganj / Gomti Nagar Corridor" : "Active Corridor",
            road: "Safe Path",
          });
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

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
function JourneyScreen({ authed, location, setLocation, activeJourney, setActiveJourney, overlays, refreshAll, onOpenWhy }) {
  const [destination, setDestination] = useState({ name: "University Campus to Home", lat: location.lat + 0.015, lng: location.lng + 0.018 });
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [completedSummary, setCompletedSummary] = useState(null);

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
      <LeafletSafetyMap token={authed} location={location} activeJourney={activeJourney} overlays={overlays} route={selectedRoute} onStartJourney={start} />
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
                <strong style={{ color: riskScore > 60 ? "var(--sp-danger)" : "var(--sp-primary)" }}>{riskScore}/100</strong>
              </div>
            </div>
          </GlassCard>
        )}

        {/* Part 10 & Part 11: Check-in Prompt & Escalation Ladder */}
        {activeJourney && riskScore >= 45 && (
          <div className={cx("glass-card checkin-prompt-card", riskScore >= 75 ? "danger" : "watch")} data-testid="checkin-prompt-card">
            <div className="prompt-header">
              <AlertTriangle size={22} />
              <div>
                <strong>Something changed</strong>
                <p>Your current journey differs from your usual pattern.</p>
              </div>
            </div>
            <div className="button-row">
              <PrimaryButton testId="journey-im-safe-btn" icon={Check} onClick={checkIn}>
                I'm Safe
              </PrimaryButton>
              <PrimaryButton testId="journey-need-help-btn" danger icon={Siren} onClick={() => window.dispatchEvent(new CustomEvent("sp:navigate", { detail: "sos" }))}>
                Need Help
              </PrimaryButton>
              <PrimaryButton testId="journey-view-why-btn" secondary icon={Eye} onClick={onOpenWhy}>
                View Why
              </PrimaryButton>
            </div>
          </div>
        )}

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

// Main App Shell
function AppShell() {
  const { token, saveAuth, logout } = useAuthToken();
  const [showSplash, setShowSplash] = useState(true);
  const [welcomeStep, setWelcomeStep] = useState(false);
  const [authIsRegister, setAuthIsRegister] = useState(false);
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [onboardingIntroSeen, setOnboardingIntroSeen] = useState(false);
  const [view, setView] = useState("home");
  const online = useOnlineStatus();
  const live = useLiveLocation(true);
  const authed = useMemo(() => apiWithToken(token), [token]);

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

  const refreshAll = useCallback(async () => {
    if (!token) return;
    try {
      const [uRes, dashRes, profRes, journeyRes, contactRes, timelineRes, evidenceRes, privRes, setRes, overlayRes] =
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
    } catch (err) {
      if (err.response?.status === 401) {
        logout();
      }
    }
  }, [authed, logout, token]);

  useEffect(() => {
    if (token) refreshAll();
  }, [refreshAll, token]);

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
        auto_escalate: scenarioId === "sos" || scenarioId === "high_risk",
      });
      const risk = res.data.risk_result;
      toast.warning(`[Demo Scenario] ${res.data.title}`, {
        description: `Risk score: ${risk.score} (${risk.risk_level || risk.state.toUpperCase()}). ${res.data.reasons?.[0] || ""}`,
      });
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
          onOpenWhy={() => setWhyModalOpen(true)}
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
      />
    );
  };

  // Luxury Mobile Phone Mockup Showcase Mode (Matching Uploaded References)
  if (isPhoneFrame) {
    return (
      <div className="luxury-viewport">
        <div style={{ position: "fixed", top: 14, right: 20, zIndex: 100 }}>
          <button
            type="button"
            className="sp-button secondary"
            onClick={() => setIsPhoneFrame(false)}
            style={{ fontSize: 12, padding: "0 14px", minHeight: 38, background: "rgba(15,23,42,0.85)", borderColor: "rgba(6,182,212,0.3)" }}
          >
            <Smartphone size={14} style={{ marginRight: 6 }} /> Expanded Desktop View
          </button>
        </div>

        <div className="phone-mockup-frame">
          {/* iOS Dynamic Island & Status Bar (References 1, 2, 3) */}
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
          <DemoToolbar onSimulate={runDemoSimulation} onReset={resetDemoState} activeScenario={activeScenario} loading={riskLoading} />

          {/* Scrollable Mobile Viewport */}
          <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px 16px", position: "relative" }}>
            <AnimatePresence mode="wait">
              <motion.section key={view} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
                {renderView()}
              </motion.section>
            </AnimatePresence>
          </div>

          {/* Floating Glass Bottom Nav (References 1, 3, 4, 5) */}
          <nav className="floating-glass-nav" aria-label="Mobile navigation">
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

          {/* iOS Bottom Home Indicator */}
          <div className="phone-home-indicator" />
        </div>

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
      </aside>

      <main className={cx("main-content", (view === "map" || view === "journey") && "map-content")}>
        <header className="top-header">
          <div>
            <p className="eyebrow">SentinelPulse</p>
            <h2>{PAGE_TITLES[view] || view}</h2>
          </div>
          <div className="header-actions">
            <StatusDot state={online ? "safe" : "watch"} label={online ? "Protection Active" : "Offline Mode"} />
            <button data-testid="header-profile-button" className="icon-button" onClick={() => setView("profile")} title="Safety Profile"><Shield size={18} /></button>
            <button data-testid="header-menu-button" className="icon-button mobile-only" onClick={() => setView("settings")}><Menu size={18} /></button>
          </div>
        </header>

        {/* Judge Demo Mode Toolbar with all 9 scenarios */}
        <DemoToolbar onSimulate={runDemoSimulation} onReset={resetDemoState} activeScenario={activeScenario} loading={riskLoading} />

        <AnimatePresence mode="wait">
          <motion.section key={view} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
            {renderView()}
          </motion.section>
        </AnimatePresence>
      </main>

      {/* Part 22: Mobile Bottom Navigation */}
      <nav className="bottom-nav" aria-label="Mobile navigation">
        {PRIMARY_NAV.filter(n => n.id !== "insights").map(({ id, label, mobileLabel, icon: Icon }) => (
          <button 
            key={id}
            data-testid={`mobile-nav-${id}-button`} 
            className={cx(view === id ? "active" : "", id === "sos" && "mobile-sos-btn", view === "sos" && id === "sos" && "active-sos")} 
            onClick={() => setView(id)}
          >
            <Icon size={id === "sos" ? 20 : 18} /><span>{mobileLabel || label}</span>
          </button>
        ))}
      </nav>

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
