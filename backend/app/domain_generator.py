"""Deterministic catalog of real registered domain names.

The name list is a static snapshot from the public Majestic Million ranking.
Names are real registered domains; prices and rarity are game values and do
not imply ownership or transfer rights.
"""

from __future__ import annotations

import random
import string
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from app.economy import (
    MAX_DOMAIN_COUNT,
    POPULAR_PRICES,
    PREMIUM_PRICES,
    READABILITY_FACTOR,
    ZONES,
    calculate_price,
    rarity_for_price,
    weight_for,
)

DATA_DIR = Path(__file__).resolve().parent / "data"
REAL_DOMAINS_PATH = DATA_DIR / "real_domains.txt"
SEED = 20261026

TRANSLIT = {
    "а": "a",
    "б": "b",
    "в": "v",
    "г": "g",
    "д": "d",
    "е": "e",
    "ё": "yo",
    "ж": "zh",
    "з": "z",
    "и": "i",
    "й": "y",
    "к": "k",
    "л": "l",
    "м": "m",
    "н": "n",
    "о": "o",
    "п": "p",
    "р": "r",
    "с": "s",
    "т": "t",
    "у": "u",
    "ф": "f",
    "х": "kh",
    "ц": "ts",
    "ч": "ch",
    "ш": "sh",
    "щ": "sch",
    "ъ": "",
    "ы": "y",
    "ь": "",
    "э": "e",
    "ю": "yu",
    "я": "ya",
}


@dataclass(frozen=True)
class GeneratedDomain:
    name: str
    zone: str
    price: int
    rarity: str
    weight: float
    is_available: bool = True


def transliterate(word: str) -> str:
    return "".join(TRANSLIT.get(char, char) for char in word.lower())


@lru_cache
def load_words() -> tuple[tuple[str, ...], tuple[str, ...]]:
    en = tuple(
        line.strip()
        for line in (DATA_DIR / "words_en.txt").read_text(encoding="utf-8").splitlines()
        if line.strip()
    )
    ru = tuple(
        transliterate(line.strip())
        for line in (DATA_DIR / "words_ru.txt").read_text(encoding="utf-8").splitlines()
        if line.strip()
    )
    # Remove transliteration collisions and words that are too long for a
    # comfortable label in the UI.
    en = tuple(dict.fromkeys(word for word in en if 2 <= len(word) <= 14))
    ru = tuple(dict.fromkeys(word for word in ru if 2 <= len(word) <= 14))
    return en, ru


def _bits(rng: random.Random) -> str:
    alphabet = string.ascii_lowercase + string.digits
    return "".join(rng.choice(alphabet) for _ in range(rng.randint(3, 7)))


class DomainGenerator:
    def __init__(self, seed: int = SEED) -> None:
        self.rng = random.Random(seed)
        self.words_en, self.words_ru = load_words()
        self.words = self.words_en + self.words_ru
        self.seen: set[tuple[str, str]] = set()
        self.domains: list[GeneratedDomain] = []

    def _zone(self) -> str:
        # Slightly uneven distribution, but every zone gets a healthy pool.
        return self.rng.choices(
            ZONES,
            weights=(25, 30, 25, 20),
            k=1,
        )[0]

    def _add(
        self,
        name: str,
        readability: str,
        *,
        zone: str | None = None,
        explicit_price: int | None = None,
    ) -> bool:
        if not name or len(name) > 63:
            return False
        zone = zone or self._zone()
        key = (name, zone)
        if key in self.seen:
            return False
        if explicit_price is None:
            jitter = self.rng.uniform(0.7, 1.3)
            price = calculate_price(name, zone, readability, jitter)
        else:
            price = explicit_price
        self.seen.add(key)
        rarity = rarity_for_price(price)
        if rarity == "common" and explicit_price is None:
            # Keep the Common bucket, but spread prices across 1..99 instead
            # of piling almost every drop into the 1-coin end.
            price = random.Random(f"{SEED}:{name}{zone}:common-price").randint(1, 99)
        self.domains.append(
            GeneratedDomain(
                name=name,
                zone=zone,
                price=price,
                rarity=rarity,
                weight=round(weight_for(price, rarity), 8),
            )
        )
        return True

    def _add_premium(self) -> None:
        for (name, zone), price in PREMIUM_PRICES.items():
            self._add(name, "dictionary", zone=zone, explicit_price=price)

    def _add_dictionary_words(self) -> None:
        # Exact dictionary words are the premium short-name segment.
        for word in self.words:
            self._add(word, "dictionary")

    def _add_compounds(self, count: int) -> None:
        # Short words make the nicest compounds and provide many price bands.
        short = [word for word in self.words if 2 <= len(word) <= 7]
        long = [word for word in self.words if 3 <= len(word) <= 9]
        for _ in range(count):
            if self.rng.random() < 0.55:
                name = self.rng.choice(short) + self.rng.choice(long)
            elif self.rng.random() < 0.5:
                name = self.rng.choice(short) + self.rng.choice(short)
            else:
                word = self.rng.choice(short)
                digits = str(self.rng.randint(1, 99))
                name = word + digits
            self._add(name, "readable")

    def _add_random(self, count: int) -> None:
        alphabet = string.ascii_lowercase
        for _ in range(count):
            length = self.rng.randint(5, 11)
            name = "".join(self.rng.choice(alphabet) for _ in range(length))
            self._add(name, "garbage")

    def _add_hyphen_digits(self, count: int) -> None:
        short = [word for word in self.words if 2 <= len(word) <= 5]
        for _ in range(count):
            if self.rng.random() < 0.55:
                prefix = self.rng.choice(short)
            else:
                prefix = "".join(
                    self.rng.choice(string.ascii_lowercase)
                    for _ in range(self.rng.randint(2, 4))
                )
            name = f"{prefix}-{_bits(self.rng)}"
            self._add(name, "garbage")

    def _add_patterns(self, count: int) -> None:
        alphabet = string.ascii_lowercase
        for _ in range(count):
            if self.rng.random() < 0.6:
                # Palindrome, 3-9 characters.
                half = "".join(
                    self.rng.choice(alphabet)
                    for _ in range(self.rng.randint(1, 4))
                )
                name = half + self.rng.choice(alphabet) + half[::-1]
            else:
                name = self.rng.choice(alphabet) * self.rng.randint(3, 8)
            self._add(name, "garbage")

    def generate(self, target: int = MAX_DOMAIN_COUNT) -> list[GeneratedDomain]:
        target = max(target, 1)
        self._add_premium()
        self._add_dictionary_words()
        self._add_compounds(max(0, target // 2 - len(self.domains)))
        self._add_random(max(0, target // 5))
        self._add_hyphen_digits(max(0, target // 10))
        self._add_patterns(max(0, target // 40))

        # Fill any remaining gap with combinations and then random names.
        while len(self.domains) < target:
            if self.rng.random() < 0.75:
                self._add_compounds(max(200, target - len(self.domains)))
            else:
                self._add_random(250)

        return self.domains[:target]


@lru_cache(maxsize=1)
def load_real_domains() -> tuple[str, ...]:
    if not REAL_DOMAINS_PATH.exists():
        raise RuntimeError(f"Real domain list is missing: {REAL_DOMAINS_PATH}")
    names = tuple(
        line.strip().lower()
        for line in REAL_DOMAINS_PATH.read_text(encoding="utf-8").splitlines()
        if line.strip()
    )
    if len(names) < MAX_DOMAIN_COUNT:
        raise RuntimeError(
            f"Real domain list has {len(names)} names, expected {MAX_DOMAIN_COUNT}"
        )
    return names


def _split_zone(domain: str) -> tuple[str, str]:
    for zone in ZONES:
        if domain.endswith(zone) and len(domain) > len(zone):
            name = domain[: -len(zone)]
            if "." not in name:
                return name, zone
    raise ValueError(f"unsupported real domain: {domain}")


PRICE_RANGES: dict[str, tuple[int, int]] = {
    "common": (40, 90),
    "rare": (250, 900),
    "epic": (1_200, 4_500),
    "legendary": (6_000, 25_000),
    "mythic": (35_000, 150_000),
}


def _game_price(full_name: str, rarity: str) -> int:
    low, high = PRICE_RANGES[rarity]
    rng = random.Random(f"{SEED}:{full_name}:game-price:{rarity}")
    power = {"rare": 1.6, "epic": 2.2, "legendary": 2.8}.get(rarity, 1.0)
    return low + int((high - low) * (rng.random() ** power))


@lru_cache(maxsize=1)
def _economy_slots() -> tuple[GeneratedDomain, ...]:
    """Reuse the tuned game economy while replacing all names with real ones.

    The old generator still supplies the price/rarity ladder: Common 1..99,
    Rare 100..999 and so on. Real names are shuffled independently and mapped
    onto those slots. This keeps the roulette economy roughly unchanged.
    """
    return tuple(DomainGenerator(seed=SEED + 1).generate(MAX_DOMAIN_COUNT))


def generate_domains(target: int = MAX_DOMAIN_COUNT) -> list[GeneratedDomain]:
    """Build the catalog from real registered names and tuned price slots."""
    target = max(target, 1)
    names = list(load_real_domains()[:target])
    random.Random(SEED + 2).shuffle(names)
    slots = sorted(_economy_slots()[:target], key=lambda item: item.price)
    domains: list[GeneratedDomain] = []
    for full_name, slot in zip(names, slots):
        try:
            name, zone = _split_zone(full_name)
        except ValueError:
            continue
        explicit = POPULAR_PRICES.get((name, zone)) or PREMIUM_PRICES.get((name, zone))
        price = (
            explicit
            if explicit is not None
            else _game_price(full_name, slot.rarity)
        )
        rarity = rarity_for_price(price)
        domains.append(
            GeneratedDomain(
                name=name,
                zone=zone,
                price=price,
                rarity=rarity,
                weight=round(weight_for(price, rarity), 8),
            )
        )
        if len(domains) >= target:
            break
    if len(domains) < target:
        raise RuntimeError(
            f"Only {len(domains)} real domains could be parsed, expected {target}"
        )
    return domains


def read_word_counts() -> tuple[int, int]:
    en, ru = load_words()
    return len(en), len(ru)


def readability_keys() -> tuple[str, ...]:
    return tuple(READABILITY_FACTOR)
