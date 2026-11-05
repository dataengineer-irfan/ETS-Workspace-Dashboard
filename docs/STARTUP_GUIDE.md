# ETS Workforce Dashboard — Startup Guide

Canonical startup sequence: [SYSTEM_STARTUP_FLOW.md](SYSTEM_STARTUP_FLOW.md).

This guide lists every startup path that exists in the repository and the order in which code runs. Commands are copied from scripts and `package.json`. Ports that disagree between files are listed as written in each file.

Workspace root:

`C:\Users\peernayakgarib\OneDrive - Infinite Computer Solutions (India) Limited\Documents\ETS_AI_Projects\ETS-Workspace-Dashboard-main\ETS-Workspace-Dashboard-main`

## Frontend Startup File(s)

| Role | Path |
| :--- | :--- |
| HTML shell | `frontend/index.html` |
| Module loaded by the shell | `/src/main.tsx` (script tag in `frontend/index.html`) |
| React mount | `frontend/src/main.tsx` |
| Application component | `frontend/src/App.tsx` |
| Dev server config | `frontend/vite.config.ts` |
| npm scripts | `frontend/package.json` |

`frontend/src/main.tsx` calls `createRoot` on `#root` and renders `App` from `frontend/src/App.tsx` inside `StrictMode`. It also imports `frontend/src/index.css`.

There is no second frontend entry such as `src/index.tsx`.

### How the frontend process is started

From `frontend/package.json`, script `dev` is `vite`.

`start_frontend.bat` (repository root):

```bat
cd /d "%~dp0frontend"
npm run dev -- --host 0.0.0.0 --port 42005
```

`frontend/vite.config.ts` also sets `server.port` to `42005` and `server.host` to `0.0.0.0`. The dev server proxies `/api` to `http://127.0.0.1:42006`.

`run_dashboard.bat` starts the frontend with:

```bat
cd /d "%~dp0frontend" && npm run dev
```

That script does not pass `--port`. Vite then uses `frontend/vite.config.ts`, so the listen port is `42005`. The echo lines in `run_dashboard.bat` print `http://localhost:3036`. That printed URL does not match `frontend/vite.config.ts`.

`README.md` tells the operator to run `npm run dev` from `frontend/` and states the UI is at `http://localhost:3036`. The Vite config port is `42005`.

`npm run preview` serves a production build. `npm run build` is `tsc -b && vite build`. Neither script is called by the `.bat` launchers.

## Backend Startup File(s)

| Role | Path |
| :--- | :--- |
| ASGI application | `backend/app/main.py` (`app = FastAPI(...)`) |
| Import path used by Uvicorn | `backend.app.main:app` |
| Direct execution block | `backend/app/main.py` bottom: `if __name__ == "__main__"` |

`start_backend.bat`:

```bat
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 42006 --reload
```

`backend/app/main.py` `__main__` block:

```python
uvicorn.run("backend.app.main:app", host="127.0.0.1", port=42006, reload=True)
```

`run_dashboard.bat` starts:

```bat
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

`README.md` uses the same port `8000` command. The Vite proxy target in `frontend/vite.config.ts` is port `42006`, not `8000`. A backend started only from `run_dashboard.bat` or from the README command listens on `8000` and is not the port the Vite proxy calls.

There is no `server.js`, `app.js`, or `manage.py`.

### Not application servers

| Path | What it is |
| :--- | :--- |
| `scripts/run_harness.py` | Copilot evaluation harness. Usage comments at the top of that file. It is not Uvicorn. |
| `tests/` | Test modules. Not referenced by the `.bat` launchers. |
| `ETS-Enterprise-main/backend/app/main.py` | FastAPI module inside a nested tree. Root `start_backend.bat` does not start it. Its import list does not include the root app's `auth` or `dataset` routers. |
| `ETS-Enterprise-main/start_backend.bat` | Launcher for that nested tree only. |

## API Startup Sequence

When Uvicorn loads `backend.app.main:app`, Python executes `backend/app/main.py` from top to bottom.

1. `backend/app/main.py` imports routers: `home`, `statewise`, `employee_details`, `techwise`, `salarywise`, `salarywise2`, `calendar_leave`, `copilot`, `auth`, `dataset`.
2. Those imports pull in `backend/app/data_loader.py`. The module assigns `data_loader = DataLoader()`, which calls `load_data()` and reads the Excel workbook before the FastAPI object exists.
3. Importing `backend/app/routers/auth.py` imports `backend/app/auth_db.py`. The last line of `auth_db.py` calls `init_auth_db()`, which creates `backend/data/ets_auth.db` and the `users` and `password_reset_tokens` tables if needed, and seeds five users when `users` is empty.
4. Importing `backend/app/routers/copilot.py` imports `llm_orchestrator` from `backend/app/ai/orchestrator.py`. That module imports `backend/app/ai/db.py` (`sqlite_engine`) and `backend/app/ai/tools.py`. `tools.py` imports `backend/app/ai/semantic_rag.py`, which imports `backend/app/ai/vector_store.py` and constructs `SemanticRAG()`. `SQLiteEngine.__init__` opens the in-memory database and copies pandas frames into tables `employees`, `skills`, `leaves`, and `finance_history`. `SQLiteVectorStore()` creates `backend/data/rag_index.db`. `SemanticRAG.__init__` calls `DocumentIndexer.sync_documents()` on `backend/data/documents/`. New or changed markdown is embedded through Ollama. If that sync raises, `SemanticRAG._ensure_indexed` logs the error and does not re-raise, so the API import continues.
5. `FastAPI` is constructed with title `ETS Employee Dashboard & Workforce Intelligence API`, version `2.0.0`, `docs_url="/docs"`, `redoc_url="/redoc"`, `openapi_url="/openapi.json"`.
6. `CORSMiddleware` is added with the origin list in `backend/app/main.py`.
7. Routers are registered with `app.include_router` in this order: auth, home, statewise, employee_details, techwise, salarywise, salarywise2, calendar_leave, copilot, dataset.
8. Routes defined on `app` itself: `GET /api/health`, `POST /api/reload`.

There is no FastAPI `lifespan` or `@app.on_event("startup")` function in `backend/app/main.py`. Work that looks like startup runs at import time, as listed above.

After the process is listening, `GET /api/health` returns JSON `status`, `service`, `version`, and `docs_url`. It does not check the workbook, SQLite, or Ollama.

## Configuration Loading Sequence

No configuration framework loads a file at boot. Settings that exist are constants in source files:

| Order | What is applied | File |
| :--- | :--- | :--- |
| 1 | Excel path: `templates/Infinite_ETS_India_Workforce.xlsx` plus `templates/Infinite_ETS_India_Compensation.xlsx`, else repository root `ETS_Dasboard_DS.xlsx` | `backend/app/data_loader.py` `DataLoader.__init__` |
| 2 | Auth database path `backend/data/ets_auth.db` | `backend/app/auth_db.py` |
| 3 | In-memory SQLite URI `file:ets_memdb?mode=memory&cache=shared` | `backend/app/ai/db.py` |
| 4 | JWT algorithm, expiry, and `ETS_JWT_SECRET` (or the hardcoded fallback) | `backend/app/security.py` (read when the module is imported) |
| 5 | `ETS_USE_SEMANTIC_ENGINE` | `backend/app/ai/orchestrator.py` (read when the module is imported) |
| 6 | CORS origins, FastAPI metadata | `backend/app/main.py` |
| 7 | Listen host and port | The Uvicorn command line, or the `__main__` block if `main.py` is executed as a script |
| 8 | Frontend port, host, and `/api` proxy | `frontend/vite.config.ts`, overridden when `start_frontend.bat` passes `--port 42005` |
| 9 | Dataset cloud settings | Not loaded at boot. `backend/app/routers/dataset.py` reads `dump/dataset_config.json` when a dataset endpoint calls `_get_active_config`. If the file is missing, the function returns an in-memory default: `source_type` `LOCAL_EXCEL`, `cloud_url` null, `auto_sync_enabled` false, `sync_cadence` `MANUAL`. |

Ollama model names in `backend/app/ai/model_gateway.py` are read with `os.getenv` when the corresponding property is used, not during FastAPI construction.

Ollama base URL is the literal `http://localhost:11434` in `backend/app/ai/ollama_client.py`. It is not loaded from a config file.

## Environment Variable Loading Process

There is no environment file loader.

Checked:

- No `.env`, `.env.example`, `.env.local`, or similar file in the workspace search.
- No `load_dotenv` or `python-dotenv` usage under `backend/`.
- `backend/requirements.txt` does not list `python-dotenv`.
- `frontend/src` does not read `import.meta.env` or `VITE_` variables.
- `frontend/src/vite-env.d.ts` contains only the Vite client reference and a CSS module declaration.

Process environment is read only here:

| Variable | File | When |
| :--- | :--- | :--- |
| `ETS_JWT_SECRET` | `backend/app/security.py` | Import of `security.py` |
| `ETS_USE_SEMANTIC_ENGINE` | `backend/app/ai/orchestrator.py` | Import of `orchestrator.py` (via the copilot router during API startup) |
| `ETS_RAG_MODEL`, `ETS_LOCAL_RAG_MODEL`, `ETS_SQL_MODEL`, `ETS_LOCAL_SQL_MODEL`, `ETS_EMBED_MODEL`, `ETS_LOCAL_EMBED_MODEL`, `ETS_REASONING_MODEL`, `ETS_LOCAL_REASONING_MODEL`, `ETS_VERIFIER_MODEL` | `backend/app/ai/model_gateway.py` | When a `ModelGateway` property is accessed |

If a variable is unset, the default in that source file is used. Details are in `docs/ENVIRONMENT_REQUIREMENTS.md`.

The `.bat` files do not `set` any of these variables.

## Authentication Initialization Process

Authentication storage is initialized by import, not by a login request.

1. Uvicorn imports `backend.app.main`.
2. `main.py` imports `backend.app.routers.auth`.
3. `auth.py` imports `backend.app.auth_db`.
4. `auth_db.py` calls `init_auth_db()`.
5. `init_auth_db()` creates the directory for `backend/data/ets_auth.db`, opens SQLite, creates `users` and `password_reset_tokens` if they do not exist, and, if `SELECT COUNT(*) FROM users` is `0`, inserts the five baseline accounts defined in that function.

JWT code in `backend/app/security.py` does not connect to a database at import. Tokens are created later in `POST /api/auth/login`.

### Browser authentication startup

1. `frontend/src/main.tsx` renders `App`.
2. `frontend/src/App.tsx` wraps routes in `BrowserRouter` and `AuthProvider`.
3. `AuthProvider` in `frontend/src/context/AuthContext.tsx` initializes React state from `localStorage` (`ets_auth_token`, `ets_auth_user`) via `frontend/src/services/authService.ts`.
4. On mount, `refreshUser()` runs. If no token is stored, user state is cleared and loading ends. If a token is stored, the client calls `GET /api/auth/me`. Failure clears storage and user state.
5. `ProtectedRoute` (`frontend/src/components/auth/ProtectedRoute.tsx`) sends unauthenticated visitors from `/dashboard` to `/login`.
6. Login posts to `/api/auth/login` through `authService.login` and stores the returned `access_token` and `user`.

There is no server-side session cookie. The token is a bearer JWT kept in `localStorage`.

## Database Connection Initialization

### Authentication database — file SQLite

- File: `backend/app/auth_db.py`
- Path: `backend/data/ets_auth.db`
- When: import of `auth_db.py` during API startup (see above)
- Connection: `sqlite3.connect(DB_PATH, check_same_thread=False)` inside `get_db_connection()`, opened per call and closed by the caller. `PRAGMA foreign_keys = ON` is set on each connection.

This is not Postgres. There is no connection string environment variable.

### Analytical database — in-memory SQLite

- File: `backend/app/ai/db.py`
- When: import of `db.py`, which happens because `orchestrator.py` is imported by `backend/app/routers/copilot.py` during API startup
- Connection: shared in-memory URI `file:ets_memdb?mode=memory&cache=shared`
- Population: `SQLiteEngine._populate_tables()` writes tables `employees`, `skills`, `leaves`, and `finance_history` (`to_sql` calls in `backend/app/ai/db.py`)

`backend/app/ai/db.py` imports `data_loader` first, so the Excel load runs before the memory database is filled.

### RAG index — file SQLite

- File: `backend/app/ai/vector_store.py`
- Default path: `backend/data/rag_index.db`
- When: import of `vector_store.py`, because the module assigns `vector_store = SQLiteVectorStore()`. During API startup that import happens through `copilot.py` → `orchestrator.py` → `tools.py` → `semantic_rag.py`.
- Document sync: `semantic_rag.py` assigns `semantic_rag = SemanticRAG()`, and `SemanticRAG.__init__` calls `_ensure_indexed()` → `document_indexer.sync_documents()`. Unchanged documents are skipped by content hash. Changed documents are embedded with `backend/app/ai/embedding_engine.py` against `http://localhost:11434/api/embeddings`. A failure is logged inside `_ensure_indexed` and is not raised to Uvicorn.

### Workforce data — not a database server

- File: `backend/app/data_loader.py`
- When: import, via `data_loader = DataLoader()`
- Source: `ETS_Dasboard_DS.xlsx`
- Sheets: `EMPLOYEES` (`skiprows=2`), `SKILL`, `Finance_History`, `LEAVE` (`skiprows=2`)

Workspace search found no `.xlsx` file. If the workbook is absent, `DataLoader.load_data` fails while Uvicorn is still importing `backend.app.main`, and the API process does not finish startup.

`POST /api/reload` (`backend/app/main.py`) calls `data_loader.load_data()` only. `reload_all()` (`backend/app/data_loader.py`) reads the workbook again and calls `sqlite_engine._populate_tables()`.

## Application Bootstrapping Flow

### Path A — `start_backend.bat` and `start_frontend.bat`

These two scripts match `frontend/vite.config.ts` and `backend/app/main.py`.

1. From the repository root, `start_backend.bat` runs Uvicorn on `127.0.0.1:42006` with reload, loading `backend.app.main:app`.
2. Import-time bootstrap runs: Excel load, auth SQLite init, in-memory SQLite projection, FastAPI router registration.
3. `start_frontend.bat` changes to `frontend/` and runs `npm run dev -- --host 0.0.0.0 --port 42005`.
4. Vite serves `frontend/index.html`.
5. The browser loads `frontend/src/main.tsx`, which renders `frontend/src/App.tsx`.
6. `AuthProvider` validates any stored token against `GET /api/auth/me` through the Vite proxy (`/api` → `http://127.0.0.1:42006`).
7. Unauthenticated users hitting `/` are redirected to `/dashboard`, then `ProtectedRoute` redirects them to `/login`.

### Path B — `run_dashboard.bat`

1. Opens a new `cmd` window running Uvicorn on `127.0.0.1:8000`.
2. Waits 2 seconds (`timeout /t 2`).
3. Opens a second `cmd` window running `npm run dev` in `frontend/` with no port argument.
4. Vite listens on `42005` because of `frontend/vite.config.ts`.
5. The proxy still targets `127.0.0.1:42006`.

The frontend started by this script proxies to a port the backend started by this script is not using. The echo text in the script (`3036` and `8000`) matches neither the Vite file nor the proxy target.

### Path C — `python` executing `backend/app/main.py`

The `__main__` block starts Uvicorn on `127.0.0.1:42006` with reload. Same application import as Path A. The working directory must be the repository root so that `backend.app` imports resolve. The `.bat` files do not set `PYTHONPATH`; they assume the current directory is the repository root.

### Path D — commands printed in `README.md`

`README.md` step 2 method A uses backend port `8000` and `npm run dev`, and states the UI URL as `http://localhost:3036`. That combination is the same port mismatch as Path B, plus a printed UI port that `frontend/vite.config.ts` does not use.

### What does not start automatically

- Ollama. Nothing in `main.py` or the `.bat` files launches it. `backend/app/ai/ollama_client.py` calls `http://localhost:11434` only when copilot code invokes the client.
- A production static file server for `frontend/dist`. No script in `frontend/package.json` or the root `.bat` files starts one after `npm run build`, other than the operator running `npm run preview`.
- Email delivery for password reset. The reset token is returned by `POST /api/auth/forgot-password`.
- The nested app under `ETS-Enterprise-main/`.
