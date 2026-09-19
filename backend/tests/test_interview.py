import asyncio
import json
import os
import sqlite3
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient
from backend.tests.test_api import client, create_candidate
from backend import interview_service as service
from backend.providers.base import ProviderConfig, Message
from backend.providers.openai_compatible import OpenAICompatibleProvider, ProviderError, endpoint

RESUME = "张三 13800138000 test@example.com\n负责 Python 接口开发，使用 SQLite 保存记录。"
QUOTE = "负责 Python 接口开发，使用 SQLite 保存记录。"

def plan_data(count=2):
    return {"capabilities":[{"name":"Python", "requirement_quote":"开发系统", "reason":"需要实现接口"}],
      "resume_facts":[{"category":"project", "summary":"实现接口", "quote":QUOTE}],
      "claims":[{"statement":"实现 Python 接口", "quote":QUOTE, "capability":"Python", "verification":"确认本人职责"}],
      "verification_flags":[{"observation":"职责范围待确认", "quote":QUOTE, "verify":"询问独立完成的部分"}],
      "questions":[{"question":f"问题 {i+1}：请说明接口实现细节？", "capability":"Python", "resume_quote":QUOTE, "reason":"确认实现经验", "difficulty":"normal"} for i in range(count)]}

class FakeProvider:
    async def generate(self, messages):
        if len(messages) == 1:
            return "OK"
        data = json.loads(messages[-1].content)
        if "current_question" not in data:
            return json.dumps(plan_data(data["question_count"]), ensure_ascii=False)
        return json.dumps({"observation":"回答描述了实现方式，仍需结合代码核实。", "answer_quote":data["answer"],
          "updates":[{"claim_index":0,"state":"PARTIALLY_SUPPORTED","answer_quote":data["answer"],"reason":"提供了实现细节"}],
          "follow_up": None}, ensure_ascii=False)

def test_competition_quotes_and_opt_in():
    from backend.interview_models import Plan
    result = plan_data()
    result['competitions'] = [{
        'name':'虚构赛事','quote':QUOTE,'edition_track':'未知','award_level':'未知',
        'format':'未知','selectivity':'未知，待查官方规则','role_relevance':'接口能力待确认',
        'contribution':'简历自述','reference_value':'有限补充','unknowns':['缺少当届规则'],
        'suggested_question':'本人做了哪部分？','source_status':'resume_only'}]
    payload = {'project':'开发系统','resume':RESUME,'question_count':2,'skills':[]}
    with pytest.raises(ValueError, match='未选择'):
        service.validate_plan(Plan.model_validate(result), payload)
    payload['skills'] = [{'id':'competition-analysis'}]
    parsed = service.validate_plan(Plan.model_validate(result), payload)
    source = parsed['competitions'][0]['source']
    assert RESUME[source['start']:source['end']] == QUOTE
    result['competitions'][0]['quote'] = '捏造的获奖经历'
    with pytest.raises(ValueError, match='competitions'):
        service.validate_plan(Plan.model_validate(result), payload)

def test_answer_receives_pinned_skill_snapshot(monkeypatch):
    pinned = [{'id':'competition-analysis','version':'old-version','content':'当时的规则'}]
    class CapturingProvider(FakeProvider):
        async def generate(self, messages):
            context = json.loads(messages[-1].content)
            assert context['skills'] == pinned
            assert context['competitions'] == []
            return await super().generate(messages)
    monkeypatch.setattr(service,'provider_for',lambda _:CapturingProvider())
    plan = plan_data()
    result = asyncio.run(service.analyze_answer(plan,{'project':'开发系统','resume':RESUME,'skills':pinned},plan['questions'][0],[],'我完成接口','normal',None))
    assert result['answer_quote'] == '我完成接口'

@pytest.mark.parametrize('repair',[True,False])
def test_analysis_quote_repair_has_bound_and_resume_context(monkeypatch,repair):
    calls=[]
    class RepairProvider:
        async def generate(self,messages):
            calls.append(len(messages))
            assert json.loads(messages[1].content)['resume']==RESUME
            return json.dumps({'observation':'提供了一些线索','answer_quote':'我完成接口','updates':[],
                'follow_up':{'question':'你会先测试哪一步？','capability':'Python','resume_quote':QUOTE if repair and len(calls)==2 else '错误的简历引文','reason':'讨论测试思路','difficulty':'normal'}},ensure_ascii=False)
    monkeypatch.setattr(service,'provider_for',lambda _:RepairProvider())
    plan=plan_data()
    job=service.analyze_answer(plan,{'project':'开发系统','resume':RESUME},plan['questions'][0],[],'我完成接口','normal',None)
    if repair:
        assert asyncio.run(job)['follow_up']['resume_quote']==QUOTE
    else:
        with pytest.raises(ValueError,match='连续子串'):asyncio.run(job)
    assert calls==[2,4]

@pytest.fixture
def prepared(client, monkeypatch):
    monkeypatch.setattr(service,"provider_for",lambda config: FakeProvider())
    candidate_id=create_candidate(client)
    response=client.post(f"/api/candidates/{candidate_id}/resumes", files={"file":("resume.txt",RESUME.encode())})
    assert response.status_code==201
    client.put("/api/settings",json={"provider":"deepseek","base_url":"https://api.deepseek.com","model":"deepseek-flash","api_key":"fake-test-key"})
    body={"resume_id":response.json()["id"],"privacy":True,"question_count":2}
    return client,candidate_id,body

def make_plan(prepared):
    c,cid,body=prepared
    preview=c.post(f"/api/candidates/{cid}/preview",json=body)
    assert preview.status_code==200,preview.text
    result=c.post(f"/api/candidates/{cid}/generations",json={**body,"preview_hash":preview.json()["preview_hash"]})
    assert result.status_code==201,result.text
    return result.json()

def test_competition_persists_into_session_and_report(prepared, monkeypatch):
    c,cid,body = prepared
    award = '2022 年虚构校园赛校级团队二等奖。'
    uploaded = c.post(f'/api/candidates/{cid}/resumes',files={'file':('competition.txt',(RESUME+'\n'+award).encode())})
    body.update(resume_id=uploaded.json()['id'],skill_ids=['competition-analysis'])
    class CompetitionProvider(FakeProvider):
        async def generate(self,messages):
            output = plan_data()
            output['competitions'] = [{'name':'虚构校园赛','quote':award,'edition_track':'2022 年，赛道未知','award_level':'校级团队二等奖','format':'团队赛','selectivity':'未知','role_relevance':'需结合项目判断','contribution':'未知','reference_value':'有限补充','unknowns':['缺少官方规则'],'suggested_question':'','source_status':'resume_only'}]
            return json.dumps(output,ensure_ascii=False)
    monkeypatch.setattr(service,'provider_for',lambda _:CompetitionProvider())
    gen = make_plan(prepared)
    session = c.post('/api/sessions',json={'generation_id':gen['id'],'budget':1}).json()
    saved = c.get(f"/api/sessions/{session['id']}").json()
    assert saved['generation']['output']['competitions'][0]['source_status'] == 'resume_only'
    report = c.get(f"/api/sessions/{session['id']}/report.md").text
    assert award in report and '竞赛参考价值' in report and '未联网核实' in report

def test_unrelated_round_does_not_erase_earlier_evidence(prepared, monkeypatch):
    c,cid,body = prepared
    gen = make_plan(prepared)
    class RoundProvider(FakeProvider):
        async def generate(self,messages):
            data = json.loads(messages[-1].content)
            output = json.loads(await super().generate(messages))
            output['updates'][0]['state'] = 'UNKNOWN' if data['history'] else 'SUPPORTED'
            return json.dumps(output,ensure_ascii=False)
    monkeypatch.setattr(service,'provider_for',lambda _:RoundProvider())
    session = c.post('/api/sessions',json={'generation_id':gen['id'],'budget':2}).json()
    sid = session['id']
    first = c.post(f'/api/sessions/{sid}/answers',json={'answer':'我实现了接口','revision':0}).json()
    second = c.post(f'/api/sessions/{sid}/answers',json={'answer':'本轮谈其他话题','revision':first['revision']}).json()
    assert second['claim_states']['0'] == 'SUPPORTED'
    assert c.get(f'/api/sessions/{sid}').json()['claim_states']['0'] == 'SUPPORTED'
    # Preserve the model's original round output; only cumulative display changes.
    assert second['turns'][1]['analysis']['updates'][0]['state'] == 'UNKNOWN'
    assert '模型状态：SUPPORTED' in c.get(f'/api/sessions/{sid}/report.md').text
    states = {'0':'SUPPORTED'}
    service.merge_claim_updates(states,[{'claim_index':0,'state':'CONTRADICTED'}])
    assert states['0'] == 'CONTRADICTED'

def test_opening_is_recorded_without_ai_or_skill_judgment(prepared, monkeypatch):
    c,cid,body=prepared;gen=make_plan(prepared)
    def forbidden(config):
        raise AssertionError('常规开场不能调用模型')
    monkeypatch.setattr(service,'provider_for',forbidden)
    session=c.post('/api/sessions',json={'generation_id':gen['id'],'budget':3,'opening':'introduction'}).json()
    assert session['current']['kind']=='opening'
    assert session['candidate']['name']=='张三'
    assert set(session['claim_states'].values())=={'UNKNOWN'}
    sid=session['id']
    result=c.post(f'/api/sessions/{sid}/answers',json={'answer':'最近喜欢读书。','revision':0})
    assert result.status_code==200,result.text
    session=result.json()
    assert session['turns'][0]['analysis']['updates']==[]
    assert session['turns'][0]['analysis']['follow_up'] is None
    assert session['current']['question']==gen['output']['questions'][0]['question']
    assert sum(session['coverage'].values())==0
    class CheckHistory(FakeProvider):
        async def generate(self,messages):
            context=json.loads(messages[-1].content)
            assert context['history']==[]
            assert '最近喜欢读书' not in messages[-1].content
            return await super().generate(messages)
    monkeypatch.setattr(service,'provider_for',lambda _:CheckHistory())
    assert c.post(f'/api/sessions/{sid}/answers',json={'answer':'我实现接口','revision':session['revision']}).status_code==200
    assert '最近喜欢读书。' in c.get(f'/api/sessions/{sid}/report.md').text

def test_full_interview_report_and_delete(prepared):
    c,cid,body=prepared
    preview=c.post(f"/api/candidates/{cid}/preview",json=body).json()
    assert "13800138000" not in preview["input"]["resume"]
    assert "test@example.com" not in preview["input"]["resume"]
    assert "张三" not in preview["input"]["resume"]
    assert "api_key" not in json.dumps(preview)
    assert c.post("/api/settings/test").status_code==200
    generation=make_plan(prepared)
    assert generation["output"]["claims"][0]["source"]["end"] > 0
    session=c.post("/api/sessions",json={"generation_id":generation["id"],"budget":2}).json()
    sid=session['id']
    response=c.post(f"/api/sessions/{sid}/answers",json={"answer":"我编写了接口与事务。", "revision":0})
    assert response.status_code==200,response.text
    session=response.json()
    assert session['status']=='active' and len(session['turns'])==1
    assert c.post(f"/api/sessions/{sid}/answers",json={"answer":"重复提交", "revision":0}).status_code==409
    response=c.post(f"/api/sessions/{sid}/answers",json={"answer":"我使用事务处理并发。", "revision":session['revision']})
    assert response.status_code==200,response.text
    session=response.json()
    assert session['status']=='completed' and len(session['turns'])==2
    assert session['claim_states']['0']=='PARTIALLY_SUPPORTED'
    assert session['coverage']['Python']==2
    review=c.post(f"/api/sessions/{sid}/claims/0/review",json={'state':'INSUFFICIENT_EVIDENCE','note':'请提供可运行的示例代码'})
    assert review.status_code==200
    report=c.get(f"/api/sessions/{sid}/report.md")
    assert report.status_code==200 and QUOTE in report.text and '示例代码' in report.text
    assert '我编写了接口与事务。' in report.text
    assert c.get(f"/api/candidates/{cid}/sessions").json()[0]['id']==sid
    edited=c.put(f"/api/candidates/{cid}",json={'project_id':1,'name':'李四','role':'后端','notes':'updated'})
    assert edited.status_code==200
    assert c.delete(f"/api/candidates/{cid}").status_code==200
    assert c.get(f"/api/sessions/{sid}").status_code==404
    from backend import database
    assert list((database.DATA_DIR/'resumes').iterdir())==[]

def test_stale_preview_failure_history_and_originals(prepared,monkeypatch):
    c,cid,body=prepared
    preview=c.post(f"/api/candidates/{cid}/preview",json=body).json()
    changed={**body,'question_count':1,'preview_hash':preview['preview_hash']}
    assert c.post(f"/api/candidates/{cid}/generations",json=changed).status_code==409
    class BadProvider:
        async def generate(self,messages):
            result=plan_data();result['claims'][0]['quote']='不在原文中的内容'
            return json.dumps(result)
    monkeypatch.setattr(service,'provider_for',lambda config:BadProvider())
    bad=c.post(f"/api/candidates/{cid}/generations",json={**body,'preview_hash':preview['preview_hash']})
    assert bad.status_code==502
    history=c.get(f"/api/candidates/{cid}/generations").json()
    assert history[0]['status']=='failed'
    assert c.get(f"/api/resumes/{body['resume_id']}").json()['text']==RESUME
    assert 'fake-test-key' not in bad.text

def test_answer_failure_preserves_session(prepared,monkeypatch):
    c,cid,body=prepared;generation=make_plan(prepared)
    session=c.post('/api/sessions',json={'generation_id':generation['id']}).json();sid=session['id']
    class TimeoutProvider:
        async def generate(self,messages):raise ProviderError('模型请求超时','timeout')
    monkeypatch.setattr(service,'provider_for',lambda config:TimeoutProvider())
    assert c.post(f'/api/sessions/{sid}/answers',json={'answer':'回答','revision':0}).status_code==502
    state=c.get(f'/api/sessions/{sid}').json()
    assert state['busy']==0 and state['revision']==0 and state['turns']==[]
    assert c.post(f'/api/sessions/{sid}/finish',json={'revision':0}).status_code==200

def test_concurrent_requests_rejected(prepared,monkeypatch):
    c,cid,body=prepared;generation=make_plan(prepared)
    sid=c.post('/api/sessions',json={'generation_id':generation['id']}).json()['id']
    started=threading.Event();release=threading.Event()
    class SlowProvider(FakeProvider):
        async def generate(self,messages):
            started.set()
            await asyncio.to_thread(release.wait, 8)
            return await super().generate(messages)
    monkeypatch.setattr(service,'provider_for',lambda config:SlowProvider())
    with ThreadPoolExecutor() as pool:
        first=pool.submit(c.post,f'/api/sessions/{sid}/answers',json={'answer':'事务处理','revision':0})
        assert started.wait(5)
        try:
            assert c.post(f'/api/sessions/{sid}/answers',json={'answer':'重复','revision':0}).status_code==409
            assert c.post(f'/api/sessions/{sid}/finish',json={'revision':0}).status_code==409
            assert c.delete(f'/api/candidates/{cid}').status_code==409
        finally:release.set()
        assert first.result(timeout=8).status_code==200

def test_schema_origin_and_skills(prepared):
    c,cid,body=prepared
    assert c.post('/api/settings/test',headers={'origin':'https://evil.example'}).status_code==403
    payload={'provider':'custom','base_url':'http://localhost:8000/v1','model':'x','api_key':['should-not-echo']}
    response=c.put('/api/settings',json=payload)
    assert response.status_code==422 and 'should-not-echo' not in response.text
    response=c.post(f'/api/candidates/{cid}/preview',json={**body,'skill_ids':['../../.env']})
    assert response.status_code==400
    assert any(s['id']=='question-design' for s in c.get('/api/skills').json())
    with pytest.raises(ValueError):service.neutral('候选人造假')
    assert endpoint('https://example.com/v1/')=='https://example.com/v1/chat/completions'
    assert endpoint('http://localhost:11434/v1/chat/completions')=='http://localhost:11434/v1/chat/completions'
    for url in ['https://user:key@example.com','http://example.com/v1','https://example.com?key=secret']:
        with pytest.raises(ProviderError):endpoint(url)

@pytest.mark.parametrize('status,code',[(401,'authorization'),(403,'authorization'),(429,'rate_limit'),(500,'http_error')])
def test_provider_http_errors_sanitized(monkeypatch,status,code):
    original=httpx.AsyncClient
    transport=httpx.MockTransport(lambda request:httpx.Response(status,text='fake-secret upstream payload'))
    monkeypatch.setattr(httpx,'AsyncClient',lambda **kwargs:original(transport=transport,**kwargs))
    provider=OpenAICompatibleProvider(ProviderConfig('custom','https://example.com/v1','test','fake-secret'))
    with pytest.raises(ProviderError) as error:asyncio.run(provider.generate([Message('user','test')]))
    assert error.value.code==code and 'fake-secret' not in str(error.value)

def test_provider_success_timeout_and_invalid_json(monkeypatch):
    original=httpx.AsyncClient
    def handler(request):
        assert request.headers['authorization']=='Bearer fake-key'
        body=json.loads(request.content)
        assert body['thinking']=={'type':'disabled'}
        return httpx.Response(200,json={'choices':[{'message':{'content':'OK'},'finish_reason':'stop'}]})
    monkeypatch.setattr(httpx,'AsyncClient',lambda **kwargs:original(transport=httpx.MockTransport(handler),**kwargs))
    provider=OpenAICompatibleProvider(ProviderConfig('deepseek','https://api.deepseek.com','deepseek-flash','fake-key'))
    assert asyncio.run(provider.generate([Message('user','test')]))=='OK'
    def timeout(request):raise httpx.ReadTimeout('contains-private-data')
    monkeypatch.setattr(httpx,'AsyncClient',lambda **kwargs:original(transport=httpx.MockTransport(timeout),**kwargs))
    with pytest.raises(ProviderError,match='超时'):asyncio.run(provider.generate([Message('user','test')]))
    monkeypatch.setattr(httpx,'AsyncClient',lambda **kwargs:original(transport=httpx.MockTransport(lambda request:httpx.Response(200,json={'wrong':'shape'})),**kwargs))
    with pytest.raises(ProviderError,match='有效'):asyncio.run(provider.generate([Message('user','test')]))

def test_restart_migration_backup_restore(tmp_path,monkeypatch):
    from backend import database, main
    from backend.runtime_lock import data_lock
    from backend.secrets import protect,reveal
    from scripts.backup import backup,restore
    data=tmp_path/'data'
    monkeypatch.setattr(database,'DATA_DIR',data);monkeypatch.setattr(main,'DATA_DIR',data)
    with TestClient(main.app) as c:
        cid=create_candidate(c)
        c.post(f'/api/candidates/{cid}/resumes',files={'file':('x.txt',RESUME.encode())})
        c.put('/api/settings',json={'provider':'custom','base_url':'https://example.com','model':'x','api_key':'fake-key'})
        with pytest.raises(RuntimeError):backup(data,tmp_path/'blocked.zip')
        with database.connect() as db:
            db.execute("INSERT INTO generations(candidate_id,resume_id,status,input_json) VALUES(1,1,'pending','{}')")
    with TestClient(main.app) as restarted:
        assert restarted.get('/api/projects').json()[0]['title']=='本地面试'
        assert restarted.get('/api/candidates/1/generations').json()[0]['status']=='failed'
        assert restarted.get('/api/resumes/1').json()['text']==RESUME
    archive=backup(data,tmp_path/'backup.zip')
    restored=restore(archive,tmp_path/'restored')
    db=sqlite3.connect(restored/'app.db')
    assert db.execute('SELECT api_key FROM settings').fetchone()[0]==''
    assert db.execute('SELECT text FROM resumes').fetchone()[0]==RESUME
    assert db.execute('SELECT count(*) FROM schema_migrations').fetchone()[0]==1
    db.close()
    with pytest.raises(ValueError):restore(archive,restored)
    secret=protect('fake-key')
    assert reveal(secret)=='fake-key'
    if os.name=='nt':assert 'fake-key' not in secret

def test_restore_rejects_traversal(tmp_path):
    import zipfile
    from scripts.backup import restore
    path=tmp_path/'bad.zip'
    with zipfile.ZipFile(path,'w') as archive:archive.writestr('../escape','bad')
    with pytest.raises(ValueError):restore(path,tmp_path/'new')
    assert not (tmp_path/'escape').exists()


def test_bounded_quote_repair(prepared, monkeypatch):
    calls=[]
    class RepairProvider:
        async def generate(self,messages):
            calls.append(messages)
            value=plan_data()
            if len(calls)==1:value['capabilities'][0]['requirement_quote']='不存在的引用'
            return json.dumps(value)
    monkeypatch.setattr(service,'provider_for',lambda config:RepairProvider())
    result=make_plan(prepared)
    assert result['status']=='completed' and len(calls)==2
    assert 'requirement_quote' in calls[1][-1].content


def test_dynamic_followup_and_options(prepared,monkeypatch):
    c,cid,body=prepared
    generation=make_plan(prepared)
    session=c.post('/api/sessions',json={'generation_id':generation['id'],'budget':3}).json();sid=session['id']
    assert session['claim_states']['0']=='QUESTIONED'
    class FollowProvider(FakeProvider):
        async def generate(self,messages):
            result=json.loads(await super().generate(messages))
            result['follow_up']={'question':'为什么采用 SQLite 事务？','capability':'Python','resume_quote':QUOTE,'reason':'深入验证事务理解','difficulty':'hard'}
            return json.dumps(result)
    monkeypatch.setattr(service,'provider_for',lambda config:FollowProvider())
    session=c.post(f'/api/sessions/{sid}/answers',json={'answer':'使用事务保存','revision':0}).json()
    assert session['current']['question']=='为什么采用 SQLite 事务？'
    response=c.post(f'/api/sessions/{sid}/follow-up',json={'revision':session['revision']})
    assert response.status_code==200
    response=c.put(f'/api/sessions/{sid}/options',json={'difficulty':'easy'})
    assert response.status_code==200 and response.json()['difficulty']=='easy'
    # Changing providers must not silently send the session to another service.
    c.put('/api/settings',json={'provider':'custom','base_url':'https://another.example','model':'other'})
    response=c.post(f'/api/sessions/{sid}/answers',json={'answer':'另一个回答','revision':response.json()['revision']})
    assert response.status_code==502
    assert c.get(f'/api/sessions/{sid}').json()['busy']==0


def test_legacy_database_migration_keeps_rows(tmp_path,monkeypatch):
    from backend import database
    monkeypatch.setattr(database,'DATA_DIR',tmp_path)
    # An original phase-1 database with no migration tables.
    db=sqlite3.connect(tmp_path/'app.db')
    db.executescript("""
    CREATE TABLE settings(id INTEGER PRIMARY KEY, provider TEXT, base_url TEXT, api_key TEXT, model TEXT);
    INSERT INTO settings VALUES(1,'deepseek','https://api.deepseek.com','legacy-fake-key','deepseek-flash');
    CREATE TABLE projects(id INTEGER PRIMARY KEY,kind TEXT,title TEXT,description TEXT,created_at TEXT);
    INSERT INTO projects VALUES(1,'project','Existing project','Existing description','2026-09-18');
    """)
    db.close()
    database.initialize();database.initialize()
    with database.connect() as db:
        assert db.execute('SELECT title FROM projects').fetchone()[0]=='Existing project'
        assert db.execute('SELECT count(*) FROM schema_migrations').fetchone()[0]==1
        from backend.secrets import reveal
        assert reveal(db.execute('SELECT api_key FROM settings').fetchone()[0])=='legacy-fake-key'
