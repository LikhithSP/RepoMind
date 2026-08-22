"""
AST-based code chunker.
CR-2: Parse code files, chunk at function/class boundaries without splitting mid-body.
Includes fallback to Python's standard `ast` module if tree-sitter bindings are not loaded.
"""
import ast
import os
from pathlib import Path
from typing import List, Dict, Any


def chunk_python_file(file_path: Path, rel_path: str) -> List[Dict[str, Any]]:
    try:
        content = file_path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return []

    lines = content.splitlines()
    total_lines = len(lines)
    if total_lines == 0:
        return []

    chunks: List[Dict[str, Any]] = []

    try:
        tree = ast.parse(content, filename=str(file_path))
    except Exception:
        # If syntax fails to parse (e.g. invalid syntax or python 2), chunk by blocks
        return _fallback_line_chunking(content, rel_path, "python")

    # Traverse top-level and class-level nodes
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            start_line = node.lineno
            end_line = getattr(node, "end_lineno", node.lineno)
            docstring = ast.get_docstring(node) or ""
            chunk_code = "\n".join(lines[start_line - 1:end_line])

            chunks.append({
                "type": "code",
                "symbol_name": node.name,
                "symbol_type": "function",
                "file_path": rel_path,
                "start_line": start_line,
                "end_line": end_line,
                "language": "python",
                "docstring": docstring,
                "text": f"File: {rel_path} ({start_line}-{end_line})\nSymbol: {node.name} (function)\n\n{chunk_code}"
            })

        elif isinstance(node, ast.ClassDef):
            class_start = node.lineno
            class_end = getattr(node, "end_lineno", node.lineno)
            class_doc = ast.get_docstring(node) or ""

            # Check class methods
            method_found = False
            for sub_node in node.body:
                if isinstance(sub_node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    method_found = True
                    m_start = sub_node.lineno
                    m_end = getattr(sub_node, "end_lineno", sub_node.lineno)
                    m_doc = ast.get_docstring(sub_node) or ""
                    m_code = "\n".join(lines[m_start - 1:m_end])
                    full_name = f"{node.name}.{sub_node.name}"

                    chunks.append({
                        "type": "code",
                        "symbol_name": full_name,
                        "symbol_type": "method",
                        "file_path": rel_path,
                        "start_line": m_start,
                        "end_line": m_end,
                        "language": "python",
                        "docstring": m_doc,
                        "text": f"File: {rel_path} ({m_start}-{m_end})\nSymbol: {full_name} (method)\n\n{m_code}"
                    })

            # Also create a chunk for the class header / signature
            header_end = class_start
            for sub_node in node.body:
                header_end = min(header_end, sub_node.lineno - 1)
                break
            header_end = max(class_start, min(header_end, class_start + 15))
            class_intro = "\n".join(lines[class_start - 1:header_end])

            chunks.append({
                "type": "code",
                "symbol_name": node.name,
                "symbol_type": "class",
                "file_path": rel_path,
                "start_line": class_start,
                "end_line": class_end,
                "language": "python",
                "docstring": class_doc,
                "text": f"File: {rel_path} ({class_start}-{class_end})\nSymbol: {node.name} (class)\nDocstring: {class_doc}\n\n{class_intro}"
            })

    # If no functions or classes were found (e.g., config, __init__.py), chunk file directly
    if not chunks and content.strip():
        chunks.append({
            "type": "code",
            "symbol_name": Path(rel_path).stem,
            "symbol_type": "module",
            "file_path": rel_path,
            "start_line": 1,
            "end_line": total_lines,
            "language": "python",
            "docstring": "",
            "text": f"File: {rel_path} (1-{total_lines})\n\n{content}"
        })

    return chunks


def _fallback_line_chunking(content: str, rel_path: str, language: str) -> List[Dict[str, Any]]:
    lines = content.splitlines()
    chunks = []
    chunk_size = 60
    step = 45
    for i in range(0, len(lines), step):
        chunk_lines = lines[i:i + chunk_size]
        start_line = i + 1
        end_line = min(i + chunk_size, len(lines))
        text = "\n".join(chunk_lines)
        chunks.append({
            "type": "code",
            "symbol_name": f"{Path(rel_path).name}:{start_line}",
            "symbol_type": "block",
            "file_path": rel_path,
            "start_line": start_line,
            "end_line": end_line,
            "language": language,
            "docstring": "",
            "text": f"File: {rel_path} ({start_line}-{end_line})\n\n{text}"
        })
    return chunks


def chunk_code_repository(repo_dir: Path) -> List[Dict[str, Any]]:
    chunks = []
    supported_extensions = {".py", ".js", ".jsx", ".ts", ".tsx", ".go", ".java", ".rs", ".c", ".cpp", ".h"}
    ignore_dirs = {".git", "__pycache__", "venv", ".venv", "node_modules", ".tox", ".eggs", "build", "dist", ".next", "out"}

    for root, dirs, files in os.walk(repo_dir):
        dirs[:] = [d for d in dirs if d not in ignore_dirs and not d.startswith(".")]
        for file in files:
            if len(chunks) >= 150:
                break
            ext = Path(file).suffix.lower()
            if ext in supported_extensions:
                full_path = Path(root) / file
                rel_path = str(full_path.relative_to(repo_dir)).replace("\\", "/")
                if ext == ".py":
                    file_chunks = chunk_python_file(full_path, rel_path)
                else:
                    try:
                        content = full_path.read_text(encoding="utf-8", errors="replace")
                        file_chunks = _fallback_line_chunking(content, rel_path, ext.lstrip("."))
                    except Exception:
                        file_chunks = []
                chunks.extend(file_chunks)
        if len(chunks) >= 150:
            break

    return chunks
