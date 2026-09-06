"""
FastAPI Request and Response schemas for CodeRAG API.
"""
from typing import List, Dict, Any, Optional, Literal
from pydantic import BaseModel, Field


class QueryRequest(BaseModel):
    query: str = Field(..., max_length=2000, description="Natural language engineering question")
    model: Optional[str] = Field(None, description="LLM model identifier")
    provider: Optional[Literal["mock", "groq", "openai", "anthropic"]] = Field(None, description="LLM provider")
    filter_type: Optional[Literal["code", "doc", "issue", "mixed"]] = Field(None, description="Optional manual override for retrieval type")
    top_k: Optional[int] = Field(5, ge=1, le=20, description="Number of final context chunks to use")
    api_key: Optional[str] = Field(None, description="Optional dynamic user-supplied API key")


class RetrieveRequest(BaseModel):
    query: str = Field(..., max_length=2000)
    filter_type: Optional[Literal["code", "doc", "issue", "mixed"]] = None
    limit: Optional[int] = Field(20, ge=1, le=50)


class SourceChunk(BaseModel):
    file_path: str
    start_line: int
    end_line: int
    type: str
    symbol_name: Optional[str] = None
    heading_path: Optional[str] = None
    text: str
    rerank_score: Optional[float] = None
    rrf_score: Optional[float] = None
    url: Optional[str] = None


class TraceInfo(BaseModel):
    intent: str
    router_reason: str
    scores: Dict[str, Any]
    retrieved_count: int
    reranked_count: int
    guardrail_passed: bool
    guardrail_reason: str
    latency_ms: float
    model: str
    provider: str


class QueryResponse(BaseModel):
    answer: str
    sources: List[SourceChunk]
    trace: TraceInfo


class ReindexRequest(BaseModel):
    repo_url: Optional[str] = None
    repo_name: Optional[str] = None


class ReindexResponse(BaseModel):
    status: str
    repo_name: str
    commit_sha: str
    chunks_ingested: Dict[str, int]
    elapsed_seconds: float


class HealthResponse(BaseModel):
    status: str
    qdrant_status: str
    indexed_points: int
    bm25_indexed_chunks: int
    repo_name: str
    commit_sha: Optional[str] = None
    has_groq_key: bool = False
