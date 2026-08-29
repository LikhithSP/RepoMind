"""
Observability and Tracing module.
CR-20: Wraps every request with Langfuse (if configured) and provides structured execution telemetry.
"""
import time
from typing import Dict, Any, Optional
from coderag.config import settings


class RequestTracer:
    def __init__(self, query: str, model: str):
        self.query = query
        self.model = model
        self.start_time = time.time()
        self.trace_data: Dict[str, Any] = {
            "query": query,
            "model": model,
            "steps": {}
        }
        self._langfuse = None
        self._init_langfuse()

    def _init_langfuse(self):
        if settings.LANGFUSE_PUBLIC_KEY and settings.LANGFUSE_SECRET_KEY:
            try:
                from langfuse import Langfuse
                self._langfuse = Langfuse(
                    public_key=settings.LANGFUSE_PUBLIC_KEY,
                    secret_key=settings.LANGFUSE_SECRET_KEY,
                    host=settings.LANGFUSE_HOST
                )
            except Exception:
                self._langfuse = None

    def log_step(self, step_name: str, payload: Dict[str, Any]):
        self.trace_data["steps"][step_name] = {
            "timestamp": time.time() - self.start_time,
            **payload
        }

    def get_trace(self) -> Dict[str, Any]:
        duration_sec = time.time() - self.start_time
        self.trace_data["latency_ms"] = round(duration_sec * 1000, 2)
        return self.trace_data

    def finish(self, answer: str, total_tokens: Optional[int] = None) -> Dict[str, Any]:
        duration_sec = time.time() - self.start_time
        self.trace_data["latency_ms"] = round(duration_sec * 1000, 2)
        self.trace_data["total_tokens"] = total_tokens or len(answer.split()) * 2

        # Send trace to Langfuse if available
        if self._langfuse is not None:
            try:
                trace = self._langfuse.trace(
                    name="coderag_query",
                    input=self.query,
                    output=answer,
                    metadata=self.trace_data
                )
            except Exception:
                pass

        return self.trace_data

