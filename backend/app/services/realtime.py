from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone

from fastapi import WebSocket
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Spin, User
from app.schemas import DomainOut
from app.services.redis_client import redis_client

logger = logging.getLogger(__name__)
DROPS_CHANNEL = "dropzone:drops"


def spin_to_drop(spin: Spin) -> dict:
    domain = DomainOut.model_validate(spin.domain).model_dump(mode="json")
    created_at = spin.created_at or datetime.now(timezone.utc)
    return {
        "spin_id": spin.id,
        "user_id": spin.user_id,
        "username": spin.user.username or spin.user.display_name,
        "display_name": spin.user.display_name,
        "avatar_url": spin.user.avatar_url,
        "domain": domain,
        "rarity": spin.rarity,
        "price": spin.price,
        "roll_type": spin.roll_type,
        "auto_sold": spin.auto_sold,
        "created_at": created_at.isoformat(),
    }


class DropsHub:
    def __init__(self) -> None:
        self.connections: set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket) -> None:
        async with self._lock:
            self.connections.add(websocket)

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            self.connections.discard(websocket)

    async def broadcast(self, payload: dict) -> None:
        async with self._lock:
            targets = list(self.connections)
        dead: list[WebSocket] = []
        for connection in targets:
            try:
                await connection.send_json(payload)
            except Exception:
                dead.append(connection)
        if dead:
            async with self._lock:
                for connection in dead:
                    self.connections.discard(connection)


hub = DropsHub()


async def recent_drops(session: AsyncSession, limit: int = 20) -> list[dict]:
    result = await session.execute(
        select(Spin)
        .join(User, User.id == Spin.user_id)
        .order_by(Spin.created_at.desc(), Spin.id.desc())
        .limit(limit)
    )
    return [spin_to_drop(spin) for spin in result.scalars().all()]


async def publish_drop(spin: Spin) -> None:
    """Publish a drop to every API instance through Redis.

    Falls back to an in-process broadcast if Redis is unavailable, so a
    temporary Redis outage never hides drops from connected clients.
    """
    payload = {"type": "drop", "drop": spin_to_drop(spin)}
    try:
        await redis_client.publish(DROPS_CHANNEL, json.dumps(payload))
    except Exception as exc:  # pragma: no cover - infrastructure path
        logger.warning("Redis publish failed, broadcasting locally: %s", exc)
        await hub.broadcast(payload)


async def redis_drops_listener(stop_event: asyncio.Event) -> None:
    """Keep a Pub/Sub subscription alive across Redis restarts."""
    while not stop_event.is_set():
        pubsub = redis_client.pubsub()
        try:
            await pubsub.subscribe(DROPS_CHANNEL)
            logger.info("Subscribed to %s", DROPS_CHANNEL)
            while not stop_event.is_set():
                message = await pubsub.get_message(
                    ignore_subscribe_messages=True, timeout=1.0
                )
                if not message:
                    continue
                if message.get("type") != "message":
                    continue
                try:
                    payload = json.loads(message["data"])
                except (TypeError, json.JSONDecodeError):
                    continue
                await hub.broadcast(payload)
        except asyncio.CancelledError:
            raise
        except Exception:  # pragma: no cover - infrastructure path
            logger.exception("Redis drops listener stopped; reconnecting in 2s")
            try:
                await asyncio.wait_for(stop_event.wait(), timeout=2)
            except asyncio.TimeoutError:
                pass
        finally:
            try:
                await pubsub.unsubscribe(DROPS_CHANNEL)
                await pubsub.aclose()
            except Exception:
                pass
