from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from backend.app.routers import (
    home,
    statewise,
    employee_details,
    techwise,
    salarywise,
    salarywise2,
    calendar_leave,
    copilot,
    auth,
    dataset
)
from backend.app.security import require_roles

tags_metadata = [
    {
        "name": "System Health",
        "description": "API status, version, and operational health checks."
    },
    {
        "name": "Tab 1: Home Dashboard",
        "description": "Executive headcount KPIs, diversity ratios, recent hirings, attrition rates, and global slicer options."
    },
    {
        "name": "Tab 2: Statewise Dashboard",
        "description": "Regional workforce analytics, State Delivery Manager (SDM) resolution, experience distributions, and employee rosters."
    },
    {
        "name": "Tab 3: Employee Details",
        "description": "Employee 360 profile, competency skill pills, fresh edge skills, and multi-year financial history progression."
    },
    {
        "name": "Tab 4: Techwise Dashboard",
        "description": "Technical skill catalog, proficiency level distributions, Reporting Manager × Grade heatmap, and skill inventory."
    },
    {
        "name": "Tab 5: Salarywise Dashboard",
        "description": "Compensation analytics, Min/Max/Avg/Total base salary and CTC metrics, Manager × Grade CTC matrix, and top earners."
    },
    {
        "name": "Tab 6: Salarywise2 Dashboard",
        "description": "Longitudinal compensation progression, department base vs CTC comparisons, pre vs post promotion hikes, and salary band area charts."
    },
    {
        "name": "Tab 7: Employee Calendar",
        "description": "Attendance tracking, monthly leave schedule grid, daily roster inspector, project spread, and geography matrices."
    },
    {
        "name": "AI Copilot Agent",
        "description": "Conversational Natural Language workforce intelligence engine providing instant insights and automated chart rendering."
    }
]

app = FastAPI(
    title="ETS Employee Dashboard & Workforce Intelligence API",
    description="""
## Enterprise Workforce Analytics & AI Intelligence Gateway

This REST API provides multi-dimensional analytical endpoints powering the **ETS Employee Dashboard** across all 590 employees, 21 technical skills, 65 multi-year financial records, and 799 leave records.

### Key Capabilities:
* **Real-time Cross-filtering**: Slice data dynamically by State, Grade (E1–E10), Department, Location, Manager, and Salary Bins.
* **DAX & Vector Aggregations**: Fast in-memory analytics replicating Power BI logic.
* **AI Copilot NLP**: Ad-hoc natural language workforce intelligence queries.
    """,
    version="2.0.0",
    openapi_tags=tags_metadata,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

# Explicit trusted origins for CORS
ALLOWED_ORIGINS = [
    "http://localhost:42005",
    "http://127.0.0.1:42005",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all tab and auth routers
app.include_router(auth.router)
app.include_router(home.router)
app.include_router(statewise.router)
app.include_router(employee_details.router)
app.include_router(techwise.router)
app.include_router(salarywise.router)
app.include_router(salarywise2.router)
app.include_router(calendar_leave.router)
app.include_router(copilot.router)
app.include_router(dataset.router)

@app.get("/api/health", tags=["System Health"], summary="Check API operational health")
def health_check():
    return {
        "status": "healthy",
        "service": "ETS Employee Dashboard Backend",
        "version": "2.0.0",
        "docs_url": "/docs"
    }

@app.post(
    "/api/reload",
    tags=["System Health"],
    summary="Reload dataset from Excel workbook",
    dependencies=[Depends(require_roles(["ADMIN", "HR_ANALYTICS"]))]
)
def reload_dataset():
    from backend.app.data_loader import data_loader
    data_loader.load_data()
    return {
        "status": "reloaded",
        "total_employees": len(data_loader.df_employees),
        "total_skills": len(data_loader.df_skills)
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="127.0.0.1", port=42006, reload=True)
