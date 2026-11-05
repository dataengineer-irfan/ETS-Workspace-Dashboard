# ETS Workforce Dashboard — Database Schema

Schema as created by application code. The Excel workbook is not in the workspace, so sheet columns below are the names the loader and the dataset validator read, not a dump of the file.

Workspace root:

`C:\Users\peernayakgarib\OneDrive - Infinite Computer Solutions (India) Limited\Documents\ETS_AI_Projects\ETS-Workspace-Dashboard-main\ETS-Workspace-Dashboard-main`

## Summary

| Store | Engine | Location | Survives process exit |
| :--- | :--- | :--- | :--- |
| Workforce source | Excel `.xlsx` via pandas / openpyxl | `<repo>/templates/Infinite_ETS_India_Workforce.xlsx`. Pay is `<repo>/templates/Infinite_ETS_India_Compensation.xlsx`. If the opened file has the legacy sheets `EMPLOYEES`, `SKILL`, `Finance_History`, and `LEAVE`, that file is loaded instead (`backend/app/data_loader.py`). | Yes, if the file exists |
| Authentication | SQLite `sqlite3` | `backend/data/ets_auth.db` | Yes |
| Copilot analytical tables | SQLite in-memory URI | `file:ets_memdb?mode=memory&cache=shared` (`backend/app/ai/db.py`) | No |
| RAG index | SQLite file | `backend/data/rag_index.db` (`backend/app/ai/vector_store.py`) | Yes |

No ORM. No migration directory. No `CREATE VIEW`. No `CREATE PROCEDURE`. Search of `backend/app` for those statements and for `alembic` returned no matches.

`get_schema_summary()` in `backend/app/ai/db.py` is a prompt string for the copilot. It labels `employee_number` as `PK` and skills `employee_number` as `FK`, and it states row counts (590 employees, 2177 skills, and further counts in the rest of that string). Those labels are text in the prompt. The `CREATE` statements that actually run are the indexes after `to_sql`. Pandas `to_sql(..., if_exists="replace")` does not add primary keys or foreign keys. Row counts in that string and in the FastAPI description in `backend/app/main.py` (590 employees, 21 technical skills, 65 financial records, 799 leave records) were not verified against a workbook, because the workbook is absent.

## Views

None.

## Stored procedures

None.

## Migrations

None. Each store uses `CREATE TABLE IF NOT EXISTS` (auth and RAG) or `to_sql` replace (memory tables) at import time.

## 1. Excel source

Path construction in `DataLoader.__init__` (`backend/app/data_loader.py`):

1. `os.path.dirname` three times from `backend/app/data_loader.py` (the repository root) joined with `ETS_Dasboard_DS.xlsx`.
2. If that path does not exist, `ETS_Dasboard_DS.xlsx` (relative to the process working directory).

Workspace file search found no `.xlsx` and no `.pbix`. Whether a copy exists outside the indexed tree is UNKNOWN. The file that would resolve the full sheet layout is that workbook.

### Sheet `EMPLOYEES`

Read with `skiprows=2`. Columns whose names start with `Unnamed:` are dropped.

Columns the loader reads (missing columns raise from pandas when the line runs):

| Column | Use in `load_data` |
| :--- | :--- |
| `EMPLOYEE NUMBER` | numeric, rows with value `<= 0` dropped |
| `START DATE` | datetime |
| `EXIT DATE` | datetime |
| `DATE OF BIRTH` | datetime |
| `Prior EXPERIENCE1` | numeric → `Prior_Exp` |
| `EMP_CTC1` | numeric |
| `M_Salary` | numeric; if missing values, filled with `EMP_CTC1 / 12` |
| `Prev_CTC2` | numeric |
| `Last_Bonus` | numeric |
| `Hike_Percentage` | numeric |
| `GENDER` | text, empty → `Unknown` |
| `LOCATION` | text, empty → `Unknown` |
| `State` | text, empty → `Unknown` |
| `Project Working` | text; empty filled from `State`; value `NH Projects` replaced with `NH` |
| `JOB LEVEL` | text, empty → `Unknown` |
| `JOB TITLE` | text, empty → `Unknown` |
| `DEPARTMENT` | text, empty → `Core` |
| `MANAGER` | text, empty → `Unassigned` |
| `EMPLOYEE LABEL` | text; if empty, built from first name, last name, and employee number |
| `EMPLOYEE FIRST NAME` | used in the label fallback |
| `EMPLOYEE LAST NAME` | used in the label fallback |
| `EMAIL` | read later by signup matching and by `ai/db.py` |
| `Module` | optional. If the column is absent, the loader sets `Module` to None |

Derived frame columns (not Excel headers): `Prior_Exp`, `Infinite_Exp`, `Total_Exp`, `SalaryBin`, `Primary_Skill`, `Primary_Skill_Exp`, `Primary_Skill_Level`, `Secondary_Skills`, `All_Skills`.

`SalaryBin` bins in `get_salary_bin`: `< 5L` if CTC `< 500000`, `5-10L` if `< 1000000`, `10-15L` if `< 1500000`, `15-20L` if `< 2000000`, else `20L+`.

`REF_DATE` for tenure when `EXIT DATE` is null: `2024-10-10`.

Dataset validator required subset (`backend/app/routers/dataset.py` `REQUIRED_COLUMNS`): `EMPLOYEE NUMBER`, `START DATE`, `EMP_CTC1`, `GENDER`, `LOCATION`, `State`.

### Sheet `SKILL`

No `skiprows`.

| Column | Use |
| :--- | :--- |
| `EMPLOYEE NUMBER` | numeric |
| `Skill Name` | text; blank names dropped |
| `Skill Level` | text, empty → `Intermediate` |
| `Skill Type` | text, empty → `Primary` |
| `Skill_Exp` | numeric via `df_skill.get('Skill_Exp', 0)`; missing column becomes 0 |
| `IsActive` | text, empty → `Yes` |
| `Skill Category` | read by `backend/app/ai/db.py` when building `skills.skill_category` |

Rows with empty `Skill Name` are removed.

### Sheet `Finance_History`

No `skiprows`.

| Column | Use |
| :--- | :--- |
| `EMPLOYEE NUMBER` | numeric; rows `<= 0` dropped |
| `Year` | numeric, empty → `2024` |
| `Base_Salary` | numeric |
| `Bonus` | numeric |
| `Perks` | numeric |
| `Other_Comp` | numeric |
| `Is_Promotion` | text, empty → `No` |
| `Hike` | used when computing year-over-year change; missing values filled later |

Derived on Excel-sourced rows: `Total_CTC` = base + bonus + perks + other, `M_Salary` = `Total_CTC / 12`, `record_origin` `EXCEL_SOURCE`, `is_synthetic` false, `derivation_rule` `EXCEL_FINANCE_HISTORY_SHEET`.

Employees present on `EMPLOYEES` and absent from this sheet receive extra rows in the pandas frame with `record_origin` `SYNTHETIC_DERIVED`, `is_synthetic` true, `derivation_rule` `HEURISTIC_WORKFORCE_PROGRESSION_V1`. Years written depend on `START DATE` year (2024, and 2023–2020 when join year is at or before that year). The formulas are in `load_data` in `backend/app/data_loader.py`.

After synthesis, the frame is merged to employee columns `EMPLOYEE LABEL`, `JOB LEVEL`, `DEPARTMENT`, `LOCATION`, `State`, `MANAGER`, `Project Working`, `Module`.

Validator required subset: `EMPLOYEE NUMBER`, `Year`, `Base_Salary`.

### Sheet `LEAVE`

`skiprows=2`. `Unnamed:` columns dropped.

| Column | Use |
| :--- | :--- |
| `EMPLOYEE` | text. Employee id parsed from the last parenthetical integer. Stored as `EMPLOYEE NUMBER`. |
| `START DATE` | datetime |
| `END DATE` | datetime |
| `LEAVE TYPE` | text, empty → `Casual / Sick` |
| `DAY VALUE` | numeric, empty → `1.0` |
| `LEAVE TYPE SYMBOL` | text, empty → `C` |

Merged to employee columns `EMPLOYEE FIRST NAME`, `EMPLOYEE LAST NAME`, `JOB LEVEL`, `DEPARTMENT`, `LOCATION`, `State`, `MANAGER`, `Project Working`, `Module`.

Validator required subset: `EMPLOYEE`, `START DATE`, `END DATE`, `DAY VALUE`. The validator does not require `LEAVE TYPE`.

### Relationship in the workbook

There is no database foreign key. The loader joins skills, finance, and leave to employees on `EMPLOYEE NUMBER` (leave ids are parsed from `EMPLOYEE` text first).

### Friendly workforce sheets `AI utilization`, `AI release outcomes`, `AI tools catalog`, `AI targets`, `Cursor billing`

Present on `templates/Infinite_ETS_India_Workforce.xlsx` (built by `templates/_build_india_template.py`, patched by `templates/_add_ai_utilization_sheets.py`, rolled from `templates/AI_Team_Intake.xlsx` via `templates/_sync_ai_intake_to_master.py`, and bulk-filled from People by `templates/_generate_ai_utilization_from_roster.py`). Loaded by `data_loader.py` into `df_ai_utilization`, `df_ai_outcomes`, `df_cursor_billing`, plus `ai_targets` / `ai_release_order` / `ai_target_rows`. EXAMPLE instruction rows are dropped. The live tab is `ai_utilization` (`GET /api/ai-utilization/kpis`). When `AI targets` is absent the loader uses built-in defaults so the API still returns Page 1 scores. The roster generator is idempotent: it replaces only `Generated` / `Estimated-generated` activity rows and outcome rows with `Reviewed by = Generated`. Manual, Export, and existing Cognos intake rows are left in place. It also ensures Account `Maven` on People (~72 from NH IT/Core/Informatica) and Lists so filters and Portfolio health include four projects. Loader `_drop_example_text_rows` matches the whole token `EXAMPLE` only (not the substring inside ordinary words like “examples”).

Domain values are only `Development` and `QA` (one Domain column; not separate Dev/QA sheets). Lists dropdowns: `AI domain`, `AI domain fit`, `AI tool`, `AI provider`, `AI use case`, `AI source`, `AI outcome status`.

#### Sheet `AI utilization` (activity + tokens)

Grain: one row per person or team × release × domain × tool × use case. Blank `Employee number` is a team rollup for the SDM or QA Manager. Amber `EXAMPLE` row is ignored the same way as other template examples.

| Column | Required | Notes |
| :--- | :--- | :--- |
| Release | Yes | e.g. `2026.10` |
| Domain | Yes | `Development` or `QA` |
| Team | Yes | Squad / module |
| Manager | Yes | SDM or QA Manager who owns the row |
| Employee number | No | Link to People when known |
| Employee name | No | Display aid |
| Period start / Period end | Yes | Release window |
| Tool / Provider / Use case | Yes | From Lists / catalog |
| Activity | Yes | What was done |
| Request count | No | |
| Input tokens / Output tokens | Yes for token tracking | |
| Total tokens | Derived | Excel formula Input + Output |
| Hours saved | Yes | Effort savings |
| Baseline hours without AI | No | Credibility for savings |
| Benefit note | No | Short measurable outcome |
| Source | No | `Manual` / `Export` / `Estimated` |
| Challenges / Notes | No | |
| Sprint, Project, Account, Cached input tokens, Cost (USD), Accepted lines, Generated lines, Policy flag, External id | No | Phase-2 / vendor-export columns; leave blank until needed |
| Test cases generated, Automation assets, Artifacts generated, Story ids | No | Page 3 QA / artifact columns. Missing cells load as blank. |
| Source | No | `Manual` / `Export` / `Estimated` for intake. Roster generator uses `Generated` or `Estimated-generated` and only replaces those on re-run. |

#### Sheet `AI release outcomes` (executive page)

Grain: one row per **Release × Domain × Team** (e.g. `2026.10` + `Development` + `Cognos`, and a separate row for `Informatica`).

| Column | Required | Notes |
| :--- | :--- | :--- |
| Release / Domain / Team / Owner | Yes | Team is the squad (Cognos, Informatica, …). Owner is SDM or QA Manager |
| Headcount in scope / People using AI | Yes | Adoption denominator / numerator for that team |
| Adoption % | Derived | People using AI ÷ Headcount |
| Total tokens / Total hours saved | Yes | Roll up from `AI utilization` for the same Release + Domain + Team |
| Tools used / Top use cases | Yes | |
| Measurable benefits / Gaps / Challenges / Opportunities next release | Yes | Boss narrative |
| Status | Yes | `Draft` / `Submitted` / `Reviewed` |
| Submitted on / Reviewed by | No | Generator marks `Reviewed by = Generated` so re-runs can replace those rows only |
| Project | No | Account / project code (NH, ND, AK). Existing Cognos rows may omit it; loader infers from activity. |
| Stories delivered, Stories using AI, Defects baseline, Defects actual, Cycle time days saved, Release sequence, Release date | No | Page 3 summary / waterfall. Missing cells render as n/a. |

#### Sheet `AI tools catalog`

Shared vocabulary: Tool, Provider, Domain fit (`Development` / `QA` / `Both`), Allowed use cases (pipe-separated), Active, Security notes, Owner.

#### Sheet `AI targets`

Parameter table for the AI use Executive Command Center (not transactional). Columns A–F: `Metric`, `Target`, `Tolerance`, `Lower_Is_Better`, `Unit`, `Notes`. Columns H–I: `Release`, `Sequence` (interim release order until `AI release outcomes` has `Release_Sequence`). Default rows: `Adoption_Pct` 80, `Dev_Adoption_Pct` 80, `QA_Adoption_Pct` 50, `Hours_per_User` 8, `Hours_per_100USD` 30, `Hours_per_100kTokens` 20, `Release_Coverage_Pct` 100, `ROI_Index` 5, `Loaded_Rate_USD` 40, `Loaded_Rate_INR` 3000, `Attention_Adoption_Pct` 60, `Trend_Decline_Pts` 5. Reload stat: `ai_target_rows`.

#### Sheet `Cursor billing`

Vendor seat spend for the billing cycle (often not the same window as a release). Columns: Name, Total Usage (USD), Month, Billing Start Date, Billing End Date, optional Employee number / Team / Project.

## 2. Authentication SQLite

File: `backend/app/auth_db.py`. Created by `init_auth_db()` at import. `PRAGMA foreign_keys = ON` on each connection.

### Table `users`

| Column | DDL |
| :--- | :--- |
| `user_id` | `INTEGER PRIMARY KEY AUTOINCREMENT` |
| `username` | `TEXT NOT NULL UNIQUE COLLATE NOCASE` |
| `email` | `TEXT NOT NULL UNIQUE COLLATE NOCASE` |
| `password_hash` | `TEXT NOT NULL` |
| `role` | `TEXT NOT NULL DEFAULT 'EMPLOYEE'` |
| `is_active` | `INTEGER NOT NULL DEFAULT 1` |
| `employee_number` | `INTEGER NULL` |
| `department` | `TEXT NULL` |
| `created_at` | `TEXT NOT NULL DEFAULT (DATETIME('now'))` |
| `updated_at` | `TEXT NOT NULL DEFAULT (DATETIME('now'))` |

Indexes: `idx_users_username` on `username`, `idx_users_email` on `email`, `idx_users_emp_no` on `employee_number`.

`employee_number` is not a foreign key to the workforce tables. Workforce data is a different database.

Seed when `COUNT(*)` of `users` is 0 (usernames and roles only; password literals stay in `backend/app/auth_db.py`):

| username | email | role | employee_number | department |
| :--- | :--- | :--- | :--- | :--- |
| `admin` | `admin@infinite.com` | `ADMIN` | null | `Executive` |
| `executive` | `executive@infinite.com` | `EXECUTIVE` | null | `Leadership` |
| `hr_analytics` | `hr@infinite.com` | `HR_ANALYTICS` | null | `Human Resources` |
| `manager` | `manager@infinite.com` | `MANAGER` | `1004641` | `Core` |
| `employee` | `employee@infinite.com` | `EMPLOYEE` | `1019272` | `IT` |

### Table `password_reset_tokens`

| Column | DDL |
| :--- | :--- |
| `token_id` | `INTEGER PRIMARY KEY AUTOINCREMENT` |
| `user_id` | `INTEGER NOT NULL` |
| `token_hash` | `TEXT NOT NULL UNIQUE` |
| `expires_at` | `TEXT NOT NULL` |
| `is_used` | `INTEGER NOT NULL DEFAULT 0` |
| `created_at` | `TEXT NOT NULL DEFAULT (DATETIME('now'))` |

Foreign key: `user_id` references `users(user_id)` `ON DELETE CASCADE`.

Indexes: `idx_reset_token_hash` on `token_hash`, `idx_reset_user_id` on `user_id`.

`create_password_reset_token` sets existing unused tokens for that user to `is_used = 1` before insert. The hash is SHA-256 hex of the raw token (`backend/app/security.py` `hash_token`).

### Auth relationship diagram

```text
users.user_id  1 ----<  password_reset_tokens.user_id
                         ON DELETE CASCADE
```

## 3. In-memory workforce SQLite

Connection in `SQLiteEngine._init_database` (`backend/app/ai/db.py`):

`sqlite3.connect("file:ets_memdb?mode=memory&cache=shared", uri=True, check_same_thread=False)`

Tables are replaced on every `_populate_tables()` call. Column types are whatever pandas `to_sql` infers (integers and floats from the sanitized series, text as strings). There is no explicit `CREATE TABLE` for these four tables.

### Table `employees`

Source frame: `data_loader.df_employees`.

| Column | Sanitizer |
| :--- | :--- |
| `employee_number` | int from `EMPLOYEE NUMBER` |
| `first_name` | text `EMPLOYEE FIRST NAME` |
| `last_name` | text `EMPLOYEE LAST NAME` |
| `employee_label` | text `EMPLOYEE LABEL` |
| `email` | text `EMAIL` |
| `gender` | text `GENDER` |
| `location` | text `LOCATION` |
| `state` | text `State` |
| `department` | text `DEPARTMENT` |
| `job_level` | text `JOB LEVEL` |
| `job_title` | text `JOB TITLE` |
| `manager` | text `MANAGER` |
| `project` | text `Project Working` |
| `current_status` | `Exited` if `EXIT DATE` is not null, else `Active` |
| `start_date` | date string `YYYY-MM-DD` |
| `exit_date` | date string |
| `annual_ctc` | numeric `EMP_CTC1` |
| `monthly_salary` | numeric `M_Salary` |
| `prior_exp` | numeric `Prior_Exp` |
| `infinite_exp` | numeric `Infinite_Exp` |
| `total_exp` | numeric `Total_Exp` |
| `salary_bin` | text `SalaryBin` |
| `primary_skill` | text `Primary_Skill` |
| `primary_skill_exp` | numeric |
| `primary_skill_level` | text |
| `module` | text `Module` (empty when the source cell is blank) |
| `date_of_birth` | date string |
| `age` | int, days from `DATE OF BIRTH` to `pd.Timestamp.now()` divided by 365.25 |

Indexes: `idx_emp_num (employee_number)`, `idx_emp_status (current_status)`, `idx_emp_level (job_level)`, `idx_emp_state (state)`, `idx_emp_mgr (manager)`, `idx_emp_proj (project)`, `idx_emp_age (age)`.

### Table `skills`

Source: `data_loader.df_skills`.

| Column | Source |
| :--- | :--- |
| `employee_number` | `EMPLOYEE NUMBER` |
| `skill_name` | `Skill Name` |
| `skill_type` | `Skill Type` |
| `skill_level` | `Skill Level` |
| `skill_exp` | `Skill_Exp` |
| `skill_category` | `Skill Category` |
| `is_active` | `IsActive` |

Indexes: `idx_sk_emp (employee_number)`, `idx_sk_name (skill_name)`.

### Table `leaves`

Source: `data_loader.df_leave`.

| Column | Source |
| :--- | :--- |
| `employee_number` | `EMPLOYEE NUMBER` |
| `start_date` | `START DATE` |
| `end_date` | `END DATE` |
| `leave_type` | `LEAVE TYPE` |
| `day_value` | `DAY VALUE` |
| `job_level` | `JOB LEVEL` |
| `department` | `DEPARTMENT` |
| `location` | `LOCATION` |
| `state` | `State` |
| `manager` | `MANAGER` |
| `project` | `Project Working` |

Indexes: `idx_lv_emp (employee_number)`, `idx_lv_type (leave_type)`.

`LEAVE TYPE SYMBOL` is on the pandas frame and is not copied into this SQL table.

### Table `finance_history`

Source: `data_loader.df_finance` (Excel rows plus synthetic rows).

| Column | Source |
| :--- | :--- |
| `employee_number` | `EMPLOYEE NUMBER` |
| `year` | `Year` |
| `base_salary` | `Base_Salary` |
| `bonus` | `Bonus` |
| `perks` | `Perks` |
| `other_comp` | `Other_Comp` |
| `is_promotion` | `Is_Promotion` |
| `monthly_salary` | `M_Salary` |
| `total_ctc` | `Total_CTC` |
| `hike_percent` | `Hike` |
| `salary_bin` | `SalaryBin` |
| `job_level` | `JOB LEVEL` |
| `department` | `DEPARTMENT` |
| `location` | `LOCATION` |
| `state` | `State` |
| `manager` | `MANAGER` |
| `project` | `Project Working` |
| `record_origin` | `record_origin`, default text `EXCEL_SOURCE` |
| `is_synthetic` | int from `is_synthetic` |
| `derivation_rule` | `derivation_rule` |

Index: `idx_fn_emp_yr (employee_number, year)`.

### Logical links (not enforced)

```text
employees.employee_number
    |-- skills.employee_number          (index only)
    |-- leaves.employee_number          (index only)
    '-- finance_history.employee_number (index only)
```

Dashboard KPI routes do not query these tables. They aggregate pandas frames in `backend/app/analytics.py`. The memory tables are the copilot SQL source (`sqlite_engine.execute_query`).

## 4. RAG SQLite

File: `backend/app/ai/vector_store.py`. `PRAGMA foreign_keys` is not set in `_init_db`. The `FOREIGN KEY` clause is still in the `CREATE TABLE` for `rag_chunks`. SQLite enforces it only when foreign keys are enabled on that connection. This file’s `_get_connection` does not execute `PRAGMA foreign_keys = ON`. Enforcement at runtime is therefore off unless another connection on the same database enabled it. The DDL still declares the reference.

### Table `rag_documents`

| Column | DDL |
| :--- | :--- |
| `document_id` | `TEXT PRIMARY KEY` |
| `document_name` | `TEXT NOT NULL` |
| `document_type` | `TEXT NOT NULL` |
| `source` | `TEXT NOT NULL` |
| `version` | `INTEGER NOT NULL DEFAULT 1` |
| `content_hash` | `TEXT NOT NULL` |
| `authorizations` | `TEXT NOT NULL` (JSON text) |
| `created_at` | `TEXT NOT NULL` |
| `updated_at` | `TEXT NOT NULL` |

Index: `idx_rag_docs_hash` on `content_hash`.

### Table `rag_chunks`

| Column | DDL |
| :--- | :--- |
| `chunk_id` | `TEXT PRIMARY KEY` |
| `document_id` | `TEXT NOT NULL` references `rag_documents(document_id)` `ON DELETE CASCADE` |
| `chunk_index` | `INTEGER NOT NULL` |
| `text` | `TEXT NOT NULL` |
| `metadata` | `TEXT NOT NULL` |
| `embedding_model` | `TEXT NOT NULL` |
| `embedding` | `BLOB NOT NULL` |

Index: `idx_rag_chunks_doc` on `document_id`.

### Markdown sources indexed

`backend/app/ai/document_indexer.py` reads `backend/data/documents/`. Front matter `authorizations` from those files:

| File | `document_id` | `authorizations` |
| :--- | :--- | :--- |
| `headcount_definitions.md` | `doc_headcount_definitions` | `ALL` |
| `attrition_calculation.md` | `doc_attrition_calculation` | `ALL` |
| `grade_progression_ladder.md` | `doc_grade_hierarchy` | `ALL` |
| `experience_tenure_structure.md` | `doc_experience_tenure` | `ALL` |
| `skills_competency_matrix.md` | `doc_skills_competency` | `ALL` |
| `compensation_structure.md` | `doc_compensation_structure` | `ALL` |
| `leave_policy.md` | `doc_leave_policy` | `ALL` |
| `executive_compensation_confidential.md` | `doc_exec_confidential` | `EXECUTIVE` |

Role labels that may read documents are in `ROLE_PERMISSIONS` in `backend/app/ai/security_context.py`, not in the SQLite DDL.

## 5. Non-database files written by dataset routes

Not tables. Created when dataset endpoints run (`backend/app/routers/dataset.py`):

| Path | Contents |
| :--- | :--- |
| `dump/dataset_config.json` | `source_type`, `cloud_url`, `last_synced`, `auto_sync_enabled`, `sync_cadence` |
| `dump/backups/ETS_Dasboard_DS_backup_<timestamp>.xlsx` | copy of the previous master workbook |

## Relationship across stores

```text
ETS_Dasboard_DS.xlsx
    |  data_loader.py (pandas)
    +--> in-memory employees / skills / leaves / finance_history
    |
    '--> (no FK) auth users.employee_number is an optional integer column

backend/data/documents/*.md
    '--> rag_documents / rag_chunks
```

Auth SQLite and workforce SQLite are not the same database file and have no cross-database foreign key.
