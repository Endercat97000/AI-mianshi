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
      <h1>结构化面试<br/>从<span className="hl">简历</span>到<span className="hl">证据报告</span></h1>
      <p className="sub">
        准备提纲、记录回答、核对证据，都在同一个安静的工作台里完成。<br/>数据留在你的电脑上，面试的节奏始终由你掌握。
      </p>
      <div className="cta-row">
        <a className="cta" href="#/app">进入工作台</a>
        <a className="cta alt" href="#how">了解功能</a>
      </div>
      <a className="hero-shot reveal" href="#/app" aria-label="进入工作台查看完整界面">
        <img src="/shots/dashboard.png" alt="AI 面试工作台界面：简历上传、候选人与岗位管理一览" loading="eager" />
      </a>
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

    <section className="landing-section promo-band" id="product">
      <div className="section-inner">
        <div className="promo-grid">
          <article className="promo-tile reveal">
            <div className="promo-media is-resume">
              <img src="/shots/resume.png" alt="简历解析文本预览，手机号已自动脱敏" loading="lazy" />
            </div>
            <div className="promo-body">
              <h3>拖入简历，自动读懂候选人</h3>
              <p>本地解析 PDF、DOCX、TXT，提取文本、识别姓名与工作年限；手机号等敏感信息在调用模型前先脱敏。</p>
              <a className="text-link" href="#/app">上传一份简历 ›</a>
            </div>
          </article>
          <article className="promo-tile reveal" style={{ ['--i' as any]: 1 }}>
            <div className="promo-media is-rules">
              <img src="/shots/skills.png" alt="岗位出题规则模板内容" loading="lazy" />
            </div>
            <div className="promo-body">
              <h3>按岗位定制出题规则</h3>
              <p>把岗位考察点写成可复用的规则模板，AI 据此生成提纲与追问，问题始终围绕你真正在意的能力。</p>
              <a className="text-link" href="#/skills">查看出题规则 ›</a>
            </div>
          </article>
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
          <div className="feature reveal" style={{ ['--i' as any]: 0 }}>
            <div className="ico" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6M9 9h1"/></svg></div>
            <h3>简历本地解析</h3><p>PDF / DOCX / TXT 自动提取文本，识别姓名与工作年限。</p>
          </div>
          <div className="feature reveal" style={{ ['--i' as any]: 1 }}>
            <div className="ico" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 6.5 5.8 8.3 9 5"/><path d="M4 14.5 5.8 16.3 9 13"/><path d="M12.5 8H20M12.5 16H20"/></svg></div>
            <h3>提纲生成</h3><p>按能力要求生成问题、简历声明与待确认清单。</p>
          </div>
          <div className="feature reveal" style={{ ['--i' as any]: 2 }}>
            <div className="ico" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/><path d="m8.6 11 1.8 1.8 3.6-3.6"/></svg></div>
            <h3>回答引用分析</h3><p>模型定位回答原文，给出支持 / 矛盾 / 证据不足判断。</p>
          </div>
          <div className="feature reveal" style={{ ['--i' as any]: 3 }}>
            <div className="ico" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20"/><path d="M8 7.5h8M8 10.5h6"/></svg></div>
            <h3>出题规则</h3><p>AI 出题时参考的规则模板，可按岗位自行上传与扩展。</p>
          </div>
          <div className="feature reveal" style={{ ['--i' as any]: 4 }}>
            <div className="ico" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3l7 3v5c0 4.6-3 7.8-7 9-4-1.2-7-4.4-7-9V6z"/><path d="m9 11.5 2 2 4-4"/></svg></div>
            <h3>隐私脱敏</h3><p>姓名、手机、邮箱、身份证在发送前自动替换。</p>
          </div>
          <div className="feature reveal" style={{ ['--i' as any]: 5 }}>
            <div className="ico" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 4v16h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/></svg></div>
            <h3>证据报告</h3><p>原文、回答、人工复核分层标注，不混为“已核实事实”。</p>
          </div>
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
   苹果风自定义下拉（AppleSelect）
   - 闭合态：浅灰圆角触发器 + SF 风 chevron，聚焦蓝边光晕
   - 展开态：白色浮层菜单、轻投影、当前项对勾、淡入缩放
   - 键盘可达：Enter/Space/↑↓ 选择，Esc/Tab 收起；点击外部关闭
   ============================================================ */
type AppleSelectOption<T extends string | number> = { value: T; label: string; hint?: string };
function AppleSelect<T extends string | number>({ value, options, onChange, placeholder, disabled }: {
  value: T;
  options: AppleSelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const uid = React.useId();
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const selectedIndex = options.findIndex(o => o.value === value);
  const current = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  React.useEffect(() => {
    if (!open) return;
    setHi(selectedIndex >= 0 ? selectedIndex : 0);
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    rootRef.current?.querySelector<HTMLElement>(`[data-i="${hi}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [hi, open]);

  function choose(i: number) {
    const o = options[i];
    if (o) { onChange(o.value); setOpen(false); }
  }
  function onKey(e: React.KeyboardEvent) {
    if (!open) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); setOpen(true); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(options.length - 1, h + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(0, h - 1)); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(hi); }
    else if (e.key === 'Escape' || e.key === 'Tab') { setOpen(false); }
    else if (e.key === 'Home') { e.preventDefault(); setHi(0); }
    else if (e.key === 'End') { e.preventDefault(); setHi(options.length - 1); }
  }

  return (
    <div className={`apple-select${open ? ' is-open' : ''}`} ref={rootRef}>
      <button type="button" className="as-trigger" disabled={disabled}
        aria-haspopup="listbox" aria-expanded={open} aria-controls={`${uid}-menu`}
        aria-activedescendant={open ? `${uid}-opt-${hi}` : undefined}
        onClick={() => { if (!disabled) setOpen(o => !o); }} onKeyDown={onKey}>
        <span className={`as-value${current ? '' : ' is-ph'}`}>{current ? current.label : (placeholder || '请选择')}</span>
        <svg className="as-chevron" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open && (
        <div className="as-menu" id={`${uid}-menu`} role="listbox" tabIndex={-1}>
          {options.length === 0 && <div className="as-empty">暂无可选项</div>}
          {options.map((o, i) => (
            <button type="button" role="option" id={`${uid}-opt-${i}`} data-i={i} key={String(o.value)}
              aria-selected={o.value === value}
              className={`as-opt${o.value === value ? ' is-sel' : ''}${i === hi ? ' is-hi' : ''}`}
              onMouseEnter={() => setHi(i)} onClick={() => choose(i)}>
              <span className="as-opt-text">
                <span className="as-opt-label">{o.label}</span>
                {o.hint && <span className="as-opt-hint">{o.hint}</span>}
              </span>
              {o.value === value && <svg className="as-check" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.6 6.6 12 13 4.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
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
        <AppleSelect<number>
          value={projectId}
          placeholder="自动创建“简历导入”项目"
          options={projects.map(p => ({ value: p.id, label: p.title }))}
          onChange={setProjectId}
        />
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

  // 从日历跳转时带 ?date=YYYY-MM-DD，仅显示当天安排面试的候选人
  const readDate = () => new URLSearchParams(location.hash.split('?')[1] || '').get('date');
  const [dateFilter, setDateFilter] = useState<string | null>(readDate);
  useEffect(() => {
    const onHash = () => setDateFilter(readDate());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const visibleCandidates = dateFilter ? allCandidates.filter(c => c.interview_date === dateFilter) : allCandidates;
  const shownCount = dateFilter ? visibleCandidates.length : totalCandidates;

  return <>
    <div className="hero">
      <span className="eyebrow">工作台</span>
      <h1>今天评估哪几位候选人？</h1>
      <p>从项目 / JD 开始，导入简历、生成提纲、进行结构化面试，最终产出证据报告。</p>
    </div>

    <DashboardUpload onDone={refresh} />

    {dateFilter && <div className="cal-filter-bar">
      <span>正在查看 <strong>{prettyDate(dateFilter).text}（{prettyDate(dateFilter).weekday}）</strong> 的面试安排 · {visibleCandidates.length} 位候选人</span>
      <span className="cal-filter-actions">
        <a className="button-link" href="#/calendar">返回日历</a>
        <button type="button" className="secondary" onClick={() => { location.hash = '#/app'; }}>清除筛选</button>
      </span>
    </div>}

    <div className="stat-row">
      <div className="stat-card"><div className="num">{projects.length}</div><div className="lbl">项目 / 岗位</div></div>
      <div className="stat-card"><div className="num">{shownCount}</div><div className="lbl">{dateFilter ? '当天候选人' : '候选人'}</div></div>
      <div className="stat-card"><div className="num">100%</div><div className="lbl">本地存储</div></div>
    </div>

    <h2>{dateFilter ? '当天候选人' : '候选人'} <small>{visibleCandidates.length} 人{dateFilter ? ` · ${dateFilter}` : ''}</small></h2>
    {!busy && !visibleCandidates.length && <p className="muted">{dateFilter ? '这一天没有安排候选人，可到日历页把候选人安排到这一天。' : '还没有候选人，在上方上传一份简历即可自动创建。'}</p>}
    <div className="candidate-grid">
      {visibleCandidates.map(c => (
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

const ACCENTS = [
  { id: 'blue', name: '经典蓝' },
  { id: 'pink', name: '樱花粉' },
  { id: 'black', name: '神秘黑' },
  { id: 'gold', name: '香槟黄' },
] as const;
type AccentId = typeof ACCENTS[number]['id'];

function SettingsPage({ dark, onDark, accent, onAccent }: {
  dark: boolean; onDark: (v: boolean) => void; accent: AccentId; onAccent: (a: AccentId) => void;
}) {
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
    <section className="card">
      <h2>个性化外观</h2>
      <p className="appear-hint" style={{ marginBottom: 0 }}>选择浅色或深色模式，再挑一套主题强调色；按钮、链接与选中态会随之改变，偏好仅保存在本机。</p>
      <div className="appear-section">
        <p className="appear-label">外观模式</p>
        <div className="seg" role="tablist" aria-label="外观模式">
          <button type="button" role="tab" aria-selected={!dark} className={dark ? '' : 'is-active'} onClick={() => onDark(false)}>☀ 浅色</button>
          <button type="button" role="tab" aria-selected={dark} className={dark ? 'is-active' : ''} onClick={() => onDark(true)}>☾ 深色</button>
        </div>
      </div>
      <div className="appear-section">
        <p className="appear-label">主题强调色</p>
        <div className="theme-grid" role="radiogroup" aria-label="主题强调色">
          {ACCENTS.map(a => (
            <button type="button" role="radio" aria-checked={accent === a.id} key={a.id} data-t={a.id}
              className={'theme-swatch' + (accent === a.id ? ' is-active' : '')}
              onClick={() => onAccent(a.id)}>
              <span className="theme-dot"><span className="theme-glyph">✓</span></span>
              <span className="theme-name">{a.name}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
    {settings && <>
      <form className="card" onSubmit={e => { e.preventDefault(); setMessage(''); void run(async () => { const saved = await api<Settings>('/settings', json('PUT', { provider: settings.provider, base_url: settings.base_url, model: settings.model, api_key: clearKey ? '' : key || null })); setSettings(saved); setKey(''); setClearKey(false); setMessage('设置已保存。'); }); }}>
        <label>AI Provider
          <AppleSelect<string>
            value={settings.provider}
            options={(['openai', 'deepseek', 'openrouter', 'ollama', 'custom'] as const).map(p => ({
              value: p as string,
              label: ({ openai: 'OpenAI', deepseek: 'DeepSeek', openrouter: 'OpenRouter', ollama: 'Ollama', custom: 'Custom OpenAI-Compatible API' } as Record<string, string>)[p],
            }))}
            onChange={provider => setSettings({ ...settings, provider, base_url: provider === 'deepseek' ? 'https://api.deepseek.com' : provider === 'ollama' ? 'http://127.0.0.1:11434/v1' : settings.base_url, model: provider === 'deepseek' ? 'deepseek-flash' : provider === 'ollama' ? '' : settings.model })}
          />
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
   面试日历（#/calendar）
   月历标注每天安排的候选人；点某天可安排/移除，并跳转工作台按当天筛选
   ============================================================ */
const WEEK_CN = ['一', '二', '三', '四', '五', '六', '日'];
const pad2 = (n: number) => String(n).padStart(2, '0');
const keyOf = (y: number, m: number, d: number) => `${y}-${pad2(m + 1)}-${pad2(d)}`;
function todayKey() { const t = new Date(); return keyOf(t.getFullYear(), t.getMonth(), t.getDate()); }
function prettyDate(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  const wd = WEEK_CN[(new Date(y, m - 1, d).getDay() + 6) % 7];
  return { text: `${y} 年 ${m} 月 ${d} 日`, weekday: `周${wd}` };
}
type CalPerson = Candidate & { project_title?: string };
type CalCell = { y: number; m: number; d: number; key: string; inMonth: boolean };

function CalendarPage() {
  const now = new Date();
  const [projects, setProjects] = useState<Project[]>([]);
  const [people, setPeople] = useState<CalPerson[]>([]);
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [selected, setSelected] = useState(todayKey());
  const [addId, setAddId] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [projId, setProjId] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(now.getFullYear());
  const pickerRef = React.useRef<HTMLDivElement>(null);
  const { busy, error, run } = useAction();

  useEffect(() => { void run(async () => {
    const ps = await api<Project[]>('/projects');
    setProjects(ps);
    const all: CalPerson[] = [];
    await Promise.all(ps.map(async p => {
      try { (await api<Candidate[]>(`/projects/${p.id}/candidates`)).forEach(c => all.push({ ...c, project_title: p.title })); }
      catch { /* ignore project */ }
    }));
    setPeople(all.sort((a, b) => a.id - b.id));
  }); }, []);

  // 新建候选人时默认归属第一个岗位 / 项目
  useEffect(() => { if (projId === 0 && projects.length > 0) setProjId(projects[0].id); }, [projects, projId]);

  // 年月快选浮层：点击外部或按 Esc 关闭
  useEffect(() => {
    if (!pickerOpen) return;
    const onDown = (e: MouseEvent) => { if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPickerOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [pickerOpen]);

  async function schedule(c: CalPerson, date: string | null) {
    await run(async () => {
      const saved = await api<Candidate>(`/candidates/${c.id}`, json('PUT', {
        project_id: c.project_id, name: c.name, role: c.role, notes: c.notes ?? '', interview_date: date,
      }));
      setPeople(prev => prev.map(p => p.id === c.id ? { ...p, interview_date: saved.interview_date } : p));
    });
  }

  // 直接新建候选人并安排到当前选中日（无需先上传简历）
  async function createPerson(form: HTMLFormElement) {
    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    const role = String(data.get('role') || '').trim();
    const notes = String(data.get('notes') || '').trim();
    if (!name || !role || projId <= 0) return;
    await run(async () => {
      const created = await api<Candidate>('/candidates', json('POST', {
        project_id: projId, name, role, notes, interview_date: selected,
      }));
      setPeople(prev => [...prev, { ...created, project_title: projects.find(p => p.id === projId)?.title }]
        .sort((a, b) => a.id - b.id));
      form.reset();
      setShowCreate(false);
      setAddId(0);
    });
  }

  // 周一为一周起始，固定 6 行 × 7 列
  const firstOffset = (new Date(cursor.y, cursor.m, 1).getDay() + 6) % 7;
  const gridStart = new Date(cursor.y, cursor.m, 1 - firstOffset);
  const cells: CalCell[] = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart); d.setDate(gridStart.getDate() + i);
    return { y: d.getFullYear(), m: d.getMonth(), d: d.getDate(), key: keyOf(d.getFullYear(), d.getMonth(), d.getDate()), inMonth: d.getMonth() === cursor.m };
  });
  const byDate = useMemo(() => {
    const map: Record<string, CalPerson[]> = {};
    people.forEach(p => { if (p.interview_date) (map[p.interview_date] ||= []).push(p); });
    return map;
  }, [people]);
  const tKey = todayKey();
  const dayPeople = byDate[selected] || [];
  const unscheduled = people.filter(p => !p.interview_date);
  const sel = prettyDate(selected);

  function pick(cell: CalCell) {
    if (!cell.inMonth) setCursor({ y: cell.y, m: cell.m });
    setSelected(cell.key);
  }
  function shiftMonth(delta: number) {
    const d = new Date(cursor.y, cursor.m + delta, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  }

  return <>
    <div className="hero">
      <span className="eyebrow">面试日历</span>
      <h1>哪天面试谁，一目了然</h1>
      <p>把候选人安排到具体日期，日历上会直接标注；点击某一天即可查看、调整当天的面试名单。</p>
    </div>
    <ErrorMessage text={error} />

    <div className="calendar-layout">
      <div className="card cal-card">
        <div className="cal-toolbar">
          <div className="cal-title-wrap" ref={pickerRef}>
            <button type="button" className="cal-title-btn" aria-haspopup="dialog" aria-expanded={pickerOpen}
              onClick={() => { setPickerYear(cursor.y); setPickerOpen(o => !o); }}>
              {cursor.y} 年 {cursor.m + 1} 月
              <svg className="cal-title-caret" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            {pickerOpen && (
              <div className="cal-mpop" role="dialog" aria-label="快速选择月份">
                <div className="cal-mpop-head">
                  <button type="button" className="secondary" aria-label="上一年" onClick={() => setPickerYear(y => y - 1)}>‹</button>
                  <strong>{pickerYear} 年</strong>
                  <button type="button" className="secondary" aria-label="下一年" onClick={() => setPickerYear(y => y + 1)}>›</button>
                </div>
                <div className="cal-mpop-grid">
                  {Array.from({ length: 12 }, (_, m) => {
                    const isCur = cursor.y === pickerYear && cursor.m === m;
                    const isThisMonth = now.getFullYear() === pickerYear && now.getMonth() === m;
                    return <button type="button" key={m}
                      className={`cal-mpop-m${isCur ? ' is-cur' : ''}${isThisMonth && !isCur ? ' is-todaym' : ''}`}
                      onClick={() => { setCursor({ y: pickerYear, m }); setPickerOpen(false); }}>
                      {m + 1} 月
                    </button>;
                  })}
                </div>
              </div>
            )}
          </div>
          <div className="cal-nav">
            <button type="button" className="secondary" aria-label="上一月" onClick={() => shiftMonth(-1)}>‹</button>
            <button type="button" className="secondary" onClick={() => { const t = new Date(); setCursor({ y: t.getFullYear(), m: t.getMonth() }); setSelected(todayKey()); }}>今天</button>
            <button type="button" className="secondary" aria-label="下一月" onClick={() => shiftMonth(1)}>›</button>
          </div>
        </div>
        <div className="cal-weekdays">
          {WEEK_CN.map(w => <span key={w}>{w}</span>)}
        </div>
        <div className="cal-grid" role="grid" aria-busy={busy}>
          {cells.map(cell => {
            const list = byDate[cell.key] || [];
            return <button type="button" key={cell.key}
              className={`cal-cell${cell.inMonth ? '' : ' is-out'}${cell.key === selected ? ' is-selected' : ''}${cell.key === tKey ? ' is-today' : ''}`}
              onClick={() => pick(cell)}>
              <span className={`cal-num${cell.key === tKey ? ' today-dot' : ''}`}>{cell.d}</span>
              {list.length > 0 && <span className="cal-chips">
                {list.slice(0, 2).map(p => <span className="cal-chip" key={p.id}>{p.name}</span>)}
                {list.length > 2 && <span className="cal-more">+{list.length - 2}</span>}
              </span>}
              {list.length === 0 && <span className="cal-dot" />}
            </button>;
          })}
        </div>
      </div>

      <aside className="cal-side">
        <div className="card cal-day">
          <div className="cal-day-head">
            <div>
              <h3>{sel.text}</h3>
              <p className="muted">{sel.weekday} · {dayPeople.length} 人面试</p>
            </div>
          </div>

          {dayPeople.length === 0 && <p className="muted cal-empty">这一天还没有安排候选人。</p>}
          <div className="cal-day-list">
            {dayPeople.map(c => (
              <div className="cal-day-item" key={c.id}>
                <div className="avatar" aria-hidden="true">{c.name.slice(0, 1)}</div>
                <div className="cal-day-info">
                  <strong>{c.name}</strong>
                  <span className="muted">{c.role} · {c.project_title}</span>
                </div>
                <div className="cal-day-actions">
                  <a className="button-link" href={`#/projects/${c.project_id}/candidates/${c.id}`}>档案</a>
                  <button type="button" className="secondary" disabled={busy} onClick={() => void schedule(c, null)}>移除</button>
                </div>
              </div>
            ))}
          </div>

          <div className="cal-add">
            <p className="cal-add-label">安排已有候选人</p>
            <AppleSelect<number>
              value={addId}
              placeholder={people.length ? '选择候选人加到这一天…' : '还没有候选人，请在下方新建'}
              options={people.filter(p => p.interview_date !== selected).map(p => ({
                value: p.id,
                label: p.name,
                hint: p.interview_date
                  ? `${p.role} · 已安排 ${p.interview_date.slice(5).replace('-', '/')}`
                  : p.role,
              }))}
              onChange={id => {
                setAddId(0);
                const c = people.find(p => p.id === id);
                if (c) void schedule(c, selected);
              }}
            />
          </div>

          <div className="cal-create-wrap">
            {!showCreate ? (
              <button type="button" className="secondary cal-create-toggle" onClick={() => setShowCreate(true)}>
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                新建候选人并安排到当天
              </button>
            ) : (
              <form className="cal-create" onSubmit={e => { e.preventDefault(); void createPerson(e.currentTarget); }}>
                <p className="cal-add-label">新建候选人 · 安排到 {selected.slice(5).replace('-', '/')}</p>
                {projects.length === 0 ? (
                  <p className="muted cal-no-proj">还没有岗位 / 项目，请先<a href="#/new/jd">新建一个岗位</a>。</p>
                ) : <>
                  <label>姓名<input name="name" required maxLength={100} autoFocus placeholder="候选人姓名" /></label>
                  <label>应聘岗位<input name="role" required maxLength={200} placeholder="例如：高级后端工程师" /></label>
                  <div className="cal-field">
                    <span className="cal-field-label">归属岗位 / 项目</span>
                    <AppleSelect<number>
                      value={projId}
                      placeholder="选择归属岗位 / 项目"
                      options={projects.map(p => ({ value: p.id, label: p.title }))}
                      onChange={setProjId}
                    />
                  </div>
                  <label>备注（可选）<textarea name="notes" rows={2} maxLength={10000} placeholder="联系方式、面试形式或其他备注" /></label>
                  <div className="cal-create-actions">
                    <button type="button" className="secondary" onClick={() => setShowCreate(false)}>取消</button>
                    <button type="submit" disabled={busy || projId <= 0}>{busy ? '添加中…' : `添加到 ${selected.slice(5).replace('-', '/')}`}</button>
                  </div>
                </>}
              </form>
            )}
          </div>

          <a className="button-link primary-link cal-goto" href={`#/app?date=${selected}`}>在工作台查看当天候选人 →</a>
        </div>

        <div className="card cal-meta">
          <h3>待安排</h3>
          <p className="muted">{unscheduled.length === 0 ? '所有候选人都已安排面试日期。' : `${unscheduled.length} 位候选人尚未安排日期：${unscheduled.slice(0, 6).map(p => p.name).join('、')}${unscheduled.length > 6 ? ' 等' : ''}。`}</p>
        </div>
      </aside>
    </div>
  </>;
}

/* ============================================================
   应用外壳：根据路由决定是否显示侧边栏
   ============================================================ */
function App() {
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === 'dark');
  const [accent, setAccent] = useState<AccentId>(() => {
    let v: string | null = null;
    try { v = localStorage.getItem('ai-interview-accent'); } catch { /* ignore */ }
    return (ACCENTS.some(a => a.id === v) ? v : 'blue') as AccentId;
  });
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar-collapsed') === '1');
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    try { localStorage.setItem('ai-interview-theme', dark ? 'dark' : 'light'); } catch { /* ignore */ }
  }, [dark]);
  useEffect(() => {
    document.documentElement.dataset.accent = accent;
    try { localStorage.setItem('ai-interview-accent', accent); } catch { /* ignore */ }
  }, [accent]);

  const currentPath = () => (location.hash.slice(1) || '/').split('?')[0];
  const [route, setRoute] = useState(currentPath());
  useEffect(() => {
    const change = () => setRoute(currentPath());
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
    if (route === '/calendar') return ['面试日历', '按日期安排与查看'];
    if (route.startsWith('/new/project')) return ['新建项目', '定义项目需求'];
    if (route.startsWith('/new/jd')) return ['新建岗位', '撰写岗位 JD'];
    if (route === '/settings') return ['设置', '个性化 · 模型 · 备份'];
    if (route === '/skills') return ['出题规则', 'AI 出题时参考的规则模板'];
    if (sessionMatch) return ['面试', `第 ${sessionMatch[1]} 场`];
    if (candidateMatch) return ['候选人档案', `#${candidateMatch[2]}`];
    if (match) return ['项目 / 岗位', `#${match[1]}`];
    return ['AI 面试工作台', ''];
  })();

  const activeItem = route === '/app' || route.startsWith('/new/') ? 'home'
    : route === '/calendar' ? 'calendar'
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
          <a className={`nav-item ${activeItem === 'calendar' ? 'active' : ''}`} href="#/calendar">
            <span className="ico" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><path d="M7.5 13.5h2M12 13.5h2M16.5 13.5h2M7.5 17h2M12 17h2"/></svg></span> 面试日历
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
          : route === '/calendar' ? <CalendarPage />
          : route === '/new/project' ? <NewProject kind="project" />
          : route === '/new/jd' ? <NewProject kind="jd" />
          : route === '/settings' ? <SettingsPage dark={dark} onDark={setDark} accent={accent} onAccent={setAccent} />
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
