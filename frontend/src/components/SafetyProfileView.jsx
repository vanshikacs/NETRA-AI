import React, { useState, useEffect } from "react";
import {
  Shield,
  Clock,
  Compass,
  MapPin,
  Car,
  Footprints,
  Bus,
  Moon,
  Users,
  Sliders,
  CheckCircle,
  Edit3,
  Sparkles,
  ArrowRight,
  RotateCcw,
  SlidersHorizontal,
  BrainCircuit,
  AlertTriangle,
  Siren,
  BellRing,
  Volume2,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { formatApiError } from "@/lib/api-error";

export function SafetyProfileView({
  profile,
  authed,
  onProfileUpdated,
  isOnboarding = false,
  onCompleteOnboarding,
}) {
  const [isEditing, setIsEditing] = useState(isOnboarding || !profile?.profile_completed);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    primary_transport: "Walking + Public Transit",
    travel_hours: "Evening (6 PM - 10 PM)",
    travel_alone_frequency: "Frequently",
    common_journey: "College / Work -> Home",
    typical_duration_min: 30,
    night_travel: "Occasional",
    deviation_tolerance: "Moderate (300m - 500m)",
    emergency_location_sharing: "Auto-share on critical anomaly",
    intervention_preference: "Gentle check-in first",
    familiar_routes: ["Home - Campus / Office", "Downtown Safe Corridor"],
    uncomfortable_areas: ["Unlit alley behind station"],
    accessibility_notes: "Standard (Audio + visual alerts)",
    emergency_response_preference: "Notify Trusted Circle first",
    completeness_score: 92,
  });

  const [newRouteInput, setNewRouteInput] = useState("");
  const [newAreaInput, setNewAreaInput] = useState("");

  useEffect(() => {
    if (profile) {
      setFormData((prev) => ({
        ...prev,
        ...profile,
        familiar_routes: Array.isArray(profile.familiar_routes)
          ? profile.familiar_routes
          : prev.familiar_routes,
        uncomfortable_areas: Array.isArray(profile.uncomfortable_areas)
          ? profile.uncomfortable_areas
          : prev.uncomfortable_areas,
      }));
    }
  }, [profile]);

  // 12 Progressive Questions matching Part 4
  const questions = [
    {
      id: "primary_transport",
      title: "1. What is your most common mode of travel?",
      subtitle: "Calibrates expected movement speed, pace cadence, and transit patterns.",
      icon: Footprints,
      options: [
        "Walking",
        "Public transit (Bus / Metro)",
        "Cab / Rideshare (Uber / Taxi)",
        "Private vehicle (Car / Two-wheeler)",
        "Mixed / Multimodal",
      ],
    },
    {
      id: "travel_hours",
      title: "2. When do you usually travel?",
      subtitle: "Helps SentinelPulse understand your typical transit time window.",
      icon: Clock,
      options: [
        "Morning commute (7 AM - 10 AM)",
        "Afternoon (10 AM - 5 PM)",
        "Evening (6 PM - 10 PM)",
        "Late Night (10 PM - 5 AM)",
        "Mixed / Variable hours",
      ],
    },
    {
      id: "travel_alone_frequency",
      title: "3. How often do you travel alone?",
      subtitle: "Guides check-in sensitivity when traveling without companions.",
      icon: Users,
      options: [
        "Rarely (Usually travel with companions)",
        "Sometimes (A few times per week)",
        "Often (Most daily commutes)",
        "Almost always (Solo traveler)",
      ],
    },
    {
      id: "common_journey",
      title: "4. What are your common journey types?",
      subtitle: "Establishes your primary geographic and routine corridors.",
      icon: Compass,
      options: [
        "College / Campus commute",
        "Workplace / Office commute",
        "Home / Residence transit",
        "Daily errands & market",
        "Mixed / Frequent new destinations",
      ],
    },
    {
      id: "typical_duration_min",
      title: "5. What is your typical journey duration?",
      subtitle: "Unexpected stationary stops and delays are evaluated against this window.",
      icon: Clock,
      type: "duration",
      options: [15, 30, 45, 60],
    },
    {
      id: "deviation_tolerance",
      title: "6. What level of route deviation should SentinelPulse consider unusual?",
      subtitle: "Calibrates how far you can step off a planned route before a prompt.",
      icon: SlidersHorizontal,
      options: [
        "Low tolerance (<200m — I follow fixed paths strictly)",
        "Moderate (300m - 500m — Small detours are normal)",
        "High tolerance (>500m — I frequently explore alternative paths)",
      ],
    },
    {
      id: "emergency_location_sharing",
      title: "7. How comfortable are you sharing live location during a safety event?",
      subtitle: "Your privacy is paramount; configure your comfort with GPS sharing.",
      icon: MapPin,
      options: [
        "Always share live GPS with Primary Contacts during active journeys",
        "Only during high risk (Auto-share on critical anomaly)",
        "Only during SOS (Hold to activate emergency)",
        "Never unless manually enabled by me",
      ],
    },
    {
      id: "intervention_preference",
      title: "8. How should SentinelPulse respond to increasing risk?",
      subtitle: "Defines the escalation sequence when anomalies are detected.",
      icon: Shield,
      options: [
        "Quiet monitoring (Discreet status update)",
        "Ask me to check in (12s calm confirmation window)",
        "Notify trusted contacts earlier on moderate risk",
        "Strong escalation (Immediate alert and audible prompt)",
      ],
    },
    {
      id: "familiar_routes",
      title: "9. Familiar routes & safe corridors",
      subtitle: "Corridors where you feel safe and lower anomaly sensitivity applies.",
      icon: MapPin,
      type: "custom_routes",
    },
    {
      id: "uncomfortable_areas",
      title: "10. Areas or corridors of personal concern",
      subtitle: "Locations where you prefer heightened monitoring and earlier check-ins.",
      icon: AlertTriangle,
      type: "uncomfortable_areas",
    },
    {
      id: "accessibility_notes",
      title: "11. Optional accessibility & safety preferences",
      subtitle: "Adapts alerts and prompts to your physical and sensory needs.",
      icon: Volume2,
      options: [
        "Standard (Default audio chime + visual alert)",
        "Discreet / Silent mode (Subtle haptic-only alerts)",
        "High-contrast visual accessibility",
        "Audible confirmation voice prompts",
      ],
    },
    {
      id: "emergency_response_preference",
      title: "12. Emergency response preference",
      subtitle: "How external responders and contacts should be queued during SOS.",
      icon: Siren,
      options: [
        "Notify Trusted Circle first (Recommended)",
        "Simultaneous Trusted Circle + Audible Alarm",
        "Discreet silent recording + Circle notification",
        "Confirmation window before any notification",
      ],
    },
  ];

  const handleSave = async (updatedData = formData) => {
    setLoading(true);
    try {
      const payload = {
        ...updatedData,
        completeness_score: 95,
        profile_completed: true,
      };
      const res = await authed.put("/profile/safety", payload);
      toast.success("Personal safety baseline established successfully");
      setIsEditing(false);
      onProfileUpdated?.(res.data);
      if (isOnboarding && onCompleteOnboarding) {
        onCompleteOnboarding();
      }
    } catch (err) {
      toast.error(formatApiError(err, "Could not save safety profile"));
    } finally {
      setLoading(false);
    }
  };

  const addRoute = () => {
    if (!newRouteInput.trim()) return;
    const updated = [...(formData.familiar_routes || []), newRouteInput.trim()];
    setFormData({ ...formData, familiar_routes: updated });
    setNewRouteInput("");
  };

  const removeRoute = (index) => {
    const updated = (formData.familiar_routes || []).filter((_, idx) => idx !== index);
    setFormData({ ...formData, familiar_routes: updated });
  };

  const addArea = () => {
    if (!newAreaInput.trim()) return;
    const updated = [...(formData.uncomfortable_areas || []), newAreaInput.trim()];
    setFormData({ ...formData, uncomfortable_areas: updated });
    setNewAreaInput("");
  };

  const removeArea = (index) => {
    const updated = (formData.uncomfortable_areas || []).filter((_, idx) => idx !== index);
    setFormData({ ...formData, uncomfortable_areas: updated });
  };

  const visibleQuestions = isOnboarding ? questions.slice(0, 8) : questions;
  const currentQ = visibleQuestions[step];
  const CurrentIcon = currentQ?.icon || Shield;

  if (isEditing) {
    return (
      <div className="glass-card profile-wizard" data-testid="safety-profile-wizard">
        <div className="section-head">
          <div>
            <span className="icon-badge tone-teal">
              <BrainCircuit size={14} /> Personal Baseline Calibration
            </span>
            <h2>Let's understand what normal looks like for you.</h2>
            <p className="wizard-step-label">
              Question {step + 1} of {visibleQuestions.length}
            </p>
          </div>
          {!isOnboarding && (
            <button
              className="sp-button secondary"
              onClick={() => setIsEditing(false)}
              data-testid="profile-wizard-cancel"
            >
              Cancel
            </button>
          )}
        </div>

        {/* Responsible AI Disclaimer Banner */}
        <div className="honest-baseline-banner">
          <Sparkles size={15} />
          <span>
            Your answers create your initial personal safety baseline. SentinelPulse refines this
            baseline as more journey signals become available.
          </span>
        </div>

        <div className="wizard-card">
          <div className="wizard-q-header">
            <div className="wizard-icon-wrap">
              <CurrentIcon size={24} />
            </div>
            <div>
              <h3>{currentQ.title}</h3>
              <p>{currentQ.subtitle}</p>
            </div>
          </div>

          <div className="wizard-options">
            {currentQ.type === "duration" ? (
              <div className="duration-picker">
                {currentQ.options.map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    className={`option-btn ${formData.typical_duration_min === mins ? "active" : ""}`}
                    onClick={() => setFormData({ ...formData, typical_duration_min: mins })}
                  >
                    <strong>
                      {mins < 20 ? "<15 min" : mins <= 30 ? "15–30 min" : mins <= 50 ? "30–60 min" : ">60 min"}
                    </strong>
                    <span>~{mins} minutes average</span>
                  </button>
                ))}
              </div>
            ) : currentQ.type === "custom_routes" ? (
              <div className="custom-routes-manager">
                <p style={{ fontSize: 13, color: "var(--sp-fg-muted)", marginBottom: 8 }}>
                  Routes where lower anomaly sensitivity applies:
                </p>
                <div className="route-tags">
                  {(formData.familiar_routes || []).map((route, i) => (
                    <span key={route} className="route-tag">
                      {route}
                      <button type="button" onClick={() => removeRoute(i)} title="Remove route">
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="route-input-row">
                  <input
                    value={newRouteInput}
                    onChange={(e) => setNewRouteInput(e.target.value)}
                    placeholder="e.g. Campus to North Metro Station"
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addRoute())}
                  />
                  <button type="button" className="sp-button secondary" onClick={addRoute}>
                    Add Route
                  </button>
                </div>
              </div>
            ) : currentQ.type === "uncomfortable_areas" ? (
              <div className="custom-routes-manager">
                <p style={{ fontSize: 13, color: "var(--sp-fg-muted)", marginBottom: 8 }}>
                  Locations where SentinelPulse should prompt check-ins sooner:
                </p>
                <div className="route-tags">
                  {(formData.uncomfortable_areas || []).map((area, i) => (
                    <span key={area} className="route-tag concern-tag">
                      {area}
                      <button type="button" onClick={() => removeArea(i)} title="Remove area">
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="route-input-row">
                  <input
                    value={newAreaInput}
                    onChange={(e) => setNewAreaInput(e.target.value)}
                    placeholder="e.g. Unlit pedestrian underpass"
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addArea())}
                  />
                  <button type="button" className="sp-button secondary" onClick={addArea}>
                    Add Area
                  </button>
                </div>
              </div>
            ) : (
              currentQ.options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={`option-btn ${formData[currentQ.id] === opt ? "active" : ""}`}
                  onClick={() => setFormData({ ...formData, [currentQ.id]: opt })}
                >
                  <CheckCircle
                    size={18}
                    className={formData[currentQ.id] === opt ? "check-visible" : "check-hidden"}
                  />
                  <span>{opt}</span>
                </button>
              ))
            )}
          </div>

          <div className="wizard-nav">
            {step > 0 ? (
              <button
                type="button"
                className="sp-button secondary"
                onClick={() => setStep(step - 1)}
              >
                Previous
              </button>
            ) : (
              <div />
            )}

            {step < visibleQuestions.length - 1 ? (
              <button
                type="button"
                className="sp-button"
                onClick={() => setStep(step + 1)}
              >
                <span>Next Question</span>
                <ArrowRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                className="sp-button"
                onClick={() => handleSave()}
                disabled={loading}
              >
                <CheckCircle size={16} />
                <span>{loading ? "Establishing Baseline..." : "Generate Personal Baseline"}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Baseline Output & Profile View matching Part 5
  return (
    <div className="profile-layout" data-testid="safety-profile-view">
      {/* Hero Banner with Initial Baseline Announcement */}
      <div className="glass-card baseline-hero-banner">
        <div className="baseline-banner-content">
          <div className="hero-badge-row">
            <span className="icon-badge tone-teal">
              <Sparkles size={14} /> Initial Baseline Created
            </span>
            <span className="status-dot safe">
              <span /> Protection Active
            </span>
          </div>
          <h2>Your Safety Profile & Baseline</h2>
          <p>
            SentinelPulse has created your initial personal safety baseline. SentinelPulse will refine
            your baseline as you use the app.
          </p>
          <div className="baseline-metrics-strip">
            <div>
              <small>Profile Completeness</small>
              <strong>{formData.completeness_score || 92}%</strong>
            </div>
            <div>
              <small>Day 1 Baseline</small>
              <strong style={{ color: "var(--sp-success)" }}>Active & Calibrated</strong>
            </div>
            <div>
              <small>Deviation Tolerance</small>
              <strong>{formData.deviation_tolerance?.split(" ")[0] || "Moderate"}</strong>
            </div>
            <div>
              <small>Observed Journeys</small>
              <strong>{profile?.journeys_observed || 0} journeys</strong>
            </div>
          </div>
        </div>
        <button
          className="sp-button secondary"
          onClick={() => {
            setStep(0);
            setIsEditing(true);
          }}
          data-testid="edit-safety-profile-button"
        >
          <Edit3 size={16} />
          <span>Update Assessment</span>
        </button>
      </div>

      {/* Part 5 Architecture Flowchart: INITIAL PROFILE -> OBSERVED JOURNEYS -> BEHAVIOUR SIGNALS -> PERSONALIZED BASELINE -> RISK DEVIATION */}
      <div className="glass-card baseline-flowchart-card">
        <div className="flowchart-header">
          <span className="icon-badge tone-teal">
            <BrainCircuit size={14} /> Personal Baseline Evolution Architecture
          </span>
          <h4>How SentinelPulse Learns What Normal Looks Like for You</h4>
        </div>
        <div className="flowchart-steps">
          <div className="flow-step current">
            <span className="step-num">1</span>
            <strong>Initial Profile</strong>
            <small>Transit mode, hours, tolerance</small>
          </div>
          <div className="flow-arrow">↓</div>
          <div className="flow-step">
            <span className="step-num">2</span>
            <strong>Observed Journeys</strong>
            <small>Corridors, duration, pace</small>
          </div>
          <div className="flow-arrow">↓</div>
          <div className="flow-step">
            <span className="step-num">3</span>
            <strong>Behaviour Signals</strong>
            <small>Stop duration, cadence deltas</small>
          </div>
          <div className="flow-arrow">↓</div>
          <div className="flow-step">
            <span className="step-num">4</span>
            <strong>Personalized Baseline</strong>
            <small>Adaptive individual model</small>
          </div>
          <div className="flow-arrow">↓</div>
          <div className="flow-step alert">
            <span className="step-num">5</span>
            <strong>Risk Deviation</strong>
            <small>Explainable proactive check-in</small>
          </div>
        </div>
        <p className="flowchart-note">
          "SentinelPulse learns your normal journey patterns and detects meaningful deviations before they become emergencies."
        </p>
      </div>

      {/* Safety Profile Cards Grid (All Part 5 Display Items) */}
      <div className="profile-grid">
        <div className="glass-card profile-card">
          <div className="profile-card-header">
            <Clock size={18} />
            <h3>Travel Pattern</h3>
          </div>
          <div className="profile-card-body">
            <div className="profile-field">
              <label>Typical Travel Time</label>
              <strong>{formData.travel_hours}</strong>
            </div>
            <div className="profile-field">
              <label>Typical Journey Duration</label>
              <span>~{formData.typical_duration_min} minutes</span>
            </div>
            <div className="profile-field">
              <label>Common Corridors</label>
              <span>{formData.common_journey}</span>
            </div>
          </div>
        </div>

        <div className="glass-card profile-card">
          <div className="profile-card-header">
            <Footprints size={18} />
            <h3>Transport Pattern</h3>
          </div>
          <div className="profile-card-body">
            <div className="profile-field">
              <label>Transport Pattern</label>
              <strong>{formData.primary_transport}</strong>
            </div>
            <div className="profile-field">
              <label>Solo Travel Pattern</label>
              <span>{formData.travel_alone_frequency}</span>
            </div>
            <div className="profile-field">
              <label>Night Travel Window</label>
              <span>{formData.night_travel}</span>
            </div>
          </div>
        </div>

        <div className="glass-card profile-card">
          <div className="profile-card-header">
            <SlidersHorizontal size={18} />
            <h3>Risk Sensitivity & Escalation</h3>
          </div>
          <div className="profile-card-body">
            <div className="profile-field">
              <label>Risk Sensitivity (Deviation Tolerance)</label>
              <strong>{formData.deviation_tolerance}</strong>
            </div>
            <div className="profile-field">
              <label>Location Sharing Preference</label>
              <span>{formData.emergency_location_sharing}</span>
            </div>
            <div className="profile-field">
              <label>Emergency Response Preference</label>
              <span>{formData.emergency_response_preference}</span>
            </div>
          </div>
        </div>

        <div className="glass-card profile-card">
          <div className="profile-card-header">
            <MapPin size={18} />
            <h3>Familiar & Concern Corridors</h3>
          </div>
          <div className="profile-card-body">
            <label style={{ fontSize: 12, color: "var(--sp-fg-muted)", display: "block", marginBottom: 4 }}>
              Familiar Corridors (Lower Sensitivity):
            </label>
            <div className="route-tags" style={{ marginBottom: 12 }}>
              {(formData.familiar_routes || []).map((route) => (
                <span key={route} className="route-tag">
                  {route}
                </span>
              ))}
            </div>
            <label style={{ fontSize: 12, color: "var(--sp-fg-muted)", display: "block", marginBottom: 4 }}>
              Areas of Concern (Heightened Sensitivity):
            </label>
            <div className="route-tags">
              {(formData.uncomfortable_areas || []).map((area) => (
                <span key={area} className="route-tag concern-tag">
                  {area}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {isOnboarding && (
        <div className="onboarding-completion-bar glass-card">
          <div>
            <strong>Ready to protect your journeys</strong>
            <p>Your personal safety baseline is active on this device.</p>
          </div>
          <button
            className="sp-button"
            onClick={onCompleteOnboarding}
            data-testid="onboarding-proceed-dashboard"
          >
            <span>Proceed to Dashboard</span>
            <ArrowRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
