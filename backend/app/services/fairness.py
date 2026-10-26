"""Provably-fair, pure spin mathematics.

The server commits to a random ``server_seed`` by publishing its SHA-256
before the spin.  The roll is derived only from the revealed seed:

    digest     = HMAC_SHA256(server_seed, f"{client_seed}:{nonce}")
    rarityRoll = int(digest, 16) mod 10_000

A second HMAC with the ``:domain`` suffix chooses a domain inside the
selected rarity bucket without biasing the rarity distribution.
"""

from __future__ import annotations

import hashlib
import hmac
from dataclasses import dataclass

from app.economy import (
    EPIC_PLUS,
    EPIC_PLUS_WEIGHT,
    Rarity,
    RARITY_META,
    TOTAL_WEIGHT,
    pity_rarity_from_roll,
    rarity_from_roll,
)


@dataclass(frozen=True)
class RarityResolution:
    rarity_roll: int
    base_rarity: Rarity
    rarity: Rarity
    pity_applied: bool


@dataclass(frozen=True)
class FairnessResult(RarityResolution):
    domain_roll: int
    domain_index: int

    def as_dict(self) -> dict:
        return {
            "rarity_roll": self.rarity_roll,
            "base_rarity": self.base_rarity,
            "rarity": self.rarity,
            "pity_applied": self.pity_applied,
            "domain_roll": self.domain_roll,
            "domain_index": self.domain_index,
        }


def sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def hmac_sha256_hex(server_seed: str, message: str) -> str:
    return hmac.new(
        server_seed.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def generate_server_seed() -> str:
    import secrets

    return secrets.token_hex(32)


def generate_client_seed() -> str:
    import secrets

    return secrets.token_hex(8)


def sanitize_client_seed(value: str | None) -> str:
    if value is None or not value.strip():
        return generate_client_seed()
    cleaned = value.strip()[:64]
    return cleaned


def resolve_rarity(
    server_seed: str,
    client_seed: str,
    nonce: int,
    pity_counter: int,
    pity_threshold: int = 50,
) -> RarityResolution:
    if nonce < 1:
        raise ValueError("nonce must be >= 1")
    if not server_seed:
        raise ValueError("server_seed must not be empty")
    if not client_seed:
        raise ValueError("client_seed must not be empty")

    rarity_digest = hmac_sha256_hex(server_seed, f"{client_seed}:{nonce}")
    rarity_roll = int(rarity_digest, 16) % TOTAL_WEIGHT
    base_rarity = rarity_from_roll(rarity_roll)

    pity_applied = pity_counter >= pity_threshold
    if pity_applied:
        pity_digest = hmac_sha256_hex(server_seed, f"{client_seed}:{nonce}:pity")
        pity_roll = int(pity_digest, 16) % EPIC_PLUS_WEIGHT
        rarity = pity_rarity_from_roll(pity_roll)
    else:
        rarity = base_rarity

    return RarityResolution(
        rarity_roll=rarity_roll,
        base_rarity=base_rarity,
        rarity=rarity,
        pity_applied=pity_applied,
    )


def choose_domain_index(
    server_seed: str,
    client_seed: str,
    nonce: int,
    domain_count: int,
) -> tuple[int, int]:
    """Return (domain_index, display_roll) for the bucket size."""
    if domain_count < 1:
        raise ValueError("domain_count must be >= 1")
    domain_digest = hmac_sha256_hex(server_seed, f"{client_seed}:{nonce}:domain")
    domain_number = int(domain_digest, 16)
    return domain_number % domain_count, domain_number % TOTAL_WEIGHT


def calculate(
    server_seed: str,
    client_seed: str,
    nonce: int,
    pity_counter: int,
    domain_count: int,
    pity_threshold: int = 50,
) -> FairnessResult:
    """Calculate the full outcome.  ``domain_count`` is the number of domains
    in the bucket that will actually be used (after a possible pity upgrade).
    """
    resolution = resolve_rarity(
        server_seed, client_seed, nonce, pity_counter, pity_threshold
    )
    domain_index, domain_roll = choose_domain_index(
        server_seed, client_seed, nonce, domain_count
    )
    return FairnessResult(
        rarity_roll=resolution.rarity_roll,
        base_rarity=resolution.base_rarity,
        rarity=resolution.rarity,
        pity_applied=resolution.pity_applied,
        domain_roll=domain_roll,
        domain_index=domain_index,
    )


def next_pity_counter(current: int, actual_rarity: Rarity, threshold: int = 50) -> int:
    """Reset on Epic+; otherwise count toward the guarantee (cap at threshold)."""
    if actual_rarity in EPIC_PLUS:
        return 0
    return min(current + 1, threshold)


def verify_commitment(server_seed: str, server_seed_hash: str) -> bool:
    return hmac.compare_digest(sha256_hex(server_seed), server_seed_hash)


def domain_price(rarity: Rarity) -> int:
    return RARITY_META[rarity]["price"]
