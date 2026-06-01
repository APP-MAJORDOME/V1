from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "MajorDome API"
    app_env: str = "local"
    database_url: str = "postgresql://majordome:majordome@postgres:5432/majordome"
    redis_url: str = "redis://redis:6379/0"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    llm_provider: str = "mock"
    llm_api_key: str = ""
    llm_model: str = "gpt-5.4-mini"
    llm_base_url: str = "https://api.openai.com/v1"
    # OpenAI Realtime API (voix speech-to-speech, ex. Alfred dans l’app)
    llm_realtime_model: str = "gpt-realtime-2"
    llm_realtime_voice: str = "cedar"
    home_adapter_mode: str = "mock"
    jwt_secret_key: str = "change-me-in-prod"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24
    jwt_refresh_expire_minutes: int = 60 * 24 * 30
    google_oauth_client_id: str = ""
    google_oauth_client_secret: str = ""
    google_oauth_redirect_uri: str = "http://localhost:8000/api/v1/integrations/google/oauth/callback"
    google_oauth_scopes: str = "openid email profile https://www.googleapis.com/auth/calendar.readonly"
    frontend_base_url: str = "http://localhost:3000"
    oauth_state_ttl_seconds: int = 600
    rate_limit_requests_per_minute: int = 120
    # Limites plus strictes par IP sur les endpoints d’authentification (anti brute-force).
    rate_limit_auth_login_per_minute: int = 15
    rate_limit_auth_refresh_per_minute: int = 60
    auto_create_tables: bool = True
    upload_dir: str = "./data/uploads"
    attachment_max_mb: int = 12
    attachment_quota_mb_per_household: int = 500

    # Recherche web Alfred (DuckDuckGo, sans clé API)
    web_search_enabled: bool = True
    web_search_max_results: int = 5

    # Base URL publique de l’API (liens SMS / accusé de réception). Ex. https://api.majordom.eu
    public_api_base_url: str = "http://localhost:8000"
    delegation_reminder_hours: int = 24
    delegation_max_reminders: int = 3

    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_from_number: str = ""

    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_prefix="MAJORDOME_")


settings = Settings()
