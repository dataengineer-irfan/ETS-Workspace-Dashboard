import re
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any

from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, EmailStr, Field

from backend.app.auth_db import (
    create_user,
    get_user_by_id,
    get_user_by_username,
    get_user_by_email,
    get_user_by_username_or_email,
    update_user_password,
    create_password_reset_token,
    get_password_reset_token,
    mark_password_reset_token_used
)
from backend.app.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    hash_token,
    generate_reset_token,
    get_current_user
)

router = APIRouter(prefix="/api/auth", tags=["Authentication & RBAC"])

class SignUpRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: str = Field(..., min_length=5, max_length=100)
    password: str = Field(..., min_length=6, max_length=100)
    confirm_password: Optional[str] = None
    role: Optional[str] = "EMPLOYEE"
    employee_number: Optional[int] = None
    department: Optional[str] = None

class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)

class ForgotPasswordRequest(BaseModel):
    username: str = Field(..., min_length=1)

class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8, max_length=100)
    confirm_password: Optional[str] = None
    username: Optional[str] = None

class UserResponse(BaseModel):
    user_id: int
    username: str
    email: str
    role: str
    is_active: bool
    employee_number: Optional[int] = None
    department: Optional[str] = None
    created_at: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED, summary="Create a new user account")
def signup(req: SignUpRequest):
    uname = req.username.strip()
    email = req.email.strip().lower()
    
    if len(uname) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username must be at least 3 characters long."
        )
    
    if not EMAIL_REGEX.match(email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide a valid email address."
        )
    
    if len(req.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long."
        )
    
    if req.confirm_password and req.password != req.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match."
        )
    
    # Check duplicate username
    existing_user = get_user_by_username(uname)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Username '{uname}' is already registered."
        )
    
    # Check duplicate email
    existing_email = get_user_by_email(email)
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Email '{email}' is already registered."
        )
    
    # Determine role - default to EMPLOYEE, only allow valid roles
    valid_roles = {"EMPLOYEE", "MANAGER", "HR_ANALYTICS", "EXECUTIVE", "ADMIN"}
    assigned_role = (req.role or "EMPLOYEE").strip().upper()
    if assigned_role not in valid_roles:
        assigned_role = "EMPLOYEE"
    
    # Auto-link employee_number if matching email exists in workforce dataset
    emp_number = req.employee_number
    dept = req.department
    try:
        from backend.app.data_loader import data_loader
        matched_emps = data_loader.df_employees[data_loader.df_employees['EMAIL'].str.lower() == email]
        if not matched_emps.empty:
            emp_number = int(matched_emps.iloc[0]['EMPLOYEE NUMBER'])
            if not dept:
                dept = str(matched_emps.iloc[0]['DEPARTMENT'])
    except Exception:
        pass
    
    # Hash password with bcrypt
    password_hash = get_password_hash(req.password)
    
    # Persist user
    new_user = create_user(
        username=uname,
        email=email,
        password_hash=password_hash,
        role=assigned_role,
        employee_number=emp_number,
        department=dept
    )
    
    return UserResponse(
        user_id=new_user["user_id"],
        username=new_user["username"],
        email=new_user["email"],
        role=new_user["role"],
        is_active=bool(new_user["is_active"]),
        employee_number=new_user.get("employee_number"),
        department=new_user.get("department"),
        created_at=new_user.get("created_at")
    )

@router.post("/login", response_model=TokenResponse, summary="Authenticate user and issue access token")
def login(req: LoginRequest):
    identifier = req.username.strip()
    user = get_user_by_username_or_email(identifier)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password."
        )
    
    if not verify_password(req.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password."
        )
    
    if not user["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled. Please contact your system administrator."
        )
    
    token_payload = {
        "user_id": user["user_id"],
        "sub": user["username"],
        "email": user["email"],
        "role": user["role"],
        "employee_number": user.get("employee_number"),
    }
    access_token = create_access_token(token_payload)
    
    user_res = UserResponse(
        user_id=user["user_id"],
        username=user["username"],
        email=user["email"],
        role=user["role"],
        is_active=bool(user["is_active"]),
        employee_number=user.get("employee_number"),
        department=user.get("department"),
        created_at=user.get("created_at")
    )
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_res
    )

@router.get("/me", response_model=UserResponse, summary="Get current authenticated user profile")
def get_me(current_user: Dict[str, Any] = Depends(get_current_user)):
    return UserResponse(
        user_id=current_user["user_id"],
        username=current_user["username"],
        email=current_user["email"],
        role=current_user["role"],
        is_active=bool(current_user["is_active"]),
        employee_number=current_user.get("employee_number"),
        department=current_user.get("department"),
        created_at=current_user.get("created_at")
    )

@router.post("/forgot-password", summary="Initiate password recovery protocol")
def forgot_password(req: ForgotPasswordRequest):
    identifier = req.username.strip()
    user = get_user_by_username_or_email(identifier)
    
    reset_token = None
    if user and user.get("is_active"):
        raw_token = generate_reset_token()
        token_hashed = hash_token(raw_token)
        # 15 minute expiration
        expires_at = (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
        create_password_reset_token(user["user_id"], token_hashed, expires_at)
        reset_token = raw_token
    
    response = {
        "status": "success",
        "message": "If an account with that username or email exists, a password reset authorization token has been securely generated.",
    }
    # Provide reset_token in response for development and direct validation
    if reset_token:
        response["reset_token"] = reset_token
    
    return response

@router.post("/reset-password", summary="Reset password using valid authorization token")
def reset_password(req: ResetPasswordRequest):
    token_str = req.token.strip()
    new_pw = req.new_password
    
    if len(new_pw) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 8 characters long."
        )
    
    if req.confirm_password and new_pw != req.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match."
        )
    
    token_hash = hash_token(token_str)
    token_rec = get_password_reset_token(token_hash)
    
    if not token_rec:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or unrecognized password reset token."
        )
    
    if token_rec.get("is_used"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This password reset token has already been used. Please request a new token."
        )
    
    # Check expiration
    expires_str = token_rec.get("expires_at", "")
    try:
        expires_dt = datetime.fromisoformat(expires_str)
        if expires_dt.tzinfo is None:
            expires_dt = expires_dt.replace(tzinfo=timezone.utc)
        now_dt = datetime.now(timezone.utc)
        if now_dt > expires_dt:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This password reset token has expired. Please request a new token."
            )
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid token expiration timestamp."
        )
    
    user_id = token_rec["user_id"]
    new_hash = get_password_hash(new_pw)
    
    # Update password and mark token used
    update_success = update_user_password(user_id, new_hash)
    if not update_success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update password. User record not found."
        )
    
    mark_password_reset_token_used(token_rec["token_id"])
    
    return {
        "status": "success",
        "message": "Password has been successfully updated. You can now log in with your new password."
    }
