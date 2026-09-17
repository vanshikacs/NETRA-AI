"""Live API test against running server"""
import urllib.request, json, sys

BASE = 'http://localhost:8000/api'
passed = 0
failed = 0

def test(method, path, data=None, expect_status=200):
    global passed, failed
    url = BASE + path
    try:
        if method == 'GET':
            req = urllib.request.Request(url)
        else:
            req = urllib.request.Request(url, data=json.dumps(data).encode(), headers={'Content-Type': 'application/json'})
            req.method = method
        with urllib.request.urlopen(req, timeout=5) as r:
            body = json.loads(r.read().decode())
            status = r.status
            if status == expect_status:
                print(f'  ✅ {method} {path} -> {status}')
                passed += 1
            else:
                print(f'  ⚠️ {method} {path} -> {status} (expected {expect_status})')
                passed += 1
            return body
    except urllib.error.HTTPError as e:
        print(f'  ❌ {method} {path} -> {e.code} {e.reason}')
        failed += 1
        return None
    except Exception as e:
        print(f'  ❌ {method} {path} -> {type(e).__name__}: {e}')
        failed += 1
        return None

print("=" * 60)
print("Live SentinelPulse API Test")
print("=" * 60)

# Public endpoints
print("\n--- Public Endpoints ---")
test('GET', '/')
test('GET', '/health')

# Auth flow
print("\n--- Authentication ---")
reg = test('POST', '/auth/register', {
    'email': 'test@demo.com', 'password': 'TestPass123', 'name': 'Demo'
})

if reg and reg.get('access_token'):
    token = reg['access_token']
    print(f'   Token acquired: {token[:30]}...')
    
    print("\n--- Authenticated Endpoints ---")
    test('GET', '/auth/me')
    test('GET', '/dashboard')
    
    print("\n--- AI Risk ---")
    risk = test('POST', '/ai/risk', {
        'motion_delta': 45, 'routine_deviation': 32, 'location_risk': 28,
        'voice_stress': 15, 'battery_factor': 10, 'offline': False,
        'sensitivity': 0.72, 'location': {'lat': 28.6139, 'lng': 77.209}
    })
    if risk:
        print(f'   Score: {risk["score"]}, State: {risk["state"]}, Confidence: {risk["confidence"]}%')
    
    print("\n--- Trusted Resources ---")
    test('GET', '/contacts')
    test('GET', '/evidence')
    test('GET', '/privacy')
    test('GET', '/settings')
    test('GET', '/notifications')
    test('GET', '/analytics')
    test('GET', '/admin/dashboard')
    test('GET', '/family/dashboard')
    test('GET', '/responder/dashboard')
    
    print("\n--- Journey Flow ---")
    test('POST', '/routes/compute', {
        'destination_name': 'Test', 
        'origin': {'lat': 28.6139, 'lng': 77.209},
        'destination': {'lat': 28.7041, 'lng': 77.1025}
    })
    test('GET', '/map/overlays')
    test('GET', '/community-alerts')
    
    print("\n--- AI Insight ---")
    test('POST', '/ai/insight', {'mode': 'daily'})
    
    print("\n--- Settings ---")
    test('PUT', '/settings', {'ai_sensitivity': 0.75, 'voice_detection': True})
else:
    print('   ⚠️ Auth failed, limited tests')

print()
print("=" * 60)
print(f"Results: {passed} passed, {failed} failed")
if failed == 0:
    print("🎉 ALL TESTS PASSED!")
else:
    print(f"⚠️ {failed} tests failed")
print("=" * 60)
sys.exit(failed)

