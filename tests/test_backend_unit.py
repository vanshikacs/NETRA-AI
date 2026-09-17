import pytest
import jwt
import time
import os
import json
import hashlib
from backend.server import (
    hash_password,
    verify_password,
    compute_risk,
    vault_fernet,
    sha256_json,
    route_variants,
    demo_scenario_signals,
    JWT_SECRET,
    issue_access_token,
)

def test_auth_password_hashing():
    raw = "SentinelPulse#2026Secure"
    hashed = hash_password(raw)
    assert verify_password(raw, hashed) is True
    assert verify_password("WrongPassword123", hashed) is False

def test_jwt_token_issue_and_verify():
    user = {"id": "usr_test_123", "role": "user", "email": "test@sentinelpulse.org"}
    token = issue_access_token(user)
    decoded = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    assert decoded["sub"] == "usr_test_123"
    assert decoded["role"] == "user"
    assert decoded["email"] == "test@sentinelpulse.org"

def test_deterministic_risk_engine_normal():
    signals = {"motion_delta": 8, "routine_deviation": 10, "location_risk": 12, "voice_stress": 0, "battery_factor": 5, "offline": False}
    result = compute_risk(signals, 0.72)
    assert result["score"] < 35
    assert result["risk_level"] == "LOW"
    assert result["state"] == "safe"
    assert result["confirmation_required"] is False
    assert len(result["factors"]) == 5

def test_deterministic_risk_engine_critical():
    signals = {"motion_delta": 95, "routine_deviation": 90, "location_risk": 85, "voice_stress": 60, "battery_factor": 20, "offline": True}
    result = compute_risk(signals, 0.72)
    assert result["score"] >= 85
    assert result["risk_level"] == "CRITICAL"
    assert result["state"] == "critical"
    assert result["confirmation_required"] is True
    assert result["factors"][0]["contribution"] > 0

def test_evidence_vault_fernet_and_sha256_tamper():
    payload = {"kind": "note", "title": "Security Log", "content": "Tamper test payload", "timestamp": time.time()}
    digest = sha256_json(payload)
    encrypted = vault_fernet().encrypt(json.dumps(payload, sort_keys=True).encode()).decode()
    decrypted = json.loads(vault_fernet().decrypt(encrypted.encode()).decode())
    decrypted_digest = sha256_json(decrypted)
    assert decrypted_digest == digest

    tampered_payload = {**payload, "content": "Modified payload!"}
    assert sha256_json(tampered_payload) != digest

def test_route_variants():
    origin = {"lat": 28.6139, "lng": 77.2090}
    dest = {"lat": 28.6250, "lng": 77.2180}
    routes = route_variants(origin, dest)
    assert len(routes) == 4
    safest = [r for r in routes if r["id"] == "safest"][0]
    assert safest["safety_score"] >= 90
    assert safest["recommendation_rank"] == 1

def test_demo_scenario_signals():
    deviation = demo_scenario_signals("route_deviation")
    assert deviation["signals"]["routine_deviation"] >= 90
    
    stop = demo_scenario_signals("prolonged_stop")
    assert stop["signals"]["motion_delta"] >= 80

    combined = demo_scenario_signals("combined_incident")
    assert combined["signals"]["routine_deviation"] >= 90

def test_deterministic_risk_engine_with_profile():
    signals = {"motion_delta": 40, "routine_deviation": 60, "location_risk": 30, "voice_stress": 10, "battery_factor": 5, "offline": False}
    profile_strict = {"deviation_tolerance": "Strict (<200m)"}
    result_strict = compute_risk(signals, 0.72, profile_strict)
    
    profile_relaxed = {"deviation_tolerance": "Relaxed (>500m)"}
    result_relaxed = compute_risk(signals, 0.72, profile_relaxed)
    
    # Strict profile should score higher on routine deviation than relaxed profile
    assert result_strict["score"] > result_relaxed["score"]
    assert "strict" in result_strict["factors"][0]["explanation"].lower()

