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
    "common": {"title": "Common", "min_price": 1, "max_price": 99, "color": "#8C98A8"},
    "rare": {"title": "Rare", "min_price": 100, "max_price": 999, "color": "#4D9BFF"},
    "epic": {"title": "Epic", "min_price": 1_000, "max_price": 9_999, "color": "#A879F0"},
    "legendary": {
        "title": "Legendary",
        "min_price": 10_000,
        "max_price": 99_999,
        "color": "#F0A64B",
    },
    "mythic": {"title": "Mythic", "min_price": 100_000, "max_price": None, "color": "#F05D6E"},
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
        "cost": 100,
        "rarities": RARITY_ORDER,
        "min_price": 1,
        "description": "Все редкости · 100 монет",
    },
    "uncommon_plus": {
        "key": "uncommon_plus",
        "title": "Редкая+",
        "short_title": "Rare+",
        "cost": 1_700,
        "rarities": ("rare", "epic", "legendary", "mythic"),
        "min_price": 100,
        "description": "Rare и выше · 1 700 монет",
    },
    "rare_plus": {
        "key": "rare_plus",
        "title": "Эпическая+",
        "short_title": "Epic+",
        "cost": 18_500,
        "rarities": ("epic", "legendary", "mythic"),
        "min_price": 1_000,
        "description": "Epic и выше · 18 500 монет",
    },
    "epic_plus": {
        "key": "epic_plus",
        "title": "Легендарная+",
        "short_title": "Legendary+",
        "cost": 85_000,
        "rarities": ("legendary", "mythic"),
        "min_price": 10_000,
        "description": "Legendary и Mythic · 85 000 монет",
    },
}

# Rarity luck multipliers are tuned to make Rare+ noticeably more common
# while keeping the expected payout of every ticket below its price.
RARITY_WEIGHT_LUCK: dict[Rarity, float] = {
    "common": 2.5,
    "rare": 3.2,
    "epic": 7.0,
    "legendary": 6.5,
    "mythic": 5.5,
}

# Upgrade sectors: sector -> multiplier. The exact chance is generated
# uniformly inside [sector, sector + 0.99].
UPGRADE_SECTORS: dict[int, float] = {
    10: 9.0,
    25: 3.75,
    50: 1.9,
    75: 1.2,
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


def weight_for(price: int, rarity: Rarity) -> float:
    """Price curve combined with a rarity luck multiplier.

    Expensive names stay rare inside their rarity, while Rare and above get
    a visible luck boost. The values are tuned together with spin costs so
    that every ticket still has EV below its price.
    """
    luck = RARITY_WEIGHT_LUCK[rarity]
    return luck / math.pow(max(1, price), 0.6)


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
