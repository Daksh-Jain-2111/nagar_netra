import datetime
import logging
from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session

from backend.app.database import SessionLocal
from backend.app.models.models import Complaint, ComplaintEvent, Setting
from backend.app.rules.clock_rules import evaluate_escalation, check_auto_close
from backend.app.services.audit_service import NotificationService, AuditService
from backend.app.services.time_service import get_now

logger = logging.getLogger("nagarnetra_scheduler")

def tick_clock_evaluations():
    """
    Periodic job (running every 60 seconds):
    1. Check response missed -> L1 response_missed
    2. Check deadline missed -> L1 deadline_missed
    3. Check 72h supervisor inaction -> supervisor_overdue = True
    4. Auto-close 7 days after RESOLVED
    """
    db: Session = SessionLocal()
    try:
        now = get_now()

        # Check L2 enabled setting per corporation
        l2_setting = db.query(Setting).filter(Setting.key == "enable_l2").first()
        enable_l2 = bool(l2_setting.value.get("enabled", False)) if l2_setting and isinstance(l2_setting.value, dict) else False

        # Active complaints to check
        active_complaints = db.query(Complaint).filter(
            Complaint.status.notin_(["CLOSED", "REJECTED"])
        ).all()

        for c in active_complaints:
            # Check Auto-close
            if c.status == "RESOLVED":
                if check_auto_close(c.status, c.resolved_at, now):
                    c.status = "CLOSED"
                    c.closed_at = now
                    event = ComplaintEvent(
                        complaint_id=c.id,
                        actor_id="system_scheduler",
                        actor_name="NagarNetra System",
                        actor_role="system",
                        action="AUTO_CLOSED_7_DAYS",
                        from_status="RESOLVED",
                        to_status="CLOSED",
                        comment="Automatically closed 7 days after resolution with no citizen reopen request.",
                        created_at=now
                    )
                    db.add(event)
                    continue

            # First officer action timestamp
            first_action = None
            for ev in reversed(c.events):
                if ev.actor_role == "field_officer":
                    first_action = ev.created_at
                    break

            # Supervisor action timestamp
            supervisor_action = None
            for ev in reversed(c.events):
                if ev.actor_role == "supervisor":
                    supervisor_action = ev.created_at
                    break

            res = evaluate_escalation(
                status=c.status,
                created_at=c.created_at,
                response_due=c.response_due,
                resolution_due=c.resolution_due,
                first_officer_action_at=first_action,
                current_escalation_level=c.escalation_level,
                current_escalation_reason=c.escalation_reason,
                escalated_at=c.escalated_at,
                supervisor_action_at=supervisor_action,
                now=now,
                enable_l2=enable_l2
            )

            if res["escalate"]:
                c.escalation_level = res["escalation_level"]
                c.escalation_reason = res["escalation_reason"]
                c.escalated_at = res["escalated_at"]

                event = ComplaintEvent(
                    complaint_id=c.id,
                    actor_id="system_scheduler",
                    actor_name="NagarNetra SLA Engine",
                    actor_role="system",
                    action=f"ESCALATION_{res['escalation_level']}",
                    comment=f"Escalated to {res['escalation_level']}: {res['escalation_reason']}",
                    created_at=now
                )
                db.add(event)

                NotificationService.notify_role(
                    db=db,
                    corporation_id=c.corporation_id,
                    role="supervisor",
                    title=f"Complaint Escalated ({res['escalation_level']})",
                    body=f"{c.id} escalated due to {res['escalation_reason'].replace('_', ' ')}.",
                    complaint_id=c.id
                )

            if res["supervisor_overdue"] and not c.supervisor_overdue:
                c.supervisor_overdue = True
                event = ComplaintEvent(
                    complaint_id=c.id,
                    actor_id="system_scheduler",
                    actor_name="NagarNetra SLA Engine",
                    actor_role="system",
                    action="SUPERVISOR_OVERDUE_FLAGGED",
                    comment="Supervisor took no action within 72 hours of escalation. Visible on Corporation Admin view-only list.",
                    created_at=now
                )
                db.add(event)

                NotificationService.notify_role(
                    db=db,
                    corporation_id=c.corporation_id,
                    role="corp_admin",
                    title="Supervisor Overdue (72h)",
                    body=f"{c.id} has had no supervisor action for >72h after escalation.",
                    complaint_id=c.id
                )

        db.commit()
    except Exception as e:
        logger.error(f"Error during scheduler tick: {e}")
        db.rollback()
    finally:
        db.close()

def start_scheduler():
    scheduler = BackgroundScheduler()
    scheduler.add_job(tick_clock_evaluations, "interval", seconds=60)
    scheduler.start()
    return scheduler
