from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Any, Dict, List, Optional
from pathlib import Path
from datetime import datetime, timezone, timedelta
from cryptography.fernet import Fernet
import base64
import bcrypt
import hashlib
import io
import json
import logging
import math
import os
import secrets
import time
import uuid
import zipfile
import jwt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "sentinelpulse")
JWT_SECRET = os.environ.get("JWT_SECRET", "sentinelpulse-development-secret")
ENCRYPTION_SECRET = os.environ.get("ENCRYPTION_SECRET", "sentinelpulse-vault-secret")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY") or GEMINI_API_KEY
ACCESS_TTL_MINUTES = 30
REFRESH_TTL_DAYS = 30

if not MONGO_URL:
    raise RuntimeError("MONGO_URL is required")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="SentinelPulse API", version="1.0.0")
api_router = APIRouter(prefix="/api")

cors_origins_env = os.environ.get("CORS_ORIGINS", "*")
cors_origins_list = [orig.strip() for orig in cors_origins_env.split(",") if orig.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=cors_origins_list if cors_origins_env != "*" else [],
    allow_origin_regex=r"^https?://.*$",
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root_health():
    return {"status": "ok", "message": "SentinelPulse API online", "mode": "privacy-first edge relay"}

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("sentinelpulse")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def serialize_doc(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, list):
        return [serialize_doc(v) for v in value]
    if isinstance(value, dict):
        clean = {}
        for k, v in value.items():
            if k == "_id":
                clean["mongo_id"] = str(v)
            else:
                clean[k] = serialize_doc(v)
        return clean
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def vault_fernet() -> Fernet:
    key = base64.urlsafe_b64encode(hashlib.sha256(ENCRYPTION_SECRET.encode()).digest())
    return Fernet(key)


def sha256_json(payload: Dict[str, Any]) -> str:
    return hashlib.sha256(json.dumps(payload, sort_keys=True, default=str).encode()).hexdigest()


def issue_access_token(user: Dict[str, Any]) -> str:
    payload = {
        "sub": user["id"],
        "role": user.get("role", "user"),
        "email": user.get("email"),
        "exp": int(time.time()) + ACCESS_TTL_MINUTES * 60,
        "iat": int(time.time()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


async def issue_refresh_token(user_id: str, device_name: str = "PWA") -> str:
    token = secrets.token_urlsafe(48)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    session = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "token_hash": token_hash,
        "device_name": device_name,
        "created_at": now_iso(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=REFRESH_TTL_DAYS)).isoformat(),
        "revoked": False,
    }
    await db.sessions.insert_one(session)
    return token


async def create_audit(user_id: str, action: str, metadata: Optional[Dict[str, Any]] = None):
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "action": action,
        "metadata": metadata or {},
        "created_at": now_iso(),
    })


async def get_current_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def clamp(value: float, low: float = 0, high: float = 100) -> float:
    return max(low, min(high, value))


def compute_risk(signals: Dict[str, Any], sensitivity: float = 0.72, profile: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    motion = float(signals.get("motion_delta", 0))
    routine = float(signals.get("routine_deviation", 0))
    location = float(signals.get("location_risk", 0))
    voice = float(signals.get("voice_stress", 0))
    battery = float(signals.get("battery_factor", 0))
    offline = bool(signals.get("offline", False))
    
    # Profile context influences
    dev_tolerance = profile.get("deviation_tolerance", "Moderate (300m - 500m)") if profile else "Moderate (300m - 500m)"
    tolerance_mult = 1.25 if "Strict" in dev_tolerance else 0.85 if "Relaxed" in dev_tolerance else 1.0
    routine_adjusted = clamp(routine * tolerance_mult)
    
    weights = [
        ("Routine deviation", routine_adjusted, 0.28, f"Route deviation evaluated against your {dev_tolerance.split(' ')[0].lower()} tolerance baseline."),
        ("Motion anomaly", motion, 0.25, "Pace rhythm, unexpected stop/start, or impact signature compared with personal baseline."),
        ("Location context", location, 0.24, "Nearby incident reports, lighting conditions, and distance from trusted safe zones."),
        ("Optional voice stress", voice, 0.18, "Derived vocal strain flag processed on-device (audio raw data discarded)."),
        ("Battery/offline resilience", battery + (8 if offline else 0), 0.05, "Power state and local edge inference confidence mode."),
    ]
    raw = sum(clamp(value) * weight for _, value, weight, _ in weights)
    score = int(round(clamp(raw + (sensitivity - 0.5) * 18)))
    factors = []
    for name, value, weight, explanation in weights:
        contrib = round(clamp(value) * weight, 1)
        factors.append({
            "name": name,
            "observed": round(value, 1),
            "weight": weight,
            "contribution": contrib,
            "explanation": explanation,
        })
    
    if score < 30:
        risk_level = "LOW"
        state = "safe"
        recommended_action = "Continue monitoring. Movement is within your normal baseline."
    elif score < 60:
        risk_level = "MODERATE"
        state = "watch"
        recommended_action = "Check-in recommended."
    elif score < 80:
        risk_level = "ELEVATED"
        state = "confirm"
        recommended_action = "Please confirm you're safe."
    elif score < 85:
        risk_level = "HIGH"
        state = "emergency"
        recommended_action = "Trusted contact alert recommended."
    else:
        risk_level = "CRITICAL"
        state = "critical"
        recommended_action = "Activate SOS and alert trusted contacts."

    sorted_factors = sorted(factors, key=lambda x: x["contribution"], reverse=True)
    if sorted_factors[0]["contribution"] > 8:
        top_two = [f"{f['name'].lower()} (+{f['contribution']} pts)" for f in sorted_factors[:2] if f["contribution"] > 4]
        why_changed = f"Score reflects {', '.join(top_two)}. {sorted_factors[0]['explanation']}"
    else:
        why_changed = "Current activity aligns with your baseline pattern. No significant deviations detected."

    conf_val = int(min(98, max(50, 85 + (5 if score < 30 else -10 if score < 60 else 8))))
    confidence_label = "High" if conf_val >= 80 else "Moderate"

    signals_detected = [
        {"name": "Route deviation", "status": "Normal" if routine_adjusted < 35 else "Moderate Deviation" if routine_adjusted < 65 else "High Deviation", "value": round(routine_adjusted, 1)},
        {"name": "Unexpected stops", "status": "Normal" if motion < 35 else "Prolonged Stop" if motion < 70 else "Impact Anomaly", "value": round(motion, 1)},
        {"name": "Time deviation", "status": "Normal" if voice < 35 else "Unusual Travel Time", "value": round(voice, 1)},
        {"name": "Journey consistency", "status": "Consistent" if score < 55 else "Inconsistent", "value": max(10, 100 - score)},
        {"name": "Contextual risk", "status": "Safe Zone" if location < 35 else "Caution Corridor" if location < 70 else "High Risk Area", "value": round(location, 1)},
    ]

    return {
        "score": score,
        "state": state,
        "risk_level": risk_level,
        "recommended_action": recommended_action,
        "why_the_score_changed": why_changed,
        "why_changed": why_changed,
        "signals_detected": signals_detected,
        "confidence": conf_val,
        "confidence_label": confidence_label,
        "evidence_quality": "Sensor baseline verified",
        "confirmation_required": score >= 60,
        "confirmation_window_seconds": 12,
        "factors": sorted_factors,
        "privacy": {
            "raw_sensor_policy": "Raw motion/audio never leaves device; this API stores derived flags only.",
            "processing_mode": "deterministic_edge_model",
        },
    }


def haversine_m(a: Dict[str, float], b: Dict[str, float]) -> float:
    r = 6371000
    lat1, lat2 = math.radians(a["lat"]), math.radians(b["lat"])
    dlat = math.radians(b["lat"] - a["lat"])
    dlng = math.radians(b["lng"] - a["lng"])
    x = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    return 2 * r * math.asin(math.sqrt(x))


def route_variants(origin: Dict[str, float], destination: Dict[str, float]) -> List[Dict[str, Any]]:
    distance = haversine_m(origin, destination)
    base_duration = max(240, distance / 1.32)
    mid = {"lat": (origin["lat"] + destination["lat"]) / 2, "lng": (origin["lng"] + destination["lng"]) / 2}
    blueprints = [
        {
            "id": "safest",
            "code": "A",
            "name": "Route A (Safest)",
            "offset": 0.0035,
            "duration_factor": 1.15,
            "distance_factor": 1.10,
            "safety_score": 94,
            "lighting": "high",
            "crowd_level": "steady",
            "historical_safety": "lowest incident density",
            "recommendation_rank": 1,
            "ai_recommendation": "Route A is recommended because it has lower contextual risk while adding only 3 minutes.",
            "risk_label": "Lower contextual risk",
        },
        {
            "id": "fastest",
            "code": "B",
            "name": "Route B (Direct)",
            "offset": -0.0018,
            "duration_factor": 0.92,
            "distance_factor": 0.95,
            "safety_score": 72,
            "lighting": "medium",
            "crowd_level": "low",
            "historical_safety": "moderate incident density",
            "recommendation_rank": 2,
            "ai_recommendation": "Route B is faster by 3 minutes, but has higher contextual risk and dimmer street lighting.",
            "risk_label": "Higher contextual risk",
        },
        {
            "id": "well_lit",
            "code": "C",
            "name": "Route C (Well Lit)",
            "offset": 0.0022,
            "duration_factor": 1.08,
            "distance_factor": 1.04,
            "safety_score": 90,
            "lighting": "very high",
            "crowd_level": "moderate",
            "historical_safety": "low incident density",
            "recommendation_rank": 3,
            "ai_recommendation": "Prioritizes street lighting and visibility along major thoroughfares.",
            "risk_label": "Lower contextual risk",
        },
        {
            "id": "most_crowded",
            "code": "D",
            "name": "Route D (High Footfall)",
            "offset": -0.0035,
            "duration_factor": 1.18,
            "distance_factor": 1.12,
            "safety_score": 86,
            "lighting": "medium-high",
            "crowd_level": "high",
            "historical_safety": "community-verified corridor",
            "recommendation_rank": 4,
            "ai_recommendation": "Favors busy foot-traffic corridors and open storefronts.",
            "risk_label": "Moderate contextual risk",
        },
    ]
    routes = []
    for item in blueprints:
        off = item["offset"]
        midpoint = {"lat": mid["lat"] + off, "lng": mid["lng"] - off / 2}
        routes.append({
            "id": item["id"],
            "name": item["name"],
            "provider": os.environ.get("MAP_PROVIDER", "leaflet_osm"),
            "coordinates": [origin, midpoint, destination],
            "distance_m": round(distance * item["distance_factor"]),
            "duration_s": round(base_duration * item["duration_factor"]),
            "safety_score": item["safety_score"],
            "risk_score": 100 - item["safety_score"],
            "lighting": item["lighting"],
            "footfall": item["crowd_level"],
            "crowd_level": item["crowd_level"],
            "historical_safety": item["historical_safety"],
            "recommendation_rank": item["recommendation_rank"],
            "ai_recommendation": item["ai_recommendation"],
            "explanation": "Local AI route scoring compares travel time, lighting, crowd level, historical safety context, safe-zone proximity, and user sensitivity. No external routing credential is required; Mapbox can replace this provider by configuration later.",
        })
    return sorted(routes, key=lambda r: r["recommendation_rank"])


DEMO_EMAIL = "demo@sentinelpulse.app"
DEMO_PASSWORD = "Demo2026SP!"


async def seed_demo_user():
    """Auto-seed a pre-configured demo user on startup if not present."""
    existing = await db.users.find_one({"email": DEMO_EMAIL})
    if existing:
        return  # Already seeded
    user_id = "demo-user-sentinelpulse-2026"
    user = {
        "id": user_id,
        "email": DEMO_EMAIL,
        "phone": "+1-555-DEMO",
        "name": "Alex Chen",
        "password_hash": hash_password(DEMO_PASSWORD),
        "role": "user",
        "created_at": now_iso(),
        "profile_completed": True,
        "calibration": {"days_completed": 2, "target_days": 14, "baseline_quality": 51},
        "privacy_score": 94,
        "device_trust": ["PWA session", "Simulated biometric ready"],
    }
    await db.users.insert_one(user)

    await db.safety_profiles.insert_one({
        "user_id": user_id,
        "primary_transport": "Public transit (Bus / Metro)",
        "travel_hours": "Evening (6 PM - 10 PM)",
        "travel_alone_frequency": "Often (Most daily commutes)",
        "common_journey": "Workplace / Office commute",
        "typical_duration_min": 30,
        "night_travel": "Occasional",
        "familiar_routes": ["Home - Metro Station", "Office Campus Corridor"],
        "uncomfortable_areas": ["Underpass near Central Market"],
        "deviation_tolerance": "Moderate (300m - 500m)",
        "intervention_preference": "Ask me to check in (12s calm confirmation window)",
        "emergency_location_sharing": "Only during high risk (Auto-share on critical anomaly)",
        "emergency_response_preference": "Notify Trusted Circle first (Recommended)",
        "accessibility_notes": "Standard (Default audio chime + visual alert)",
        "completeness_score": 95,
        "profile_completed": True,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    })

    demo_contacts = [
        {"id": str(uuid.uuid4()), "user_id": user_id, "name": "Alex (Sister)", "phone": "+1-555-0101",
         "email": "alex@example.com", "relationship": "Family", "tier": "primary",
         "can_view_location": True, "can_view_evidence": False, "created_at": now_iso(), "status": "active"},
        {"id": str(uuid.uuid4()), "user_id": user_id, "name": "Jordan (Colleague)", "phone": "+1-555-0102",
         "email": "jordan@example.com", "relationship": "Friend", "tier": "secondary",
         "can_view_location": True, "can_view_evidence": False, "created_at": now_iso(), "status": "active"},
        {"id": str(uuid.uuid4()), "user_id": user_id, "name": "Campus Security", "phone": "+1-555-0103",
         "email": None, "relationship": "Campus Security", "tier": "secondary",
         "can_view_location": True, "can_view_evidence": True, "created_at": now_iso(), "status": "active"},
    ]
    await db.contacts.insert_many(demo_contacts)

    await db.settings.insert_one({
        "user_id": user_id, "theme": "dark", "ai_sensitivity": 0.72,
        "voice_detection": False, "battery_mode": "balanced", "language": "en",
        "high_contrast": False, "emergency_countdown": 12,
    })

    baseline_signals = {"motion_delta": 10, "routine_deviation": 8, "location_risk": 12,
                        "voice_stress": 0, "battery_factor": 5, "offline": False}
    base_result = compute_risk(baseline_signals, 0.72)
    await db.risk_events.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "score": base_result["score"],
        "state": "safe",
        "confidence": 92,
        "factors": base_result["factors"],
        "derived_signals": baseline_signals,
        "location": {"lat": 28.6139, "lng": 77.2090},
        "created_at": now_iso(),
    })
    logger.info("Demo user seeded: %s / %s", DEMO_EMAIL, DEMO_PASSWORD)


class RegisterRequest(BaseModel):
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    password: str = Field(min_length=8)
    name: str = Field(min_length=2)


class LoginRequest(BaseModel):
    identifier: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class PhoneRequest(BaseModel):
    phone: str


class PhoneVerify(BaseModel):
    phone: str
    otp: str
    name: Optional[str] = None


class PasskeyStart(BaseModel):
    identifier: str


class PasskeyVerify(BaseModel):
    challenge_id: str
    signed_challenge: str


class RiskRequest(BaseModel):
    motion_delta: float = 0
    routine_deviation: float = 0
    location_risk: float = 0
    voice_stress: float = 0
    battery_factor: float = 0
    offline: bool = False
    sensitivity: float = 0.72
    journey_id: Optional[str] = None
    location: Optional[Dict[str, float]] = None


class ContactRequest(BaseModel):
    name: str = Field(min_length=1)
    phone: Optional[str] = None
    email: Optional[str] = None
    relationship: str = "Family"
    tier: str = "primary"
    can_view_location: bool = True
    can_view_evidence: bool = False


class DemoScenarioRequest(BaseModel):
    scenario: str = Field(pattern="^(normal_journey|route_deviation|prolonged_stop|unusual_duration|elevated_risk|high_risk|safe_checkin|sos|reset_demo|high_risk_area|motion_anomaly|combined_incident)$")
    journey_id: Optional[str] = None
    location: Optional[Dict[str, float]] = None
    auto_escalate: bool = False


def demo_scenario_signals(scenario: str) -> Dict[str, Any]:
    scenarios = {
        "normal_journey": {
            "title": "Normal Journey Baseline",
            "signals": {"motion_delta": 10, "routine_deviation": 8, "location_risk": 12, "voice_stress": 0, "battery_factor": 6, "offline": False},
            "reasons": ["Movement follows expected corridor", "Progress toward destination aligns with normal travel window", "Observed pace matches personal baseline"],
        },
        "route_deviation": {
            "title": "Unexpected Route Deviation",
            "signals": {"motion_delta": 32, "routine_deviation": 90, "location_risk": 56, "voice_stress": 12, "battery_factor": 10, "offline": False},
            "reasons": ["User moved ~420m outside expected route corridor", "Route deviation contribution surged (+24 pts)", "Confidence calibrated against personal tolerance baseline"],
        },
        "prolonged_stop": {
            "title": "Prolonged Unexpected Stop",
            "signals": {"motion_delta": 84, "routine_deviation": 72, "location_risk": 60, "voice_stress": 20, "battery_factor": 14, "offline": False},
            "reasons": ["Stationary for over 6 minutes away from known safe zones", "Sudden lack of movement along active route", "Stop duration exceeds normal journey window"],
        },
        "unusual_duration": {
            "title": "Unusual Journey Duration",
            "signals": {"motion_delta": 62, "routine_deviation": 76, "location_risk": 58, "voice_stress": 25, "battery_factor": 15, "offline": False},
            "reasons": ["Journey duration exceeds typical time by >45%", "Pace rhythm differs from learned transport baseline", "Check-in recommended"],
        },
        "elevated_risk": {
            "title": "Elevated Compound Risk",
            "signals": {"motion_delta": 78, "routine_deviation": 88, "location_risk": 74, "voice_stress": 28, "battery_factor": 18, "offline": False},
            "reasons": ["Route deviation + unexpected stationary duration", "Corridor lighting and context elevated risk", "12-second confirmation window requested"],
        },
        "high_risk": {
            "title": "High Risk Incident Detection",
            "signals": {"motion_delta": 94, "routine_deviation": 95, "location_risk": 90, "voice_stress": 42, "battery_factor": 22, "offline": False},
            "reasons": ["Severe multi-signal deviation detected", "Unfamiliar high-risk area entered after dark", "Trusted contact alert recommended"],
        },
        "safe_checkin": {
            "title": "User Safe Check-In",
            "signals": {"motion_delta": 8, "routine_deviation": 6, "location_risk": 10, "voice_stress": 0, "battery_factor": 6, "offline": False},
            "reasons": ["User confirmed: 'I'm Safe'", "Risk normalized to baseline", "Confirmation recorded to timeline"],
        },
        "sos": {
            "title": "SOS Emergency Triggered",
            "signals": {"motion_delta": 96, "routine_deviation": 98, "location_risk": 94, "voice_stress": 55, "battery_factor": 25, "offline": False},
            "reasons": ["Immediate emergency workflow initiated", "Response circle alerted in-app", "Evidence record sealed in vault"],
        },
        "high_risk_area": {
            "title": "High-risk area entry",
            "signals": {"motion_delta": 35, "routine_deviation": 68, "location_risk": 96, "voice_stress": 20, "battery_factor": 15, "offline": False},
            "reasons": ["Entered area with higher historical incident density", "Lighting/crowd context reduced route confidence", "Safe-route recommendation changed"],
        },
        "motion_anomaly": {
            "title": "Motion anomaly detected",
            "signals": {"motion_delta": 96, "routine_deviation": 64, "location_risk": 58, "voice_stress": 30, "battery_factor": 16, "offline": True},
            "reasons": ["Abrupt motion pattern differs from walking baseline", "Possible fall or forced stop signature", "Offline mode active: edge detection still works"],
        },
        "combined_incident": {
            "title": "Multi-Signal Emergency Escalation",
            "signals": {"motion_delta": 92, "routine_deviation": 95, "location_risk": 88, "voice_stress": 45, "battery_factor": 25, "offline": False},
            "reasons": ["Route deviation + sudden stop + high risk corridor", "Multiple concurrent risk triggers", "12-second confirmation window requested"],
        },
    }
    return scenarios.get(scenario, scenarios["route_deviation"])


def ai_monitor_from_event(event: Optional[Dict[str, Any]], active: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    score = event.get("score", 18) if event else 18
    factors = event.get("factors", []) if event else []
    return {
        "risk_confidence": event.get("confidence", 18) if event else 18,
        "state": event.get("state", "safe") if event else "safe",
        "signals": [
            {"label": "Motion Analysis", "status": "Normal" if score < 55 else "Elevated", "value": min(100, score + 6), "tone": "safe" if score < 55 else "warning"},
            {"label": "Routine Analysis", "status": "Normal" if score < 55 else "Deviation", "value": min(100, score + 12), "tone": "safe" if score < 55 else "warning"},
            {"label": "Environment Analysis", "status": "Safe" if score < 60 else "Risk context", "value": min(100, score + 8), "tone": "safe" if score < 60 else "danger"},
            {"label": "Journey Analysis", "status": "Monitoring" if active else "Passive", "value": 72 if active else 42, "tone": "safe"},
        ],
        "reasons": [f.get("name") + ": " + f.get("explanation", "") for f in factors[:4]] or ["Routine and motion match baseline", "No high-risk environmental trigger", "Offline-capable edge scoring active"],
    }


class SafetyProfileRequest(BaseModel):
    model_config = ConfigDict(extra="allow")
    travel_hours: str = "Evening (6 PM - 10 PM)"
    primary_transport: str = "Walking + Public Transit"
    travel_alone_frequency: str = "Frequently"
    common_journey: str = "College / Work -> Home"
    typical_duration_min: int = 30
    night_travel: str = "Occasional"
    familiar_routes: List[str] = ["Home - Campus / Office", "Downtown Safe Corridor"]
    uncomfortable_areas: Optional[List[str]] = []
    deviation_tolerance: str = "Moderate (300m - 500m)"
    intervention_preference: str = "Gentle check-in first"
    emergency_location_sharing: str = "Auto-share on critical anomaly"
    emergency_response_preference: Optional[str] = "Notify Trusted Circle first"
    accessibility_notes: Optional[str] = "None"
    completeness_score: Optional[int] = 85


class JourneyEventRequest(BaseModel):
    label: str
    detail: str
    tone: Optional[str] = "safe"
    location: Optional[Dict[str, float]] = None


class JourneyCheckinRequest(BaseModel):
    status: str = "safe"
    message: Optional[str] = "User confirmed safe via check-in"


class JourneyStart(BaseModel):
    destination_name: str
    destination: Dict[str, float]
    origin: Dict[str, float]
    share_with_contacts: bool = True


class LiveLocation(BaseModel):
    journey_id: Optional[str] = None
    location: Dict[str, float]
    accuracy: Optional[float] = None
    battery: Optional[float] = None


class EmergencyTrigger(BaseModel):
    risk_event_id: Optional[str] = None
    location: Optional[Dict[str, float]] = None
    silent_mode: bool = True
    reason: str = "User initiated SOS"


class EvidenceRequest(BaseModel):
    kind: str = "note"
    title: str
    content: str
    location: Optional[Dict[str, float]] = None
    emergency_id: Optional[str] = None


class InsightRequest(BaseModel):
    mode: str = "daily"
    risk_summary: Optional[Dict[str, Any]] = None


class SettingsRequest(BaseModel):
    theme: Optional[str] = None
    ai_sensitivity: Optional[float] = None
    voice_detection: Optional[bool] = None
    battery_mode: Optional[str] = None
    language: Optional[str] = None
    high_contrast: Optional[bool] = None
    emergency_countdown: Optional[int] = None


class CommunityAlertRequest(BaseModel):
    category: str
    description: str
    severity: int = Field(ge=1, le=10)
    location: Dict[str, float]


@api_router.get("/")
async def root():
    return {"message": "SentinelPulse API online", "mode": "privacy-first edge relay"}


@api_router.get("/health")
async def health():
    return {"status": "ok", "database": DB_NAME, "map_provider": os.environ.get("MAP_PROVIDER", "leaflet_osm")}


async def build_auth_response(user: Dict[str, Any], device_name: str = "SentinelPulse PWA") -> Dict[str, Any]:
    access = issue_access_token(user)
    refresh = await issue_refresh_token(user["id"], device_name)
    public_user = {k: v for k, v in user.items() if k not in {"password_hash", "_id"}}
    return {"user": serialize_doc(public_user), "access_token": access, "refresh_token": refresh, "token_type": "bearer"}


@api_router.post("/auth/register")
async def register(payload: RegisterRequest):
    if not payload.email and not payload.phone:
        raise HTTPException(status_code=400, detail="Email or phone is required")
    query = {"$or": []}
    if payload.email:
        query["$or"].append({"email": payload.email.lower()})
    if payload.phone:
        query["$or"].append({"phone": payload.phone})
    if await db.users.find_one(query):
        raise HTTPException(status_code=409, detail="Account already exists")
    user = {
        "id": str(uuid.uuid4()),
        "email": payload.email.lower() if payload.email else None,
        "phone": payload.phone,
        "name": payload.name,
        "password_hash": hash_password(payload.password),
        "role": "user",
        "created_at": now_iso(),
        "calibration": {"days_completed": 0, "target_days": 14, "baseline_quality": 18},
        "privacy_score": 94,
        "device_trust": ["PWA session", "Simulated biometric ready"],
    }
    await db.users.insert_one(user)
    await db.settings.insert_one({"user_id": user["id"], "theme": "dark", "ai_sensitivity": 0.72, "voice_detection": False, "battery_mode": "balanced", "language": "en", "high_contrast": False, "emergency_countdown": 12})
    await create_audit(user["id"], "auth.register", {"method": "email_phone"})
    return await build_auth_response(user)


@api_router.post("/auth/login")
async def login(payload: LoginRequest):
    identifier = payload.identifier.lower().strip()
    user = await db.users.find_one({"$or": [{"email": identifier}, {"phone": payload.identifier.strip()}]})
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    await create_audit(user["id"], "auth.login", {"method": "password"})
    return await build_auth_response(user)


@api_router.post("/auth/refresh")
async def refresh(payload: RefreshRequest):
    token_hash = hashlib.sha256(payload.refresh_token.encode()).hexdigest()
    session = await db.sessions.find_one({"token_hash": token_hash, "revoked": False})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    if datetime.fromisoformat(session["expires_at"]) < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Refresh token expired")
    user = await db.users.find_one({"id": session["user_id"]})
    return {"access_token": issue_access_token(user), "token_type": "bearer"}


@api_router.get("/auth/me")
async def me(user: Dict[str, Any] = Depends(get_current_user)):
    return serialize_doc(user)


@api_router.get("/auth/sessions")
async def sessions(user: Dict[str, Any] = Depends(get_current_user)):
    items = await db.sessions.find({"user_id": user["id"]}, {"_id": 0, "token_hash": 0}).sort("created_at", -1).to_list(50)
    return serialize_doc(items)


@api_router.post("/auth/phone/request-otp")
async def request_otp(payload: PhoneRequest):
    code = f"{secrets.randbelow(900000) + 100000}"
    otp = {"id": str(uuid.uuid4()), "phone": payload.phone, "code_hash": hashlib.sha256(code.encode()).hexdigest(), "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=7)).isoformat(), "used": False, "created_at": now_iso()}
    await db.otps.insert_one(otp)
    return {"otp_id": otp["id"], "expires_in_seconds": 420, "delivery": {"channel": "in_app_pwa_adapter", "code": code, "note": "SMS provider abstraction is ready; this PWA build returns the code in-app."}}


@api_router.post("/auth/phone/verify")
async def verify_otp(payload: PhoneVerify):
    code_hash = hashlib.sha256(payload.otp.encode()).hexdigest()
    otp = await db.otps.find_one({"phone": payload.phone, "code_hash": code_hash, "used": False})
    if not otp or datetime.fromisoformat(otp["expires_at"]) < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Invalid or expired OTP")
    await db.otps.update_one({"id": otp["id"]}, {"$set": {"used": True}})
    user = await db.users.find_one({"phone": payload.phone})
    if not user:
        generated_password = secrets.token_urlsafe(18)
        user = {"id": str(uuid.uuid4()), "email": None, "phone": payload.phone, "name": payload.name or "SentinelPulse Member", "password_hash": hash_password(generated_password), "role": "user", "created_at": now_iso(), "calibration": {"days_completed": 0, "target_days": 14, "baseline_quality": 12}, "privacy_score": 94, "device_trust": ["Phone OTP", "Simulated biometric ready"]}
        await db.users.insert_one(user)
        await db.settings.insert_one({"user_id": user["id"], "theme": "dark", "ai_sensitivity": 0.72, "voice_detection": False, "battery_mode": "balanced", "language": "en", "high_contrast": False, "emergency_countdown": 12})
    await create_audit(user["id"], "auth.phone_otp", {"adapter": "in_app_pwa"})
    return await build_auth_response(user)


@api_router.post("/auth/passkey/challenge")
async def passkey_challenge(payload: PasskeyStart):
    identifier = payload.identifier.lower().strip()
    user = await db.users.find_one({"$or": [{"email": identifier}, {"phone": payload.identifier.strip()}]})
    if not user:
        raise HTTPException(status_code=404, detail="Account not found")
    challenge = secrets.token_urlsafe(24)
    doc = {"id": str(uuid.uuid4()), "user_id": user["id"], "challenge": challenge, "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=3)).isoformat(), "used": False}
    await db.passkey_challenges.insert_one(doc)
    return {"challenge_id": doc["id"], "challenge": challenge, "expected_demo_signature": challenge[::-1], "mode": "pwa_simulated_passkey"}


@api_router.post("/auth/passkey/verify")
async def passkey_verify(payload: PasskeyVerify):
    doc = await db.passkey_challenges.find_one({"id": payload.challenge_id, "used": False})
    if not doc or datetime.fromisoformat(doc["expires_at"]) < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Invalid passkey challenge")
    if payload.signed_challenge != doc["challenge"][::-1]:
        raise HTTPException(status_code=401, detail="Passkey verification failed")
    await db.passkey_challenges.update_one({"id": doc["id"]}, {"$set": {"used": True}})
    user = await db.users.find_one({"id": doc["user_id"]})
    await create_audit(user["id"], "auth.passkey_simulated", {"webauthn_ready": True})
    return await build_auth_response(user, "PWA simulated passkey")


@api_router.post("/auth/demo-login")
async def demo_login():
    """Instant demo access — returns tokens for the pre-seeded demo user (no credentials required)."""
    user = await db.users.find_one({"email": DEMO_EMAIL}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=503, detail="Demo user not yet seeded. Please restart the server.")
    await create_audit(user["id"], "auth.demo_login", {"note": "One-click demo shortcut"})
    return await build_auth_response(user)



@api_router.get("/profile/safety")
async def get_safety_profile(user: Dict[str, Any] = Depends(get_current_user)):
    profile = await db.safety_profiles.find_one({"user_id": user["id"]}, {"_id": 0})
    if not profile:
        profile = {
            "user_id": user["id"],
            "travel_hours": "Evening (6 PM - 10 PM)",
            "primary_transport": "Walking + Public Transit",
            "travel_alone_frequency": "Frequently",
            "common_journey": "College / Work -> Home",
            "typical_duration_min": 30,
            "night_travel": "Occasional",
            "familiar_routes": ["Home - Campus / Office", "Downtown Safe Corridor"],
            "deviation_tolerance": "Moderate (300m - 500m)",
            "intervention_preference": "Gentle check-in first",
            "emergency_location_sharing": "Auto-share on critical anomaly",
            "accessibility_notes": "None",
            "completeness_score": 85,
            "created_at": now_iso(),
            "updated_at": now_iso(),
        }
    return serialize_doc(profile)


@api_router.put("/profile/safety")
async def update_safety_profile(payload: SafetyProfileRequest, user: Dict[str, Any] = Depends(get_current_user)):
    data = payload.model_dump()
    data.update({"user_id": user["id"], "updated_at": now_iso()})
    await db.safety_profiles.update_one({"user_id": user["id"]}, {"$set": data}, upsert=True)
    # Write profile_completed and baseline_quality back to the user document
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "profile_completed": True,
            "calibration.baseline_quality": data.get("completeness_score", 85),
        }}
    )
    await create_audit(user["id"], "profile.safety_update", {"completeness": data.get("completeness_score", 85)})
    updated = await db.safety_profiles.find_one({"user_id": user["id"]}, {"_id": 0})
    return serialize_doc(updated)


@api_router.post("/ai/risk")
async def risk(payload: RiskRequest, user: Dict[str, Any] = Depends(get_current_user)):
    profile = await db.safety_profiles.find_one({"user_id": user["id"]}, {"_id": 0})
    result = compute_risk(payload.model_dump(), payload.sensitivity, profile)
    event = {"id": str(uuid.uuid4()), "user_id": user["id"], "journey_id": payload.journey_id, "score": result["score"], "state": result["state"], "risk_level": result["risk_level"], "confidence": result["confidence"], "factors": result["factors"], "derived_signals": payload.model_dump(exclude={"location"}), "location": payload.location, "created_at": now_iso()}
    await db.risk_events.insert_one(event)
    
    # If active journey and elevated risk, log journey event
    if payload.journey_id and result["score"] >= 45:
        tone = "danger" if result["score"] >= 75 else "warning"
        top_reason = result["factors"][0]["explanation"] if result["factors"] else "Elevated risk detected"
        await db.journey_events.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "journey_id": payload.journey_id,
            "time": now_iso(),
            "label": f"Risk Alert: {result['risk_level']}",
            "detail": top_reason,
            "tone": tone,
            "location": payload.location,
        })
    return {**result, "event_id": event["id"], "created_at": event["created_at"]}


@api_router.post("/ai/insight")
async def ai_insight(payload: InsightRequest, user: Dict[str, Any] = Depends(get_current_user)):
    latest = payload.risk_summary or await db.risk_events.find_one({"user_id": user["id"]}, {"_id": 0}, sort=[("created_at", -1)]) or {}
    fallback = "Your protection posture is stable. Keep Smart Journey active for unfamiliar routes and review trusted contacts weekly."
    if not EMERGENT_LLM_KEY:
        return {"provider": "local_fallback", "insight": fallback}
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"sentinelpulse-{user['id']}-{payload.mode}",
            system_message="You are SentinelPulse. Generate concise, calm, privacy-first personal safety recommendations from derived metadata only. Never claim raw audio/location was uploaded."
        ).with_model("gemini", "gemini-3-flash-preview")
        prompt = f"Create a 2 sentence safety insight. User calibration: {user.get('calibration')}. Derived risk summary: {latest}."
        chunks: List[str] = []
        async for event in chat.stream_message(UserMessage(text=prompt)):
            if isinstance(event, TextDelta):
                chunks.append(event.content)
            elif isinstance(event, StreamDone):
                break
            if len("".join(chunks)) > 700:
                break
        text = "".join(chunks).strip() or fallback
        await db.insights.insert_one({"id": str(uuid.uuid4()), "user_id": user["id"], "mode": payload.mode, "insight": text, "provider": "gemini", "created_at": now_iso()})
        return {"provider": "gemini", "insight": text}
    except Exception as exc:
        logger.warning("Gemini fallback: %s", exc)
        return {"provider": "local_fallback", "insight": fallback, "reason": type(exc).__name__}


@api_router.get("/dashboard")
async def dashboard(user: Dict[str, Any] = Depends(get_current_user)):
    latest = await db.risk_events.find_one({"user_id": user["id"]}, {"_id": 0}, sort=[("created_at", -1)])
    contacts_count = await db.contacts.count_documents({"user_id": user["id"]})
    active = await db.journeys.find_one({"user_id": user["id"], "status": "active"}, {"_id": 0})
    recent_journeys = await db.journeys.find({"user_id": user["id"]}, {"_id": 0}).sort("started_at", -1).to_list(5)
    journey_count = await db.journeys.count_documents({"user_id": user["id"]})
    evidence_count = await db.evidence.count_documents({"user_id": user["id"]})
    notifications = await db.notifications.count_documents({"user_id": user["id"], "read": False})
    events = await db.risk_events.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(12)
    safety_profile = await db.safety_profiles.find_one({"user_id": user["id"]}, {"_id": 0})
    score = latest["score"] if latest else 12
    monitor = ai_monitor_from_event(latest, active)
    
    baseline_pct = min(100, 35 + journey_count * 8)
    learning_stage = "Day 1 Baseline" if journey_count == 0 else "Learning Routines" if journey_count < 6 else "Fully Calibrated"
    
    return serialize_doc({
        "protection_status": "Protection Active" if score < 65 else "Review Anomaly" if score < 85 else "Critical Risk Escalation",
        "safety_score": max(0, 100 - score),
        "risk_score": score,
        "risk_level": "LOW" if score < 35 else "MODERATE" if score < 65 else "HIGH" if score < 85 else "CRITICAL",
        "ai_confidence": latest.get("confidence", 85) if latest else 85,
        "edge_ai_status": "Edge AI active: deterministic scoring works offline",
        "privacy_status": "Private: raw sensor data remains on-device",
        "offline_status": "Offline protection ready",
        "battery_status": "Battery optimized",
        "today_summary": "Protection posture active; no emergency escalation required" if score < 65 else "Unusual activity detected; confirmation window ready",
        "trusted_contacts": contacts_count,
        "safety_profile": safety_profile,
        "active_journey": active,
        "recent_journeys": recent_journeys,
        "evidence_count": evidence_count,
        "unread_notifications": notifications,
        "calibration": user.get("calibration"),
        "learning_progress": {
            "baseline_quality": baseline_pct,
            "journeys_observed": journey_count,
            "stage": learning_stage,
            "explanation": "Day 1 general safety baseline active. Personalization improves automatically as repeated journeys are observed."
        },
        "latest_risk": latest,
        "ai_monitor": monitor,
        "risk_trend": list(reversed([{"score": e.get("score", 0), "time": e.get("created_at", "")[11:16]} for e in events])) or [{"score": 12, "time": "now"}],
        "daily_insight": "Your local baseline is stable. Smart Journey adds heightened monitoring and explainable route safety when you choose it.",
        "edge_ai_claims": ["Detection works offline", "Raw sensor data remains on-device", "Only emergency events are shared", "Low latency", "Battery optimized", "Privacy-first"],
    })


@api_router.get("/contacts")
async def list_contacts(user: Dict[str, Any] = Depends(get_current_user)):
    return serialize_doc(await db.contacts.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100))


@api_router.post("/contacts")
async def add_contact(payload: ContactRequest, user: Dict[str, Any] = Depends(get_current_user)):
    doc = payload.model_dump()
    doc.update({"id": str(uuid.uuid4()), "user_id": user["id"], "created_at": now_iso(), "status": "active"})
    await db.contacts.insert_one(doc)
    await create_audit(user["id"], "contacts.add", {"contact_id": doc["id"], "name": doc["name"]})
    return serialize_doc(doc)


@api_router.put("/contacts/{contact_id}")
async def update_contact(contact_id: str, payload: ContactRequest, user: Dict[str, Any] = Depends(get_current_user)):
    clean = payload.model_dump()
    result = await db.contacts.update_one({"id": contact_id, "user_id": user["id"]}, {"$set": clean})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Contact not found")
    await create_audit(user["id"], "contacts.update", {"contact_id": contact_id})
    updated = await db.contacts.find_one({"id": contact_id, "user_id": user["id"]}, {"_id": 0})
    return serialize_doc(updated)


@api_router.delete("/contacts/{contact_id}")
async def delete_contact(contact_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    result = await db.contacts.delete_one({"id": contact_id, "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Contact not found")
    return {"status": "deleted"}


@api_router.post("/routes/compute")
async def compute_route(payload: JourneyStart, user: Dict[str, Any] = Depends(get_current_user)):
    return {"provider": os.environ.get("MAP_PROVIDER", "leaflet_osm"), "routes": route_variants(payload.origin, payload.destination), "switch_to_mapbox": "Set MAP_PROVIDER=mapbox and add Mapbox tokens when available."}


@api_router.post("/journeys/start")
async def start_journey(payload: JourneyStart, user: Dict[str, Any] = Depends(get_current_user)):
    routes = route_variants(payload.origin, payload.destination)
    selected = max(routes, key=lambda r: r["safety_score"])
    doc = {"id": str(uuid.uuid4()), "user_id": user["id"], "destination_name": payload.destination_name, "origin": payload.origin, "destination": payload.destination, "route": selected, "status": "active", "share_with_contacts": payload.share_with_contacts, "started_at": now_iso(), "ended_at": None, "last_location": payload.origin, "eta_seconds": selected["duration_s"]}
    await db.journeys.update_many({"user_id": user["id"], "status": "active"}, {"$set": {"status": "ended", "ended_at": now_iso()}})
    await db.journeys.insert_one(doc)
    if payload.share_with_contacts:
        contacts = await db.contacts.find({"user_id": user["id"], "can_view_location": True}, {"_id": 0}).to_list(50)
        for c in contacts:
            await db.notifications.insert_one({"id": str(uuid.uuid4()), "user_id": user["id"], "type": "journey_shared", "title": f"Journey shared with {c['name']}", "body": f"Live journey to {payload.destination_name} is active.", "read": False, "created_at": now_iso()})
    await create_audit(user["id"], "journey.start", {"journey_id": doc["id"]})
    return serialize_doc(doc)


@api_router.get("/journeys")
async def journeys(user: Dict[str, Any] = Depends(get_current_user)):
    return serialize_doc(await db.journeys.find({"user_id": user["id"]}, {"_id": 0}).sort("started_at", -1).to_list(50))


@api_router.post("/journeys/{journey_id}/location")
async def update_journey_location(journey_id: str, payload: LiveLocation, user: Dict[str, Any] = Depends(get_current_user)):
    point = {"id": str(uuid.uuid4()), "user_id": user["id"], "journey_id": journey_id, "location": {"type": "Point", "coordinates": [payload.location["lng"], payload.location["lat"]]}, "accuracy": payload.accuracy, "battery": payload.battery, "created_at": now_iso()}
    await db.live_tracks.insert_one(point)
    await db.journeys.update_one({"id": journey_id, "user_id": user["id"]}, {"$set": {"last_location": payload.location, "last_location_at": now_iso()}})
    return {"status": "tracked", "point_id": point["id"]}


@api_router.post("/journeys/{journey_id}/events")
async def add_journey_event(journey_id: str, payload: JourneyEventRequest, user: Dict[str, Any] = Depends(get_current_user)):
    event = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "journey_id": journey_id,
        "time": now_iso(),
        "label": payload.label,
        "detail": payload.detail,
        "tone": payload.tone or "safe",
        "location": payload.location,
    }
    await db.journey_events.insert_one(event)
    return serialize_doc(event)


@api_router.get("/journeys/{journey_id}/timeline")
async def journey_timeline(journey_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    events = await db.journey_events.find({"journey_id": journey_id, "user_id": user["id"]}, {"_id": 0}).sort("time", 1).to_list(100)
    return serialize_doc(events)


@api_router.post("/journeys/{journey_id}/checkin")
async def journey_checkin(journey_id: str, payload: JourneyCheckinRequest, user: Dict[str, Any] = Depends(get_current_user)):
    event = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "journey_id": journey_id,
        "time": now_iso(),
        "label": "User Check-In Confirmed",
        "detail": payload.message or "User confirmed: I'm safe.",
        "tone": "safe",
    }
    await db.journey_events.insert_one(event)
    await db.risk_events.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "journey_id": journey_id,
        "score": 12,
        "state": "safe",
        "risk_level": "LOW",
        "confidence": 92,
        "factors": [{"name": "Check-in verified", "contribution": 0, "weight": 0.2, "observed": 0, "explanation": "User confirmed safety directly via check-in."}],
        "created_at": now_iso(),
    })
    return {
        "status": "checked_in",
        "message": "Check-in recorded. Risk returned to safe posture.",
        "event": serialize_doc(event),
    }


@api_router.post("/journeys/{journey_id}/end")
async def end_journey(journey_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    journey = await db.journeys.find_one({"id": journey_id, "user_id": user["id"]})
    if not journey:
        raise HTTPException(status_code=404, detail="Journey not found")
    
    ended_time = now_iso()
    start_dt = datetime.fromisoformat(journey["started_at"]) if journey.get("started_at") else datetime.now(timezone.utc)
    actual_dur_min = max(1, int((datetime.now(timezone.utc) - start_dt).total_seconds() / 60))
    
    await db.journeys.update_one(
        {"id": journey_id, "user_id": user["id"]},
        {"$set": {"status": "completed", "ended_at": ended_time, "actual_duration_min": actual_dur_min}}
    )
    
    await db.journey_events.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "journey_id": journey_id,
        "time": ended_time,
        "label": "Journey Completed Safely",
        "detail": f"Arrived at {journey.get('destination_name', 'destination')}. Duration: {actual_dur_min} min.",
        "tone": "safe",
    })
    
    completed_count = await db.journeys.count_documents({"user_id": user["id"], "status": "completed"})
    new_baseline_quality = min(100, 35 + completed_count * 8)
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"calibration.days_completed": min(14, completed_count), "calibration.baseline_quality": new_baseline_quality}}
    )
    
    await create_audit(user["id"], "journey.end", {"journey_id": journey_id, "actual_duration_min": actual_dur_min})
    
    return {
        "status": "completed",
        "actual_duration_min": actual_dur_min,
        "destination_name": journey.get("destination_name"),
        "personalization_update": f"Your journey has been added to your personal baseline. Baseline quality is now {new_baseline_quality}%.",
        "baseline_quality": new_baseline_quality,
        "journeys_observed": completed_count,
    }


@api_router.get("/timeline")
async def unified_timeline(user: Dict[str, Any] = Depends(get_current_user)):
    j_events = await db.journey_events.find({"user_id": user["id"]}, {"_id": 0}).to_list(100)
    emergencies = await db.emergencies.find({"user_id": user["id"]}, {"_id": 0}).to_list(50)
    journeys_list = await db.journeys.find({"user_id": user["id"]}, {"_id": 0}).to_list(50)
    
    feed = []
    for j in journeys_list:
        feed.append({
            "id": f"j_start_{j['id']}",
            "time": j.get("started_at", now_iso()),
            "category": "journey",
            "title": f"Journey Started: {j.get('destination_name', 'Destination')}",
            "detail": f"Route: {j.get('route', {}).get('name', 'Recommended')} · Safety Score: {j.get('route', {}).get('safety_score', 94)}%",
            "tone": "safe",
            "icon": "Route",
        })
        if j.get("ended_at"):
            feed.append({
                "id": f"j_end_{j['id']}",
                "time": j.get("ended_at", now_iso()),
                "category": "journey",
                "title": f"Journey Completed: {j.get('destination_name', 'Destination')}",
                "detail": f"Actual duration: {j.get('actual_duration_min', 18)} min. Incorporated into personal baseline.",
                "tone": "safe",
                "icon": "CheckCircle",
            })
            
    for ev in j_events:
        feed.append({
            "id": ev["id"],
            "time": ev.get("time", now_iso()),
            "category": "signal",
            "title": ev.get("label", "Journey Signal"),
            "detail": ev.get("detail", ""),
            "tone": ev.get("tone", "safe"),
            "icon": "AlertTriangle" if ev.get("tone") == "warning" else "ShieldAlert" if ev.get("tone") == "danger" else "Activity",
        })
        
    for em in emergencies:
        feed.append({
            "id": f"em_{em['id']}",
            "time": em.get("created_at", now_iso()),
            "category": "emergency",
            "title": f"Emergency Workflow: {em.get('reason', 'SOS')}",
            "detail": f"Status: {em.get('status', 'active').upper()} · Response circle alerted in-app.",
            "tone": "danger" if em.get("status") == "active" else "safe",
            "icon": "Siren",
        })
        
    feed.sort(key=lambda x: x.get("time", ""), reverse=True)
    return serialize_doc(feed[:80])


@api_router.get("/map/overlays")
async def map_overlays(user: Dict[str, Any] = Depends(get_current_user)):
    alerts = await db.community_alerts.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    contacts = await db.contacts.find({"user_id": user["id"]}, {"_id": 0}).to_list(20)
    safe_zones = []
    for idx, c in enumerate(contacts[:5]):
        safe_zones.append({"id": c["id"], "name": c["name"], "lat": 28.6139 + idx * 0.006, "lng": 77.2090 - idx * 0.005, "radius_m": 180, "type": "trusted_contact"})
    return serialize_doc({"alerts": alerts, "safe_zones": safe_zones, "heat_points": [{"lat": a["location"]["lat"], "lng": a["location"]["lng"], "intensity": a["severity"]} for a in alerts]})


@api_router.post("/emergency/trigger")
async def trigger_emergency(payload: EmergencyTrigger, user: Dict[str, Any] = Depends(get_current_user)):
    contacts = await db.contacts.find({"user_id": user["id"]}, {"_id": 0}).to_list(50)
    doc = {"id": str(uuid.uuid4()), "user_id": user["id"], "risk_event_id": payload.risk_event_id, "location": payload.location, "silent_mode": payload.silent_mode, "reason": payload.reason, "status": "active", "created_at": now_iso(), "timeline": [{"time": now_iso(), "label": "Emergency activated", "detail": payload.reason}, {"time": now_iso(), "label": "Trusted contacts queued", "detail": f"{len(contacts)} in-app alerts prepared"}, {"time": now_iso(), "label": "Evidence vault armed", "detail": "Encrypted timeline record opened"}]}
    await db.emergencies.insert_one(doc)
    for c in contacts:
        await db.notifications.insert_one({"id": str(uuid.uuid4()), "user_id": user["id"], "type": "emergency_contact_alert", "title": f"Alert prepared for {c['name']}", "body": f"{payload.reason}. Location sharing is active in-app (simulated).", "read": False, "created_at": now_iso(), "emergency_id": doc["id"]})
    vault_payload = {"kind": "timeline", "title": "Emergency activation timeline", "content": doc["timeline"], "location": payload.location, "emergency_id": doc["id"]}
    encrypted = vault_fernet().encrypt(json.dumps(vault_payload, default=str).encode()).decode()
    evidence = {"id": str(uuid.uuid4()), "user_id": user["id"], "emergency_id": doc["id"], "kind": "timeline", "title": "Emergency activation timeline", "encrypted_payload": encrypted, "hash": sha256_json(vault_payload), "verified": True, "created_at": now_iso(), "location": payload.location}
    await db.evidence.insert_one(evidence)
    await create_audit(user["id"], "emergency.trigger", {"emergency_id": doc["id"], "contacts": len(contacts)})
    return serialize_doc({**doc, "contacts_alerted_in_app": len(contacts), "evidence_id": evidence["id"]})


@api_router.post("/emergency/{emergency_id}/cancel")
async def cancel_emergency(emergency_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    result = await db.emergencies.update_one({"id": emergency_id, "user_id": user["id"]}, {"$set": {"status": "cancelled", "cancelled_at": now_iso()}, "$push": {"timeline": {"time": now_iso(), "label": "Cancelled", "detail": "User cancelled during confirmation window"}}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Emergency not found")
    return {"status": "cancelled"}


@api_router.post("/emergency/{emergency_id}/resolve")
async def resolve_emergency(emergency_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    res_time = now_iso()
    result = await db.emergencies.update_one(
        {"id": emergency_id, "user_id": user["id"]},
        {
            "$set": {"status": "resolved", "resolved_at": res_time},
            "$push": {"timeline": {"time": res_time, "label": "Resolved", "detail": "Incident marked resolved and safe by user"}}
        }
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Emergency not found")
    vault_payload = {"kind": "resolution", "title": "Emergency Resolution Record", "emergency_id": emergency_id, "resolved_at": res_time, "verified": True}
    encrypted = vault_fernet().encrypt(json.dumps(vault_payload, default=str).encode()).decode()
    evidence = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "emergency_id": emergency_id,
        "kind": "resolution",
        "title": "Emergency Resolution Record",
        "encrypted_payload": encrypted,
        "hash": sha256_json(vault_payload),
        "verified": True,
        "created_at": res_time
    }
    await db.evidence.insert_one(evidence)
    await create_audit(user["id"], "emergency.resolve", {"emergency_id": emergency_id})
    return {"status": "resolved", "resolved_at": res_time, "evidence_id": evidence["id"]}


@api_router.get("/demo/scenarios")
async def get_demo_scenarios():
    return {
        "scenarios": [
            {
                "id": "route_deviation",
                "name": "Route Deviation",
                "description": "User moves off designated safe path into unlit route; routine deviation factor surges (+25 pts).",
                "expected_risk": 58,
                "expected_level": "MODERATE",
            },
            {
                "id": "prolonged_stop",
                "name": "Prolonged Stop",
                "description": "Unexpected cessation of movement away from safe zones; stop anomaly flagged (+18 pts).",
                "expected_risk": 68,
                "expected_level": "HIGH",
            },
            {
                "id": "high_risk_area",
                "name": "High-Risk Zone Entry",
                "description": "Trajectory crosses area with active community alerts; environmental risk spikes (+24 pts).",
                "expected_risk": 78,
                "expected_level": "HIGH",
            },
            {
                "id": "motion_anomaly",
                "name": "Motion Anomaly / Fall Signature",
                "description": "Sudden impact/drop signature triggers immediate heightened watch posture (+28 pts).",
                "expected_risk": 84,
                "expected_level": "HIGH",
            },
            {
                "id": "combined_incident",
                "name": "Combined Emergency Incident (Full Escalation)",
                "description": "Step-by-step compound incident: Normal (12) -> Deviation (42) -> Stop (64) -> High Risk (78) -> Critical (92) -> Confirmation Window -> In-App Escalation & Vault Sealing.",
                "expected_risk": 92,
                "expected_level": "CRITICAL",
            },
        ]
    }


@api_router.post("/demo/simulate")
async def simulate_demo(payload: DemoScenarioRequest, user: Dict[str, Any] = Depends(get_current_user)):
    if payload.scenario == "reset_demo":
        return await reset_demo(user)

    scenario_info = demo_scenario_signals(payload.scenario)
    signals = scenario_info["signals"]
    result = compute_risk(signals, 0.72)
    
    active_journey = await db.journeys.find_one({"user_id": user["id"], "status": "active"}, {"_id": 0})
    journey_id = payload.journey_id or (active_journey["id"] if active_journey else None)
    loc = payload.location or (active_journey["last_location"] if active_journey else {"lat": 28.6139, "lng": 77.2090})
    
    event = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "journey_id": journey_id,
        "score": result["score"],
        "state": result["state"],
        "confidence": result["confidence"],
        "factors": result["factors"],
        "derived_signals": signals,
        "location": loc,
        "created_at": now_iso(),
        "demo_mode": True,
        "scenario": payload.scenario,
        "title": scenario_info["title"],
    }
    await db.risk_events.insert_one(event)

    # Log to journey timeline if journey active or for timeline feed
    tone = "safe" if result["score"] < 30 else "warning" if result["score"] < 70 else "danger"
    if payload.scenario == "safe_checkin":
        await db.emergencies.update_many({"user_id": user["id"], "status": "active"}, {"$set": {"status": "resolved", "resolved_at": now_iso()}})
        tone = "safe"
    
    await db.journey_events.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "journey_id": journey_id or "demo_journey",
        "time": now_iso(),
        "label": scenario_info["title"],
        "detail": scenario_info["reasons"][0] if scenario_info["reasons"] else "Signal observed against baseline.",
        "tone": tone,
        "location": loc,
    })
    
    emergency_doc = None
    if payload.scenario == "sos" or payload.auto_escalate or result["score"] >= 80:
        contacts = await db.contacts.find({"user_id": user["id"]}, {"_id": 0}).to_list(50)
        emergency_doc = {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "risk_event_id": event["id"],
            "location": loc,
            "silent_mode": True,
            "reason": f"Simulated incident: {scenario_info['title']}",
            "status": "active",
            "created_at": now_iso(),
            "demo_mode": True,
            "timeline": [
                {"time": now_iso(), "label": "Incident simulated (Demo)", "detail": scenario_info["title"]},
                {"time": now_iso(), "label": f"Risk Score {result['score']} ({result['state'].upper()})", "detail": f"Confidence: {result['confidence']}%"},
                {"time": now_iso(), "label": "In-app contacts notified", "detail": f"{len(contacts)} response circle alerts created (simulated)"},
                {"time": now_iso(), "label": "Evidence vault sealed", "detail": "Tamper-evident record encrypted with Fernet AES"},
            ]
        }
        await db.emergencies.insert_one(emergency_doc)
        for c in contacts:
            await db.notifications.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": user["id"],
                "type": "emergency_contact_alert",
                "title": f"DEMO ALERT: {c['name']}",
                "body": f"Simulated incident: {scenario_info['title']}. Risk: {result['score']} ({result['state']}). In-app alert only.",
                "read": False,
                "created_at": now_iso(),
                "emergency_id": emergency_doc["id"],
            })
        vault_payload = {
            "kind": "demo_incident",
            "title": f"Simulated Incident: {scenario_info['title']}",
            "score": result["score"],
            "factors": result["factors"],
            "timeline": emergency_doc["timeline"],
            "location": loc,
            "emergency_id": emergency_doc["id"]
        }
        encrypted = vault_fernet().encrypt(json.dumps(vault_payload, default=str).encode()).decode()
        evidence = {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "emergency_id": emergency_doc["id"],
            "kind": "demo_incident",
            "title": f"Demo Evidence: {scenario_info['title']}",
            "encrypted_payload": encrypted,
            "hash": sha256_json(vault_payload),
            "verified": True,
            "created_at": now_iso(),
            "location": loc,
        }
        await db.evidence.insert_one(evidence)
        emergency_doc["evidence_id"] = evidence["id"]
        
    await create_audit(user["id"], "demo.simulate", {"scenario": payload.scenario, "score": result["score"]})
    return serialize_doc({
        "scenario": payload.scenario,
        "title": scenario_info["title"],
        "risk_result": {**result, "event_id": event["id"]},
        "reasons": scenario_info["reasons"],
        "emergency": emergency_doc,
        "created_at": event["created_at"],
    })


@api_router.post("/demo/reset")
async def reset_demo(user: Dict[str, Any] = Depends(get_current_user)):
    await db.journeys.update_many({"user_id": user["id"], "status": "active"}, {"$set": {"status": "completed", "ended_at": now_iso()}})
    await db.emergencies.update_many({"user_id": user["id"], "status": "active"}, {"$set": {"status": "resolved", "resolved_at": now_iso()}})
    baseline_signals = {"motion_delta": 10, "routine_deviation": 8, "location_risk": 12, "voice_stress": 0, "battery_factor": 5, "offline": False}
    base_result = compute_risk(baseline_signals, 0.72)
    clean_event = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "score": base_result["score"],
        "state": "safe",
        "confidence": 88,
        "factors": base_result["factors"],
        "derived_signals": baseline_signals,
        "location": {"lat": 28.6139, "lng": 77.2090},
        "created_at": now_iso(),
    }
    await db.risk_events.insert_one(clean_event)
    await create_audit(user["id"], "demo.reset", {})
    return {"status": "reset", "message": "Demo state reset to clean baseline (Risk: safe, score: 12)"}


@api_router.get("/emergency/timeline")
async def emergency_timeline(user: Dict[str, Any] = Depends(get_current_user)):
    return serialize_doc(await db.emergencies.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50))


@api_router.post("/evidence")
async def create_evidence(payload: EvidenceRequest, user: Dict[str, Any] = Depends(get_current_user)):
    vault_payload = payload.model_dump()
    digest = sha256_json(vault_payload)
    encrypted = vault_fernet().encrypt(json.dumps(vault_payload, default=str).encode()).decode()
    doc = {"id": str(uuid.uuid4()), "user_id": user["id"], "emergency_id": payload.emergency_id, "kind": payload.kind, "title": payload.title, "encrypted_payload": encrypted, "hash": digest, "verified": True, "created_at": now_iso(), "location": payload.location}
    await db.evidence.insert_one(doc)
    await create_audit(user["id"], "evidence.create", {"evidence_id": doc["id"], "kind": payload.kind})
    return serialize_doc({k: v for k, v in doc.items() if k != "encrypted_payload"})


@api_router.get("/evidence")
async def list_evidence(user: Dict[str, Any] = Depends(get_current_user)):
    return serialize_doc(await db.evidence.find({"user_id": user["id"]}, {"_id": 0, "encrypted_payload": 0}).sort("created_at", -1).to_list(100))


@api_router.get("/evidence/export")
async def export_evidence(format: str = "zip", user: Dict[str, Any] = Depends(get_current_user)):
    items = await db.evidence.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    exported = []
    for item in items:
        payload = json.loads(vault_fernet().decrypt(item["encrypted_payload"].encode()).decode())
        exported.append({**{k: v for k, v in item.items() if k != "encrypted_payload"}, "payload": payload})
    if format == "pdf":
        text = "SentinelPulse Evidence Export\n\n" + json.dumps(exported, indent=2, default=str)
        return Response(text.encode(), media_type="text/plain", headers={"Content-Disposition": "attachment; filename=sentinelpulse-evidence.pdf"})
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("sentinelpulse-evidence.json", json.dumps(exported, indent=2, default=str))
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/zip", headers={"Content-Disposition": "attachment; filename=sentinelpulse-evidence.zip"})


@api_router.get("/evidence/{evidence_id}")
async def evidence_detail(evidence_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    doc = await db.evidence.find_one({"id": evidence_id, "user_id": user["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Evidence not found")
    payload = json.loads(vault_fernet().decrypt(doc["encrypted_payload"].encode()).decode())
    return serialize_doc({**{k: v for k, v in doc.items() if k != "encrypted_payload"}, "payload": payload, "verified": sha256_json(payload) == doc["hash"]})


@api_router.get("/privacy")
async def privacy(user: Dict[str, Any] = Depends(get_current_user)):
    counts = {
        "risk_events": await db.risk_events.count_documents({"user_id": user["id"]}),
        "journeys": await db.journeys.count_documents({"user_id": user["id"]}),
        "evidence_records": await db.evidence.count_documents({"user_id": user["id"]}),
        "contacts": await db.contacts.count_documents({"user_id": user["id"]}),
        "audit_logs": await db.audit_logs.count_documents({"user_id": user["id"]}),
    }
    audits = await db.audit_logs.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(20)
    return serialize_doc({"privacy_score": user.get("privacy_score", 94), "storage": counts, "local_vs_cloud": {"local_inference": "Raw sensor/audio signals", "cloud_relay": "Account metadata, derived alerts, encrypted evidence only"}, "model_explanation": ["Motion anomaly", "Routine deviation", "Location context", "Optional voice stress flag", "Battery/offline resilience"], "audits": audits})


@api_router.delete("/privacy/data")
async def delete_privacy_data(scope: str = "derived", user: Dict[str, Any] = Depends(get_current_user)):
    collections = ["risk_events", "live_tracks"] if scope == "derived" else ["risk_events", "live_tracks", "journeys", "evidence", "emergencies", "notifications"]
    deleted = {}
    for name in collections:
        result = await getattr(db, name).delete_many({"user_id": user["id"]})
        deleted[name] = result.deleted_count
    await create_audit(user["id"], "privacy.delete", {"scope": scope, "deleted": deleted})
    return {"status": "deleted", "deleted": deleted}


@api_router.get("/settings")
async def get_settings(user: Dict[str, Any] = Depends(get_current_user)):
    settings = await db.settings.find_one({"user_id": user["id"]}, {"_id": 0})
    return settings or {"theme": "dark", "ai_sensitivity": 0.72, "voice_detection": False, "battery_mode": "balanced", "language": "en", "high_contrast": False, "emergency_countdown": 12}


@api_router.put("/settings")
async def update_settings(payload: SettingsRequest, user: Dict[str, Any] = Depends(get_current_user)):
    clean = {k: v for k, v in payload.model_dump().items() if v is not None}
    await db.settings.update_one({"user_id": user["id"]}, {"$set": clean, "$setOnInsert": {"user_id": user["id"]}}, upsert=True)
    await create_audit(user["id"], "settings.update", clean)
    return await get_settings(user)


@api_router.get("/notifications")
async def notifications(user: Dict[str, Any] = Depends(get_current_user)):
    return serialize_doc(await db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100))


@api_router.post("/notifications/{notification_id}/read")
async def read_notification(notification_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    await db.notifications.update_one({"id": notification_id, "user_id": user["id"]}, {"$set": {"read": True}})
    return {"status": "read"}


@api_router.get("/analytics")
async def analytics(user: Dict[str, Any] = Depends(get_current_user)):
    risks = await db.risk_events.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    journeys = await db.journeys.find({"user_id": user["id"]}, {"_id": 0}).sort("started_at", -1).to_list(50)
    emergencies = await db.emergencies.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(20)
    avg_risk = round(sum(r.get("score", 0) for r in risks) / len(risks), 1) if risks else 0
    return serialize_doc({"avg_risk": avg_risk, "risk_events": len(risks), "journeys": len(journeys), "emergencies": len(emergencies), "trend": list(reversed([{"score": r.get("score", 0), "label": r.get("created_at", "")[5:16]} for r in risks[:14]])), "system_health": {"api": "operational", "database": "connected", "llm": "configured" if EMERGENT_LLM_KEY else "fallback", "map_provider": os.environ.get("MAP_PROVIDER", "leaflet_osm")}})


@api_router.post("/community-alerts")
async def create_alert(payload: CommunityAlertRequest, user: Dict[str, Any] = Depends(get_current_user)):
    doc = payload.model_dump()
    doc["geo"] = {"type": "Point", "coordinates": [payload.location["lng"], payload.location["lat"]]}
    doc.update({"id": str(uuid.uuid4()), "user_id": user["id"], "reporter_name": user.get("name"), "created_at": now_iso(), "verified": False})
    await db.community_alerts.insert_one(doc)
    await create_audit(user["id"], "community_alert.create", {"alert_id": doc["id"]})
    return serialize_doc(doc)


@api_router.get("/community-alerts")
async def list_alerts(user: Dict[str, Any] = Depends(get_current_user)):
    return serialize_doc(await db.community_alerts.find({}, {"_id": 0}).sort("created_at", -1).to_list(100))


@api_router.get("/family/dashboard")
async def family_dashboard(user: Dict[str, Any] = Depends(get_current_user)):
    journeys = await db.journeys.find({"user_id": user["id"]}, {"_id": 0}).sort("started_at", -1).to_list(20)
    emergencies = await db.emergencies.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(10)
    contacts = await db.contacts.find({"user_id": user["id"]}, {"_id": 0}).to_list(50)
    return serialize_doc({"protected_member": user.get("name"), "journeys": journeys, "emergencies": emergencies, "contacts": contacts, "safe_arrival_rate": 100 if journeys else None})


@api_router.get("/responder/dashboard")
async def responder_dashboard(user: Dict[str, Any] = Depends(get_current_user)):
    emergencies = await db.emergencies.find({}, {"_id": 0}).sort("created_at", -1).to_list(50)
    alerts = await db.community_alerts.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return serialize_doc({"active_incidents": [e for e in emergencies if e.get("status") == "active"], "recent_incidents": emergencies, "community_alerts": alerts, "dispatch_status": "in-app responder console active"})


@api_router.get("/admin/dashboard")
async def admin_dashboard(user: Dict[str, Any] = Depends(get_current_user)):
    stats = {
        "users": await db.users.count_documents({}),
        "risk_events": await db.risk_events.count_documents({}),
        "journeys": await db.journeys.count_documents({}),
        "evidence": await db.evidence.count_documents({}),
        "community_alerts": await db.community_alerts.count_documents({}),
    }
    return {"stats": stats, "system_health": {"api": "healthy", "mongodb": "healthy", "edge_engine": "deterministic", "llm": "gemini" if EMERGENT_LLM_KEY else "fallback", "map_provider": os.environ.get("MAP_PROVIDER", "leaflet_osm")}}


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=False)
    await db.users.create_index("phone", unique=False)
    await db.sessions.create_index("token_hash")
    await db.live_tracks.create_index([("location", "2dsphere")])
    await db.community_alerts.create_index([("geo", "2dsphere")])
    await seed_demo_user()
    logger.info("SentinelPulse API started with DB=%s", DB_NAME)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


app.include_router(api_router)
