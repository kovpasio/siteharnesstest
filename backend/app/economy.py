"""Domain pricing, rarity buckets and roulette configuration."""

from __future__ import annotations

import math
from typing import Literal, TypedDict

Rarity = Literal["common", "rare", "epic", "legendary", "mythic"]
Zone = Literal[".ru", ".com", ".io", ".xyz"]

RARITY_ORDER: tuple[Rarity, ...] = ("common", "rare", "epic", "legendary", "mythic")
ZONES: tuple[Zone, ...] = (".ru", ".com", ".io", ".xyz")

ZONE_FACTOR: dict[Zone, float] = {
    ".com": 100.0,
    ".io": 30.0,
    ".ru": 5.0,
    ".xyz": 0.3,
}

LENGTH_FACTOR: dict[int, float] = {
    2: 5000.0,
    3: 1000.0,
    4: 300.0,
    5: 100.0,
    6: 30.0,
}

READABILITY_FACTOR: dict[str, float] = {
    "dictionary": 50.0,
    "readable": 5.0,
    "garbage": 0.1,
}

PATTERN_FACTOR: dict[str, float] = {
    "palindrome": 20.0,
    "all_same": 15.0,
    "hyphen_digits": 0.05,
    "none": 1.0,
}

RARITY_META: dict[Rarity, dict] = {
    "common": {"title": "Common", "min_price": 1, "max_price": 99, "color": "#8A8F98"},
    "rare": {"title": "Rare", "min_price": 100, "max_price": 999, "color": "#5B8FB9"},
    "epic": {"title": "Epic", "min_price": 1_000, "max_price": 9_999, "color": "#8E6BB5"},
    "legendary": {
        "title": "Legendary",
        "min_price": 10_000,
        "max_price": 99_999,
        "color": "#C9884A",
    },
    "mythic": {"title": "Mythic", "min_price": 100_000, "max_price": None, "color": "#B5545B"},
}


class SpinType(TypedDict):
    key: str
    title: str
    short_title: str
    cost: int
    rarities: tuple[Rarity, ...]
    min_price: int
    description: str


SPIN_TYPES: dict[str, SpinType] = {
    "normal": {
        "key": "normal",
        "title": "Обычная",
        "short_title": "Все",
        "cost": 50,
        "rarities": RARITY_ORDER,
        "min_price": 1,
        "description": "Все редкости · 50 монет",
    },
    "uncommon_plus": {
        "key": "uncommon_plus",
        "title": "Необычная+",
        "short_title": "Rare+",
        "cost": 200,
        "rarities": ("rare", "epic", "legendary", "mythic"),
        "min_price": 100,
        "description": "Rare и выше · 200 монет",
    },
    "rare_plus": {
        "key": "rare_plus",
        "title": "Редкая+",
        "short_title": "Epic+",
        "cost": 800,
        "rarities": ("epic", "legendary", "mythic"),
        "min_price": 1_000,
        "description": "Epic и выше · 800 монет",
    },
    "epic_plus": {
        "key": "epic_plus",
        "title": "Эпическая+",
        "short_title": "Legendary+",
        "cost": 3_000,
        "rarities": ("legendary", "mythic"),
        "min_price": 10_000,
        "description": "Legendary и Mythic · 3 000 монет",
    },
    "mythic": {
        "key": "mythic",
        "title": "Мифическая",
        "short_title": "Mythic",
        "cost": 20_000,
        "rarities": ("mythic",),
        "min_price": 100_000,
        "description": "Только Mythic · 20 000 монет",
    },
}

# Upgrade sectors: sector -> multiplier. The exact chance is generated
# uniformly inside [sector, sector + 0.99].
UPGRADE_SECTORS: dict[int, float] = {
    10: 9.0,
    25: 3.75,
    50: 1.9,
    75: 1.2,
}

# The market price is the collection valuation.  Instant sale to the house
# pays a rarity-dependent buyout.  This is what keeps every roulette's EV
# below its ticket price while preserving the individual domain prices.
LIQUIDATION_RATES: dict[Rarity, float] = {
    "common": 1.0,
    "rare": 0.25,
    "epic": 0.04,
    "legendary": 0.005,
    "mythic": 0.001,
}

MAX_DOMAIN_COUNT = 100_500
PREMIUM_PRICES: dict[tuple[str, str], int] = {
    ("microsoft", ".com"): 1_000_000,
    ("google", ".com"): 1_100_000,
    ("neo", ".com"): 250_000,
    ("ai", ".io"): 80_000,
    ("vector", ".ru"): 5_000,
    ("pixelhub", ".io"): 1_200,
    ("lg-shd9uga", ".xyz"): 10,
}


def length_factor(length: int) -> float:
    if length <= 2:
        return LENGTH_FACTOR[2]
    return LENGTH_FACTOR.get(length, 1.0)


def detect_pattern(name: str) -> str:
    if "-" in name and any(char.isdigit() for char in name):
        return "hyphen_digits"
    if len(name) > 2 and name == name[::-1]:
        return "palindrome"
    if len(name) > 1 and len(set(name)) == 1:
        return "all_same"
    return "none"


def calculate_price(name: str, zone: str, readability: str, jitter: float) -> int:
    """Apply the requested pricing formula and return whole coins."""
    if readability not in READABILITY_FACTOR:
        raise ValueError(f"unknown readability: {readability}")
    if zone not in ZONE_FACTOR:
        raise ValueError(f"unknown zone: {zone}")
    if not 0.7 <= jitter <= 1.3:
        raise ValueError("jitter must be in [0.7, 1.3]")

    pattern = detect_pattern(name)
    raw = (
        ZONE_FACTOR[zone]  # type: ignore[index]
        * length_factor(len(name))
        * READABILITY_FACTOR[readability]
        * PATTERN_FACTOR[pattern]
        * jitter
    )
    return max(1, int(round(raw)))


def weight_for_price(price: int) -> float:
    """Higher prices are rarer, but only logarithmically so."""
    return 1.0 / math.log10(max(1, price) + 10)


def rarity_for_price(price: int) -> Rarity:
    if price < 100:
        return "common"
    if price < 1_000:
        return "rare"
    if price < 10_000:
        return "epic"
    if price < 100_000:
        return "legendary"
    return "mythic"


def sell_value(price: int, rarity: Rarity) -> int:
    """Instant market buyout: a discounted, rarity-dependent coin payout."""
    return max(1, int(round(price * LIQUIDATION_RATES[rarity])))


def spin_types_payload() -> list[dict]:
    return [
        {
            "key": key,
            "title": value["title"],
            "short_title": value["short_title"],
            "cost": value["cost"],
            "rarities": list(value["rarities"]),
            "min_price": value["min_price"],
            "description": value["description"],
        }
        for key, value in SPIN_TYPES.items()
    ]


def liquidation_rates_payload() -> dict[str, float]:
    return dict(LIQUIDATION_RATES)


def upgrade_sectors_payload() -> list[dict]:
    return [
        {"sector": sector, "multiplier": multiplier, "ev": sector / 100 * multiplier}
        for sector, multiplier in UPGRADE_SECTORS.items()
    ]


def rarity_payload() -> list[dict]:
    return [
        {
            "key": rarity,
            **RARITY_META[rarity],
        }
        for rarity in RARITY_ORDER
    ]
