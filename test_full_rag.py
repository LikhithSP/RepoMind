import asyncio
import sys
from coderag.retrieval.hybrid_search import HybridRetriever
from coderag.retrieval.reranker import get_reranker
from coderag.generation.prompts import format_context_prompt
from coderag.generation.llm_client import LLMClient

async def main():
    query = "how to install this"
    h = HybridRetriever().retrieve(query)
    r = get_reranker().rerank(query, h['results'], top_k=5)
    p = format_context_prompt(query, r)
    llm = LLMClient(provider='groq', model='qwen/qwen3.8-27b')
    print("--- GENERATING ANSWER ---")
    async for token in llm.generate_stream(p):
        sys.stdout.write(token)
        sys.stdout.flush()
    print("\n--- DONE ---")

if __name__ == "__main__":
    asyncio.run(main())
