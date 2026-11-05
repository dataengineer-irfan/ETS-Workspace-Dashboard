# ETS Genie — Copilot Subsystem Architecture

> Evidence-based documentation generated from the actual source code of the ETS Workforce
> Dashboard. Every claim below cites concrete files, symbols, and (where practical) line
> numbers. Items that the code does not resolve are explicitly marked **UNKNOWN** with the
> file that would answer them. No enhancement proposals are included.

---

## 1. Purpose — What ETS Genie Does for the User

**ETS Genie** is the natural-language copilot embedded in the ETS Workforce Dashboard. The
frontend surfaces it as a slide-out drawer whose assistant introduces itself as:

- `"Hello! I am **ETS Genie**, your intelligent workforce assistant. Ask me any analytical
  questions about headcount, salaries, skills, leaves, or department trends across all 590
  employees."` — `frontend/src/components/copilot/AICopilotDrawer.tsx:62`
- Panel title `ETS Genie` — `frontend/src/components/copilot/AICopilotDrawer.tsx:218`

From the code, ETS Genie answers workforce questions over the dashboard's loaded data:
headcount / active / leaver counts, attrition, distributions (state, location, department,
project, age, gender), compensation aggregates and ranking, tenure, skills analytics,
organizational risk, and policy Q&A over an internal document corpus. It refuses out-of-domain
and commercial-finance questions (`orchestrator.py` guardrails, §9). The backend brands itself
`ETS Genie` in `model_gateway.py:21` and in guardrail answer text (e.g. `orchestrator.py:1713`).

---

## 2. High-Level Architecture

```
 ┌──────────────────────────────────────────────────────────────────────────────┐
 │ FRONTEND (React)                                                               │
 │  AICopilotDrawer.tsx  ── handleSend() ──► askCopilot()                         │
 │  frontend/src/api/client.ts  (axios instance, Bearer token interceptor)       │
 └───────────────────────────────┬──────────────────────────────────────────────┘
                                  │ POST /api/copilot/query   (axios, timeout 240s)
                                  ▼
 ┌──────────────────────────────────────────────────────────────────────────────┐
 │ ROUTER:  backend/app/routers/copilot.py                                        │
 │   query_copilot()  → derives user_role/department from JWT (or EMPLOYEE)       │
 │   → llm_orchestrator.process(...)                                              │
 └───────────────────────────────┬──────────────────────────────────────────────┘
                                  ▼
 ┌──────────────────────────────────────────────────────────────────────────────┐
 │ ORCHESTRATOR:  backend/app/ai/orchestrator.py  (LLMOrchestrator.process)      │
 │                                                                                │
 │  (A) SEMANTIC ENGINE first  →  ai/semantic/engine.py                           │
 │        parser → validator → RBAC → planner → executor → formatter             │
 │        (DETERMINISTIC, 0 LLM calls). Returns answer OR {_delegate:true}        │
 │                                                                                │
 │  (B) capability_registry.resolve()  → CapabilityContract (execution_route)     │
 │        • ACCESS_DENIED / UNSUPPORTED* / NO_MATCH  → canned refusal             │
 │        • MULTI_REQUIREMENT  → deterministic SQL pipeline (compositional.py)    │
 │        • EXECUTIVE_REASONING → evidence_collector + LLM reasoning              │
 │                                                                                │
 │  (C) AI-DEPENDENT pipeline (requires Ollama):                                  │
 │        model_gateway.generate (PLANNER) → tool (SQL|ANALYTICS|RAG|DIRECT)      │
 │        → model_gateway.generate (SYNTHESIS) → grounding verify                 │
 └───────┬───────────────────────┬───────────────────────┬───────────────────────┘
         ▼                       ▼                        ▼
   SQL PATH                 RAG PATH                 LLM PATH
   sql_governor.py          semantic_rag.py          model_gateway.py
   query_builder.py         vector_store.py          ollama_client.py
   db.py (in-mem SQLite)    document_indexer.py      (Ollama @ :11434)
         │                  embedding_engine.py             │
         ▼                       ▼                          ▼
   in-memory SQLite        backend/data/rag_index.db   local LLMs
   (ets_memdb)             + backend/data/documents/*.md
         │
         ▼
   data_loader.py  ◄── ETS_Dasboard_DS.xlsx (pandas frames)
                                  │
                                  ▼
 ┌──────────────────────────────────────────────────────────────────────────────┐
 │ RESPONSE (CopilotQueryResponse dict) → router returns res → axios → drawer     │
 │ render (answer, insights, chart_data, result_items, execution_trace, ...)      │
 └──────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. End-to-End Request Lifecycle

### 3.1 Request payload schema

Posted by `askCopilot()` at `frontend/src/api/client.ts:109-134` to `'/copilot/query'`
(axios `baseURL='/api'`, `client.ts:16-20`), validated by Pydantic model
`CopilotQueryRequest` (`backend/app/models.py:161-167`):

| Field | Type | Default | Source |
|-------|------|---------|--------|
| `question` | `str` | required | `models.py:162` |
| `context_tab` | `Optional[str]` | `None` | `models.py:163` |
| `history` | `Optional[List[Dict[str, Any]]]` | `None` | `models.py:164` |
| `user_role` | `Optional[str]` | `None` | `models.py:165` |
| `filters` | `Optional[Dict[str, Any]]` | `None` | `models.py:166` |
| `department` | `Optional[str]` | `None` | `models.py:167` |

The frontend sends `{ question, context_tab, history, filters, user_role, department }`
(`client.ts:124-131`). `user_role`/`department` are read from `localStorage` key
`ets_auth_user` (`client.ts:112-118`).

### 3.2 Response schema

Declared via `response_model=CopilotQueryResponse` (`copilot.py:14`), model at
`backend/app/models.py:185-205`:

| Field | Type |
|-------|------|
| `answer` | `str` |
| `insights` | `List[str]` |
| `intent` | `str` |
| `status` | `Optional[str]` |
| `overall_status` | `Optional[str]` |
| `data` | `Optional[Dict[str, Any]]` |
| `filters` | `Optional[Dict[str, Any]]` |
| `source` | `Optional[str]` |
| `confidence` | `Optional[float]` |
| `chart_data` | `Optional[List[Dict[str, Any]]]` |
| `chart_type` | `Optional[str]` |
| `related_metrics` | `Optional[Dict[str, Any]]` |
| `chart` | `Optional[Dict[str, Any]]` |
| `result_items` | `Optional[List[ResultItem]]` |
| `suggested_questions` | `Optional[List[str]]` |
| `evidence` | `Optional[Union[List[Any], Dict[str, Any]]]` |
| `execution_trace` | `Optional[Dict[str, Any]]` |
| `llm_calls` | `Optional[int]` (default `0`) |
| `model_calls` | `Optional[int]` (default `0`) |
| `rag_calls` | `Optional[int]` (default `0`) |

`ResultItem` (`models.py:175-183`): `requirement_id`, `title`, `status`,
`presentation_mode` (default `"METRIC_CARD"`), `chart_spec?`, `table_spec?`. Allowed
presentation modes: `METRIC_CARD`, `CHART`, `TABLE`, `TEXT_NOTICE` (`models.py:169-173`).

> Note: The orchestrator returns plain `dict`s whose keys are a **superset** of the Pydantic
> model (e.g. `visual_target`, `visual_filters`, `evidence_sources`, `provenance`,
> `reasoning_model_used`). FastAPI filters the HTTP body down to the declared
> `CopilotQueryResponse` fields. Not every field is populated on every path.

### 3.3 Step-by-step

1. **Frontend** — `AICopilotDrawer.handleSend()`
   (`AICopilotDrawer.tsx:160-187`) builds a `historyPayload` from the last 6 messages
   (`role`, `content`, `data`, `filters`, `intent`) and calls `askCopilot(q, activeTab,
   historyPayload, filters)`.
2. **axios** — `askCopilot()` (`client.ts:109`) POSTs to `/api/copilot/query` with a
   240 000 ms timeout. The shared axios instance attaches `Authorization: Bearer <token>`
   from `localStorage['ets_auth_token']` (`client.ts:40-46`).
3. **Router** — `query_copilot()` (`copilot.py:15-53`): defaults `user_role="EMPLOYEE"`,
   `department=None`; if a valid bearer token is present it decodes via
   `decode_access_token` and looks up the user via `get_user_by_id`, taking `role` and
   `department` from the DB record (`copilot.py:21-33`). Unauthenticated attempts to assert a
   privileged `user_role` are logged and clamped to `EMPLOYEE` (`copilot.py:35-40`).
4. **Orchestrator entry** — `llm_orchestrator.process(question, context_tab, history,
   user_role, active_filters=filters, department)` (`copilot.py:43-50`;
   `orchestrator.py:1547`). `process()` resets the per-request call tracker
   (`reset_call_tracker()`), delegates to `_process_impl()`, then copies
   `llm_calls`/`rag_calls`/`model_calls` from the tracker into the result
   (`orchestrator.py:1556-1576`).
5. **Conversation context** — `_process_impl` extracts recent exchanges and an "active
   employee" subject from `history` (`orchestrator.py:1590-1638`).
6. **Security context** — `SecurityContext.from_request(user_role, department)`
   (`orchestrator.py:1643`).
7. **Semantic engine (deterministic first)** — if `USE_SEMANTIC_ENGINE` (env
   `ETS_USE_SEMANTIC_ENGINE`, default true — `orchestrator.py:11`), calls
   `semantic_engine.process(...)` (`orchestrator.py:1649-1661`). If the result is **not**
   `{_delegate: true}`, it is returned immediately (fully deterministic, 0 LLM calls).
8. **Capability resolution** — otherwise `capability_registry.resolve(...)` builds a
   `CapabilityContract` with an `execution_route` (`orchestrator.py:1666-1671`).
9. **Authorization & guardrails** — RBAC check (`is_capability_authorized`,
   `orchestrator.py:1674`), then canned refusals for
   `UNSUPPORTED_COMMERCIAL_FINANCE`, `UNSUPPORTED`, `NO_MATCH`
   (`orchestrator.py:1710-1776+`).
10. **Routing by `execution_route`**:
    - `EXECUTIVE_REASONING` → `evidence_collector` gathers SQL ground truth, then
      `model_gateway.generate(task_type="REASONING")` synthesizes
      (`orchestrator.py:~1830-2016`).
    - `MULTI_REQUIREMENT` → deterministic SQL pipeline via `compositional.py`
      (`AnalyticalParser`, `MultiRequirementQueryBuilder`, `MultiRequirementSynthesizer`),
      0 LLM calls (`orchestrator.py:2018-2264`).
    - `DETERMINISTIC_SQL` → **explicitly deprecated**; raises `RuntimeError`
      (`orchestrator.py:2266-2272`).
11. **AI-dependent pipeline** — if none of the deterministic routes returned: checks
    `ollama_client.is_available()` (`orchestrator.py:2278`). If offline → `AI_UNAVAILABLE`
    response (no fallback). Otherwise:
    a. **Planner LLM** — `model_gateway.generate(task_type="SQL")` with
       `PLANNER_SYSTEM_PROMPT` or `LEAN_RAG_PLANNER_PROMPT` (`orchestrator.py:2311-2329`).
    b. Parse + validate plan (`_parse_plan`, `_validate_plan`) with **one** controlled repair
       attempt (`orchestrator.py:2368-2451`).
    c. **Tool execution** by `plan_dict["tool"]`: `SQL` / `ANALYTICS` / `RAG` /
       `UNSUPPORTED` / `DIRECT` (`orchestrator.py:2453-2583`).
    d. **Synthesis LLM** — `model_gateway.generate(task_type="RAG")` with
       `SYNTHESIS_SYSTEM_PROMPT` (`orchestrator.py:2589-2646`).
    e. **Grounding** — `grounding_verifier.verify_evidence(...)`; ungrounded claims are
       blocked (`orchestrator.py:2650-2702`).
    f. **Chart prep** + final dict (`orchestrator.py:2704-2752`).
12. **Return** — router logs intent/source/latency and returns the dict
    (`copilot.py:51-53`). axios resolves `res.data`; the drawer pushes an assistant message
    `{ role, content: res.answer, response: res }` (`AICopilotDrawer.tsx:180-186`).

---

## 4. AI Module Responsibilities (`backend/app/ai/`)

Directory contents (19 modules): `__init__.py`, `call_tracker.py`,
`capability_registry.py`, `compositional.py`, `db.py`, `document_indexer.py`,
`embedding_engine.py`, `evidence_collector.py`, `grounding.py`, `invariant_engine.py`,
`model_gateway.py`, `ollama_client.py`, `orchestrator.py`, `query_builder.py`,
`security_context.py`, `semantic_rag.py`, `tools.py`, `vector_store.py`, plus the
`semantic/` package (`catalog.py`, `engine.py`, `executor.py`, `formatter.py`, `ir.py`,
`parser.py`, `planner.py`, `validator.py`).

### orchestrator.py — `LLMOrchestrator`
- **Role**: master request controller; single public entry `process()` / `_process_impl()`.
- **Inputs**: `question`, `context_tab`, `history`, `user_role`, `active_filters`,
  `department`.
- **Outputs**: response `dict` (superset of `CopilotQueryResponse`).
- **Key functions**: `process` (`:1547`), `_process_impl` (`:1578`),
  `_resolve_deterministic_capability` (`:276`), `_format_deterministic_result` (`:635`),
  `_map_capability_to_formatter` (`:1359`), `_derive_visual_metadata` (`:1493`),
  `_parse_plan` (`:2754`), `_validate_plan` (`:2831`), `_validate_sql` (`:2864`),
  `_format_evidence_for_synthesis` (`:2932`), `_generate_static_followup_suggestions`
  (`:2960`). Module-level helpers: `parse_currency_amount`, `extract_states`,
  `extract_location`, `extract_experience_threshold`, `extract_salary_threshold` (`:114-169`).
- **Invoked by**: `backend/app/routers/copilot.py` via the module singleton
  `llm_orchestrator`. (Singleton defined at the bottom of `orchestrator.py`; imported at
  `copilot.py:5`.)

### semantic/engine.py — `SemanticQueryEngine` (`semantic_engine`)
- **Role**: deterministic analytical pipeline, tried **before** the LLM path.
- **Pipeline**: `parser.parse` → `validator.validate` → RBAC (`SecurityContext`) →
  `_resolve_capability` → `planner.plan` → `executor.execute` → `invariant_engine` →
  `formatter.format` (`engine.py:40-255`).
- **Inputs**: same signature as orchestrator `process`.
- **Outputs**: full response dict (`llm_calls=0`, `confidence=1.0`,
  `deterministic_route=True`), OR a delegation marker `{"_delegate": True,
  "delegate_target": ..., "ir": ir}` for policy/context/reasoning intents
  (`engine.py:152-159`).
- **Extra governance**: denies individual-compensation lookups for `EMPLOYEE` role
  (`engine.py:106-150`); routes `visual_target` for the UI (`engine.py:229-240`).
- **Catalog binding**: a filter value is applied only when it is already a member of that
  field's live domain. A non-member is kept only as an explicit unknown anchored to the
  field (for example Department XYZ or Mumbai) when that field is not the grouping
  dimension and no domain member is already bound. An unsupported-concept phrase does not
  refuse the question when a catalog value binds it to a real field. Partition and ranking
  invariants use the request's measure and the same cohort filters the question asked for.
- Sub-modules: `parser.py` (NL → `QueryIR`), `validator.py` (IR validation / refusal),
  `planner.py` (IR → SQL plan), `executor.py` (governed execution → `AnalysisResult`),
  `formatter.py` (result → response dict), `ir.py` (IR dataclasses / `Intent`),
  `catalog.py` (field/measure catalog). Facade imports at `engine.py:13-18`.

### capability_registry.py — `capability_registry`, `CapabilityEnum`, `CapabilityContract`
- **Role**: resolves a question into a typed `CapabilityContract` with `capability`,
  `parameters` (`TypedParameters`), `meta`, and `execution_route`.
- **Key types**: `CapabilityEnum` (`:16`), `TypedParameters` (`:128`), `CapabilityContract`
  (`:163`), `EntityNormalizer` (`:169`), `FilterContext` (`:672`).
- **Invoked by**: `orchestrator._process_impl` (`orchestrator.py:1666`).

### compositional.py — multi-requirement deterministic engine
- **Role**: parse/execute/synthesize multi-part analytical queries with **0 LLM calls**.
- **Key classes**: `AnalyticalParser` (`:353`), `MultiRequirementQueryBuilder` (`:1385`),
  `MultiRequirementInvariantEngine` (`:1711`), `MultiRequirementSynthesizer` (`:1808`),
  `CompositionalQueryBuilder` (`:2602`), plus enums/dataclasses (`MetricEnum`,
  `ExecutorEnum`, `RequirementStatusEnum`, `AtomicRequirement`, `AnalyticalQueryPlan`).
- **Invoked by**: orchestrator `MULTI_REQUIREMENT` route (`orchestrator.py:2018-2264`).
  Each `AtomicRequirement` executes through `self.tools.execute_sql(...)`
  (`orchestrator.py:2117`) or `self.tools.execute_rag(...)` (`orchestrator.py:2133`).

### db.py — `SQLiteEngine` (`sqlite_engine`)
- **Role**: builds and serves the **in-memory SQLite** workforce database from the
  pandas frames loaded by `data_loader`.
- **DB handle**: `sqlite3.connect("file:ets_memdb?mode=memory&cache=shared", uri=True,
  check_same_thread=False)` (`db.py:29`) — shared-cache in-memory DB.
- **Tables** built in `_populate_tables` (`db.py:33-144`): `employees`, `skills`, `leaves`,
  `finance_history`, each `to_sql(..., if_exists="replace")` from `data_loader.df_*`.
  Column sanitization via `_sanitize_series` (`db.py:12-21`); indexes at `db.py:127-143`.
- **Key functions**: `execute_query(sql_str, params)` (`db.py:146-153`),
  `get_schema_summary()` (`db.py:155-201`, the schema text given to the planner LLM).
- **Invoked by**: `sql_governor` (executes), `tools`, `evidence_collector`,
  `invariant_engine`, semantic `executor`.

### sql_governor.py — `SQLGovernor` (`sql_governor`)
- **Role**: validates/sanitizes SQL and runs it against `sqlite_engine`. Full policy in §5.
- **Key functions**: `validate_and_sanitize(sql_str)` (`:17`), `execute_governed(sql_str)`
  (`:66`).
- **Invoked by**: `tools.GovernedToolRegistry.execute_sql` (`tools.py:15-31`).

### query_builder.py — `ParameterizedQueryBuilder` (`query_builder`)
- **Role**: constructs governed SQL strings for each `CapabilityEnum` from a typed
  `CapabilityContract`. Returns a `QueryPlan` (`sql`, `params`, `capability`,
  `expected_result_type`, `meta`).
- **Key function**: `build_plan(contract, security)` (`:31`), with a large capability
  dispatch (HEADCOUNT, ACTIVE_HEADCOUNT, LEAVER_COUNT, ATTRITION, *_BREAKDOWN,
  COMPENSATION_AVERAGE, RANKING, EMPLOYEE_LOOKUP, skills/risk capabilities, etc.).
- **Security**: applies `security.department_scope` onto `p.department` (`:37-38`);
  literal escaping via `_escape_literal` (`:24-28`).
- **Invoked by**: imported by `orchestrator` (`orchestrator.py:17`). (Note: the primary
  deterministic path now flows through `compositional.MultiRequirementQueryBuilder` and the
  semantic `planner`; `DETERMINISTIC_SQL` legacy route is disabled — `orchestrator.py:2266`.)

### vector_store.py — `SQLiteVectorStore` (`vector_store`)
- **Role**: persistent on-disk vector index for RAG. Details in §6.
- **DB path**: `backend/data/rag_index.db` (`vector_store.py:11-13`, computed relative to the
  module; created on first use).
- **Key functions**: `save_document` (`:100`), `similarity_search` (`:153`),
  `get_indexed_documents` (`:66`), `delete_document` (`:89`).

### document_indexer.py — `DocumentIndexer` (`document_indexer`)
- **Role**: builds the RAG corpus from `backend/data/documents/*.md` (and `*.txt`). Details
  in §6.
- **Key functions**: `sync_documents()` (`:103`), `parse_frontmatter` (`:16`),
  `deterministic_chunk_text` (`:51`).

### embedding_engine.py — `LocalEmbeddingEngine` (`embedding_engine`)
- **Role**: produces dense, unit-normalized embeddings via Ollama. **No fallback** — raises
  `RuntimeError` if Ollama embedding fails (`embedding_engine.py:18-19, 57-62`).
- **Config**: `OLLAMA_EMBED_URL = "http://localhost:11434/api/embeddings"` (`:12`),
  `DEFAULT_EMBED_MODEL = "nomic-embed-text:latest"` (`:13`), declared dimension `768` (`:23`).
- **Key functions**: `embed_text` (`:64`), `embed_batch` (`:74`), `_embed_via_ollama` (`:29`).

### semantic_rag.py — `SemanticRAG` (`semantic_rag`)
- **Role**: orchestrates RAG retrieval (embed query → vector search → threshold). Details §6.
- **Config**: `MIN_RELEVANCE_SIMILARITY = 0.58` (`:10`).
- **Key function**: `retrieve(query, top_k=3, user_roles, min_score)` (`:31`); constructor
  calls `_ensure_indexed()` → `document_indexer.sync_documents()` (`:22-29`).

### model_gateway.py — `ModelGateway` (`model_gateway`)
- **Role**: central LLM invocation boundary with env-configurable model selection and an
  authoritative invocation counter. Details in §7.
- **Key function**: `generate(prompt, system, task_type, temperature, max_tokens)` (`:98`),
  dispatching to `configured_reasoning_model` / `configured_rag_model` /
  `configured_sql_model` by `task_type` (`:110-115`).

### ollama_client.py — `OllamaClient` (`ollama_client`)
- **Role**: raw HTTP client for Ollama. `OLLAMA_BASE_URL = "http://localhost:11434"` (`:9`).
- **Key functions**: `is_available()` (`:24`, GET `/api/tags`, 5 s timeout),
  `generate(...)` (`:33`, POST `/api/generate`, default `timeout=120.0`),
  `extract_sql_query(text)` (`:79`).

### grounding.py — `GroundingVerifier` (`grounding_verifier`)
- **Role**: verifies that synthesized LLM answers are supported by the evidence; blocks
  ungrounded numeric/string claims.
- **Key functions**: `verify_evidence(...)`, `format_insights(...)`,
  `_verify_rag_claims_via_llm(...)` (`:14`). Uses `ollama_client` / `model_gateway`
  (`grounding.py:5-6`).
- **Invoked by**: orchestrator synthesis path (`orchestrator.py:2656-2657`).

### evidence_collector.py — `EvidenceCollector` (`evidence_collector`)
- **Role**: "Python/SQL owns the truth" — gathers structured DB evidence **before** any LLM
  reasoning. Zero LLM calls (`evidence_collector.py:1-18`).
- **Key functions**: `collect_workforce_risk_evidence()` (`:24`) and similar collectors over
  `sqlite_engine`.
- **Invoked by**: orchestrator `EXECUTIVE_REASONING` route.

### invariant_engine.py — `InvariantEngine` (`invariant_engine`) / `InvariantResult`
- **Role**: runtime data-integrity assertions over query results vs. DB ground truth;
  failures halt execution with `INVARIANT_FAILED` (`orchestrator.py:2144-2182`;
  `engine.py:168-224`).
- **Key function**: `validate_capability_result(contract, rows, db_conn)`.

### security_context.py — `SecurityContext`, `UserRole`, `ROLE_PERMISSIONS`
- **Role**: role-based access control. Details in §9/§11.
- **Key functions**: `from_request(user_role, department)` (`:104`),
  `is_capability_authorized(capability)` (`:95`).

### tools.py — `GovernedToolRegistry` (`tool_registry`)
- **Role**: the governed tool surface used by the AI-dependent pipeline and the
  multi-requirement executor.
- **Key functions**: `execute_sql(sql_query)` (`:15`, via `sql_governor`),
  `execute_analytics(domain, **kwargs)` (`:33`, via `backend.app.analytics`),
  `execute_rag(query, top_k, user_roles)` (`:74`, via `semantic_rag`; records a RAG call).

### call_tracker.py — `CallTracker`
- **Role**: per-request counters (`llm_calls`, `planner_calls`, `synthesis_calls`,
  `verifier_calls`, `rag_calls`, `model_calls`) stored in a `ContextVar`
  (`call_tracker.py:5-28`). Reset by `process()` and surfaced in the response
  (`orchestrator.py:1556-1575`).

---

## 5. The SQL Path

**How NL becomes SQL.** Two deterministic builders and one LLM builder exist:

1. **Semantic engine** (primary deterministic): `parser.py` turns the question into a
   `QueryIR`; `planner.py` builds SQL from the IR and compiles the aggregation stored
   on the metric (a median is the ordered middle value, a count stays a count, and a
   share uses the named cohort as its denominator); `executor.py` runs it
   (`engine.py:161-165`). A filter value matches a whole catalog member, including a skill's own name before a separator. The `manages` link is the manager already stored on the employee. Two values of one single-valued field become two cohorts.
2. **Compositional multi-requirement** (`MULTI_REQUIREMENT` route):
   `AnalyticalParser.parse` → `MultiRequirementQueryBuilder.build_sql_for_requirement(req)`
   → `self.tools.execute_sql(sql)` per requirement (`orchestrator.py:2110-2124`).
3. **LLM planner** (AI-dependent fallback): the planner LLM emits a plan `{tool:"SQL",
   query:"SELECT ..."}`; executed via `self.tools.execute_sql` with **one** repair attempt
   (`orchestrator.py:2464-2492`).

**Execution target.** All SQL runs against the **in-memory SQLite** database in `db.py`
(`sqlite_engine`, `file:ets_memdb?mode=memory&cache=shared`). `tools.execute_sql` →
`sql_governor.execute_governed` → `sqlite_engine.execute_query` (`tools.py:21`,
`sql_governor.py:70`).

**What `sql_governor.py` enforces** (`validate_and_sanitize`, `:17-64`):

- Strips trailing `;` and markdown code fences (```` ```sql ````) (`:18-26`).
- Parses with `sqlglot.parse_one(..., read="sqlite")`; a parse failure raises
  `SQLGovernorError` (`:28-31`).
- **SELECT-only**: top node must be `exp.Select` or `exp.Union`, else policy violation
  (`:33-35`).
- **Forbidden operations blocked**: `Insert, Update, Delete, Drop, Alter, Create, Command,
  Pragma` — any occurrence raises a violation (`:37-44`).
- **Table allowlist**: every referenced table must be in
  `ALLOWED_TABLES = {'employees', 'skills', 'leaves', 'finance_history'}`
  (`sql_governor.py:7`, enforced `:46-50`).
- **Row-limit enforcement**: if no `LIMIT`, injects `LIMIT 100`; if `LIMIT > MAX_ROW_LIMIT`
  (`MAX_ROW_LIMIT = 200`, `:8`), clamps to 200 (`:52-62`). Result rows are also truncated to
  `MAX_ROW_LIMIT` (`:76`).
- `execute_governed` returns `{success, sanitized_sql, row_count, rows, latency_ms, error}`
  and converts `SQLGovernorError`/other exceptions into `success=False` payloads
  (`:66-97`).

**How `query_builder.py` builds queries.** `ParameterizedQueryBuilder.build_plan` emits
governed SQL strings per capability using `_escape_literal` (doubling single quotes) and
`WHERE`/`GROUP BY` composition — e.g. HEADCOUNT → `SELECT COUNT(*) AS count FROM employees
WHERE ...` (`query_builder.py:96`), ATTRITION rate calc (`:177-189`), RANKING via
`MAX/MIN(annual_ctc)` subquery (`:367-372`), EMPLOYEE_LOOKUP by `employee_number`
(`:383-388`). It applies `security.department_scope` onto the department filter
(`:37-38`).

**Tables used** (from `db.get_schema_summary`, `db.py:155-201`, and `query_builder`):

- `employees` (`employee_number`, `first_name`, `last_name`, `employee_label`, `gender`,
  `location`, `state`, `department`, `job_level`, `job_title`, `manager`, `project`,
  `current_status`, `start_date`, `exit_date`, `annual_ctc`, `monthly_salary`, `prior_exp`,
  `infinite_exp`, `total_exp`, `salary_bin`, `primary_skill`, `primary_skill_exp`,
  `primary_skill_level`, `module`, `date_of_birth`, `age`).
- `skills` (`employee_number`, `skill_name`, `skill_type`, `skill_level`, `skill_exp`,
  `skill_category`, `is_active`).
- `leaves` (`employee_number`, `start_date`, `end_date`, `leave_type`, `day_value`,
  `job_level`, `department`, `location`, `state`, `manager`, `project`).
- `finance_history` (`employee_number`, `year`, `base_salary`, `bonus`, `perks`,
  `other_comp`, `is_promotion`, `monthly_salary`, `total_ctc`, `hike_percent`, `salary_bin`,
  `job_level`, `department`, `location`, `state`, `manager`, `project`, `record_origin`,
  `is_synthetic`, `derivation_rule`).

> The docstring row counts in `get_schema_summary` (employees 590, skills 2177, leaves 799,
> finance_history 1934) are **static text** given to the planner LLM; actual counts depend on
> the loaded workbook.

---

## 6. The RAG Path

**Corpus source.** `backend/data/documents/` — markdown files
(`DEFAULT_DOCS_DIR`, `document_indexer.py:12-14`). Files present in the repo:
`attrition_calculation.md`, `compensation_structure.md`,
`executive_compensation_confidential.md`, `experience_tenure_structure.md`,
`grade_progression_ladder.md`, `headcount_definitions.md`, `leave_policy.md`,
`skills_competency_matrix.md`.

**Indexing (`document_indexer.sync_documents`, `:103-200`).**
- Scans `*.md`/`*.txt` (`:118-120`).
- Parses optional `---` YAML-ish frontmatter via `parse_frontmatter` (`:16-49`) →
  `document_id`, `document_name`, `document_type`, `source`, `version`, `authorizations`.
- Computes `SHA256` content hash; **skips** documents whose hash already matches the stored
  hash (no re-embedding) (`:126-137`).
- Chunks changed docs with `deterministic_chunk_text(body, chunk_size=400, overlap=80)`
  (`:141`) — markdown-heading/paragraph/sentence aware (`:51-92`).
- Embeds chunks with `embedding_engine.embed_batch` and persists via
  `vector_store.save_document` (`:158-189`).
- Deletes vector-store documents no longer present on disk (`:192-197`).
- Returns stats `{indexed, skipped, deleted, total}`.

**Embedding technique.** Genuine **dense vectors via Ollama** (`nomic-embed-text:latest`,
768-dim), **unit-normalized** for cosine similarity, with **no fallback**
(`embedding_engine.py:29-72`).

**Storage / retrieval (`vector_store.py`).** Persistent SQLite at
`backend/data/rag_index.db` with tables `rag_documents` and `rag_chunks` (embeddings stored
as `float32` BLOBs) (`:32-64`, `:134-149`). `similarity_search` (`:153-234`):
1. Loads all chunks joined to their documents.
2. **Authorization filter**: keeps a chunk only if its document `authorizations` contains
   `"ALL"` or intersects the caller's roles (`:195-204`).
3. Computes cosine similarity as a **vectorized dot product** of unit vectors
   (`np.dot(candidate_matrix, query_vector)`) (`:210-213`).
4. Applies `min_score` threshold and returns top-`k` sorted by score (`:216-234`).

**Service wrapper (`semantic_rag.retrieve`, `:31-100`).** Embeds the query, calls
`similarity_search(top_k, user_roles, min_score=MIN_RELEVANCE_SIMILARITY=0.58)`. If **zero**
chunks clear the threshold it returns `{success: False, error: "RAG_NO_EVIDENCE"}` — **no
silent fallback** (`:70-79`). On exception returns `RAG_FAILED: ...` (`:90-99`).

**How retrieved context is used.** In the AI-dependent pipeline, a `RAG` plan calls
`tools.execute_rag(tool_arg, top_k=3, user_roles=sec_ctx.allowed_document_authorizations)`
(`orchestrator.py:2506-2509`). `RAG_NO_EVIDENCE`/`RAG_FAILED` short-circuit to refusal
responses (`:2511-2575`). Otherwise retrieved `documents` become `evidence`, are formatted by
`_format_evidence_for_synthesis`, and fed to the synthesis LLM (`task_type="RAG"`), whose
answer is then grounding-checked (`orchestrator.py:2577-2702`). In the multi-requirement
path, a `RAG` requirement calls `tools.execute_rag(req.raw_text, top_k=2)`
(`orchestrator.py:2130-2136`).

---

## 7. The Model / LLM Path

**Host.** Ollama at `http://localhost:11434`:
- `ollama_client.py:9` — `OLLAMA_BASE_URL = "http://localhost:11434"`.
- `embedding_engine.py:12` — `OLLAMA_EMBED_URL = "http://localhost:11434/api/embeddings"`.
- Host is **hardcoded** (no env var found in these two files). **UNKNOWN**: an env override
  for the Ollama base URL — not present in `ollama_client.py` / `embedding_engine.py`.

**Model selection (`model_gateway.py`).** `generate()` picks a model by `task_type`
(`:110-115`): `REASONING` → `configured_reasoning_model`; `RAG` → `configured_rag_model`;
anything else (incl. `SQL`, `ROUTER`) → `configured_sql_model`. Each property first tries an
enterprise target model, then falls back to a local model **if the target is not installed**
(checked via `GET /api/tags`):

| Property | Env var (target) | Target default | Env var (local) | Local default |
|----------|------------------|----------------|-----------------|---------------|
| `configured_rag_model` (`:29-34`) | `ETS_RAG_MODEL` | `granite3.1-dense:8b` | `ETS_LOCAL_RAG_MODEL` | `qwen2.5:3b` |
| `configured_sql_model` (`:37-42`) | `ETS_SQL_MODEL` | `qwen2.5-coder:7b` | `ETS_LOCAL_SQL_MODEL` | `qwen2.5-coder:3b` |
| `configured_embedding_model` (`:44-49`) | `ETS_EMBED_MODEL` | `bge-large-en-v1.5` | `ETS_LOCAL_EMBED_MODEL` | `nomic-embed-text:latest` |
| `configured_reasoning_model` (`:51-56`) | `ETS_REASONING_MODEL` | `granite3.1-dense:8b` | `ETS_LOCAL_REASONING_MODEL` | `qwen2.5:3b` |
| `configured_verifier_model` (`:58-63`) | `ETS_VERIFIER_MODEL` | `qwen2.5:1.5b` | (falls back to `configured_rag_model`) | — |

> Note: `configured_embedding_model` exists on the gateway, but the active embedding path
> (`embedding_engine.py`) hardcodes `nomic-embed-text:latest` and does **not** consult the
> gateway. `ollama_client.py` also defines `DEFAULT_SQL_MODEL="qwen2.5-coder:3b"` and
> `DEFAULT_SYNTHESIS_MODEL="qwen2.5:3b"` (`:10-11`) as client-side defaults.

If `GET /api/tags` fails, `list_installed_models()` returns a static list
`["qwen2.5:3b", "qwen2.5-coder:3b", "nomic-embed-text:latest"]` (`model_gateway.py:70-77`),
so the "installed" check degrades to those local models.

**What happens if Ollama is not running.**
- The AI-dependent pipeline guards on `ollama_client.is_available()`; if unavailable it
  returns `AI_UNAVAILABLE` with **no deterministic fallback**
  (`orchestrator.py:2278-2310`). "Per zero-trust architecture guidelines, deterministic
  fallback is disabled for AI copilot requests."
- `ollama_client.generate()` returns `None` on `URLError`/exceptions
  (`ollama_client.py:72-77`); planner/synthesis then emit `PLANNER_FAILED` /
  `SYNTHESIS_FAILED` refusals (`orchestrator.py:2333-2366`, `:2611-2644`).
- `embedding_engine` raises `RuntimeError` if embedding fails; RAG surfaces this as
  `RAG_FAILED` (`semantic_rag.py:90-99`).

**Is an LLM required or optional?** **Both — it depends on the query path**:
- **OPTIONAL** for the large deterministic set: any question the **semantic engine** answers
  (returns a non-`_delegate` result, `orchestrator.py:1658-1659`) and the
  **MULTI_REQUIREMENT** route run with **0 LLM calls** (`engine.py:241-243`,
  `orchestrator.py:2246-2251`). These need SQLite/pandas, not Ollama.
- **REQUIRED** for `EXECUTIVE_REASONING` (reasoning LLM) and for any query reaching the
  AI-dependent pipeline (policy RAG synthesis, planner/synthesis). Those hard-fail without
  Ollama (§9). RAG retrieval **also** requires Ollama because embeddings are generated via
  Ollama with no fallback.

---

## 8. Data Dependencies

**Workbook.** `backend/app/data_loader.py` (`DataLoader`, singleton `data_loader`) reads
`ETS_Dasboard_DS.xlsx`:
- Path resolution: three directories above `data_loader.py` → `ETS_Dasboard_DS.xlsx`; if that
  does not exist, falls back to the literal `'ETS_Dasboard_DS.xlsx'` (CWD-relative)
  (`data_loader.py:22-28`).
- Sheets loaded via `pd.read_excel`: `EMPLOYEES` (skiprows=2) → `df_employees`, `SKILL` →
  `df_skills`, `Finance_History` → `df_finance`, `LEAVE` (skiprows=2) → `df_leave`
  (`data_loader.py:37, 98, 135, 283`).
- `load_data()` is called from the module import / singleton init (`data_loader.py:30`) and
  again on FastAPI startup (`main.py:121-126`).

**In-memory DB.** `db.SQLiteEngine._populate_tables` copies `data_loader.df_employees`,
`df_skills`, `df_leave`, `df_finance` into SQLite tables `employees`, `skills`, `leaves`,
`finance_history` (`db.py:36-125`). Thus ETS Genie answers over data that originates in the
Excel workbook.

**RAG corpus.** `backend/data/documents/*.md` → embedded into `backend/data/rag_index.db`
(§6).

**What breaks if the workbook is missing.** `DataLoader.load_data()` calls
`pd.read_excel(self.file_path, ...)`; if the file is absent at both resolved paths, pandas
raises `FileNotFoundError`. Because `db.SQLiteEngine` is instantiated at import time and reads
`data_loader.df_*` (`db.py:36, 72, 85, 102`), the AI stack cannot initialize — the backend
fails to load the copilot module/tables. The SQL and reasoning paths depend entirely on these
frames; without them there is no workforce data to query. (The RAG path depends on the
documents + Ollama, not the workbook.)

---

## 9. Error Handling & Governance

**Auth / roles on the endpoint.** The route `POST /api/copilot/query` is **not protected by a
FastAPI auth dependency** — it has no `Depends(...)` guard and accepts unauthenticated
requests (`copilot.py:15-16`). Instead it performs **in-handler** role derivation:
- Default `user_role="EMPLOYEE"`, `department=None` (`copilot.py:17-18`).
- If `Authorization: Bearer <token>` is present and valid, role/department come from the DB
  user record (`decode_access_token` + `get_user_by_id`, `copilot.py:21-29`).
- Unauthenticated callers attempting to assert a privileged `user_role` are logged and
  **clamped to EMPLOYEE** (`copilot.py:35-40`).
- Therefore an unauthenticated request still executes — but only with EMPLOYEE privileges.

**RBAC inside the orchestrator / semantic engine.** `SecurityContext.is_capability_authorized`
gates each capability (`orchestrator.py:1674-1707`, `engine.py:70-104`). Role → capability /
document-authorization mapping is in `ROLE_PERMISSIONS` (`security_context.py:14-75`):
EMPLOYEE has a fixed capability subset and doc auths `{ALL, EMPLOYEE}`; MANAGER /
HR_ANALYTICS / EXECUTIVE / ADMIN get `set(CapabilityEnum)` (all capabilities) with widening
document authorizations. EMPLOYEE is additionally blocked from individual compensation lookups
(`engine.py:106-150`). RAG retrieval filters documents by the caller's authorizations
(`vector_store.similarity_search`, §6).

**Safe failure modes (all return structured dicts, never crash the request):**
- `ACCESS_DENIED` / `UNAUTHORIZED` (RBAC) — `orchestrator.py:1676-1707`, `engine.py:72-150`.
- `UNSUPPORTED_DOMAIN` (out-of-domain / commercial-finance guardrails) —
  `orchestrator.py:1710-1764`.
- `NO_MATCH` (unrecognized entity) — `orchestrator.py:1766-1776+`.
- `DATA_INTEGRITY_VIOLATION` / `INVARIANT_FAILED` (invariant engine) —
  `orchestrator.py:2144-2182`, `engine.py:198-224`.
- `AI_UNAVAILABLE` (Ollama offline) — `orchestrator.py:2278-2310`.
- `PLANNER_FAILED` / `PLANNER_REJECTED` — `orchestrator.py:2333-2366`, `:2417-2451`.
- `RAG_NO_EVIDENCE` / `RAG_FAILED` — `orchestrator.py:2511-2575`.
- `SYNTHESIS_FAILED` — `orchestrator.py:2611-2644`.
- `GROUNDING_FAILED` (ungrounded claims blocked) — `orchestrator.py:2659-2702`.

**Timeouts.**
- Frontend axios: default `10000` ms (`client.ts:20`); **overridden to `240000` ms** for the
  copilot call (`client.ts:132`).
- Ollama generate: `timeout=120.0` s default (`ollama_client.py:40`); liveness check 5 s
  (`:28`); `/api/tags` listing 3 s (`model_gateway.py:73`); embeddings 15 s
  (`embedding_engine.py:45`).
- The orchestrator wraps the semantic-engine call in `try/except` and logs + continues on
  error (`orchestrator.py:1649-1661`); tool/SQL failures trigger a single controlled repair
  (`orchestrator.py:2379-2415`, `:2471-2486`).

---

## 10. Configuration (env vars / literals, file:line, defaults)

| Setting | File:line | Default |
|---------|-----------|---------|
| `ETS_USE_SEMANTIC_ENGINE` | `orchestrator.py:11` | `"true"` (enabled) |
| `ETS_RAG_MODEL` | `model_gateway.py:31` | `granite3.1-dense:8b` |
| `ETS_LOCAL_RAG_MODEL` | `model_gateway.py:34` | `qwen2.5:3b` |
| `ETS_SQL_MODEL` | `model_gateway.py:39` | `qwen2.5-coder:7b` |
| `ETS_LOCAL_SQL_MODEL` | `model_gateway.py:42` | `qwen2.5-coder:3b` |
| `ETS_EMBED_MODEL` | `model_gateway.py:46` | `bge-large-en-v1.5` |
| `ETS_LOCAL_EMBED_MODEL` | `model_gateway.py:49` | `nomic-embed-text:latest` |
| `ETS_REASONING_MODEL` | `model_gateway.py:53` | `granite3.1-dense:8b` |
| `ETS_LOCAL_REASONING_MODEL` | `model_gateway.py:56` | `qwen2.5:3b` |
| `ETS_VERIFIER_MODEL` | `model_gateway.py:60` | `qwen2.5:1.5b` |
| Ollama base URL | `ollama_client.py:9` | `http://localhost:11434` (hardcoded) |
| Ollama embed URL | `embedding_engine.py:12` | `http://localhost:11434/api/embeddings` (hardcoded) |
| Client default SQL/synthesis models | `ollama_client.py:10-11` | `qwen2.5-coder:3b` / `qwen2.5:3b` |
| Embedding model (active path) | `embedding_engine.py:13` | `nomic-embed-text:latest` (hardcoded) |
| Embedding dimension | `embedding_engine.py:23` | `768` |
| RAG min similarity | `semantic_rag.py:10` | `0.58` |
| Vector store min_score (default arg) | `vector_store.py:159` | `0.35` (overridden to `0.58` by `semantic_rag`) |
| RAG index DB path | `vector_store.py:11-13` | `backend/data/rag_index.db` |
| RAG documents dir | `document_indexer.py:12-14` | `backend/data/documents` |
| In-memory SQLite URI | `db.py:29` | `file:ets_memdb?mode=memory&cache=shared` |
| SQL allowed tables | `sql_governor.py:7` | `{employees, skills, leaves, finance_history}` |
| SQL max rows | `sql_governor.py:8` | `200` |
| Chunk size / overlap | `document_indexer.py:141` | `400` / `80` |
| Excel workbook | `data_loader.py:24` | `ETS_Dasboard_DS.xlsx` |
| axios copilot timeout | `client.ts:132` | `240000` ms |
| Ollama generate timeout | `ollama_client.py:40` | `120.0` s |

**UNKNOWN**: an environment override for the Ollama base URL — none found in
`ollama_client.py` / `embedding_engine.py` (both hardcode `localhost:11434`).

---

## 11. Known Limitations / Risks (observed in code only)

1. **No auth dependency on the endpoint.** `POST /api/copilot/query` has no FastAPI
   `Depends` guard; unauthenticated requests are accepted and run as `EMPLOYEE`
   (`copilot.py:15-40`). Authorization is enforced only by in-handler role derivation + the
   RBAC layer, not by rejecting anonymous requests.
2. **Mixed hardcoded vs. configurable models.** Chat models are env-configurable via the
   gateway, but the Ollama **host** is hardcoded in `ollama_client.py:9` and
   `embedding_engine.py:12`, and the **active embedding model** is hardcoded
   (`embedding_engine.py:13`), bypassing `configured_embedding_model`.
3. **Hard dependency on Ollama for AI + RAG.** AI-dependent queries and all embeddings have
   **no fallback**; if Ollama is down, those paths return `AI_UNAVAILABLE` / `RAG_FAILED`
   (`orchestrator.py:2278-2310`, `embedding_engine.py:18-19`).
4. **Hard dependency on the Excel workbook.** `db.py` builds tables at import time from
   `data_loader.df_*`; a missing `ETS_Dasboard_DS.xlsx` raises `FileNotFoundError` and the AI
   stack cannot initialize (§8).
5. **SQL restricted to four tables, SELECT-only, ≤200 rows.** Enforced by `sql_governor.py`
   (`ALLOWED_TABLES`, SELECT-only, `MAX_ROW_LIMIT=200`). Queries outside this allowlist are
   rejected.
6. **SQL built via f-string interpolation in `query_builder.py`.** Values pass through
   `_escape_literal` (single-quote doubling) rather than bound parameters
   (`query_builder.py:24-28`); `QueryPlan.params` is populated empty (`params={}`) across
   capabilities. (The outer `sql_governor` still validates the final SQL AST.)
7. **Static schema row counts.** `db.get_schema_summary` hardcodes counts (590/2177/799/1934)
   and category examples that may diverge from the actual loaded workbook
   (`db.py:155-201`).
8. **Legacy route disabled.** `DETERMINISTIC_SQL` raises `RuntimeError` if ever reached;
   deterministic work must flow through `MULTI_REQUIREMENT` (`orchestrator.py:2266-2272`).
9. **Response superset vs. Pydantic model.** The orchestrator returns keys beyond
   `CopilotQueryResponse`; FastAPI drops the extras from the HTTP body (§3.2), so some
   internal fields (e.g. `visual_target`) are not part of the declared contract.
10. **Vector store loads all chunks per query.** `similarity_search` selects every chunk and
    computes similarity in Python (`vector_store.py:174-213`) — a full scan per retrieval.
11. **RAG index built lazily at process start.** `SemanticRAG.__init__` triggers
    `sync_documents()` (`semantic_rag.py:22-29`); `backend/data/rag_index.db` is created on
    first run (not committed to the repo).

---

## Source Files Read

Backend (`backend/app/...`):
- `routers/copilot.py`
- `models.py` (CopilotQueryRequest/Response, ResultItem)
- `ai/orchestrator.py`
- `ai/model_gateway.py`, `ai/ollama_client.py`
- `ai/db.py`, `ai/sql_governor.py`, `ai/query_builder.py`
- `ai/vector_store.py`, `ai/document_indexer.py`, `ai/embedding_engine.py`, `ai/semantic_rag.py`
- `ai/tools.py`, `ai/call_tracker.py`, `ai/grounding.py`, `ai/evidence_collector.py`
- `ai/security_context.py`
- `ai/semantic/engine.py` (+ directory listing of `ai/semantic/*.py`)
- `ai/compositional.py`, `ai/capability_registry.py`, `ai/invariant_engine.py` (class/docstring/structure scans)
- `data_loader.py`, `main.py`

Frontend (`frontend/src/...`):
- `api/client.ts`
- `components/copilot/AICopilotDrawer.tsx`

Data (listed, not all opened):
- `backend/data/documents/*.md` (8 files), `backend/data/` (rag_index.db not present)
