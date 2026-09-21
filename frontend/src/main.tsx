import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api, json, type Project, type Candidate, type Resume, type Settings } from './api';
import './style.css';
import './theme.css';
import { CandidateWorkflow, InterviewPage, SkillsPage } from './workflow';
import { BatchImport } from './BatchImport';

function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function run(action: () => Promise<void>) {
    setBusy(true); setError('');
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : '操作失败'); }
    finally { setBusy(false); }
  }
  return { busy, error, run };
}
function ErrorMessage({ text }: { text: string }) { return text ? <p role="alert" className="error">{text}</p> : null; }

/* ============================================================
   浮动像素背景（全局，fixed 全屏）
   ============================================================ */
const PIXELS: Array<{ left: string; top: string; size: number; color: string; dur: string; delay: string; drift: string; speed: number }> = [
  { left: '6%',  top: '18%', size: 10, color: 'var(--brand)',   dur: '14s', delay: '0s',    drift: '40px,-60px', speed: 0.15 },
  { left: '14%', top: '72%', size: 14, color: 'var(--accent)',  dur: '18s', delay: '-3s',   drift: '-50px,40px', speed: 0.08 },
  { left: '24%', top: '42%', size: 8,  color: 'var(--brand)',   dur: '11s', delay: '-6s',    drift: '30px,50px', speed: 0.22 },
  { left: '38%', top: '85%', size: 12, color: 'var(--ink)',     dur: '20s', delay: '-2s',    drift: '-40px,-30px', speed: 0.12 },
  { left: '48%', top: '12%', size: 8,  color: 'var(--accent)',  dur: '13s', delay: '-8s',    drift: '60px,30px', speed: 0.18 },
  { left: '58%', top: '60%', size: 16, color: 'var(--brand)',   dur: '16s', delay: '-5s',    drift: '-30px,60px', speed: 0.06 },
  { left: '68%', top: '28%', size: 10, color: 'var(--ink)',     dur: '12s', delay: '-1s',    drift: '40px,-40px', speed: 0.20 },
  { left: '76%', top: '78%', size: 12, color: 'var(--brand)',   dur: '19s', delay: '-7s',    drift: '-60px,-50px', speed: 0.10 },
  { left: '86%', top: '48%', size: 8,  color: 'var(--accent)',  dur: '15s', delay: '-4s',    drift: '50px,40px', speed: 0.25 },
  { left: '92%', top: '16%', size: 14, color: 'var(--brand)',   dur: '17s', delay: '-9s',    drift: '-40px,50px', speed: 0.14 },
  { left: '32%', top: '8%',  size: 10, color: 'var(--ink)',     dur: '13s', delay: '-10s',   drift: '30px,-50px', speed: 0.17 },
  { left: '82%', top: '88%', size: 8,  color: 'var(--brand)',   dur: '14s', delay: '-12s',   drift: '-30px,30px', speed: 0.11 },
];
function PixelField() {
  // 视差：滚动时每个像素块按自己的 speed 反向漂移
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        document.querySelectorAll<HTMLElement>('.pixel-field .px').forEach((el, i) => {
          const speed = PIXELS[i]?.speed ?? 0.1;
          el.style.translate = `0 ${-y * speed}px`;
        });
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, []);
  return <div className="pixel-field" aria-hidden="true">
    {PIXELS.map((p, i) => (
      <span key={i} className="px" style={{
        left: p.left, top: p.top,
        width: p.size, height: p.size,
        background: p.color,
        ['--drift' as any]: p.drift,
        animationDuration: p.dur,
        animationDelay: p.delay,
      }} />
    ))}
  </div>;
}

/* ============================================================
   落地页（#/，无侧边栏，复古粗野风格）
   ============================================================ */
function LandingPage({ dark, onToggleTheme }: { dark: boolean; onToggleTheme: () => void }) {
  // 官网式滚动渐入：元素进入视口后安静上浮
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('.reveal'));
    if (!('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('in')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    els.forEach(e => io.observe(e));
    return () => io.disconnect();
  }, []);

  return <div className="landing">
    <PixelField />
    <nav className="landing-nav">
      <a className="brand" href="#/">
        <div className="logo-mark" aria-hidden="true">面</div>
        <span>AI 面试工作台</span>
      </a>
      <div className="nav-links">
        <a href="#how">工作流程</a>
        <a href="#features">核心能力</a>
        <a href="#/app">工作台</a>
        <button className="secondary" onClick={onToggleTheme}>{dark ? '☀ 浅色' : '☾ 深色'}</button>
      </div>
    </nav>

    <section className="landing-hero">
      <span className="tag">LOCAL-FIRST · 2026</span>
      <h1>结构化面试<br/>从<span className="hl">简历</span>到<span className="hl">证据报告</span></h1>
      <p className="sub">
        以项目 / JD 为中心的本地面试辅助系统：导入简历、生成面试提纲、逐题记录与分析、产出可追溯的证据报告。
        所有数据留在本机，面试官掌握节奏。
      </p>
      <div className="cta-row">
        <a className="cta" href="#/app">进入工作台</a>
        <a className="cta alt" href="#how">了解功能</a>
      </div>
    </section>

    <section className="landing-section dark-band" id="how">
      <div className="section-inner">
        <div className="section-head reveal">
          <h2>五步，完成一场结构化面试</h2>
          <p>从岗位需求到证据报告，一条清晰、可追溯的面试流水线。</p>
        </div>
        <div className="steps">
          <div className="step reveal" style={{ ['--i' as any]: 0 }}><span className="num">01</span><h4>建项目 / JD</h4><p>描述项目需求或粘贴岗位 JD，明确考察方向。</p></div>
          <div className="step reveal" style={{ ['--i' as any]: 1 }}><span className="num">02</span><h4>导入简历</h4><p>批量上传 PDF/DOCX/TXT，一份文件对应一位候选人。</p></div>
          <div className="step reveal" style={{ ['--i' as any]: 2 }}><span className="num">03</span><h4>生成提纲</h4><p>基于简历与岗位知识，AI 输出问题、声明与待确认点。</p></div>
          <div className="step reveal" style={{ ['--i' as any]: 3 }}><span className="num">04</span><h4>进行面试</h4><p>逐题记录回答，模型给出引用与追问建议，面试官拍板。</p></div>
          <div className="step reveal" style={{ ['--i' as any]: 4 }}><span className="num">05</span><h4>证据报告</h4><p>汇总回答、人工复核与原文引用，导出 Markdown。</p></div>
        </div>
      </div>
    </section>

    <section className="landing-section feature-band" id="features">
      <div className="section-inner">
        <div className="section-head reveal">
          <h2>为面试官准备的核心能力</h2>
          <p>AI 负责整理与提示，判断与节奏始终在你手里。</p>
        </div>
        <div className="feature-grid">
          <div className="feature reveal" style={{ ['--i' as any]: 0 }}><div className="ico" aria-hidden="true">📄</div><h3>简历本地解析</h3><p>PDF / DOCX / TXT 自动提取文本，自动识别姓名与工作年限。</p></div>
          <div className="feature reveal" style={{ ['--i' as any]: 1 }}><div className="ico" aria-hidden="true">🎯</div><h3>提纲生成</h3><p>按能力要求生成问题、简历声明与待确认清单。</p></div>
          <div className="feature reveal" style={{ ['--i' as any]: 2 }}><div className="ico" aria-hidden="true">🔍</div><h3>回答引用分析</h3><p>模型定位回答原文，给出支持 / 矛盾 / 证据不足判断。</p></div>
          <div className="feature reveal" style={{ ['--i' as any]: 3 }}><div className="ico" aria-hidden="true">📚</div><h3>出题规则</h3><p>AI 出题时参考的规则模板，可按岗位自行上传与扩展。</p></div>
          <div className="feature reveal" style={{ ['--i' as any]: 4 }}><div className="ico" aria-hidden="true">🛡</div><h3>隐私脱敏</h3><p>姓名、手机、邮箱、身份证在发送前自动替换。</p></div>
          <div className="feature reveal" style={{ ['--i' as any]: 5 }}><div className="ico" aria-hidden="true">📊</div><h3>证据报告</h3><p>原文、回答、人工复核分层标注，不混为“已核实事实”。</p></div>
        </div>
      </div>
    </section>

    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-cols">
          <div>
            <h5>产品</h5>
            <a href="#/app">工作台</a>
            <a href="#/new/jd">新建岗位 / JD</a>
            <a href="#/skills">出题规则</a>
            <a href="#/settings">设置</a>
          </div>
          <div>
            <h5>面试流程</h5>
            <a href="#how">建项目 / JD</a>
            <a href="#how">导入简历</a>
            <a href="#how">生成提纲</a>
            <a href="#how">证据报告</a>
          </div>
          <div>
            <h5>能力</h5>
            <a href="#features">简历本地解析</a>
            <a href="#features">回答引用分析</a>
            <a href="#features">隐私脱敏</a>
            <a href="#features">证据报告</a>
          </div>
          <div>
            <h5>关于</h5>
            <span className="muted" style={{ fontSize: 12, display: 'block', padding: '3px 0' }}>本地优先部署</span>
            <span className="muted" style={{ fontSize: 12, display: 'block', padding: '3px 0' }}>数据不出本机</span>
            <span className="muted" style={{ fontSize: 12, display: 'block', padding: '3px 0' }}>面试官掌握节奏</span>
          </div>
        </div>
        <p className="footer-note">本地面试辅助系统：简历解析、提纲生成与回答分析均在你的设备上完成；调用模型前可开启自动脱敏。界面设计语言参考 Apple 官网，为独立第三方作品。</p>
        <div className="footer-bottom">
          <span>Copyright © 2026 AI 面试工作台. 保留所有权利。</span>
          <a href="#/settings">隐私</a>
          <a href="#/settings">使用条款</a>
          <span>LOCAL-FIRST · v0.1</span>
        </div>
      </div>
    </footer>
  </div>;
}

/* ============================================================
   工作台首页的智能上传入口（自动选项目，没项目自动建）
   ============================================================ */
function DashboardUpload({ onDone }: { onDone: () => void }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<number>(0);
  const [file, setFile] = useState<File | null>(null);
  const [role, setRole] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ name: string; years: string; fileName: string } | null>(null);

  async function refreshProjects(preferId?: number) {
    const list = await api<Project[]>('/projects');
    setProjects(list);
    if (preferId) setProjectId(preferId);
    else if (list.length && !projectId) setProjectId(list[0].id);
  }
  useEffect(() => { void (async () => { try { await refreshProjects(); } catch { /* ignore */ } })(); }, []);

  async function ensureProject(): Promise<number> {
    if (projectId) return projectId;
    const p = await api<Project>('/projects', json('POST', { kind: 'jd', title: '简历导入', description: '从工作台快速上传简历自动创建的默认项目。' }));
    await refreshProjects(p.id);
    return p.id;
  }

  async function start() {
    if (!file) return;
    setBusy(true); setError(''); setResult(null);
    try {
      const pid = await ensureProject();
      const tmpName = file.name.replace(/\.[^.]+$/, '').slice(0, 100) || '未命名';
      const data = new FormData();
      data.set('name', tmpName);
      data.set('role', role.trim() || '未指定岗位');
      data.set('file', file);
      const res = await api<{ candidate: Candidate; resume: Resume }>(`/projects/${pid}/import-candidate`, { method: 'POST', body: data });
      const text = res.resume.text || '';
      const guessed = guessResumeInfo(text);
      if (guessed.name || guessed.years) {
        await api(`/candidates/${res.candidate.id}`, json('PUT', {
          project_id: pid,
          name: guessed.name || tmpName,
          role: role.trim() || res.candidate.role,
          notes: guessed.years ? `自动识别工作年限：${guessed.years}` : '',
        }));
      }
      setResult({
        name: guessed.name || tmpName,
        years: guessed.years || '未识别到',
        fileName: file.name,
      });
      setFile(null);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : '上传失败');
    } finally { setBusy(false); }
  }

  return <div className="card upload-hero">
    <h3>⚡ 上传简历，自动识别姓名与工作年限</h3>
    <p className="muted">支持 PDF / DOCX / TXT，单文件最大 20 MB。系统本地解析后自动从简历文本里提取姓名和工作年限，预填到候选人档案。</p>
    <div className="grid">
      <label>目标项目
        <select value={projectId} onChange={e => setProjectId(Number(e.target.value))}>
          {projects.length === 0 && <option value={0}>（自动创建"简历导入"项目）</option>}
          {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
      </label>
      <label>应聘岗位（可选）
        <input value={role} maxLength={200} placeholder="例如：后端工程师" onChange={e => setRole(e.target.value)} />
      </label>
    </div>
    <label>选择简历文件
      <input type="file" accept=".pdf,.docx,.txt" disabled={busy} onChange={e => setFile(e.target.files?.[0] || null)} />
    </label>
    {file && <p>已选：<strong>{file.name}</strong>（{Math.ceil(file.size / 1024)} KB）</p>}
    {error && <p role="alert" className="error">{error}</p>}
    {result && <div className="text-panel">
      <strong>✓ 识别结果</strong>
      <p>姓名：<strong>{result.name}</strong></p>
      <p>工作年限：<strong>{result.years}</strong></p>
      <p className="muted">文件：{result.fileName}</p>
    </div>}
    <button disabled={busy || !file} onClick={() => void start()}>{busy ? '解析中…' : '上传并识别'}</button>
  </div>;
}

/* ============================================================
   工作台（#/app，带侧边栏）
   ============================================================ */
function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [candidateCounts, setCandidateCounts] = useState<Record<number, number>>({});
  const [allCandidates, setAllCandidates] = useState<(Candidate & { project_title?: string })[]>([]);
  const { busy, error, run } = useAction();
  async function refresh() {
    const list = await api<Project[]>('/projects');
    setProjects(list);
    const counts: Record<number, number> = {};
    const people: (Candidate & { project_title?: string })[] = [];
    await Promise.all(list.map(async p => {
      try {
        const cs = await api<Candidate[]>(`/projects/${p.id}/candidates`);
        counts[p.id] = cs.length;
        cs.forEach(c => people.push({ ...c, project_title: p.title }));
      } catch { counts[p.id] = 0; }
    }));
    setCandidateCounts(counts);
    setAllCandidates(people.sort((a, b) => b.id - a.id));
  }
  useEffect(() => { void run(refresh); }, []);
  const totalCandidates = Object.values(candidateCounts).reduce((a, b) => a + b, 0);

  return <>
    <div className="hero">
      <span className="eyebrow">工作台</span>
      <h1>今天评估哪几位候选人？</h1>
      <p>从项目 / JD 开始，导入简历、生成提纲、进行结构化面试，最终产出证据报告。</p>
    </div>

    <DashboardUpload onDone={refresh} />

    <div className="stat-row">
      <div className="stat-card"><div className="num">{projects.length}</div><div className="lbl">项目 / 岗位</div></div>
      <div className="stat-card"><div className="num">{totalCandidates}</div><div className="lbl">候选人</div></div>
      <div className="stat-card"><div className="num">100%</div><div className="lbl">本地存储</div></div>
    </div>

    <h2>候选人 <small>{allCandidates.length} 人</small></h2>
    {!busy && !allCandidates.length && <p className="muted">还没有候选人，在上方上传一份简历即可自动创建。</p>}
    <div className="candidate-grid">
      {allCandidates.map(c => (
        <article className="card candidate-tile" key={c.id}>
          <div className="avatar" aria-hidden="true">{c.name.slice(0, 1)}</div>
          <h3>{c.name}</h3>
          <p>{c.role}</p>
          <p className="muted">{c.project_title || ''}</p>
          <p className="muted">{c.resume_count || 0} 份简历 · {c.session_count || 0} 次面试</p>
          <a className="button-link primary-link" href={`#/projects/${c.project_id}/candidates/${c.id}`}>打开档案 →</a>
          {c.latest_session_id && <a className="session-link" style={{ marginTop: 8 }} href={`#/sessions/${c.latest_session_id}`}>{c.latest_session_status === 'active' ? '继续面试' : '查看最近面试'}</a>}
        </article>
      ))}
    </div>

    <h2>快速新建</h2>
    <a className="card entry" href="#/new/jd">
      <h2>+ 新建岗位 / JD →</h2>
      <p>保存岗位职责、技能要求与工作经验要求。</p>
    </a>

    <h2>项目 / 岗位</h2>
    <ErrorMessage text={error} />
    {busy && <p className="muted">加载中…</p>}
    {!busy && !error && !projects.length && <div className="card muted">还没有项目，可以先在上方上传一份简历。</div>}
    {projects.map(p => (
      <a className="card row" key={p.id} href={`#/projects/${p.id}`} style={{ justifyContent: 'space-between' }}>
        <div>
          <strong>{p.title}</strong>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
            {p.kind === 'project' ? '项目需求' : '岗位 / JD'} · {candidateCounts[p.id] || 0} 位候选人
          </div>
        </div>
        <span>打开 →</span>
      </a>
    ))}
  </>;
}

function NewProject({ kind }: { kind: 'project' | 'jd' }) {
  const { busy, error, run } = useAction();
  return <>
    <a href="#/app">← 返回工作台</a>
    <h1>{kind === 'project' ? '新建项目需求' : '新建岗位 / JD'}</h1>
    <form className="card" onSubmit={e => { e.preventDefault(); const data = new FormData(e.currentTarget); void run(async () => { const p = await api<Project>('/projects', json('POST', { kind, title: data.get('title'), description: data.get('description') })); location.hash = `/projects/${p.id}`; }); }}>
      <label>项目 / 岗位名称<input name="title" required maxLength={200} placeholder="例如：AI 面试系统开发" /></label>
      <label>{kind === 'project' ? '你希望候选人完成什么项目？' : '岗位职责与 JD'}<textarea name="description" required maxLength={50000} rows={8} placeholder={kind === 'project' ? '开发一个本地部署的 AI 面试系统，需要读取简历、调用大模型并动态生成问题。' : '请输入岗位职责、技能要求与工作经验要求。'} /></label>
      <p className="muted">先保存需求，随后添加候选人并生成面试提纲。</p>
      <ErrorMessage text={error} />
      <button disabled={busy}>{busy ? '保存中…' : '保存并管理候选人'}</button>
    </form>
  </>;
}

function CandidateCard({ candidate, onChange, onDelete }: { candidate: Candidate; onChange: (c: Candidate) => void; onDelete: (id: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [selected, setSelected] = useState<Resume | null>(null);
  const { busy, error, run } = useAction();
  const refresh = async () => setResumes(await api(`/candidates/${candidate.id}/resumes`));
  useEffect(() => { void run(refresh); }, [candidate.id]);
  return <article className="card">
    <div className="row" style={{ marginBottom: 10 }}>
      <div className="row" style={{ gap: 10 }}>
        <button className="secondary" disabled={busy} onClick={() => setEditing(!editing)}>编辑</button>
        <button className="secondary danger" disabled={busy} onClick={() => { if (window.confirm(`删除 ${candidate.name} 及其全部简历、提纲和面试记录？此操作不可撤销。`)) void run(async () => { const result = await api<{ warning: string }>(`/candidates/${candidate.id}`, { method: 'DELETE' }); if (result.warning) window.alert(result.warning); onDelete(candidate.id); }); }}>删除</button>
      </div>
    </div>
    {editing && <form onSubmit={e => { e.preventDefault(); const data = new FormData(e.currentTarget); void run(async () => { onChange(await api(`/candidates/${candidate.id}`, json('PUT', { project_id: candidate.project_id, name: data.get('name'), role: data.get('role'), notes: data.get('notes') }))); setEditing(false); }); }}>
      <label>姓名<input name="name" defaultValue={candidate.name} required maxLength={100} /></label>
      <label>岗位<input name="role" defaultValue={candidate.role} required maxLength={200} /></label>
      <label>备注<textarea name="notes" defaultValue={candidate.notes} maxLength={10000} /></label>
      <button disabled={busy}>保存修改</button>
    </form>}
    <h3>{candidate.name} <small>{candidate.role}</small></h3>
    {candidate.notes && <p className="preserve muted">{candidate.notes}</p>}
    <form onSubmit={e => { e.preventDefault(); const form = e.currentTarget; const data = new FormData(form); void run(async () => { const uploaded = await api<Resume>(`/candidates/${candidate.id}/resumes`, { method: 'POST', body: data }); await refresh(); setSelected(uploaded); form.reset(); }); }}>
      <label>给此人追加简历<input name="file" type="file" accept=".pdf,.docx,.txt" required /></label>
      <p className="muted">PDF、DOCX、TXT · 最大 20 MB · 在本地自动解析。新候选人请回工作台首页上传，不要在这里传。</p>
      <button disabled={busy}>{busy ? '处理中…' : '上传并解析'}</button>
    </form>
    <ErrorMessage text={error} />
    {resumes.map(r => <div className="row" key={r.id} style={{ padding: '10px 0', borderTop: '1px dashed var(--border)' }}>
      <span>{r.original_name}</span>
      <button className="secondary" disabled={busy} onClick={() => void run(async () => setSelected(await api(`/resumes/${r.id}`)))}>查看解析文本</button>
    </div>)}
    {selected && <section className="text-panel">
      <div className="row"><strong>{selected.original_name} · 解析文本</strong><button className="secondary" onClick={() => setSelected(null)}>收起</button></div>
      {selected.warning && <p role="status" className="muted">{selected.warning}</p>}
      <pre>{selected.text || '（没有可提取的文本）'}</pre>
    </section>}
    <CandidateWorkflow candidateId={candidate.id} resumes={resumes} />
  </article>;
}

/* ============================================================
   智能简历上传：上传后自动识别姓名 + 工作年限
   ============================================================ */
function guessResumeInfo(text: string): { name: string; years: string } {
  let name = '';
  const namePatterns = [
    /姓\s*名\s*[:：]\s*([一-龥·]{2,4})/,
    /^([一-龥·]{2,4})\s*$/m,
    /我是([一-龥·]{2,4})/,
    /([一-龥·]{2,4})\s*[—–-]\s*(?:应聘|求职|简历|个人)/,
  ];
  for (const p of namePatterns) {
    const m = text.match(p);
    if (m) { name = m[1]; break; }
  }

  let years = '';
  const yearPatterns = [
    /(\d{1,2})\s*年(?:\s*(?:以上|\+))?\s*(?:相关)?\s*(?:工作|开发|研发|从业|行业)?\s*经验/,
    /(\d{1,2})\s*年\s*(?:工作|开发|研发|从业)/,
    /(\d{1,2})\s*\+?\s*年经验/,
    /(\d{1,2})\s*年以上/,
  ];
  for (const p of yearPatterns) {
    const m = text.match(p);
    if (m) { const n = parseInt(m[1], 10); if (n >= 1 && n <= 50) { years = `${n} 年经验`; break; } }
  }

  // 从日期范围推算（如 2018.06-2022.07）
  if (!years) {
    const dates = text.match(/(?:19|20)\d{2}\s*[.\-/年]\s*\d{1,2}/g);
    if (dates && dates.length >= 2) {
      const nums = dates.map(d => parseInt(d.match(/(?:19|20)(\d{2})/)?.[1] || '0', 10));
      const span = Math.max(...nums) - Math.min(...nums);
      if (span >= 1 && span <= 40) years = `约 ${span} 年经验（按日期推算）`;
    }
  }
  return { name, years };
}

function SmartUpload({ projectId, onImported }: { projectId: number; onImported: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [role, setRole] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ name: string; years: string; fileName: string } | null>(null);

  async function start() {
    if (!file) return;
    setBusy(true); setError(''); setResult(null);
    try {
      // 先用文件名做临时姓名上传
      const tmpName = file.name.replace(/\.[^.]+$/, '').slice(0, 100) || '未命名';
      const data = new FormData();
      data.set('name', tmpName);
      data.set('role', role.trim() || '未指定岗位');
      data.set('file', file);
      const res = await api<{ candidate: Candidate; resume: Resume }>(`/projects/${projectId}/import-candidate`, { method: 'POST', body: data });
      const text = res.resume.text || '';
      const guessed = guessResumeInfo(text);
      // 如果识别到姓名，更新候选人
      if (guessed.name) {
        await api(`/candidates/${res.candidate.id}`, json('PUT', {
          project_id: projectId,
          name: guessed.name,
          role: role.trim() || res.candidate.role,
          notes: guessed.years ? `自动识别工作年限：${guessed.years}` : '',
        }));
      } else if (guessed.years) {
        await api(`/candidates/${res.candidate.id}`, json('PUT', {
          project_id: projectId,
          name: tmpName,
          role: role.trim() || res.candidate.role,
          notes: `自动识别工作年限：${guessed.years}`,
        }));
      }
      setResult({
        name: guessed.name || tmpName,
        years: guessed.years || '未识别到',
        fileName: file.name,
      });
      setFile(null);
      await onImported();
    } catch (e) {
      setError(e instanceof Error ? e.message : '上传失败');
    } finally {
      setBusy(false);
    }
  }

  return <details className="card" open>
    <summary>⚡ 智能上传简历 · 自动识别姓名与工作年限</summary>
    <p className="muted">上传 PDF / DOCX / TXT，系统自动从简历文本中识别姓名和工作年限，预填到候选人档案。识别不到时保留文件名作为姓名。</p>
    <label>应聘岗位（可选）
      <input value={role} maxLength={200} placeholder="例如：后端工程师" onChange={e => setRole(e.target.value)} />
    </label>
    <label>选择简历文件
      <input type="file" accept=".pdf,.docx,.txt" disabled={busy} onChange={e => setFile(e.target.files?.[0] || null)} />
    </label>
    <p className="muted">单文件最大 20 MB，只在本地解析。</p>
    {file && <p>已选：<strong>{file.name}</strong>（{Math.ceil(file.size / 1024)} KB）</p>}
    {error && <p role="alert" className="error">{error}</p>}
    {result && <div className="text-panel">
      <strong>识别结果：</strong>
      <p>姓名：<strong>{result.name}</strong></p>
      <p>工作年限：<strong>{result.years}</strong></p>
      <p className="muted">文件：{result.fileName} · 已创建候选人</p>
    </div>}
    <button disabled={busy || !file} onClick={() => void start()}>
      {busy ? '解析中…' : '上传并识别'}
    </button>
  </details>;
}

function ProjectPage({ id }: { id: number }) {
  const [project, setProject] = useState<Project | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [search, setSearch] = useState('');
  const refreshCandidates = async () => setCandidates(await api<Candidate[]>(`/projects/${id}/candidates`));
  const { busy, error, run } = useAction();
  useEffect(() => { void run(async () => { const [p, c] = await Promise.all([api<Project>(`/projects/${id}`), api<Candidate[]>(`/projects/${id}/candidates`)]); setProject(p); setCandidates(c); }); }, [id]);
  return <>
    <a href="#/app">← 返回工作台</a>
    <ErrorMessage text={error} />
    {!project ? <p className="muted">{busy ? '加载中…' : '无法加载项目。'}</p> : <>
      <div className="row">
        <h1>{project.title}</h1>
        <button className="danger" disabled={busy}
          onClick={()=>{
            if(window.confirm(`确定删除「${project.title}」吗？\n该岗位下的所有候选人、简历和面试记录都会被删除，且无法恢复。`)){
              void run(async()=>{
                await api(`/projects/${id}`,{method:'DELETE'});
                location.hash='#/app';
              });
            }
          }}>删除岗位</button>
      </div>
      <details><summary>查看项目 / 岗位要求</summary><p className="preserve">{project.description}</p></details>
      <SmartUpload projectId={id} onImported={refreshCandidates} />
      <BatchImport projectId={id} onImported={refreshCandidates} />
      <details><summary>+ 单独新建候选人</summary>
        <form className="card" onSubmit={e => { e.preventDefault(); const form = e.currentTarget; const d = new FormData(form); void run(async () => { const c = await api<Candidate>('/candidates', json('POST', { project_id: id, name: d.get('name'), role: d.get('role'), notes: d.get('notes') })); setCandidates(prev => [c, ...prev]); form.reset(); }); }}>
          <div className="grid"><label>候选人姓名<input name="name" required maxLength={100} /></label><label>应聘岗位<input name="role" required maxLength={200} /></label></div>
          <label>备注<textarea name="notes" rows={3} maxLength={10000} /></label>
          <button disabled={busy}>{busy ? '保存中…' : '创建候选人'}</button>
        </form>
      </details>
      <h2>候选人 <small>{candidates.length} 人</small></h2>
      <label style={{ marginBottom: 14 }}>查找候选人<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="姓名或岗位" /></label>
      <p className="muted">选择一位进入独立档案，简历、提纲和面试记录只显示这个人的内容。</p>
      {!candidates.length && <p className="muted">暂无候选人。可以批量导入简历，或单独新建。</p>}
      <div className="candidate-grid">
        {candidates.filter(c => `${c.name} ${c.role}`.toLowerCase().includes(search.toLowerCase())).map(c => (
          <article className="card candidate-tile" key={c.id}>
            <div className="avatar" aria-hidden="true">{c.name.slice(0, 1)}</div>
            <h3>{c.name}</h3>
            <p>{c.role}</p>
            <p className="muted">{c.resume_count || 0} 份简历 · {c.session_count || 0} 次面试</p>
            <a className="button-link primary-link" href={`#/projects/${id}/candidates/${c.id}`}>打开 →</a>
            {c.latest_session_id && <a className="session-link" style={{ marginTop: 8 }} href={`#/sessions/${c.latest_session_id}`}>{c.latest_session_status === 'active' ? '继续面试' : '查看最近面试'}</a>}
          </article>
        ))}
      </div>
    </>}
  </>;
}

function CandidatePage({ projectId, candidateId }: { projectId: number; candidateId: number }) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const { busy, error, run } = useAction();
  useEffect(() => { void run(async () => setCandidates(await api(`/projects/${projectId}/candidates`))); }, [projectId, candidateId]);
  const index = candidates.findIndex(c => c.id === candidateId);
  const person = candidates[index];
  return <>
    <a href={`#/projects/${projectId}`}>← 返回候选人列表</a>
    <ErrorMessage text={error} />
    {busy ? <p className="muted">加载候选人…</p> : person ? <>
      <div className="person-heading">
        <div>
          <span className="eyebrow">候选人 {index + 1} / {candidates.length}</span>
          <h1>{person.name}</h1>
          <p>{person.role}</p>
        </div>
        <nav aria-label="切换候选人">
          {index > 0 && <a className="button-link" href={`#/projects/${projectId}/candidates/${candidates[index - 1].id}`}>← 上一位</a>}
          {index < candidates.length - 1 && <a className="button-link" href={`#/projects/${projectId}/candidates/${candidates[index + 1].id}`}>下一位 →</a>}
        </nav>
      </div>
      <CandidateCard key={person.id} candidate={person} onChange={updated => setCandidates(prev => prev.map(c => c.id === updated.id ? updated : c))} onDelete={() => { location.hash = `/projects/${projectId}`; }} />
    </> : !error && <p className="muted">候选人不存在或不属于此项目。</p>}
  </>;
}

function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [key, setKey] = useState('');
  const [clearKey, setClearKey] = useState(false);
  const [message, setMessage] = useState('');
  const { busy, error, run } = useAction();
  useEffect(() => { void run(async () => setSettings(await api('/settings'))); }, []);
  return <>
    <h1>设置</h1>
    <p className="muted">保存模型配置后可测试连接。测试会发送一条不含候选人资料的短请求。</p>
    <ErrorMessage text={error} />
    {settings && <>
      <form className="card" onSubmit={e => { e.preventDefault(); setMessage(''); void run(async () => { const saved = await api<Settings>('/settings', json('PUT', { provider: settings.provider, base_url: settings.base_url, model: settings.model, api_key: clearKey ? '' : key || null })); setSettings(saved); setKey(''); setClearKey(false); setMessage('设置已保存。'); }); }}>
        <label>AI Provider
          <select value={settings.provider} onChange={e => { const provider = e.target.value; setSettings({ ...settings, provider, base_url: provider === 'deepseek' ? 'https://api.deepseek.com' : provider === 'ollama' ? 'http://127.0.0.1:11434/v1' : settings.base_url, model: provider === 'deepseek' ? 'deepseek-flash' : provider === 'ollama' ? '' : settings.model }); }}>
            {['openai', 'deepseek', 'openrouter', 'ollama', 'custom'].map(p => <option key={p} value={p}>{({ openai: 'OpenAI', deepseek: 'DeepSeek', openrouter: 'OpenRouter', ollama: 'Ollama', custom: 'Custom OpenAI-Compatible API' } as Record<string, string>)[p]}</option>)}
          </select>
        </label>
        <label>Base URL<input type="url" maxLength={2000} value={settings.base_url} placeholder="https://example.com/v1" onChange={e => setSettings({ ...settings, base_url: e.target.value })} /></label>
        <label>API Key<input type="password" autoComplete="new-password" maxLength={4000} disabled={clearKey} value={key} placeholder={settings.has_api_key ? '已保存；留空保留原密钥' : '可选，尚未保存'} onChange={e => setKey(e.target.value)} /></label>
        {settings.has_api_key && <label className="check"><input type="checkbox" checked={clearKey} onChange={e => setClearKey(e.target.checked)} />清除已保存的 API Key</label>}
        <label>Model<input maxLength={200} value={settings.model} onChange={e => setSettings({ ...settings, model: e.target.value })} /></label>
        <p className="muted">Windows 下 API Key 由当前系统用户的 DPAPI 加密保护；候选人资料仍在本机数据库，备份与分享前请注意内容。</p>
        <div className="row" style={{ alignItems: 'center' }}>
          <button disabled={busy}>{busy ? '保存中…' : '保存设置'}</button>
          <button className="secondary" type="button" disabled={busy} onClick={() => { setMessage(''); void run(async () => { const result = await api<{ message: string }>('/settings/test', { method: 'POST' }); setMessage(result.message); }); }}>测试连接</button>
        </div>
        <p role="status">{message}</p>
      </form>
      <section className="card">
        <h2>备份与恢复</h2>
        <p>先停止后端，在项目根目录执行备份命令。备份不包含 API Key。</p>
        <pre>{'.\\.venv\\Scripts\\python.exe scripts\\backup.py backup D:/backup/interview.zip'}</pre>
        <p>恢复到新目录，不覆盖原有数据：</p>
        <pre>{'.\\.venv\\Scripts\\python.exe scripts\\backup.py restore D:/backup/interview.zip --target D:/interview-restore'}</pre>
        <p>将 .env 的 AI_INTERVIEW_DATA_DIR 设置为恢复目录后重启，并重新填写 API Key。</p>
      </section>
    </>}
  </>;
}

/* ============================================================
   应用外壳：根据路由决定是否显示侧边栏
   ============================================================ */
function App() {
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === 'dark');
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar-collapsed') === '1');
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    try { localStorage.setItem('ai-interview-theme', dark ? 'dark' : 'light'); } catch { /* ignore */ }
  }, [dark]);

  const [route, setRoute] = useState(location.hash.slice(1) || '/');
  useEffect(() => {
    const change = () => setRoute(location.hash.slice(1) || '/');
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);

  const sessionMatch = route.match(/^\/sessions\/(\d+)$/);
  const match = route.match(/^\/projects\/(\d+)$/);
  const candidateMatch = route.match(/^\/projects\/(\d+)\/candidates\/(\d+)$/);

  // 首页 = 落地页，不带侧边栏
  if (route === '/' || route === '') {
    return <LandingPage dark={dark} onToggleTheme={() => setDark(!dark)} />;
  }

  const crumb = (() => {
    if (route === '/app') return ['工作台', '所有项目与候选人'];
    if (route.startsWith('/new/project')) return ['新建项目', '定义项目需求'];
    if (route.startsWith('/new/jd')) return ['新建岗位', '撰写岗位 JD'];
    if (route === '/settings') return ['设置', '模型与备份'];
    if (route === '/skills') return ['出题规则', 'AI 出题时参考的规则模板'];
    if (sessionMatch) return ['面试', `第 ${sessionMatch[1]} 场`];
    if (candidateMatch) return ['候选人档案', `#${candidateMatch[2]}`];
    if (match) return ['项目 / 岗位', `#${match[1]}`];
    return ['AI 面试工作台', ''];
  })();

  const activeItem = route === '/app' || route.startsWith('/new/') ? 'home'
    : route === '/skills' ? 'skills'
    : route === '/settings' ? 'settings'
    : 'home';

  return <div className={'app-shell' + (collapsed?' shell-collapsed':'')}>
    <PixelField />
    <aside className={'sidebar' + (collapsed?' collapsed':'')}>
      <div className="logo">
        <div className="logo-mark" aria-hidden="true">面</div>
        <div className="logo-text">
          <span className="name">AI 面试工作台</span>
          <span className="sub">INTERVIEW OS</span>
        </div>
        <button className="collapse-btn" onClick={()=>{const v=!collapsed;setCollapsed(v);localStorage.setItem('sidebar-collapsed',v?'1':'0');}} aria-label="收起/展开">
          {collapsed ? '▶' : '◀'}
        </button>
      </div>
      <nav className="side-nav" aria-label="主导航">
        <div className="nav-group">
          <div className="nav-group-title">工作区</div>
          <a className={`nav-item ${activeItem === 'home' ? 'active' : ''}`} href="#/app">
            <span className="ico" aria-hidden="true">▣</span> 工作台
          </a>
          <a className={`nav-item ${activeItem === 'skills' ? 'active' : ''}`} href="#/skills">
            <span className="ico" aria-hidden="true">✎</span> 出题规则
          </a>
        </div>
        <div className="nav-group">
          <div className="nav-group-title">新建</div>
          <a className="nav-item" href="#/new/jd"><span className="ico" aria-hidden="true">≡</span> 新建岗位</a>
        </div>
        <div className="nav-group">
          <div className="nav-group-title">系统</div>
          <a className={`nav-item ${activeItem === 'settings' ? 'active' : ''}`} href="#/settings">
            <span className="ico" aria-hidden="true">⚙</span> 设置
          </a>
        </div>
      </nav>
      <div className="sidebar-foot">LOCAL-FIRST · v0.1</div>
    </aside>

    <div className="main-area">
      <header className="topbar">
        <div className="crumb">{collapsed && <button className="expand-inline" onClick={()=>{setCollapsed(false);localStorage.setItem('sidebar-collapsed','0');}} aria-label="展开侧边栏">▶</button>}{crumb[0]}<small>{crumb[1]}</small></div>
        <nav>
          <button className="secondary" onClick={() => setDark(!dark)} aria-pressed={dark}>
            {dark ? '☀ 浅色' : '☾ 深色'}
          </button>
        </nav>
      </header>

      <main className="content" key={route}>
        {route === '/app' ? <Dashboard />
          : route === '/new/project' ? <NewProject kind="project" />
          : route === '/new/jd' ? <NewProject kind="jd" />
          : route === '/settings' ? <SettingsPage />
          : route === '/skills' ? <SkillsPage />
          : sessionMatch ? <InterviewPage id={Number(sessionMatch[1])} />
          : candidateMatch ? <CandidatePage projectId={Number(candidateMatch[1])} candidateId={Number(candidateMatch[2])} />
          : match ? <ProjectPage id={Number(match[1])} />
          : <p>页面不存在。<a href="#/app">返回工作台</a></p>}
      </main>

      <footer>本地面试辅助系统 · 数据不出本机 · 由面试官掌握节奏</footer>
    </div>
  </div>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
