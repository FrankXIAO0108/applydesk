"""Local-only configuration and real update-state transitions. Restores settings."""
import json,urllib.request,urllib.error,uuid,copy,pathlib,concurrent.futures
base=__import__('os').environ.get('APPLYDESK_TEST_URL','http://127.0.0.1:5173')
def call(path,payload=None,status=200):
    req=urllib.request.Request(base+path,data=json.dumps(payload).encode() if payload is not None else None,headers={'Content-Type':'application/json','Origin':base})
    try:
        with urllib.request.urlopen(req) as r:code,data=r.status,json.load(r)
    except urllib.error.HTTPError as e:code,data=e.code,json.load(e)
    assert code==status,(path,code,data)
    return data
original=call('/api/preferences');marker='qa-'+uuid.uuid4().hex
company={'name':marker,'url':'https://example.com/jobs','applicationUrl':'','enabled':True,'trackApplications':False,'searchEveryDays':14}
p={**copy.deepcopy(original),'cities':['上海'],'directions':['Agent','大模型'],'companies':[company],'updatesEnabled':True,'includeKeywords':['RAG'],'excludeKeywords':['产品经理']}
run_ids=[]
try:
    bad={**p,'companies':[{**company,'url':'http://127.0.0.1/jobs'}]};call('/api/preferences',bad,400)
    call('/api/preferences',{**p,'companies':[company,company]},400)
    call('/api/preferences',p)
    job={'company':marker,'title':'RAG 大模型算法日常实习生','description':'Agent SFT 后训练算法','location':'上海','employment':'日常实习','url':'https://example.com/jobs/'+marker}
    call('/api/desk',{'action':'import','jobs':[job]})
    row=next(j for j in call('/api/desk')['jobs'] if j['company']==marker);assert row['matchState']=='matched'
    call('/api/desk',{'action':'decide','id':row['id'],'decision':'approved'})
    call('/api/preferences',{**p,'cities':['北京']})
    row=next(j for j in call('/api/desk')['jobs'] if j['company']==marker);assert row['matchState']=='excluded' and row['decision']=='pending'
    call('/api/preferences',p)
    with concurrent.futures.ThreadPoolExecutor(2) as pool:runs=list(pool.map(lambda _:call('/api/updates',{'action':'begin','triggerKind':'manual'}),range(2)))
    assert sum('id' in r for r in runs)==1,runs
    run=next(r for r in runs if 'id' in r);run_ids.append(run['id']);assert run['searchCompanies']==[marker]
    result=call('/api/updates',{'action':'finish','id':run['id']});assert result['state']=='failed' and '本轮未检查' in result['summary']
    run=call('/api/updates',{'action':'begin','triggerKind':'manual'});run_ids.append(run['id'])
    call('/api/search',{'company':marker,'state':'ready','sourceUrl':company['url'],'items':[{k:v for k,v in job.items() if k!='company'}]})
    result=call('/api/updates',{'action':'finish','id':run['id']});assert result['checked']==1
    if not call('/api/desk')['feishu']['configured']:assert result['state']=='success'
    run=call('/api/updates',{'action':'begin','triggerKind':'manual','forceSearch':False});run_ids.append(run['id']);assert run['searchCompanies']==[],run
    call('/api/updates',{'action':'finish','id':run['id']})
    call('/api/preferences',{**p,'updatesEnabled':False});assert call('/api/updates',{'action':'begin','triggerKind':'scheduled'})['skipped']
    call('/api/preferences',{**p,'companies':[{**company,'enabled':False}]})
    call('/api/search',{'company':marker,'state':'ready','sourceUrl':company['url'],'items':[]},400)
finally:
    call('/api/preferences',original)
    cleanup=pathlib.Path('work/qa-cleanup.sql');cleanup.parent.mkdir(exist_ok=True)
    with cleanup.open('a',encoding='utf8') as f:
        f.write(f"\nDELETE FROM events WHERE jobId IN (SELECT id FROM jobs WHERE company='{marker}');\nDELETE FROM jobs WHERE company='{marker}';\nDELETE FROM searches WHERE company='{marker}';\n")
        for rid in run_ids:f.write(f"DELETE FROM updateRuns WHERE id='{rid}';\n")
print('Preferences checks passed: custom company/city, invalid URLs, duplicates, re-filter, approval withdrawal, concurrent run exclusion, missing checks cannot succeed, weekly cadence, pause, disabled sources.')
