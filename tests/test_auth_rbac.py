import os
import sys
import pytest
from fastapi.testclient import TestClient

os.environ["PYTHONPATH"] = "."
from backend.app.main import app
from backend.app.auth_db import get_user_by_username, set_user_active_status

client = TestClient(app)

def test_health():
    res = client.get("/api/health")
    assert res.status_code == 200

def test_baseline_accounts():
    for role, user, pw in [
        ("ADMIN", "admin", "Admin@2026!"),
        ("EXECUTIVE", "executive", "Executive@2026!"),
        ("HR_ANALYTICS", "hr_analytics", "HrAnalytics@2026!"),
        ("MANAGER", "manager", "Manager@2026!"),
        ("EMPLOYEE", "employee", "Employee@2026!")
    ]:
        res = client.post("/api/auth/login", json={"username": user, "password": pw})
        assert res.status_code == 200
        data = res.json()
        assert data["user"]["role"] == role
        assert "access_token" in data

def test_signup_and_persistence():
    uname = "test_perm_user"
    email = "test.perm@infinite.com"
    pw = "PermPassword@2026!"
    
    # Clean if exists from earlier
    res = client.post("/api/auth/signup", json={
        "username": uname,
        "email": email,
        "password": pw,
        "confirm_password": pw,
        "role": "EMPLOYEE"
    })
    if res.status_code != 409:
        assert res.status_code == 201
        data = res.json()
        assert data["username"] == uname
        assert data["role"] == "EMPLOYEE"
    
    # Verify password hash
    u = get_user_by_username(uname)
    assert u is not None
    assert u["password_hash"].startswith("$2b$")
    assert u["password_hash"] != pw

def test_rbac_enforcement():
    # Login as employee
    res_emp = client.post("/api/auth/login", json={"username": "employee", "password": "Employee@2026!"})
    assert res_emp.status_code == 200
    emp_token = res_emp.json()["access_token"]
    
    # Employee blocked from salarywise
    res_sal_emp = client.get("/api/salarywise/kpis", headers={"Authorization": f"Bearer {emp_token}"})
    assert res_sal_emp.status_code == 403
    
    # Admin allowed on salarywise
    res_admin = client.post("/api/auth/login", json={"username": "admin", "password": "Admin@2026!"})
    assert res_admin.status_code == 200
    admin_token = res_admin.json()["access_token"]
    
    res_sal_admin = client.get("/api/salarywise/kpis", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_sal_admin.status_code == 200

def test_forgot_and_reset_password():
    user = "employee"
    res_fp = client.post("/api/auth/forgot-password", json={"username": user})
    assert res_fp.status_code == 200
    token = res_fp.json().get("reset_token")
    assert token is not None
    
    new_pw = "EmployeeNewPass@2026!"
    res_reset = client.post("/api/auth/reset-password", json={
        "token": token,
        "new_password": new_pw,
        "confirm_password": new_pw
    })
    assert res_reset.status_code == 200
    
    # New password works
    res_login_new = client.post("/api/auth/login", json={"username": user, "password": new_pw})
    assert res_login_new.status_code == 200
    
    # Reset token cannot be reused
    res_reuse = client.post("/api/auth/reset-password", json={
        "token": token,
        "new_password": "AnotherPassword@2026!"
    })
    assert res_reuse.status_code == 400
    
    # Reset back to original password
    res_fp2 = client.post("/api/auth/forgot-password", json={"username": user})
    token2 = res_fp2.json().get("reset_token")
    client.post("/api/auth/reset-password", json={
        "token": token2,
        "new_password": "Employee@2026!",
        "confirm_password": "Employee@2026!"
    })
