from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import User
from app.schemas import AuthOut, TelegramAuthIn, UserOut
from app.security import create_access_token
from app.services.telegram_auth import (
    InitDataError,
    TelegramUser,
    parse_user,
    validate_init_data,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])


async def upsert_user(
    session: AsyncSession,
    telegram_id: int,
    username: str | None,
    display_name: str,
    avatar_url: str | None,
) -> User:
    user = await session.scalar(select(User).where(User.telegram_id == telegram_id))
    if user is None:
        user = User(
            telegram_id=telegram_id,
            username=username,
            display_name=display_name or username or "Pilot",
            avatar_url=avatar_url,
            balance=settings.start_balance,
            pity_counter=0,
            total_spins=0,
        )
        session.add(user)
        try:
            await session.commit()
        except IntegrityError:
            await session.rollback()
            user = await session.scalar(select(User).where(User.telegram_id == telegram_id))
            if user is None:
                raise
    else:
        user.username = username
        user.display_name = display_name or username or user.display_name
        user.avatar_url = avatar_url
        await session.commit()

    await session.refresh(user)
    return user


@router.post("/telegram", response_model=AuthOut)
async def auth_telegram(
    payload: TelegramAuthIn,
    db: AsyncSession = Depends(get_db),
) -> AuthOut:
    init_data = payload.init_data.strip()

    if init_data:
        if not settings.bot_enabled:
            raise HTTPException(
                status_code=503,
                detail="BOT_TOKEN не настроен на сервере",
            )
        try:
            data = validate_init_data(init_data, settings.bot_token)
            tg_user: TelegramUser = parse_user(data)
        except InitDataError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Telegram initData отклонён: {exc}",
            ) from exc

        telegram_id = tg_user.id
        username = tg_user.username
        display_name = tg_user.display_name or username or "Pilot"
        avatar_url = tg_user.photo_url
    else:
        if not settings.dev_mode:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Откройте приложение внутри Telegram",
            )
        dev = payload.dev_user
        telegram_id = dev.id if dev else 100_000_001
        username = dev.username if dev else "demo_pilot"
        first_name = dev.first_name if dev else "Demo"
        last_name = dev.last_name if dev else None
        display_name = " ".join(
            part for part in (first_name, last_name) if part
        ).strip() or username or "Pilot"
        avatar_url = dev.photo_url if dev else None

    user = await upsert_user(
        db,
        telegram_id=telegram_id,
        username=username,
        display_name=display_name,
        avatar_url=avatar_url,
    )
    token = create_access_token(user)
    logger.info("Authenticated user %s (%s)", user.id, user.telegram_id)
    return AuthOut(access_token=token, user=UserOut.model_validate(user))
