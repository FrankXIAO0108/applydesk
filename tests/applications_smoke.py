"""Local synthetic submission lifecycle. Never opens or submits a recruiting website."""
import os,json,urllib.request,urllib.error,pathlib,uuid,base64,copy
base=os.environ.get('APPLYDESK_TEST_URL','http://127.0.0.1:5173')
def api(route,payload=None,status=200):
    req=urllib.request.Request(base+route,data=json.dumps(payload,ensure_ascii=False).encode() if payload is not None else None,headers={'Content-Type':'application/json','Origin':base})
    try:
        with urllib.request.urlopen(req) as r:code,text=r.status,r.read().decode()
    except urllib.error.HTTPError as e:code,text=e.code,e.read().decode()
    data=json.loads(text);assert code==status,(route,code,data);return data
marker='qa-'+uuid.uuid4().hex;original=api('/api/preferences');p=copy.deepcopy(original)
p.update(cities=['北京'],employment='秋招',directions=['法务','产品经理','地物探数据解释工程师'],browser='chrome',includeKeywords=[],excludeKeywords=[],updatesEnabled=False,companies=[{'name':marker,'url':'https://example.com/jobs','applicationUrl':'','enabled':True,'trackApplications':False,'searchEveryDays':7}])
work=pathlib.Path('work');work.mkdir(exist_ok=True);resume=(work/(marker+'.pdf')).resolve();resume.write_bytes(b'%PDF-1.7\nSynthetic fixture only\n%%EOF')
try:
    api('/api/preferences',p)
    data=api('/api/preferences');assert data['browser']=='chrome' and data['directions']==p['directions']
    items=[{'company':marker,'title':title,'location':'北京','employment':'2027届秋招','description':'官网明确的岗位职责','url':'https://example.com/jobs/'+marker+str(i)} for i,title in enumerate(p['directions'])]
    api('/api/desk',{'action':'import','jobs':items})
    jobs=[j for j in api('/api/desk')['jobs'] if j['company']==marker];assert len(jobs)==3 and all(j['matchState']=='matched' for j in jobs)
    job=jobs[0];api('/api/desk',{'action':'decide','id':job['id'],'decision':'approved'})
    r=api('/api/local-resumes',{'action':'register','path':str(resume),'label':'模拟秋招版','directions':['法务']});assert r['sha256'] and 'path' not in r
    api('/api/local-applications',{'action':'enqueue','jobId':job['id'],'resumeId':r['id']},400)
    task=api('/api/local-applications',{'action':'enqueue','jobId':job['id'],'resumeId':r['id'],'confirmed':True});assert task['codexUrl'].startswith('codex://new?') and task['state']=='queued'
    assert not next(j for j in api('/api/desk')['jobs'] if j['id']==job['id'])['applied']
    claim=api('/api/local-applications',{'action':'claim','id':task['id']});assert claim['browser']=='chrome'
    api('/api/local-applications',{'action':'claim','id':task['id']},400)
    api('/api/local-applications',{'action':'prepare','id':task['id'],'token':claim['token'],'formUrl':job['url'],'reviewSummary':'模拟表单核对：测试岗位、测试简历，不访问外网'})
    evidence=pathlib.Path(claim['evidenceDirectory'])/(marker+'.png');evidence.write_bytes(base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3ioAAAAASUVORK5CYII='))
    result=api('/api/local-applications',{'action':'complete','id':task['id'],'token':claim['token'],'receiptUrl':job['url'],'receiptText':'模拟回执：投递成功','evidencePath':str(evidence)})
    assert result['state']=='submitted'
    applied=next(j for j in api('/api/desk')['jobs'] if j['id']==job['id']);assert applied['applied']==1 and applied['stage']=='已投递'
    api('/api/local-applications',{'action':'enqueue','jobId':job['id'],'resumeId':r['id'],'confirmed':True},400)
finally:
    api('/api/preferences',original)
    with (work/'qa-cleanup.sql').open('a',encoding='utf8') as f:f.write(f"\nDELETE FROM events WHERE jobId IN (SELECT id FROM jobs WHERE company='{marker}');\nDELETE FROM jobs WHERE company='{marker}';\n")
print('Local synthetic integration passed: custom professions, autumn recruitment, Chrome preference, fixed resume, consent, deduplication, receipt and application-record sync. No real application submitted.')
