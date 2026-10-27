"""Small idempotent schema upgrades for existing Docker volumes.

The project deliberately avoids Alembic for this demo.  ``create_all``
creates new tables, while these statements add columns to tables that were
created by an older version.
"""

from __future__ import annotations

import logging

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

logger = logging.getLogger(__name__)

POSTGRES_STATEMENTS = (
    "ALTER TABLE users ALTER COLUMN balance TYPE BIGINT",
    "ALTER TABLE domains ALTER COLUMN price TYPE BIGINT",
    "ALTER TABLE domains ALTER COLUMN weight TYPE DOUBLE PRECISION USING weight::double precision",
    "ALTER TABLE domains ADD COLUMN IF NOT EXISTS is_available BOOLEAN NOT NULL DEFAULT TRUE",
    "ALTER TABLE spins ADD COLUMN IF NOT EXISTS roll_type VARCHAR(32) NOT NULL DEFAULT 'normal'",
    "ALTER TABLE spins ADD COLUMN IF NOT EXISTS auto_sold BOOLEAN NOT NULL DEFAULT FALSE",
    "ALTER TABLE spins ADD COLUMN IF NOT EXISTS auto_sold_price BIGINT",
    "ALTER TABLE spins ALTER COLUMN price TYPE BIGINT",
    "ALTER TABLE inventory ALTER COLUMN sold_price TYPE BIGINT",
    "CREATE INDEX IF NOT EXISTS ix_domains_available_rarity ON domains (is_available, rarity)",
    "CREATE INDEX IF NOT EXISTS ix_domains_price ON domains (price)",
)


async def migrate_schema(connection: AsyncConnection) -> None:
    if connection.dialect.name != "postgresql":
        return
    for statement in POSTGRES_STATEMENTS:
        await connection.execute(text(statement))
    logger.info("Existing schema upgraded for the new domain economy")
