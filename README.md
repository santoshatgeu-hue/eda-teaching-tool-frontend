# EDA Teaching Tool — Frontend

Schematic capture editor (React + Vite + Tailwind). This is the frontend
only — it calls the ngspice simulation backend (separate repo/project) over
HTTPS once the "Run Simulation" wiring is added.

## Local dev

```
npm install
npm run dev
```

## Build

```
npm run build
npm run preview   # sanity-check the production build locally
```

Verified: `npm run build` completes cleanly (32 modules, ~156kB JS bundle).

## Deploying to Vercel

This must be a **separate GitHub repo** from the backend
(`eda-teaching-tool` backend repo has a Dockerfile and runs ngspice — Vercel
can't run that). Push this folder as its own repo, e.g.
`eda-teaching-tool-frontend`, then:

1. On vercel.com → **Add New** → **Project** → import that repo
2. Vercel auto-detects Vite — leave build command (`vite build`) and output
   directory (`dist`) as default
3. Deploy — you'll get a `*.vercel.app` URL

## Connecting to the backend later

Once the Railway backend URL is confirmed working (`/api/health` returns
`{"ok":true}` and `/api/simulate` returns real values), add a "Run
Simulation" button in `SchematicEditor.jsx` that POSTs the live netlist
string to `<backend-url>/api/simulate`. Store the backend URL as a Vite env
var (`VITE_SIM_API_URL`) rather than hardcoding it, so it's easy to change
per environment.
