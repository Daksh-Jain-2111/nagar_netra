import datetime

_time_travel_offset_hours: float = 0.0

def get_now() -> datetime.datetime:
    """Returns current simulated server time factoring in any dev time-travel offset."""
    return datetime.datetime.utcnow() + datetime.timedelta(hours=_time_travel_offset_hours)

def advance_time(hours: float) -> datetime.datetime:
    """Advances simulated server time by the given number of hours."""
    global _time_travel_offset_hours
    _time_travel_offset_hours += hours
    return get_now()

def reset_time():
    """Resets simulated server time to real UTC."""
    global _time_travel_offset_hours
    _time_travel_offset_hours = 0.0

def get_offset_hours() -> float:
    return _time_travel_offset_hours
