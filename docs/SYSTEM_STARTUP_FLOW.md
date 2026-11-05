# ETS Workforce Dashboard — System Startup Flow

Canonical startup document for this workspace. `docs/STARTUP_GUIDE.md` remains as a companion and points here.

Workspace root:

`C:\Users\peernayakgarib\OneDrive - Infinite Computer Solutions (India) Limited\Documents\ETS_AI_Projects\ETS-Workspace-Dashboard-main\ETS-Workspace-Dashboard-main`

Nothing in this document was executed. Commands are copied from scripts and `frontend/package.json`.

## FRONTEND ENTRY POINT

| Piece | Path | What it does |
| :--- | :--- | :--- |
| HTML shell | `frontend/index.html` | `<div id="root">` and `<script type="module" src="/src/main.tsx">`. Title `ETS Workforce`. |
| Bootstrap | `frontend/src/main.tsx` | Imports `frontend/src/index.css` and `App`. `createRoot(document.getElementById('root')).render` wraps `App` in `StrictMode`. |
| Application | `frontend/src/App.tsx` | `BrowserRouter`, `AuthProvider`, route table. |
| Dev server | `frontend/vite.config.ts` | `server.port` `42005`, `server.host` `0.0.0.0`, proxy `/api` → `http://127.0.0.1:42006`. |
| npm script | `frontend/package.json` | `dev` = `vite`. |

There is no `frontend/src/index.tsx`. Route registration is the `<Routes>` block in `frontend/src/App.tsx`, not a separate router module.

| Path | Element |
| :--- | :--- |
| `/login` | lazy `Login` |
| `/signup` | lazy `SignUp` |
| `/forgot-password` | lazy `ForgotPassword` |
| `/reset-password` | same `ForgotPassword` |
| `/dashboard` | `ProtectedRoute` → `DashboardView` |
| `/` | `Navigate` to `/dashboard` |
| `*` | `Navigate` to `/dashboard` |

Tab components are `React.lazy` imports in `frontend/src/App.tsx`. They are not URL routes. The active tab is React state (`activeTab`), optionally synced from the `tab` search param (see `useSearchParams` in `DashboardView`).

### How the frontend process is started

`start_frontend.bat` (repository root):

```bat
cd /d "%~dp0frontend"
npm run dev -- --host 0.0.0.0 --port 42005
```

`run_dashboard.bat` starts `npm run dev` in `frontend/` with no `--port`. Vite then uses `frontend/vite.config.ts` port `42005`. The echo lines print `http://localhost:3036`. That URL is not set in `vite.config.ts`.

`README.md` says the UI is `http://localhost:3036`. The Vite config port is `42005`.

`npm run preview` and `npm run build` are not called by the `.bat` files.

## BACKEND ENTRY POINT

| Piece | Path |
| :--- | :--- |
| ASGI application | `backend/app/main.py` — `app = FastAPI(...)` |
| Uvicorn import | `backend.app.main:app` |
| Script entry | `if __name__ == "__main__"` in `backend/app/main.py` calls `uvicorn.run("backend.app.main:app", host="127.0.0.1", port=42006, reload=True)` |

`start_backend.bat`:

```bat
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 42006 --reload
```

`run_dashboard.bat` and `README.md` use the same module with `--port 8000`.

There is no `server.js`, `app.js`, or `manage.py` at the repository root. Checked by reading the root launcher files and `backend/app/main.py`.

### Server init

`FastAPI(...)` in `backend/app/main.py` sets title `ETS Employee Dashboard & Workforce Intelligence API`, version `2.0.0`, `docs_url="/docs"`, `redoc_url="/redoc"`, `openapi_url="/openapi.json"`.

### Middleware

One middleware: `CORSMiddleware` added with `ALLOWED_ORIGINS` in `backend/app/main.py` (ports `42005`, `5173`, `3000` on localhost and `127.0.0.1`). No other `add_middleware` call.

### Route registration

`app.include_router` order in `backend/app/main.py`:

1. `auth.router` — prefix `/api/auth` (`backend/app/routers/auth.py`)
2. `home.router` — `/api/home`
3. `statewise.router` — `/api/statewise`
4. `employee_details.router` — `/api/employee`
5. `techwise.router` — `/api/techwise`
6. `salarywise.router` — `/api/salarywise`
7. `salarywise2.router` — `/api/salarywise2`
8. `calendar_leave.router` — `/api/calendar`
9. `copilot.router` — `/api/copilot`
10. `dataset.router` — `/api/dataset`

Routes declared on `app` itself:

- `GET /api/health`
- `POST /api/reload`

There is no `lifespan` function and no `@app.on_event("startup")`.

### Not the API server

| Path | What it is |
| :--- | :--- |
| `scripts/run_harness.py` | Copilot evaluation harness |
| `tests/` | Test modules. Not referenced by root `.bat` files |
| `ETS-Enterprise-main/backend/app/main.py` | Nested FastAPI module. Root `start_backend.bat` does not import it |
| `ETS-Enterprise-main/start_backend.bat` | Nested launcher. It runs Uvicorn on port `8000` |

## CONFIGURATION FILES

No configuration framework loads a file at boot. No `.env` loader.

| Order applied at import | What | File |
| :--- | :--- | :--- |
| 1 | Excel path: `templates/Infinite_ETS_India_Workforce.xlsx` and `templates/Infinite_ETS_India_Compensation.xlsx`, else `ETS_Dasboard_DS.xlsx` | `backend/app/data_loader.py` `DataLoader.__init__` |
| 2 | Auth DB path `backend/data/ets_auth.db` | `backend/app/auth_db.py` `DB_PATH` |
| 3 | Memory SQLite URI `file:ets_memdb?mode=memory&cache=shared` | `backend/app/ai/db.py` |
| 4 | JWT algorithm `HS256`, expiry 24 hours, `ETS_JWT_SECRET` or hardcoded fallback | `backend/app/security.py` at import |
| 5 | `ETS_USE_SEMANTIC_ENGINE` | `backend/app/ai/orchestrator.py` at import |
| 6 | CORS list and FastAPI metadata | `backend/app/main.py` |
| 7 | Listen host and port | Uvicorn command line, or the `__main__` block |
| 8 | Frontend host, port, proxy | `frontend/vite.config.ts`, plus flags from `start_frontend.bat` |
| 9 | Dataset cloud JSON | Not at boot. `backend/app/routers/dataset.py` `_get_active_config` reads `dump/dataset_config.json` when a dataset route calls it. Missing file returns `source_type` `LOCAL_EXCEL`, `cloud_url` null, `auto_sync_enabled` false, `sync_cadence` `MANUAL`. |

Ollama base URL is the literal `http://localhost:11434` in `backend/app/ai/ollama_client.py`. Model name environment variables in `backend/app/ai/model_gateway.py` are read when a property is used, not when FastAPI is constructed.

Other config files that do not run at API boot:

| File | Role |
| :--- | :--- |
| `frontend/package.json` | npm scripts |
| `frontend/package-lock.json` | npm lockfile |
| `frontend/tsconfig.json` | references `tsconfig.app.json` and `tsconfig.node.json` |
| `frontend/tailwind.config.js` | Tailwind theme |
| `frontend/postcss.config.js` | PostCSS |
| `frontend/.oxlintrc.json` | Oxlint |
| `backend/requirements.txt` | pip minimums (incomplete versus imports) |
| `.vscode/settings.json` | editor setting only |

The `.bat` files do not `set` environment variables.

## DATABASE INITIALIZATION

### Workforce Excel — not a database server

- File: `backend/app/data_loader.py`
- When: `data_loader = DataLoader()` at the bottom of that module, which calls `load_data()`
- Sheets: `EMPLOYEES` (`skiprows=2`), `SKILL`, `Finance_History`, `LEAVE` (`skiprows=2`)
- Workspace search found no `.xlsx`. If the workbook is missing, import of `data_loader` fails and Uvicorn does not finish loading `backend.app.main`.

`data_loader` is imported by `backend/app/analytics.py` and `backend/app/ai/db.py`. `main.py` imports every router, including modules that import `analytics` and the copilot stack, so this load is on the API import path.

### Authentication SQLite — on disk

- File: `backend/app/auth_db.py`
- Path: `backend/data/ets_auth.db` (`DB_PATH` is `backend/data` relative to the `backend` package directory)
- When: last line of `auth_db.py` calls `init_auth_db()`
- Trigger: `backend/app/routers/auth.py` imports `auth_db`, and `main.py` imports that router
- Connection: `sqlite3.connect(DB_PATH, check_same_thread=False)` inside `get_db_connection()`, per call. `PRAGMA foreign_keys = ON`.
- Schema: `CREATE TABLE IF NOT EXISTS users` and `password_reset_tokens`. If `SELECT COUNT(*) FROM users` is `0`, five baseline rows are inserted.

There is no connection-string environment variable and no Postgres.

### Analytical SQLite — in memory

- File: `backend/app/ai/db.py`
- When: `sqlite_engine = SQLiteEngine()` at import
- Import chain during API startup: `backend/app/routers/copilot.py` → `backend/app/ai/orchestrator.py` → `backend/app/ai/db.py`
- URI: `file:ets_memdb?mode=memory&cache=shared`
- Population: `_populate_tables()` writes `employees`, `skills`, `leaves`, `finance_history` with pandas `to_sql(..., if_exists="replace")`, then creates indexes
- Lifetime: process memory. Not a file. Does not survive process exit.

`db.py` imports `data_loader` first, so the Excel load runs before the memory tables are filled.

### RAG index — on disk

- File: `backend/app/ai/vector_store.py`
- Default path: `backend/data/rag_index.db` (`DEFAULT_DB_PATH`)
- When: `vector_store = SQLiteVectorStore()` at the bottom of `backend/app/ai/vector_store.py`. Import chain: `copilot.py` → `orchestrator.py` → `backend/app/ai/tools.py` → `backend/app/ai/semantic_rag.py` → `vector_store`. `semantic_rag.py` also assigns `semantic_rag = SemanticRAG()` at module level. `document_indexer.py` assigns `document_indexer = DocumentIndexer()`.
- Tables: `rag_documents`, `rag_chunks`
- Document sync: `semantic_rag.py` constructs `SemanticRAG()`, whose `__init__` calls `_ensure_indexed()` → `document_indexer.sync_documents()` on `backend/data/documents/`. Changed markdown is embedded via `backend/app/ai/embedding_engine.py` at `http://localhost:11434/api/embeddings`. `_ensure_indexed` logs failures and does not re-raise, so a down Ollama does not by itself abort Uvicorn import.

### What `POST /api/reload` does after boot

`POST /api/reload` in `backend/app/main.py` calls `data_loader.load_data()` only. It does not call `sqlite_engine._populate_tables()`.

`reload_all()` in `backend/app/data_loader.py` calls `load_data()`, then `sqlite_engine._populate_tables()`, and clears `EntityNormalizer` caches. Dataset upload and cloud sync call `reload_all()`.

## AUTHENTICATION INITIALIZATION

Authentication storage is initialized by import, not by a login request.

1. Uvicorn imports `backend.app.main`.
2. `main.py` imports `backend.app.routers.auth`.
3. `auth.py` imports `backend.app.auth_db`.
4. `auth_db.py` calls `init_auth_db()`.
5. Tables are created if missing. Empty `users` is seeded.

`backend/app/security.py` does not open a database at import. Tokens are created later in `POST /api/auth/login` (`create_access_token`).

### Browser authentication after the UI loads

1. `frontend/src/main.tsx` renders `App`.
2. `AuthProvider` (`frontend/src/context/AuthContext.tsx`) initializes from `localStorage` via `frontend/src/services/authService.ts`.
3. On mount, `refreshUser()` runs. No token: user state cleared. Token present: `GET /api/auth/me`. Failure clears storage.
4. `ProtectedRoute` redirects unauthenticated `/dashboard` visitors to `/login`.
5. Login stores `access_token` and `user` from `POST /api/auth/login`.

There is no server session cookie. The token is a bearer JWT in `localStorage`.

## ENVIRONMENT VARIABLE LOADING

There is no environment file loader.

Checked in this pass and in `docs/ENVIRONMENT_REQUIREMENTS.md`:

- No `.env`, `.env.example`, `.env.local`, or `.env.sample` (glob for those names returned none).
- No `load_dotenv` under `backend/`.
- `backend/requirements.txt` does not list `python-dotenv`.
- `frontend/src` does not read `import.meta.env` or `VITE_` variables.

| Variable | File | When |
| :--- | :--- | :--- |
| `ETS_JWT_SECRET` | `backend/app/security.py` | Import |
| `ETS_USE_SEMANTIC_ENGINE` | `backend/app/ai/orchestrator.py` | Import (copilot router during API startup) |
| `ETS_RAG_MODEL`, `ETS_LOCAL_RAG_MODEL`, `ETS_SQL_MODEL`, `ETS_LOCAL_SQL_MODEL`, `ETS_EMBED_MODEL`, `ETS_LOCAL_EMBED_MODEL`, `ETS_REASONING_MODEL`, `ETS_LOCAL_REASONING_MODEL`, `ETS_VERIFIER_MODEL` | `backend/app/ai/model_gateway.py` | When a `ModelGateway` property is accessed |

If unset, the default in that source file is used.

## ORDERED STARTUP SEQUENCE

```text
Excel file ETS_Dasboard_DS.xlsx
        |
        v
pandas DataFrames          backend/app/data_loader.py
        |
        +--> auth SQLite file backend/data/ets_auth.db
        |         backend/app/auth_db.py  (users, reset tokens)
        |
        +--> in-memory SQLite file:ets_memdb
        |         backend/app/ai/db.py
        |
        +--> RAG file backend/data/rag_index.db
                  backend/app/ai/vector_store.py
                  (document embed calls Ollama only if index sync needs it)
        |
        v
FastAPI app + CORS + routers     backend/app/main.py
        |
        v
Uvicorn listening
  start_backend.bat -> 127.0.0.1:42006
  run_dashboard.bat / README -> 127.0.0.1:8000
        |
        v
Vite dev server                  frontend/vite.config.ts :42005
  proxies /api -> 127.0.0.1:42006
        |
        v
Browser loads frontend/index.html -> src/main.tsx -> src/App.tsx
        |
        v
AuthProvider -> GET /api/auth/me if a token is stored
        |
        v
User login POST /api/auth/login -> JWT in localStorage
        |
        v
ProtectedRoute allows /dashboard
        |
        v
Dashboard tabs call /api/* through frontend/src/api/client.ts
```

Text form of the same chain:

```text
Database (Excel + SQLite init at import)
  -> Backend (Uvicorn / FastAPI)
  -> Authentication (ets_auth.db already created; login issues JWT)
  -> API Layer (routers)
  -> Frontend (Vite + React)
  -> User Login
  -> Dashboard
```

Layers that do **not** exist, and what was checked:

| Missing layer | Files checked |
| :--- | :--- |
| `.env` loader | No `.env*`. No `load_dotenv` in `backend/`. |
| External SQL server | No connection URL in `backend/app/main.py`, `auth_db.py`, or `ai/db.py`. |
| Docker / process manager | No `Dockerfile`, `docker-compose`, `Procfile`. |
| FastAPI lifespan hook | `backend/app/main.py` has none. |
| Second frontend bootstrap | No `frontend/src/index.tsx`. |
| Automatic Ollama process | Not launched by `main.py` or the root `.bat` files. |
| Production static host | `frontend/package.json` has `preview` = `vite preview`. No other host script. |

## PATHS

### Path A — `start_backend.bat` and `start_frontend.bat`

These match `frontend/vite.config.ts` and `backend/app/main.py`.

1. From the repository root, `start_backend.bat` runs Uvicorn on `127.0.0.1:42006` with reload.
2. Import-time bootstrap: Excel load, auth SQLite, in-memory SQLite, RAG store, router registration.
3. `start_frontend.bat` runs Vite on `0.0.0.0:42005`.
4. Browser loads `frontend/src/main.tsx`.
5. Stored tokens are checked with `GET /api/auth/me` through the proxy.
6. Unauthenticated users hitting `/` go to `/dashboard`, then `ProtectedRoute` sends them to `/login`.

### Path B — `run_dashboard.bat`

1. New `cmd` window: Uvicorn on `127.0.0.1:8000`.
2. `timeout /t 2`.
3. Second window: `npm run dev` in `frontend/` with no port flag (Vite uses `42005`).
4. Proxy target remains `127.0.0.1:42006`.

The frontend started by this script proxies to a port the backend started by this script is not using. Printed URLs (`3036` and `8000`) match neither `frontend/vite.config.ts` nor the proxy target.

### Path C — `python` executing `backend/app/main.py`

`__main__` starts Uvicorn on `127.0.0.1:42006` with reload. Working directory must be the repository root so `backend.app` imports resolve. The `.bat` files do not set `PYTHONPATH`.

### Path D — `README.md` method A

Backend port `8000`, `npm run dev`, printed UI `http://localhost:3036`. Same proxy mismatch as Path B, plus a printed UI port that `frontend/vite.config.ts` does not use.

## LOCAL EXECUTION PREREQUISITES (NOT RUN)

Software and versions: `docs/ENVIRONMENT_REQUIREMENTS.md` and `docs/DEPLOYMENT_STEPS.md`.

| Requirement | Version in repo | Needed for |
| :--- | :--- | :--- |
| `python` on `PATH` | Unspecified. No pin in `backend/requirements.txt` | API |
| Packages in `backend/requirements.txt` | Minimum `>=` versions | Part of the API import |
| `bcrypt`, `jwt`, `sqlglot`, `requests` | Not in `requirements.txt`. Versions unspecified | Imports in `security.py`, `auth_db.py`, `ai/`, `routers/dataset.py` |
| Node.js and npm | Unspecified. No `engines` in `frontend/package.json`. `README.md` prose says Node 18+ | Frontend |
| `ETS_Dasboard_DS.xlsx` at repo root | File absent from workspace search | `DataLoader.load_data` |
| Windows `cmd` | Batch syntax | The `.bat` launchers only |

Install commands that exist, from `README.md` only:

```powershell
pip install -r backend/requirements.txt
```

```powershell
cd frontend
npm install
cd ..
```

There is no root install script. The pip command does not install the four undeclared imports.

Environment setup: none required for process start, because every `os.getenv` has a default. No `.env` file is read.

Database setup: no manual DDL step. `init_auth_db()` and `SQLiteEngine._init_database()` run on import. The Excel file must already be at the loader path.

Backend start (proxy-aligned): `start_backend.bat` from the repository root.

Frontend start (proxy-aligned): `start_frontend.bat` from the repository root.

Verification steps present in code and scripts (not executed here):

- Backend health handler returns JSON `status`, `service`, `version`, `docs_url` from `GET /api/health` in `backend/app/main.py`. For Path A the listen address is `http://127.0.0.1:42006`.
- OpenAPI UI is `docs_url` `/docs` on that same host.
- Path A UI URL printed by `start_frontend.bat` is port `42005` (`http://localhost:42005`). The script itself does not print the URL; the echo line says “Starting React Frontend on port 42005”.
- `GET /api/health` does not check the workbook, SQLite, or Ollama.

Ollama, email delivery, and `ETS-Enterprise-main/` do not start with the root launchers.
