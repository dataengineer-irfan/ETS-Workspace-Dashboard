# ETS Workforce Dashboard — System Map

Module map of the root application (`frontend/` and `backend/`). `ETS-Enterprise-main/` is a separate tree. Root `start_backend.bat`, `start_frontend.bat`, and `run_dashboard.bat` do not import or start it.

Workspace root:

`C:\Users\peernayakgarib\OneDrive - Infinite Computer Solutions (India) Limited\Documents\ETS_AI_Projects\ETS-Workspace-Dashboard-main\ETS-Workspace-Dashboard-main`

## Dependency diagram

```text
Frontend pages and components
    -> frontend/src/api/client.ts
    -> frontend/src/services/authService.ts
        -> HTTP /api
            -> FastAPI routers (controllers)
                -> analytics.py / auth_db.py / data_loader.py / ai/orchestrator.py
                    -> pandas frames
                    -> backend/data/ets_auth.db
                    -> in-memory SQLite (ai/db.py)
                    -> backend/data/rag_index.db
                    -> optional Ollama :11434
                    -> optional OneDrive/SharePoint HTTP GET
```

Shorter form:

```text
Frontend -> API Layer -> Service Layer -> Database
```

There is no repository package. Persistence functions are the service files named below.

## Frontend

### Pages (routes)

Registered only in `frontend/src/App.tsx`.

| Route | Module |
| :--- | :--- |
| `/login` | `frontend/src/components/auth/Login.tsx` |
| `/signup` | `frontend/src/components/auth/SignUp.tsx` |
| `/forgot-password`, `/reset-password` | `frontend/src/components/auth/ForgotPassword.tsx` |
| `/dashboard` | `DashboardView` in `frontend/src/App.tsx` inside `frontend/src/components/auth/ProtectedRoute.tsx` |
| `/`, `*` | redirect to `/dashboard` |

Entry: `frontend/index.html` → `frontend/src/main.tsx` → `frontend/src/App.tsx`.

### Dashboard components (not routes)

| Module | Role |
| :--- | :--- |
| `frontend/src/components/tabs/HomeDashboard.tsx` | Workforce overview |
| `frontend/src/components/tabs/WorkModelDashboard.tsx` | Work model. Pane-locked five-model count and mix strips, current-size City/Account/Grade/Department/Office breakdowns, and roster. The page remains fixed while future overflow scrolls inside its card. |
| `frontend/src/components/tabs/TechwiseDashboard.tsx` | Skills |
| `frontend/src/components/tabs/StatewiseDashboard.tsx` | Client delivery |
| `frontend/src/components/tabs/SalarywiseDashboard.tsx` | Compensation overview; hosts the trends view |
| `frontend/src/components/tabs/Salarywise2Dashboard.tsx` | Compensation trends. Imported by `SalarywiseDashboard.tsx`, not by `App.tsx` directly |
| `frontend/src/components/tabs/EmployeeCalendarDashboard.tsx` | Leave |
| `frontend/src/components/tabs/Employee360Dashboard.tsx` | Profile mode `360` |
| `frontend/src/components/tabs/EmployeeDetailsDashboard.tsx` | Profile mode `classic` |

### Layout, shared UI, utilities

| Module | Role |
| :--- | :--- |
| `frontend/src/components/layout/Header.tsx` | Tab bar and tool buttons |
| `frontend/src/components/layout/FilterBar.tsx` | Slicers (`react-select`) |
| `frontend/src/components/layout/SelectedChips.tsx` | Active filter chips |
| `frontend/src/components/layout/UserMenuDropdown.tsx` | User menu |
| `frontend/src/components/copilot/AICopilotDrawer.tsx` | ETS Genie drawer |
| `frontend/src/components/dataset/DatasetOperationsModal.tsx` | Upload and cloud sync UI |
| `frontend/src/components/common/KPICard.tsx` | KPI card |
| `frontend/src/components/common/IndiaDeliveryMap.tsx` | Delivery map |
| `frontend/src/components/common/ExportButton.tsx` | Client CSV |
| `frontend/src/components/common/ErrorBoundary.tsx` | React error boundary |
| `frontend/src/components/common/EmptyState.tsx` | Empty state |
| `frontend/src/components/common/EmployeeProfileDrawer.tsx` | Profile slide-over |
| `frontend/src/components/common/EmpTypeBreakdown.tsx` | Employee type chart |
| `frontend/src/components/common/DashboardSkeleton.tsx` | Loading skeleton |
| `frontend/src/components/common/AgeDistributionChart.tsx` | Age chart |
| `frontend/src/components/common/AdvancedEmployeeSearchModal.tsx` | Employee search modal |
| `frontend/src/components/ui/Typewriter.tsx` | Typewriter text |
| `frontend/src/components/auth/ProtectedRoute.tsx` | Auth and tab gate |
| `frontend/src/utils/rbac.ts` | Role labels and `TAB_PERMISSIONS` |
| `frontend/src/types/dashboard.ts` | Client KPI and filter types |
| `frontend/src/types/auth.ts` | Client auth types |
| `frontend/src/context/AuthContext.tsx` | Session state |
| `frontend/src/index.css` | Global styles |
| `frontend/tailwind.config.js` | Tailwind theme |

### Services and API layer

| Module | Calls |
| :--- | :--- |
| `frontend/src/services/authService.ts` | `/api/auth/*`. Stores `ets_auth_token`, `ets_auth_user`. |
| `frontend/src/api/client.ts` | Dashboard, copilot, reload, dataset. Attaches bearer token. 401 clears storage and redirects to `/login`. |

No other file under `frontend/src/services/`.

## Backend

### Routes and controllers

| Module | Prefix |
| :--- | :--- |
| `backend/app/main.py` | `GET /api/health`, `POST /api/reload`, CORS, router include list |
| `backend/app/routers/auth.py` | `/api/auth` |
| `backend/app/routers/home.py` | `/api/home` |
| `backend/app/routers/statewise.py` | `/api/statewise` |
| `backend/app/routers/employee_details.py` | `/api/employee` |
| `backend/app/routers/techwise.py` | `/api/techwise` |
| `backend/app/routers/salarywise.py` | `/api/salarywise` |
| `backend/app/routers/salarywise2.py` | `/api/salarywise2` |
| `backend/app/routers/calendar_leave.py` | `/api/calendar` |
| `backend/app/routers/copilot.py` | `/api/copilot` |
| `backend/app/routers/dataset.py` | `/api/dataset` |

### Services

| Module | Role |
| :--- | :--- |
| `backend/app/analytics.py` | Filter parsing and KPI calculations (`analytics_engine`) |
| `backend/app/data_loader.py` | Excel load and `reload_all()` |
| `backend/app/security.py` | Password hash, JWT, `get_current_user`, `require_roles` |
| `backend/app/models.py` | Pydantic response and copilot request models |
| `backend/app/ai/orchestrator.py` | Copilot `llm_orchestrator.process` |
| `backend/app/ai/model_gateway.py` | Ollama model name selection |
| `backend/app/ai/ollama_client.py` | HTTP client for Ollama |
| `backend/app/ai/sql_governor.py`, `query_builder.py` | SQL checks (`sqlglot`) |
| `backend/app/ai/semantic/` | Parser, planner, executor, catalog, IR, formatter, validator, engine |
| `backend/app/ai/semantic_rag.py` | RAG query helper. Constructs `SemanticRAG()` at import |
| `backend/app/ai/document_indexer.py` | Syncs `backend/data/documents/` |
| `backend/app/ai/embedding_engine.py` | Embedding HTTP call |
| `backend/app/ai/security_context.py` | Copilot role capabilities |
| `backend/app/ai/capability_registry.py` | Capability enum and entity normalizer |
| `backend/app/ai/tools.py` | Copilot tools. Imports semantic RAG |
| `backend/app/ai/grounding.py`, `evidence_collector.py`, `invariant_engine.py`, `compositional.py`, `call_tracker.py` | Copilot support modules imported by the AI package |

### Repositories (data access, no repository classes)

| Module | Store |
| :--- | :--- |
| `backend/app/auth_db.py` | `backend/data/ets_auth.db` |
| `backend/app/ai/db.py` | In-memory `employees`, `skills`, `leaves`, `finance_history` |
| `backend/app/ai/vector_store.py` | `backend/data/rag_index.db` |
| `backend/app/data_loader.py` | Excel path and pandas frames held on the `DataLoader` singleton |

### Middleware

| Module | Middleware |
| :--- | :--- |
| `backend/app/main.py` | `CORSMiddleware` only |

No custom exception-handler middleware.

### Not on the request path of the dashboard launchers

| Path | Role |
| :--- | :--- |
| `tests/` | Automated tests |
| `scripts/run_harness.py` | Copilot evaluation harness |
| `reports/` | Saved markdown reports |
| `ETS-Enterprise-main/` | Nested copy. Its backend uses `backend/app/ai_agent.py` and does not include the root `auth` and `dataset` routers (its `main.py` import list). |

## Database objects

Views: none. Procedures: none. Detail: `docs/DATABASE_SCHEMA.md`.

| Database | Tables |
| :--- | :--- |
| `backend/data/ets_auth.db` | `users`, `password_reset_tokens` |
| In-memory `file:ets_memdb` | `employees`, `skills`, `leaves`, `finance_history` |
| `backend/data/rag_index.db` | `rag_documents`, `rag_chunks` |
| Excel `templates/Infinite_ETS_India_Workforce.xlsx` | Sheets include People, Skills, Leave, Work model, Training, AI release outcomes, AI utilization, AI tools catalog, AI targets, Cursor billing. Pay is `templates/Infinite_ETS_India_Compensation.xlsx` (Current pay, Pay history). Legacy sheets `EMPLOYEES`, `SKILL`, `Finance_History`, `LEAVE` still load. AI sheets load into `df_ai_utilization` / `df_ai_outcomes` / `df_cursor_billing` / `ai_targets` and power tab `ai_utilization`. |
| `templates/_build_india_template.py` / `_add_ai_utilization_sheets.py` / `_sync_ai_intake_to_master.py` | Build or patch the AI utilization sheets and Lists dropdowns; roll `AI_Team_Intake.xlsx` into the master without replacing People data when patching. |

## External integrations

| Integration | Module | Required to boot |
| :--- | :--- | :--- |
| Excel workbook on disk | `backend/app/data_loader.py` | Yes for import to succeed. File not in the workspace. |
| Ollama `http://localhost:11434` | `backend/app/ai/ollama_client.py` (`/api/tags`, `/api/generate`), `backend/app/ai/embedding_engine.py` (`/api/embeddings`) | No for Uvicorn if document sync errors are swallowed in `SemanticRAG._ensure_indexed`. Yes for copilot generation and for embedding when documents change. |
| OneDrive / SharePoint URL | `backend/app/routers/dataset.py` via `requests` | No. Only `POST /api/dataset/test-url` and `POST /api/dataset/sync-cloud`. |

No SMTP, OAuth, LDAP, SAML, or external SQL server client was found in the backend modules read for this map.

## Interaction maps

### Dashboard tab

```text
Header.tsx (tab id)
  -> App.tsx loadActiveTabData
    -> api/client.ts GET /api/<tab>
      -> routers/*.py
        -> analytics.py
          -> data_loader pandas frames
```

Compensation also calls both `/api/salarywise/kpis` and `/api/salarywise2/kpis`, and `security.require_roles` runs before `analytics`.

### Login

```text
Login.tsx
  -> authService.ts POST /api/auth/login
    -> routers/auth.py
      -> auth_db.py (users)
      -> security.py (bcrypt, JWT)
  -> localStorage
  -> AuthContext
  -> ProtectedRoute
  -> DashboardView
```

### Copilot

```text
AICopilotDrawer.tsx
  -> api/client.ts POST /api/copilot/query
    -> routers/copilot.py (optional JWT -> auth_db user)
      -> ai/orchestrator.py
        -> ai/security_context.py
        -> ai/db.py (memory SQLite)
        -> ai/semantic_rag.py -> vector_store.py + documents
        -> ai/ollama_client.py (when a model call is made)
```

### Dataset replace

```text
DatasetOperationsModal.tsx
  -> api/client.ts /api/dataset/*
    -> routers/dataset.py
      -> Excel file + dump/backups + dump/dataset_config.json
      -> data_loader.reload_all()
           -> pandas reload
           -> ai/db.py _populate_tables()
```

### What does not call the nested app

```text
start_backend.bat ---- backend.app.main:app (root)
start_frontend.bat --- frontend/ (root)
run_dashboard.bat ---- same two trees, different backend port

ETS-Enterprise-main/start_*.bat ---- ETS-Enterprise-main only
```
