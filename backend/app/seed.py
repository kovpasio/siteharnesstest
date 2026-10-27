from __future__ import annotations

import logging

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain_generator import generate_domains
from app.economy import MAX_DOMAIN_COUNT
from app.models import Domain

logger = logging.getLogger(__name__)
BATCH_SIZE = 5_000


async def seed_domains(
    session: AsyncSession,
    target: int = MAX_DOMAIN_COUNT,
) -> None:
    """Seed the large catalog once, or top up an older volume."""
    available = int(
        await session.scalar(
            select(func.count()).select_from(Domain).where(Domain.is_available.is_(True))
        )
        or 0
    )
    if available >= target:
        logger.info("Domain catalog ready (%s available domains)", available)
        return

    logger.info("Generating %s virtual domains (current available: %s)", target, available)
    domains = generate_domains(target)

    # Old catalogs are kept for historical inventory rows but removed from
    # the roulette pool.
    await session.execute(update(Domain).values(is_available=False))

    dialect = session.get_bind().dialect.name
    for offset in range(0, len(domains), BATCH_SIZE):
        batch = domains[offset : offset + BATCH_SIZE]
        rows = [
            {
                "name": domain.name,
                "zone": domain.zone,
                "rarity": domain.rarity,
                "weight": domain.weight,
                "price": domain.price,
                "is_available": domain.is_available,
            }
            for domain in batch
        ]
        insert_fn = pg_insert if dialect == "postgresql" else sqlite_insert
        statement = insert_fn(Domain).values(rows)
        statement = statement.on_conflict_do_update(
            index_elements=["name", "zone"],
            set_={
                "rarity": statement.excluded.rarity,
                "weight": statement.excluded.weight,
                "price": statement.excluded.price,
                "is_available": statement.excluded.is_available,
            },
        )
        await session.execute(statement)
        logger.info(
            "Seeded %s/%s domains",
            min(offset + len(batch), len(domains)),
            len(domains),
        )

    await session.commit()
    logger.info("Seeded %s virtual domains", len(domains))
