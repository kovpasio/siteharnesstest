from __future__ import annotations

from collections.abc import AsyncGenerator

import fakeredis.aioredis
import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.database import get_db
from app.models import Base, Domain, User
from app.routers import auth, domains, inventory, leaderboard, spins, users, verify
from app.seed import seed_domains


@pytest.fixture
async def test_context(monkeypatch):
    engine = create_async_engine(
        "sqlite+aiosqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    async with Session() as session:
        await seed_domains(session)

    async def override_db() -> AsyncGenerator[AsyncSession, None]:
        async with Session() as session:
            yield session

    fake = fakeredis.aioredis.FakeRedis(decode_responses=True)
    monkeypatch.setattr(spins, "redis_client", fake)
    import app.services.realtime as realtime

    monkeypatch.setattr(realtime, "redis_client", fake)

    app = FastAPI()
    for router in (auth.router, users.router, domains.router, spins.router, inventory.router, leaderboard.router, verify.router):
        app.include_router(router, prefix="/api")
    app.dependency_overrides[get_db] = override_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client, Session, app, fake

    await fake.aclose()
    await engine.dispose()


async def _auth(client: AsyncClient) -> tuple[dict, dict]:
    response = await client.post(
        "/api/auth/telegram",
        json={"dev_user": {"id": 900001, "username": "tester", "first_name": "Test"}},
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    headers = {"Authorization": f"Bearer {payload['access_token']}"}
    return payload, headers


async def test_full_game_flow(test_context):
    client, Session, _app, fake = test_context
    payload, headers = await _auth(client)
    assert payload["user"]["balance"] == 1000
    assert payload["user"]["created_at"].endswith(("+00:00", "Z"))

    me = await client.get("/api/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["stats"]["collection_count"] == 0

    domains_response = await client.get("/api/domains", headers=headers)
    assert domains_response.status_code == 200
    assert len(domains_response.json()) == 200

    prepare = await client.post("/api/spin/prepare", headers=headers, json={})
    assert prepare.status_code == 200
    commitment = prepare.json()
    assert len(commitment["server_seed_hash"]) == 64
    assert commitment["nonce"] == 1

    spin = await client.post(
        "/api/spin",
        headers=headers,
        json={"commitment_id": commitment["commitment_id"]},
    )
    assert spin.status_code == 200, spin.text
    spin_data = spin.json()
    assert spin_data["balance"] == 950
    assert spin_data["server_seed_hash"]
    assert spin_data["domain"]["full_name"].endswith((".ru", ".com", ".io"))
    assert spin_data["rarity"] in {"common", "rare", "epic", "legendary", "mythic"}
    assert spin_data["bucket_size"] > 0

    verification = await client.get(f"/api/verify/{spin_data['id']}")
    assert verification.status_code == 200
    assert verification.json()["verified"] is True
    assert verification.json()["hash_valid"] is True
    assert verification.json()["bucket_size"] == spin_data["bucket_size"]

    # Extending the catalog must not invalidate old spins: bucket_size is
    # snapshotted with the drop.
    async with Session() as session:
        session.add(
            Domain(
                name="catalogtest",
                zone=".io",
                rarity=spin_data["rarity"],
                weight=1,
                price=spin_data["price"],
            )
        )
        await session.commit()
    verification_after_catalog_change = await client.get(f"/api/verify/{spin_data['id']}")
    assert verification_after_catalog_change.status_code == 200
    assert verification_after_catalog_change.json()["verified"] is True

    manual = await client.post(
        "/api/verify",
        json={
            "server_seed": spin_data["server_seed"],
            "client_seed": spin_data["client_seed"],
            "nonce": spin_data["nonce"],
            "pity_counter": 0,
        },
    )
    assert manual.status_code == 200
    assert manual.json()["verified"] is True
    assert manual.json()["server_seed_hash"] == spin_data["server_seed_hash"]

    inventory = await client.get("/api/inventory", headers=headers)
    assert inventory.status_code == 200
    items = inventory.json()
    assert len(items) == 1
    item_id = items[0]["id"]
    item_price = items[0]["domain"]["price"]

    leaders = await client.get("/api/leaderboard", headers=headers)
    assert leaders.status_code == 200
    board = leaders.json()
    assert board["entries"][0]["user_id"] == payload["user"]["id"]
    assert board["entries"][0]["score"] == item_price

    # Rate limit: second spin within 2 seconds is rejected before any charge.
    second_prepare = await client.post("/api/spin/prepare", headers=headers, json={})
    assert second_prepare.status_code == 200
    limited = await client.post(
        "/api/spin",
        headers=headers,
        json={"commitment_id": second_prepare.json()["commitment_id"]},
    )
    assert limited.status_code == 429
    assert limited.headers.get("retry-after")

    # Force the pity state and allow a new spin.
    async with Session() as session:
        user = await session.get(User, payload["user"]["id"])
        assert user is not None
        user.pity_counter = 50
        await session.commit()
    await fake.delete(f"dropzone:spin:cooldown:{payload['user']['id']}")
    prepare_after = await client.post("/api/spin/prepare", headers=headers, json={})
    assert prepare_after.status_code == 200
    pity_spin = await client.post(
        "/api/spin",
        headers=headers,
        json={"commitment_id": prepare_after.json()["commitment_id"]},
    )
    assert pity_spin.status_code == 200, pity_spin.text
    pity_data = pity_spin.json()
    assert pity_data["pity_applied"] is True
    assert pity_data["rarity"] in {"epic", "legendary", "mythic"}
    assert pity_data["pity_counter"] == 0
    assert pity_data["balance"] == 900

    sell = await client.post(f"/api/inventory/{item_id}/sell", headers=headers)
    assert sell.status_code == 200, sell.text
    assert sell.json()["balance"] == 900 + item_price
    assert sell.json()["sold_price"] == item_price

    resell = await client.post(f"/api/inventory/{item_id}/sell", headers=headers)
    assert resell.status_code == 409

    daily = await client.post("/api/daily-bonus", headers=headers)
    assert daily.status_code == 200
    assert daily.json()["amount"] == 100
    assert daily.json()["balance"] == 1000 + item_price
    daily_again = await client.post("/api/daily-bonus", headers=headers)
    assert daily_again.status_code == 429

    me_after = await client.get("/api/me", headers=headers)
    assert me_after.status_code == 200
    assert me_after.json()["user"]["balance"] == 1000 + item_price


async def test_auth_rejects_bad_init_data(test_context):
    client, _Session, _app, _fake = test_context
    response = await client.post(
        "/api/auth/telegram",
        json={"init_data": "auth_date=1&hash=deadbeef&user=%7B%7D"},
    )
    # BOT_TOKEN is intentionally empty in tests, so initData auth is unavailable.
    assert response.status_code in {401, 503}
