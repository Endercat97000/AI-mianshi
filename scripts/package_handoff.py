"""Create a source-only handoff ZIP using explicit roots, never local business data."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]
ROOT_FILES = {"README.md", "FRONTEND_START_HERE.md", ".env.example", ".gitignore"}
SOURCE_DIRS = ("backend", "frontend", "skills", "scripts", "docs")
SKIP_DIRS = {"node_modules", ".venv", "__pycache__", ".pytest_cache", ".git", ".playwright-cli", "dist", "output", "data"}
SECRET = re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bsk-[A-Za-z0-9_-]{24,}")

def sources():
    result = [ROOT / name for name in sorted(ROOT_FILES)]
    for source in SOURCE_DIRS:
        for folder, dirs, files in os.walk(ROOT / source, followlinks=False):
            dirs[:] = sorted(d for d in dirs if d not in SKIP_DIRS and not (Path(folder) / d).is_symlink())
            for name in sorted(files):
                path = Path(folder) / name
                if path.is_symlink() or name.startswith(".env") or path.suffix.lower() in {".db", ".sqlite", ".sqlite3", ".pyc", ".pyo", ".tsbuildinfo", ".zip"}:
                    continue
                result.append(path)
    result += [ROOT / "data" / section / ".gitkeep" for section in ("candidates", "resumes")]
    return sorted(result)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    output = args.output.resolve()
    if output.exists():
        raise SystemExit("Output already exists; choose a new archive name.")
    entries = []
    for path in sources():
        blob = path.read_bytes()
        if path.suffix not in {".png", ".jpg", ".jpeg"} and SECRET.search(blob):
            raise SystemExit(f"Possible secret detected in {path.relative_to(ROOT)}; archive not created.")
        name = "ai-interviewer/" + path.relative_to(ROOT).as_posix()
        entries.append((name, blob))
    manifest = {"package": "frontend-source-handoff", "files": [{"path":name, "bytes":len(blob), "sha256":hashlib.sha256(blob).hexdigest()} for name,blob in entries]}
    output.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(output, "x", compression=ZIP_DEFLATED, compresslevel=9) as archive:
        for name, blob in entries:
            archive.writestr(name, blob)
        archive.writestr("ai-interviewer/PACKAGE_MANIFEST.json", json.dumps(manifest, ensure_ascii=False, indent=2))
    with ZipFile(output) as archive:
        assert archive.testzip() is None
        assert len(archive.namelist()) == len(entries) + 1
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    output.with_suffix(".zip.sha256.txt").write_text(f"{digest}  {output.name}\n", encoding="utf-8")
    print(json.dumps({"archive":str(output), "files":len(entries)+1, "bytes":output.stat().st_size, "sha256":digest}, ensure_ascii=False))

if __name__ == "__main__":
    main()
