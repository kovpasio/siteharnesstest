from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User
from app.schemas import LeaderboardOut
from app.security import get_current_user
from app.services.stats import leaderboard

router = APIRouter(tags=["leaderboard"])


@router.get("/leaderboard", response_model=LeaderboardOut)
async def get_leaderboard(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> LeaderboardOut:
    entries, me, players = await leaderboard(db, user.id, limit=20)
    return LeaderboardOut(entries=entries, me=me, total_players=players)
