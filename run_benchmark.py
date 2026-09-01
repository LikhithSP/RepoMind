"""
Run quick sample ingestion and evaluation benchmark to populate vector store and verify end-to-end metrics.
"""
from pathlib import Path
import asyncio
from coderag.ingestion.pipeline import run_ingestion_pipeline
from coderag.eval.run_eval import run_evaluation_benchmark, print_markdown_report


async def main():
    print("[1/2] Ingesting CodeRAG workspace codebase and issue fixtures...")
    # Ingest current codebase as target repo demonstration
    result = run_ingestion_pipeline(local_repo_dir=Path("."))
    print(f"Ingested {result['chunks_ingested']['total']} chunks in {result['elapsed_seconds']}s")

    print("\n[2/2] Running comparative evaluation benchmark...")
    report = await run_evaluation_benchmark()
    print_markdown_report(report)


if __name__ == "__main__":
    asyncio.run(main())
