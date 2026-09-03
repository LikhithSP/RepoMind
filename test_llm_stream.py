import asyncio
import sys
from coderag.generation.llm_client import LLMClient

async def main():
    llm = LLMClient(provider='groq', model='qwen/qwen3.8-27b')
    async for token in llm.generate_stream("How to install requests library in Python?"):
        sys.stdout.write(token)
        sys.stdout.flush()
    print("\n\nSTREAM COMPLETE")

if __name__ == "__main__":
    asyncio.run(main())
