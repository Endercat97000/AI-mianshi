import asyncio
import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from fastapi.responses import Response

from .database import connect
from .interview_models import PlanRequest, SessionCreate, AnswerRequest, ReviewRequest, SessionOptions, RevisionRequest, UseQuestionRequest
from . import interview_service as service
from .providers.base import Message
from .providers.openai_compatible import ProviderError
from .privacy import redact
from .skills import list_skills, write_skill

router = APIRouter(prefix="/api")
OPENINGS = {
    "introduction": "我们先轻松聊聊。可以简单介绍一下自己，或者最近在忙什么吗？",
    "recent": "最近有没有一件让你觉得挺有意思的事？工作、学习或一个小项目都可以。",
    "expectations": "开始前，你希望今天重点聊些什么，或者有什么想先了解的吗？",
}

def failure(error):
    if isinstance(error, (ProviderError, ValueError)):
        return str(error)
    return "处理失败，本次更改未采用；已有记录仍然保留。"

def generation_view(row):
    row = dict(row)
    row["input"] = json.loads(row.pop("input_json"))
    output = row.pop("output_json")
    row["output"] = json.loads(output) if output else None
    return row

@router.get("/skills")
def skills():
    return list_skills()

class SkillCreate(BaseModel):
    id: str
    description: str
    content: str

@router.post("/skills", status_code=201)
def create_skill(body: SkillCreate):
    try:
        return write_skill(body.id, body.description, body.content)
    except ValueError as e:
        raise HTTPException(422, str(e)) from None

@router.post("/settings/test")
async def test_connection():
    try:
        config = service.provider_config()
        await service.provider_for(config).generate([Message("user", "Reply with OK only.")])
        return {"ok": True, "model": config.model, "message": "连接成功，已收到模型回复。"}
    except (ProviderError, ValueError) as error:
        raise HTTPException(502, failure(error)) from None

@router.post("/candidates/{candidate_id}/preview")
def preview(candidate_id: int, body: PlanRequest):
    payload, digest = service.snapshot(candidate_id, body)
    return {"input": payload, "preview_hash": digest}

@router.post("/candidates/{candidate_id}/generations", status_code=201)
async def generate(candidate_id: int, body: PlanRequest):
    payload, digest = service.snapshot(candidate_id, body)
    if digest != body.preview_hash:
        raise HTTPException(409, "输入或模型配置已变化，请重新预览再生成。")
    with connect() as db:
        db.execute("BEGIN IMMEDIATE")
        if db.execute("SELECT 1 FROM generations WHERE candidate_id=? AND status='pending'", (candidate_id,)).fetchone():
            raise HTTPException(409, "该候选人已有生成任务，请等待完成。")
        identifier = db.execute("INSERT INTO generations(candidate_id,resume_id,status,input_json) VALUES(?,?,'pending',?)", (candidate_id, body.resume_id, service.dump(payload))).lastrowid
    try:
        config = service.provider_config()
        if (config.provider, config.base_url, config.model) != (payload["provider"], payload["base_url"], payload["model"]):
            raise ValueError("模型配置发生变化，请重新预览。")
        output = await service.generate_plan(payload, config)
        with connect() as db:
            db.execute("UPDATE generations SET status='completed', output_json=? WHERE id=?", (service.dump(output), identifier))
    except (Exception, asyncio.CancelledError) as error:
        with connect() as db:
            db.execute("UPDATE generations SET status='failed',error=? WHERE id=?", (failure(error), identifier))
        if isinstance(error, asyncio.CancelledError):
            raise
        raise HTTPException(502, failure(error)) from None
    return get_generation(identifier)

@router.get("/candidates/{candidate_id}/generations")
def generations(candidate_id: int):
    with connect() as db:
        service.require(db, "candidates", candidate_id)
        return [dict(r) for r in db.execute("SELECT id,status,error,created_at FROM generations WHERE candidate_id=? ORDER BY id DESC", (candidate_id,))]

@router.get("/generations/{identifier}")
def get_generation(identifier: int):
    with connect() as db:
        return generation_view(service.require(db, "generations", identifier))

@router.post("/sessions", status_code=201)
def start_session(body: SessionCreate):
    with connect() as db:
        gen = generation_view(service.require(db, "generations", body.generation_id))
        if gen["status"] != "completed":
            raise HTTPException(400, "请先完成面试提纲。")
        current = gen["output"]["questions"][0]
        if body.opening != "none":
            current = {"question": OPENINGS[body.opening], "capability": "交流开场", "resume_quote": "", "reason": "先熟悉彼此；仅记录，不作能力判断或自动追问。", "difficulty": "easy", "kind": "opening"}
        states = {str(i): "QUESTIONED" if claim["capability"] == current["capability"] else "UNKNOWN" for i, claim in enumerate(gen["output"]["claims"])}
        identifier = db.execute("INSERT INTO sessions(generation_id,budget,difficulty,current_json,claim_states_json) VALUES(?,?,?,?,?)", (body.generation_id, body.budget, body.difficulty, service.dump(current), service.dump(states))).lastrowid
    return get_session(identifier)

@router.get("/candidates/{candidate_id}/sessions")
def sessions(candidate_id: int):
    with connect() as db:
        service.require(db, "candidates", candidate_id)
        return [dict(r) for r in db.execute("SELECT s.id,s.status,s.created_at,s.budget FROM sessions s JOIN generations g ON g.id=s.generation_id WHERE g.candidate_id=? ORDER BY s.id DESC", (candidate_id,))]

@router.get("/sessions/{identifier}")
def get_session(identifier: int):
    with connect() as db:
        session = service.require(db, "sessions", identifier)
        gen = generation_view(service.require(db, "generations", session["generation_id"]))
        candidate = service.require(db, "candidates", gen["candidate_id"])
        rows = db.execute("SELECT * FROM turns WHERE session_id=? ORDER BY id", (identifier,)).fetchall()
        reviews = [dict(r) for r in db.execute("SELECT * FROM claim_reviews WHERE session_id=? ORDER BY id", (identifier,))]
    session["current"] = json.loads(session.pop("current_json"))
    session.pop("claim_states_json")
    session["turns"] = [{"id": row["id"], "question": json.loads(row["question_json"]), "answer": row["answer"], "analysis": json.loads(row["analysis_json"]), "created_at": row["created_at"]} for row in rows]
    session["claim_states"] = service.cumulative_claim_states(gen["output"], session["turns"], session["current"] if session["status"] == "active" else None)
    session["generation"] = gen
    session["project_id"] = candidate["project_id"]
    session["candidate"] = {"id":candidate["id"], "name":candidate["name"], "role":candidate["role"]}
    session["reviews"] = reviews
    session["coverage"] = {c["name"]: sum(t["question"]["capability"] == c["name"] for t in session["turns"]) for c in gen["output"]["capabilities"]}
    return session

@router.post("/sessions/{identifier}/answers")
async def answer(identifier: int, body: AnswerRequest):
    with connect() as db:
        service.require(db, "sessions", identifier)
        changed = db.execute("UPDATE sessions SET busy=1 WHERE id=? AND busy=0 AND status='active' AND revision=?", (identifier, body.revision)).rowcount
        if not changed:
            raise HTTPException(409, "面试已更新、已结束或正在处理，请刷新。")
    try:
        session = get_session(identifier)
        gen = session["generation"]
        with connect() as db:
            candidate = service.require(db, "candidates", gen["candidate_id"])
        clean_answer = redact(body.answer, candidate["name"]) if gen["input"]["privacy"] else body.answer
        config = service.provider_config()
        # A session cannot silently move personal data to a different provider.
        if (config.provider, config.base_url, config.model) != (gen["input"]["provider"], gen["input"]["base_url"], gen["input"]["model"]):
            raise ValueError("当前模型配置与本次提纲不同。请恢复原配置，或生成新提纲后开始面试。")
        if session["current"].get("kind") == "opening":
            result = {"observation":"常规开场回答已记录；不进行能力判断，不更新声明，也不自动追问。", "answer_quote":clean_answer, "updates":[], "follow_up":None}
        else:
            result = await service.analyze_answer(gen["output"], gen["input"], session["current"], session["turns"], clean_answer, session["difficulty"], config)
        states = session["claim_states"]
        service.merge_claim_updates(states, result["updates"])
        asked = {t["question"]["question"] for t in session["turns"]} | {session["current"]["question"]}
        remaining = [q for q in gen["output"]["questions"] if q["question"] not in asked]
        # Prefer uncovered planned capabilities before optional extra follow-ups.
        uncovered = [q for q in remaining if session["coverage"].get(q["capability"], 0) == 0 and q["capability"] != session["current"]["capability"]]
        next_question = (uncovered[0] if uncovered else result["follow_up"]) or (remaining[0] if remaining else None)
        done = len(session["turns"]) + 1 >= session["budget"] or next_question is None
        if not done:
            for i, claim in enumerate(gen["output"]["claims"]):
                if claim["capability"] == next_question["capability"] and states.get(str(i)) == "UNKNOWN":
                    states[str(i)] = "QUESTIONED"
        with connect() as db:
            db.execute("INSERT INTO turns(session_id,question_json,answer,analysis_json) VALUES(?,?,?,?)", (identifier, service.dump(session["current"]), clean_answer, service.dump(result)))
            db.execute("UPDATE sessions SET busy=0,revision=revision+1,status=?,current_json=?,claim_states_json=? WHERE id=?", ("completed" if done else "active", service.dump(next_question), service.dump(states), identifier))
    except (Exception, asyncio.CancelledError) as error:
        with connect() as db:
            db.execute("UPDATE sessions SET busy=0 WHERE id=?", (identifier,))
        if isinstance(error, asyncio.CancelledError):
            raise
        raise HTTPException(502, failure(error)) from None
    return get_session(identifier)

@router.post("/sessions/{identifier}/follow-up")
def choose_follow_up(identifier: int, body: RevisionRequest):
    session = get_session(identifier)
    follow_up = session["turns"][-1]["analysis"]["follow_up"] if session["turns"] else None
    asked = {t["question"]["question"] for t in session["turns"]}
    if not follow_up or follow_up["question"] in asked:
        raise HTTPException(400, "没有尚未使用的追问建议。")
    with connect() as db:
        if not db.execute("UPDATE sessions SET current_json=?,revision=revision+1 WHERE id=? AND busy=0 AND status='active' AND revision=?", (service.dump(follow_up), identifier, body.revision)).rowcount:
            raise HTTPException(409, "面试已更新或正在处理，请刷新。")
    return get_session(identifier)

@router.post("/sessions/{identifier}/use-question")
def use_question(identifier: int, body: UseQuestionRequest):
    with connect() as db:
        if not db.execute("UPDATE sessions SET current_json=?,revision=revision+1 WHERE id=? AND busy=0 AND status='active' AND revision=?", (service.dump(body.question.model_dump()), identifier, body.revision)).rowcount:
            raise HTTPException(409, "面试已更新或正在处理，请刷新。")
    return get_session(identifier)

@router.post("/sessions/{identifier}/finish")
def finish(identifier: int, body: RevisionRequest):
    with connect() as db:
        service.require(db, "sessions", identifier)
        if not db.execute("UPDATE sessions SET status='completed',revision=revision+1 WHERE id=? AND busy=0 AND revision=?", (identifier, body.revision)).rowcount:
            raise HTTPException(409, "面试状态已更新或正在处理，请刷新。")
    return get_session(identifier)

@router.put("/sessions/{identifier}/options")
def options(identifier: int, body: SessionOptions):
    with connect() as db:
        service.require(db, "sessions", identifier)
        if not db.execute("UPDATE sessions SET difficulty=?,revision=revision+1 WHERE id=? AND busy=0 AND status='active'", (body.difficulty, identifier)).rowcount:
            raise HTTPException(409, "面试正在处理或已结束。")
    return get_session(identifier)

@router.post("/sessions/{identifier}/claims/{index}/review")
def review(identifier: int, index: int, body: ReviewRequest):
    session = get_session(identifier)
    if index < 0 or index >= len(session["generation"]["output"]["claims"]):
        raise HTTPException(404, "声明不存在。")
    with connect() as db:
        # Persist human review separately; do not overwrite model history.
        if not db.execute("UPDATE sessions SET revision=revision+1 WHERE id=? AND busy=0", (identifier,)).rowcount:
            raise HTTPException(409, "请等待当前分析完成。")
        note = body.note
        if session["generation"]["input"]["privacy"]:
            candidate = service.require(db, "candidates", session["generation"]["candidate_id"])
            note = redact(note, candidate["name"])
        db.execute("INSERT INTO claim_reviews(session_id,claim_index,state,note) VALUES(?,?,?,?)", (identifier, index, body.state, note))
    return get_session(identifier)

@router.get("/sessions/{identifier}/report")
def report(identifier: int):
    session = get_session(identifier)
    gen = session["generation"]
    lines = ["# 面试证据报告", f"会话：{identifier} | 状态：{session['status']} | 已回答：{len(session['turns'])}/{session['budget']}", f"模型：{gen['input']['provider']} / {gen['input']['model']} | 提示词：{gen['input']['prompt_version']} | 提纲 #{gen['id']} | 简历 #{gen['resume_id']}", "模型分析仅为待复核线索；SUPPORTED 不代表经历已被外部证实。本报告不作录用决定。", "## 能力覆盖"]
    lines += [f"- {name}：{count} 轮" for name, count in session["coverage"].items()]
    lines += ["## 提纲选定的 Skill 快照"]
    lines += [f"- {s['id']} · {s['version']}" for s in gen["input"].get("skills", [])]
    if gen["output"].get("competitions"):
        lines += ["## 竞赛参考价值", "仅依据简历自述；未联网核实官方规则及获奖记录。不是绝对含金量评分。"]
        for item in gen["output"]["competitions"]:
            lines += [f"### {item['name']}", f"简历原文：{item['quote']}", f"届次 / 赛道：{item['edition_track']}", f"奖项层级：{item['award_level']}", f"赛制：{item['format']}", f"竞争强度：{item['selectivity']}", f"岗位相关性：{item['role_relevance']}", f"个人贡献：{item['contribution']}", f"参考价值：{item['reference_value']}", "待确认：" + "；".join(item['unknowns'])]
    lines += ["## 声明与原文"]
    for i, claim in enumerate(gen["output"]["claims"]):
        lines += [f"### 声明 {i+1}：{claim['statement']}", f"模型状态：{session['claim_states'].get(str(i), 'UNKNOWN')}", f"简历原文（字符 {claim['source']['start']}–{claim['source']['end']}）：", claim["quote"], f"待确认：{claim['verification']}"]
        for t in session["turns"]:
            for update in t["analysis"]["updates"]:
                if update["claim_index"] == i:
                    lines += [f"回答证据（记录 #{t['id']}）：{update['answer_quote']}", f"分析：{update['reason']}"]
        for item in session["reviews"]:
            if item["claim_index"] == i:
                lines += [f"人工复核：{item['state']} — {item['note']} ({item['created_at']})"]
    lines += ["## 待确认清单"]
    for flag in gen["output"]["verification_flags"]:
        lines += [f"- {flag['observation']} / 原文：{flag['quote']} / 核实：{flag['verify']}"]
    lines += ["## 面试记录"]
    for i, t in enumerate(session["turns"]):
        lines += [f"### 第 {i+1} 题（记录 #{t['id']}）", t["question"]["question"], "回答：", t["answer"], "模型观察：", t["analysis"]["observation"], "本轮引用：", t["analysis"]["answer_quote"]]
    return {"markdown": "\n\n".join(lines), "status": session["status"]}

@router.get("/sessions/{identifier}/report.md")
def download_report(identifier: int):
    return Response(report(identifier)["markdown"], media_type="text/markdown; charset=utf-8", headers={"Content-Disposition": f'attachment; filename="interview-{identifier}.md"'})
