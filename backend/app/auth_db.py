import os
import sqlite3
import bcrypt
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "ets_auth.db")

def get_db_connection() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def init_auth_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Users table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        user_id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE COLLATE NOCASE,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'EMPLOYEE',
        is_active INTEGER NOT NULL DEFAULT 1,
        employee_number INTEGER NULL,
        department TEXT NULL,
        created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
        updated_at TEXT NOT NULL DEFAULT (DATETIME('now'))
    );
    """)

    cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_emp_no ON users(employee_number);")

    # 2. Password Reset Tokens table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
        token_id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        is_used INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
        FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
    );
    """)

    cursor.execute("CREATE INDEX IF NOT EXISTS idx_reset_token_hash ON password_reset_tokens(token_hash);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_reset_user_id ON password_reset_tokens(user_id);")

    conn.commit()

    # Bootstrap default enterprise role accounts if database is newly initialized
    cursor.execute("SELECT COUNT(*) FROM users;")
    count = cursor.fetchone()[0]
    if count == 0:
        print("[AuthDB] Seeding baseline enterprise accounts for roles...")
        baseline_users = [
            ("admin", "admin@infinite.com", "Admin@2026!", "ADMIN", None, "Executive"),
            ("executive", "executive@infinite.com", "Executive@2026!", "EXECUTIVE", None, "Leadership"),
            ("hr_analytics", "hr@infinite.com", "HrAnalytics@2026!", "HR_ANALYTICS", None, "Human Resources"),
            ("manager", "manager@infinite.com", "Manager@2026!", "MANAGER", 1004641, "Core"),
            ("employee", "employee@infinite.com", "Employee@2026!", "EMPLOYEE", 1019272, "IT"),
        ]
        for uname, email, raw_pw, role, emp_no, dept in baseline_users:
            hashed_pw = bcrypt.hashpw(raw_pw.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            now_iso = datetime.now(timezone.utc).isoformat()
            cursor.execute("""
            INSERT INTO users (username, email, password_hash, role, is_active, employee_number, department, created_at, updated_at)
            VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?);
            """, (uname, email, hashed_pw, role, emp_no, dept, now_iso, now_iso))
        conn.commit()
        print("[AuthDB] Successfully seeded 5 baseline role accounts.")

    conn.close()

def create_user(
    username: str,
    email: str,
    password_hash: str,
    role: str = "EMPLOYEE",
    employee_number: Optional[int] = None,
    department: Optional[str] = None
) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor()
    now_iso = datetime.now(timezone.utc).isoformat()
    cursor.execute("""
    INSERT INTO users (username, email, password_hash, role, is_active, employee_number, department, created_at, updated_at)
    VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?);
    """, (username.strip(), email.strip().lower(), password_hash, role.strip().upper(), employee_number, department, now_iso, now_iso))
    user_id = cursor.lastrowid
    conn.commit()
    
    cursor.execute("SELECT * FROM users WHERE user_id = ?;", (user_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row)

def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE user_id = ?;", (user_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def get_user_by_username(username: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE username = ? COLLATE NOCASE;", (username.strip(),))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = ? COLLATE NOCASE;", (email.strip().lower(),))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def get_user_by_username_or_email(identifier: str) -> Optional[Dict[str, Any]]:
    ident = identifier.strip()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT * FROM users 
    WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE;
    """, (ident, ident.lower()))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def update_user_password(user_id: int, password_hash: str) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    now_iso = datetime.now(timezone.utc).isoformat()
    cursor.execute("""
    UPDATE users SET password_hash = ?, updated_at = ? WHERE user_id = ?;
    """, (password_hash, now_iso, user_id))
    conn.commit()
    success = cursor.rowcount > 0
    conn.close()
    return success

def set_user_active_status(user_id: int, is_active: bool) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    now_iso = datetime.now(timezone.utc).isoformat()
    cursor.execute("""
    UPDATE users SET is_active = ?, updated_at = ? WHERE user_id = ?;
    """, (1 if is_active else 0, now_iso, user_id))
    conn.commit()
    success = cursor.rowcount > 0
    conn.close()
    return success

def create_password_reset_token(user_id: int, token_hash: str, expires_at: str) -> int:
    conn = get_db_connection()
    cursor = conn.cursor()
    # Invalidate existing active tokens for this user first
    cursor.execute("""
    UPDATE password_reset_tokens SET is_used = 1 WHERE user_id = ? AND is_used = 0;
    """, (user_id,))
    
    now_iso = datetime.now(timezone.utc).isoformat()
    cursor.execute("""
    INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, is_used, created_at)
    VALUES (?, ?, ?, 0, ?);
    """, (user_id, token_hash, expires_at, now_iso))
    token_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return token_id

def get_password_reset_token(token_hash: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT * FROM password_reset_tokens WHERE token_hash = ?;
    """, (token_hash,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def mark_password_reset_token_used(token_id: int) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    UPDATE password_reset_tokens SET is_used = 1 WHERE token_id = ?;
    """, (token_id,))
    conn.commit()
    success = cursor.rowcount > 0
    conn.close()
    return success

# Initialize DB upon module import
init_auth_db()
