from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "DROP.ZONE"
    environment: str = "development"
    database_url: str = "postgresql+asyncpg://roulette:roulette@localhost:5432/roulette"
    redis_url: str = "redis://localhost:6379/0"

    jwt_secret: str = "local-dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7  # 7 days

    bot_token: str = ""
    webapp_url: str = "http://localhost:3000"
    dev_mode: bool = True
    cors_origins: str = "http://localhost:3000,http://localhost:5173"

    # Game economy. The API exposes these numbers through /meta.
    start_balance: int = 1000
    spin_cost: int = 50
    daily_bonus: int = 100
    daily_cooldown_hours: int = 24
    pity_threshold: int = 50
    spin_cooldown_seconds: int = 2

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def bot_enabled(self) -> bool:
        token = self.bot_token.strip()
        return bool(token) and ":" in token and "replace" not in token.lower()

    @property
    def is_production(self) -> bool:
        return self.environment.lower() in {"production", "prod"}


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
