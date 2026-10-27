from __future__ import annotations

import random
import secrets
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.economy import UPGRADE_SECTORS, rarity_for_price, weight_for_price
from app.models import Domain, Inventory, Upgrade, User
from app.schemas import DomainOut, UpgradeIn, UpgradeOut
from app.security import get_current_user

router = APIRouter(prefix="/upgrade", tags=["upgrade"])
rng = random.SystemRandom()


def _new_mythic_name(zone: str) -> str:
    return f"vault-{secrets.token_hex(5)}"


@router.post("", response_model=UpgradeOut)
async def upgrade_domains(
    payload: UpgradeIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UpgradeOut:
    ids = sorted(set(payload.domain_ids))
    if not ids:
        raise HTTPException(status_code=422, detail="Выберите хотя бы один домен")

    locked_user = await db.scalar(
        select(User)
        .where(User.id == user.id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if locked_user is None:
        raise HTTPException(status_code=401, detail="Пользователь не найден")

    items = (
        await db.scalars(
            select(Inventory)
            .where(
                Inventory.user_id == user.id,
                Inventory.id.in_(ids),
                Inventory.sold_at.is_(None),
            )
            .order_by(Inventory.id)
            .with_for_update(of=Inventory)
            .execution_options(populate_existing=True)
        )
    ).all()
    if len(items) != len(ids):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Некоторые домены уже проданы или не принадлежат вам",
        )

    spent_value = sum(int(item.domain.price) for item in items)
    sector = payload.chance_sector
    multiplier = UPGRADE_SECTORS[sector]
    exact_chance = round(sector + rng.random() * 0.99, 2)
    success = rng.random() * 100 < exact_chance
    now = datetime.now(timezone.utc)

    # All selected domains are consumed in both outcomes.
    for item in items:
        item.sold_at = now
        item.sold_price = 0

    target_value = int(round(spent_value * multiplier * rng.uniform(0.8, 1.2)))
    target_value = max(1, target_value)
    target_rarity = rarity_for_price(target_value)
    won_domain: Domain | None = None

    if success:
        max_row = (
            await db.execute(
                select(func.max(Domain.price)).where(
                    Domain.is_available.is_(True), Domain.rarity == target_rarity
                )
            )
        ).scalar_one_or_none()
        max_price = int(max_row or 0)

        if target_rarity == "mythic" and target_value > max_price:
            zone = rng.choice((".com", ".io", ".ru", ".xyz"))
            for _ in range(20):
                name = _new_mythic_name(zone)
                exists = await db.scalar(
                    select(Domain.id).where(Domain.name == name, Domain.zone == zone)
                )
                if exists is None:
                    won_domain = Domain(
                        name=name,
                        zone=zone,
                        price=target_value,
                        rarity="mythic",
                        weight=round(weight_for_price(target_value), 8),
                        is_available=True,
                    )
                    db.add(won_domain)
                    await db.flush()
                    break
            if won_domain is None:
                raise HTTPException(status_code=503, detail="Не удалось создать домен")
        else:
            won_domain = await db.scalar(
                select(Domain)
                .where(
                    Domain.is_available.is_(True),
                    Domain.rarity == target_rarity,
                )
                .order_by(func.abs(Domain.price - target_value))
                .limit(1)
            )
            if won_domain is None:
                target_rarity = "mythic"
                zone = rng.choice((".com", ".io", ".ru", ".xyz"))
                won_domain = Domain(
                    name=_new_mythic_name(zone),
                    zone=zone,
                    price=target_value,
                    rarity="mythic",
                    weight=round(weight_for_price(target_value), 8),
                    is_available=True,
                )
                db.add(won_domain)
                await db.flush()

        db.add(
            Inventory(
                user_id=locked_user.id,
                domain_id=won_domain.id,
                acquired_at=now,
            )
        )

    upgrade = Upgrade(
        user_id=locked_user.id,
        from_domain_ids=ids,
        to_domain_id=won_domain.id if won_domain else None,
        chance=Decimal(str(exact_chance)),
        multiplier=Decimal(str(multiplier)),
        success=success,
        created_at=now,
    )
    db.add(upgrade)
    await db.commit()
    await db.refresh(upgrade)

    return UpgradeOut(
        id=upgrade.id,
        success=success,
        chance=exact_chance,
        multiplier=multiplier,
        spent_value=spent_value,
        target_value=target_value,
        from_domain_ids=ids,
        burned_ids=ids,
        domain=DomainOut.model_validate(won_domain) if won_domain else None,
        balance=locked_user.balance,
        created_at=upgrade.created_at,
    )
