"""Single source of truth for rarity odds and the coin economy.

IMPORTANT — the original brief contains a mathematical contradiction:
prices 10 / 50 / 200 / 1000 / 5000 with odds 60 / 25 / 10 / 4.5 / 0.5 %
produce an expected payout of 108.5 coins per 50-coin spin (a +117% edge
for the player).  To keep the explicitly requested "EV < 50, ~30% house
edge" property, prices are scaled to 5 / 20 / 60 / 300 / 1500.  See the
README for the full calculation.
"""

from __future__ import annotations

from typing import Literal, TypedDict

Rarity = Literal["common", "rare", "epic", "legendary", "mythic"]

RARITY_ORDER: tuple[Rarity, ...] = ("common", "rare", "epic", "legendary", "mythic")


class RarityMeta(TypedDict):
    title: str
    weight: int
    price: int
    length: str
    color: str
    glow: str


RARITY_META: dict[Rarity, RarityMeta] = {
    "common": {
        "title": "Common",
        "weight": 6000,
        "price": 5,
        "length": "8+ символов",
        "color": "#8b95a7",
        "glow": "rgba(139,149,167,.55)",
    },
    "rare": {
        "title": "Rare",
        "weight": 2500,
        "price": 20,
        "length": "6–7 символов",
        "color": "#3b82f6",
        "glow": "rgba(59,130,246,.65)",
    },
    "epic": {
        "title": "Epic",
        "weight": 1000,
        "price": 60,
        "length": "5 символов",
        "color": "#a855f7",
        "glow": "rgba(168,85,247,.7)",
    },
    "legendary": {
        "title": "Legendary",
        "weight": 450,
        "price": 300,
        "length": "3–4 символа",
        "color": "#ff8a1f",
        "glow": "rgba(255,138,31,.8)",
    },
    "mythic": {
        "title": "Mythic",
        "weight": 50,
        "price": 1500,
        "length": "2 символа",
        "color": "#ff3d55",
        "glow": "rgba(255,61,85,.85)",
    },
}

TOTAL_WEIGHT = sum(meta["weight"] for meta in RARITY_META.values())  # 10_000
EPIC_PLUS: tuple[Rarity, ...] = ("epic", "legendary", "mythic")
EPIC_PLUS_WEIGHT = sum(RARITY_META[rarity]["weight"] for rarity in EPIC_PLUS)  # 1_500

# Probabilities are kept next to prices so the EV helper can never drift.
RARITY_PROBABILITY: dict[Rarity, float] = {
    rarity: meta["weight"] / TOTAL_WEIGHT for rarity, meta in RARITY_META.items()
}

ZONES: tuple[str, ...] = (".ru", ".com", ".io")


def rarity_from_roll(roll: int) -> Rarity:
    """Map a roll in [0, TOTAL_WEIGHT) to a rarity (cumulative weights)."""
    if not 0 <= roll < TOTAL_WEIGHT:
        raise ValueError(f"roll must be in [0, {TOTAL_WEIGHT})")
    cursor = 0
    for rarity in RARITY_ORDER:
        cursor += RARITY_META[rarity]["weight"]
        if roll < cursor:
            return rarity
    raise AssertionError("unreachable")


def pity_rarity_from_roll(roll: int) -> Rarity:
    """Map a roll in [0, EPIC_PLUS_WEIGHT) to an Epic+ rarity."""
    if not 0 <= roll < EPIC_PLUS_WEIGHT:
        raise ValueError(f"roll must be in [0, {EPIC_PLUS_WEIGHT})")
    cursor = 0
    for rarity in EPIC_PLUS:
        cursor += RARITY_META[rarity]["weight"]
        if roll < cursor:
            return rarity
    raise AssertionError("unreachable")


def expected_value() -> float:
    """Long-run coins returned per spin from selling the dropped domain."""
    return sum(
        RARITY_PROBABILITY[rarity] * RARITY_META[rarity]["price"]
        for rarity in RARITY_ORDER
    )


def house_edge(spin_cost: int) -> float:
    return 1 - expected_value() / spin_cost


def rarity_payload() -> list[dict]:
    return [
        {
            "key": rarity,
            **RARITY_META[rarity],
            "probability": RARITY_PROBABILITY[rarity],
        }
        for rarity in RARITY_ORDER
    ]
