from __future__ import annotations

import logging

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.economy import RARITY_META
from app.models import Domain
from app.seed_data import SEED_GROUPS, ZONES

logger = logging.getLogger(__name__)


async def seed_domains(session: AsyncSession) -> None:
    existing = await session.scalar(select(func.count()).select_from(Domain))
    if existing and existing >= 200:
        logger.info("Domain catalog already seeded (%s domains)", existing)
        return

    if existing:
        logger.info("Catalog has %s domains; adding only missing seed rows", existing)

    existing_keys = set(
        (await session.execute(select(Domain.name, Domain.zone))).all()
    )

    global_index = 0
    created = 0
    for rarity, names in SEED_GROUPS:
        meta = RARITY_META[rarity]
        for name in names:
            zone = ZONES[global_index % len(ZONES)]
            global_index += 1
            if (name, zone) in existing_keys:
                continue
            session.add(
                Domain(
                    name=name,
                    zone=zone,
                    rarity=rarity,
                    weight=meta["weight"],
                    price=meta["price"],
                )
            )
            created += 1

    await session.commit()
    logger.info("Seeded %s virtual domains", created)
