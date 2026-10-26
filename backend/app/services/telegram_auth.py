"""Telegram WebApp initData validation (HMAC-SHA256 with the bot token)."""

from __future__ import annotations

import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from typing import Any
from urllib.parse import parse_qsl


class InitDataError(ValueError):
    """Raised when initData is malformed, stale, or has a bad signature."""


@dataclass(frozen=True)
class TelegramUser:
    id: int
    first_name: str
    last_name: str | None
    username: str | None
    photo_url: str | None
    language_code: str | None

    @property
    def display_name(self) -> str:
        return " ".join(part for part in (self.first_name, self.last_name) if part).strip()


def _secret_key(bot_token: str) -> bytes:
    return hmac.new(b"WebAppData", bot_token.encode("utf-8"), hashlib.sha256).digest()


def validate_init_data(
    init_data: str,
    bot_token: str,
    max_age_seconds: int = 86_400,
    now: float | None = None,
) -> dict[str, Any]:
    if not init_data:
        raise InitDataError("empty initData")
    if not bot_token:
        raise InitDataError("bot token is not configured")

    try:
        pairs = parse_qsl(init_data, keep_blank_values=True, strict_parsing=True)
    except ValueError as exc:
        raise InitDataError("malformed initData") from exc

    data: dict[str, str] = dict(pairs)
    received_hash = data.pop("hash", None)
    if not received_hash:
        raise InitDataError("initData hash is missing")

    data_check_string = "\n".join(f"{key}={value}" for key, value in sorted(data.items()))
    expected = hmac.new(
        _secret_key(bot_token),
        data_check_string.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(received_hash, expected):
        raise InitDataError("initData signature is invalid")

    auth_date_raw = data.get("auth_date")
    if not auth_date_raw:
        raise InitDataError("auth_date is missing")
    try:
        auth_date = int(auth_date_raw)
    except ValueError as exc:
        raise InitDataError("auth_date is invalid") from exc

    current_time = time.time() if now is None else now
    if auth_date > current_time + 300:
        raise InitDataError("auth_date is in the future")
    if current_time - auth_date > max_age_seconds:
        raise InitDataError("initData has expired")

    return data


def parse_user(data: dict[str, Any]) -> TelegramUser:
    raw = data.get("user")
    if not raw:
        raise InitDataError("user payload is missing")
    try:
        user = json.loads(raw)
    except (TypeError, json.JSONDecodeError) as exc:
        raise InitDataError("user payload is invalid") from exc
    if not isinstance(user, dict) or "id" not in user:
        raise InitDataError("user id is missing")

    try:
        user_id = int(user["id"])
    except (TypeError, ValueError) as exc:
        raise InitDataError("user id is invalid") from exc
    if user_id <= 0:
        raise InitDataError("user id is invalid")

    first_name = str(user.get("first_name") or "Pilot")[:64]
    last_name = str(user["last_name"])[:64] if user.get("last_name") else None
    username = str(user["username"])[:64] if user.get("username") else None
    photo_url = str(user["photo_url"])[:512] if user.get("photo_url") else None
    language_code = str(user["language_code"])[:16] if user.get("language_code") else None

    return TelegramUser(
        id=user_id,
        first_name=first_name,
        last_name=last_name,
        username=username,
        photo_url=photo_url,
        language_code=language_code,
    )
