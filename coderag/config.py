"""
CodeRAG configuration module.
Loads settings from environment variables and provides centralized system parameters.
"""
from pathlib import Path
from typing import Optional, Literal
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # Base workspace paths
    BASE_DIR: Path = Path(__file__).resolve().parent.parent
    DATA_DIR: Path = BASE_DIR / "qdrant_data"
    REPO_CACHE_DIR: Path = BASE_DIR / "repo_cache"
    BM25_INDEX_PATH: Path = BASE_DIR / "bm25_index.pkl"

    # Qdrant configuration
    # Can be ':memory:', a filesystem path like './qdrant_data', or 'http://localhost:6333'
    QDRANT_URL: str = "./qdrant_data"
    QDRANT_API_KEY: Optional[str] = None
    QDRANT_COLLECTION_NAME: str = "coderag_corpus"

    # Embedding settings
    EMBEDDING_MODEL: str = "BAAI/bge-small-en-v1.5"
    EMBEDDING_DIM: int = 384

    # Re-ranking settings
    RERANKER_MODEL: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"
    RERANK_TOP_K: int = 5
    RETRIEVAL_TOP_K: int = 20
    CONFIDENCE_THRESHOLD: float = -4.5  # Min logit score for cross-encoder

    # LLM Settings
    LLM_PROVIDER: Literal["mock", "groq", "openai", "anthropic"] = "groq"
    DEFAULT_MODEL: str = "qwen/qwen3.8-27b"
    GROQ_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    GITHUB_TOKEN: Optional[str] = None

    # Security & API limits
    REINDEX_API_KEY: str = "coderag-secret-reindex-key-1234"
    MAX_QUERY_LENGTH: int = 2000
    RATE_LIMIT_PER_MINUTE: int = 60

    # Observability (Langfuse)
    LANGFUSE_PUBLIC_KEY: Optional[str] = None
    LANGFUSE_SECRET_KEY: Optional[str] = None
    LANGFUSE_HOST: str = "https://cloud.langfuse.com"

    # Default Target Repository
    TARGET_REPO_URL: str = "https://github.com/psf/requests"
    TARGET_REPO_NAME: str = "requests"


settings = Settings()
