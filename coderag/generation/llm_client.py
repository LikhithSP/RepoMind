"""
Model-agnostic LLM Client.
CR-10: Unified generator wrapper supporting Groq, OpenAI, Anthropic, and Mock/Offline providers.
Supports both synchronous completion and asynchronous streaming (token-by-token).
"""
import os
import asyncio
from typing import AsyncGenerator, Optional, Dict, Any, List
from coderag.config import settings
from coderag.generation.prompts import SYSTEM_PROMPT


class LLMClient:
    def __init__(self, provider: Optional[str] = None, model: Optional[str] = None, api_key: Optional[str] = None):
        self.provider = provider or settings.LLM_PROVIDER
        self.model = model or settings.DEFAULT_MODEL
        self.api_key = api_key

    async def generate_stream(
        self,
        prompt: str,
        system_prompt: str = SYSTEM_PROMPT,
        temperature: float = 0.1
    ) -> AsyncGenerator[str, None]:
        """Streams response token by token."""
        groq_key = self.api_key or settings.GROQ_API_KEY
        openai_key = self.api_key or settings.OPENAI_API_KEY
        anthropic_key = self.api_key or settings.ANTHROPIC_API_KEY

        if self.provider == "groq" and groq_key:
            async for token in self._stream_groq(prompt, system_prompt, temperature, api_key=groq_key):
                yield token
        elif self.provider == "openai" and settings.OPENAI_API_KEY:
            async for token in self._stream_openai(prompt, system_prompt, temperature):
                yield token
        elif self.provider == "anthropic" and settings.ANTHROPIC_API_KEY:
            async for token in self._stream_anthropic(prompt, system_prompt, temperature):
                yield token
        else:
            # Deterministic mock provider (ideal for testing, offline demos, evals without costs)
            async for token in self._stream_mock(prompt):
                yield token

    async def generate(
        self,
        prompt: str,
        system_prompt: str = SYSTEM_PROMPT,
        temperature: float = 0.1
    ) -> str:
        """Non-streaming full response."""
        chunks = []
        async for token in self.generate_stream(prompt, system_prompt, temperature):
            chunks.append(token)
        return "".join(chunks)

    async def _stream_groq(self, prompt: str, system_prompt: str, temperature: float, api_key: Optional[str] = None) -> AsyncGenerator[str, None]:
        from groq import AsyncGroq
        effective_key = api_key or self.api_key or settings.GROQ_API_KEY
        client = AsyncGroq(api_key=effective_key)
        model_name = self.model if self.model else "qwen/qwen3.8-27b"
        stream = await client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            temperature=temperature,
            max_tokens=600,
            stream=True
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta

    async def _stream_openai(self, prompt: str, system_prompt: str, temperature: float) -> AsyncGenerator[str, None]:
        import httpx
        headers = {
            "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
            "Content-Type": "application/json"
        }
        model_name = self.model if "gpt" in self.model else "gpt-4o-mini"
        payload = {
            "model": model_name,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            "temperature": temperature,
            "stream": True
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            async with client.stream("POST", "https://api.openai.com/v1/chat/completions", headers=headers, json=payload) as resp:
                async for line in resp.aiter_lines():
                    if line.startswith("data: ") and line != "data: [DONE]":
                        import json
                        data = json.loads(line[6:])
                        delta = data["choices"][0]["delta"].get("content")
                        if delta:
                            yield delta

    async def _stream_anthropic(self, prompt: str, system_prompt: str, temperature: float) -> AsyncGenerator[str, None]:
        import httpx
        headers = {
            "x-api-key": settings.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }
        model_name = self.model if "claude" in self.model else "claude-3-5-haiku-latest"
        payload = {
            "model": model_name,
            "system": system_prompt,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 1024,
            "stream": True
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            async with client.stream("POST", "https://api.anthropic.com/v1/messages", headers=headers, json=payload) as resp:
                async for line in resp.aiter_lines():
                    if line.startswith("data: "):
                        import json
                        data = json.loads(line[6:])
                        if data.get("type") == "content_block_delta":
                            delta = data.get("delta", {}).get("text")
                            if delta:
                                yield delta

    async def _stream_mock(self, prompt: str) -> AsyncGenerator[str, None]:
        """Intelligent offline mock that dynamically summarizes retrieved snippet contents matching the query."""
        import re

        # Extract user query
        query_match = re.search(r'<user_query>\s*(.*?)\s*</user_query>', prompt, re.DOTALL)
        query = query_match.group(1).strip() if query_match else "this capability"

        # Extract snippets and their actual content
        snippets = re.findall(
            r'---\s*Snippet\s*\[(\d+)\]\s*---\s*\n(.*?)\nContent:\s*\n(.*?)(?=\n---\s*Snippet|\n</retrieved_context>)',
            prompt,
            re.DOTALL
        )

        if not snippets:
            response_text = "I could not find sufficient matching information in the retrieved context to answer this question."
        else:
            first_idx, first_meta, first_content = snippets[0]
            first_file = first_meta.split("Source: ")[1].split(" ")[0] if "Source: " in first_meta else "codebase"

            # Check if snippets have descriptive text (like README features)
            relevant_points = []
            for idx, meta, content in snippets[:4]:
                clean_lines = [
                    l.strip().lstrip("-*# ").strip()
                    for l in content.splitlines()
                    if l.strip() and not l.strip().startswith("//") and not l.strip().startswith("import ")
                ]
                # Filter lines that mention keywords from query
                query_words = [w.lower() for w in re.findall(r'\w+', query) if len(w) > 3]
                matched_lines = [line for line in clean_lines if any(qw in line.lower() for qw in query_words)]
                if matched_lines:
                    relevant_points.append(f"- {matched_lines[0]} [{idx}]")
                elif clean_lines:
                    relevant_points.append(f"- {clean_lines[0][:120]} [{idx}]")

            points_text = "\n".join(relevant_points) if relevant_points else f"- Documented and implemented in `{first_file}` [{first_idx}]."

            response_text = (
                f"Yes, based on the repository code and documentation in `[{first_idx}]`, here are the relevant details regarding **{query}**:\n\n"
                f"### Relevant Implementation & Features\n"
                f"{points_text}\n\n"
                f"You can view the full context and implementation directly in the cited sources."
            )

        words = response_text.split(" ")
        for word in words:
            yield word + " "
            await asyncio.sleep(0.015)
