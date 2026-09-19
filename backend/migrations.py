from .secrets import protect

SCHEMA = [
    "CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    """CREATE TABLE IF NOT EXISTS generations(
      id INTEGER PRIMARY KEY, candidate_id INTEGER NOT NULL REFERENCES candidates(id),
      resume_id INTEGER NOT NULL REFERENCES resumes(id), status TEXT NOT NULL,
      input_json TEXT NOT NULL, output_json TEXT, error TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)""",
    """CREATE TABLE IF NOT EXISTS sessions(
      id INTEGER PRIMARY KEY, generation_id INTEGER NOT NULL REFERENCES generations(id),
      status TEXT NOT NULL DEFAULT 'active', busy INTEGER NOT NULL DEFAULT 0,
      budget INTEGER NOT NULL, difficulty TEXT NOT NULL DEFAULT 'normal',
      revision INTEGER NOT NULL DEFAULT 0, current_json TEXT NOT NULL,
      claim_states_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)""",
    """CREATE TABLE IF NOT EXISTS turns(
      id INTEGER PRIMARY KEY, session_id INTEGER NOT NULL REFERENCES sessions(id),
      question_json TEXT NOT NULL, answer TEXT NOT NULL,
      analysis_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)""",
    """CREATE TABLE IF NOT EXISTS claim_reviews(
      id INTEGER PRIMARY KEY, session_id INTEGER NOT NULL REFERENCES sessions(id),
      claim_index INTEGER NOT NULL, state TEXT NOT NULL, note TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)""",
    "CREATE INDEX IF NOT EXISTS idx_generations_candidate ON generations(candidate_id)",
    "CREATE INDEX IF NOT EXISTS idx_turns_session ON turns(session_id)",
]

def migrate(db):
    for statement in SCHEMA:
        db.execute(statement)
    db.execute("INSERT OR IGNORE INTO schema_migrations(version) VALUES(1)")
    # Upgrade legacy plain-text key; no key is emitted to logs.
    value = db.execute("SELECT api_key FROM settings WHERE id=1").fetchone()[0]
    db.execute("UPDATE settings SET api_key=? WHERE id=1", (protect(value),))
    # A process restart must not leave an interrupted operation permanently locked.
    db.execute("UPDATE generations SET status='failed', error='服务重启中断了生成，请重新预览后重试。' WHERE status='pending'")
    db.execute("UPDATE sessions SET busy=0 WHERE busy=1")
