from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models.models import Notification, User
from backend.app.services.auth_service import get_current_user

router = APIRouter(prefix="/notifications", tags=["notifications"])

@router.get("")
def list_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns in-app notifications for current user or their civic role.
    """
    notifs = db.query(Notification).filter(
        Notification.corporation_id == current_user.corporation_id,
        (Notification.user_id == current_user.id) | (Notification.role == current_user.role)
    ).order_by(Notification.created_at.desc()).limit(50).all()

    unread_count = sum(1 for n in notifs if not n.is_read)

    return {
        "unread_count": unread_count,
        "items": [
            {
                "id": n.id,
                "title": n.title,
                "body": n.body,
                "complaint_id": n.complaint_id,
                "is_read": n.is_read,
                "created_at": n.created_at
            }
            for n in notifs
        ]
    }

@router.post("/{id}/read")
def mark_notification_read(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Marks an in-app notification as read."""
    notif = db.query(Notification).filter(Notification.id == id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")

    notif.is_read = True
    db.commit()
    return {"status": "SUCCESS", "id": notif.id, "is_read": True}
