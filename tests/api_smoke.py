"""Tests the local app only. No company or Feishu requests are sent."""
import json, urllib.request, urllib.error, http.cookiejar, uuid, pathlib
base=__import__('os').environ.get('APPLYDESK_TEST_URL','http://127.0.0.1:5173')
import atexit
def prefs(payload=None):
    req=urllib.request.Request(base+'/api/preferences',data=json.dumps(payload).encode() if payload else None,headers={'Content-Type':'application/json','Origin':base})
    with urllib.request.urlopen(req) as r:return json.load(r)
original_prefs=prefs()
atexit.register(lambda:prefs(original_prefs))
fixture_prefs=json.loads(json.dumps(original_prefs))
fixture_prefs['directions']=['Agent','算法','后训练']
for c in fixture_prefs['companies']:
    c['enabled']=True;c['trackApplications']=c['name'] in ['美团','百度','字节跳动','京东','快手','阿里巴巴','滴滴']
prefs(fixture_prefs)
jar=http.cookiejar.CookieJar()
client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
client.open(base+'/').read()
marker='qa-'+uuid.uuid4().hex
def request(payload=None,origin=base,opener=client):
    req=urllib.request.Request(base+'/api/desk',data=json.dumps(payload,ensure_ascii=False).encode() if payload else None,headers={'Content-Type':'application/json','Origin':origin})
    try:
        with opener.open(req) as r: return r.status,json.loads(r.read())
    except urllib.error.HTTPError as e:
        content=e.read().decode()
        try:return e.code,json.loads(content)
        except json.JSONDecodeError:return e.code,{'error':content}
def post(payload,status=200):
    code,data=request(payload)
    assert code==status,(code,data)
    return data
def fixture(suffix='',**changes):return {'company':'美团','title':'测试专用 Agent 算法实习','url':f'https://zhaopin.meituan.com/web/position/{marker}{suffix}','location':'北京','employment':'日常实习','description':'SFT 与工具调用评估，每周五天',**changes}
cleanup=pathlib.Path('work')/'qa-cleanup.sql'
cleanup.parent.mkdir(exist_ok=True)
cleanup.write_text(f"DELETE FROM events WHERE jobId IN (SELECT id FROM jobs WHERE url LIKE '%{marker}%');\nDELETE FROM jobs WHERE url LIKE '%{marker}%';",encoding='utf-8')
assert request(opener=urllib.request.build_opener())[0]==200  # loopback-only single-user mode
assert request({'action':'import','jobs':[fixture()]},origin='https://foreign.test')[0]==403
before=len(request()[1]['jobs'])
post({'action':'import','jobs':[fixture(),fixture()]})
assert len(request()[1]['jobs'])==before+1
job=next(j for j in request()[1]['jobs'] if marker in j['url'])
post({'action':'decide','id':job['id'],'decision':'approved'})
post({'action':'decide','id':job['id'],'decision':'approved'},409)
approved=next(j for j in request()[1]['jobs'] if j['id']==job['id'])
assert approved['decision']=='approved' and approved['appliedAt'] is None
post({'action':'observe','id':job['id'],'rawStatus':'简历筛选中'},400)
post({'action':'observe','id':job['id'],'rawStatus':'简历筛选中','appliedAt':'2026-09-01T02:00:00Z'})
checked=next(j for j in request()[1]['jobs'] if j['id']==job['id'])
post({'action':'observe','id':job['id'],'checkError':'登录过期'})
failed=next(j for j in request()[1]['jobs'] if j['id']==job['id'])
assert failed['rawStatus']==checked['rawStatus'] and failed['checkedAt']==checked['checkedAt'] and failed['checkError']=='登录过期'
post({'action':'observe','id':job['id'],'rawStatus':'面试未通过'})
post({'action':'import','jobs':[fixture('outside',location='上海')]})
outside=next(j for j in request()[1]['jobs'] if marker+'outside' in j['url'])
post({'action':'decide','id':outside['id'],'decision':'approved'},409)
count=len(request()[1]['jobs'])
post({'action':'import','jobs':[fixture('valid'),fixture('invalid',rawStatus='筛选中')]},400)
assert len(request()[1]['jobs'])==count
post({'action':'import','jobs':[fixture('candidate')]})
candidate=next(j for j in request()[1]['jobs'] if marker+'candidate' in j['url'])
post({'action':'decide','id':candidate['id'],'decision':'approved'})
post({'action':'decide','id':candidate['id'],'decision':'pending'})
assert next(j for j in request()[1]['jobs'] if j['id']==candidate['id'])['decision']=='pending'
if not request()[1]['feishu']['configured']:
    post({'action':'sync'},409)
print('API checks passed: authentication, origin, deduplication, confirmation vs submission, errors preserve status, rollback, filtering, withdrawal, missing Feishu credentials.')
