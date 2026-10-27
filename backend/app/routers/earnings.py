from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User
from app.schemas import EarnOut
from app.security import get_current_user

router = APIRouter(prefix="/earnings", tags=["earnings"])


async def _credit(db: AsyncSession, user: User, amount: int) -> EarnOut:
    result = await db.execute(
        update(User)
        .where(User.id == user.id)
        .values(balance=User.balance + amount)
    )
    if result.rowcount == 0:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Пользователь не найден",
        )
    await db.commit()
    await db.refresh(user)
    return EarnOut(earned=amount, balance=user.balance)


@router.post("/click", response_model=EarnOut)
async def earn_click(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> EarnOut:
    """Add exactly one virtual coin per tap."""
    return await _credit(db, user, 1)


@router.post("/hold", response_model=EarnOut)
async def earn_hold(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> EarnOut:
    """Add five virtual coins for one second of holding."""
    return await _credit(db, user, 5)
