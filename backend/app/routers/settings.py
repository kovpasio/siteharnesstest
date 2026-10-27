from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User
from app.schemas import AutosellSettingsIn, AutosellSettingsOut
from app.security import get_current_user
from app.services.autosell import get_or_create_settings, settings_payload

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/autosell", response_model=AutosellSettingsOut)
async def get_autosell_settings(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AutosellSettingsOut:
    settings = await get_or_create_settings(db, user.id)
    await db.commit()
    return settings_payload(settings)


@router.put("/autosell", response_model=AutosellSettingsOut)
async def update_autosell_settings(
    payload: AutosellSettingsIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AutosellSettingsOut:
    settings = await get_or_create_settings(db, user.id)
    settings.autosell_common = payload.autosell_common
    settings.autosell_rare = payload.autosell_rare
    settings.autosell_epic = payload.autosell_epic
    settings.autosell_legendary = payload.autosell_legendary
    settings.autosell_mythic = payload.autosell_mythic
    settings.autosell_below_price = payload.autosell_below_price
    await db.commit()
    return settings_payload(settings)
