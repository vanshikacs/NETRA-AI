# SentinelPulse PRD

## Product
SentinelPulse is a predictive, privacy-first personal safety PWA: "AI that protects you before you ask for help." It demonstrates edge-style deterministic risk scoring, user agency through a calm confirmation window, silent escalation, trusted contact workflows, secure evidence vaulting, journey sharing, and transparent privacy controls.

## Implemented Requirements
- Email/password authentication, phone OTP adapter, simulated PWA passkey/biometric adapter, JWT access/refresh sessions, device/session architecture.
- Privacy-first deterministic risk engine using derived signals only: motion anomaly, routine deviation, location context, optional voice-stress flag, battery/offline resilience.
- Gemini AI insight generation via Emergent Universal LLM key with local fallback.
- OpenStreetMap + Leaflet map with provider abstraction for future Mapbox switch, browser geolocation/fallback, route visualization, overlays, safe zones, community alerts.
- Smart Journey Mode: route compute, start/end journey, live location updates, trusted contact sharing notifications.
- SOS Center: 12-second confirmation countdown, cancel, silent escalation, emergency timeline, in-app contact alerts.
- Evidence Vault: encrypted payloads, SHA-256 tamper hashes, detail verification, ZIP/PDF-style export.
- Privacy Center: storage counters, local-vs-relay explanation, audit log, scoped data deletion.
- Dashboards: home, analytics, family, responder, admin, AI insights, settings/profile, notifications, community alerts.
- PWA: manifest, service worker, offline banner, responsive desktop/mobile navigation.

## Integration Status
- Gemini: working via Emergent Universal LLM key.
- Maps: OSM/Leaflet implemented; Mapbox not active because credentials were not provided by user.
- Phone/SMS/calling: in-app PWA adapter implemented; real Twilio/calling intentionally abstracted for later.
- Biometrics/passkeys: PWA-safe simulated adapter implemented; real WebAuthn can be added behind existing challenge/verify architecture.

## Validation
- Core POC passed in `/app/tests/test_core_poc.py`.
- Python lint/compile passed.
- Frontend ESLint and production build passed.
- Testing agent completed E2E testing with 98.6% overall success; reported low-priority evidence export route conflict fixed and verified manually.
