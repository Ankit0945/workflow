# WorkFlowOS — AI-Powered Workflow Automation Agent

> Your work teaches the computer how to automate it.

A hackathon MVP demonstrating the pipeline:

**Observe → Understand → Detect Repetition → Generate Workflow → User Approval → Automate → Learn**

This is **Phase 1**: project scaffolding, database models, the activity
simulation layer, the discovery engine, the AI service, the automation
engine, core API endpoints, and the initial Dashboard + Activity Monitor UI.
Everything below is real, running code — not a plan.

---

## What's implemented so far

- **Backend (FastAPI)** — fully working, tested end-to-end via an internal
  TestClient run (demo → discovery → AI understanding → workflow generation
  → approval → execution → dashboard stats all verified in one pass).
- **Activity Simulator** — generates the canonical `Gmail → Download
  Attachment → CRM → Update Customer → Slack Notification` sequence with
  realistic metadata and timing, so the demo needs no real credentials.
- **Workflow Discovery Engine** — groups activity by session, matches
  repeated `(application, action)` signatures, and flags anything seen 2+
  times as a candidate. Explainable heuristics, not undisclosed ML.
- **Gemini AI service** — strict JSON-schema prompts for intent
  understanding and workflow generation, validated with Pydantic, with a
  deterministic fallback if `GEMINI_API_KEY` is missing or the API call
  fails, so a demo never breaks live on stage.
- **Automation Engine** — modular adapter architecture
  (`API / Application / Accessibility / Browser / Simulation`).
  `SimulationAdapter` is fully implemented and actually executes each step
  with realistic delays and live status; the others are documented stubs
  ready for real integrations later.
- **Database** — all 10 required tables, auto-created on backend startup
  (no manual migration step needed for the hackathon).
- **Frontend (React + Vite + Tailwind)** — dark, professional dashboard UI
  with a working live Activity Timeline, the **"Simulate Customer Request
  Workflow"** button, and real dashboard stats pulled from the backend.
  Other nav sections (Discovered Workflows, Automation, Execution History,
  Settings) are visible in the sidebar with clear "not built yet" states —
  they arrive in Phase 2, not faked.

## What's NOT implemented yet (by design, coming in later phases)

- Discovered Workflows page (AI suggestion cards, Approve/Edit/Reject UI)
- Visual workflow builder (node/card editor)
- Automation page (active workflows, Run Workflow button, live execution UI)
- Execution History page
- Human-intervention UI (the backend already supports this via
  `simulate_customer_not_found` on the execute endpoint)
- Settings page (Gemini/DB status, integration toggles)
- Real Gmail/Slack/CRM API integrations (adapters are stubbed intentionally)

---

## Prerequisites

- Docker + Docker Compose **or** Python 3.11+ and Node.js 20+ installed locally
- A Gemini API key (optional — the app works without one, using
  deterministic AI fallbacks, but real Gemini responses are more impressive
  in a demo)

---

## Quick start (Docker — recommended)

```bash
# 1. From the project root, copy the env template and add your API key
cp .env.example .env
# then edit .env and set GEMINI_API_KEY=AIza...

# 2. Build and start everything (Postgres + backend + frontend)
docker compose up --build
```

Once it's up:
- Frontend: **http://localhost:5173**
- Backend API docs (Swagger): **http://localhost:8000/docs**
- Health check: **http://localhost:8000/api/health**

To stop: `Ctrl+C`, then `docker compose down` (add `-v` to also wipe the database volume).

---

## Quick start (without Docker)

**Backend:**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt

# You need a local PostgreSQL running. Easiest way, using Docker just for the DB:
docker run -d --name workflowos-db -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=workflowos -p 5432:5432 postgres:16-alpine

cp ../.env.example .env
# edit .env: set GEMINI_API_KEY, and DATABASE_URL if different

uvicorn app.main:app --reload --port 8000
```

**Frontend (separate terminal):**
```bash
cd frontend
npm install
npm run dev
```

Then open **http://localhost:5173**.

---

## Try it out

1. Open the Dashboard at `http://localhost:5173`.
2. Click **"Simulate Customer Request Workflow"**.
3. Watch the Activity Timeline populate live with the Gmail → CRM → Slack
   sequence (this also seeds two earlier "historical" runs of the same
   workflow in the background, so repetition detection has something to find).
4. Check the stats update, and try the **Activity Monitor** page for the
   full timeline.
5. Explore the API directly at `http://localhost:8000/docs` — try
   `POST /api/workflows/analyze` to run the discovery engine + Gemini over
   the activity you just generated, then `POST /api/workflows/{id}/approve`
   and `POST /api/workflows/{id}/execute`.

---

## Project structure

```text
workflowos/
├── docker-compose.yml
├── .env.example
├── README.md
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py              # FastAPI app, CORS, startup table creation
│       ├── config.py            # env-based settings
│       ├── database.py          # SQLAlchemy engine/session
│       ├── models/models.py     # all 10 ORM tables
│       ├── schemas/schemas.py   # Pydantic request/response + strict AI schemas
│       ├── api/                 # activity, demo, workflows, executions, dashboard, ai
│       ├── services/            # demo_simulator.py, workflow_discovery.py
│       ├── ai/                  # gemini_service.py, prompts.py
│       └── automation/          # engine.py, adapters.py
└── frontend/
    ├── Dockerfile
    ├── package.json / vite.config.js / tailwind.config.js
    └── src/
        ├── App.jsx, main.jsx, index.css
        ├── components/          # Sidebar, Layout, StatCard, ActivityTimeline,
        │                        # DemoButton, AppIcon
        ├── pages/                # Dashboard, ActivityMonitor, ComingSoon
        └── services/api.js      # fetch wrapper for the backend
```

---

## Troubleshooting

- **Frontend shows "Could not reach the backend"** — make sure the backend
  is running on port 8000 and `VITE_API_BASE_URL` (default
  `http://localhost:8000`) matches.
- **Backend fails to start / DB errors** — confirm Postgres is running and
  `DATABASE_URL` in `.env` is correct. Tables are auto-created on backend
  startup, no manual step needed.
- **AI responses look generic / same every time** — that's the deterministic
  fallback, meaning `GEMINI_API_KEY` isn't set or the Gemini call failed.
  Check `GET /api/health` — `gemini_configured` tells you which mode you're in.
