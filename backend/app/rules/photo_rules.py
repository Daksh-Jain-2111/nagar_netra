import datetime
from typing import Dict, Any, Optional
from backend.app.rules.duplicate_rules import haversine_distance_meters

def verify_citizen_before_photo(
    complaint_lat: float,
    complaint_lon: float,
    exif_time: Optional[datetime.datetime],
    exif_lat: Optional[float],
    exif_lon: Optional[float],
    submission_time: datetime.datetime
) -> Dict[str, Any]:
    """
    Citizen photo: EXIF time <= 7 days and GPS <= 500 m -> VERIFIED;
    otherwise UNVERIFIED (with citizen consent noted).
    """
    if not exif_time or exif_lat is None or exif_lon is None:
        return {
            "is_verified": False,
            "reason": "Missing EXIF metadata; recorded as unverified photo",
            "distance_meters": None,
            "days_diff": None
        }

    distance = haversine_distance_meters(complaint_lat, complaint_lon, exif_lat, exif_lon)
    days_diff = abs((submission_time - exif_time).total_seconds()) / 86400.0

    is_verified = (distance <= 500.0) and (days_diff <= 7.0)
    return {
        "is_verified": is_verified,
        "distance_meters": round(distance, 1),
        "days_diff": round(days_diff, 1),
        "reason": "EXIF time <= 7 days and GPS <= 500m" if is_verified else "EXIF distance > 500m or older than 7 days"
    }

def verify_after_resolution_photo(
    complaint_lat: float,
    complaint_lon: float,
    complaint_created_at: datetime.datetime,
    after_photo_time: Optional[datetime.datetime],
    after_photo_lat: Optional[float],
    after_photo_lon: Optional[float]
) -> Dict[str, Any]:
    """
    After-photo: taken after submission and <= 200 m,
    otherwise flag it to supervisor and show amber note to citizen.
    """
    if not after_photo_time or after_photo_lat is None or after_photo_lon is None:
        return {
            "flagged": True,
            "warning": "Missing GPS or timestamp on resolution photo. Flagged for supervisor review.",
            "distance_meters": None
        }

    distance = haversine_distance_meters(complaint_lat, complaint_lon, after_photo_lat, after_photo_lon)
    is_after_submission = after_photo_time >= complaint_created_at
    is_within_200m = distance <= 200.0

    flagged = not (is_after_submission and is_within_200m)
    return {
        "flagged": flagged,
        "is_after_submission": is_after_submission,
        "distance_meters": round(distance, 1),
        "warning": "Photo location or time outside verified resolution boundaries" if flagged else None
    }
