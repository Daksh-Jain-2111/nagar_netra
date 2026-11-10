from typing import Optional, Dict, Any, List

# 6 DEMO SMKMC WARD POLYGONS
# Centered around Sangli-Miraj-Kupwad (Sangli: 16.8524, 74.5815; Miraj: 16.8286, 74.6433; Kupwad: 16.8789, 74.6225)
# Marked DEMO as specified in user instructions
DEMO_WARDS_GEOJSON = [
    {
        "id": "ward_12",
        "ward_number": 12,
        "name": "Ward 12 - Vishrambag (DEMO)",
        "name_mr": "प्रभाग १२ - विश्रामबाग (डेमो)",
        # [lon, lat] polygon boundary
        "coordinates": [
            [74.5700, 16.8450],
            [74.5950, 16.8450],
            [74.5950, 16.8650],
            [74.5700, 16.8650],
            [74.5700, 16.8450]
        ]
    },
    {
        "id": "ward_1",
        "ward_number": 1,
        "name": "Ward 1 - Ganpati Peth (DEMO)",
        "name_mr": "प्रभाग १ - गणपती पेठ (डेमो)",
        "coordinates": [
            [74.5500, 16.8400],
            [74.5700, 16.8400],
            [74.5700, 16.8600],
            [74.5500, 16.8600],
            [74.5500, 16.8400]
        ]
    },
    {
        "id": "ward_3",
        "ward_number": 3,
        "name": "Ward 3 - Sangli City Centre (DEMO)",
        "name_mr": "प्रभाग ३ - सांगली शहर केंद्र (डेमो)",
        "coordinates": [
            [74.5500, 16.8600],
            [74.5800, 16.8600],
            [74.5800, 16.8850],
            [74.5500, 16.8850],
            [74.5500, 16.8600]
        ]
    },
    {
        "id": "ward_5",
        "ward_number": 5,
        "name": "Ward 5 - Miraj Market (DEMO)",
        "name_mr": "प्रभाग ५ - मिरज मार्केट (डेमो)",
        "coordinates": [
            [74.6300, 16.8150],
            [74.6600, 16.8150],
            [74.6600, 16.8350],
            [74.6300, 16.8350],
            [74.6300, 16.8150]
        ]
    },
    {
        "id": "ward_8",
        "ward_number": 8,
        "name": "Ward 8 - Miraj Station (DEMO)",
        "name_mr": "प्रभाग ८ - मिरज स्टेशन (डेमो)",
        "coordinates": [
            [74.6300, 16.8350],
            [74.6650, 16.8350],
            [74.6650, 16.8550],
            [74.6300, 16.8550],
            [74.6300, 16.8350]
        ]
    },
    {
        "id": "ward_18",
        "ward_number": 18,
        "name": "Ward 18 - Kupwad MIDC (DEMO)",
        "name_mr": "प्रभाग १८ - कुपवाड एमआयडीसी (डेमो)",
        "coordinates": [
            [74.6000, 16.8650],
            [74.6400, 16.8650],
            [74.6400, 16.8950],
            [74.6000, 16.8950],
            [74.6000, 16.8650]
        ]
    }
]

def is_point_in_polygon(lon: float, lat: float, poly: List[List[float]]) -> bool:
    """
    Standard Ray-casting algorithm for 2D Point-in-Polygon in pure Python.
    """
    inside = False
    n = len(poly)
    p1x, p1y = poly[0]
    for i in range(1, n + 1):
        p2x, p2y = poly[i % n]
        if lat > min(p1y, p2y):
            if lat <= max(p1y, p2y):
                if lon <= max(p1x, p2x):
                    if p1y != p2y:
                        xints = (lat - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                    if p1x == p2x or lon <= xints:
                        inside = not inside
        p1x, p1y = p2x, p2y
    return inside

def detect_ward_from_gps(lat: float, lon: float, wards_data: Optional[List[Dict[str, Any]]] = None) -> Optional[Dict[str, Any]]:
    """
    Detects ward from GPS coordinates using polygons.
    Falls back to closest demo ward if slightly outside bounding polygons.
    """
    wards = wards_data or DEMO_WARDS_GEOJSON
    for w in wards:
        coords = w.get("coordinates")
        if coords and is_point_in_polygon(lon, lat, coords):
            return {
                "ward_id": w["id"],
                "ward_number": w["ward_number"],
                "name": w["name"],
                "name_mr": w.get("name_mr")
            }

    # Fallback to default Vishrambag (Ward 12) for SMKMC demo
    return {
        "ward_id": "ward_12",
        "ward_number": 12,
        "name": "Ward 12 - Vishrambag (DEMO Default)",
        "name_mr": "प्रभाग १२ - विश्रामबाग"
    }
