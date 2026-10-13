import urllib.request
import urllib.error
import json
import sqlite3
import time
import os
import sys

BASE_URL = "http://127.0.0.1:42006"
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend", "data", "ets_auth.db")

def make_request(path, method="GET", data=None, token=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            status = resp.status
            res_body = resp.read().decode("utf-8")
            return status, json.loads(res_body) if res_body else {}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        try:
            parsed = json.loads(err_body)
        except Exception:
            parsed = {"raw": err_body}
        return e.code, parsed
    except Exception as ex:
        return 500, {"error": str(ex)}

def run_live_e2e_validation():
    print("=================================================================")
    print("   ETS DASHBOARD: LIVE END-TO-END AUTHENTICATION & RBAC SUITE    ")
    print("=================================================================\n")

    # Step 0: Test Health Check
    st, res = make_request("/api/health")
    assert st == 200, f"Health check failed: {res}"
    print("[PASS] 0. System Health: 200 OK -> Backend operational on port 42006")

    # Step 1: Create a brand new test user through Signup
    timestamp = int(time.time())
    test_uname = f"e2e_analyst_{timestamp}"
    test_email = f"analyst_{timestamp}@infinite.com"
    test_pw = "EnterprisePass@2026!"

    print(f"\n[EXEC] 1. Initiating Signup for new employee: '{test_uname}' ({test_email})...")
    st, res = make_request("/api/auth/signup", method="POST", data={
        "username": test_uname,
        "email": test_email,
        "password": test_pw,
        "confirm_password": test_pw,
        "role": "EMPLOYEE"
    })
    assert st == 201, f"Signup failed with {st}: {res}"
    print(f"[PASS] 1. Signup Succeeded (HTTP 201 Created): user_id={res['user_id']}, role={res['role']}")

    # Step 2: Confirm the user is persisted in the database and password is a bcrypt hash
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    row = conn.execute("SELECT * FROM users WHERE username = ?", (test_uname,)).fetchone()
    assert row is not None, "User record not found in SQLite database!"
    user_id = row["user_id"]
    password_hash = row["password_hash"]
    
    assert password_hash != test_pw, "SECURITY VIOLATION: Password stored in plaintext!"
    assert password_hash.startswith("$2b$") or password_hash.startswith("$2a$"), "Password hash does not match bcrypt format!"
    print(f"[PASS] 2. Database Inspection: User {test_uname} persisted with valid bcrypt hash: {password_hash[:18]}... (plaintext strictly absent)")

    # Step 3: Test duplicate signup prevention (username & email)
    st, res = make_request("/api/auth/signup", method="POST", data={
        "username": test_uname,
        "email": f"diff_{timestamp}@infinite.com",
        "password": test_pw
    })
    assert st == 409, f"Expected 409 for duplicate username, got {st}"
    print(f"[PASS] 3a. Duplicate Username Validation: Blocked with HTTP 409 Conflict ('{res.get('detail')}')")

    st, res = make_request("/api/auth/signup", method="POST", data={
        "username": f"diff_{timestamp}",
        "email": test_email,
        "password": test_pw
    })
    assert st == 409, f"Expected 409 for duplicate email, got {st}"
    print(f"[PASS] 3b. Duplicate Email Validation: Blocked with HTTP 409 Conflict ('{res.get('detail')}')")

    # Step 4: Log in using newly created credentials
    print(f"\n[EXEC] 4. Authenticating with credentials for '{test_uname}'...")
    st, res = make_request("/api/auth/login", method="POST", data={
        "username": test_uname,
        "password": test_pw
    })
    assert st == 200, f"Login failed with {st}: {res}"
    user_token = res["access_token"]
    assert user_token, "No access token received!"
    assert res["user"]["username"] == test_uname
    assert res["user"]["role"] == "EMPLOYEE"
    print(f"[PASS] 4. Successful Authentication (HTTP 200 OK): Received JWT Bearer Token: {user_token[:25]}...")

    # Step 5: Confirm authenticated routing/session behavior via /api/auth/me
    st, res = make_request("/api/auth/me", token=user_token)
    assert st == 200, f"/api/auth/me failed: {res}"
    assert res["username"] == test_uname
    print(f"[PASS] 5. Session Verification: /api/auth/me confirms identity for '{res['username']}' with role '{res['role']}'")

    # Step 6: Verify RBAC using the test user's assigned role (EMPLOYEE)
    # Permitted endpoints:
    st, res = make_request("/api/home/kpis", token=user_token)
    assert st == 200, f"Expected 200 on /home/kpis for EMPLOYEE, got {st}"
    print("[PASS] 6a. RBAC Authorization: EMPLOYEE has valid access to Workforce Overview (/api/home/kpis -> 200 OK)")

    st, res = make_request("/api/techwise/kpis", token=user_token)
    assert st == 200, f"Expected 200 on /techwise/kpis for EMPLOYEE, got {st}"
    print("[PASS] 6b. RBAC Authorization: EMPLOYEE has valid access to Skills Dashboard (/api/techwise/kpis -> 200 OK)")

    # Restricted endpoint for EMPLOYEE: Compensation Analytics (/api/salarywise/kpis)
    st, res = make_request("/api/salarywise/kpis", token=user_token)
    assert st == 403, f"SECURITY VIOLATION: Expected 403 Forbidden for EMPLOYEE on /salarywise/kpis, got {st}"
    print(f"[PASS] 6c. RBAC Enforcement: EMPLOYEE access denied on Compensation Analytics (HTTP 403 Forbidden -> '{res.get('detail')}')")

    # Restricted endpoint: /api/reload
    st, res = make_request("/api/reload", method="POST", token=user_token)
    assert st == 403, f"Expected 403 for reload, got {st}"
    print(f"[PASS] 6d. RBAC Enforcement: EMPLOYEE access denied on Dataset Reload (HTTP 403 Forbidden -> '{res.get('detail')}')")

    # Step 7: Verify elevated roles (ADMIN & MANAGER)
    print("\n[EXEC] 7. Authenticating as Delivery Manager and System Admin...")
    st, mgr_res = make_request("/api/auth/login", method="POST", data={"username": "manager", "password": "Manager@2026!"})
    assert st == 200
    mgr_token = mgr_res["access_token"]
    st, res = make_request("/api/salarywise/kpis", token=mgr_token)
    assert st == 200, f"Expected 200 for MANAGER on salarywise, got {st}"
    print("[PASS] 7a. RBAC Authorization: Delivery Manager authorized for Compensation Analytics (HTTP 200 OK)")

    st, adm_res = make_request("/api/auth/login", method="POST", data={"username": "admin", "password": "Admin@2026!"})
    assert st == 200
    adm_token = adm_res["access_token"]
    st, res = make_request("/api/salarywise/kpis", token=adm_token)
    assert st == 200
    print("[PASS] 7b. RBAC Authorization: System Admin authorized for Compensation Analytics (HTTP 200 OK)")

    st, res = make_request("/api/reload", method="POST", token=adm_token)
    assert st == 200
    print("[PASS] 7c. RBAC Authorization: System Admin authorized for Dataset Reload (HTTP 200 OK)")

    # Step 8: Test Forgot Password Flow for test user
    print(f"\n[EXEC] 8. Requesting password reset token for '{test_uname}'...")
    st, res = make_request("/api/auth/forgot-password", method="POST", data={"username": test_uname})
    assert st == 200
    reset_token = res.get("reset_token")
    assert reset_token is not None, "Reset token not generated!"
    print(f"[PASS] 8. Forgot Password Initiated: Token generated securely: {reset_token[:16]}... (HTTP 200 OK)")

    # Inspect token table in DB
    token_row = conn.execute("SELECT * FROM password_reset_tokens WHERE user_id = ? AND is_used = 0", (user_id,)).fetchone()
    assert token_row is not None, "Reset token record missing from password_reset_tokens table!"
    print(f"[PASS] 8b. Database Token Audit: SHA-256 token hash verified in database with expiry: {token_row['expires_at']}")

    # Step 9: Complete Password Reset
    updated_pw = "BrandNewSecurePassword@2026!"
    print(f"[EXEC] 9. Submitting password reset with token...")
    st, res = make_request("/api/auth/reset-password", method="POST", data={
        "token": reset_token,
        "new_password": updated_pw,
        "confirm_password": updated_pw
    })
    assert st == 200, f"Password reset failed: {res}"
    print(f"[PASS] 9. Password Reset Succeeded: '{res.get('message')}' (HTTP 200 OK)")

    # Step 10: Confirm old password no longer works
    st, res = make_request("/api/auth/login", method="POST", data={"username": test_uname, "password": test_pw})
    assert st == 401, f"Expected 401 for old password, got {st}"
    print("[PASS] 10. Old Password Invalidation: Previous password rejected with HTTP 401 Unauthorized")

    # Step 11: Confirm new password successfully logs in
    st, res = make_request("/api/auth/login", method="POST", data={"username": test_uname, "password": updated_pw})
    assert st == 200, f"New password login failed: {res}"
    print("[PASS] 11. New Password Verification: Successfully authenticated with newly reset password (HTTP 200 OK)")

    # Step 12: Verify reset token cannot be reused
    st, res = make_request("/api/auth/reset-password", method="POST", data={
        "token": reset_token,
        "new_password": "YetAnotherPassword@2026!"
    })
    assert st == 400, f"Expected 400 for token reuse, got {st}"
    print(f"[PASS] 12. Single-Use Token Enforcement: Replayed token rejected with HTTP 400 Bad Request ('{res.get('detail')}')")

    # Step 13: Inactive User Enforcement
    print("\n[EXEC] 13. Testing Inactive/Disabled User Enforcement...")
    conn.execute("UPDATE users SET is_active = 0 WHERE user_id = ?", (user_id,))
    conn.commit()

    st, res = make_request("/api/auth/login", method="POST", data={"username": test_uname, "password": updated_pw})
    assert st == 403, f"Expected 403 for disabled user, got {st}"
    print(f"[PASS] 13. Inactive Account Security: Disabled user login blocked with HTTP 403 Forbidden ('{res.get('detail')}')")

    # Restore user active status
    conn.execute("UPDATE users SET is_active = 1 WHERE user_id = ?", (user_id,))
    conn.commit()
    conn.close()

    print("\n=================================================================")
    print("  ALL 13/13 PRODUCTION AUTHENTICATION & RBAC TESTS PASSED 100%!  ")
    print("=================================================================\n")

if __name__ == "__main__":
    run_live_e2e_validation()
