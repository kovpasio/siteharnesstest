from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.economy import RARITY_ORDER, ZONES
from app.models import Domain, User
from app.schemas import DomainOut, MetaOut
from app.security import get_current_user
from app.economy import RARITY_META, TOTAL_WEIGHT, expected_value, house_edge, rarity_payload
from app.config import settings

router = APIRouter(tags=["catalog"])


@router.get("/domains", response_model=list[DomainOut])
async def list_domains(
    zone: str | None = Query(default=None),
    rarity: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[DomainOut]:
    stmt = select(Domain).order_by(Domain.id)
    if zone:
        stmt = stmt.where(Domain.zone == zone)
    if rarity:
        stmt = stmt.where(Domain.rarity == rarity)
    domains = (await db.scalars(stmt)).all()
    return [DomainOut.model_validate(domain) for domain in domains]


@router.get("/meta", response_model=MetaOut)
async def get_meta(db: AsyncSession = Depends(get_db)) -> MetaOut:
    return MetaOut(
        app_name=settings.app_name,
        zones=list(ZONES),
        rarities=rarity_payload(),
        economy={
            "start_balance": settings.start_balance,
            "spin_cost": settings.spin_cost,
            "daily_bonus": settings.daily_bonus,
            "daily_cooldown_hours": settings.daily_cooldown_hours,
            "expected_value": round(expected_value(), 2),
            "house_edge": round(house_edge(settings.spin_cost), 4),
            "pity_threshold": settings.pity_threshold,
            "sell_prices": {rarity: RARITY_META[rarity]["price"] for rarity in RARITY_ORDER},
        },
        total_weight=TOTAL_WEIGHT,
        provably_fair={
            "commitment": "sha256(server_seed)",
            "rarity_roll": "int(HMAC_SHA256(server_seed, client_seed:nonce), 16) mod 10000",
            "domain_index": "int(HMAC_SHA256(server_seed, client_seed:nonce:domain), 16) mod bucket_size",
        },
    )
