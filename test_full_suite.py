#!/usr/bin/env python3
"""
SentinelPulse Complete Automated Smoke Test Suite
Tests all 18 core capabilities against the live FastAPI backend.
"""
import sys
import time
import requests
import json

BASE_URL = "http://127.0.0.1:8000/api"

class TestRunner:
    def __init__(self):
        self.token = ""
        self.user_id = ""
        self.passed = 0
        self.failed = 0
        self.journey_id = None
        self.contact_id = None
        self.evidence_id = None
        self.emergency_id = None
        ts = int(time.time() * 1000)
        self.user = {
            "name": f"Sentinel QA {ts % 10000}",
            "email": f"qa.tester.{ts}@sentinelpulse.org",
            "password": "SentinelPulse#2026Secure",
            "phone": f"+1555{ts % 1000000:06d}",
        }

    def headers(self):
        h = {"Content-Type": "application/json"}
        if self.token:
            h["Authorization"] = f"Bearer {self.token}"
        return h

    def assert_test(self, name, res, expected_status=200, check_fn=None):
        status_ok = res.status_code == expected_status
        custom_ok = True
        if status_ok and check_fn:
            try:
                ct = res.headers.get("content-type", "")
                data = res.json() if "application/json" in ct else res.content
                custom_ok = check_fn(data)
            except Exception as e:
                custom_ok = False
        
        if status_ok and custom_ok:
            self.passed += 1
            print(f"  [PASS] {name}")
            return True
        else:
            self.failed += 1
            try:
                body = res.json()
            except:
                body = res.text[:200]
            print(f"  [FAIL] {name}: Expected {expected_status}, got {res.status_code} - {body}")
            return False

    def run_all(self):
        print("=" * 60)
        print("SENTINELPULSE END-TO-END AUTOMATED TEST SUITE")
        print("=" * 60)

        # 1. Health
        res = requests.get(f"{BASE_URL}/health")
        self.assert_test("1. API Health Check", res, 200, lambda d: d.get("status") == "ok")

        # 2. Registration validation error (short password)
        res = requests.post(f"{BASE_URL}/auth/register", json={"email": "bad@example.com", "password": "123", "name": "Bad"})
        self.assert_test("2. Register Validation (422 for short password)", res, 422)

        # 3. Successful Registration
        res = requests.post(f"{BASE_URL}/auth/register", json=self.user)
        if self.assert_test("3. Register Success (200 + tokens)", res, 200, lambda d: "access_token" in d):
            data = res.json()
            self.token = data["access_token"]
            self.user_id = data["user"]["id"]

        # 4. Login
        res = requests.post(f"{BASE_URL}/auth/login", json={"identifier": self.user["email"], "password": self.user["password"]})
        if self.assert_test("4. Login Success (200 + token refresh)", res, 200, lambda d: "access_token" in d):
            self.token = res.json()["access_token"]

        # 5. GET /api/auth/me
        res = requests.get(f"{BASE_URL}/auth/me", headers=self.headers())
        self.assert_test("5. GET /auth/me profile verification", res, 200, lambda d: d.get("email") == self.user["email"])

        # 6. AI Risk Engine
        signals = {"motion_delta": 85, "routine_deviation": 90, "location_risk": 75, "voice_stress": 20, "battery_factor": 10, "offline": False}
        res = requests.post(f"{BASE_URL}/ai/risk", json=signals, headers=self.headers())
        self.assert_test(
            "6. AI Deterministic Risk Engine (Score >= 70, explainable factors)",
            res, 200, lambda d: d.get("score", 0) >= 70 and len(d.get("factors", [])) == 5
        )

        # 7. Safe Route Computation
        route_payload = {
            "destination_name": "Safe Haven",
            "origin": {"lat": 28.6139, "lng": 77.2090},
            "destination": {"lat": 28.6250, "lng": 77.2180},
        }
        res = requests.post(f"{BASE_URL}/routes/compute", json=route_payload, headers=self.headers())
        self.assert_test(
            "7. Safe Route Variants (Fastest, Safest, Well Lit, Most Crowded)",
            res, 200, lambda d: len(d.get("routes", [])) == 4 and any(r["id"] == "safest" for r in d.get("routes", []))
        )

        # 8. Smart Journey Lifecycle (Start -> Location -> End)
        res = requests.post(f"{BASE_URL}/journeys/start", json=route_payload, headers=self.headers())
        if self.assert_test("8a. Start Smart Journey (MONITORING mode)", res, 200, lambda d: d.get("status") == "active"):
            self.journey_id = res.json()["id"]
            loc_res = requests.post(
                f"{BASE_URL}/journeys/{self.journey_id}/location",
                json={"location": {"lat": 28.6160, "lng": 77.2110}, "accuracy": 10, "battery": 90},
                headers=self.headers()
            )
            self.assert_test("8b. Journey GPS Location Tracking", loc_res, 200, lambda d: d.get("status") == "tracked")

            end_res = requests.post(f"{BASE_URL}/journeys/{self.journey_id}/end", headers=self.headers())
            self.assert_test("8c. End Smart Journey", end_res, 200, lambda d: d.get("status") == "completed")

        # 9. Demo Scenarios & Simulation
        scenarios_res = requests.get(f"{BASE_URL}/demo/scenarios")
        self.assert_test("9a. List Demo Scenarios", scenarios_res, 200, lambda d: len(d.get("scenarios", [])) >= 5)

        sim_res = requests.post(
            f"{BASE_URL}/demo/simulate",
            json={"scenario": "combined_incident", "auto_escalate": True},
            headers=self.headers()
        )
        self.assert_test(
            "9b. Execute Demo Simulation (Combined Multi-Signal Escalation)",
            sim_res, 200, lambda d: d.get("risk_result", {}).get("score", 0) >= 80
        )

        # 10. Demo Reset
        reset_res = requests.post(f"{BASE_URL}/demo/reset", headers=self.headers())
        self.assert_test("10. Demo Baseline Reset", reset_res, 200, lambda d: d.get("status") == "reset")

        # 11-14. Trusted Contacts Full CRUD
        contact_payload = {
            "name": "Sarah Miller",
            "phone": "+15550198888",
            "email": "sarah@example.com",
            "relationship": "Sister",
            "tier": "primary",
            "can_view_location": True,
            "can_view_evidence": True,
        }
        res = requests.post(f"{BASE_URL}/contacts", json=contact_payload, headers=self.headers())
        if self.assert_test("11. Contact Create (CRUD)", res, 200, lambda d: d.get("name") == "Sarah Miller"):
            self.contact_id = res.json()["id"]

        list_res = requests.get(f"{BASE_URL}/contacts", headers=self.headers())
        self.assert_test("12. Contact Read (CRUD)", list_res, 200, lambda d: isinstance(d, list) and len(d) >= 1)

        if self.contact_id:
            update_res = requests.put(
                f"{BASE_URL}/contacts/{self.contact_id}",
                json={**contact_payload, "relationship": "Spouse", "tier": "primary"},
                headers=self.headers()
            )
            self.assert_test("13. Contact Update (CRUD)", update_res, 200, lambda d: d.get("relationship") == "Spouse")

            del_res = requests.delete(f"{BASE_URL}/contacts/{self.contact_id}", headers=self.headers())
            self.assert_test("14. Contact Delete (CRUD)", del_res, 200, lambda d: d.get("status") == "deleted")

        # 15. Emergency Trigger, Timeline, and Resolution
        em_res = requests.post(
            f"{BASE_URL}/emergency/trigger",
            json={"location": {"lat": 28.6139, "lng": 77.2090}, "silent_mode": True, "reason": "Automated SOS Test"},
            headers=self.headers()
        )
        if self.assert_test("15a. Emergency Trigger & In-App Alert Dispatch", em_res, 200, lambda d: d.get("status") == "active"):
            self.emergency_id = em_res.json()["id"]
            timeline_res = requests.get(f"{BASE_URL}/emergency/timeline", headers=self.headers())
            self.assert_test("15b. Emergency Timeline Verification", timeline_res, 200, lambda d: isinstance(d, list) and len(d) >= 1)

            resolve_res = requests.post(f"{BASE_URL}/emergency/{self.emergency_id}/resolve", headers=self.headers())
            self.assert_test("15c. Emergency Resolution & Vault Sealing", resolve_res, 200, lambda d: d.get("status") == "resolved")

        # 16. Evidence Vault (Create, Detail with Hash Verification, Export)
        evidence_payload = {"kind": "note", "title": "Field observation", "content": "Suspicious activity near street lamp #42"}
        ev_res = requests.post(f"{BASE_URL}/evidence", json=evidence_payload, headers=self.headers())
        if self.assert_test("16a. Evidence Vault Sealing (Fernet AES + SHA-256)", ev_res, 200, lambda d: "hash" in d):
            self.evidence_id = ev_res.json()["id"]
            detail_res = requests.get(f"{BASE_URL}/evidence/{self.evidence_id}", headers=self.headers())
            self.assert_test("16b. Evidence Tamper Verification (Verified=True)", detail_res, 200, lambda d: d.get("verified") is True)

            export_res = requests.get(f"{BASE_URL}/evidence/export?format=zip", headers=self.headers())
            self.assert_test("16c. Evidence Export (ZIP)", export_res, 200, lambda b: len(b) > 50)

        # 17. Privacy Center & Scoped Deletion
        priv_res = requests.get(f"{BASE_URL}/privacy", headers=self.headers())
        self.assert_test("17a. Privacy Center (Score & Storage Breakdown)", priv_res, 200, lambda d: "privacy_score" in d)

        del_priv_res = requests.delete(f"{BASE_URL}/privacy/data?scope=derived", headers=self.headers())
        self.assert_test("17b. Privacy Scoped Data Deletion", del_priv_res, 200, lambda d: "deleted" in d)

        # 18. Dashboards: Home, Family, Responder, Admin, Analytics
        dash_res = requests.get(f"{BASE_URL}/dashboard", headers=self.headers())
        self.assert_test(
            "18a. Home Dashboard (Safety score, learning progress, risk trend)",
            dash_res, 200, lambda d: "learning_progress" in d and "risk_trend" in d
        )

        fam_res = requests.get(f"{BASE_URL}/family/dashboard", headers=self.headers())
        self.assert_test("18b. Family Dashboard", fam_res, 200, lambda d: "journeys" in d)

        resp_res = requests.get(f"{BASE_URL}/responder/dashboard", headers=self.headers())
        self.assert_test("18c. Responder Console", resp_res, 200, lambda d: "dispatch_status" in d)

        adm_res = requests.get(f"{BASE_URL}/admin/dashboard", headers=self.headers())
        self.assert_test("18d. Admin Dashboard", adm_res, 200, lambda d: "system_health" in d)

        analytics_res = requests.get(f"{BASE_URL}/analytics", headers=self.headers())
        self.assert_test("18e. Analytics Telemetry", analytics_res, 200, lambda d: "avg_risk" in d)

        # 19. Safety Profile Assessment (GET & PUT)
        prof_get = requests.get(f"{BASE_URL}/profile/safety", headers=self.headers())
        self.assert_test("19a. GET Safety Profile Baseline", prof_get, 200, lambda d: "travel_hours" in d)

        prof_put = requests.put(
            f"{BASE_URL}/profile/safety",
            json={
                "travel_hours": "Late Night (10 PM - 5 AM)",
                "primary_transport": "Walking",
                "travel_alone_frequency": "Frequently",
                "common_journey": "Campus -> Home",
                "typical_duration_min": 25,
                "night_travel": "Regularly",
                "familiar_routes": ["Campus North Exit", "Main St Corridor"],
                "deviation_tolerance": "Strict (<200m)",
                "intervention_preference": "Gentle check-in first",
                "emergency_location_sharing": "Auto-share on critical anomaly",
                "accessibility_notes": "None",
                "completeness_score": 95,
            },
            headers=self.headers()
        )
        self.assert_test("19b. PUT Update Safety Profile Baseline", prof_put, 200, lambda d: d.get("deviation_tolerance") == "Strict (<200m)")

        # 20. Unified Safety Activity Timeline Feed
        tl_res = requests.get(f"{BASE_URL}/timeline", headers=self.headers())
        self.assert_test("20. Unified Safety Activity Timeline", tl_res, 200, lambda d: isinstance(d, list))

        print("=" * 60)
        print(f"RESULTS: {self.passed} PASSED, {self.failed} FAILED (TOTAL: {self.passed + self.failed})")
        print("=" * 60)
        return self.failed == 0

if __name__ == "__main__":
    runner = TestRunner()
    success = runner.run_all()
    sys.exit(0 if success else 1)

