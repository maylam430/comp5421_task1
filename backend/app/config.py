from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_key: str = ""

    openrouter_api_key: str = ""
    openrouter_model: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_temperature: float = 0.2
    openrouter_max_tokens: int = 2000
    openrouter_site_url: str = "http://localhost:5173"
    openrouter_app_name: str = "Note-taking app"

    cors_origins: str = "http://localhost:5173"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def database_ready(self) -> bool:
        return bool(self.supabase_url and self.supabase_key)

    @property
    def translation_ready(self) -> bool:
        return bool(self.openrouter_api_key and self.openrouter_model)


settings = Settings()
