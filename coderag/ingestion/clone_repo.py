"""
Repo cloning and git metadata extraction.
CR-1: Clone target repo via git or download, capture commit SHA.
"""
import os
import subprocess
import shutil
from pathlib import Path
from typing import Dict, Any, Optional
from coderag.config import settings


def clone_or_update_repo(repo_url: Optional[str] = None, target_dir: Optional[Path] = None) -> Dict[str, Any]:
    url = repo_url or settings.TARGET_REPO_URL
    out_dir = target_dir or (settings.REPO_CACHE_DIR / Path(url).stem)
    out_dir.parent.mkdir(parents=True, exist_ok=True)

    commit_sha = "unknown_sha"
    if (out_dir / ".git").exists():
        # Already cloned, fetch current commit SHA
        try:
            res = subprocess.run(
                ["git", "rev-parse", "HEAD"],
                cwd=str(out_dir),
                capture_output=True,
                text=True,
                check=True
            )
            commit_sha = res.stdout.strip()
        except Exception:
            commit_sha = "cached_local_commit"
    else:
        # Shallow clone to keep it fast and light with a strict timeout
        try:
            subprocess.run(
                ["git", "clone", "--depth", "1", url, str(out_dir)],
                check=True,
                capture_output=True,
                text=True,
                timeout=45
            )
            res = subprocess.run(
                ["git", "rev-parse", "HEAD"],
                cwd=str(out_dir),
                capture_output=True,
                text=True,
                check=True,
                timeout=10
            )
            commit_sha = res.stdout.strip()
        except Exception as e:
            # If clone fails (e.g. offline), create directory and fallback gracefully
            out_dir.mkdir(parents=True, exist_ok=True)
            commit_sha = "offline_fallback_sha"

    return {
        "repo_url": url,
        "repo_path": str(out_dir),
        "commit_sha": commit_sha
    }
