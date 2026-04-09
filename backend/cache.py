"""
In-memory TTL cache — dùng thay Redis khi chưa có Redis.
Thread-safe với threading.Lock.
Graceful: nếu muốn nâng cấp sang Redis sau thì chỉ cần sửa file này.
"""

import logging
import threading
import time
from typing import Any, Optional

logger = logging.getLogger(__name__)

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


def get(key: str) -> Optional[Any]:
    """Lấy giá trị từ cache. Trả về None nếu không có hoặc đã hết TTL."""
    with _lock:
        entry = _store.get(key)
        if entry is None:
            return None
        value, expire_at = entry
        if time.time() > expire_at:
            del _store[key]
            return None
        return value


def set(key: str, value: Any, ttl: int = 300):
    """
    Lưu giá trị vào cache.
    ttl: time-to-live tính bằng giây (mặc định 5 phút).
    """
    with _lock:
        # Evict expired keys nếu sắp đầy
        if len(_store) >= _MAX_KEYS:
            _evict_expired()
            # Nếu vẫn đầy, xóa key cũ nhất
            if len(_store) >= _MAX_KEYS:
                oldest = min(_store, key=lambda k: _store[k][1])
                del _store[oldest]
        _store[key] = (value, time.time() + ttl)


def delete(key: str):
    """Xóa một key cụ thể."""
    with _lock:
        _store.pop(key, None)


def delete_prefix(prefix: str):
    """Xóa tất cả keys bắt đầu bằng prefix (tương đương Redis SCAN + DEL)."""
    with _lock:
        to_delete = [k for k in _store if k.startswith(prefix)]
        for k in to_delete:
            del _store[k]
        if to_delete:
            logger.debug(f"[CACHE] Invalidated {len(to_delete)} keys with prefix '{prefix}'")


def clear_all():
    """Xóa toàn bộ cache (dùng khi restart hoặc debug)."""
    with _lock:
        _store.clear()


def stats() -> dict:
    """Trả về thống kê cache (dùng để debug)."""
    with _lock:
        now = time.time()
        alive = sum(1 for _, (_, exp) in _store.items() if exp > now)
        return {"total_keys": len(_store), "alive_keys": alive}
