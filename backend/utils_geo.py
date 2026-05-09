import ipaddress
import requests
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Simple in-memory cache to avoid repeated API calls for the same IP
_geo_cache: dict[str, dict] = {}

# All fields we request from ip-api.com (free tier)
_IP_API_FIELDS = (
    "status,message,country,countryCode,region,regionName,"
    "city,district,zip,lat,lon,isp,org,mobile,proxy,hosting,query"
)

def _is_private_ip(ip: str) -> bool:
    """Check if an IP belongs to a private/reserved range (RFC 1918 + loopback)."""
    try:
        addr = ipaddress.ip_address(ip)
        return addr.is_private or addr.is_loopback or addr.is_reserved
    except ValueError:
        return True  # Treat unparseable IPs as private


def _reverse_geocode_district(lat: float, lon: float) -> Optional[str]:
    """
    Use Nominatim (OpenStreetMap) reverse geocoding to find
    the district/suburb from lat/lon coordinates.
    Free, no API key, but rate-limited to 1 req/sec.
    Since we cache per IP, each unique IP only calls this once.
    """
    try:
        resp = requests.get(
            "https://nominatim.openstreetmap.org/reverse",
            params={
                "lat": lat,
                "lon": lon,
                "format": "json",
                "addressdetails": 1,
                "zoom": 14,  # suburb/district level
                "accept-language": "vi",  # Vietnamese locale for VN addresses
            },
            headers={"User-Agent": "lifesuck-platform/1.0"},
            timeout=4,
        )
        if resp.status_code == 200:
            data = resp.json()
            addr = data.get("address", {})
            # Try multiple keys — Nominatim uses different keys depending on region
            district = (
                addr.get("suburb")       # quận/phường in VN cities
                or addr.get("city_district")  # alternative district key
                or addr.get("quarter")   # khu phố
                or addr.get("neighbourhood")
                or addr.get("county")    # huyện (rural)
                or addr.get("town")      # thị trấn
                or addr.get("village")   # xã
            )
            return district
    except Exception as e:
        logger.debug(f"Nominatim reverse geocode failed for ({lat},{lon}): {e}")
    return None


def get_ip_location(ip: str) -> dict:
    """
    Comprehensive IP geolocation lookup.
    
    Returns a dict with all available metadata:
    {
        "location": "Quận Cầu Giấy, Hà Nội",  # human-readable string
        "city": "Hanoi",
        "region": "Hanoi",
        "country": "Vietnam", 
        "country_code": "VN",
        "district": "Cầu Giấy",
        "zip": "100000",
        "lat": 21.0285,
        "lon": 105.8542,
        "isp": "Viettel Group",
        "org": "Viettel",
        "is_mobile": False,
        "is_proxy": False,     # VPN/proxy detection
        "is_hosting": False,   # datacenter IP
    }
    """
    if not ip or ip in ("unknown", ""):
        return {"location": "Unknown"}
    
    # Fix: properly check private IPs (not just startswith 172.)
    if _is_private_ip(ip):
        return {"location": "Local/Internal"}
    
    if ip in _geo_cache:
        return _geo_cache[ip]
    
    result = {
        "location": "Unknown Location",
        "city": None,
        "region": None,
        "country": None,
        "country_code": None,
        "district": None,
        "zip": None,
        "lat": None,
        "lon": None,
        "isp": None,
        "org": None,
        "is_mobile": False,
        "is_proxy": False,
        "is_hosting": False,
    }
    
    try:
        # Using ip-api.com with FULL fields parameter to get district + metadata
        response = requests.get(
            f"http://ip-api.com/json/{ip}",
            params={"fields": _IP_API_FIELDS},
            timeout=4,
        )
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "success":
                city = data.get("city", "")
                region = data.get("regionName", "")
                country = data.get("country", "")
                country_code = data.get("countryCode", "")
                district = data.get("district", "")
                lat = data.get("lat")
                lon = data.get("lon")
                
                result.update({
                    "city": city,
                    "region": region,
                    "country": country,
                    "country_code": country_code,
                    "district": district,
                    "zip": data.get("zip", ""),
                    "lat": lat,
                    "lon": lon,
                    "isp": data.get("isp", ""),
                    "org": data.get("org", ""),
                    "is_mobile": bool(data.get("mobile", False)),
                    "is_proxy": bool(data.get("proxy", False)),
                    "is_hosting": bool(data.get("hosting", False)),
                })
                
                # If district is empty (very common for VN IPs), 
                # use reverse geocoding from lat/lon to find the exact district
                if not district and lat and lon:
                    try:
                        nominatim_district = _reverse_geocode_district(lat, lon)
                        if nominatim_district:
                            district = nominatim_district
                            result["district"] = district
                    except Exception as e:
                        logger.debug(f"Reverse geocode fallback failed: {e}")
                
                # Build the most specific human-readable location string
                if district and city:
                    result["location"] = f"{district}, {city}"
                elif city and region and city != region:
                    result["location"] = f"{city}, {region}"
                elif city and country:
                    result["location"] = f"{city}, {country}"
                elif region and country:
                    result["location"] = f"{region}, {country}"
                elif country:
                    result["location"] = country
                    
    except Exception as e:
        logger.error(f"Geo-IP lookup failed for {ip}: {e}")
    
    _geo_cache[ip] = result
    return result


def get_ip_location_string(ip: str) -> str:
    """Backward-compatible wrapper: returns just the location string."""
    data = get_ip_location(ip)
    return data.get("location", "Unknown Location")