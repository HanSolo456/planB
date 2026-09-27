# planB — Operations Web Client

> **React 19 + TypeScript + Vite** frontend application for the planB Autonomous Travel Disruption & Re-accommodation Engine.

[![React](https://img.shields.io/badge/React-19.2-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.2-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v4.0-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9.4-199900?style=flat-square&logo=leaflet&logoColor=white)](https://leafletjs.com/)

---

## 🚀 Key Client Features

- **Flight Manifest Board**: High-density operational tabular layout with departure flip animations and real-time buffer shortfall metrics.
- **Weather Digital Twin**: Live Open-Meteo telemetry (crosswinds, convective precipitation, cloud ceiling) and Reddit/GDELT ground truth feeds.
- **Interactive GIS Map**: Leaflet map view plotting multi-modal transit arcs, color-coded node health, and live weather radar overlays.
- **Multi-Modal Timeline (Gantt)**: Continuous time-axis visualization showing exact layover margins and cascading delay shift indicators.
- **Natural Language Disruption Assistant**: Conversational operations terminal integrating Groq and NuGen domain-aligned LLMs.
- **Resilience & Risk Auditing**: Non-linear diminishing-returns scoring gauge flagging dangerous connections before departure.
- **Universal Ticket Importer**: Drag-and-drop ingestion of PDF tickets, boarding passes, confirmation emails, and PNR codes via `pdfjs-dist` and Vision OCR.
- **Cloud Persistence & QR Sharing**: Supabase integration for saving trips and generating instant public sharing links with scannable boarding QR codes.

---

## 🛠️ Environment Configuration

Copy the example environment file:

```bash
cp .env.example .env.local
```

Populate the environment variables as needed:

```ini
# Groq API key for Vision OCR extraction and AI dispatcher reasoning
VITE_GROQ_API_KEY=gsk_your_groq_api_key

# Supabase Auth and Database for persistent trip storage and sharing
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

*Note: All features have zero-dependency fallbacks and built-in curated trips (e.g. London-Paris-Lyon, Goa Trip) if API keys are omitted.*

---

## 💻 Local Development

```bash
# Install dependencies
npm install

# Start Vite development server
npm run dev

# Run Oxlint / TypeScript check
npm run lint

# Build production bundle
npm run build

# Preview production build locally
npm run preview
```

---

## 📁 Source Architecture

```
src/
├── components/          # UI View Components & Operational Controls
│   ├── Header.tsx       # Flight manifest header, scenario picker, and status
│   ├── LandingPage.tsx  # Hero onboarding screen with Lenis smooth scroll
│   ├── TripDashboard.tsx# Core operational control deck and tab switcher
│   ├── BookingCard.tsx  # Manifest row with live buffer shortfall calculation
│   ├── MapView.tsx      # Leaflet geospatial route and airport visualizer
│   ├── TimelineView.tsx # Chronological multi-modal Gantt chart
│   ├── DigitalTwinView.tsx # Live weather station & social radar
│   ├── RecoveryView.tsx # Scored re-accommodation drawer
│   ├── DisruptionAssistant.tsx # Natural language IROPS assistant
│   ├── TripRiskBadge.tsx# Proactive risk score gauge
│   └── ImportView.tsx   # PDF / Image / PNR multi-format ingestion modal
│
├── lib/                 # Core Algorithmic & Telemetry Services
│   ├── impactEngine.ts  # DAG traversal & buffer propagation
│   ├── recoveryEngine.ts# Multi-criteria alternative ranking
│   ├── weatherEngine.ts # Open-Meteo live API integration
│   ├── socialSignalEngine.ts # Reddit JSON & GDELT news scrapers
│   ├── nugenDisruptionEngine.ts # Domain-aligned disruption models
│   ├── reasoningEngine.ts # Groq natural language dispatcher notes
│   ├── fileImportEngine.ts # PDF.js canvas extraction & Vision OCR
│   ├── cloudTripStorage.ts # Supabase storage & sharing engine
│   └── seedData.ts      # Multi-modal curated itineraries
│
├── App.tsx              # Root application router and state machine
└── index.css            # Flight manifest design system tokens
```

For detailed algorithmic proofs, scoring formulations, and system architecture, consult the root [`../README.md`](../README.md).
