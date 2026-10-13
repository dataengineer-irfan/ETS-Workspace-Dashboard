import os
import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from backend.app.auth_db import get_user_by_id

SECRET_KEY = os.environ.get("ETS_JWT_SECRET", "ets-workforce-intelligence-prod-secret-key-2026-secure")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

http_bearer = HTTPBearer(auto_error=False)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode('utf-8')).hexdigest()

def generate_reset_token() -> str:
    return secrets.token_urlsafe(32)

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "iat": now})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except (jwt.PyJWTError, Exception):
        return None

async def get_current_user(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(http_bearer)
) -> Dict[str, Any]:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not auth or not auth.credentials:
        raise credentials_exception
    
    payload = decode_access_token(auth.credentials)
    if not payload:
        raise credentials_exception
    
    user_id = payload.get("user_id")
    if user_id is None:
        raise credentials_exception
    
    user = get_user_by_id(int(user_id))
    if user is None:
        raise credentials_exception
    
    if not user.get("is_active"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled. Please contact your system administrator.",
        )
    
    # Safe user copy without password hash
    safe_user = {k: v for k, v in user.items() if k != "password_hash"}
    return safe_user

def require_roles(allowed_roles: List[str]):
    def role_dependency(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
        user_role = current_user.get("role", "").upper()
        allowed = [r.upper() for r in allowed_roles]
        if user_role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: Role '{user_role}' is not authorized to access this resource. Required roles: {', '.join(allowed)}."
            )
        return current_user
    return role_dependency
