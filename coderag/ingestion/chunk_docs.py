"""
Markdown and documentation chunker.
CR-3: Split docs by header hierarchy (H1/H2/H3), preserving heading lineage in metadata.
"""
import re
from pathlib import Path
from typing import List, Dict, Any


def chunk_markdown_file(file_path: Path, rel_path: str) -> List[Dict[str, Any]]:
    try:
        content = file_path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return []

    lines = content.splitlines()
    if not lines:
        return []

    chunks: List[Dict[str, Any]] = []

    # Regex for ATX markdown headers
    header_pattern = re.compile(r'^(#{1,6})\s+(.*)$')

    current_headers = {}  # level -> title
    current_lines: List[str] = []
    chunk_start = 1

    for idx, line in enumerate(lines, start=1):
        match = header_pattern.match(line)
        if match:
            # Flush previous chunk if there is text
            if current_lines:
                chunk_end = idx - 1
                heading_path = " > ".join([current_headers[k] for k in sorted(current_headers.keys())])
                chunk_text = "\n".join(current_lines).strip()
                if chunk_text:
                    chunks.append({
                        "type": "doc",
                        "file_path": rel_path,
                        "heading_path": heading_path or "Introduction",
                        "start_line": chunk_start,
                        "end_line": chunk_end,
                        "text": f"Doc: {rel_path} ({chunk_start}-{chunk_end})\nPath: {heading_path}\n\n{chunk_text}"
                    })
                current_lines = []

            level = len(match.group(1))
            title = match.group(2).strip()

            # Remove deeper headers
            current_headers = {k: v for k, v in current_headers.items() if k < level}
            current_headers[level] = title
            chunk_start = idx

        current_lines.append(line)

    # Flush final block
    if current_lines:
        chunk_end = len(lines)
        heading_path = " > ".join([current_headers[k] for k in sorted(current_headers.keys())])
        chunk_text = "\n".join(current_lines).strip()
        if chunk_text:
            chunks.append({
                "type": "doc",
                "file_path": rel_path,
                "heading_path": heading_path or "Overview",
                "start_line": chunk_start,
                "end_line": chunk_end,
                "text": f"Doc: {rel_path} ({chunk_start}-{chunk_end})\nPath: {heading_path}\n\n{chunk_text}"
            })

    return chunks


def chunk_docs_repository(repo_dir: Path) -> List[Dict[str, Any]]:
    chunks = []
    doc_extensions = {".md", ".markdown", ".rst"}
    ignore_dirs = {".git", "node_modules", ".venv", "venv"}

    for root, dirs, files in Path(repo_dir).walk() if hasattr(Path(repo_dir), "walk") else os_walk(repo_dir):
        for file in files:
            if len(chunks) >= 50:
                break
            p = Path(root) / file
            if p.suffix.lower() in doc_extensions:
                rel_path = str(p.relative_to(repo_dir)).replace("\\", "/")
                chunks.extend(chunk_markdown_file(p, rel_path))
        if len(chunks) >= 50:
            break
    return chunks


def os_walk(repo_dir):
    import os
    for root, dirs, files in os.walk(repo_dir):
        if any(ignored in root for ignored in [".git", "node_modules", ".venv", "venv"]):
            continue
        yield root, dirs, files
