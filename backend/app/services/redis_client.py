from __future__ import annotations

import logging

import redis.asyncio as redis

from app.config import settings

logger = logging.getLogger(__name__)

redis_client: redis.Redis = redis.from_url(
    settings.redis_url,
    decode_responses=True,
    socket_connect_timeout=3,
    socket_timeout=3,
    health_check_interval=30,
)


async def ping_redis() -> bool:
    try:
        return bool(await redis_client.ping())
    except Exception as exc:  # pragma: no cover - infrastructure path
        logger.warning("Redis ping failed: %s", exc)
        return False


async def close_redis() -> None:
    try:
        await redis_client.aclose()
    except Exception:  # pragma: no cover
        logger.exception("Failed to close Redis connection")
