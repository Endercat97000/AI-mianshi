import { useState } from 'react';
import { api, type Candidate, type Resume } from './api';

type Item = {file:File;name:string;state:'ready'|'running'|'done'|'failed';message:string;candidateId?:number};
export function BatchImport({projectId,onImported}:{projectId:number;onImported:()=>Promise<void>}) {
  const [items,setItems]=useState<Item[]>([]);
  const [role,setRole]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const update=(index:number,change:Partial<Item>)=>setItems(prev=>prev.map((item,i)=>i===index?{...item,...change}:item));
  async function start(){
    setBusy(true);setError('');
    try {
      for(let i=0;i<items.length;i++){
        const item=items[i];if(item.state==='done')continue;
        update(i,{state:'running',message:'正在本地解析…'});
        const data=new FormData();data.set('name',item.name.trim());data.set('role',role.trim());data.set('file',item.file);
        try {
          const result=await api<{candidate:Candidate;resume:Resume}>(`/projects/${projectId}/import-candidate`,{method:'POST',body:data});
          update(i,{state:'done',candidateId:result.candidate.id,message:result.resume.warning||'已创建候选人并保存简历'});
        } catch(e) {update(i,{state:'failed',message:e instanceof Error?e.message:'导入失败'});}
      }
      await onImported();
    } catch(e) {setError(e instanceof Error?e.message:'刷新列表失败，请刷新页面查看已导入人员。');}
    finally {setBusy(false);}
  }
  const remaining=items.filter(i=>i.state!=='done');
  return <details className="card"><summary>批量导入简历 · 一份文件对应一位候选人</summary>
    <p className="muted">先确认姓名和共同应聘岗位，再开始导入。文件名仅用作姓名初稿，不会自动识别人名；同一个人的其他版本请进入其档案上传。</p>
    <label>共同应聘岗位<input disabled={busy} value={role} maxLength={200} placeholder="例如：Python 后端工程师" onChange={e=>setRole(e.target.value)}/></label>
    <label>选择多份简历<input type="file" multiple accept=".pdf,.docx,.txt" disabled={busy} onChange={e=>{
      const files=Array.from(e.target.files||[]);setError('');
      if(files.length>20){setError('每批最多 20 份，请分批导入。');e.target.value='';return;}
      setItems(files.map(file=>({file,name:file.name.replace(/\.[^.]+$/,'').slice(0,100),state:'ready',message:''})));
    }}/></label><p className="muted">PDF / DOCX / TXT，每份最多 20 MB。只做本地解析，不调用模型。导入时请留在本页。</p>
    {!!items.length && <p role="status">已导入 {items.filter(i=>i.state==='done').length} / {items.length} 份 · 失败 {items.filter(i=>i.state==='failed').length} 份</p>}
    {items.map((item,i)=><div className="import-row" key={`${item.file.name}-${i}`}>
      <span>{item.file.name}<small> {Math.ceil(item.file.size/1024)} KB</small></span>
      <label>姓名 · 第 {i+1} 份<input value={item.name} maxLength={100} disabled={busy||item.state==='done'} onChange={e=>update(i,{name:e.target.value})}/></label>
      <p className={item.state==='failed'?'error':'muted'}>{item.message||'待导入'}{item.candidateId && <> · <a href={`#/projects/${projectId}/candidates/${item.candidateId}`}>打开候选人</a></>}</p>
    </div>)}
    {error && <p role="alert" className="error">{error}</p>}
    {items.some(i=>i.state==='failed') && <p className="muted">如果提示连接中断，请先检查下方候选人列表，确认该文件未成功导入后再重试。</p>}
    <button disabled={busy||!remaining.length||!role.trim()||remaining.some(i=>!i.name.trim())} onClick={()=>void start()}>{busy?'正在逐份导入…':items.some(i=>i.state==='done')?'重试未成功的文件':'确认姓名并导入'}</button>
  </details>;
}
