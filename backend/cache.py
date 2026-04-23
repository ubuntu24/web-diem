"""
Unified TTL cache.

- Preferred backend: Redis (if REDIS_URL is configured and reachable).
- Fallback backend: in-memory store.

Public API is intentionally unchanged so existing callers keep working.
"""

import logging
import os
import pickle
import threading
import time
from typing import Any, Optional

try:
    import redis
except Exception:  # pragma: no cover - dependency may be missing in local env
    redis = None

logger = logging.getLogger(__name__)

# -------------------------------------------------------------------------
# Redis backend (preferred)
# -------------------------------------------------------------------------
_REDIS_URL = os.getenv("REDIS_URL", "").strip()
_redis_client: Any = None


def _init_redis() -> None:
    global _redis_client
    if not _REDIS_URL:
        return
    if redis is None:
        logger.warning("[CACHE] REDIS_URL is set but redis package is not installed; using in-memory cache.")
        return

    try:
        _redis_client = redis.Redis.from_url(
            _REDIS_URL,
            decode_responses=False,
            socket_connect_timeout=1,
            socket_timeout=1,
            health_check_interval=30,
        )
        _redis_client.ping()
        logger.info("[CACHE] Redis connected.")
    except Exception as exc:
        _redis_client = None
        logger.warning(f"[CACHE] Redis unavailable ({exc}); using in-memory cache.")


def _serialize(value: Any) -> bytes:
    return pickle.dumps(value, protocol=pickle.HIGHEST_PROTOCOL)


def _deserialize(raw: bytes) -> Any:
    return pickle.loads(raw)

# -------------------------------------------------------------------------
# Internal store: { key: (value, expire_at) }
# -------------------------------------------------------------------------
_store: dict[str, tuple[Any, float]] = {}
_lock = threading.Lock()

# Số lượng keys tối đa để tránh memory leak
_MAX_KEYS = 2000


def _evict_expired():
    """Xóa các key đã hết hạn (gọi nội bộ, không lock lại)."""
    now = time.time()
    expired = [k for k, (_, exp) in _store.items() if exp <= now]
    for k in expired:
        del _store[k]


def _mem_get(key: str) -> Optional[Any]:
    with _lock:
        entry = _store.get(key)
        if entry is None:
            return None
        value, expire_at = entry
        if time.time() > expire_at:
            del _store[key]
            return None
        return value


def _mem_set(key: str, value: Any, ttl: int = 300) -> None:
    with _lock:
        if len(_store) >= _MAX_KEYS:
            _evict_expired()
            if len(_store) >= _MAX_KEYS:
                oldest = min(_store, key=lambda k: _store[k][1])
                del _store[oldest]
        _store[key] = (value, time.time() + ttl)


def _mem_delete(key: str) -> None:
    with _lock:
        _store.pop(key, None)


def _mem_delete_prefix(prefix: str) -> int:
    with _lock:
        to_delete = [k for k in _store if k.startswith(prefix)]
        for k in to_delete:
            del _store[k]
        return len(to_delete)


def _mem_clear_all() -> None:
    with _lock:
        _store.clear()


def _mem_stats() -> dict:
    with _lock:
        now = time.time()
        alive = sum(1 for _, (_, exp) in _store.items() if exp > now)
        return {"mode": "memory", "total_keys": len(_store), "alive_keys": alive}


def get(key: str) -> Optional[Any]:
    """Lấy giá trị từ cache. Trả về None nếu không có hoặc đã hết TTL."""
    if _redis_client is not None:
        try:
            raw = _redis_client.get(key)
            if raw is None:
                return None
            return _deserialize(raw)
        except Exception as exc:
            logger.warning(f"[CACHE] Redis GET failed for key '{key}': {exc}. Falling back to memory.")
    return _mem_get(key)


def set(key: str, value: Any, ttl: int = 300):
    """
    Lưu giá trị vào cache.
    ttl: time-to-live tính bằng giây (mặc định 5 phút).
    """
    ttl = max(1, int(ttl))
    if _redis_client is not None:
        try:
            _redis_client.setex(key, ttl, _serialize(value))
            return
        except Exception as exc:
            logger.warning(f"[CACHE] Redis SET failed for key '{key}': {exc}. Falling back to memory.")
    _mem_set(key, value, ttl)


def delete(key: str):
    """Xóa một key cụ thể."""
    if _redis_client is not None:
        try:
            _redis_client.delete(key)
            return
        except Exception as exc:
            logger.warning(f"[CACHE] Redis DELETE failed for key '{key}': {exc}. Falling back to memory.")
    _mem_delete(key)


def delete_prefix(prefix: str):
    """Xóa tất cả keys bắt đầu bằng prefix (tương đương Redis SCAN + DEL)."""
    if _redis_client is not None:
        try:
            keys = list(_redis_client.scan_iter(match=f"{prefix}*", count=500))
            if keys:
                _redis_client.delete(*keys)
                logger.debug(f"[CACHE] Invalidated {len(keys)} keys with prefix '{prefix}' (redis)")
            return
        except Exception as exc:
            logger.warning(f"[CACHE] Redis delete_prefix failed for '{prefix}': {exc}. Falling back to memory.")

    deleted = _mem_delete_prefix(prefix)
    if deleted:
        logger.debug(f"[CACHE] Invalidated {deleted} keys with prefix '{prefix}' (memory)")


def clear_all():
    """Xóa toàn bộ cache (dùng khi restart hoặc debug)."""
    if _redis_client is not None:
        try:
            _redis_client.flushdb()
            return
        except Exception as exc:
            logger.warning(f"[CACHE] Redis FLUSHDB failed: {exc}. Falling back to memory.")
    _mem_clear_all()


def stats() -> dict:
    """Trả về thống kê cache (dùng để debug)."""
    if _redis_client is not None:
        try:
            info = _redis_client.info("memory")
            return {
                "mode": "redis",
                "total_keys": int(_redis_client.dbsize()),
                "used_memory": int(info.get("used_memory", 0)),
                "used_memory_human": info.get("used_memory_human", "0B"),
            }
        except Exception as exc:
            logger.warning(f"[CACHE] Redis STATS failed: {exc}. Falling back to memory.")
    return _mem_stats()


_init_redis()
