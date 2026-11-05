# ETS Workforce Dashboard — Environment Requirements

Facts in this file come from manifests, config, and launcher scripts. Prose in `README.md` is quoted only where it is the sole version statement, and it is labeled as documentation rather than a pin.

Workspace root:

`C:\Users\peernayakgarib\OneDrive - Infinite Computer Solutions (India) Limited\Documents\ETS_AI_Projects\ETS-Workspace-Dashboard-main\ETS-Workspace-Dashboard-main`

## Required software

| Software | Evidence | Required for |
| :--- | :--- | :--- |
| The `python` command on `PATH`, able to run `python -m uvicorn` | `start_backend.bat`, `run_dashboard.bat`, `backend/app/main.py`. No version pin in `backend/requirements.txt`. | API process |
| Packages in `backend/requirements.txt` | `fastapi`, `uvicorn`, `pandas`, `openpyxl`, `numpy`, `pydantic` | API imports that those packages cover |
| Packages imported by code and now listed in `backend/requirements.txt` | `bcrypt` (`backend/app/security.py`, `backend/app/auth_db.py`), `jwt` via PyPI `PyJWT` (`backend/app/security.py`), `sqlglot` (`backend/app/ai/sql_governor.py`, `backend/app/ai/query_builder.py`, `backend/app/ai/orchestrator.py`), `requests` (`backend/app/routers/dataset.py`) | Those imports. Added to the manifest (unpinned). |
| Node.js with npm | `frontend/package.json` scripts; `start_frontend.bat` runs `npm run dev` | Frontend |
| npm packages locked by `frontend/package-lock.json` | lockfile present next to `frontend/package.json` | `npm install` in `frontend/` |
| Workbook `ETS_Dasboard_DS.xlsx` | Path built in `backend/app/data_loader.py` | API import. Workspace search found no `.xlsx` file. |
| Windows `cmd` | `start_backend.bat`, `start_frontend.bat`, `run_dashboard.bat` are `@echo off` batch files | Those launchers only |

Not required to boot the API, used when copilot embedding or generation runs:

| Software | Evidence |
| :--- | :--- |
| Ollama HTTP server | Literal `http://localhost:11434` in `backend/app/ai/ollama_client.py` and `http://localhost:11434/api/embeddings` in `backend/app/ai/embedding_engine.py` |

`SemanticRAG()` is constructed while the API imports the copilot stack (`backend/app/ai/semantic_rag.py`). Its constructor calls document sync. If Ollama is down, that sync error is caught and logged in `_ensure_indexed`. Dashboard routes do not call Ollama.

## Node version

Pinned to `>=18`.

`frontend/package.json` now has an `engines` field: `"node": ">=18"`. There is no `.nvmrc` and no `.node-version` in the workspace search.

`README.md` prerequisites say "Node.js: Version 18 or higher (with npm)". The `engines` pin matches that documented minimum. `frontend/package-lock.json` records `engines` on nested packages, not a Node version for this application.

## Java version

Not used.

Workspace search found no `pom.xml`, `build.gradle`, `build.gradle.kts`, or `.java` files.

## Python version

Pinned to `3.12` via `backend/.python-version`.

`backend/requirements.txt` has no `python_requires` line, and there is no `pyproject.toml`, `Pipfile`, or `runtime.txt`. `backend/.python-version` now contains `3.12` (a plain-text pin read by pyenv).

`README.md` prerequisites say "Python: Version 3.10 or higher". `ARCHITECTURE.md` section 2 labels the backend "Python 3.12" inside a diagram caption. The `.python-version` pin uses the more specific documented `3.12`.

## Package manager and lockfile

| Ecosystem | Manager | Lockfile | Manifest |
| :--- | :--- | :--- | :--- |
| Frontend | npm | `frontend/package-lock.json` (`lockfileVersion` 3, `"requires": true`) | `frontend/package.json` |
| Backend | pip, as written in `README.md` (`pip install -r backend/requirements.txt`) | None. No `poetry.lock`, `Pipfile.lock`, or `uv.lock`. | `backend/requirements.txt` (minimum versions with `>=`, not exact pins) |

No root `package.json`. No `pnpm-lock.yaml` and no `yarn.lock` at `frontend/`.

There is no npm script that installs Python packages, and no Python script that installs npm packages.

## OS assumptions

No OS field is declared in `frontend/package.json` or `backend/requirements.txt`.

What the repo does contain:

- Three Windows batch launchers at the repository root (`start_backend.bat`, `start_frontend.bat`, `run_dashboard.bat`).
- `README.md` install and run examples are PowerShell code fences.
- `scripts/run_harness.py` reconfigures stdout when `sys.platform` starts with `win`. That file is the evaluation harness, not the API.
- `backend/app/routers/dataset.py` sends a `User-Agent` string that includes `Windows NT 10.0`. That is an HTTP header on cloud-download requests, not an OS requirement for the host.

The Python and Node processes themselves are not limited to Windows by a config file. The `.bat` launchers are.

## Required environment variables

No variable is required for the process to start, because every `os.getenv` / `os.environ.get` call in the backend has a default in source.

There is no `.env` file and no `.env.example`. No `load_dotenv` call exists. The `.bat` files do not set variables. The frontend does not read `VITE_` or `import.meta.env` (`frontend/src/vite-env.d.ts` only references Vite client types).

| Name | Loaded in | Required | Default if unset |
| :--- | :--- | :--- | :--- |
| `ETS_JWT_SECRET` | `backend/app/security.py` at import | No | Hardcoded string literal in that file |
| `ETS_USE_SEMANTIC_ENGINE` | `backend/app/ai/orchestrator.py` at import | No | `true` (also treated as on for `1` and `yes`) |
| `ETS_RAG_MODEL` | `backend/app/ai/model_gateway.py` when the property is read | No | `granite3.1-dense:8b` |
| `ETS_LOCAL_RAG_MODEL` | same | No | `qwen2.5:3b` |
| `ETS_SQL_MODEL` | same | No | `qwen2.5-coder:7b` |
| `ETS_LOCAL_SQL_MODEL` | same | No | `qwen2.5-coder:3b` |
| `ETS_EMBED_MODEL` | same | No | `bge-large-en-v1.5` |
| `ETS_LOCAL_EMBED_MODEL` | same | No | `nomic-embed-text:latest` |
| `ETS_REASONING_MODEL` | same | No | `granite3.1-dense:8b` |
| `ETS_LOCAL_REASONING_MODEL` | same | No | `qwen2.5:3b` |
| `ETS_VERIFIER_MODEL` | same | No | `qwen2.5:1.5b`, otherwise the RAG model resolution |

Ollama's host and port are not environment variables. They are literals in `backend/app/ai/ollama_client.py` and `backend/app/ai/embedding_engine.py`.

Example env file: **missing**. Searched for `.env`, `.env.example`, `.env.local`, `.env.sample`. None were found.

## Optional vs required services

| Service | Required to start `backend.app.main:app` | Notes |
| :--- | :--- | :--- |
| Local Excel file `ETS_Dasboard_DS.xlsx` | Yes, for the import to succeed | `backend/app/data_loader.py`. File not found by workspace search. |
| SQLite (Python `sqlite3`) | Yes | Standard library. Auth file `backend/data/ets_auth.db` is created on import of `backend/app/auth_db.py`. In-memory DB is created on import of `backend/app/ai/db.py`. RAG file `backend/data/rag_index.db` is created on import of `backend/app/ai/vector_store.py`. |
| Ollama on port `11434` | No for Uvicorn to finish import if document sync fails closed | Sync runs at `SemanticRAG()` construction and swallows exceptions (`backend/app/ai/semantic_rag.py`). Generation calls later need the service. |
| OneDrive or SharePoint | No | Used only by `POST /api/dataset/test-url` and `POST /api/dataset/sync-cloud` in `backend/app/routers/dataset.py`. |
| SMTP / email | Not used | Password reset returns the token in the HTTP response (`backend/app/routers/auth.py`). |
| External SQL database | Not used | No connection URL in env or config. |

## How to install and start locally

Only commands that already exist in the repo are listed. There is no root install script.

### Install — from `README.md`

`README.md` "Step 1: Install Dependencies" contains:

```powershell
pip install -r backend/requirements.txt
```

and:

```powershell
cd frontend
npm install
cd ..
```

Those are the only install commands in the repository. `pip install -r backend/requirements.txt` now installs `bcrypt`, `PyJWT` (provides `import jwt`), `sqlglot`, and `requests`, because they were added to that file (unpinned).

### Start — scripts that match the Vite proxy

`start_backend.bat` (repository root):

```bat
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 42006 --reload
```

`start_frontend.bat` (repository root):

```bat
cd /d "%~dp0frontend"
npm run dev -- --host 0.0.0.0 --port 42005
```

`frontend/package.json` script invoked by that batch file:

| Script | Command |
| :--- | :--- |
| `dev` | `vite` |

The extra `-- --host 0.0.0.0 --port 42005` is appended by `start_frontend.bat`, not by `package.json`.

Equivalent direct block in `backend/app/main.py` (`if __name__ == "__main__"`): Uvicorn host `127.0.0.1`, port `42006`, reload `True`, app `backend.app.main:app`. Run from the repository root so the `backend` package imports. The file does not document a module invocation other than that `uvicorn.run` call.

### Start — `run_dashboard.bat` (ports differ)

`run_dashboard.bat` starts Uvicorn on `127.0.0.1` port `8000`, then `npm run dev` in `frontend/` with no port flag. It prints frontend `http://localhost:3036` and backend `http://127.0.0.1:8000`.

`frontend/vite.config.ts` sets the dev server port to `42005` and proxies `/api` to `http://127.0.0.1:42006`. The printed URLs in `run_dashboard.bat` do not match that file.

### Start — `README.md` method A

`README.md` prints:

```powershell
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

and, from `frontend/`:

```powershell
npm run dev
```

It states the UI at `http://localhost:3036` and health at `http://127.0.0.1:8000/api/health`. The Vite proxy target remains `42006` (`frontend/vite.config.ts`).

### Frontend scripts that exist and are not launchers

From `frontend/package.json`:

| Script | Command |
| :--- | :--- |
| `build` | `tsc -b && vite build` |
| `lint` | `oxlint` |
| `preview` | `vite preview` |
| `test:e2e` | `playwright test` |

No `start` script. No backend `package.json`.

`test:e2e` is an optional local UI smoke. It uses frontend devDependency `@playwright/test` (Apache-2.0) against `http://127.0.0.1:42005`. Chromium is installed separately with `npx playwright install chromium`. It does not start the backend.

### Gap

There is no single script whose backend port and frontend proxy target are the same **and** whose printed URL matches `frontend/vite.config.ts`, except running `start_backend.bat` and `start_frontend.bat` separately. `run_dashboard.bat` and the `README.md` uvicorn command use port `8000`.

## Ports

| Port | Where declared | Process |
| :--- | :--- | :--- |
| `42005` | `frontend/vite.config.ts` `server.port`; `start_frontend.bat`; CORS origins in `backend/app/main.py` | Vite dev server |
| `42006` | `start_backend.bat`; `backend/app/main.py` `__main__`; Vite `proxy['/api'].target` | Uvicorn |
| `8000` | `run_dashboard.bat`; `README.md` startup section | Uvicorn, only if those commands are used |
| `3036` | Echo text in `run_dashboard.bat`; URL text in `README.md` | Not set in `frontend/vite.config.ts` |
| `5173` | CORS origins only, `backend/app/main.py` | Not set as the Vite port in this repo |
| `3000` | CORS origins only, `backend/app/main.py` | Not set as the Vite port in this repo |
| `11434` | `backend/app/ai/ollama_client.py`, `backend/app/ai/embedding_engine.py` | Ollama, external to this repo |

`npm run preview` does not set a port in `frontend/package.json` or `frontend/vite.config.ts`. The preview port is UNKNOWN from this repo; Vite's own default is not declared here.
