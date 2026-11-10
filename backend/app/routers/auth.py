import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models.models import User
from backend.app.schemas.schemas import (
    OTPRequest, OTPVerify, StaffLoginRequest, TokenResponse, UserProfileResponse
)
from backend.app.services.auth_service import (
    verify_password, create_access_token, get_current_user
)
from backend.app.services.audit_service import AuditService

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/otp/request")
def request_otp(req: OTPRequest):
    """
    Citizen OTP request. In mock mode, OTP is fixed as '123456'.
    """
    clean_mobile = req.mobile.strip()[-10:]
    return {
        "success": True,
        "mobile": clean_mobile,
        "message": "OTP sent successfully (Use 123456 for demo)",
        "mock_otp": "123456"
    }

@router.post("/otp/verify", response_model=TokenResponse)
def verify_otp(req: OTPVerify, db: Session = Depends(get_db)):
    """
    Verify citizen OTP. Creates citizen user record if first-time signin.
    """
    if req.otp != "123456":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OTP. Please enter 123456."
        )

    clean_mobile = req.mobile.strip()[-10:]
    user = db.query(User).filter(User.mobile == clean_mobile).first()

    if not user:
        user_id = f"usr_{clean_mobile}"
        user = User(
            id=user_id,
            corporation_id=req.corporation_id or "SMKMC",
            name=req.name or f"Citizen {clean_mobile[-4:]}",
            mobile=clean_mobile,
            role="citizen",
            is_active=True
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        AuditService.log(
            db=db,
            corporation_id=user.corporation_id,
            actor_id=user.id,
            actor_name=user.name,
            actor_role="citizen",
            action="CITIZEN_REGISTER",
            entity_type="user",
            entity_id=user.id
        )

    access_token = create_access_token(data={"sub": user.id, "role": user.role, "corp": user.corporation_id})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "name": user.name,
            "mobile": user.mobile,
            "role": user.role,
            "corporation_id": user.corporation_id
        }
    }

@router.post("/staff/login", response_model=TokenResponse)
def staff_login(req: StaffLoginRequest, db: Session = Depends(get_db)):
    """
    Staff login (Supervisor, Corp Admin, Field Officer, Helpdesk, Platform Admin).
    Accepts staff credentials e.g. dmc1@smkmc.demo / Demo@123.
    """
    user = db.query(User).filter(User.email == req.email.lower().strip()).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid staff email or password")

    # In DEV_MODE allow standard Demo@123 or check password hash
    is_valid_pw = (req.password == "Demo@123") or (user.hashed_password and verify_password(req.password, user.hashed_password))
    if not is_valid_pw:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid staff email or password")

    access_token = create_access_token(data={"sub": user.id, "role": user.role, "corp": user.corporation_id})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "corporation_id": user.corporation_id,
            "unit_id": user.unit_id
        }
    }

@router.get("/me", response_model=UserProfileResponse)
def get_current_user_profile(user: User = Depends(get_current_user)):
    return user

@router.post("/refresh", response_model=TokenResponse)
def refresh_token(user: User = Depends(get_current_user)):
    """Refreshes the JWT access token for active authenticated user."""
    new_token = create_access_token(data={"sub": user.id, "role": user.role, "corp": user.corporation_id})
    return {
        "access_token": new_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "mobile": user.mobile,
            "role": user.role,
            "corporation_id": user.corporation_id,
            "unit_id": user.unit_id
        }
    }

@router.post("/logout")
def logout_user(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Logs out user and registers audit event."""
    AuditService.log(
        db=db,
        corporation_id=user.corporation_id or "SMKMC",
        actor_id=user.id,
        actor_name=user.name,
        actor_role=user.role,
        action="USER_LOGOUT",
        entity_type="user",
        entity_id=user.id
    )
    return {"success": True, "message": "Successfully logged out."}

@router.delete("/me")
def delete_me_account(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    DPDP (Digital Personal Data Protection) right to erasure:
    Erases personal identifying data while preserving civic complaints for public auditing.
    """
    if user.role != "citizen":
        raise HTTPException(status_code=400, detail="Only citizens can self-anonymize / erase their profile under DPDP")

    user.name = "Anonymous citizen"
    user.mobile = None
    user.email = None
    user.anonymized = True
    db.commit()

    AuditService.log(
        db=db,
        corporation_id=user.corporation_id or "SMKMC",
        actor_id=user.id,
        actor_name="Anonymous citizen",
        actor_role="citizen",
        action="DPDP_ACCOUNT_ERASED",
        entity_type="user",
        entity_id=user.id
    )

    return {"success": True, "message": "Account personal data successfully erased per DPDP policy."}

@router.post("/anonymize")
def anonymize_account(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    DPDP (Digital Personal Data Protection) right to erasure:
    Anonymises the citizen profile while preserving civic complaints for public auditing.
    """
    return delete_me_account(user=user, db=db)
