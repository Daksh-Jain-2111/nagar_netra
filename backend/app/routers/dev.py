from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from backend.app.config import settings
from backend.app.services.time_service import advance_time, reset_time, get_now, get_offset_hours
from backend.app.seed.seed_data import seed_database
from backend.app.scheduler.clock_scheduler import tick_clock_evaluations

router = APIRouter(prefix="/dev", tags=["dev"])

class TimeTravelRequest(BaseModel):
    hours: float = Field(..., description="Number of hours to travel forward in simulated time")

def check_dev_mode():
    if not settings.DEV_MODE:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dev endpoints are disabled when DEV_MODE=false"
        )

@router.post("/time-travel")
def dev_time_travel(payload: TimeTravelRequest):
    """
    Simulates time progression for testing SLA clock expirations, escalations,
    and automatic 7-day closure.
    """
    check_dev_mode()
    new_simulated_time = advance_time(payload.hours)

    # Immediately run scheduler tick with the new simulated time
    tick_clock_evaluations()

    return {
        "status": "SUCCESS",
        "hours_advanced": payload.hours,
        "total_offset_hours": get_offset_hours(),
        "simulated_server_time": new_simulated_time.isoformat()
    }

@router.post("/reset-seed")
def dev_reset_seed():
    """Resets simulated clocks and re-seeds database cleanly with SMKMC demo records."""
    check_dev_mode()
    reset_time()
    seed_database(force_reseed=True)
    return {
        "status": "SUCCESS",
        "message": "Database reseeded successfully and time travel offset reset."
    }

@router.post("/run-scheduler")
def dev_run_scheduler():
    """Manually triggers immediate run of SLA clock evaluations."""
    check_dev_mode()
    tick_clock_evaluations()
    return {
        "status": "SUCCESS",
        "simulated_server_time": get_now().isoformat(),
        "message": "SLA clock evaluations completed."
    }
