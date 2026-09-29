"""Run only against a new, disposable local installation; never production."""
import os,json,pathlib,subprocess,urllib.request,urllib.error
state=json.loads(pathlib.Path('.local/instance.json').read_text())
base=state['url']
def api(route,payload=None,status=200):
    req=urllib.request.Request(base+route,data=json.dumps(payload).encode() if payload is not None else None,headers={'Content-Type':'application/json','Origin':base})
    try:
        with urllib.request.urlopen(req) as r:code,data=r.status,json.load(r)
    except urllib.error.HTTPError as e:code,data=e.code,json.load(e)
    assert code==status,(code,data);return data
before=api('/api/desk');original=json.loads(json.dumps(before['preferences']));assert not before['jobs'],'Requires an empty test installation'
assert not before['onboarding']['configured']
assert not any(c['enabled'] or c['trackApplications'] for c in before['preferences']['companies'])
p=before['preferences'];p['cities']=['上海'];p['companies']=[{'name':'演示公司','url':'https://example.com/jobs','applicationUrl':'','enabled':True,'trackApplications':False,'searchEveryDays':14}]
api('/api/onboarding',{'action':'configure','preferences':{**p,'companies':[]}},400)
api('/api/onboarding',{'action':'configure','preferences':p})
assert api('/api/desk')['onboarding']['configured']
api('/api/onboarding',{'action':'agent-connected'})
assert api('/api/desk')['onboarding']['agentSeenAt']
api('/api/updates',{'action':'begin','triggerKind':'manual','companies':['未授权公司']},400)
assert api('/api/updates',{'action':'begin','triggerKind':'scheduled'})['skipped']
run=api('/api/updates',{'action':'begin','triggerKind':'manual','companies':['演示公司']});assert run['searchCompanies']==['演示公司'] and run['applicationCompanies']==[]
api('/api/search',{'company':'演示公司','state':'ready','sourceUrl':'https://example.com/jobs','items':[{'title':'Agent 算法实习（测试）','url':'https://example.com/jobs/onboarding-test','location':'上海','employment':'日常实习','description':'工具调用、模型后训练'}]})
result=api('/api/updates',{'action':'finish','id':run['id']});assert result['state']=='success'
assert api('/api/desk')['jobs'][0]['matchState']=='matched'
repeat=api('/api/updates',{'action':'begin','triggerKind':'manual','companies':['演示公司']});assert repeat['searchCompanies']==['演示公司'],'Explicit recheck must bypass cadence'
api('/api/updates',{'action':'finish','id':repeat['id'],'error':'Test verifies incomplete run cannot succeed'})
assert api('/api/desk')['updates']['runs'][0]['state']=='failed'
api('/api/preferences',original)
cleanup=pathlib.Path('work/qa-cleanup.sql');cleanup.parent.mkdir(exist_ok=True)
cleanup.write_text("DELETE FROM events WHERE jobId IN (SELECT id FROM jobs WHERE url='https://example.com/jobs/onboarding-test');\nDELETE FROM jobs WHERE url='https://example.com/jobs/onboarding-test';\nDELETE FROM searches WHERE company='演示公司';\nDELETE FROM onboarding WHERE owner='local-user';\n"+''.join(f"DELETE FROM updateRuns WHERE id='{rid}';\n" for rid in [run['id'],repeat['id']]),encoding='utf8')
print('Fresh-install checks passed: empty defaults, conversation configuration, no inherited applications, manual scoped recheck, real write/read, pause, failure truthfulness.')
