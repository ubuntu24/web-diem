import requests
import logging

logger = logging.getLogger(__name__)

# Simple in-memory cache to avoid repeated API calls for the same IP
_geo_cache = {}

def get_ip_location(ip: str) -> str:
    """
    Lookup location for a given IP address using ip-api.com.
    Returns string like "Hanoi, Vietnam" or "Local/Unknown".
    """
    if not ip or ip in ("127.0.0.1", "localhost", "unknown", "::1") or ip.startswith("172."):
        return "Local/Internal"
    
    if ip in _geo_cache:
        return _geo_cache[ip]
    
    try:
        # Using ip-api.com (free tier, no key required)
        response = requests.get(f"http://ip-api.com/json/{ip}", timeout=3)
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "success":
                city = data.get("city", "Unknown")
                country = data.get("country", "Unknown")
                location = f"{city}, {country}"
                _geo_cache[ip] = location
                return location
    except Exception as e:
        logger.error(f"Geo-IP lookup failed for {ip}: {e}")
    
    return "Unknown Location"
