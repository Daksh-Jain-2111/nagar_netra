import math
import datetime
from typing import List, Dict, Any

def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Computes distance in meters between two GPS coordinates using Haversine formula.
    """
    R = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2))
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c

def find_duplicate_candidates(
    complaint: Dict[str, Any],
    existing_complaints: List[Dict[str, Any]],
    max_distance_meters: float = 100.0,
    max_days_diff: float = 7.0
) -> List[Dict[str, Any]]:
    """
    Suggests duplicate matches with same category, <= 100 m, <= 7 days apart.
    Returns matched candidates sorted by closest distance.
    Parent is always the oldest complaint.
    """
    candidates = []
    c_lat = complaint.get("latitude")
    c_lon = complaint.get("longitude")
    c_cat = complaint.get("category_id")
    c_time = complaint.get("created_at")

    if c_lat is None or c_lon is None or not c_cat or not c_time:
        return candidates

    for other in existing_complaints:
        if other.get("id") == complaint.get("id"):
            continue
        if other.get("category_id") != c_cat:
            continue

        o_lat = other.get("latitude")
        o_lon = other.get("longitude")
        o_time = other.get("created_at")
        if o_lat is None or o_lon is None or not o_time:
            continue

        dist = haversine_distance_meters(c_lat, c_lon, o_lat, o_lon)
        if dist > max_distance_meters:
            continue

        time_diff = abs((c_time - o_time).total_seconds()) / 86400.0
        if time_diff > max_days_diff:
            continue

        candidates.append({
            "candidate_id": other.get("id"),
            "distance_meters": round(dist, 1),
            "days_diff": round(time_diff, 1),
            "created_at": o_time,
            "status": other.get("status"),
            "address": other.get("address"),
            "is_older": o_time < c_time
        })

    candidates.sort(key=lambda x: x["distance_meters"])
    return candidates
