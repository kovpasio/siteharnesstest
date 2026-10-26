from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    telegram_id: int
    username: str | None
    display_name: str
    avatar_url: str | None
    balance: int
    pity_counter: int
    total_spins: int
    created_at: datetime


class DomainOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    zone: str
    full_name: str
    rarity: Literal["common", "rare", "epic", "legendary", "mythic"]
    weight: int
    price: int


class DevUserIn(BaseModel):
    id: int = 100_000_001
    username: str = "demo_pilot"
    first_name: str = "Demo"
    last_name: str | None = None
    photo_url: str | None = None


class TelegramAuthIn(BaseModel):
    init_data: str = Field(
        default="",
        validation_alias=AliasChoices("init_data", "initData"),
    )
    dev_user: DevUserIn | None = None


class AuthOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class MeStats(BaseModel):
    collection_count: int
    collection_value: int
    collection_by_rarity: dict[str, int]
    rank: int | None
    total_players: int
    pity_counter: int
    pity_threshold: int
    spin_cost: int
    daily_bonus: int
    daily_available_at: datetime | None
    can_daily_bonus: bool


class MeOut(BaseModel):
    user: UserOut
    stats: MeStats


class PrepareSpinIn(BaseModel):
    client_seed: str | None = Field(default=None, max_length=64)


class CommitmentOut(BaseModel):
    commitment_id: int
    server_seed_hash: str
    client_seed: str
    nonce: int
    created_at: datetime


class SpinIn(BaseModel):
    commitment_id: int | None = None
    client_seed: str | None = Field(default=None, max_length=64)


class SpinOut(BaseModel):
    id: int
    domain: DomainOut
    rarity: str
    base_rarity: str
    price: int
    server_seed: str
    server_seed_hash: str
    client_seed: str
    nonce: int
    rarity_roll: int
    domain_roll: int
    domain_index: int
    bucket_size: int
    pity_applied: bool
    pity_counter: int
    balance: int
    created_at: datetime


class InventoryItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    domain: DomainOut
    acquired_at: datetime
    sold_at: datetime | None = None
    sold_price: int | None = None


class SellOut(BaseModel):
    item_id: int
    sold_price: int
    balance: int
    domain: DomainOut


class LeaderboardEntry(BaseModel):
    rank: int
    user_id: int
    username: str
    display_name: str
    avatar_url: str | None
    score: int
    domains_count: int
    is_me: bool = False


class LeaderboardOut(BaseModel):
    entries: list[LeaderboardEntry]
    me: LeaderboardEntry | None
    total_players: int


class DropOut(BaseModel):
    spin_id: int
    user_id: int
    username: str
    display_name: str
    avatar_url: str | None
    domain: DomainOut
    rarity: str
    price: int
    pity_applied: bool
    created_at: datetime


class DropsResponse(BaseModel):
    drops: list[DropOut]


class DailyBonusOut(BaseModel):
    rewarded: bool
    amount: int
    balance: int
    next_available_at: datetime | None
    user: UserOut


class ManualVerifyIn(BaseModel):
    server_seed: str = Field(min_length=1, max_length=256)
    client_seed: str = Field(min_length=1, max_length=64)
    nonce: int = Field(ge=1, le=2_147_483_647)
    pity_counter: int = Field(default=0, ge=0, le=50)


class VerifyOut(BaseModel):
    spin_id: int | None = None
    username: str | None = None
    domain: DomainOut
    rarity: str
    base_rarity: str
    server_seed: str
    server_seed_hash: str
    hash_valid: bool
    client_seed: str
    nonce: int
    rarity_roll: int
    domain_roll: int
    domain_index: int
    bucket_size: int
    pity_applied: bool
    computed_rarity: str
    computed_domain: DomainOut
    verified: bool
    created_at: datetime | None = None
    formula: str


class MetaOut(BaseModel):
    app_name: str
    zones: list[str]
    rarities: list[dict]
    economy: dict
    total_weight: int
    provably_fair: dict


class HealthOut(BaseModel):
    status: str
    database: str
    redis: str
