from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import String, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Domain, Inventory, User
from app.schemas import (
    AdminBalanceIn,
    AdminBanIn,
    AdminGrantIn,
    AdminGrantOut,
    AdminOverviewOut,
    AdminUserOut,
    AdminUsersOut,
    DomainOut,
)
from app.security import get_current_user

router = APIRouter(prefix="/admin", tags=["admin"])


async def get_current_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ только для администратора",
        )
    return user


async def _target_user(db: AsyncSession, user_id: int) -> User:
    user = await db.scalar(
        select(User).where(User.id == user_id).with_for_update()
    )
    if user is None:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    return user


@router.get("/overview", response_model=AdminOverviewOut)
async def overview(
    _admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminOverviewOut:
    total_users = int(await db.scalar(select(func.count()).select_from(User)) or 0)
    banned = int(
        await db.scalar(select(func.count()).select_from(User).where(User.is_banned.is_(True))) or 0
    )
    admins = int(
        await db.scalar(select(func.count()).select_from(User).where(User.is_admin.is_(True))) or 0
    )
    total_balance = int(await db.scalar(select(func.coalesce(func.sum(User.balance), 0))) or 0)
    total_spins = int(await db.scalar(select(func.coalesce(func.sum(User.total_spins), 0))) or 0)
    inventory_count = int(
        await db.scalar(
            select(func.count()).select_from(Inventory).where(Inventory.sold_at.is_(None))
        )
        or 0
    )
    return AdminOverviewOut(
        users=total_users,
        banned=banned,
        admins=admins,
        total_balance=total_balance,
        total_spins=total_spins,
        inventory_count=inventory_count,
    )


@router.get("/users", response_model=AdminUsersOut)
async def list_users(
    _admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
    query: str = Query(default="", max_length=64),
    limit: int = Query(default=30, ge=1, le=100),
) -> AdminUsersOut:
    search = query.strip().lower().lstrip("@")
    statement = select(User).order_by(User.created_at.desc()).limit(limit)
    count_statement = select(func.count()).select_from(User)
    if search:
        conditions = [
            func.lower(func.coalesce(User.username, "")).contains(search),
            func.lower(User.display_name).contains(search),
            User.telegram_id.cast(String).contains(search),
        ]
        statement = statement.where(or_(*conditions))
        count_statement = count_statement.where(or_(*conditions))
    users = (await db.scalars(statement)).all()
    total = int(await db.scalar(count_statement) or 0)
    return AdminUsersOut(
        users=[AdminUserOut.model_validate(user) for user in users],
        total=total,
    )


@router.post("/users/{user_id}/balance", response_model=AdminUserOut)
async def change_balance(
    user_id: int,
    payload: AdminBalanceIn,
    _admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminUserOut:
    user = await _target_user(db, user_id)
    if user.balance + payload.amount < 0:
        raise HTTPException(status_code=422, detail="Баланс не может стать отрицательным")
    user.balance += payload.amount
    await db.commit()
    await db.refresh(user)
    return AdminUserOut.model_validate(user)


@router.post("/users/{user_id}/ban", response_model=AdminUserOut)
async def ban_user(
    user_id: int,
    payload: AdminBanIn,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminUserOut:
    user = await _target_user(db, user_id)
    if user.id == admin.id:
        raise HTTPException(status_code=422, detail="Нельзя забанить самого себя")
    if user.is_admin and payload.banned:
        raise HTTPException(status_code=422, detail="Нельзя забанить администратора")
    user.is_banned = payload.banned
    user.ban_reason = payload.reason if payload.banned else None
    user.banned_at = datetime.now(timezone.utc) if payload.banned else None
    await db.commit()
    await db.refresh(user)
    return AdminUserOut.model_validate(user)


@router.post("/users/{user_id}/grant-domain", response_model=AdminGrantOut)
async def grant_domain(
    user_id: int,
    payload: AdminGrantIn,
    _admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminGrantOut:
    user = await _target_user(db, user_id)
    statement = select(Domain).where(Domain.is_available.is_(True))
    if payload.rarity:
        statement = statement.where(Domain.rarity == payload.rarity)
    domain = await db.scalar(statement.order_by(func.random()).limit(1))
    if domain is None:
        raise HTTPException(status_code=404, detail="Подходящих доменов нет")
    db.add(Inventory(user_id=user.id, domain_id=domain.id))
    await db.commit()
    return AdminGrantOut(domain=DomainOut.model_validate(domain), balance=user.balance)
