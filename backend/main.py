from contextlib import asynccontextmanager
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, HTTPException, UploadFile, Request, Form
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from .secrets import protect
from .interview_api import router as interview_router
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from starlette.concurrency import run_in_threadpool

from .database import DATA_DIR, connect, initialize
from .parsers import MAX_UPLOAD, SUPPORTED, parse_resume
from .schemas import CandidateCreate, ProjectCreate, SettingsUpdate

@asynccontextmanager
async def lifespan(app):
    from .runtime_lock import data_lock
    with data_lock(DATA_DIR):
        initialize()
        yield

app = FastAPI(title="AI Interview MVP", lifespan=lifespan)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["127.0.0.1", "localhost", "testserver"])
app.include_router(interview_router)

@app.exception_handler(RequestValidationError)
async def invalid_request(request, error):
    return JSONResponse(status_code=422, content={"detail": "输入格式不正确，请检查必填项、长度和字段类型。"})

@app.middleware("http")
async def local_origin(request: Request, call_next):
    origin = request.headers.get("origin")
    if origin and origin not in {"http://127.0.0.1:8765", "http://localhost:8765", "http://127.0.0.1:8766", "http://localhost:8766"}:
        return JSONResponse(status_code=403, content={"detail": "仅允许本机应用页面访问。"})
    return await call_next(request)

@app.get("/api/health")
def health():
    return {"status": "ok", "phase": 2}

def require(db, table: str, row_id: int):
    # table is supplied only by internal routes, never by request input.
    row = db.execute(f"SELECT * FROM {table} WHERE id = ?", (row_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "记录不存在")
    return dict(row)

@app.get("/api/projects")
def projects():
    with connect() as db:
        return [dict(r) for r in db.execute("SELECT * FROM projects ORDER BY id DESC")]

@app.post("/api/projects", status_code=201)
def create_project(body: ProjectCreate):
    with connect() as db:
        row_id = db.execute("INSERT INTO projects(kind,title,description) VALUES(?,?,?)", (body.kind, body.title, body.description)).lastrowid
        return require(db, "projects", row_id)

@app.get("/api/projects/{project_id}")
def project(project_id: int):
    with connect() as db:
        return require(db, "projects", project_id)

@app.delete("/api/projects/{project_id}", status_code=204)
def delete_project(project_id: int):
    with connect() as db:
        require(db, "projects", project_id)
        cand_ids = [r[0] for r in db.execute("SELECT id FROM candidates WHERE project_id=?", (project_id,))]
        if cand_ids:
            placeholders = ",".join("?" * len(cand_ids))
            gen_ids = [r[0] for r in db.execute(f"SELECT id FROM generations WHERE candidate_id IN ({placeholders})", cand_ids)]
            if gen_ids:
                ph2 = ",".join("?" * len(gen_ids))
                db.execute(f"DELETE FROM turns WHERE session_id IN (SELECT id FROM sessions WHERE generation_id IN ({ph2}))", gen_ids)
                db.execute(f"DELETE FROM claim_reviews WHERE session_id IN (SELECT id FROM sessions WHERE generation_id IN ({ph2}))", gen_ids)
                db.execute(f"DELETE FROM sessions WHERE generation_id IN ({ph2})", gen_ids)
            db.execute(f"DELETE FROM generations WHERE candidate_id IN ({placeholders})", cand_ids)
            db.execute(f"DELETE FROM resumes WHERE candidate_id IN ({placeholders})", cand_ids)
            db.execute(f"DELETE FROM candidates WHERE id IN ({placeholders})", cand_ids)
        db.execute("DELETE FROM projects WHERE id=?", (project_id,))
    return None

@app.get("/api/projects/{project_id}/candidates")
def candidates(project_id: int):
    with connect() as db:
        require(db, "projects", project_id)
        return [dict(r) for r in db.execute("""SELECT c.*,
          (SELECT count(*) FROM resumes r WHERE r.candidate_id=c.id) AS resume_count,
          (SELECT count(*) FROM sessions s JOIN generations g ON g.id=s.generation_id WHERE g.candidate_id=c.id) AS session_count,
          (SELECT s.id FROM sessions s JOIN generations g ON g.id=s.generation_id WHERE g.candidate_id=c.id ORDER BY s.id DESC LIMIT 1) AS latest_session_id,
          (SELECT s.status FROM sessions s JOIN generations g ON g.id=s.generation_id WHERE g.candidate_id=c.id ORDER BY s.id DESC LIMIT 1) AS latest_session_status
          FROM candidates c WHERE project_id=? ORDER BY c.id DESC""", (project_id,))]

@app.post("/api/candidates", status_code=201)
def create_candidate(body: CandidateCreate):
    with connect() as db:
        require(db, "projects", body.project_id)
        row_id = db.execute("INSERT INTO candidates(project_id,name,role,notes) VALUES(?,?,?,?)", (body.project_id, body.name, body.role, body.notes)).lastrowid
        return require(db, "candidates", row_id)

@app.get("/api/candidates/{candidate_id}/resumes")
def resumes(candidate_id: int):
    with connect() as db:
        require(db, "candidates", candidate_id)
        return [dict(r) for r in db.execute("SELECT id,candidate_id,original_name,file_path,warning,created_at FROM resumes WHERE candidate_id=? ORDER BY id DESC", (candidate_id,))]

@app.get("/api/resumes/{resume_id}")
def resume(resume_id: int):
    with connect() as db:
        return require(db, "resumes", resume_id)

async def prepare_resume(file: UploadFile):
    path = None
    saved = False
    try:
        name = (file.filename or "").replace("\\", "/").split("/")[-1]
        suffix = Path(name).suffix.lower()
        if suffix not in SUPPORTED:
            raise HTTPException(400, "仅支持 PDF、DOCX、TXT 文件。")
        path = DATA_DIR / "resumes" / f"{uuid4().hex}{suffix}"
        size = 0
        with path.open("xb") as target:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_UPLOAD:
                    raise HTTPException(413, "文件不得超过 20 MB。")
                target.write(chunk)
        if size == 0:
            raise HTTPException(400, "文件为空。")
        try:
            text, warning = await run_in_threadpool(parse_resume, path)
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
        saved = True
        return path, name, text, warning
    finally:
        await file.close()
        if path is not None and not saved:
            path.unlink(missing_ok=True)

def insert_resume(db, candidate_id, prepared):
    path, name, text, warning = prepared
    row_id = db.execute("INSERT INTO resumes(candidate_id,original_name,file_path,text,warning) VALUES(?,?,?,?,?)", (candidate_id, name, path.relative_to(DATA_DIR).as_posix(), text, warning)).lastrowid
    return require(db, "resumes", row_id)

@app.post("/api/candidates/{candidate_id}/resumes", status_code=201)
async def upload_resume(candidate_id: int, file: UploadFile):
    with connect() as db:
        require(db, "candidates", candidate_id)
    prepared = await prepare_resume(file)
    try:
        with connect() as db:
            return insert_resume(db, candidate_id, prepared)
    except BaseException:
        prepared[0].unlink(missing_ok=True)
        raise

@app.post("/api/projects/{project_id}/import-candidate", status_code=201)
async def import_candidate(project_id: int, file: UploadFile,
                           name: str = Form(min_length=1, max_length=100),
                           role: str = Form(min_length=1, max_length=200)):
    name, role = name.strip(), role.strip()
    if not name or not role:
        raise HTTPException(422, "请填写候选人姓名和岗位。")
    with connect() as db:
        require(db, "projects", project_id)
    prepared = await prepare_resume(file)
    try:
        with connect() as db:
            # One file is one atomic candidate+resume import. Failed files leave no empty candidates.
            candidate_id = db.execute("INSERT INTO candidates(project_id,name,role,notes) VALUES(?,?,?,?)", (project_id, name, role, "批量简历导入；姓名与岗位由导入时确认。")).lastrowid
            resume = insert_resume(db, candidate_id, prepared)
            candidate = require(db, "candidates", candidate_id)
        return {"candidate": candidate, "resume": resume}
    except BaseException:
        prepared[0].unlink(missing_ok=True)
        raise

@app.get("/api/settings")
def get_settings():
    with connect() as db:
        result = require(db, "settings", 1)
        result["has_api_key"] = bool(result.pop("api_key"))
        return result

@app.put("/api/settings")
def save_settings(body: SettingsUpdate):
    if body.base_url:
        from .providers.openai_compatible import endpoint, ProviderError
        try:
            endpoint(body.base_url)
        except ProviderError as error:
            raise HTTPException(422, str(error)) from None
    with connect() as db:
        current = require(db, "settings", 1)
        key = current["api_key"] if body.api_key is None else protect(body.api_key)
        db.execute("UPDATE settings SET provider=?,base_url=?,api_key=?,model=? WHERE id=1", (body.provider, body.base_url, key, body.model))
    return get_settings()


@app.put("/api/candidates/{candidate_id}")
def edit_candidate(candidate_id: int, body: CandidateCreate):
    with connect() as db:
        current = require(db, "candidates", candidate_id)
        if body.project_id != current["project_id"]:
            raise HTTPException(400, "候选人不能跨项目移动。")
        if db.execute("SELECT 1 FROM generations WHERE candidate_id=? AND status='pending'", (candidate_id,)).fetchone():
            raise HTTPException(409, "请等待生成完成后再修改。")
        if db.execute("SELECT 1 FROM sessions s JOIN generations g ON g.id=s.generation_id WHERE g.candidate_id=? AND s.busy=1", (candidate_id,)).fetchone():
            raise HTTPException(409, "请等待面试分析完成后再修改。")
        db.execute("UPDATE candidates SET name=?,role=?,notes=? WHERE id=?", (body.name, body.role, body.notes, candidate_id))
        return require(db, "candidates", candidate_id)

@app.delete("/api/candidates/{candidate_id}")
def delete_candidate(candidate_id: int):
    with connect() as db:
        db.execute("BEGIN IMMEDIATE")
        require(db, "candidates", candidate_id)
        busy = db.execute("SELECT 1 FROM generations WHERE candidate_id=? AND status='pending'", (candidate_id,)).fetchone()
        busy_session = db.execute("SELECT 1 FROM sessions s JOIN generations g ON g.id=s.generation_id WHERE g.candidate_id=? AND s.busy=1", (candidate_id,)).fetchone()
        if busy or busy_session:
            raise HTTPException(409, "候选人正在生成或分析，暂不能删除。")
        paths = [DATA_DIR / row[0] for row in db.execute("SELECT file_path FROM resumes WHERE candidate_id=?", (candidate_id,))]
        for path in paths:
            if not path.resolve().is_relative_to((DATA_DIR / "resumes").resolve()):
                raise HTTPException(500, "检测到无效文件路径，未执行删除。")
        sub = "SELECT s.id FROM sessions s JOIN generations g ON g.id=s.generation_id WHERE g.candidate_id=?"
        db.execute(f"DELETE FROM claim_reviews WHERE session_id IN ({sub})", (candidate_id,))
        db.execute(f"DELETE FROM turns WHERE session_id IN ({sub})", (candidate_id,))
        db.execute("DELETE FROM sessions WHERE generation_id IN (SELECT id FROM generations WHERE candidate_id=?)", (candidate_id,))
        db.execute("DELETE FROM generations WHERE candidate_id=?", (candidate_id,))
        db.execute("DELETE FROM resumes WHERE candidate_id=?", (candidate_id,))
        db.execute("DELETE FROM candidates WHERE id=?", (candidate_id,))
    failed = 0
    for path in paths:
        try:
            path.unlink(missing_ok=True)
        except OSError:
            failed += 1
    return {"deleted": True, "warning": f"有 {failed} 个原文件被系统占用，请关闭占用程序后清理 data/resumes 中对应文件。" if failed else ""}
