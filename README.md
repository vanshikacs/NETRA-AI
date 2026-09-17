# SentinelPulse (🛡️)

> **Personalized, Continuous, Privacy-First Personal Safety Intelligence Platform**  
> *AI that protects you before you ask for help.*

---

## 🌟 Overview

**SentinelPulse** is a proactive personal safety intelligence platform designed to move beyond traditional, reactive panic buttons toward **continuous, personalized, privacy-first risk detection and calm escalation**.

Rather than assuming danger after an incident has already occurred, SentinelPulse establishes an initial **Safety Profile baseline**, monitors derived journey telemetry on-device (route deviation, unexpected stops, motion anomalies, unlit corridors), and triggers **progressive, agency-preserving interventions** (Check-in $\rightarrow$ Trusted Circle Alert $\rightarrow$ SOS) with transparent, explainable scoring.

---

## 🎯 Core End-to-End Safety Workflow

```
ONBOARDING
  ↓
SAFETY PROFILE (Initial Personal Baseline)
  ↓
SMART JOURNEY (Multi-Route Safety Selection)
  ↓
CONTINUOUS SIGNAL MONITORING (On-Device Sensors)
  ↓
DETERMINISTIC RISK SCORING (Explainable Factors)
  ↓
PROGRESSIVE ESCALATION (Low → Medium Check-In → High Alert)
  ↓
HOLD-TO-ACTIVATE SOS & TRUSTED CIRCLE
  ↓
ENCRYPTED EVIDENCE VAULT & CHRONOLOGICAL TIMELINE
  ↓
POST-JOURNEY INSIGHTS & BASELINE IMPROVEMENT
```

---

## 🚀 Key Differentiators & Capabilities

1. **Safety Profile & Initial Personal Baseline**:
   - 10-question assessment capturing travel hours, transport modes, solo travel frequency, typical journey duration, night travel, and deviation tolerance.
   - SentinelPulse establishes an immediate Day 1 baseline without requiring weeks of cold-start pre-training.
2. **Profile-Integrated Deterministic Risk Engine**:
   - Calculates real-time `risk_score` (0–100), `risk_level` (`LOW`, `MODERATE`, `HIGH`, `CRITICAL`), and `confidence_score` (0–100).
   - Explainable factor breakdown linking current deviations to the user's specific baseline (e.g., *"420m route deviation exceeds your configured moderate tolerance (+22.5 pts)"*).
3. **Smart Journey Mode & Safe Route Comparison**:
   - Compares **Safest (94% - Recommended)**, **Fastest**, **Well Lit**, and **Most Crowded** routes.
   - Clear *"Why This Route?"* guidance: *"Selected because it provides lower contextual risk while remaining close to your expected travel time."*
   - Floating Turn Guidance banner, safe corridor lighting indicators, and bottom floating safety dock (`Check In`, `Alert Circle`, `Emergency`).
4. **Progressive Escalation Experience**:
   - **LOW**: Calm status badge (*"Protection active"*).
   - **MEDIUM**: Non-panic check-in banner (*"Safety check recommended: Route differs from usual path"*) + `[ Check In ]`.
   - **HIGH**: Action card (*"Elevated safety risk detected"*) + `[ I'm Safe ]`, `[ Alert Trusted Contact ]`, `[ SOS ]`.
5. **Hold-to-Activate SOS**:
   - Press-and-hold (1.5s) progress ring to eliminate accidental activations while providing immediate emergency dispatch.
6. **Continuous Safety Timeline**:
   - Chronological audit feed displaying journeys, motion analyses, routine checks, and emergency resolutions.
7. **Trusted Response Circle**:
   - Contact priority tiers (`Primary` / `Secondary`), granular permissions (`Location Access`, `Evidence Vault Access`), and clear Alert Policy sequence.
8. **Encrypted Evidence Vault**:
   - Encrypted with **Fernet AES-256** and sealed with **SHA-256 integrity digests**.
   - Inspection modal with tamper verification badge (*"SHA-256 Hash Verified"*), plus ZIP and PDF export downloads.
9. **Judge-Facing Demo Mode Toolbar**:
   - Top-level scenario simulator for live hackathon evaluation:
     - 1. Normal Journey (Score: 12)
     - 2. Route Deviation (+25 pts)
     - 3. Unexpected Stop (+18 pts)
     - 4. High-Risk Zone Entry (+24 pts)
     - 5. Full SOS Escalation (Compounding Multi-Signal Anomaly $\rightarrow$ 92 `CRITICAL`)
     - Clean Baseline Reset

---

## 🛠️ Architecture & Tech Stack

```
   ┌───────────────────────────────────────────────────────────┐
   │                  SENTINELPULSE CLIENT                     │
   │   React 19 (CRACO) + Tailwind CSS + Leaflet (OSM)         │
   │   Framer Motion + Recharts + Sonner Toast Notifications   │
   └─────────────────────────────┬─────────────────────────────┘
                                 │
                        REST API (JWT Bearer)
                                 │
   ┌─────────────────────────────▼─────────────────────────────┐
   │                  FASTAPI RELAY BACKEND                    │
   │   Deterministic Edge Risk Engine + AES Vault (Fernet)     │
   │   Safety Profile Engine + SHA-256 Tamper Integrity Engine │
   │   Optional Gemini / Emergent LLM Integration              │
   └─────────────────────────────┬─────────────────────────────┘
                                 │
   ┌─────────────────────────────▼─────────────────────────────┐
   │                    MONGODB ATLAS / LOCAL                  │
   │   Users, Profiles, Journeys, Events, Evidence, Emergencies │
   └───────────────────────────────────────────────────────────┘
```

---

## ⚙️ Environment Configuration

### Backend (`backend/.env`)
```env
MONGO_URL=mongodb+srv://<username>:<password>@cluster0.mongodb.net/sentinelpulse?retryWrites=true&w=majority
DB_NAME=sentinelpulse

# JWT & Vault Secrets (Minimum 32 characters)
JWT_SECRET=SentinelPulse@2026SuperSecretKeySecure!
ENCRYPTION_SECRET=SentinelPulseVaultEncryptionKey2026

# Optional: Gemini / Emergent LLM Integration (Graceful local fallback active if omitted)
# GEMINI_API_KEY=
# EMERGENT_LLM_KEY=

# CORS Origins
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# Map Provider (No paid API key required)
MAP_PROVIDER=leaflet_osm
```

### Frontend (`frontend/.env`)
```env
REACT_APP_BACKEND_URL=http://localhost:8000
REACT_APP_MAP_PROVIDER=leaflet_osm
```

---

## 🏃 Local Development Setup

### Terminal 1: Backend
```powershell
cd backend
.\venv\Scripts\activate
python -m pip install -r requirements.txt
python -m uvicorn server:app --reload --port 8000
```
- **API URL**: `http://localhost:8000`
- **Interactive Swagger Docs**: `http://localhost:8000/docs`

### Terminal 2: Frontend
```powershell
cd frontend
npm install --legacy-peer-deps
npm start
```
- **Frontend App**: `http://localhost:3000`

---

## 🧪 Running Automated Tests

### Backend Unit Tests (Pytest)
```powershell
.\backend\venv\Scripts\pytest -v tests/test_backend_unit.py
```

### End-to-End API Smoke Suite (33 Tests)
```powershell
.\backend\venv\Scripts\python test_full_suite.py
```

### Frontend Production Build
```powershell
cd frontend
npm run build
```

---

## 🎯 3–5 Minute Demo Sequence for Hackathon Judges

1. **Step 1: Open SentinelPulse (`http://localhost:3000`)**
   - Log in or register.
   - Show the **Live Protection Dashboard**: *"Protection Active"*, Safety Score 75/100 (*"Your current movement is within your normal safety pattern"*), Current Protection status grid, and Safety Signal Trend.
2. **Step 2: Safety Profile & Personal Baseline**
   - Click **Safety Profile** in the left rail.
   - Say: *"SentinelPulse first understands what normal looks like for the user."*
   - Show the profile metrics (travel window, typical duration, deviation tolerance, solo frequency). Click **Update Assessment** to demonstrate the 10-question baseline questionnaire.
3. **Step 3: Smart Journey Route Comparison**
   - Navigate to **Smart Journey**.
   - Click **Compute safe routes** to compare **Safest (94% - Recommended)** vs other routes with lighting and footfall metrics.
   - Show the *"Why this route?"* explanation card.
4. **Step 4: Start Journey & Live Monitoring**
   - Click **Start Journey** to transition into `MONITORING` mode.
   - Show the floating turn banner, safe corridor lighting indicators, and bottom floating safety dock (`Check In`, `Alert Circle`, `Emergency`).
5. **Step 5: Trigger Judge Demo Scenario $\rightarrow$ Route Deviation**
   - In the top **Judge Demo Mode** bar, click **1. Route Deviation**.
   - Observe risk score rise to Moderate (58/100).
   - Show the explainable factor breakdown (+25 pts) and the non-panic **Safety Check Recommended** banner with `[ I'm Safe (Check In) ]`.
6. **Step 6: Trigger Compound Escalation $\rightarrow$ SOS**
   - Click **5. Full Escalation**.
   - Observe risk score escalate to Critical (92/100).
   - Demonstrate the **Hold-to-Activate SOS** (1.5s hold progress ring).
   - Show the live incident timeline and in-app contact alerts.
7. **Step 7: Resolve Incident & Inspect Evidence Vault**
   - Click **Resolve Active Incident**.
   - Open **Evidence Vault** to inspect the sealed timeline with its **SHA-256 Hash Verified** badge. Download the ZIP/PDF archive.
8. **Step 8: End Journey & Personalization Learning**
   - Return to **Smart Journey** and click **End Journey**.
   - Show the **Post-Journey Summary**: *"Your journey has been added to your personal baseline."*
9. **Step 9: Review Safety Timeline & Privacy Center**
   - Open **Timeline** to see the complete chronological event feed.
   - Open **Privacy** to view the zero raw-sensor relay diagram and scoped deletion.

---

## 🔒 Security & Privacy Posture

- **Zero Raw-Sensor Leakage**: High-frequency motion, audio, and continuous GPS are processed on-device; only derived risk flags are stored.
- **Tamper-Evident Integrity**: Evidence vault records are encrypted with AES-256 and verified with SHA-256 digest checks upon retrieval.
- **Provider Abstraction**: External SMS, emergency calling, and paid mapping services are safely isolated behind adapters for completely autonomous local execution.

---

## 📄 License
MIT License. Built for privacy-first personal safety.
