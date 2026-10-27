from __future__ import annotations

import hashlib
import logging
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.economy import SPIN_TYPES
from app.models import Inventory, Spin, User
from app.schemas import DomainOut, SpinIn, SpinOut
from app.security import get_current_user
from app.services.autosell import get_or_create_settings, should_autosell
from app.services.realtime import publish_drop
from app.services.redis_client import redis_client
from app.services.roulette import weighted_random_domain

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/spin", tags=["spin"])


def _cooldown_key(user_id: int) -> str:
    return f"dropzone:spin:cooldown:{user_id}"


async def _enforce_cooldown(user_id: int) -> None:
    try:
        allowed = await redis_client.set(
            _cooldown_key(user_id),
            "1",
            nx=True,
            ex=settings.spin_cooldown_seconds,
        )
        if not allowed:
            ttl = await redis_client.ttl(_cooldown_key(user_id))
            retry_after = max(1, int(ttl))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Слишком быстро. Подождите {retry_after} с.",
                headers={"Retry-After": str(retry_after)},
            )
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - infrastructure path
        logger.exception("Redis cooldown failed")
        raise HTTPException(
            status_code=503,
            detail="Сервис временно недоступен (Redis)",
        ) from exc


async def _release_cooldown(user_id: int) -> None:
    try:
        await redis_client.delete(_cooldown_key(user_id))
    except Exception:  # pragma: no cover
        logger.warning("Could not release spin cooldown for %s", user_id)


@router.post("", response_model=SpinOut)
async def spin(
    payload: SpinIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SpinOut:
    roll = SPIN_TYPES[payload.roll_type]
    await _enforce_cooldown(user.id)
    now = datetime.now(timezone.utc)

    try:
        locked_user = await db.scalar(
            select(User)
            .where(User.id == user.id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        if locked_user is None:
            raise HTTPException(status_code=401, detail="Пользователь не найден")

        if locked_user.balance < roll["cost"]:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail=f"Недостаточно монет: нужно {roll['cost']}",
            )

        domain = await weighted_random_domain(db, roll["rarities"])
        if domain is None:
            raise HTTPException(status_code=503, detail="Пул доменов пуст")

        autosell = await get_or_create_settings(db, locked_user.id)
        price = int(domain.price)
        sale_price = price
        auto_sold = should_autosell(autosell, domain.rarity, price)
        locked_user.balance -= roll["cost"]
        if auto_sold:
            locked_user.balance += sale_price
        locked_user.total_spins += 1

        server_seed = secrets.token_hex(32)
        nonce = locked_user.total_spins
        spin_row = Spin(
            commitment_id=None,
            user_id=locked_user.id,
            domain_id=domain.id,
            roll_type=payload.roll_type,
            rarity=domain.rarity,
            base_rarity=domain.rarity,
            server_seed=server_seed,
            server_seed_hash=hashlib.sha256(server_seed.encode()).hexdigest(),
            client_seed=secrets.token_hex(8),
            nonce=nonce,
            rarity_roll=0,
            domain_roll=0,
            domain_index=0,
            bucket_size=0,
            pity_applied=False,
            price=price,
            auto_sold=auto_sold,
            auto_sold_price=sale_price if auto_sold else None,
            created_at=now,
        )
        db.add(spin_row)
        await db.flush()

        if not auto_sold:
            db.add(
                Inventory(
                    user_id=locked_user.id,
                    domain_id=domain.id,
                    acquired_at=now,
                )
            )

        await db.commit()
        await db.refresh(spin_row)
        spin_row.user = locked_user
        spin_row.domain = domain
        await publish_drop(spin_row)

        return SpinOut(
            id=spin_row.id,
            roll_type=payload.roll_type,
            domain=DomainOut.model_validate(domain),
            rarity=domain.rarity,
            price=price,
            balance=locked_user.balance,
            auto_sold=auto_sold,
            auto_sold_price=sale_price if auto_sold else None,
            created_at=spin_row.created_at,
        )
    except HTTPException:
        await db.rollback()
        await _release_cooldown(user.id)
        raise
    except Exception:
        await db.rollback()
        await _release_cooldown(user.id)
        logger.exception("Spin failed for user %s", user.id)
        raise
