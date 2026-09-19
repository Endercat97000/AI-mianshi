import { useEffect, useState } from 'react';
import { api, json, type Resume } from './api';

type Skill = { id: string; content: string; version: string };
type Question = { question: string; capability: string; resume_quote: string; reason: string; difficulty: string; kind?:'opening' };
type Claim = { statement: string; quote: string; capability: string; verification: string; source: {start: number; end: number} };
type Competition = {name:string;quote:string;edition_track:string;award_level:string;format:string;selectivity:string;role_relevance:string;contribution:string;reference_value:string;unknowns:string[];suggested_question:string;source_status:'resume_only'};
type Plan = { capabilities: {name: string; requirement_quote: string; reason: string}[]; resume_facts: {category: string; summary: string; quote: string}[]; claims: Claim[]; verification_flags: {observation: string; quote: string; verify: string}[]; questions: Question[]; competitions?:Competition[] };
type Snapshot = { provider: string; base_url: string; model: string; privacy: boolean; project: string; role: string; resume: string; skills: Skill[]; question_count: number };
type Preview = { input: Snapshot; preview_hash: string };
type Generation = { id: number; candidate_id:number; status: string; error: string; input: Snapshot; output: Plan | null; created_at: string };
type Summary = { id: number; status: string; error?: string; created_at: string };
type Update = {claim_index: number; state: string; answer_quote: string; reason: string};
type Turn = { id: number; question: Question; answer: string; analysis: {observation: string; answer_quote: string; updates: Update[]; follow_up: Question | null} };
type Session = { id: number; status: string; busy: number; budget: number; difficulty: string; revision: number; current: Question | null; claim_states: Record<string,string>; turns: Turn[]; generation: Generation; project_id: number; candidate:{id:number;name:string;role:string}; coverage: Record<string,number>; reviews: {claim_index: number; state: string; note: string; created_at: string}[] };
const statusLabel = (s: string) => ({pending:'生成中',completed:'已完成',failed:'失败',active:'进行中'}[s] || s);

export function useTask() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function run(action: () => Promise<void>) {
    setBusy(true); setError('');
    try { await action(); } catch(e) { setError(e instanceof Error ? e.message : '操作失败'); } finally { setBusy(false); }
  }
  return {busy,error,run};
}
export function Notice({error}: {error:string}) { return error ? <p role="alert" className="error">{error}</p> : null; }

async function downloadReport(sid: number, name?: string) {
  const resp = await fetch(`/api/sessions/${sid}/report.md`);
  if (!resp.ok) throw new Error('报告下载失败');
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `面试报告-${name||sid}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const skillNames: Record<string,string> = {'project-requirement':'从岗位描述提取重点','question-design':'怎么提问','roles-backend':'后端技术考点','competition-analysis':'竞赛经历怎么问'};

export function CandidateWorkflow({candidateId,resumes}: {candidateId:number;resumes:Resume[]}) {
  const [resumeId,setResumeId]=useState('');
  const [privacy,setPrivacy]=useState(true);
  const [opening,setOpening]=useState('introduction');
  const [skillIds,setSkillIds]=useState(['project-requirement','question-design']);
  const [skills,setSkills]=useState<Skill[]>([]);
  const [preview,setPreview]=useState<Preview|null>(null);
  const [generation,setGeneration]=useState<Generation|null>(null);
  const [history,setHistory]=useState<Summary[]>([]);
  const [sessions,setSessions]=useState<Summary[]>([]);
  const task=useTask();
  async function refresh() { const [g,s]=await Promise.all([api<Summary[]>(`/candidates/${candidateId}/generations`),api<Summary[]>(`/candidates/${candidateId}/sessions`)]);setHistory(g);setSessions(s); }
  useEffect(()=>{void task.run(async()=>{setSkills(await api('/skills'));await refresh();});},[candidateId]);
  // 有 pending 的生成任务时自动轮询
  useEffect(()=>{
    if (!history.some(h=>h.status==='pending')) return;
    const t=setInterval(()=>{void refresh();},3000);
    return ()=>clearInterval(t);
  },[history]);
  const chosen = resumeId || String(resumes[0]?.id || '');
  const body = {resume_id:Number(chosen),privacy,question_count:5,skill_ids:skillIds,interview_style:'focused'};
  function invalidate() {setPreview(null);}
  return <section className="workflow"><h3>开始面试</h3>
    {!resumes.length ? <p className="muted">上传并解析简历后可开始。</p> : <>
    <label>选择简历<select value={chosen} onChange={e=>{setResumeId(e.target.value);invalidate();}}>{resumes.map(r=><option key={r.id} value={r.id}>{r.original_name}</option>)}</select></label>
    <label className="check"><input type="checkbox" checked={privacy} onChange={e=>{setPrivacy(e.target.checked);invalidate();}}/>自动脱敏</label>
    <details><summary>出题规则（可选）</summary>{skills.filter(s=>s.id!=='example').map(s=><label key={s.id} className="check"><input type="checkbox" checked={skillIds.includes(s.id)} onChange={e=>{setSkillIds(prev=>e.target.checked?[...prev,s.id]:prev.filter(i=>i!==s.id));invalidate();}}/>{skillNames[s.id]||s.id}</label>)}</details>
    <button disabled={task.busy} onClick={()=>void task.run(async()=>setPreview(await api(`/candidates/${candidateId}/preview`,json('POST',body))))}>预览输入</button>
    {preview && <div className="text-panel"><h3>将发送给 {preview.input.provider} / {preview.input.model || '未配置模型'}</h3><details open><summary>需求与简历</summary><pre>{preview.input.project + '\n\n' + preview.input.role + '\n\n' + preview.input.resume}</pre></details>
    <button disabled={task.busy} onClick={()=>void task.run(async()=>{
      setHistory(prev=>[{id:0,status:'pending',created_at:new Date().toISOString()},...prev]);
      try {const g=await api<Generation>(`/candidates/${candidateId}/generations`,json('POST',{...body,preview_hash:preview.preview_hash}));setGeneration(g);setPreview(null);} finally {await refresh();}
    })}>{task.busy?'⏳ 正在调用模型生成提纲，请稍候（约10-30秒）…':'确认生成提纲'}</button></div>}
    </>}
    <Notice error={task.error}/>
    <h4>生成历史</h4>
    {!history.length && <p className="muted">暂无生成记录。</p>}
    {history.map(g=><div className="row history-row" key={g.id}><span>{statusLabel(g.status)} · {g.created_at}{g.error && <span className="error-inline"> {g.error}</span>}</span><button className="secondary" disabled={task.busy} onClick={()=>void task.run(async()=>setGeneration(await api(`/generations/${g.id}`)))}>查看提纲</button></div>)}
    {generation && <section className="text-panel"><div className="row"><h3>面试提纲</h3><button className="secondary" onClick={()=>setGeneration(null)}>收起</button></div>{generation.error && <Notice error={generation.error}/>}
    {generation.output && <><details><summary>查看问题列表（{generation.output.questions.length}）</summary>{generation.output.questions.map((q,i)=><p key={i}>{i+1}. {q.question}</p>)}</details>
    <label>开场问题<select value={opening} onChange={e=>setOpening(e.target.value)}><option value="introduction">轻松介绍</option><option value="recent">最近兴趣</option><option value="expectations">交流期待</option><option value="none">不开场</option></select></label>
    <button disabled={task.busy} onClick={()=>void task.run(async()=>{const s=await api<Session>('/sessions',json('POST',{generation_id:generation.id,budget:30,difficulty:'normal',opening}));location.hash=`/sessions/${s.id}`;})}>开始面试</button></>}</section>}
    <h4>历史面试</h4>{!sessions.length && <p className="muted">暂无。</p>}{sessions.map(s=><a className="session-link" key={s.id} href={`#/sessions/${s.id}`}>面试 #{s.id} · {statusLabel(s.status)} · {s.created_at} →</a>)}
  </section>;
}

/* ============================================================
   极简面试页：问题 → 回答 → 跳过/追问/手动
   ============================================================ */
export function InterviewPage({id}: {id:number}) {
  const [session,setSession]=useState<Session|null>(null);
  const [answer,setAnswer]=useState('');
  const task=useTask();
  const [showManual,setShowManual]=useState(false);
  const [mq,setMq]=useState('');
  const [ma,setMa]=useState('');
  const [manualNotes,setManualNotes]=useState<{q:string;a:string}[]>([]);
  const [showFollowUp,setShowFollowUp]=useState(false);
  const [customFq,setCustomFq]=useState('');
  const [hrNote,setHrNote]=useState(()=>localStorage.getItem('hr-note-'+id)||'');
  const [dlMsg,setDlMsg]=useState('');

  useEffect(()=>{void task.run(async()=>setSession(await api(`/sessions/${id}`)));},[id]);
  if(!session) return <><Notice error={task.error}/><p>加载面试…</p></>;
  const busy=task.busy||!!session.busy;
  const sid=session.id;
  const srev=session.revision;

  async function submitAnswer(text:string) {
    await task.run(async()=>{
      setSession(await api(`/sessions/${sid}/answers`,json('POST',{answer:text,revision:srev})));
      setAnswer('');
      setShowFollowUp(false);
    });
  }

  async function useQuestion(q: Question) {
    await task.run(async()=>{
      setSession(await api(`/sessions/${sid}/use-question`,json('POST',{question:q,revision:srev})));
      setShowFollowUp(false);
      setAnswer('');
    });
  }

  // 分析数据
  const caps = session.generation.output?.capabilities || [];
  const askedQuestions = new Set(session.turns.map(t=>t.question.question));
  const plannedQuestions = session.generation.output?.questions || [];
  const remainingPlanned = plannedQuestions.filter(q=>!askedQuestions.has(q.question) && q.question!==session.current?.question);
  const lastTurn = session.turns.at(-1);
  const aiFollowUp = lastTurn?.analysis.follow_up && !askedQuestions.has(lastTurn.analysis.follow_up!.question)
    ? lastTurn.analysis.follow_up : null;
  const overlap = caps.map(c=>({name:c.name, count:session.coverage[c.name]||0}));
  const coveredCount = overlap.filter(o=>o.count>0).length;

  function saveNote(v:string) {
    setHrNote(v);
    localStorage.setItem('hr-note-'+id, v);
  }

  return <>
    <div className="interview-topbar">
      <a href={`#/projects/${session.project_id}/candidates/${session.generation.candidate_id}`}>← 返回档案</a>
      <div className="who">
        <strong>{session.candidate?.name||'候选人'}</strong>
        <span className="muted">{session.candidate?.role} · {session.turns.length}/{session.budget} 轮 · {statusLabel(session.status)}</span>
      </div>
      {session.status==='active'
        ? <button className="secondary" disabled={busy}
            onClick={()=>{if(window.confirm('结束本次面试？'))void task.run(async()=>setSession(await api(`/sessions/${sid}/finish`,json('POST',{revision:session.revision}))));}}>结束面试</button>
        : <button className="secondary" disabled={!!dlMsg}
            onClick={async()=>{
              setDlMsg('正在下载…');
              try {
                await downloadReport(sid, session.candidate?.name);
                setDlMsg('✓ 已保存到系统「下载」文件夹');
                setTimeout(()=>setDlMsg(''), 4000);
              } catch { setDlMsg('下载失败，请重试'); setTimeout(()=>setDlMsg(''), 3000); }
            }}>{dlMsg||'下载报告'}</button>}
    </div>
    {dlMsg && dlMsg.includes('✓') && <p className="ok-msg">{dlMsg}</p>}

    <Notice error={task.error}/>

    {/* 面试分析板块 */}
    <section className="analysis-card">
      <div className="analysis-head">
        <span className="analysis-icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M3 3v18h18"/><path d="M7 14l4-4 4 3 5-6"/>
          </svg>
        </span>
        <strong>面试分析</strong>
        <span className="muted">{coveredCount}/{caps.length} 项能力已覆盖</span>
      </div>
      <div className="skill-overlap">
        {overlap.map((o,i)=>(
          <div key={i} className={'skill-chip '+(o.count>0?'hit':'miss')}>
            {o.count>0?'✓':'○'} {o.name}
            {o.count>0 && <span className="cnt">{o.count}轮</span>}
          </div>
        ))}
      </div>
      {lastTurn && (
        <details className="ai-suggest">
          <summary>AI 对上一轮的建议</summary>
          <p>{lastTurn.analysis.observation}</p>
          {aiFollowUp && <p className="muted">💡 推荐追问：{aiFollowUp.question}</p>}
        </details>
      )}
      <label className="hr-note">HR 备注
        <textarea value={hrNote} onChange={e=>saveNote(e.target.value)} rows={2}
          placeholder="随时记录你的判断、印象、顾虑…自动保存在本机。"/>
      </label>
    </section>

    {/* 当前问题 */}
    {session.status==='active' && session.current ? (
      <section className="interview-main">
        <div className="q-label">{session.current.kind==='opening'?'开场闲聊':'问题 ' + (session.turns.length+1)}</div>
        <h2 className="q-text">{session.current.question}</h2>
        <textarea className="answer-box" value={answer} onChange={e=>setAnswer(e.target.value)} rows={6} maxLength={15000}
          placeholder="记录候选人回答…" autoFocus/>
        <div className="action-row">
          <button disabled={busy||!answer.trim()} onClick={()=>void submitAnswer(answer)}>
            {busy?'分析中…':'✓ 保存回答'}
          </button>
          <button className="secondary" disabled={busy}
            onClick={()=>{if(answer.trim()&&!window.confirm('跳过会丢弃当前未提交的回答，继续？'))return;void submitAnswer('面试官选择跳过此题，未提问。');}}>
            ↷ 跳过此题
          </button>
          <button className="secondary" onClick={()=>setShowFollowUp(!showFollowUp)}>
            {showFollowUp?'收起追问':'💬 追问'}
          </button>
          <button className="secondary" onClick={()=>setShowManual(!showManual)}>
            {showManual?'收起':'+ 手动提问'}
          </button>
        </div>

        {showFollowUp && (
          <div className="text-panel followup-panel">
            <strong>基于刚才的回答，选一个继续问：</strong>
            {aiFollowUp && (
              <button className="followup-opt" disabled={busy} onClick={()=>void useQuestion(aiFollowUp)}>
                🤖 AI 推荐：{aiFollowUp.question}
              </button>
            )}
            {remainingPlanned.slice(0,3).map((q,i)=>(
              <button key={i} className="followup-opt" disabled={busy} onClick={()=>void useQuestion(q)}>
                📋 计划问题：{q.question}
              </button>
            ))}
            <div className="custom-followup">
              <input value={customFq} onChange={e=>setCustomFq(e.target.value)}
                placeholder="或自己输入一个追问…" onKeyDown={e=>{
                  if(e.key==='Enter' && customFq.trim()){
                    useQuestion({question:customFq,capability:'自定义追问',resume_quote:'',reason:'',difficulty:'normal'});
                    setCustomFq('');
                  }
                }}/>
              <button className="secondary" disabled={busy||!customFq.trim()}
                onClick={()=>{
                  useQuestion({question:customFq,capability:'自定义追问',resume_quote:'',reason:'',difficulty:'normal'});
                  setCustomFq('');
                }}>用这个问题</button>
            </div>
          </div>
        )}

        {showManual && (
          <div className="text-panel">
            <label>我想问的问题<input value={mq} onChange={e=>setMq(e.target.value)} placeholder="例如：你为什么想来我们团队？"/></label>
            <label>候选人回答<textarea value={ma} onChange={e=>setMa(e.target.value)} rows={3} placeholder="记录回答（仅本地保存）"/></label>
            <button className="secondary" disabled={!mq.trim()} onClick={()=>{
              setManualNotes(prev=>[...prev,{q:mq,a:ma}]);setMq('');setMa('');setShowManual(false);
            }}>保存手动问答</button>
          </div>
        )}
      </section>
    ) : (
      <section className="card">
        <h2>面试已结束</h2>
        <p className="muted">共 {session.turns.length} 轮。</p>
      </section>
    )}

    {/* 问答记录 */}
    {(session.turns.length>0 || manualNotes.length>0) && (
      <details className="card history-card" open>
        <summary>问答记录（{session.turns.length + manualNotes.length} 条）</summary>
        {session.turns.map((t,i)=>(
          <div key={t.id} className="history-item">
            <div className="hq">Q{i+1}. {t.question.question}</div>
            <div className="ha">A. {t.answer}</div>
          </div>
        ))}
        {manualNotes.map((n,i)=>(
          <div key={'m'+i} className="history-item manual">
            <div className="hq">Q{session.turns.length+i+1}. {n.q} <span className="tag">手动</span></div>
            <div className="ha">A. {n.a||'（未记录回答）'}</div>
          </div>
        ))}
      </details>
    )}
  </>;
}

export function SkillsPage() {
  const [skills,setSkills]=useState<Skill[]>([]);const task=useTask();
  const [showForm,setShowForm]=useState(false);
  const [newId,setNewId]=useState('');
  const [newDesc,setNewDesc]=useState('');
  const [newContent,setNewContent]=useState('');
  async function refresh() { setSkills(await api('/skills')); }
  useEffect(()=>{void task.run(async()=>{await refresh();});},[]);
  async function createSkill(e: React.FormEvent) {
    e.preventDefault();
    await task.run(async()=>{
      await api('/skills',json('POST',{id:newId,description:newDesc,content:newContent}));
      setNewId('');setNewDesc('');setNewContent('');setShowForm(false);
      await refresh();
    });
  }
  return <>
    <div className="row">
      <h1>出题规则</h1>
      <button onClick={()=>setShowForm(!showForm)}>{showForm?'收起':'+ 新建规则'}</button>
    </div>
    <p>AI 出题时参考的规则模板，本机只读。开始面试前可以选择启用哪些规则。</p>
    {showForm && (
      <form className="card" onSubmit={createSkill}>
        <h3>新建出题规则</h3>
        <label>规则标识（小写英文，如 frontend-react）<input value={newId} onChange={e=>setNewId(e.target.value)} placeholder="frontend-react" required/></label>
        <label>一句话说明<input value={newDesc} onChange={e=>setNewDesc(e.target.value)} placeholder="React 前端面试要问组件设计和状态管理" required/></label>
        <label>规则正文（写给 AI 看的要求）<textarea value={newContent} onChange={e=>setNewContent(e.target.value)} rows={8} placeholder={'例如：\n- 问组件生命周期时要追问实际场景\n- 不要问纯语法背诵\n- 关注性能优化和状态管理'} required/></label>
        <button disabled={task.busy}>{task.busy?'保存中…':'保存规则'}</button>
      </form>
    )}
    <Notice error={task.error}/>
    {skills.filter(s=>s.id!=='example').map(s=>(
      <details className="card" key={s.id}>
        <summary><strong>{skillNames[s.id]||s.id}</strong> <span className="muted">({s.id})</span></summary>
        <pre>{s.content}</pre>
      </details>
    ))}
  </>;
}
