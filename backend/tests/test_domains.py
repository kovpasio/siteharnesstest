from __future__ import annotations

from pathlib import Path

import pytest

from app.domain_generator import (
    PRICE_RANGES,
    generate_domains,
    load_real_domains,
    load_words,
)
from app.economy import (
    MAX_DOMAIN_COUNT,
    POPULAR_PRICES,
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
    assert rarity_for_price(1_200) == "epic"
    assert rarity_for_price(6_000) == "legendary"
    assert rarity_for_price(35_000) == "mythic"
    assert rarity_for_price(100_000) == "mythic"


def test_weight_applies_rarity_luck():
    assert weight_for(10, "common") > weight_for(1_000_000, "mythic")
    assert weight_for(1_000_000, "mythic") == pytest.approx(5.5 / (1_000_000**0.6), rel=1e-9)
    assert weight_for(100, "rare") > weight_for(100, "common")
    assert weight_for(1, "common") == 2.5


def test_upgrade_sectors_have_negative_ev():
    for sector, multiplier in UPGRADE_SECTORS.items():
        assert sector / 100 * multiplier < 1


def test_real_catalog_uses_new_price_ranges():
    domains = generate_domains(MAX_DOMAIN_COUNT)
    for domain in domains:
        if (domain.name, domain.zone) in POPULAR_PRICES:
            continue
        low, high = PRICE_RANGES[domain.rarity]
        assert low <= domain.price <= high, (
            f"{domain.name}{domain.zone}: {domain.price} outside "
            f"{domain.rarity} {low}..{high}"
        )


def test_all_roulette_costs_and_rarity_pools():
    assert [SPIN_TYPES[key]["cost"] for key in SPIN_TYPES] == [100, 450, 2_000, 10_000]
    assert "mythic" not in SPIN_TYPES
    assert SPIN_TYPES["normal"]["rarities"] == RARITY_ORDER
    assert SPIN_TYPES["epic_plus"]["rarities"] == ("legendary", "mythic")
    for key, roll in SPIN_TYPES.items():
        assert set(roll["rarity_chances"]) == set(roll["rarities"]), key
        assert sum(roll["rarity_chances"].values()) == pytest.approx(100.0), key


def test_real_domain_catalog_has_requested_sizes_and_brands():
    names = load_real_domains()
    assert len(names) == MAX_DOMAIN_COUNT
    assert len(set(names)) == MAX_DOMAIN_COUNT
    assert "google.com" in names
    assert "microsoft.com" in names
    assert all(name.count(".") == 1 for name in names)


def test_each_roulette_has_about_115_percent_rtp():
    domains = generate_domains(MAX_DOMAIN_COUNT)
    averages = {
        rarity: sum(domain.price for domain in domains if domain.rarity == rarity)
        / sum(1 for domain in domains if domain.rarity == rarity)
        for rarity in RARITY_ORDER
    }
    for key, roll in SPIN_TYPES.items():
        expected = sum(
            roll["rarity_chances"][rarity] / 100 * averages[rarity]
            for rarity in roll["rarities"]
        )
        assert 110 <= expected / roll["cost"] * 100 <= 120, key


def test_full_generator_has_100k_unique_domains_and_examples():
    domains = generate_domains(MAX_DOMAIN_COUNT)
    real_names = set(load_real_domains()[:MAX_DOMAIN_COUNT])
    assert len(domains) == MAX_DOMAIN_COUNT
    assert len({(domain.name, domain.zone) for domain in domains}) == MAX_DOMAIN_COUNT
    assert all(f"{domain.name}{domain.zone}" in real_names for domain in domains)
    assert {domain.zone for domain in domains} == {".ru", ".com", ".io", ".xyz"}
    counts = {rarity: 0 for rarity in RARITY_ORDER}
    for domain in domains:
        counts[domain.rarity] += 1
        assert rarity_for_price(domain.price) == domain.rarity
    assert all(count > 0 for count in counts.values())

    common = [domain for domain in domains if domain.rarity == "common"]
    assert sum(domain.price for domain in common) / len(common) > 35
    assert sum(1 for domain in common if domain.price > 80) / len(common) > 0.1
    for (name, zone), price in POPULAR_PRICES.items():
        found = next(
            (domain for domain in domains if domain.name == name and domain.zone == zone),
            None,
        )
        assert found is not None, f"{name}{zone} is missing"
        assert found.price == price
        assert found.rarity == "mythic"

    top = max(domains, key=lambda domain: domain.price)
    assert f"{top.name}{top.zone}" == "cars.com"
    assert top.price == 100_000_000
    google = next(
        domain for domain in domains if domain.name == "google" and domain.zone == ".com"
    )
    assert google.price == 10_000_000
