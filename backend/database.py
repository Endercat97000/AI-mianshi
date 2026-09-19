import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")
DATA_DIR = Path(os.getenv("AI_INTERVIEW_DATA_DIR", str(ROOT / "data"))).resolve()

@contextmanager
def connect():
    db = sqlite3.connect(DATA_DIR / "app.db", timeout=10)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    db.execute("PRAGMA secure_delete = ON")
    try:
        with db:
            yield db
    finally:
        db.close()

def initialize():
    for folder in (DATA_DIR, DATA_DIR / "resumes", DATA_DIR / "candidates"):
        folder.mkdir(parents=True, exist_ok=True)
    with connect() as db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY,
            kind TEXT NOT NULL CHECK(kind IN ('project', 'jd')),
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS candidates (
            id INTEGER PRIMARY KEY,
            project_id INTEGER NOT NULL REFERENCES projects(id),
            name TEXT NOT NULL,
            role TEXT NOT NULL,
            notes TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS resumes (
            id INTEGER PRIMARY KEY,
            candidate_id INTEGER NOT NULL REFERENCES candidates(id),
            original_name TEXT NOT NULL,
            file_path TEXT NOT NULL,
            text TEXT NOT NULL,
            warning TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_candidates_project ON candidates(project_id);
        CREATE INDEX IF NOT EXISTS idx_resumes_candidate ON resumes(candidate_id);
        CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY CHECK(id = 1),
            provider TEXT NOT NULL DEFAULT 'openai',
            base_url TEXT NOT NULL DEFAULT '',
            api_key TEXT NOT NULL DEFAULT '',
            model TEXT NOT NULL DEFAULT ''
        );
        INSERT OR IGNORE INTO settings(id) VALUES(1);
        """)

    from .migrations import migrate
    with connect() as db:
        migrate(db)
