from functools import lru_cache
from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="NOVA_", extra="ignore")

    app_name: str = "NOVA"
    language: str = "es"
    locale: str = "es-419"
    audience: str = "niños"

    whisper_model: str = "small"
    whisper_device: str = "cpu"
    whisper_compute_type: str = "int8"

    openai_base_url: str = "http://192.168.68.67:1234/v1"
    openai_api_key: str = ""
    llm_model: str = "google/gemma-4-26b-a4b"
    llm_max_tokens: int = Field(default=512, ge=32)
    llm_reasoning_effort: str = "none"

    kokoro_lang_code: str = "e"
    kokoro_voice: str = "ef_dora"
    sample_rate: int = Field(default=24000, ge=8000)
    hf_home: str = str(Path(__file__).resolve().parents[1] / "models" / "huggingface")
    memory_path: str = str(Path(__file__).resolve().parents[1] / "data" / "memory.json")
    recent_memory_limit: int = Field(default=8, ge=0)
    conversation_turn_limit: int = Field(default=10, ge=0)


@lru_cache
def get_settings() -> Settings:
    return Settings()
