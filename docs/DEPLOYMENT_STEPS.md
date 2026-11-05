# ETS Workforce Dashboard — Deployment Steps

There is no deployment pipeline in this repository. This file lists the build and run commands that exist in manifests, batch files, and `README.md`, and the files that were checked for a pipeline. Commands below were not executed.

Workspace root:

`C:\Users\peernayakgarib\OneDrive - Infinite Computer Solutions (India) Limited\Documents\ETS_AI_Projects\ETS-Workspace-Dashboard-main\ETS-Workspace-Dashboard-main`

## Pipeline check

| Looked for | Result |
| :--- | :--- |
| `Dockerfile` | Not found (glob under the workspace) |
| `docker-compose` / `docker-compose.yml` | Not found |
| `.github/workflows` | Not found. No `.github` directory in the search |
| `Procfile` | Not found |
| systemd unit or similar | Not found |
| `pyproject.toml`, `setup.py`, `setup.cfg` | Not found |
| Root `package.json` | Not found. npm scripts are only in `frontend/package.json` |
| Cloud deploy config (app yaml, terraform, k8s) | Not found in the file search used for this document |
| CI mentioned in `reports/production_readiness_audit.md` | That report recommends a CI gate. It is not a workflow file in `.github`. |

`ETS-Enterprise-main/` has its own `start_backend.bat`, `start_frontend.bat`, and `run_dashboard.bat`. Those scripts are for the nested tree. Root launchers do not call them. Nested `start_backend.bat` uses port `8000`.

## Environment setup

No `.env` file is loaded. See `docs/ENVIRONMENT_REQUIREMENTS.md`.

Process environment variables that the backend reads, all optional because source defaults exist:

| Name | File |
| :--- | :--- |
| `ETS_JWT_SECRET` | `backend/app/security.py` |
| `ETS_USE_SEMANTIC_ENGINE` | `backend/app/ai/orchestrator.py` |
| `ETS_RAG_MODEL`, `ETS_LOCAL_RAG_MODEL`, `ETS_SQL_MODEL`, `ETS_LOCAL_SQL_MODEL`, `ETS_EMBED_MODEL`, `ETS_LOCAL_EMBED_MODEL`, `ETS_REASONING_MODEL`, `ETS_LOCAL_REASONING_MODEL`, `ETS_VERIFIER_MODEL` | `backend/app/ai/model_gateway.py` |

The batch files do not set these. The frontend has no `VITE_` usage under `frontend/src`.

Ollama host is not an environment variable. It is `http://localhost:11434` in `backend/app/ai/ollama_client.py`.

## Software versions

| Software | Pin in this repo |
| :--- | :--- |
| Node.js | Unspecified. No `engines` in `frontend/package.json`. No `.nvmrc`. `README.md` prerequisites prose says “Node.js: Version 18 or higher (with npm)”. That sentence is not a manifest pin. |
| Python | Unspecified. `backend/requirements.txt` has no `python_requires`. No `.python-version`. `README.md` prose says “Python: Version 3.10 or higher”. `ARCHITECTURE.md` diagram text says Python 3.12. Neither is a pin. |
| Java | Not used. No `pom.xml` or Gradle file. |
| npm packages | Ranges in `frontend/package.json`. Lockfile `frontend/package-lock.json` (`lockfileVersion` 3). |
| Python packages | Minimum `>=` versions in `backend/requirements.txt`. No lockfile. |

`backend/requirements.txt` does not list `bcrypt`, `jwt` (PyJWT), `sqlglot`, or `requests`. Those modules are imported. There is no second requirements file that lists them.

## Install steps (from existing docs only)

`README.md` “Step 1: Install Dependencies” contains:

```powershell
pip install -r backend/requirements.txt
```

and:

```powershell
cd frontend
npm install
cd ..
```

Those are the only install commands found. They were not run for this document. `pip install -r backend/requirements.txt` does not install the four imports named above.

There is no `npm run` script that installs Python packages.

## Database setup

No manual database server setup.

On API import (`docs/SYSTEM_STARTUP_FLOW.md`):

1. `backend/app/data_loader.py` reads `ETS_Dasboard_DS.xlsx`. The file is not in the workspace. Import fails without it.
2. `backend/app/auth_db.py` creates `backend/data/ets_auth.db` and seeds `users` when the table is empty.
3. `backend/app/ai/db.py` creates the in-memory SQLite database from the pandas frames.
4. `backend/app/ai/vector_store.py` creates `backend/data/rag_index.db`.

Place the workbook at the repository root with the name `ETS_Dasboard_DS.xlsx` before starting Uvicorn. That is the first path `DataLoader.__init__` builds.

## Backend start

From the repository root, so `backend.app` imports resolve. The `.bat` files do not set `PYTHONPATH`.

Proxy-aligned (`start_backend.bat` and `backend/app/main.py` `__main__`):

```bat
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 42006 --reload
```

`run_dashboard.bat` and `README.md` instead use `--port 8000`. The Vite proxy target in `frontend/vite.config.ts` is `http://127.0.0.1:42006`, not `8000`.

## Frontend start

Proxy-aligned (`start_frontend.bat`):

```bat
cd /d "%~dp0frontend"
npm run dev -- --host 0.0.0.0 --port 42005
```

`frontend/package.json` script `dev` is `vite`. The host and port flags are added by the batch file. `frontend/vite.config.ts` also sets port `42005` and host `0.0.0.0`.

`run_dashboard.bat` runs `npm run dev` with no port flag and prints `http://localhost:3036`. Vite still uses port `42005` from the config file.

## Build commands (`frontend/package.json`)

| Script | Command | Called by root `.bat` files |
| :--- | :--- | :--- |
| `dev` | `vite` | Yes (`start_frontend.bat`, `run_dashboard.bat`) |
| `build` | `tsc -b && vite build` | No |
| `lint` | `oxlint` | No |
| `preview` | `vite preview` | No |

There is no `start` script. There is no backend compile step.

`frontend/vite.config.ts` `build.rollupOptions.output.manualChunks` splits chunks named `vendor-recharts`, `vendor-react`, `vendor-lucide`, and `vendor`. It does not set `build.outDir`. Vite’s default output directory is `dist` under the frontend project (`frontend/dist`). That directory is a build artifact, not a source folder checked into the description of the launchers.

## Packaging and deployment artifacts

| Artifact | How it is produced | How it is hosted |
| :--- | :--- | :--- |
| Frontend bundle | `npm run build` from `frontend/` | No server file in the repo hosts `frontend/dist`. `npm run preview` is `vite preview`. Preview port is not set in `package.json` or `vite.config.ts`. The port Vite uses for preview is UNKNOWN from this repo. |
| Backend | Python source. No wheel, no `setup.py`. | Uvicorn process from the commands above |
| Auth DB | Created at runtime | `backend/data/ets_auth.db` |
| RAG index | Created at runtime | `backend/data/rag_index.db` |
| Workbook backups | Dataset upload or cloud sync | `dump/backups/` |
| Dataset config | Dataset routes | `dump/dataset_config.json` |

No container image, no release script, and no static-file mount of `frontend/dist` inside `backend/app/main.py` (no `StaticFiles` import in that file).

## Verification steps (not executed)

For the proxy-aligned launchers:

1. Process listening from `start_backend.bat`: host `127.0.0.1`, port `42006`.
2. `GET /api/health` on that host returns `status`, `service`, `version`, `docs_url` as coded in `backend/app/main.py`. It does not check the workbook, SQLite, or Ollama.
3. OpenAPI UI path on that host: `/docs`.
4. Frontend from `start_frontend.bat`: port `42005`. Browser calls `/api`, which `frontend/vite.config.ts` proxies to `127.0.0.1:42006`.
5. Unauthenticated visit to `/` redirects to `/dashboard`, then `ProtectedRoute` redirects to `/login` (`frontend/src/App.tsx`, `frontend/src/components/auth/ProtectedRoute.tsx`).

`run_dashboard.bat` prints frontend `http://localhost:3036` and backend `http://127.0.0.1:8000`. Those printed URLs do not match `frontend/vite.config.ts`.

## Startup blocker

The API import reads `ETS_Dasboard_DS.xlsx`. The file is not in the workspace. Until that file is at the path in `backend/app/data_loader.py`, `python -m uvicorn backend.app.main:app` does not finish importing the application. Recommendation, not applied: obtain the workbook and place it at the repository root under that filename.
