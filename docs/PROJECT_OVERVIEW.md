# ETS Workforce Dashboard — Project Overview

Evidence is taken from source, manifests, and launcher scripts in this workspace. Where `README.md` disagrees with code, the code is named as the source of truth. Counts such as “590 employees” appear as string literals in `backend/app/main.py` and `backend/app/ai/db.py`. They were not remeasured, because `ETS_Dasboard_DS.xlsx` is not in the workspace.

Workspace root:

`C:\Users\peernayakgarib\OneDrive - Infinite Computer Solutions (India) Limited\Documents\ETS_AI_Projects\ETS-Workspace-Dashboard-main\ETS-Workspace-Dashboard-main`

The running application is `frontend/` and `backend/` at that root. `ETS-Enterprise-main/` is a nested tree with its own launchers. Root `start_backend.bat`, `start_frontend.bat`, and `run_dashboard.bat` do not start it.

Detailed companions: `docs/SYSTEM_STARTUP_FLOW.md`, `docs/API_DOCUMENTATION.md`, `docs/DATABASE_SCHEMA.md`, `docs/DEPLOYMENT_STEPS.md`, `docs/BUSINESS_FLOW.md`, `docs/SYSTEM_MAP.md`, `docs/STARTUP_GUIDE.md`, `docs/ENVIRONMENT_REQUIREMENTS.md`, `docs/AI_UTILIZATION_DASHBOARD_DESIGN.md` (target design for the AI use tab).

## Executive Summary

The application is an employee workforce analytics dashboard with a natural-language copilot.

- Browser title in `frontend/index.html`: `ETS Workforce`.
- FastAPI title in `backend/app/main.py`: `ETS Employee Dashboard & Workforce Intelligence API`, version `2.0.0`.
- `GET /api/health` returns service name `ETS Employee Dashboard Backend`, version `2.0.0`.
- `frontend/src/App.tsx` signs users into `/dashboard`. Tabs, from labels in `frontend/src/components/layout/Header.tsx`: Workforce Overview, Work model, Skills & Capability, Client Program Delivery, Compensation Analytics, Leave & Attendance, Employee Profile. An AI drawer is toggled by an icon-only “ETS Genie” control (`title` / `aria-label` in `Header.tsx`). Dataset operations open from the avatar menu (“Database / Data source”).

`README.md` describes a full-stack workforce analytics dashboard and AI copilot over human-resource, skill, compensation, and attendance data, and names a Power BI file `Emp_7.21.pbix` and a workbook `ETS_Dasboard_DS.xlsx`. Workspace search found neither file. The loader still expects the workbook (`backend/app/data_loader.py`).

As implemented, the UI and API answer operational workforce questions from that workbook: headcount and attrition (`backend/app/routers/home.py`), state and delivery roster (`backend/app/routers/statewise.py`), employee profile (`backend/app/routers/employee_details.py`), skills (`backend/app/routers/techwise.py`), compensation (`backend/app/routers/salarywise.py`, `backend/app/routers/salarywise2.py`), leave (`backend/app/routers/calendar_leave.py`), and natural-language questions (`POST /api/copilot/query`).

## Technology Stack

Declared ranges are from manifests. They are not versions resolved on a machine. Node is pinned to `>=18` (`frontend/package.json` `engines`) and Python is pinned to `3.12` (`backend/.python-version`).

### Languages

| Language | Where |
| :--- | :--- |
| TypeScript | `frontend/` (`typescript` `~6.0.2` in `frontend/package.json`) |
| Python | `backend/` (no `python_requires` in `backend/requirements.txt`; pinned to `3.12` in `backend/.python-version`) |
| SQL | SQLite statements inside `backend/app/auth_db.py`, `backend/app/ai/db.py`, `backend/app/ai/vector_store.py` |
| CSS | Tailwind via `frontend/src/index.css` and `frontend/tailwind.config.js` |

Java is not used. Workspace search found no `pom.xml`, `build.gradle`, or `.java` files.

### Frontend (`frontend/package.json`)

| Item | Declared package |
| :--- | :--- |
| UI | `react` `^19.2.8`, `react-dom` `^19.2.8` |
| Routing | `react-router-dom` `^7.18.4` |
| HTTP | `axios` `^1.19.0` |
| Charts / reporting UI | `recharts` `^3.10.1` |
| Icons | `lucide-react` `^1.34.0` |
| Selects | `react-select` `^5.10.2` |
| Class names | `clsx` `^2.1.1`, `tailwind-merge` `^3.6.0` |
| PDF package | `pdfkit` `^0.20.2` (declared; no import under `frontend/src` was found) |
| Build | `vite` `^8.2.2`, `@vitejs/plugin-react` `^6.1.0` |
| CSS | `tailwindcss` `^3.4.17`, `postcss` `^8.5.26`, `autoprefixer` `^10.5.4` |
| Lint | `oxlint` `^1.79.0` |

`README.md` says React 18 and Vite port `3036` proxying to `8000`. `frontend/package.json` declares React 19. `frontend/vite.config.ts` sets port `42005` and proxies `/api` to `http://127.0.0.1:42006`.

Client state is React `useState` in `frontend/src/App.tsx` plus `AuthProvider` in `frontend/src/context/AuthContext.tsx`. No Redux, Zustand, or other state library is declared in `frontend/package.json`.

CSV export is implemented in `frontend/src/components/common/ExportButton.tsx` (client-side CSV blob). There is no separate BI server in this tree.

### Backend (`backend/requirements.txt`)

Minimum versions only:

- `fastapi>=0.110.0`
- `uvicorn>=0.28.0`
- `pandas>=2.0.0`
- `openpyxl>=3.1.0`
- `numpy>=1.24.0`
- `pydantic>=2.0.0`
- `bcrypt` (unpinned)
- `PyJWT` (unpinned)
- `sqlglot` (unpinned)
- `requests` (unpinned)

Imported by application code and now listed in `backend/requirements.txt` (added unpinned):

| Import | PyPI distribution | Files |
| :--- | :--- | :--- |
| `bcrypt` | `bcrypt` | `backend/app/security.py`, `backend/app/auth_db.py` |
| `jwt` | `PyJWT` | `backend/app/security.py` |
| `sqlglot` | `sqlglot` | `backend/app/ai/sql_governor.py`, `backend/app/ai/query_builder.py`, `backend/app/ai/orchestrator.py` |
| `requests` | `requests` | `backend/app/routers/dataset.py` |

`sqlite3` is the Python standard library. No SQLAlchemy, Postgres, MySQL, SQL Server, or Mongo driver was found under `backend/`.

### Auth, data, cloud, devops

| Concern | What the code uses |
| :--- | :--- |
| Auth | bcrypt password hashes and HS256 JWT (`backend/app/security.py`). On-disk SQLite users (`backend/app/auth_db.py`). |
| Analytical database | In-memory SQLite (`backend/app/ai/db.py`) filled from pandas frames. |
| Document index | On-disk SQLite `backend/data/rag_index.db` (`backend/app/ai/vector_store.py`). |
| Source data | `templates/Infinite_ETS_India_Workforce.xlsx` plus pay from `templates/Infinite_ETS_India_Compensation.xlsx` (`backend/app/data_loader.py`). A workbook that still has `EMPLOYEES`, `SKILL`, `Finance_History`, and `LEAVE` loads on the previous path. |
| Cloud | No cloud SDK. Optional HTTP GET of a OneDrive or SharePoint URL in `backend/app/routers/dataset.py`. Optional local Ollama at `http://localhost:11434` (`backend/app/ai/ollama_client.py`). |
| DevOps | No `Dockerfile`, `docker-compose`, `.github/workflows`, `Procfile`, or `pyproject.toml`. Windows batch launchers only. |

## Architecture Overview

Two processes:

1. Vite React application (`frontend/`).
2. FastAPI application `backend.app.main:app` (`backend/app/main.py`), served by Uvicorn.

The browser calls relative `/api`. In development, `frontend/vite.config.ts` proxies `/api` to `http://127.0.0.1:42006`.

Workforce facts are loaded from Excel into pandas (`backend/app/data_loader.py`), then copied into in-memory SQLite (`backend/app/ai/db.py`) for the copilot SQL path. Dashboard KPI routes use the pandas frames through `backend/app/analytics.py`, not the SQLite tables. User accounts are a separate on-disk SQLite file. Policy markdown under `backend/data/documents/` is the retrieval corpus (`backend/app/ai/document_indexer.py`).

There is no message bus, cache server, or external relational database in the modules that were read.

```text
Browser
  |  http://<host>:42005   (frontend/vite.config.ts)
  v
frontend/index.html -> src/main.tsx -> src/App.tsx
  AuthProvider (src/context/AuthContext.tsx)
  Axios: src/api/client.ts , src/services/authService.ts
  |
  |  /api/*  proxied to http://127.0.0.1:42006
  v
backend/app/main.py
  routers -> analytics.py (pandas)     auth -> auth_db.py (ets_auth.db)
  copilot -> ai/orchestrator.py        -> ai/db.py (memory SQLite)
                                       -> ai/vector_store.py (rag_index.db)
                                       -> ollama_client.py (optional :11434)
data_loader.py reads <repo>/ETS_Dasboard_DS.xlsx
```

| Layer | What it is in this repo | Primary files |
| :--- | :--- | :--- |
| Presentation | React SPA, tab shell, auth screens | `frontend/src/App.tsx`, `frontend/src/components/` |
| API client | Axios, bearer token from `localStorage` | `frontend/src/api/client.ts`, `frontend/src/services/authService.ts` |
| HTTP API | FastAPI routers and Pydantic models | `backend/app/main.py`, `backend/app/routers/`, `backend/app/models.py` |
| Analytics service | In-memory pandas aggregations | `backend/app/analytics.py`, `backend/app/data_loader.py` |
| Copilot | Intent, SQL, semantic engine, RAG, model gateway | `backend/app/ai/` |
| Identity store | On-disk SQLite | `backend/app/auth_db.py`, `backend/app/security.py` |
| Analytical store | In-memory SQLite projection | `backend/app/ai/db.py` |
| Document store | Markdown plus SQLite vector index | `backend/data/documents/`, `backend/app/ai/vector_store.py` |

There is no separate repository package. Data access functions live in `auth_db.py`, `data_loader.py`, `ai/db.py`, and `ai/vector_store.py`.

## Repository Structure

```text
<workspace root>/
  frontend/                 React + Vite
    index.html              HTML entry, title ETS Workforce
    package.json            npm scripts and dependency ranges
    package-lock.json       npm lockfile
    vite.config.ts          Port 42005, /api proxy to 42006
    src/main.tsx            React mount
    src/App.tsx             Routes and dashboard shell
    src/api/client.ts       Dashboard and dataset HTTP client
    src/services/authService.ts
    src/context/AuthContext.tsx
    src/utils/rbac.ts       Client tab permissions
    src/types/              dashboard.ts, auth.ts
    src/components/         auth, layout, tabs, copilot, dataset, common, ui
    public/                 favicon and icons
  backend/
    requirements.txt
    app/main.py             FastAPI application
    app/routers/            HTTP route modules
    app/analytics.py        KPI calculations
    app/models.py           Pydantic contracts
    app/data_loader.py      Excel load
    app/auth_db.py          User SQLite
    app/security.py         bcrypt and JWT
    app/ai/                 Copilot, memory SQLite, Ollama, RAG
    app/ai/semantic/        Semantic parser, planner, executor, catalog
    data/documents/         Markdown policy documents
  tests/                    Automated tests (not started by launchers)
  scripts/run_harness.py    Copilot evaluation harness (not the API server)
  reports/                  Saved audit and evaluation markdown
  start_backend.bat         Uvicorn port 42006
  start_frontend.bat        Vite port 42005
  run_dashboard.bat         Uvicorn port 8000; printed UI port 3036
  README.md
  ARCHITECTURE.md
  ETS_GENIE_ARCHITECTURE.md
  design.md
  ETS-Enterprise-main/      Separate nested app and its own .bat files
  docs/
  dump/                     Created by dataset routes (not present until those routes run)
```

Shared UI lives under `frontend/src/components/common/` and `frontend/src/components/layout/`. The only utility module under `frontend/src/utils/` is `rbac.ts`.

`README.md` lists `backend/app/ai_agent.py`. That file is not in the root `backend/app/` tree. It exists at `ETS-Enterprise-main/backend/app/ai_agent.py`. The root tree uses `backend/app/ai/` instead.

## Frontend Design

### Entry, routing, layout

`frontend/index.html` loads `/src/main.tsx`. `frontend/src/main.tsx` calls `createRoot` on `#root`, imports `frontend/src/index.css`, and renders `App` inside `StrictMode`.

`frontend/src/App.tsx` wraps routes in `BrowserRouter` and `AuthProvider`.

| Path | Component |
| :--- | :--- |
| `/login` | `frontend/src/components/auth/Login.tsx` |
| `/signup` | `frontend/src/components/auth/SignUp.tsx` |
| `/forgot-password` | `frontend/src/components/auth/ForgotPassword.tsx` |
| `/reset-password` | same `ForgotPassword` component |
| `/dashboard` | `DashboardView` inside `ProtectedRoute` |
| `/` and unknown paths | redirect to `/dashboard` |

There is no second route table and no `src/index.tsx`.

Layout for the signed-in shell is `Header`, `FilterBar`, `SelectedChips`, and the active tab, plus `AICopilotDrawer`, `EmployeeProfileDrawer`, and `DatasetOperationsModal` (`frontend/src/App.tsx`). The shell is a fixed viewport and the main pane scrolls. `.dash-fold` sizes to its content, so the next section follows the first row instead of sitting after a full-pane blank stretch. From the `lg` breakpoint up, Workforce (`.dash-home`) fills the pane and does not scroll: the KPI band uses the same compact height, padding, and type scale as the Skills KPI cards, the two chart rows share the space that remains, and a compact insight band under those rows shows Work model (Office, Hybrid, Remote, Client site, Not recorded yet) beside Training counts (planned, in progress, completed, cancelled). That band is about one KPI card tall. It stays inside the pane in a normal window, in fullscreen, and with ETS Genie docked (`lg:w-[260px]`). Chart rows keep a usable height. On a short window both chart rows share the height under the KPI band and the insight band, with a little more of that height on Headcount, Composition, and Project & Manager Hierarchy. Work model Open opens the Work model tab. Training opens the profile on the training status (`#training-detail`). Counts come from `work_model_mix` and `training_summary`. Empty training stays “Not recorded yet”. Each chart is drawn inside its slot. In the Delivery view, lead rows stretch to fill that card when the selected account has only a few leads, the badge counts the leads in that account, names stay fully visible, and extra leads scroll inside the card. The repeated footer line under a chart is omitted, the extra line under each client account is omitted, each composition name sits on its own line with its count underneath so the two do not overlap, and the plot scales to the slot instead of being clipped. The first chart row gives Headcount and Workforce Composition a little more than a quarter each, and Project & Manager Hierarchy keeps the wider share so the four grade tiers stay a pyramid and the age labels stay horizontal. Hub names, module names, tenure bands, client accounts, and department names stay fully readable: a name, a thin bar, and a quiet count. City names stay in the legend when the scaled map type would fall under 8px. Below the `lg` width the rows stack and the pane scrolls. Leave, Compensation (Overview and Trends), Skills, Profile (360 and Classic), and Client Delivery use `.pane-fit` or the existing `.dash-fit` so that from `lg` up the pane fills and the main pane does not scroll. Work model uses that same `.dash-fit` pane: a compact strip for headcount and each arrangement, six glass cards, and a roster that scrolls inside its card. The page itself does not scroll. The mix card is one composition strip; each segment shows its count and the caption keeps the count and percent visible. City, account, department, and office are scrolling ranked lists inside their cards, so more cities, accounts, departments, or offices do not crush the layout. Grade is a heatmap that scrolls inside the card. Clicking a city, account, department, or office row filters the other cards and the roster and toggles off on a second click; the source card keeps its rows. A grade cell filters to that grade and work model, a grade heading filters to the grade, and Headcount clears every filter on the tab. The roster chip names the active filters. Counts are recomputed from the roster in the browser. Charts in those tabs scale inside the card (`.pane-plot`) instead of a fixed 150px or 220px frame. Lists and tables scroll inside their own cards. A category is a full name, a thin solid bar, and a quiet count: leave types and departments, salary bands, skill names and secondary skills, profile skills, and delivery hubs. The Leave day roster is one line per person: the name and day count, then leave type, employee number, and department on the line under it. Manager and earner names, and the employee sidebar, wrap instead of ellipsizing. On Profile, the hero is two rows inside the profile canvas: name, employee number, grade, and one Active or Separated status (Rehire only when it applies) on the first, with training as a small status on that row (`#training-detail`; one line, “Not recorded yet”, when there are no rows); role, department, location, project, and manager beside Total CTC, ETS tenure, and promotion on the second. A long manager name wraps in its own cell. Under the hero the 360 body is a bento, not three equal columns. Personal & Benefits is a quiet rail (identity, contact, statutory; one row per field). Compensation Progression is the wide card: the chart and the year table, with the plot taller than the table. Skills is its own card, primary skill first, and the list scrolls inside the card so names can wrap. Leave is its own card: the donut, its center label, the type legend, the History line, and the used/left caption stay fully inside it in a normal window and with ETS Genie docked. Classic Dossier still places training with the skills content. Classic Dossier stays on the filter bar’s right and shifts left of the docked Genie column. The docked Genie header hides the assistant badge and the Clear label. The employee filter is a docked column about 210px wide from the `lg` breakpoint up: names wrap, the list scrolls inside the column, and it stays in the row beside the profile. The compensation chart’s salary axis uses the positive base-salary values (and the grade median when that is a real figure), so a zero or missing year does not pull that axis to 0. The hike series stays on its own axis. The chart and the year table use the same years, and a year with no positive salary is left off both. The shared `.dash-plot` frame remains in `frontend/src/index.css` for any chart that has not moved onto `.pane-plot`. Tables scroll inside their panel. Each tab’s first chart subtitle states the main figure already computed on that tab.

### Component hierarchy (tabs)

Tabs are lazy-loaded. Header ids and labels are in `frontend/src/components/layout/Header.tsx`.

| Tab id | Header label | Component |
| :--- | :--- | :--- |
| `home` | Workforce / Workforce Overview | `frontend/src/components/tabs/HomeDashboard.tsx` |
| `work_model` | Work model | `WorkModelDashboard.tsx`. Fills the pane with `.dash-fit`: compact counts, then a composition strip, ranked lists for city, account, department, and office, a grade heatmap, and a roster. Those lists scroll inside the card only when they grow past the rows on screen, and the roster scrolls inside its card. The page itself does not scroll. The mix caption keeps Client site and Not recorded yet when they fit, and uses Client and Unrecorded when they do not, with the full phrase in the title. Grade row labels do the same and paint once. A click on a city, account, department, office, grade cell, or grade heading filters the other cards and the roster; Headcount clears those filters. Counts are recomputed from the roster in the browser. |
| `ai_utilization` | AI use | `AIUtilizationDashboard.tsx`. Three pages under `.dash-fit.ai-util-fit` (`100%` / `100cqh`): Page 1 Command Center (5 KPIs ~3.25 lines, health|attention extra height, opp|quad same row, full-width ≤3-bullet narrative — no Manager league), Page 2 Project Intelligence (keeps Manager league), Page 3 Release Deep Dive. Bands fill without mid-panel inner scroll. Header Maximize → `requestFullscreen()` + `html.app-fullscreen`. Breadcrumb drill Portfolio → Project → Release. Genie-docked (≤1180cqw) keeps two-column mid and Opp|Quad; full stack only below 720cqw. Portfolio health compact at `HEALTH_COMPACT_AT = 4`. |
| `techwise` | Skills / Skills & Capability | `TechwiseDashboard.tsx` |
| `statewise` | Client Delivery / Client Program Delivery | `StatewiseDashboard.tsx` |
| `salarywise` | Compensation / Compensation Analytics | `SalarywiseDashboard.tsx` (also renders `Salarywise2Dashboard.tsx` for the trends sub-view) |
| `calendar` | Leave / Leave & Attendance | `EmployeeCalendarDashboard.tsx` |
| `employee_details` | Profile / Employee Profile | `Employee360Dashboard.tsx` or `EmployeeDetailsDashboard.tsx` (`profileViewMode` `'360'` or `'classic'` in `App.tsx`). On the 360 view the employee filter pane opens and closes from the chevron in its header; closing it returns that width to the profile cards. |

`salarywise2` is a tab id used for RBAC and data loading in `App.tsx`. The header button id is `salarywise`. Both compensation modes load `GET /api/salarywise/kpis` and `GET /api/salarywise2/kpis`.

### State, services, API layer

| State | Where |
| :--- | :--- |
| Signed-in user | `frontend/src/context/AuthContext.tsx` |
| Token and user JSON | `localStorage` keys `ets_auth_token`, `ets_auth_user` (`frontend/src/services/authService.ts`) |
| Theme | `localStorage` key `ets_dashboard_theme` (`frontend/src/App.tsx`) |
| Copilot history | `localStorage` key `ets_genie_chat_history` (`frontend/src/components/copilot/AICopilotDrawer.tsx`) |
| Active tab, filters, selected employee | `useState` in `DashboardView` (`frontend/src/App.tsx`) |

Dashboard HTTP calls go through `frontend/src/api/client.ts` (`baseURL` `/api`). Auth HTTP calls go through `frontend/src/services/authService.ts` (`baseURL` `/api/auth`). Both attach `Authorization: Bearer`. A 401 on the dashboard client clears storage and sends the browser to `/login`, except on `/login`, `/signup`, and `/forgot-password`.

### Auth flow (browser)

1. `AuthProvider` reads stored token and user.
2. If a token exists, it calls `GET /api/auth/me`.
3. `ProtectedRoute` (`frontend/src/components/auth/ProtectedRoute.tsx`) sends unauthenticated visitors to `/login`.
4. Login posts to `POST /api/auth/login`.
5. Tab visibility uses `canAccessTab` in `frontend/src/utils/rbac.ts`. That check is client-side.

### Report and dashboard modules

Charts are Recharts inside the tab components. CSV download is `ExportButton.tsx`. There is no server-side report renderer and no `.pbix` runtime. `pdfkit` is unused in `frontend/src`.

## Backend Design

### Startup and framework

Application object: `app` in `backend/app/main.py`. Server: Uvicorn, import path `backend.app.main:app`.

There is no FastAPI `lifespan` and no `@app.on_event("startup")`. Excel load, auth SQLite init, in-memory SQLite fill, and RAG store construction run at import time. Sequence is in `docs/SYSTEM_STARTUP_FLOW.md`.

### Controllers, services, data access

| Role in this repo | Files |
| :--- | :--- |
| Controllers (routers) | `backend/app/routers/*.py` plus `GET /api/health` and `POST /api/reload` on `app` |
| Analytics service | `backend/app/analytics.py` (`analytics_engine`) |
| Dataset service | `backend/app/data_loader.py` (`data_loader`, `reload_all`) |
| Copilot service | `backend/app/ai/orchestrator.py` (`llm_orchestrator`) |
| Auth service | `backend/app/security.py`, handlers in `backend/app/routers/auth.py` |
| User persistence | `backend/app/auth_db.py` |
| Analytical SQL | `backend/app/ai/db.py` (`sqlite_engine`) |
| Vector persistence | `backend/app/ai/vector_store.py` |

### Middleware

The only middleware registered in `backend/app/main.py` is `CORSMiddleware`. Origins:

- `http://localhost:42005`, `http://127.0.0.1:42005`
- `http://localhost:5173`, `http://127.0.0.1:5173`
- `http://localhost:3000`, `http://127.0.0.1:3000`

`allow_credentials=True`, `allow_methods=["*"]`, `allow_headers=["*"]`. Port `3036` is not in the list.

### Auth

See the Authorization section below and `docs/API_DOCUMENTATION.md`. Password hashing is bcrypt. Tokens are HS256 JWTs, lifetime `ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24` in `backend/app/security.py`. Signing key is `ETS_JWT_SECRET`, or a hardcoded string in that file if unset.

### Logging and error handling

Named loggers (`logging.getLogger`) exist in `backend/app/routers/copilot.py` (`copilot_telemetry`), `backend/app/routers/dataset.py` (`dataset_router`), and several `backend/app/ai/` modules. No logging configuration file and no `logging.basicConfig` call were found in `backend/app/main.py`. Destination beyond Python’s default logging is UNKNOWN; the file that would resolve an app-specific log path does not exist in this repo.

There is no `@app.exception_handler`. Handlers raise `fastapi.HTTPException`. FastAPI’s default error body is `{"detail": ...}`.

`scripts/run_harness.py` and `tests/` are not started by the dashboard launchers.

## API Summary

Full method, path, request, response, and auth inventory: `docs/API_DOCUMENTATION.md`.

| Prefix | Router file | Auth dependency on the route |
| :--- | :--- | :--- |
| `/api/auth` | `backend/app/routers/auth.py` | `GET /me` uses `get_current_user`. Signup, login, forgot-password, reset-password do not. |
| `/api/home` | `backend/app/routers/home.py` | None |
| `/api/statewise` | `backend/app/routers/statewise.py` | None |
| `/api/employee` | `backend/app/routers/employee_details.py` | None |
| `/api/techwise` | `backend/app/routers/techwise.py` | None |
| `/api/salarywise` | `backend/app/routers/salarywise.py` | `require_roles(["MANAGER", "HR_ANALYTICS", "EXECUTIVE", "ADMIN"])` |
| `/api/salarywise2` | `backend/app/routers/salarywise2.py` | same role list |
| `/api/calendar` | `backend/app/routers/calendar_leave.py` | None |
| `/api/copilot` | `backend/app/routers/copilot.py` | Optional bearer. Missing or invalid token is treated as role `EMPLOYEE`. |
| `/api/dataset` | `backend/app/routers/dataset.py` | None |
| `GET /api/health` | `backend/app/main.py` | None |
| `POST /api/reload` | `backend/app/main.py` | `require_roles(["ADMIN", "HR_ANALYTICS"])` |

OpenAPI is exposed at `/docs`, `/redoc`, and `/openapi.json`.

`POST /api/reload` calls `reload_all()` in `backend/app/data_loader.py`. That reloads pandas from the workforce workbook and, for the friendly file, from `templates/Infinite_ETS_India_Compensation.xlsx`, then rebuilds the in-memory SQLite tables Genie reads. Dataset upload and cloud sync call the same `reload_all()`. A friendly upload is accepted when the sheets are People, Skills, and Leave. A compensation upload is written to the compensation file and does not replace the workforce workbook. The legacy four-sheet workbook still validates and loads.

The workforce workbook includes `AI release outcomes`, `AI utilization`, `AI tools catalog`, `AI targets`, and `Cursor billing` for SDM and QA Manager release reporting (Dev and QA via a Domain column). `data_loader` reads them (targets fall back to built-in defaults); `GET /api/ai-utilization/kpis` and the **AI use** tab surface Page 1–3. Roster-scale rows come from `templates/_generate_ai_utilization_from_roster.py` (additive, Source `Generated` / `Estimated-generated`). Intake rolls through `templates/AI_Team_Intake.xlsx` and `_sync_ai_intake_to_master.py`. Sheet contracts are in `docs/DATABASE_SCHEMA.md` and `docs/BUSINESS_FLOW.md`.

## Database Summary

Full tables, indexes, and Excel column usage: `docs/DATABASE_SCHEMA.md`.

| Store | Path or URI | Created |
| :--- | :--- | :--- |
| Workforce Excel | Repository root `ETS_Dasboard_DS.xlsx`, else relative `ETS_Dasboard_DS.xlsx` | Not in the workspace |
| Auth SQLite | `backend/data/ets_auth.db` | Import of `backend/app/auth_db.py` |
| Analytical SQLite | `file:ets_memdb?mode=memory&cache=shared` | Import of `backend/app/ai/db.py` |
| RAG SQLite | `backend/data/rag_index.db` | Import of `backend/app/ai/vector_store.py` |

Auth tables: `users`, `password_reset_tokens` (foreign key to `users`). In-memory tables written by pandas `to_sql`: `employees`, `skills`, `leaves`, `finance_history`. RAG tables: `rag_documents`, `rag_chunks`.

No SQL views, stored procedures, or migration tool were found. Searched `backend/app` for `CREATE VIEW`, `CREATE PROCEDURE`, and `alembic`.

When `users` is empty, `init_auth_db()` inserts five accounts. Usernames and roles in `backend/app/auth_db.py`: `admin`/`ADMIN`, `executive`/`EXECUTIVE`, `hr_analytics`/`HR_ANALYTICS`, `manager`/`MANAGER`, `employee`/`EMPLOYEE`. Password strings are literals in that file. They are not environment variables.

## Environment Requirements

Full table: `docs/ENVIRONMENT_REQUIREMENTS.md`.

No `.env` file and no `load_dotenv` call. The frontend does not read `import.meta.env` or `VITE_` variables (`frontend/src/vite-env.d.ts` only references Vite client types).

| Variable | File | Default if unset |
| :--- | :--- | :--- |
| `ETS_JWT_SECRET` | `backend/app/security.py` | Hardcoded string in that file |
| `ETS_USE_SEMANTIC_ENGINE` | `backend/app/ai/orchestrator.py` | `true` (also `1`, `yes`) |
| `ETS_RAG_MODEL` | `backend/app/ai/model_gateway.py` | `granite3.1-dense:8b` |
| `ETS_LOCAL_RAG_MODEL` | same | `qwen2.5:3b` |
| `ETS_SQL_MODEL` | same | `qwen2.5-coder:7b` |
| `ETS_LOCAL_SQL_MODEL` | same | `qwen2.5-coder:3b` |
| `ETS_EMBED_MODEL` | same | `bge-large-en-v1.5` |
| `ETS_LOCAL_EMBED_MODEL` | same | `nomic-embed-text:latest` |
| `ETS_REASONING_MODEL` | same | `granite3.1-dense:8b` |
| `ETS_LOCAL_REASONING_MODEL` | same | `qwen2.5:3b` |
| `ETS_VERIFIER_MODEL` | same | `qwen2.5:1.5b`, else the RAG model resolution |

Node version: pinned to `>=18` via the `engines` field in `frontend/package.json`. No `.nvmrc`.

Python version: pinned to `3.12` via `backend/.python-version`. `backend/requirements.txt` has no `python_requires`, and there is no `pyproject.toml`.

## Startup Process

Commands and order: `docs/SYSTEM_STARTUP_FLOW.md` and `docs/STARTUP_GUIDE.md`.

Launchers that match the Vite proxy:

- `start_backend.bat`: `python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 42006 --reload`
- `start_frontend.bat`: `npm run dev -- --host 0.0.0.0 --port 42005` from `frontend/`

`run_dashboard.bat` and `README.md` start Uvicorn on port `8000` and print UI `http://localhost:3036`. The Vite proxy target remains `42006`.

Ordered runtime chain:

```text
Excel workbook -> pandas (data_loader.py)
  -> auth SQLite (auth_db.py)
  -> in-memory SQLite (ai/db.py)
  -> FastAPI routes
  -> Vite
  -> browser login
  -> dashboard tabs
```

Ollama is not started by the batch files. It is required only when copilot generation or embedding calls run.

## Deployment Overview

There is no deployment pipeline in this repository. Checked: no `Dockerfile`, no `docker-compose` file, no `.github` workflow directory, no `Procfile`, no `pyproject.toml`.

What exists is local execution and a frontend production bundle script. Steps, artifacts, and the port mismatch are in `docs/DEPLOYMENT_STEPS.md`.

`npm run build` in `frontend/package.json` is `tsc -b && vite build`. `frontend/vite.config.ts` does not set `build.outDir`, so the bundle directory is Vite’s default `frontend/dist`. No file in this repo serves that directory except the operator running `npm run preview`.

## Authorization (roles)

Five roles, in `frontend/src/utils/rbac.ts` and `backend/app/ai/security_context.py`: `EMPLOYEE`, `MANAGER`, `HR_ANALYTICS`, `EXECUTIVE`, `ADMIN`.

UI labels in `ROLE_LABELS` (`frontend/src/utils/rbac.ts`): Employee, Delivery Manager, HR Analytics, Executive Leadership, System Admin.

| Tab id | Roles allowed by `TAB_PERMISSIONS` |
| :--- | :--- |
| `home`, `techwise`, `statewise`, `calendar`, `employee_details` | all five |
| `salarywise`, `salarywise2` | `MANAGER`, `HR_ANALYTICS`, `EXECUTIVE`, `ADMIN` |
| `reload` | `HR_ANALYTICS`, `ADMIN` |

Server enforcement matches salary routes and `POST /api/reload` only. Other dashboard, dataset, and health routes do not use `require_roles` or `get_current_user`. Copilot role handling is described in the API summary.

Signup (`backend/app/routers/auth.py`) accepts a `role` when it is one of the five names. Any other value is stored as `EMPLOYEE`.

## Known Risks

These are observations from the files cited. They are not a change list.

1. **Missing workbook.** `backend/app/data_loader.py` reads `ETS_Dasboard_DS.xlsx` during import of `data_loader`, which `backend/app/main.py` imports through the routers. Workspace search found no `.xlsx` file. If the file is absent at the path the loader builds, Uvicorn does not finish importing the app. **Recommendation (not applied):** place `ETS_Dasboard_DS.xlsx` at the repository root named in `DataLoader.__init__`.
2. **Python imports now declared.** `bcrypt`, `jwt` (via `PyJWT`), `sqlglot`, and `requests` are imported and are now listed (unpinned) in `backend/requirements.txt`, so `pip install -r backend/requirements.txt` installs them.
3. **Port mismatch.** `run_dashboard.bat` and `README.md` use backend port `8000` and print UI port `3036`. `frontend/vite.config.ts` listens on `42005` and proxies to `42006`. `start_backend.bat` and `start_frontend.bat` match the Vite file.
4. **Interpreters now pinned.** Node is pinned to `>=18` (`frontend/package.json` `engines`) and Python to `3.12` (`backend/.python-version`), matching the documented versions (`README.md` Node 18+/Python 3.10+; `ARCHITECTURE.md` Python 3.12).
5. **Client-only tab gate.** `frontend/src/utils/rbac.ts` hides tabs. `GET /api/home/kpis`, `GET /api/statewise/kpis`, `GET /api/techwise/kpis`, `GET /api/employee/list`, `GET /api/employee/{emp_number}`, `GET /api/calendar/data`, and all `/api/dataset/*` routes have no `require_roles` dependency.
6. **JWT default secret and seed passwords** are literals in `backend/app/security.py` and `backend/app/auth_db.py`.
7. **Password reset token** is returned in the JSON body of `POST /api/auth/forgot-password` when the account exists and is active. No SMTP library was found.
8. **Signup role** is taken from the request body when it matches a known role (`backend/app/routers/auth.py`).
9. **`POST /api/reload` does not refresh in-memory SQLite.** Dataset upload and cloud sync call `reload_all()`, which does.
10. **Finance rows** for employees missing from the `Finance_History` sheet are synthesized in `backend/app/data_loader.py` (`record_origin` `SYNTHETIC_DERIVED`).
11. **Nested tree.** `ETS-Enterprise-main/` can be mistaken for the root app. Its `start_backend.bat` uses port `8000`. Root launchers do not invoke it.
12. **`Emp_7.21.pbix` is absent.** Reporting in this tree is the React dashboards plus CSV export, not a Power BI service.
