from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from backend.app.models.models import AuditLog, Notification, User

class AuditService:
    @staticmethod
    def log(
        db: Session,
        corporation_id: str,
        actor_id: str,
        actor_name: str,
        actor_role: str,
        action: str,
        entity_type: str,
        entity_id: str,
        details: Optional[Dict[str, Any]] = None
    ) -> AuditLog:
        entry = AuditLog(
            corporation_id=corporation_id,
            actor_id=actor_id,
            actor_name=actor_name,
            actor_role=actor_role,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details=details or {}
        )
        db.add(entry)
        db.commit()
        db.refresh(entry)
        return entry

class NotificationService:
    @staticmethod
    def notify_user(
        db: Session,
        corporation_id: str,
        user_id: str,
        title: str,
        body: str,
        complaint_id: Optional[str] = None
    ) -> Notification:
        notif = Notification(
            corporation_id=corporation_id,
            user_id=user_id,
            title=title,
            body=body,
            complaint_id=complaint_id,
            is_read=False
        )
        db.add(notif)
        db.commit()
        db.refresh(notif)
        return notif

    @staticmethod
    def notify_role(
        db: Session,
        corporation_id: str,
        role: str,
        title: str,
        body: str,
        complaint_id: Optional[str] = None
    ):
        users = db.query(User).filter(
            User.corporation_id == corporation_id,
            User.role == role,
            User.is_active == True
        ).all()
        for u in users:
            NotificationService.notify_user(
                db=db,
                corporation_id=corporation_id,
                user_id=u.id,
                title=title,
                body=body,
                complaint_id=complaint_id
            )
