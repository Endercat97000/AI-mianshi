"""Read-only local preflight. Does not install packages, read keys or call AI."""
import importlib.metadata
import json
import shutil
import sqlite3
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACKAGES = ["fastapi", "uvicorn", "python-multipart", "PyMuPDF", "python-docx", "python-dotenv", "httpx"]

def main():
    result = {"python": sys.version.split()[0], "packages": {}, "tools": {}, "services": {}}
    for package in PACKAGES:
        try:
            result["packages"][package] = importlib.metadata.version(package)
        except importlib.metadata.PackageNotFoundError:
            result["packages"][package] = "missing"
    for name in ("git", "node", "npm"):
        executable = shutil.which(name + ".cmd") or shutil.which(name)
        try:
            result["tools"][name] = subprocess.check_output([executable, "--version"], text=True, timeout=10).strip() if executable else "missing"
        except (OSError, subprocess.SubprocessError):
            result["tools"][name] = "unavailable"
    for port, path in ((8765, "/"), (8765, "/api/health"), (8766, "/api/health")):
        url = f"http://127.0.0.1:{port}{path}"
        try:
            # Ignore system proxies for local-only health checks.
            opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
            with opener.open(url, timeout=3) as response:
                result["services"][url] = response.status
        except (OSError, ValueError):
            result["services"][url] = "not reachable (start service first)"
    sys.path.insert(0, str(ROOT))
    try:
        from backend.database import DATA_DIR
        db_path = DATA_DIR / "app.db"
        result["database"] = {"exists": db_path.exists()}
        if db_path.exists():
            db = sqlite3.connect(db_path.as_uri() + "?mode=ro", uri=True)
            try:
                tables = {row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
                result["database"]["required_tables_present"] = {t: t in tables for t in ["projects", "candidates", "resumes", "settings", "schema_migrations", "generations", "sessions", "turns", "claim_reviews"]}
            finally:
                db.close()
    except Exception as error:
        result["database"] = {"check_error_type": type(error).__name__}
    result["frontend_dependencies_present"] = (ROOT / "frontend/node_modules/typescript/package.json").exists()
    references = json.loads((ROOT / "docs/reference-repositories.json").read_text(encoding="utf-8"))["repositories"]
    result["reference_repository_count"] = len(references)
    result["upstream_installations_per_manifest"] = sum(bool(item["installed"]) for item in references)
    result["ai_runtime"] = "OpenAI-compatible implementation; POST /api/settings/test requires explicit user action"
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return int(any(v == "missing" for v in result["packages"].values()))

if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    raise SystemExit(main())
