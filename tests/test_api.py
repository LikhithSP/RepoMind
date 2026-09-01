"""
Integration tests for CodeRAG FastAPI endpoints.
"""
import pytest
from fastapi.testclient import TestClient
from coderag.api.main import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "indexed_points" in data
    assert "repo_name" in data


def test_retrieve_endpoint():
    response = client.post("/retrieve", json={"query": "Session connection pooling", "limit": 5})
    assert response.status_code == 200
    data = response.json()
    assert "query" in data
    assert "routing" in data
    assert "candidates" in data


def test_reindex_protected():
    # Without valid header
    res = client.post("/reindex", json={}, headers={"x-api-key": "wrong-key"})
    assert res.status_code == 403
