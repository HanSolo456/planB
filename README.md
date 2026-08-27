# planB — Travel Disruption Recovery Platform

> Real-time Travel Disruption & Re-accommodation Engine

planB maps the dependency graph of travel itineraries, detects downstream disruptions when a single booking breaks, and surfaces ranked recovery alternatives with AI-generated reasoning.

## Architecture

- **`ripple-app/`**: Vite + React 19 web application featuring:
  - Flight manifest aesthetic design system
  - Interactive itinerary dependency graph
  - Disruption simulation engine (flight delays, hotel cancellations, train disruptions)
  - Real-time AI recovery reasoning & alternative recommendations
  - Raw confirmation import engine
- **`src/`**: Core TypeScript logic and CLI demo scripts

## Getting Started

```bash
# Install dependencies
npm install

# Start local development server
npm run dev

# Build for production
npm run build
```

## Tech Stack

- React 19 + TypeScript
- Vite
- Tailwind CSS
- Lucide React
