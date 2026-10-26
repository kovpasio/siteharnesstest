from __future__ import annotations

import hashlib
import hmac
import json
import time
from urllib.parse import urlencode

import pytest

from app.economy import (
    EPIC_PLUS,
    RARITY_META,
    RARITY_ORDER,
    TOTAL_WEIGHT,
    expected_value,
    house_edge,
    rarity_from_roll,
)
from app.seed_data import SEED_GROUPS, ZONES
from app.services.fairness import (
    calculate,
    choose_domain_index,
    next_pity_counter,
    resolve_rarity,
    sha256_hex,
    verify_commitment,
)
from app.services.telegram_auth import InitDataError, parse_user, validate_init_data


def test_seed_catalog_has_200_domains_with_contract_lengths():
    total = 0
    for rarity, names in SEED_GROUPS:
        total += len(names)
        for name in names:
            if rarity == "common":
                assert len(name) >= 8, name
            elif rarity == "rare":
                assert 6 <= len(name) <= 7, name
            elif rarity == "epic":
                assert len(name) == 5, name
            elif rarity == "legendary":
                assert 3 <= len(name) <= 4, name
            elif rarity == "mythic":
                assert len(name) == 2, name
    assert total == 200
    assert len({name for _, names in SEED_GROUPS for name in names}) == 200
    assert set(ZONES) == {".ru", ".com", ".io"}


def test_economy_has_negative_house_edge_target():
    ev = expected_value()
    assert ev == pytest.approx(35.0)
    assert ev < 50
    assert house_edge(50) == pytest.approx(0.30)


def test_rarity_boundaries():
    assert rarity_from_roll(0) == "common"
    assert rarity_from_roll(5999) == "common"
    assert rarity_from_roll(6000) == "rare"
    assert rarity_from_roll(8499) == "rare"
    assert rarity_from_roll(8500) == "epic"
    assert rarity_from_roll(9499) == "epic"
    assert rarity_from_roll(9500) == "legendary"
    assert rarity_from_roll(9949) == "legendary"
    assert rarity_from_roll(9950) == "mythic"
    assert rarity_from_roll(9999) == "mythic"
    assert sum(meta["weight"] for meta in RARITY_META.values()) == TOTAL_WEIGHT


def test_roll_distribution_is_close_to_declared_probabilities():
    counts = {rarity: 0 for rarity in RARITY_ORDER}
    sample = 30_000
    for index in range(sample):
        outcome = resolve_rarity(f"seed-{index}", "client", 1, 0)
        counts[outcome.rarity] += 1
    expected = {
        "common": 0.60,
        "rare": 0.25,
        "epic": 0.10,
        "legendary": 0.045,
        "mythic": 0.005,
    }
    for rarity, probability in expected.items():
        assert counts[rarity] / sample == pytest.approx(probability, abs=0.012)


def test_hmac_formula_is_deterministic_and_matches_manual_calculation():
    server_seed = "a" * 64
    client_seed = "player"
    nonce = 7
    outcome = resolve_rarity(server_seed, client_seed, nonce, 0)
    digest = hmac.new(
        server_seed.encode(),
        f"{client_seed}:{nonce}".encode(),
        hashlib.sha256,
    ).hexdigest()
    assert outcome.rarity_roll == int(digest, 16) % TOTAL_WEIGHT
    assert outcome.base_rarity == rarity_from_roll(outcome.rarity_roll)

    domain_index, _ = choose_domain_index(server_seed, client_seed, nonce, 7)
    domain_digest = hmac.new(
        server_seed.encode(),
        f"{client_seed}:{nonce}:domain".encode(),
        hashlib.sha256,
    ).hexdigest()
    assert domain_index == int(domain_digest, 16) % 7


def test_pity_guarantee_and_counter():
    outcome = calculate("seed", "client", 1, pity_counter=50, domain_count=20)
    assert outcome.pity_applied is True
    assert outcome.rarity in EPIC_PLUS
    assert next_pity_counter(49, "common", 50) == 50
    assert next_pity_counter(50, "epic", 50) == 0
    assert next_pity_counter(0, "legendary", 50) == 0


def test_commitment_verification():
    seed = "deadbeef" * 8
    commitment = sha256_hex(seed)
    assert verify_commitment(seed, commitment)
    assert not verify_commitment(seed + "x", commitment)


def _signed_init_data(token: str, user: dict, auth_date: int | None = None) -> str:
    data = {
        "query_id": "AAH-test",
        "user": json.dumps(user, separators=(",", ":")),
        "auth_date": str(auth_date or int(time.time())),
    }
    check_string = "\n".join(f"{key}={value}" for key, value in sorted(data.items()))
    secret = hmac.new(b"WebAppData", token.encode(), hashlib.sha256).digest()
    signature = hmac.new(secret, check_string.encode(), hashlib.sha256).hexdigest()
    return f"{urlencode(data)}&hash={signature}"


def test_telegram_init_data_validation_and_tamper_detection():
    token = "123456:TEST_TOKEN"
    user = {"id": 42, "first_name": "Alice", "username": "alice"}
    init_data = _signed_init_data(token, user)
    payload = validate_init_data(init_data, token)
    parsed = parse_user(payload)
    assert parsed.id == 42
    assert parsed.username == "alice"

    with pytest.raises(InitDataError):
        validate_init_data(init_data.replace("hash=", "hash=0"), token)


def test_expired_init_data_is_rejected():
    token = "123456:TEST_TOKEN"
    init_data = _signed_init_data(token, {"id": 1, "first_name": "A"}, auth_date=int(time.time()) - 90_000)
    with pytest.raises(InitDataError, match="expired"):
        validate_init_data(init_data, token)
