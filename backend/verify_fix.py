"""Quick verification script to test backend after fixes"""
import sys
sys.path.insert(0, '.')

print("=" * 60)
print("SentinelPulse Backend Verification")
print("=" * 60)

# Test all critical imports
from server import (
    app, hash_password, verify_password, issue_access_token, compute_risk,
    clamp, haversine_m, route_variants, vault_fernet, sha256_json, now_iso,
    serialize_doc, demo_scenario_signals, ai_monitor_from_event
)
print("✅ ALL IMPORTS OK")
print(f"✅ app.title: {app.title}")

# Test compute_risk
result = compute_risk({
    'motion_delta': 10, 'routine_deviation': 10, 'location_risk': 10,
    'voice_stress': 5, 'battery_factor': 10, 'offline': False
})
print(f"✅ compute_risk OK - score: {result['score']}, state: {result['state']}")

# Test hashing
h = hash_password('test1234')
assert verify_password('test1234', h), "Password verification failed"
print("✅ bcrypt hash/verify works")

# Test haversine
d = haversine_m({'lat': 28.6139, 'lng': 77.2090}, {'lat': 28.7041, 'lng': 77.1025})
print(f"✅ haversine OK - distance: {round(d)}m")

# Test routes
routes = route_variants({'lat': 28.6139, 'lng': 77.2090}, {'lat': 28.7041, 'lng': 77.1025})
print(f"✅ routes OK - got {len(routes)} routes, best: {routes[0]['name']} ({routes[0]['safety_score']}%)")

# Test demo scenario
signals = demo_scenario_signals('route_deviation')
print(f"✅ demo scenario OK - title: {signals['title']}")

# Test fernet
f = vault_fernet()
encrypted = f.encrypt(b'test payload')
decrypted = f.decrypt(encrypted)
assert decrypted == b'test payload', "Fernet encrypt/decrypt mismatch"
print("✅ fernet encryption/decryption works")

# Test jwt
token = issue_access_token({"id": "test123", "role": "user", "email": "test@test.com"})
print(f"✅ JWT token issued: {token[:30]}...")

# Test ai_monitor
monitor = ai_monitor_from_event(result)
print(f"✅ AI monitor: risk_confidence={monitor['risk_confidence']}, state={monitor['state']}")

# Test serialize
clean = serialize_doc({"test": "value", "_id": "abc123"})
assert clean["mongo_id"] == "abc123", "Mongo serialization failed"
print("✅ serialize_doc works")

print()
print("=" * 60)
print("🎉 ALL BACKEND TESTS PASSED SUCCESSFULLY")
print("=" * 60)

