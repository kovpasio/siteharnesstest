from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings

logger = logging.getLogger(__name__)

_engine_options: dict = {"pool_pre_ping": True}
if not settings.database_url.startswith("sqlite"):
    _engine_options.update(pool_size=10, max_overflow=20)

engine = create_async_engine(settings.database_url, **_engine_options)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session


async def init_db(retries: int = 30, delay: float = 1.0) -> None:
    """Create tables and seed data. Retries while Postgres starts up."""
    from app import models  # noqa: F401  (register metadata)
    from app.migrations import migrate_schema
    from app.models import Base
    from app.seed import seed_domains

    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            async with engine.begin() as connection:
                await connection.run_sync(Base.metadata.create_all)
                await migrate_schema(connection)
            async with SessionLocal() as session:
                await seed_domains(session)
            logger.info("Database ready")
            return
        except Exception as exc:  # pragma: no cover - integration path
            last_error = exc
            logger.warning("Database not ready (attempt %s/%s): %s", attempt, retries, exc)
            await asyncio.sleep(delay)

    raise RuntimeError("Could not initialize database") from last_error


async def close_db() -> None:
    await engine.dispose()
