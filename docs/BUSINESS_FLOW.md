# ETS Workforce Dashboard — Business Flow

Business names below are labels and strings in the UI, API metadata, or loader. They are cited. They are not inferred org-chart titles beyond those strings.

Workspace root:

`C:\Users\peernayakgarib\OneDrive - Infinite Computer Solutions (India) Limited\Documents\ETS_AI_Projects\ETS-Workspace-Dashboard-main\ETS-Workspace-Dashboard-main`

## Business problem

The running product is a workforce analytics dashboard over one Excel workbook.

- Page title: `ETS Workforce` (`frontend/index.html`).
- API title: `ETS Employee Dashboard & Workforce Intelligence API` (`backend/app/main.py`).
- `README.md` states the product analyzes human-resource, skill, compensation, and attendance data and names Power BI file `Emp_7.21.pbix`. That `.pbix` file is not in the workspace. The implemented reports are the React tabs and client CSV export, not a Power BI service.

The loader comment in `backend/app/data_loader.py` calls tenure “Infinite / ETS experience”. Seed account emails in `backend/app/auth_db.py` use the domain `infinite.com`. No other legal-entity string was required to describe the flows.

## Target users

People who sign in with a row in `users` (`backend/app/auth_db.py`). The five seeded roles and the labels shown in the UI (`ROLE_LABELS` in `frontend/src/utils/rbac.ts`):

| Role code | UI label | Seed username |
| :--- | :--- | :--- |
| `EMPLOYEE` | Employee | `employee` |
| `MANAGER` | Delivery Manager | `manager` |
| `HR_ANALYTICS` | HR Analytics | `hr_analytics` |
| `EXECUTIVE` | Executive Leadership | `executive` |
| `ADMIN` | System Admin | `admin` |

Signup (`frontend/src/components/auth/SignUp.tsx` posts to `POST /api/auth/signup`) can create more users. The handler stores a requested role when it is one of those five codes (`backend/app/routers/auth.py`).

## Roles and permissions

### Browser

`TAB_PERMISSIONS` in `frontend/src/utils/rbac.ts`:

| Surface | Who can open it in the UI |
| :--- | :--- |
| Workforce, Skills, Client Delivery, Leave, Employee Profile (`home`, `techwise`, `statewise`, `calendar`, `employee_details`) | All five roles |
| Compensation (`salarywise`, `salarywise2`) | `MANAGER`, `HR_ANALYTICS`, `EXECUTIVE`, `ADMIN` |
| Reload control (`reload`) | `HR_ANALYTICS`, `ADMIN` |

`ProtectedRoute` blocks `/dashboard` without a token and shows an access-restricted panel when `requiredTab` is set and `canAccessTab` is false.

### Server

Enforced with `require_roles` (`backend/app/security.py`):

| Action | Roles |
| :--- | :--- |
| `GET /api/salarywise/kpis` | `MANAGER`, `HR_ANALYTICS`, `EXECUTIVE`, `ADMIN` |
| `GET /api/salarywise2/kpis` | same |
| `POST /api/reload` | `ADMIN`, `HR_ANALYTICS` |

`GET /api/auth/me` requires a valid active user. Home, statewise, techwise, employee, calendar, dataset, health, signup, login, and password reset do not use `require_roles`.

Copilot (`POST /api/copilot/query`) uses the role on the user row when the bearer token decodes. With no valid token the role is `EMPLOYEE`. Capability sets are `ROLE_PERMISSIONS` in `backend/app/ai/security_context.py`. `EMPLOYEE` has a fixed capability set. The other four roles receive every `CapabilityEnum`. Document labels expand from `ALL` and `EMPLOYEE` through `MANAGER`, `HR`, `EXECUTIVE`, and `ADMIN` by role. The executive compensation markdown is tagged `EXECUTIVE` only (`backend/data/documents/executive_compensation_confidential.md`).

## Dashboard modules

Header tabs (`frontend/src/components/layout/Header.tsx`), `aria-label` “Executive Dashboards”:

| Id | Short label | Full label | Screen |
| :--- | :--- | :--- | :--- |
| `home` | Workforce | Workforce Overview | `frontend/src/components/tabs/HomeDashboard.tsx`. Under the two chart rows, a compact band shows the work-model mix and training counts. Open goes to Work model. The training card opens Profile on the training status (`#training-detail`). |
| `ai_utilization` | AI use | Decision Intelligence | `AIUtilizationDashboard.tsx`. Three pages under `.dash-fit.ai-util-fit` (`100%` / `100cqh`, no page scroll): Page 1 five KPIs (~3.25 lines) + health|attention + opp|quad (scatter dots drillable) + full-width ≤3-bullet narrative (no Manager league); Page 2 Project Intelligence (league + risk→Profile chips); Page 3 Release Deep Dive (contribution single-click → Profile). Mid/opp/quad panels fit without inner scroll. FilterBar: Project + Release + Manager (wired); Dept/Module hidden on this tab. Page 2/3 breadcrumb `AI use › project › release`. `GET /api/ai-utilization/kpis` (additive health/attention/quadrant/funnel/league plus Page 2–3 keys). |
| `work_model` | Work model | Work model | `WorkModelDashboard.tsx`. Fills the pane with `.dash-fit`: a compact strip for headcount and each arrangement (Office, Hybrid, Remote, Client site, Not recorded yet), six glass cards, and a roster that scrolls inside its card. The page itself does not scroll. The mix card is one 100% composition strip; every segment shows its count, including a small slice, which keeps a minimum width, and the caption under the strip is one row of five. When Client site or Not recorded yet does not fit, that caption uses Client and Unrecorded and keeps the full phrase in the title; the count and percent stay visible. A segment filters the roster the same way as the strip. A city, account, department, or office row filters the other cards and the roster to that value, and a second click clears it. The card that owns the filter keeps its other rows, so another city can be chosen while one is selected. A grade cell filters to that grade and that work model, and the same cell clears both; a grade heading filters to that grade. These filters compose with the work-model filter. Headcount clears the model, city, account, grade, department, and office filters. The roster chip lists them in short form, for example 171 people · Hyderabad · Hybrid. Mix, city, account, grade, department, and office counts are recomputed in the browser from that roster. City, account, department, and office are ranked lists that scroll inside the card as those lists grow. City is the name, headcount, a bar for the share of the largest city, and the leading arrangement (a tie reads Tied). Account is the code, headcount, one 100% mix strip, and the leading arrangement with its count. Grade is a heatmap that scrolls inside the card when there are many grades. Each row label paints once: Office, Hybrid, Remote, Client site, and Not recorded yet when the card is wide, and Office, Hybrid, Remote, Client, and Unrecorded when the card is narrow, with the full phrase in the title. A cell shows its count when the cell is at least about 16px. Department is one line: name, leading arrangement, and headcount. Office is one line: the building name, ellipsized only when the card is narrow, with the full name in the title, and the headcount. |
| `techwise` | Skills | Skills & Capability | `TechwiseDashboard.tsx` |
| `statewise` | Client Delivery | Client Program Delivery | `StatewiseDashboard.tsx` |
| `salarywise` | Compensation | Compensation Analytics | `SalarywiseDashboard.tsx` |
| `calendar` | Leave | Leave & Attendance | `EmployeeCalendarDashboard.tsx` |
| `employee_details` | Profile | Employee Profile | `Employee360Dashboard.tsx` or `EmployeeDetailsDashboard.tsx` |

Header chrome is one 48px row. Brand (icon + ETS WORKFORCE) and the right cluster (Roster, theme, refresh, fullscreen, ETS Genie icon, avatar) are flex-none. The tab pill is centered in the leftover middle slot and does not wrap: short labels at laptop widths (1366), full labels when the header is at least 1800px (1920). If the tab row still overflows, only that row scrolls horizontally so Profile stays reachable and the avatar stays pinned. Dataset / data source opens from the avatar menu (same modal as before). FilterBar height is unchanged.

OpenAPI tag descriptions in `backend/app/main.py` name the same areas: home headcount and attrition, statewise delivery and roster, employee 360, techwise skills, salarywise compensation, salarywise2 longitudinal compensation, employee calendar.

Compensation sub-views use `CompensationMode` `'overview' | 'trends'` (`frontend/src/components/layout/FilterBar.tsx`). `frontend/src/App.tsx` stores that mode and passes it to `SalarywiseDashboard`. Overview data is `SalarywiseKPIs`. The trends sub-view renders `Salarywise2Dashboard` from inside `SalarywiseDashboard.tsx`. Both salary API calls run when the compensation tab loads.

Profile sub-views: `profileViewMode` `'360'` or `'classic'` in `frontend/src/App.tsx`. The classic screen includes the control label `Switch to 360 Executive View (2026)`. On the classic view, `TrainingDetail` sits with the skills content. On the 360 view the columns are skills, then compensation, then Personal & Benefits. The skills card is two bands that share the column: Verified Capability about 60% and training about 40% (flex-grow 3:2). `TrainingDetail` sits in the lower band. With no rows it reads “Not recorded yet”, Each training record shows the full course name, then status, hours, date, and provider. The skills band stays at its content height, up to about half the card, and training uses the space below. That band scrolls only when the records are taller than the space left. The compensation year table sizes to its rows, and the chart uses the height that remains. The skills column is a little narrower than compensation, including on a tall window, in browser fullscreen, and when ETS Genie is docked (`lg:w-[260px]`). On the 360 view outside fullscreen the skills column is slightly narrower than compensation, and Personal & Benefits keeps its share. The hero states CTC in lakh, the grade comparison, ETS tenure in years, the join date, total experience, and promotion as labeled values, and the band is a little shorter than the previous one. Leave sits under Personal & Benefits: the donut, its center label, the type breakdown, the History line, and the used/left caption stay fully inside that card. The capability list keeps one line per skill. Classic Dossier fills the same pane, and the training line stays visible there too.

Filters shared across tabs are collected in `DashboardView` and rendered by `frontend/src/components/layout/FilterBar.tsx`. Options come from `GET /api/home/filters`.

## Reporting modules

| Report | Where it is produced |
| :--- | :--- |
| On-screen KPI cards and charts | Tab components, charts from `recharts` (`frontend/package.json`) |
| CSV download | `frontend/src/components/common/ExportButton.tsx` builds a CSV blob in the browser. Default filename `ets_dashboard_export.csv`. |
| Excel download of the master workbook | `GET /api/dataset/download` |
| Copilot chart or table in the drawer | `POST /api/copilot/query` response fields `chart`, `chart_data`, `result_items` (`backend/app/models.py`), rendered by `frontend/src/components/copilot/AICopilotDrawer.tsx` |
| Power BI `Emp_7.21.pbix` | Named in `README.md`. File not in the workspace. No Power BI runtime in `backend/` or `frontend/src`. |
| `pdfkit` | Declared in `frontend/package.json`. No import under `frontend/src`. |

There is no scheduled report job in `backend/app/main.py`.

## Data ingestion

```text
ETS_Dasboard_DS.xlsx
  sheets EMPLOYEES, SKILL, Finance_History, LEAVE
        |
        |  backend/app/data_loader.py  (import, and again on reload)
        v
pandas frames df_employees, df_skills, df_finance, df_leave
        |
        +--> backend/app/analytics.py     dashboard GET routes
        |
        '--> backend/app/ai/db.py         copilot SQL tables
```

Other ways the workbook is replaced, all in `backend/app/routers/dataset.py`:

| Action | Route | Result |
| :--- | :--- | :--- |
| Validate only | `POST /api/dataset/validate` | Report. Disk unchanged. |
| Upload | `POST /api/dataset/upload` | Backup under `dump/backups/`, replace master, `reload_all()` |
| Test link | `POST /api/dataset/test-url` | HTTP GET. Disk unchanged. |
| Cloud sync | `POST /api/dataset/sync-cloud` | Download, validate, backup, replace, `reload_all()`, config `source_type` `SHAREPOINT_URL` |

`POST /api/reload` calls `reload_all()`, which reloads pandas from `templates/Infinite_ETS_India_Workforce.xlsx` and `templates/Infinite_ETS_India_Compensation.xlsx` and rebuilds the in-memory SQL tables. Upload and cloud sync call the same function. Friendly, compensation, and legacy four-sheet workbooks are all accepted by validation.

Avatar menu item `aria-label` “Dataset operations and cloud sync” (label “Database / Data source”) opens `frontend/src/components/dataset/DatasetOperationsModal.tsx`. “Refresh dataset analytics” calls the reload client (`frontend/src/api/client.ts` `reloadDataset`).

## AI utilization (workbook + live tab)

The workforce file holds manager-filled sheets for the release-wise AI utilization report. The live header tab is **AI use** (`ai_utilization` → `AIUtilizationDashboard.tsx`). It is a **Decision Intelligence Dashboard** for VP / Delivery Director / SDM / QA Manager, not an AI-utilization volume report. Page 1 (15-second VP read): four KPIs (Adoption, Business Value, Hours Saved, Projects Requiring Attention), worst-first health tiles, Leadership Attention Zone, Opportunity Loss (Potential / Actual / Unrealized), Adoption×Value quadrant, manager league. Page 2: Dev vs QA butterfly, use-case effectiveness heatmap, release timeline, portfolio benchmark, QA maturity executive scorecard. Page 3: people contribution matrix (single-click / keyboard → Profile), custom SVG release flow, benefit waterfall, five-bullet narrative. Health = 0.30 Adoption + 0.25 Business Value vs target + 0.20 Release Coverage + 0.15 QA Adoption + 0.10 Documentation Usage (N/A weights renormalise). Drill Portfolio → Project → Release (`AI use › project › release`). FilterBar keeps Project + Release + Manager (wired); Dept/Module hidden on this tab; Export stays. Pane stays `.dash-fit.ai-util-fit` at `100%` / `100cqh` and collapses when Genie is docked. Roster-scale evidence is generated by `templates/_generate_ai_utilization_from_roster.py` (Source `Generated` / `Estimated-generated`); existing Cognos Manual/Estimated rows stay. The generator also ensures a **Maven** Account on People (~72 headcount from NH IT/Core/Informatica, Lists Account updated) so Portfolio health shows four projects and switches to compact rows at `HEALTH_COMPACT_AT = 4`.

| Sheet | Who fills it | What the boss gets |
| :--- | :--- | :--- |
| `AI release outcomes` | SDM (Domain `Development`) and QA Manager (Domain `QA`) | One row per release × domain × team (e.g. Cognos and Informatica each get their own Development row): tools, adoption, tokens, hours saved, measurable benefits, gaps, challenges, next-release opportunities |
| `AI utilization` | Same owners | Evidence rows: activities, tools/use cases, input/output tokens, hours saved; Team must match the outcomes row; blank employee number = team rollup |
| `AI tools catalog` | Platform / SDM | Shared tool and use-case names so squads do not invent columns |
| `Cursor billing` | Platform / SDM | Seat spend for the vendor billing cycle; joined by name / employee number on the tab |
| `AI targets` | Platform / SDM | Thresholds, loaded rate, and interim release order. Changing a Target and pressing Refresh rebands the dashboard. Missing sheet uses loader defaults. |

Employee intake before the master workbook:

Use `templates/AI_Team_Intake.xlsx` (also saved as `AI_Team_Intake_Cognos.xlsx`). Each row carries its own **Project**, **Release**, and period dates so NH, AK, ND, NH enhancements, and Maven examples can differ. Shared people add one row per project. `templates/_sync_ai_intake_to_master.py` rolls completed rows into the master AI sheets.

How managers fill a release (master workbook, after intake):

1. Confirm tools on `AI tools catalog` (or add an approved tool there and on Lists). Cursor is enough today; Claude and others stay listed for later.
2. Copy intake rows into `AI utilization` with **Project**, **Team**, and matching dates. Prefer Export for tokens when a vendor CSV exists; otherwise Manual or Estimated and say so in Source.
3. Write one executive row on `AI release outcomes` per **Release × Domain × Team × Project** (Cognos NH is separate from Informatica NH and from Cognos on NH enhancements). Adoption % and Total tokens should match the evidence for that slice.
4. Keep `Cursor billing` current for the cycle; it is not the same grain as a release window.
5. Set Status to Submitted. Do not store secrets, API keys, or raw client PII—token counts and hours only.

API: `GET /api/ai-utilization/kpis` (`backend/app/routers/ai_utilization.py` → `analytics_engine.get_ai_utilization_kpis`). RBAC: same roles as Work model. SharePoint sync continues to use the existing workforce file URL.

## Processing

`load_data` in `backend/app/data_loader.py`:

- Parses dates, experience, CTC, monthly salary, gender, location, state, project, grade, department, manager.
- Builds `SalaryBin` from `EMP_CTC1`.
- Attaches primary and secondary skills onto each employee.
- Computes `Total_CTC` on finance rows.
- For employees with no `Finance_History` row, appends synthetic yearly rows (`record_origin` `SYNTHETIC_DERIVED`).
- Parses leave employee ids from the `EMPLOYEE` text and merges org columns.

`backend/app/analytics.py` then filters those frames and returns the Pydantic KPI models. Copilot questions go to `llm_orchestrator.process` (`backend/app/ai/orchestrator.py`), which can query the memory SQLite tables and the RAG index. Model text is requested from Ollama only when that path runs (`backend/app/ai/ollama_client.py`).

## Login to report

```text
Browser opens / 
    -> redirect /dashboard
    -> no token: ProtectedRoute -> /login
    -> POST /api/auth/login
    -> localStorage ets_auth_token + ets_auth_user
    -> /dashboard
    -> Header tabs filtered by rbac.ts
    -> active tab GET /api/<module>/...
    -> charts and tables in the tab component
    -> optional CSV via ExportButton
    -> optional employee drawer GET /api/employee/{id}
    -> optional ETS Genie POST /api/copilot/query
```

Password recovery: `/forgot-password` and `/reset-password` both render `ForgotPassword.tsx`. `POST /api/auth/forgot-password` returns `reset_token` in JSON when the account exists and is active. `POST /api/auth/reset-password` sets the new password. No email sender is in the backend.

## End-to-end data movement

```text
Operator workbook (local xlsx or OneDrive/SharePoint URL)
        |
        v
dump backup (on upload or cloud sync only)
        |
        v
ETS_Dasboard_DS.xlsx on the API machine
        |
        v
pandas in the API process
        |
        +---> REST JSON to the browser (Axios /api)
        |         |
        |         +---> Recharts and tables
        |         '----> CSV file in the browser
        |
        '----> in-memory SQLite (copilot)
                  |
                  +---> optional Ollama http://localhost:11434
                  '----> RAG chunks from backend/data/documents/*.md
                            stored in backend/data/rag_index.db

Sign-in path (separate database):
  login form -> users in backend/data/ets_auth.db -> JWT -> localStorage
```

Auth data does not flow through the Excel file, except that signup copies `employee_number` and `department` when the email matches an `EMAIL` cell (`backend/app/routers/auth.py`).

## Critical business processes

1. **Sign in and open a tab.** Login issues a 24-hour HS256 JWT (`backend/app/security.py`). The dashboard shell will not render without it (`ProtectedRoute`).
2. **Slice the workforce.** Filter bar query params are applied in `apply_employee_filters` (`backend/app/analytics.py`). `App.tsx` reloads the active tab when filters change.
3. **Read headcount, delivery, skills, and leave.** Those GET routes have no server role check. The UI still hides nothing on those tabs for the five roles.
4. **Read compensation.** UI hides the tab from `EMPLOYEE`. The API returns 403 for roles outside `MANAGER`, `HR_ANALYTICS`, `EXECUTIVE`, `ADMIN`.
5. **Open one employee.** Roster and profile call `GET /api/employee/list` and `GET /api/employee/{emp_number}`. Unknown id is HTTP 404.
6. **Ask ETS Genie.** Drawer `aria-label` “Toggle ETS Genie assistant” (`Header.tsx`). Questions post to `/api/copilot/query`. Unauthenticated calls are treated as `EMPLOYEE`.
7. **Replace the workbook.** Dataset modal upload or cloud sync validates the four sheets, writes a timestamped backup, and hot-reloads pandas and memory SQL.
8. **Reload from the header.** `POST /api/reload` is limited to `ADMIN` and `HR_ANALYTICS` and refreshes pandas only.
9. **Reset a password.** Token is returned on the forgot-password response and consumed by reset-password. Expiry 15 minutes (`backend/app/routers/auth.py`).
