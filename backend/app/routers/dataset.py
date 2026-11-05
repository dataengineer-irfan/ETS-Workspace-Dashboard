import os
import io
import re
import json
import time
import shutil
import logging
import datetime
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, UploadFile, File, HTTPException, Request, Depends, Query
from starlette.responses import FileResponse
import pandas as pd
import requests

from backend.app.data_loader import data_loader, reload_all

logger = logging.getLogger("dataset_router")

router = APIRouter(prefix="/api/dataset", tags=["Dataset Management"])

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BACKUP_DIR = os.path.join(BASE_DIR, "dump", "backups")
CONFIG_PATH = os.path.join(BASE_DIR, "dump", "dataset_config.json")

# Legacy four-sheet workbook. Kept so an upload of that file still validates.
REQUIRED_SHEETS = ["EMPLOYEES", "SKILL", "Finance_History", "LEAVE"]
FRIENDLY_SHEETS = ["People", "Skills", "Leave"]
COMPENSATION_SHEETS = ["Current pay", "Pay history"]

REQUIRED_COLUMNS = {
    "EMPLOYEES": ["EMPLOYEE NUMBER", "START DATE", "EMP_CTC1", "GENDER", "LOCATION", "State"],
    "SKILL": ["EMPLOYEE NUMBER", "Skill Name"],
    "Finance_History": ["EMPLOYEE NUMBER", "Year", "Base_Salary"],
    "LEAVE": ["EMPLOYEE", "START DATE", "END DATE", "DAY VALUE"],
}
FRIENDLY_COLUMNS = {
    "People": ["Employee number", "First name", "Last name", "City", "Account", "Start date"],
    "Skills": ["Employee number", "Skill"],
    "Leave": ["Employee number", "Start date", "End date", "Leave type", "Days"],
}
COMPENSATION_COLUMNS = {
    "Current pay": ["Employee number", "Annual CTC (INR)"],
    "Pay history": ["Employee number", "Year", "Base salary (INR)", "Promotion"],
}


def _ensure_backup_dir():
    os.makedirs(BACKUP_DIR, exist_ok=True)


def _get_active_config() -> Dict[str, Any]:
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Failed to read dataset_config.json: {e}")
    return {
        "source_type": "LOCAL_EXCEL",
        "cloud_url": None,
        "last_synced": None,
        "auto_sync_enabled": False,
        "sync_cadence": "MANUAL",
    }


def _save_active_config(config: Dict[str, Any]):
    os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)


def _classify_workbook(sheets_found: List[str]) -> Optional[str]:
    names = set(sheets_found)
    if set(FRIENDLY_SHEETS).issubset(names):
        return "friendly"
    if set(REQUIRED_SHEETS).issubset(names):
        return "legacy"
    if set(COMPENSATION_SHEETS).issubset(names):
        return "compensation"
    return None


def _validate_workbook_bytes(content: bytes) -> Dict[str, Any]:
    """
    Validates workbook bytes in memory without touching disk.

    Accepted workbooks:
    - India workforce file: People, Skills, Leave (pay stays in the compensation file).
    - Legacy four sheets: EMPLOYEES, SKILL, Finance_History, LEAVE.
    - Compensation file: Current pay, Pay history.
    """
    if not content or len(content) < 500:
        return {"valid": False, "errors": ["File is empty or too small to be a valid Excel workbook."]}

    if not content.startswith(b"PK"):
        return {"valid": False, "errors": ["File header mismatch. Expected Excel (.xlsx) file."]}

    errors: List[str] = []
    warnings: List[str] = []
    counts: Dict[str, int] = {}
    sheets_found: List[str] = []

    try:
        excel_file = pd.ExcelFile(io.BytesIO(content))
        sheets_found = excel_file.sheet_names
    except Exception as e:
        return {"valid": False, "errors": [f"Failed to parse Excel workbook: {str(e)}"]}

    kind = _classify_workbook(sheets_found)
    if kind is None:
        errors.append(
            "Workbook was not recognized. Upload Infinite_ETS_India_Workforce.xlsx "
            "(People, Skills, Leave), the compensation file (Current pay, Pay history), "
            f"or the legacy workbook ({', '.join(REQUIRED_SHEETS)}). Found sheets: {', '.join(sheets_found)}"
        )
        return {"valid": False, "errors": errors, "sheets_found": sheets_found, "workbook_kind": None}

    column_map = {
        "friendly": FRIENDLY_COLUMNS,
        "legacy": REQUIRED_COLUMNS,
        "compensation": COMPENSATION_COLUMNS,
    }[kind]
    for sheet_name, req_cols in column_map.items():
        try:
            skip = 2 if kind == "legacy" and sheet_name in ("EMPLOYEES", "LEAVE") else 0
            df_sample = pd.read_excel(io.BytesIO(content), sheet_name=sheet_name, skiprows=skip, nrows=5)
            cols = [str(c).strip() for c in df_sample.columns if not str(c).startswith("Unnamed:")]
            missing = [c for c in req_cols if c not in cols]
            if missing:
                errors.append(f"Sheet '{sheet_name}' is missing required columns: {', '.join(missing)}")
        except Exception as e:
            errors.append(f"Error inspecting sheet '{sheet_name}': {str(e)}")

    if not errors:
        try:
            if kind == "legacy":
                for s in REQUIRED_SHEETS:
                    skip = 2 if s in ("EMPLOYEES", "LEAVE") else 0
                    df_all = pd.read_excel(io.BytesIO(content), sheet_name=s, skiprows=skip)
                    if s == "EMPLOYEES":
                        df_emp_num = pd.to_numeric(df_all["EMPLOYEE NUMBER"], errors="coerce").fillna(0)
                        counts["employees"] = int((df_emp_num > 0).sum())
                    elif s == "SKILL":
                        counts["skills"] = len(df_all.dropna(subset=["Skill Name"]))
                    elif s == "Finance_History":
                        counts["finance"] = len(df_all)
                    elif s == "LEAVE":
                        counts["leaves"] = len(df_all)
            elif kind == "friendly":
                people = pd.read_excel(io.BytesIO(content), sheet_name="People")
                skills = pd.read_excel(io.BytesIO(content), sheet_name="Skills")
                leave = pd.read_excel(io.BytesIO(content), sheet_name="Leave")
                people_ids = pd.to_numeric(people["Employee number"], errors="coerce").fillna(0)
                counts["employees"] = int((people_ids > 0).sum())
                counts["skills"] = int(skills["Skill"].notna().sum()) if "Skill" in skills.columns else len(skills)
                leave_ids = pd.to_numeric(leave["Employee number"], errors="coerce").fillna(0)
                counts["leaves"] = int((leave_ids > 0).sum())
                if not os.path.exists(data_loader.compensation_path):
                    warnings.append(
                        "Pay is not in this workbook. Infinite_ETS_India_Compensation.xlsx was not found beside the app, so compensation will fall back to the existing synthesis."
                    )
            else:
                current = pd.read_excel(io.BytesIO(content), sheet_name="Current pay")
                history = pd.read_excel(io.BytesIO(content), sheet_name="Pay history")
                current_ids = pd.to_numeric(current["Employee number"], errors="coerce").fillna(0)
                counts["employees"] = int((current_ids > 0).sum())
                history_ids = pd.to_numeric(history["Employee number"], errors="coerce").fillna(0)
                counts["finance"] = int((history_ids > 0).sum())
        except Exception as e:
            warnings.append(f"Could not compute exact record counts: {str(e)}")

    return {
        "valid": len(errors) == 0,
        "workbook_kind": kind,
        "sheets_found": sheets_found,
        "counts": counts,
        "errors": errors,
        "warnings": warnings,
        "size_bytes": len(content),
    }


def _destination_for_kind(kind: str) -> str:
    if kind == "compensation":
        path = data_loader.compensation_path
        os.makedirs(os.path.dirname(path), exist_ok=True)
        return path
    return data_loader.file_path


def _create_timestamped_backup(master_path: str) -> Optional[str]:
    """Creates a timestamped backup of the current master file."""
    if not os.path.exists(master_path):
        return None
    _ensure_backup_dir()
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    stem = os.path.splitext(os.path.basename(master_path))[0]
    backup_filename = f"{stem}_backup_{ts}.xlsx"
    backup_path = os.path.join(BACKUP_DIR, backup_filename)
    shutil.copy2(master_path, backup_path)
    logger.info(f"Created dataset backup at {backup_path}")
    return backup_path


def _transform_share_url(raw_url: str) -> str:
    """
    Transforms OneDrive or SharePoint links into direct download links.
    - If URL contains sharepoint.com or 1drv.ms or onedrive.live.com, converts view link to download link.
    """
    url = raw_url.strip()
    if not url:
        return url

    # Already has download=1
    if "download=1" in url:
        return url

    # SharePoint document link
    if "sharepoint.com" in url.lower():
        if "?" in url:
            return f"{url}&download=1"
        return f"{url}?download=1"

    # OneDrive 1drv.ms short link
    if "1drv.ms" in url.lower():
        # Will be redirected via requests with allow_redirects=True
        return url

    # OneDrive live.com link
    if "onedrive.live.com" in url.lower():
        if "resid=" in url and "authkey=" in url:
            clean = url.replace("redir?", "download?")
            return clean
        if "?" in url:
            return f"{url}&download=1"
        return f"{url}?download=1"

    return url


@router.get("/status", summary="Get master dataset metadata & sync status")
def get_dataset_status():
    master_path = data_loader.file_path
    exists = os.path.exists(master_path)

    file_size_bytes = os.path.getsize(master_path) if exists else 0
    file_size_formatted = f"{(file_size_bytes / 1024):.1f} KB" if file_size_bytes < 1048576 else f"{(file_size_bytes / 1048576):.2f} MB"
    last_mod = datetime.datetime.fromtimestamp(os.path.getmtime(master_path)).isoformat() if exists else None

    # Count backups
    _ensure_backup_dir()
    backups = [f for f in os.listdir(BACKUP_DIR) if f.endswith(".xlsx")]
    backups.sort(reverse=True)

    config = _get_active_config()

    return {
        "file_name": os.path.basename(master_path),
        "file_path": master_path,
        "file_size_bytes": file_size_bytes,
        "file_size_formatted": file_size_formatted,
        "last_modified": last_mod,
        "source_type": config.get("source_type", "LOCAL_EXCEL"),
        "cloud_url": config.get("cloud_url"),
        "last_synced": config.get("last_synced"),
        "auto_sync_enabled": config.get("auto_sync_enabled", False),
        "total_employees": len(data_loader.df_employees),
        "total_skills": len(data_loader.df_skills),
        "total_leaves": len(data_loader.df_leave),
        "total_finance_records": len(data_loader.df_finance),
        "workbook_kind": data_loader.workbook_kind,
        "compensation_file": os.path.basename(data_loader.compensation_path) if getattr(data_loader, "compensation_path", None) else None,
        "backup_count": len(backups),
        "recent_backups": backups[:5],
    }


@router.get("/download", summary="Download master Excel dataset")
def download_master_dataset():
    master_path = data_loader.file_path
    if not os.path.exists(master_path):
        raise HTTPException(status_code=404, detail="Master dataset file not found on server.")

    today_str = datetime.date.today().strftime("%Y%m%d")
    stem = os.path.splitext(os.path.basename(master_path))[0]
    download_filename = f"{stem}_export_{today_str}.xlsx"

    return FileResponse(
        path=master_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=download_filename,
        headers={"Content-Disposition": f'attachment; filename="{download_filename}"'},
    )


@router.post("/validate", summary="Pre-flight validation of Excel workbook")
async def validate_dataset(file: UploadFile = File(...)):
    if not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Invalid file format. Only Excel (.xlsx) files are accepted.")

    content = await file.read()
    val_report = _validate_workbook_bytes(content)
    return val_report


@router.post("/upload", summary="Upload and hot-reload master Excel dataset")
async def upload_master_dataset(file: UploadFile = File(...)):
    if not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Invalid file format. Only Excel (.xlsx) files are accepted.")

    content = await file.read()
    val_report = _validate_workbook_bytes(content)

    if not val_report["valid"]:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Dataset validation failed. Master file was not modified.",
                "errors": val_report["errors"],
                "warnings": val_report.get("warnings", []),
            },
        )

    master_path = _destination_for_kind(val_report.get("workbook_kind"))
    backup_path = _create_timestamped_backup(master_path)

    # Perform Atomic Swap
    temp_path = master_path + ".upload_tmp"
    try:
        with open(temp_path, "wb") as f:
            f.write(content)

        # Move temp to master
        if os.path.exists(master_path):
            os.remove(master_path)
        shutil.move(temp_path, master_path)

        # Trigger Hot-Reload
        reload_result = reload_all()

        # Update config
        config = _get_active_config()
        config["source_type"] = "LOCAL_EXCEL"
        config["last_synced"] = datetime.datetime.now().isoformat()
        _save_active_config(config)

        return {
            "status": "success",
            "message": "Dataset successfully uploaded, validated, and hot-reloaded.",
            "backup_path": backup_path,
            "metrics": reload_result,
            "validation_report": val_report,
        }

    except Exception as e:
        logger.error(f"Upload hot-reload failed: {e}. Executing atomic rollback.", exc_info=True)
        # Rollback if backup exists
        if backup_path and os.path.exists(backup_path):
            if os.path.exists(master_path):
                os.remove(master_path)
            shutil.copy2(backup_path, master_path)
            reload_all()
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass
        raise HTTPException(
            status_code=500,
            detail=f"Failed to reload dataset ({str(e)}). System was rolled back to previous valid backup.",
        )


@router.post("/test-url", summary="Test connection to OneDrive / SharePoint URL")
def test_cloud_url(payload: Dict[str, Any]):
    raw_url = payload.get("url", "").strip()
    if not raw_url:
        raise HTTPException(status_code=400, detail="Missing required 'url' parameter.")

    target_url = _transform_share_url(raw_url)

    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ETS-Workforce-Analytics/2.0",
        }
        resp = requests.get(target_url, headers=headers, timeout=12, stream=True, allow_redirects=True)

        if resp.status_code != 200:
            return {
                "reachable": False,
                "status_code": resp.status_code,
                "error": f"Remote server returned HTTP {resp.status_code}. Ensure the link allows direct download.",
                "transformed_url": target_url,
            }

        # Read first 8KB to inspect
        chunk = resp.raw.read(8192)
        is_zip = chunk.startswith(b"PK")
        content_type = resp.headers.get("Content-Type", "")
        content_len = resp.headers.get("Content-Length")

        return {
            "reachable": True,
            "status_code": resp.status_code,
            "is_valid_excel_header": is_zip,
            "content_type": content_type,
            "size_bytes_hint": int(content_len) if content_len and content_len.isdigit() else None,
            "transformed_url": target_url,
            "message": "Connection successful! Link is ready for cloud synchronization." if is_zip else "Connection reached, but remote file header did not match standard Excel format.",
        }
    except Exception as e:
        return {
            "reachable": False,
            "error": f"Connection failed: {str(e)}",
            "transformed_url": target_url,
        }


@router.post("/sync-cloud", summary="Sync dataset directly from OneDrive / SharePoint URL")
def sync_dataset_from_cloud(payload: Dict[str, Any]):
    raw_url = payload.get("url", "").strip()
    if not raw_url:
        raise HTTPException(status_code=400, detail="Missing required 'url' parameter.")

    target_url = _transform_share_url(raw_url)

    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ETS-Workforce-Analytics/2.0",
        }
        resp = requests.get(target_url, headers=headers, timeout=30, allow_redirects=True)
        if resp.status_code != 200:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to fetch file from cloud URL. Remote server returned HTTP {resp.status_code}.",
            )

        content = resp.content
        val_report = _validate_workbook_bytes(content)

        if not val_report["valid"]:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "Remote file validation failed. Master file was not modified.",
                    "errors": val_report["errors"],
                },
            )

        master_path = _destination_for_kind(val_report.get("workbook_kind"))
        backup_path = _create_timestamped_backup(master_path)

        temp_path = master_path + ".cloud_tmp"
        with open(temp_path, "wb") as f:
            f.write(content)

        if os.path.exists(master_path):
            os.remove(master_path)
        shutil.move(temp_path, master_path)

        reload_result = reload_all()

        config = _get_active_config()
        config["source_type"] = "SHAREPOINT_URL"
        config["cloud_url"] = raw_url
        config["last_synced"] = datetime.datetime.now().isoformat()
        _save_active_config(config)

        return {
            "status": "success",
            "message": "Successfully synchronized and hot-reloaded dataset from SharePoint/OneDrive URL.",
            "backup_path": backup_path,
            "metrics": reload_result,
            "cloud_url": raw_url,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Cloud sync failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Cloud synchronization failed: {str(e)}")
