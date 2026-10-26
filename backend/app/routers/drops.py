from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import SessionLocal, get_db
from app.models import User
from app.schemas import DropsResponse
from app.security import decode_access_token, get_current_user
from app.services.realtime import hub, recent_drops

logger = logging.getLogger(__name__)
router = APIRouter(tags=["drops"])


@router.get("/drops/recent", response_model=DropsResponse)
async def get_recent_drops(
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DropsResponse:
    return DropsResponse(drops=await recent_drops(db, limit=20))


@router.websocket("/drops/recent")
async def drops_websocket(
    websocket: WebSocket,
    token: str | None = Query(default=None),
) -> None:
    if not token:
        await websocket.close(code=1008)
        return

    try:
        payload = decode_access_token(token)
        user_id = int(payload["sub"])
    except Exception:
        await websocket.close(code=1008)
        return

    async with SessionLocal() as db:
        user = await db.get(User, user_id)
        if user is None:
            await websocket.close(code=1008)
            return
        drops = await recent_drops(db, limit=20)

    await websocket.accept()
    await websocket.send_json({"type": "snapshot", "drops": drops})
    await hub.connect(websocket)
    try:
        while True:
            # The client may send keep-alive pings; content is irrelevant.
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception:
        logger.debug("WebSocket closed unexpectedly", exc_info=True)
    finally:
        await hub.disconnect(websocket)
