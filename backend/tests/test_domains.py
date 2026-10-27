from __future__ import annotations

from pathlib import Path

import pytest

from app.domain_generator import generate_domains, load_words
from app.economy import (
    MAX_DOMAIN_COUNT,
    PREMIUM_PRICES,
    RARITY_ORDER,
    SPIN_TYPES,
    UPGRADE_SECTORS,
    calculate_price,
    length_factor,
    rarity_for_price,
    weight_for,
)


def test_word_files_have_requested_sizes():
    data = Path(__file__).resolve().parent.parent / "app" / "data"
    assert len((data / "words_en.txt").read_text(encoding="utf-8").splitlines()) == 5000
    assert len((data / "words_ru.txt").read_text(encoding="utf-8").splitlines()) == 2000


def test_load_words_is_usable():
    en, ru = load_words()
    assert len(en) > 4900
    assert len(ru) > 1900
    assert "shop" in en
    assert all(word.isascii() and word.islower() for word in en + ru)


def test_price_formula_and_rarity_thresholds():
    assert calculate_price("ab", ".com", "dictionary", 1.0) == 100 * 5000 * 50
    assert calculate_price("cat", ".com", "dictionary", 1.0) == 100 * 1000 * 50
    assert calculate_price("vector", ".ru", "dictionary", 1.0) == 5 * 30 * 50
    assert calculate_price("qwrt", ".xyz", "garbage", 1.0) == 9
    assert length_factor(2) == 5000
    assert length_factor(7) == 1
    assert rarity_for_price(99) == "common"
    assert rarity_for_price(100) == "rare"
    assert rarity_for_price(999) == "rare"
    assert rarity_for_price(1000) == "epic"
    assert rarity_for_price(10000) == "legendary"
    assert rarity_for_price(100000) == "mythic"


def test_weight_applies_rarity_luck():
    assert weight_for(10, "common") > weight_for(1_000_000, "mythic")
    assert weight_for(1_000_000, "mythic") == pytest.approx(5.5 / (1_000_000**0.6), rel=1e-9)
    assert weight_for(100, "rare") > weight_for(100, "common") * 3
    assert weight_for(1, "common") == 1.0


def test_upgrade_sectors_have_negative_ev():
    for sector, multiplier in UPGRADE_SECTORS.items():
        assert sector / 100 * multiplier < 1


def test_all_roulette_costs_and_rarity_pools():
    assert [SPIN_TYPES[key]["cost"] for key in SPIN_TYPES] == [100, 1_700, 18_500, 85_000]
    assert "mythic" not in SPIN_TYPES
    assert SPIN_TYPES["normal"]["rarities"] == RARITY_ORDER
    assert SPIN_TYPES["epic_plus"]["rarities"] == ("legendary", "mythic")


def test_full_generator_has_100k_unique_domains_and_examples():
    domains = generate_domains(MAX_DOMAIN_COUNT)
    assert len(domains) == MAX_DOMAIN_COUNT
    assert len({(domain.name, domain.zone) for domain in domains}) == MAX_DOMAIN_COUNT
    assert {domain.zone for domain in domains} == {".ru", ".com", ".io", ".xyz"}
    counts = {rarity: 0 for rarity in RARITY_ORDER}
    for domain in domains:
        counts[domain.rarity] += 1
        assert rarity_for_price(domain.price) == domain.rarity
    assert all(count > 0 for count in counts.values())
    for (name, zone), price in PREMIUM_PRICES.items():
        found = next(
            (domain for domain in domains if domain.name == name and domain.zone == zone),
            None,
        )
        assert found is not None, f"{name}{zone} is missing"
        assert found.price == price
        assert found.rarity == rarity_for_price(price)


def test_premium_roulettes_have_negative_expected_value():
    domains = generate_domains(MAX_DOMAIN_COUNT)
    for key in ("uncommon_plus", "rare_plus", "epic_plus"):
        roll = SPIN_TYPES[key]
        pool = [domain for domain in domains if domain.rarity in roll["rarities"]]
        total_weight = sum(domain.weight for domain in pool)
        expected = (
            sum(domain.price * domain.weight for domain in pool) / total_weight
        )
        assert expected < roll["cost"], (
            f"{key}: EV={expected:.2f} >= cost={roll['cost']}"
        )

    total_weight = sum(domain.weight for domain in domains)
    normal_ev = sum(domain.price * domain.weight for domain in domains) / total_weight
    assert SPIN_TYPES["normal"]["cost"] == 100
    assert normal_ev > 100
