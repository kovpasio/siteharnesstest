from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import UserSettings
from app.schemas import AutosellSettingsOut


def settings_payload(settings: UserSettings) -> AutosellSettingsOut:
    return AutosellSettingsOut(
        autosell_common=settings.autosell_common,
        autosell_rare=settings.autosell_rare,
        autosell_epic=settings.autosell_epic,
        autosell_legendary=settings.autosell_legendary,
        autosell_mythic=settings.autosell_mythic,
        autosell_below_price=settings.autosell_below_price,
    )


async def get_or_create_settings(
    db: AsyncSession,
    user_id: int,
    *,
    create: bool = True,
) -> UserSettings | None:
    settings = await db.get(UserSettings, user_id)
    if settings is None and create:
        settings = UserSettings(user_id=user_id)
        db.add(settings)
        await db.flush()
    return settings


def should_autosell(settings: UserSettings | None, rarity: str, price: int) -> bool:
    if settings is None:
        return False
    rarity_flag = {
        "common": settings.autosell_common,
        "rare": settings.autosell_rare,
        "epic": settings.autosell_epic,
        "legendary": settings.autosell_legendary,
        "mythic": settings.autosell_mythic,
    }.get(rarity, False)
    if rarity_flag:
        return True
    if settings.autosell_below_price is not None and price < settings.autosell_below_price:
        return True
    return False
