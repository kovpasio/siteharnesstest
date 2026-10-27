from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Domain, Inventory, User
from app.schemas import BulkSellIn, BulkSellOut, DomainOut, InventoryItemOut, SellOut
from app.security import get_current_user

router = APIRouter(prefix="/inventory", tags=["inventory"])


@router.get("", response_model=list[InventoryItemOut])
async def get_inventory(
    zone: str | None = Query(default=None),
    rarity: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[InventoryItemOut]:
    stmt = (
        select(Inventory)
        .join(Domain, Domain.id == Inventory.domain_id)
        .where(Inventory.user_id == user.id, Inventory.sold_at.is_(None))
        .order_by(Inventory.acquired_at.desc(), Inventory.id.desc())
    )
    if zone:
        stmt = stmt.where(Domain.zone == zone)
    if rarity:
        stmt = stmt.where(Domain.rarity == rarity)
    items = (await db.scalars(stmt)).unique().all()
    return [InventoryItemOut.model_validate(item) for item in items]


@router.post("/sell-bulk", response_model=BulkSellOut)
async def sell_bulk(
    payload: BulkSellIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BulkSellOut:
    ids = sorted(set(payload.ids))
    locked_user = await db.scalar(
        select(User)
        .where(User.id == user.id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if locked_user is None:
        raise HTTPException(status_code=401, detail="Пользователь не найден")

    items = (
        await db.scalars(
            select(Inventory)
            .where(
                Inventory.user_id == user.id,
                Inventory.id.in_(ids),
                Inventory.sold_at.is_(None),
            )
            .order_by(Inventory.id)
            .with_for_update(of=Inventory)
            .execution_options(populate_existing=True)
        )
    ).all()

    if len(items) != len(ids):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Некоторые домены уже проданы или не принадлежат вам",
        )

    now = datetime.now(timezone.utc)
    earned = 0
    for item in items:
        price = int(item.domain.sell_price)
        item.sold_at = now
        item.sold_price = price
        earned += price

    locked_user.balance += earned
    await db.commit()
    await db.refresh(locked_user)

    return BulkSellOut(
        sold=len(items),
        earned=earned,
        balance=locked_user.balance,
        ids=ids,
    )


@router.post("/{item_id}/sell", response_model=SellOut)
async def sell_domain(
    item_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SellOut:
    locked_user = await db.scalar(
        select(User)
        .where(User.id == user.id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if locked_user is None:
        raise HTTPException(status_code=401, detail="Пользователь не найден")

    item = await db.scalar(
        select(Inventory)
        .where(Inventory.id == item_id, Inventory.user_id == user.id)
        # PostgreSQL rejects FOR UPDATE on the nullable side of an eager
        # outer join. Lock only the inventory row itself.
        .with_for_update(of=Inventory)
        .execution_options(populate_existing=True)
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Домен не найден в инвентаре")
    if item.sold_at is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Этот домен уже продан",
        )

    price = int(item.domain.sell_price)
    now = datetime.now(timezone.utc)
    item.sold_at = now
    item.sold_price = price
    locked_user.balance += price
    await db.commit()
    await db.refresh(locked_user)

    return SellOut(
        item_id=item.id,
        sold_price=price,
        balance=locked_user.balance,
        domain=DomainOut.model_validate(item.domain),
    )
