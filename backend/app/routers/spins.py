from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.economy import RARITY_META
from app.models import Domain, Inventory, Spin, SpinCommitment, User
from app.schemas import (
    CommitmentOut,
    DomainOut,
    PrepareSpinIn,
    SpinIn,
    SpinOut,
)
from app.security import get_current_user
from app.services.fairness import (
    choose_domain_index,
    generate_server_seed,
    next_pity_counter,
    resolve_rarity,
    sanitize_client_seed,
    sha256_hex,
)
from app.services.realtime import publish_drop
from app.services.redis_client import redis_client

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


@router.post("/prepare", response_model=CommitmentOut)
async def prepare_spin(
    payload: PrepareSpinIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CommitmentOut:
    """Commit to a server seed before the spin.

    The response contains only sha256(server_seed).  The seed itself is kept
    in the database and revealed in the POST /spin response.
    """
    nonce = user.total_spins + 1

    if payload.client_seed is None or not payload.client_seed.strip():
        existing = await db.scalar(
            select(SpinCommitment)
            .where(
                SpinCommitment.user_id == user.id,
                SpinCommitment.nonce == nonce,
                SpinCommitment.used_at.is_(None),
            )
            .order_by(SpinCommitment.id.desc())
            .limit(1)
        )
        if existing is not None:
            return CommitmentOut(
                commitment_id=existing.id,
                server_seed_hash=existing.server_seed_hash,
                client_seed=existing.client_seed,
                nonce=existing.nonce,
                created_at=existing.created_at,
            )

    client_seed = sanitize_client_seed(payload.client_seed)
    server_seed = generate_server_seed()
    created_at = datetime.now(timezone.utc)
    commitment = SpinCommitment(
        user_id=user.id,
        server_seed=server_seed,
        server_seed_hash=sha256_hex(server_seed),
        client_seed=client_seed,
        nonce=nonce,
        created_at=created_at,
    )
    db.add(commitment)
    await db.commit()
    return CommitmentOut(
        commitment_id=commitment.id,
        server_seed_hash=commitment.server_seed_hash,
        client_seed=commitment.client_seed,
        nonce=commitment.nonce,
        created_at=created_at,
    )


@router.post("", response_model=SpinOut)
async def spin(
    payload: SpinIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SpinOut:
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

        if locked_user.balance < settings.spin_cost:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="Недостаточно монет для спина",
            )

        if payload.commitment_id is not None:
            commitment = await db.scalar(
                select(SpinCommitment)
                .where(
                    SpinCommitment.id == payload.commitment_id,
                    SpinCommitment.user_id == locked_user.id,
                )
                .with_for_update()
                .execution_options(populate_existing=True)
            )
            if commitment is None:
                raise HTTPException(status_code=404, detail="Commitment не найден")
            if commitment.used_at is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Commitment уже использован. Подготовьте новый.",
                )
            if commitment.nonce != locked_user.total_spins + 1:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Commitment устарел. Подготовьте новый.",
                )
            server_seed = commitment.server_seed
            server_seed_hash = commitment.server_seed_hash
            client_seed = commitment.client_seed
            nonce = commitment.nonce
        else:
            client_seed = sanitize_client_seed(payload.client_seed)
            nonce = locked_user.total_spins + 1
            server_seed = generate_server_seed()
            server_seed_hash = sha256_hex(server_seed)
            commitment = SpinCommitment(
                user_id=locked_user.id,
                server_seed=server_seed,
                server_seed_hash=server_seed_hash,
                client_seed=client_seed,
                nonce=nonce,
            )
            db.add(commitment)
            await db.flush()

        domains = list((await db.scalars(select(Domain).order_by(Domain.id))).all())
        if not domains:
            raise HTTPException(status_code=503, detail="Каталог доменов пуст")

        buckets: dict[str, list[Domain]] = {}
        for domain in domains:
            buckets.setdefault(domain.rarity, []).append(domain)

        resolution = resolve_rarity(
            server_seed,
            client_seed,
            nonce,
            locked_user.pity_counter,
            settings.pity_threshold,
        )
        candidates = buckets.get(resolution.rarity, [])
        if not candidates:
            raise HTTPException(status_code=503, detail="Нет доменов нужной редкости")

        domain_index, domain_roll = choose_domain_index(
            server_seed, client_seed, nonce, len(candidates)
        )
        chosen = candidates[domain_index]
        price = RARITY_META[resolution.rarity]["price"]

        locked_user.balance -= settings.spin_cost
        locked_user.total_spins += 1
        locked_user.pity_counter = next_pity_counter(
            locked_user.pity_counter,
            resolution.rarity,
            settings.pity_threshold,
        )
        commitment.used_at = now

        spin_row = Spin(
            commitment_id=commitment.id,
            user_id=locked_user.id,
            domain_id=chosen.id,
            rarity=resolution.rarity,
            base_rarity=resolution.base_rarity,
            server_seed=server_seed,
            server_seed_hash=server_seed_hash,
            client_seed=client_seed,
            nonce=nonce,
            rarity_roll=resolution.rarity_roll,
            domain_roll=domain_roll,
            domain_index=domain_index,
            bucket_size=len(candidates),
            pity_applied=resolution.pity_applied,
            price=price,
            created_at=now,
        )
        db.add(spin_row)
        await db.flush()

        db.add(
            Inventory(
                user_id=locked_user.id,
                domain_id=chosen.id,
                acquired_at=now,
            )
        )
        await db.commit()
        await db.refresh(spin_row)

        spin_row.user = locked_user
        spin_row.domain = chosen
        await publish_drop(spin_row)

        return SpinOut(
            id=spin_row.id,
            domain=DomainOut.model_validate(chosen),
            rarity=resolution.rarity,
            base_rarity=resolution.base_rarity,
            price=price,
            server_seed=server_seed,
            server_seed_hash=server_seed_hash,
            client_seed=client_seed,
            nonce=nonce,
            rarity_roll=resolution.rarity_roll,
            domain_roll=domain_roll,
            domain_index=domain_index,
            bucket_size=len(candidates),
            pity_applied=resolution.pity_applied,
            pity_counter=locked_user.pity_counter,
            balance=locked_user.balance,
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
