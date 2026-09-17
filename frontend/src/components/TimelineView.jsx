import React, { useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Compass,
  Filter,
  Navigation,
  Route,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Sparkles,
} from "lucide-react";

export function TimelineView({ timeline = [] }) {
  const [filter, setFilter] = useState("all");

  const filtered = timeline.filter((item) => {
    if (filter === "all") return true;
    if (filter === "journeys") return item.category === "journey";
    if (filter === "signals") return item.category === "signal";
    if (filter === "emergencies") return item.category === "emergency";
    return true;
  });

  const getIcon = (item) => {
    if (item.category === "emergency" || item.icon === "Siren") return Siren;
    if (item.tone === "danger" || item.icon === "ShieldAlert") return ShieldAlert;
    if (item.tone === "warning" || item.icon === "AlertTriangle") return AlertTriangle;
    if (item.icon === "CheckCircle") return CheckCircle;
    if (item.icon === "Route") return Route;
    return Activity;
  };

  return (
    <div className="timeline-page" data-testid="timeline-view">
      <div className="glass-card timeline-header-card">
        <div className="section-head">
          <div>
            <span className="icon-badge tone-teal">
              <Clock size={14} /> Continuous Safety Timeline
            </span>
            <h2>Safety Activity & Event Feed</h2>
            <p>
              A continuous, tamper-evident audit record of journeys, motion analyses, routine checks,
              and emergency interventions.
            </p>
          </div>
          <div className="filter-pill-group">
            <button
              className={`filter-pill ${filter === "all" ? "active" : ""}`}
              onClick={() => setFilter("all")}
            >
              All Events ({timeline.length})
            </button>
            <button
              className={`filter-pill ${filter === "journeys" ? "active" : ""}`}
              onClick={() => setFilter("journeys")}
            >
              Journeys
            </button>
            <button
              className={`filter-pill ${filter === "signals" ? "active" : ""}`}
              onClick={() => setFilter("signals")}
            >
              Signals & Checks
            </button>
            <button
              className={`filter-pill ${filter === "emergencies" ? "active" : ""}`}
              onClick={() => setFilter("emergencies")}
            >
              Emergencies
            </button>
          </div>
        </div>
      </div>

      <div className="timeline-feed-list">
        {filtered.length === 0 ? (
          <div className="glass-card empty-state" data-testid="timeline-empty-state">
            <Shield size={32} />
            <h3>No timeline events yet</h3>
            <p>
              Start a Smart Journey or simulate a demo scenario to see live timeline progression.
            </p>
          </div>
        ) : (
          filtered.map((item) => {
            const ItemIcon = getIcon(item);
            const timeStr = item.time
              ? new Date(item.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : "Just now";
            const dateStr = item.time
              ? new Date(item.time).toLocaleDateString([], { month: "short", day: "numeric" })
              : "";

            return (
              <div
                key={item.id || item.time}
                className={`timeline-feed-card tone-${item.tone || "safe"}`}
                data-testid={`timeline-item-${item.id}`}
              >
                <div className="timeline-time-badge">
                  <strong>{timeStr}</strong>
                  <small>{dateStr}</small>
                </div>
                <div className={`timeline-icon-node tone-${item.tone || "safe"}`}>
                  <ItemIcon size={16} />
                </div>
                <div className="timeline-card-content">
                  <div className="timeline-item-title-row">
                    <h4>{item.title}</h4>
                    <span className={`timeline-tag tone-${item.tone || "safe"}`}>
                      {item.category?.toUpperCase() || "EVENT"}
                    </span>
                  </div>
                  <p>{item.detail}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

