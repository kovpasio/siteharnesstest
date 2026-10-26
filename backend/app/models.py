from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import (
    BigInteger,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    TypeDecorator,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from app.config import settings


class UTCDateTime(TypeDecorator):
    """Always expose timezone-aware UTC datetimes.

    PostgreSQL TIMESTAMPTZ already does this.  SQLite (used by the test/demo
    suite) stores naive values, which would otherwise be parsed by JavaScript
    as local time and shown with a timezone offset.
    """

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect):
        if value is not None and value.tzinfo is not None:
            return value.astimezone(timezone.utc)
        return value

    def process_result_value(self, value: datetime | None, dialect):
        if value is not None and value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    telegram_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True, nullable=False)
    username: Mapped[str | None] = mapped_column(String(64), nullable=True)
    display_name: Mapped[str] = mapped_column(String(128), nullable=False, default="Pilot")
    avatar_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    balance: Mapped[int] = mapped_column(Integer, nullable=False, default=settings.start_balance)
    pity_counter: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_spins: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_daily_bonus: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime(), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        UTCDateTime(),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    inventory: Mapped[list[Inventory]] = relationship(back_populates="user")


class Domain(Base):
    __tablename__ = "domains"
    __table_args__ = (
        UniqueConstraint("name", "zone", name="uq_domains_name_zone"),
        Index("ix_domains_rarity_id", "rarity", "id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    zone: Mapped[str] = mapped_column(String(8), nullable=False)
    rarity: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    weight: Mapped[int] = mapped_column(Integer, nullable=False)
    price: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime(), nullable=False, server_default=func.now()
    )

    @property
    def full_name(self) -> str:
        return f"{self.name}{self.zone}"


class SpinCommitment(Base):
    __tablename__ = "spin_commitments"
    __table_args__ = (Index("ix_spin_commitments_user_nonce", "user_id", "nonce"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    server_seed: Mapped[str] = mapped_column(String(128), nullable=False)
    server_seed_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    client_seed: Mapped[str] = mapped_column(String(64), nullable=False)
    nonce: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime(), nullable=False, server_default=func.now()
    )
    used_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)


class Spin(Base):
    __tablename__ = "spins"
    __table_args__ = (Index("ix_spins_user_created", "user_id", "created_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    commitment_id: Mapped[int | None] = mapped_column(
        ForeignKey("spin_commitments.id", ondelete="SET NULL"), nullable=True
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    domain_id: Mapped[int] = mapped_column(ForeignKey("domains.id"), nullable=False)
    rarity: Mapped[str] = mapped_column(String(16), nullable=False)
    base_rarity: Mapped[str] = mapped_column(String(16), nullable=False)
    server_seed: Mapped[str] = mapped_column(String(128), nullable=False)
    server_seed_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    client_seed: Mapped[str] = mapped_column(String(64), nullable=False)
    nonce: Mapped[int] = mapped_column(Integer, nullable=False)
    rarity_roll: Mapped[int] = mapped_column(Integer, nullable=False)
    domain_roll: Mapped[int] = mapped_column(Integer, nullable=False)
    domain_index: Mapped[int] = mapped_column(Integer, nullable=False)
    bucket_size: Mapped[int] = mapped_column(Integer, nullable=False)
    pity_applied: Mapped[bool] = mapped_column(nullable=False, default=False)
    price: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime(), nullable=False, server_default=func.now()
    )

    domain: Mapped[Domain] = relationship(lazy="joined")
    user: Mapped[User] = relationship(lazy="joined")


class Inventory(Base):
    __tablename__ = "inventory"
    __table_args__ = (
        Index("ix_inventory_user_sold", "user_id", "sold_at"),
        Index("ix_inventory_domain", "domain_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    domain_id: Mapped[int] = mapped_column(ForeignKey("domains.id"), nullable=False)
    acquired_at: Mapped[datetime] = mapped_column(
        UTCDateTime(), nullable=False, server_default=func.now()
    )
    sold_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)
    sold_price: Mapped[int | None] = mapped_column(Integer, nullable=True)

    user: Mapped[User] = relationship(back_populates="inventory")
    domain: Mapped[Domain] = relationship(lazy="joined")
