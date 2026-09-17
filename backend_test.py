#!/usr/bin/env python3
"""
SentinelPulse Backend API Test Suite
Tests all core endpoints with the test account: sentinel.tester@example.com
"""
import requests
import sys
import time
from datetime import datetime

# Use public endpoint from frontend .env
BASE_URL = "https://ai-guardian-edge.preview.emergentagent.com/api"

# Test credentials from /app/memory/test_credentials.md
TEST_EMAIL = "sentinel.tester@example.com"
TEST_PASSWORD = "SentinelPulse#2026"
TEST_NAME = "Sentinel Tester"
TEST_PHONE = "+919876543210"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

class SentinelPulseAPITester:
    def __init__(self):
        self.token = None
        self.refresh_token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.failed_tests = []
        self.journey_id = None
        self.contact_id = None
        self.evidence_id = None
        self.emergency_id = None
        self.challenge_id = None
        self.otp_id = None

    def log(self, emoji, message, color=Colors.END):
        print(f"{color}{emoji} {message}{Colors.END}")

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None, description=""):
        """Run a single API test"""
        url = f"{BASE_URL}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token and headers is None:
            test_headers['Authorization'] = f'Bearer {self.token}'
        elif headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n{Colors.BLUE}[{self.tests_run}] Testing: {name}{Colors.END}")
        if description:
            print(f"    {description}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)
            else:
                raise ValueError(f"Unsupported method: {method}")

            success = response.status_code == expected_status
            
            if success:
                self.tests_passed += 1
                self.log("✅", f"PASSED - Status: {response.status_code}", Colors.GREEN)
                try:
                    return True, response.json()
                except:
                    return True, {}
            else:
                self.tests_failed += 1
                self.failed_tests.append(name)
                self.log("❌", f"FAILED - Expected {expected_status}, got {response.status_code}", Colors.RED)
                try:
                    error_detail = response.json()
                    print(f"    Error: {error_detail}")
                except:
                    print(f"    Response: {response.text[:200]}")
                return False, {}

        except requests.exceptions.Timeout:
            self.tests_failed += 1
            self.failed_tests.append(name)
            self.log("❌", f"FAILED - Request timeout after 10s", Colors.RED)
            return False, {}
        except Exception as e:
            self.tests_failed += 1
            self.failed_tests.append(name)
            self.log("❌", f"FAILED - Error: {str(e)}", Colors.RED)
            return False, {}

    def test_health_check(self):
        """Test API health endpoint"""
        self.log("🏥", "=== Health Check ===", Colors.YELLOW)
        success, response = self.run_test(
            "API Health Check",
            "GET",
            "health",
            200,
            description="Verify API is online and database connected"
        )
        if success:
            print(f"    Database: {response.get('database')}")
            print(f"    Map Provider: {response.get('map_provider')}")
        return success

    def test_register(self):
        """Test user registration"""
        self.log("📝", "=== Authentication: Registration ===", Colors.YELLOW)
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD,
                "name": TEST_NAME
            },
            headers={},
            description="Create new account or login if exists"
        )
        if success and response.get('access_token'):
            self.token = response['access_token']
            self.refresh_token = response.get('refresh_token')
            self.user_id = response.get('user', {}).get('id')
            print(f"    User ID: {self.user_id}")
            print(f"    Token acquired: {self.token[:20]}...")
        return success

    def test_login(self):
        """Test user login"""
        self.log("🔐", "=== Authentication: Login ===", Colors.YELLOW)
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login",
            200,
            data={
                "identifier": TEST_EMAIL,
                "password": TEST_PASSWORD
            },
            headers={},
            description="Login with email and password"
        )
        if success and response.get('access_token'):
            self.token = response['access_token']
            self.refresh_token = response.get('refresh_token')
            self.user_id = response.get('user', {}).get('id')
            print(f"    Login successful, token refreshed")
        return success

    def test_get_me(self):
        """Test get current user"""
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200,
            description="Retrieve authenticated user profile"
        )
        if success:
            print(f"    Name: {response.get('name')}")
            print(f"    Email: {response.get('email')}")
        return success

    def test_phone_otp_flow(self):
        """Test phone OTP request and verify"""
        self.log("📱", "=== Phone OTP Flow ===", Colors.YELLOW)
        
        # Request OTP
        success, response = self.run_test(
            "Phone OTP Request",
            "POST",
            "auth/phone/request-otp",
            200,
            data={"phone": TEST_PHONE},
            headers={},
            description="Request OTP for phone authentication"
        )
        
        if success:
            self.otp_id = response.get('otp_id')
            otp_code = response.get('delivery', {}).get('code')
            print(f"    OTP ID: {self.otp_id}")
            print(f"    In-app OTP Code: {otp_code}")
            
            if otp_code:
                # Verify OTP
                time.sleep(0.5)
                verify_success, verify_response = self.run_test(
                    "Phone OTP Verify",
                    "POST",
                    "auth/phone/verify",
                    200,
                    data={
                        "phone": TEST_PHONE,
                        "otp": otp_code,
                        "name": "Phone Test User"
                    },
                    headers={},
                    description="Verify OTP code"
                )
                return verify_success
        return success

    def test_passkey_flow(self):
        """Test simulated passkey/biometric flow"""
        self.log("🔑", "=== Passkey/Biometric Flow ===", Colors.YELLOW)
        
        # Request challenge
        success, response = self.run_test(
            "Passkey Challenge",
            "POST",
            "auth/passkey/challenge",
            200,
            data={"identifier": TEST_EMAIL},
            headers={},
            description="Request PWA-simulated passkey challenge"
        )
        
        if success:
            self.challenge_id = response.get('challenge_id')
            expected_signature = response.get('expected_demo_signature')
            print(f"    Challenge ID: {self.challenge_id}")
            print(f"    Mode: {response.get('mode')}")
            
            if self.challenge_id and expected_signature:
                # Verify passkey
                time.sleep(0.3)
                verify_success, verify_response = self.run_test(
                    "Passkey Verify",
                    "POST",
                    "auth/passkey/verify",
                    200,
                    data={
                        "challenge_id": self.challenge_id,
                        "signed_challenge": expected_signature
                    },
                    headers={},
                    description="Verify simulated biometric signature"
                )
                return verify_success
        return success

    def test_dashboard(self):
        """Test dashboard endpoint"""
        self.log("📊", "=== Dashboard ===", Colors.YELLOW)
        success, response = self.run_test(
            "Dashboard Data",
            "GET",
            "dashboard",
            200,
            description="Fetch protection status and metrics"
        )
        if success:
            print(f"    Protection Status: {response.get('protection_status')}")
            print(f"    Safety Score: {response.get('safety_score')}")
            print(f"    Trusted Contacts: {response.get('trusted_contacts')}")
        return success

    def test_risk_scan(self):
        """Test AI risk scoring"""
        self.log("🎯", "=== AI Risk Scoring ===", Colors.YELLOW)
        success, response = self.run_test(
            "Risk Scan",
            "POST",
            "ai/risk",
            200,
            data={
                "motion_delta": 45.0,
                "routine_deviation": 32.0,
                "location_risk": 28.0,
                "voice_stress": 15.0,
                "battery_factor": 10.0,
                "offline": False,
                "sensitivity": 0.72,
                "location": {"lat": 28.6139, "lng": 77.209}
            },
            description="Run deterministic risk scoring with derived signals"
        )
        if success:
            print(f"    Risk Score: {response.get('score')}")
            print(f"    State: {response.get('state')}")
            print(f"    Confidence: {response.get('confidence')}%")
            print(f"    Confirmation Required: {response.get('confirmation_required')}")
        return success

    def test_ai_insight(self):
        """Test Gemini AI insight generation"""
        self.log("✨", "=== AI Insights (Gemini) ===", Colors.YELLOW)
        success, response = self.run_test(
            "AI Insight Generation",
            "POST",
            "ai/insight",
            200,
            data={"mode": "daily"},
            description="Generate AI recommendation (Gemini or fallback)"
        )
        if success:
            print(f"    Provider: {response.get('provider')}")
            print(f"    Insight: {response.get('insight', '')[:100]}...")
        return success

    def test_contacts_flow(self):
        """Test trusted contacts management"""
        self.log("👥", "=== Trusted Contacts ===", Colors.YELLOW)
        
        # Add contact
        success, response = self.run_test(
            "Add Trusted Contact",
            "POST",
            "contacts",
            200,
            data={
                "name": "Emergency Contact Test",
                "phone": "+919999999999",
                "email": "emergency@example.com",
                "relationship": "Family",
                "tier": "primary",
                "can_view_location": True,
                "can_view_evidence": False
            },
            description="Add new trusted contact"
        )
        
        if success:
            self.contact_id = response.get('id')
            print(f"    Contact ID: {self.contact_id}")
        
        # List contacts
        list_success, list_response = self.run_test(
            "List Contacts",
            "GET",
            "contacts",
            200,
            description="Retrieve all trusted contacts"
        )
        
        if list_success:
            print(f"    Total Contacts: {len(list_response)}")
        
        return success and list_success

    def test_journey_flow(self):
        """Test journey mode with route computation"""
        self.log("🗺️", "=== Journey Mode ===", Colors.YELLOW)
        
        origin = {"lat": 28.6139, "lng": 77.209}
        destination = {"lat": 28.6339, "lng": 77.229}
        
        # Compute routes
        success, response = self.run_test(
            "Compute Safe Routes",
            "POST",
            "routes/compute",
            200,
            data={
                "destination_name": "Test Destination",
                "origin": origin,
                "destination": destination,
                "share_with_contacts": True
            },
            description="Compute safe route options with OSM/Leaflet"
        )
        
        if success:
            routes = response.get('routes', [])
            print(f"    Routes computed: {len(routes)}")
            if routes:
                print(f"    Best route safety: {routes[0].get('safety_score')}%")
        
        # Start journey
        start_success, start_response = self.run_test(
            "Start Journey",
            "POST",
            "journeys/start",
            200,
            data={
                "destination_name": "Test Destination",
                "origin": origin,
                "destination": destination,
                "share_with_contacts": True
            },
            description="Start Smart Journey with live tracking"
        )
        
        if start_success:
            self.journey_id = start_response.get('id')
            print(f"    Journey ID: {self.journey_id}")
            print(f"    Status: {start_response.get('status')}")
        
        # Update location
        if self.journey_id:
            time.sleep(0.3)
            update_success, _ = self.run_test(
                "Update Journey Location",
                "POST",
                f"journeys/{self.journey_id}/location",
                200,
                data={
                    "location": {"lat": 28.6189, "lng": 77.214},
                    "accuracy": 15.0,
                    "battery": 85.0
                },
                description="Send live location update"
            )
        
        # List journeys
        list_success, _ = self.run_test(
            "List Journeys",
            "GET",
            "journeys",
            200,
            description="Retrieve journey history"
        )
        
        # End journey
        if self.journey_id:
            time.sleep(0.3)
            end_success, _ = self.run_test(
                "End Journey",
                "POST",
                f"journeys/{self.journey_id}/end",
                200,
                description="Complete active journey"
            )
        
        return success and start_success

    def test_map_overlays(self):
        """Test map overlays (safe zones, alerts)"""
        success, response = self.run_test(
            "Map Overlays",
            "GET",
            "map/overlays",
            200,
            description="Fetch safe zones and community alerts for map"
        )
        if success:
            print(f"    Safe Zones: {len(response.get('safe_zones', []))}")
            print(f"    Alerts: {len(response.get('alerts', []))}")
        return success

    def test_emergency_flow(self):
        """Test emergency/SOS workflow"""
        self.log("🚨", "=== Emergency/SOS Workflow ===", Colors.YELLOW)
        
        # Trigger emergency
        success, response = self.run_test(
            "Trigger Emergency",
            "POST",
            "emergency/trigger",
            200,
            data={
                "location": {"lat": 28.6139, "lng": 77.209},
                "silent_mode": True,
                "reason": "Test emergency activation"
            },
            description="Activate emergency with 12-second confirmation"
        )
        
        if success:
            self.emergency_id = response.get('id')
            print(f"    Emergency ID: {self.emergency_id}")
            print(f"    Contacts Alerted: {response.get('contacts_alerted_in_app')}")
            print(f"    Evidence ID: {response.get('evidence_id')}")
        
        # Get emergency timeline
        timeline_success, _ = self.run_test(
            "Emergency Timeline",
            "GET",
            "emergency/timeline",
            200,
            description="Retrieve emergency history"
        )
        
        # Cancel emergency
        if self.emergency_id:
            time.sleep(0.3)
            cancel_success, _ = self.run_test(
                "Cancel Emergency",
                "POST",
                f"emergency/{self.emergency_id}/cancel",
                200,
                description="Cancel emergency during confirmation window"
            )
        
        return success and timeline_success

    def test_evidence_vault(self):
        """Test evidence vault encryption and verification"""
        self.log("🔒", "=== Evidence Vault ===", Colors.YELLOW)
        
        # Create evidence
        success, response = self.run_test(
            "Create Evidence",
            "POST",
            "evidence",
            200,
            data={
                "kind": "note",
                "title": "Test Evidence Record",
                "content": "This is a test encrypted evidence entry",
                "location": {"lat": 28.6139, "lng": 77.209}
            },
            description="Create encrypted tamper-evident record"
        )
        
        if success:
            self.evidence_id = response.get('id')
            print(f"    Evidence ID: {self.evidence_id}")
            print(f"    Hash: {response.get('hash', '')[:32]}...")
        
        # List evidence
        list_success, list_response = self.run_test(
            "List Evidence",
            "GET",
            "evidence",
            200,
            description="Retrieve all vault records"
        )
        
        if list_success:
            print(f"    Total Evidence Records: {len(list_response)}")
        
        # Get evidence detail with decryption
        if self.evidence_id:
            time.sleep(0.3)
            detail_success, detail_response = self.run_test(
                "Evidence Detail",
                "GET",
                f"evidence/{self.evidence_id}",
                200,
                description="Decrypt and verify evidence hash"
            )
            
            if detail_success:
                print(f"    Verified: {detail_response.get('verified')}")
        
        # Test export (should not crash)
        export_success, _ = self.run_test(
            "Export Evidence ZIP",
            "GET",
            "evidence/export?format=zip",
            200,
            description="Export vault as ZIP archive"
        )
        
        return success and list_success

    def test_privacy_center(self):
        """Test privacy controls and data deletion"""
        self.log("🔐", "=== Privacy Center ===", Colors.YELLOW)
        
        # Get privacy data
        success, response = self.run_test(
            "Privacy Dashboard",
            "GET",
            "privacy",
            200,
            description="View privacy score and storage breakdown"
        )
        
        if success:
            print(f"    Privacy Score: {response.get('privacy_score')}")
            storage = response.get('storage', {})
            print(f"    Risk Events: {storage.get('risk_events', 0)}")
            print(f"    Journeys: {storage.get('journeys', 0)}")
        
        # Delete derived data
        delete_success, delete_response = self.run_test(
            "Delete Derived Data",
            "DELETE",
            "privacy/data?scope=derived",
            200,
            description="Delete derived sensor data"
        )
        
        if delete_success:
            deleted = delete_response.get('deleted', {})
            total = sum(deleted.values())
            print(f"    Total Records Deleted: {total}")
        
        return success and delete_success

    def test_settings(self):
        """Test settings management"""
        self.log("⚙️", "=== Settings ===", Colors.YELLOW)
        
        # Get settings
        success, response = self.run_test(
            "Get Settings",
            "GET",
            "settings",
            200,
            description="Retrieve user settings"
        )
        
        if success:
            print(f"    AI Sensitivity: {response.get('ai_sensitivity')}")
            print(f"    Battery Mode: {response.get('battery_mode')}")
        
        # Update settings
        update_success, _ = self.run_test(
            "Update Settings",
            "PUT",
            "settings",
            200,
            data={
                "ai_sensitivity": 0.75,
                "voice_detection": True,
                "battery_mode": "maximum_protection",
                "high_contrast": False
            },
            description="Save user preferences"
        )
        
        return success and update_success

    def test_community_alerts(self):
        """Test community alert creation and listing"""
        self.log("⚠️", "=== Community Alerts ===", Colors.YELLOW)
        
        # Create alert
        success, response = self.run_test(
            "Create Community Alert",
            "POST",
            "community-alerts",
            200,
            data={
                "category": "Lighting concern",
                "description": "Poor street lighting in this area",
                "severity": 6,
                "location": {"lat": 28.6139, "lng": 77.209}
            },
            description="Report community safety concern"
        )
        
        if success:
            print(f"    Alert ID: {response.get('id')}")
        
        # List alerts
        list_success, list_response = self.run_test(
            "List Community Alerts",
            "GET",
            "community-alerts",
            200,
            description="Retrieve all community reports"
        )
        
        if list_success:
            print(f"    Total Alerts: {len(list_response)}")
        
        return success and list_success

    def test_dashboards(self):
        """Test analytics, family, responder, and admin dashboards"""
        self.log("📈", "=== Dashboards ===", Colors.YELLOW)
        
        # Analytics
        analytics_success, analytics_response = self.run_test(
            "Analytics Dashboard",
            "GET",
            "analytics",
            200,
            description="System analytics and metrics"
        )
        
        if analytics_success:
            print(f"    Avg Risk: {analytics_response.get('avg_risk')}")
            print(f"    System Health: {analytics_response.get('system_health', {}).get('api')}")
        
        # Family dashboard
        family_success, _ = self.run_test(
            "Family Dashboard",
            "GET",
            "family/dashboard",
            200,
            description="Protected member monitoring"
        )
        
        # Responder dashboard
        responder_success, _ = self.run_test(
            "Responder Dashboard",
            "GET",
            "responder/dashboard",
            200,
            description="Emergency responder console"
        )
        
        # Admin dashboard
        admin_success, admin_response = self.run_test(
            "Admin Dashboard",
            "GET",
            "admin/dashboard",
            200,
            description="System administration metrics"
        )
        
        if admin_success:
            stats = admin_response.get('stats', {})
            print(f"    Total Users: {stats.get('users')}")
            print(f"    Map Provider: {admin_response.get('system_health', {}).get('map_provider')}")
        
        return analytics_success and family_success and responder_success and admin_success

    def test_notifications(self):
        """Test notifications"""
        success, response = self.run_test(
            "List Notifications",
            "GET",
            "notifications",
            200,
            description="Retrieve in-app notifications"
        )
        if success:
            print(f"    Total Notifications: {len(response)}")
        return success

    def run_all_tests(self):
        """Execute complete test suite"""
        print(f"\n{Colors.BLUE}{'='*70}")
        print(f"  SentinelPulse Backend API Test Suite")
        print(f"  Base URL: {BASE_URL}")
        print(f"  Test Account: {TEST_EMAIL}")
        print(f"{'='*70}{Colors.END}\n")
        
        start_time = time.time()
        
        # Core tests
        if not self.test_health_check():
            self.log("🛑", "Health check failed - stopping tests", Colors.RED)
            return self.print_summary(time.time() - start_time)
        
        # Try to register or login
        if not self.test_register():
            # If registration fails (account exists), try login
            if not self.test_login():
                self.log("🛑", "Authentication failed - stopping tests", Colors.RED)
                return self.print_summary(time.time() - start_time)
        
        if not self.token:
            self.log("🛑", "No auth token - stopping tests", Colors.RED)
            return self.print_summary(time.time() - start_time)
        
        # Run all feature tests
        self.test_get_me()
        self.test_phone_otp_flow()
        self.test_passkey_flow()
        self.test_dashboard()
        self.test_risk_scan()
        self.test_ai_insight()
        self.test_contacts_flow()
        self.test_journey_flow()
        self.test_map_overlays()
        self.test_emergency_flow()
        self.test_evidence_vault()
        self.test_privacy_center()
        self.test_settings()
        self.test_community_alerts()
        self.test_dashboards()
        self.test_notifications()
        
        elapsed = time.time() - start_time
        return self.print_summary(elapsed)

    def print_summary(self, elapsed):
        """Print test results summary"""
        print(f"\n{Colors.BLUE}{'='*70}")
        print(f"  Test Summary")
        print(f"{'='*70}{Colors.END}")
        print(f"\n  Total Tests: {self.tests_run}")
        print(f"  {Colors.GREEN}✅ Passed: {self.tests_passed}{Colors.END}")
        print(f"  {Colors.RED}❌ Failed: {self.tests_failed}{Colors.END}")
        print(f"  Success Rate: {(self.tests_passed/self.tests_run*100) if self.tests_run > 0 else 0:.1f}%")
        print(f"  Duration: {elapsed:.2f}s")
        
        if self.failed_tests:
            print(f"\n  {Colors.RED}Failed Tests:{Colors.END}")
            for test in self.failed_tests:
                print(f"    • {test}")
        
        print(f"\n{Colors.BLUE}{'='*70}{Colors.END}\n")
        
        # Return exit code
        return 0 if self.tests_failed == 0 else 1


if __name__ == "__main__":
    tester = SentinelPulseAPITester()
    exit_code = tester.run_all_tests()
    sys.exit(exit_code)
