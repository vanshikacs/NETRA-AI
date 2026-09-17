{
  "product": {
    "name": "SentinelPulse",
    "tagline": "AI that protects you before you ask for help.",
    "design_north_star": [
      "Apple-level craft + Nothing OS clarity + Linear precision",
      "Privacy-first trust cues everywhere (explainability, local-first, auditability)",
      "Dark futuristic glass surfaces with teal energy accents; emergency red used sparingly",
      "Map-first interactions feel like Apple Maps + Uber trip UI",
      "Every state is real: no placeholders, no fake loading, no lorem ipsum"
    ]
  },
  "brand_attributes": {
    "adjectives": [
      "protective",
      "calm-under-pressure",
      "premium",
      "transparent",
      "precise",
      "fast"
    ],
    "anti_attributes": [
      "panic-inducing",
      "gamer neon",
      "material-ui generic",
      "busy dashboards",
      "low-contrast glass"
    ]
  },
  "visual_style_recipe": {
    "fusion": {
      "layout_principle": "Arc Browser / Linear: dense-but-breathable, strong hierarchy, crisp dividers",
      "surface_language": "VisionOS + glassmorphism: frosted panels, subtle borders, depth via layered translucency",
      "motion_language": "iOS spring physics + Tesla UI restraint: quick, confident, never bouncy",
      "map_language": "Google/Apple Maps: floating controls, bottom sheets, clear layer toggles"
    },
    "do": [
      "Use large rounded cards (16–24px radius) with blur + 1px hairline borders",
      "Use teal as energy/active state; keep emergency red for SOS/threat only",
      "Use subtle noise/grain overlay to avoid flat gradients",
      "Prefer bottom sheets/drawers for map + journey flows",
      "Use iconography from lucide-react only"
    ],
    "dont": [
      "No purple/pink gradients (explicitly prohibited)",
      "No gradients on text-heavy areas",
      "No universal transition: all",
      "No centered app container",
      "No emoji icons"
    ]
  },
  "typography": {
    "font_pairing": {
      "display": {
        "family": "Cabinet Grotesk",
        "fallback": "Satoshi, Inter, system-ui",
        "usage": "Hero headings, key numbers (Safety Score), section titles"
      },
      "body": {
        "family": "Inter",
        "fallback": "system-ui",
        "usage": "UI labels, paragraphs, forms, tables"
      },
      "mono": {
        "family": "IBM Plex Mono",
        "fallback": "ui-monospace",
        "usage": "Evidence hashes, device IDs, audit logs"
      }
    },
    "scale_tailwind": {
      "h1": "text-4xl sm:text-5xl lg:text-6xl tracking-tight",
      "h2": "text-base md:text-lg text-muted-foreground",
      "h3": "text-lg font-semibold",
      "body": "text-sm md:text-base leading-relaxed",
      "small": "text-xs text-muted-foreground"
    },
    "rules": [
      "Numbers (scores, ETA, countdown) use tabular-nums: add `tabular-nums` class.",
      "Use tighter tracking for display only; keep body tracking normal.",
      "Avoid all-caps except tiny badges; if used, add `tracking-widest` and `text-xs`."
    ]
  },
  "color_system": {
    "notes": [
      "App is dark-first. Use solid dark backgrounds; gradients only as decorative overlays <= 20% viewport.",
      "Primary teal from spec: #00E6B8. Secondary background from spec: #0B1220. Base background: #060A13.",
      "Emergency red: #FF4E5F. Warning: #FFB84C. Safe: #00D26A.",
      "All text must meet WCAG AA contrast on glass surfaces; add subtle text-shadow only when needed on imagery."
    ],
    "tokens_css_custom_properties": {
      "implementation_location": "/app/frontend/src/index.css",
      "root_dark_tokens": {
        "--sp-bg": "#060A13",
        "--sp-bg-elev-1": "#0B1220",
        "--sp-bg-elev-2": "#0F1A2E",
        "--sp-fg": "#EAF2FF",
        "--sp-fg-muted": "rgba(234,242,255,0.72)",
        "--sp-fg-subtle": "rgba(234,242,255,0.56)",
        "--sp-border": "rgba(255,255,255,0.10)",
        "--sp-border-strong": "rgba(255,255,255,0.16)",
        "--sp-primary": "#00E6B8",
        "--sp-primary-2": "#13F4C6",
        "--sp-ring": "rgba(19,244,198,0.45)",
        "--sp-danger": "#FF4E5F",
        "--sp-warning": "#FFB84C",
        "--sp-success": "#00D26A",
        "--sp-glass": "rgba(255,255,255,0.06)",
        "--sp-glass-2": "rgba(255,255,255,0.09)",
        "--sp-shadow": "0 18px 60px rgba(0,0,0,0.55)",
        "--sp-shadow-soft": "0 10px 30px rgba(0,0,0,0.35)",
        "--sp-radius-lg": "20px",
        "--sp-radius-md": "14px",
        "--sp-radius-sm": "10px"
      },
      "shadcn_mapping_hsl": {
        "instruction": "Replace current :root/.dark HSL tokens with SentinelPulse dark tokens. Keep shadcn variable names but set values to match brand. Use HSL where required; you can approximate via online hex->hsl conversion during implementation.",
        "must_map": [
          "--background, --foreground",
          "--card, --card-foreground",
          "--popover, --popover-foreground",
          "--primary, --primary-foreground",
          "--secondary, --secondary-foreground",
          "--muted, --muted-foreground",
          "--accent, --accent-foreground",
          "--destructive, --destructive-foreground",
          "--border, --input, --ring"
        ]
      }
    },
    "allowed_gradients": {
      "rule": "Gradients only for hero/section backgrounds and decorative overlays; never on small UI elements; never exceed 20% viewport.",
      "safe_combos": [
        {
          "name": "Deep Ocean Teal",
          "css": "radial-gradient(1200px circle at 20% 10%, rgba(19,244,198,0.18), transparent 55%), radial-gradient(900px circle at 80% 0%, rgba(0,230,184,0.12), transparent 50%)",
          "usage": "Top of dashboard / onboarding header backdrop"
        },
        {
          "name": "Night Steel",
          "css": "linear-gradient(135deg, rgba(15,26,46,0.9), rgba(6,10,19,1))",
          "usage": "App shell background (subtle)"
        }
      ]
    }
  },
  "texture_and_noise": {
    "approach": [
      "Use a subtle CSS noise overlay (SVG or base64) on the app shell and large glass panels.",
      "Keep opacity 0.04–0.08; blend-mode: overlay or soft-light."
    ],
    "image_urls": [
      {
        "category": "background_texture",
        "description": "Abstract dark glass texture for onboarding/auth header backdrop (use as low-opacity overlay)",
        "url": "https://images.unsplash.com/photo-1607743882420-4412ee605bac?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85"
      }
    ]
  },
  "layout_and_grid": {
    "app_shell": {
      "pattern": "Mobile-first, map-first. Use a persistent floating bottom nav on mobile; left rail on desktop for dashboards.",
      "max_width": "For non-map pages: max-w-6xl with generous side padding; map pages are full-bleed.",
      "spacing": {
        "page_padding": "px-4 sm:px-6 lg:px-8",
        "section_gap": "space-y-6 sm:space-y-8",
        "card_gap": "gap-3 sm:gap-4"
      }
    },
    "responsive_breakpoints": {
      "mobile": "<640px: bottom nav + stacked cards",
      "tablet": "640–1024px: 2-column bento grids where appropriate",
      "desktop": ">=1024px: 12-col grid; left rail for admin/family/responder dashboards"
    },
    "bento_grid": {
      "rule": "Use bento only for Home Dashboard + Analytics; keep map pages minimal.",
      "example": "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4"
    }
  },
  "components": {
    "component_path": {
      "shadcn_primary": "/app/frontend/src/components/ui",
      "must_use": [
        "button.jsx",
        "card.jsx",
        "tabs.jsx",
        "dialog.jsx",
        "drawer.jsx",
        "sheet.jsx",
        "badge.jsx",
        "progress.jsx",
        "skeleton.jsx",
        "sonner.jsx",
        "input.jsx",
        "input-otp.jsx",
        "form.jsx",
        "select.jsx",
        "switch.jsx",
        "slider.jsx",
        "tooltip.jsx",
        "calendar.jsx",
        "table.jsx",
        "scroll-area.jsx"
      ]
    },
    "design_patterns": {
      "glass_card": {
        "use": "Primary surface for dashboard widgets, map overlays, bottom sheets",
        "tailwind": "rounded-[var(--sp-radius-lg)] border border-white/10 bg-white/[0.06] backdrop-blur-xl shadow-[var(--sp-shadow-soft)]",
        "hover": "hover:bg-white/[0.08] hover:border-white/15",
        "focus": "focus-within:ring-2 focus-within:ring-[var(--sp-ring)]",
        "note": "Avoid heavy opacity; keep readable."
      },
      "floating_bottom_nav": {
        "use": "Mobile primary navigation",
        "tailwind": "fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[min(92vw,420px)] rounded-full border border-white/10 bg-white/[0.06] backdrop-blur-xl shadow-[var(--sp-shadow)] px-2 py-2",
        "items": "Use 4–5 icons max: Home, Map, Journey, Alerts, Profile"
      },
      "primary_button": {
        "shape": "Iconic / Action-First",
        "tailwind": "rounded-xl bg-[color:var(--sp-primary)] text-black font-semibold shadow-[0_10px_30px_rgba(0,230,184,0.18)]",
        "hover": "hover:bg-[color:var(--sp-primary-2)]",
        "active": "active:scale-[0.98]",
        "focus": "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sp-ring)] focus-visible:ring-offset-0",
        "transition": "transition-colors duration-200"
      },
      "danger_button": {
        "use": "SOS / Escalate",
        "tailwind": "rounded-xl bg-[color:var(--sp-danger)] text-white font-semibold shadow-[0_14px_40px_rgba(255,78,95,0.22)]",
        "hover": "hover:brightness-110",
        "active": "active:scale-[0.98]",
        "transition": "transition-[filter,background-color] duration-200"
      },
      "status_badges": {
        "safe": "bg-emerald-500/15 text-emerald-200 border border-emerald-400/20",
        "warning": "bg-amber-500/15 text-amber-200 border border-amber-400/20",
        "danger": "bg-rose-500/15 text-rose-200 border border-rose-400/20"
      }
    },
    "forms": {
      "rules": [
        "Inputs must be large touch targets: min-h-[44px].",
        "Use InputOTP for phone OTP.",
        "Always show inline validation + helper text; never rely only on toast.",
        "Every input/button must include data-testid."
      ],
      "input_style": "rounded-xl bg-white/[0.04] border-white/10 focus:border-white/20 focus:ring-2 focus:ring-[var(--sp-ring)]"
    }
  },
  "motion": {
    "library": "framer-motion",
    "principles": [
      "Use spring for panels/cards; use tween for opacity-only transitions.",
      "Keep durations short: 180–260ms for UI; 320–520ms for page transitions.",
      "Prefer transform+opacity animations; avoid layout thrash.",
      "Respect prefers-reduced-motion: reduce or disable non-essential motion."
    ],
    "recommended_presets": {
      "spring": {
        "type": "spring",
        "stiffness": 420,
        "damping": 34,
        "mass": 0.9
      },
      "fade_up": {
        "initial": {"opacity": 0, "y": 10},
        "animate": {"opacity": 1, "y": 0},
        "transition": {"duration": 0.22}
      }
    },
    "microinteractions": [
      "Buttons: hover glow (shadow intensity) + active scale 0.98",
      "Cards: hover border brighten + subtle lift (translateY -2) on desktop only",
      "Map marker: pulsing ring for live tracking",
      "Threat confirmation: animated countdown ring + haptic-like vibration pattern (PWA: navigator.vibrate when allowed)",
      "AI Pulse: subtle breathing glow behind shield icon"
    ]
  },
  "map_ui_leaflet": {
    "provider_abstraction": {
      "instruction": "Wrap Leaflet map creation behind a MapProvider interface so Mapbox can be swapped via env vars later.",
      "must_have": [
        "MapProvider.init(container, options)",
        "MapProvider.setStyle(styleId)",
        "MapProvider.setUserMarker(latlng)",
        "MapProvider.setRoute(polyline)",
        "MapProvider.setOverlays({heatmap, safeZones, alerts})"
      ]
    },
    "dark_map_strategy": {
      "now": "Use OSM tiles + CSS filter for dark mode (invert/brightness/hue-rotate) as interim.",
      "css": ".leaflet-tile { filter: brightness(0.62) invert(1) contrast(1.25) hue-rotate(185deg) saturate(0.55); }",
      "note": "Keep filter subtle to preserve readability; ensure markers/route colors remain distinct."
    },
    "floating_controls": {
      "pattern": "Glass pill controls (top-right) + bottom sheet for journey details",
      "controls": [
        "Layer toggle (safe zones / alerts / lighting / crowd)",
        "Recenter button",
        "Compass",
        "Zoom",
        "Report incident (secondary)",
        "SOS (primary danger)"
      ]
    }
  },
  "screen_blueprints": {
    "splash": {
      "layout": "Full-bleed dark background with subtle teal radial glow + animated pulse ring. Logo centered vertically but text left-aligned in lower third.",
      "must_include": [
        "App name",
        "Tagline",
        "Security microcopy: 'On-device by default. You control what leaves your phone.'"
      ]
    },
    "auth": {
      "layout": "Split: top brand header (<=20% gradient) + glass card form. Offer Email + Phone tabs. Biometric/passkey simulated as secondary button.",
      "components": ["tabs", "card", "form", "input", "input-otp", "button", "separator"],
      "testids": [
        "auth-email-tab",
        "auth-phone-tab",
        "auth-email-input",
        "auth-password-input",
        "auth-phone-input",
        "auth-otp-input",
        "auth-submit-button",
        "auth-passkey-button"
      ]
    },
    "home_dashboard": {
      "layout": "Bento grid: AI Shield status (hero card), Safety Score, Journey CTA, Trusted Contacts, Risk Summary chart, Recent Journeys, Daily Insight.",
      "must_include": [
        "Protection Status + Edge AI status",
        "Safety Score + confidence",
        "Quick SOS",
        "Offline + battery",
        "Daily AI Insight (Gemini) with explainability link"
      ]
    },
    "journey_map": {
      "layout": "Full-screen map with floating controls + bottom sheet for route/ETA + start/end journey.",
      "must_include": [
        "Live location marker",
        "Route polyline",
        "Safe route toggle",
        "Threat alerts overlay",
        "Journey share to trusted contacts"
      ]
    },
    "threat_confirmation": {
      "layout": "Calm emergency screen: large countdown ring (10–15s), swipe-to-cancel gesture, risk factors list, escalation path preview.",
      "components": ["progress", "button", "card", "dialog"],
      "testids": [
        "threat-countdown-ring",
        "threat-cancel-gesture",
        "threat-escalate-button",
        "threat-silent-mode-toggle"
      ]
    },
    "evidence_vault": {
      "layout": "Timeline list with filters; each item opens detail drawer with hash verification + export actions.",
      "components": ["tabs", "table", "drawer", "badge", "button", "scroll-area"],
      "must_include": [
        "Hash shown in mono",
        "Verification status badge",
        "Export PDF/ZIP",
        "Biometric lock gate"
      ]
    },
    "privacy_center": {
      "layout": "Trust dashboard: permissions, local vs cloud storage visualization, delete controls, audit log.",
      "components": ["card", "switch", "slider", "table", "dialog"],
      "must_include": [
        "Privacy score",
        "Explainable AI: what signals used",
        "Data deletion with confirmation dialog"
      ]
    }
  },
  "data_testid_policy": {
    "rule": "All interactive and key informational elements MUST include data-testid (kebab-case, role-based).",
    "examples": [
      "data-testid=\"home-quick-sos-button\"",
      "data-testid=\"map-layer-toggle-button\"",
      "data-testid=\"journey-start-button\"",
      "data-testid=\"privacy-delete-local-data-button\"",
      "data-testid=\"evidence-item-hash-text\""
    ]
  },
  "accessibility": {
    "requirements": [
      "WCAG AA contrast on all text over glass.",
      "Visible focus rings using --sp-ring.",
      "Touch targets >= 44px.",
      "Use aria-label on icon-only buttons.",
      "Respect prefers-reduced-motion.",
      "Use semantic headings and landmarks."
    ]
  },
  "imagery": {
    "image_urls": [
      {
        "category": "onboarding_hero",
        "description": "Night city street with teal lighting for onboarding header (use with dark overlay + blur)",
        "url": "https://images.unsplash.com/photo-1554369921-6aeee05ad2c0?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85"
      },
      {
        "category": "dashboard_backdrop",
        "description": "Aerial night city for subtle dashboard backdrop (very low opacity)",
        "url": "https://images.unsplash.com/photo-1580144185736-77ee9168752c?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85"
      },
      {
        "category": "tech_texture",
        "description": "Circuit-board blue texture for admin/responder analytics header (use as masked overlay)",
        "url": "https://images.pexels.com/photos/8108716/pexels-photo-8108716.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
      }
    ]
  },
  "libraries_and_integrations": {
    "required": [
      {
        "name": "framer-motion",
        "why": "Physics-based transitions, shared element animations, microinteractions",
        "install": "npm i framer-motion"
      },
      {
        "name": "react-leaflet + leaflet",
        "why": "OSM maps now; provider abstraction for Mapbox later",
        "install": "npm i leaflet react-leaflet"
      },
      {
        "name": "recharts",
        "why": "Safety score trends, risk summaries, analytics dashboards",
        "install": "npm i recharts"
      }
    ],
    "optional": [
      {
        "name": "lottie-react",
        "why": "Premium onboarding animations with fallback",
        "install": "npm i lottie-react"
      }
    ]
  },
  "instructions_to_main_agent": [
    "Replace CRA starter App.css styles; do not center the app container.",
    "Update /app/frontend/src/index.css tokens to SentinelPulse dark system; ensure shadcn components inherit correctly.",
    "Implement a reusable GlassCard wrapper (or utility class) using the provided tailwind recipe.",
    "All buttons/inputs/nav items/map controls must include data-testid.",
    "Use shadcn components from /src/components/ui (JS files) — do not use raw HTML dropdowns/calendars/toasts.",
    "Use sonner for toasts (already present).",
    "Keep gradients decorative and limited; prefer solid dark surfaces for readability.",
    "Map: implement Leaflet with floating glass controls + bottom sheet; keep provider abstraction for Mapbox swap later."
  ]
}

<General UI UX Design Guidelines>  
    - You must **not** apply universal transition. Eg: `transition: all`. This results in breaking transforms. Always add transitions for specific interactive elements like button, input excluding transforms
    - You must **not** center align the app container, ie do not add `.App { text-align: center; }` in the css file. This disrupts the human natural reading flow of text
   - NEVER: use AI assistant Emoji characters like`🤖🧠💭💡🔮🎯📚🎭🎬🎪🎉🎊🎁🎀🎂🍰🎈🎨🎰💰💵💳🏦💎🪙💸🤑📊📈📉💹🔢🏆🥇 etc for icons. Always use **FontAwesome cdn** or **lucid-react** library already installed in the package.json

 **GRADIENT RESTRICTION RULE**
NEVER use dark/saturated gradient combos (e.g., purple/pink) on any UI element.  Prohibited gradients: blue-500 to purple 600, purple 500 to pink-500, green-500 to blue-500, red to pink etc
NEVER use dark gradients for logo, testimonial, footer etc
NEVER let gradients cover more than 20% of the viewport.
NEVER apply gradients to text-heavy content or reading areas.
NEVER use gradients on small UI elements (<100px width).
NEVER stack multiple gradient layers in the same viewport.

**ENFORCEMENT RULE:**
    • Id gradient area exceeds 20% of viewport OR affects readability, **THEN** use solid colors

**How and where to use:**
   • Section backgrounds (not content backgrounds)
   • Hero section header content. Eg: dark to light to dark color
   • Decorative overlays and accent elements only
   • Hero section with 2-3 mild color
   • Gradients creation can be done for any angle say horizontal, vertical or diagonal

- For AI chat, voice application, **do not use purple color. Use color like light green, ocean blue, peach orange etc**

</Font Guidelines>

- Every interaction needs micro-animations - hover states, transitions, parallax effects, and entrance animations. Static = dead. 
   
- Use 2-3x more spacing than feels comfortable. Cramped designs look cheap.

- Subtle grain textures, noise overlays, custom cursors, selection states, and loading animations: separates good from extraordinary.
   
- Before generating UI, infer the visual style from the problem statement (palette, contrast, mood, motion) and immediately instantiate it by setting global design tokens (primary, secondary/accent, background, foreground, ring, state colors), rather than relying on any library defaults. Don't make the background dark as a default step, always understand problem first and define colors accordingly
    Eg: - if it implies playful/energetic, choose a colorful scheme
           - if it implies monochrome/minimal, choose a black–white/neutral scheme

**Component Reuse:**
	- Prioritize using pre-existing components from src/components/ui when applicable
	- Create new components that match the style and conventions of existing components when needed
	- Examine existing components to understand the project's component patterns before creating new ones

**IMPORTANT**: Do not use HTML based component like dropdown, calendar, toast etc. You **MUST** always use `/app/frontend/src/components/ui/ ` only as a primary components as these are modern and stylish component

**Best Practices:**
	- Use Shadcn/UI as the primary component library for consistency and accessibility
	- Import path: ./components/[component-name]

**Export Conventions:**
	- Components MUST use named exports (export const ComponentName = ...)
	- Pages MUST use default exports (export default function PageName() {...})

**Toasts:**
  - Use `sonner` for toasts"
  - Sonner component are located in `/app/src/components/ui/sonner.tsx`

Use 2–4 color gradients, subtle textures/noise overlays, or CSS-based noise to avoid flat visuals.
</General UI UX Design Guidelines>
