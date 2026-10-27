from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field

RarityLiteral = Literal["common", "rare", "epic", "legendary", "mythic"]
RollTypeLiteral = Literal[
    "normal",
    "uncommon_plus",
    "rare_plus",
    "epic_plus",
    "mythic",
]


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    telegram_id: int
    username: str | None
    display_name: str
    avatar_url: str | None
    balance: int
    total_spins: int
    created_at: datetime


class DomainOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    zone: str
    full_name: str
    rarity: RarityLiteral
    weight: float
    price: int
    sell_price: int
    is_available: bool


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
    daily_bonus: int
    daily_available_at: datetime | None
    can_daily_bonus: bool


class MeOut(BaseModel):
    user: UserOut
    stats: MeStats


class SpinIn(BaseModel):
    roll_type: RollTypeLiteral = "normal"


class SpinOut(BaseModel):
    id: int
    roll_type: str
    domain: DomainOut
    rarity: str
    price: int
    sell_price: int
    balance: int
    auto_sold: bool
    auto_sold_price: int | None
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


class BulkSellIn(BaseModel):
    ids: list[int] = Field(min_length=1, max_length=5_000)


class BulkSellOut(BaseModel):
    sold: int
    earned: int
    balance: int
    ids: list[int]


class AutosellSettingsOut(BaseModel):
    autosell_common: bool
    autosell_rare: bool
    autosell_epic: bool
    autosell_legendary: bool
    autosell_mythic: bool
    autosell_below_price: int | None


class AutosellSettingsIn(BaseModel):
    autosell_common: bool = False
    autosell_rare: bool = False
    autosell_epic: bool = False
    autosell_legendary: bool = False
    autosell_mythic: bool = False
    autosell_below_price: int | None = Field(default=None, ge=0)


class UpgradeIn(BaseModel):
    domain_ids: list[int] = Field(min_length=1, max_length=50)
    chance_sector: Literal[10, 25, 50, 75]


class UpgradeOut(BaseModel):
    id: int
    success: bool
    chance: float
    multiplier: float
    spent_value: int
    target_value: int
    from_domain_ids: list[int]
    burned_ids: list[int]
    domain: DomainOut | None
    balance: int
    created_at: datetime


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
    roll_type: str
    auto_sold: bool
    created_at: datetime


class DropsResponse(BaseModel):
    drops: list[DropOut]


class DailyBonusOut(BaseModel):
    rewarded: bool
    amount: int
    balance: int
    next_available_at: datetime | None
    user: UserOut


class RollTypeOut(BaseModel):
    key: str
    title: str
    short_title: str
    cost: int
    rarities: list[str]
    min_price: int
    description: str


class UpgradeSectorOut(BaseModel):
    sector: int
    multiplier: float
    ev: float


class MetaOut(BaseModel):
    app_name: str
    zones: list[str]
    rarities: list[dict]
    roll_types: list[RollTypeOut]
    upgrade_sectors: list[UpgradeSectorOut]
    economy: dict
    total_domains: int


class HealthOut(BaseModel):
    status: str
    database: str
    redis: str
