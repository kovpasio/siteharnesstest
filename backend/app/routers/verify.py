from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import Domain, Spin
from app.schemas import DomainOut, ManualVerifyIn, VerifyOut
from app.services.fairness import (
    choose_domain_index,
    resolve_rarity,
    sha256_hex,
)

router = APIRouter(prefix="/verify", tags=["verify"])

FORMULA = (
    "rarityRoll = int(HMAC_SHA256(serverSeed, `${clientSeed}:${nonce}`), 16) % 10000; "
    "domainIndex = int(HMAC_SHA256(serverSeed, `${clientSeed}:${nonce}:domain`), 16) % bucketSize"
)


async def _buckets(db: AsyncSession) -> dict[str, list[Domain]]:
    domains = list((await db.scalars(select(Domain).order_by(Domain.id))).all())
    grouped: dict[str, list[Domain]] = {}
    for domain in domains:
        grouped.setdefault(domain.rarity, []).append(domain)
    return grouped


@router.post("", response_model=VerifyOut)
async def verify_seeds(
    payload: ManualVerifyIn,
    db: AsyncSession = Depends(get_db),
) -> VerifyOut:
    """Recompute a drop from raw seeds (the /verify page's manual form)."""
    buckets = await _buckets(db)
    resolution = resolve_rarity(
        payload.server_seed,
        payload.client_seed,
        payload.nonce,
        payload.pity_counter,
        settings.pity_threshold,
    )
    candidates = buckets.get(resolution.rarity, [])
    if not candidates:
        raise HTTPException(status_code=503, detail="Нет доменов нужной редкости")
    index, domain_roll = choose_domain_index(
        payload.server_seed, payload.client_seed, payload.nonce, len(candidates)
    )
    domain = candidates[index]
    return VerifyOut(
        domain=DomainOut.model_validate(domain),
        rarity=resolution.rarity,
        base_rarity=resolution.base_rarity,
        server_seed=payload.server_seed,
        server_seed_hash=sha256_hex(payload.server_seed),
        hash_valid=True,
        client_seed=payload.client_seed,
        nonce=payload.nonce,
        rarity_roll=resolution.rarity_roll,
        domain_roll=domain_roll,
        domain_index=index,
        bucket_size=len(candidates),
        pity_applied=resolution.pity_applied,
        computed_rarity=resolution.rarity,
        computed_domain=DomainOut.model_validate(domain),
        verified=True,
        formula=FORMULA,
    )


@router.get("/{spin_id}", response_model=VerifyOut)
async def verify_spin(
    spin_id: int,
    db: AsyncSession = Depends(get_db),
) -> VerifyOut:
    spin = await db.scalar(select(Spin).where(Spin.id == spin_id))
    if spin is None:
        raise HTTPException(status_code=404, detail="Спин не найден")

    # Reconstruct the pity state that was active for this spin.  The stored
    # flag is itself part of the audit trail.
    pity_counter = settings.pity_threshold if spin.pity_applied else 0
    resolution = resolve_rarity(
        spin.server_seed,
        spin.client_seed,
        spin.nonce,
        pity_counter,
        settings.pity_threshold,
    )
    buckets = await _buckets(db)
    candidates = buckets.get(resolution.rarity, [])
    # The bucket size is stored with the spin, so verification stays valid
    # even if the catalog is extended later.
    computed_index, _ = choose_domain_index(
        spin.server_seed,
        spin.client_seed,
        spin.nonce,
        spin.bucket_size,
    )
    computed_domain = spin.domain
    domain_matches = spin.domain.rarity == spin.rarity
    if len(candidates) == spin.bucket_size and computed_index < len(candidates):
        computed_domain = candidates[computed_index]
        domain_matches = computed_domain.id == spin.domain_id

    hash_valid = sha256_hex(spin.server_seed) == spin.server_seed_hash
    verified = (
        hash_valid
        and resolution.base_rarity == spin.base_rarity
        and resolution.rarity == spin.rarity
        and resolution.pity_applied == spin.pity_applied
        and computed_index == spin.domain_index
        and domain_matches
    )

    return VerifyOut(
        spin_id=spin.id,
        username=spin.user.username or spin.user.display_name,
        domain=DomainOut.model_validate(spin.domain),
        rarity=spin.rarity,
        base_rarity=spin.base_rarity,
        server_seed=spin.server_seed,
        server_seed_hash=spin.server_seed_hash,
        hash_valid=hash_valid,
        client_seed=spin.client_seed,
        nonce=spin.nonce,
        rarity_roll=spin.rarity_roll,
        domain_roll=spin.domain_roll,
        domain_index=spin.domain_index,
        bucket_size=spin.bucket_size,
        pity_applied=spin.pity_applied,
        computed_rarity=resolution.rarity,
        computed_domain=DomainOut.model_validate(computed_domain),
        verified=verified,
        created_at=spin.created_at,
        formula=FORMULA,
    )
