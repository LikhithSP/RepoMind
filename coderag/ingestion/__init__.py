"""
Ingestion package exports.
"""
from coderag.ingestion.clone_repo import clone_or_update_repo
from coderag.ingestion.chunk_code import chunk_code_repository, chunk_python_file
from coderag.ingestion.chunk_docs import chunk_docs_repository, chunk_markdown_file
from coderag.ingestion.chunk_issues import chunk_issues
from coderag.ingestion.pipeline import run_ingestion_pipeline

__all__ = [
    "clone_or_update_repo",
    "chunk_code_repository",
    "chunk_python_file",
    "chunk_docs_repository",
    "chunk_markdown_file",
    "chunk_issues",
    "run_ingestion_pipeline"
]
