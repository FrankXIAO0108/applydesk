import api_smoke as core
import urllib.request, urllib.error, json
def source(payload,status=200):
    req=urllib.request.Request(core.base+'/api/source',data=json.dumps(payload,ensure_ascii=False).encode(),headers={'Content-Type':'application/json','Origin':core.base})
    try:
        with core.client.open(req) as response: code,data=response.status,json.loads(response.read())
    except urllib.error.HTTPError as e:code,data=e.code,json.loads(e.read())
    assert code==status,(code,data)
    return data
url=core.fixture('source')['url']
rows=[{'sourceRecordId':core.marker+'-one','title':'来源测试岗位一','url':url,'rawStatus':'简历筛选中','appliedAt':None},{'sourceRecordId':core.marker+'-two','title':'来源测试岗位二','url':url,'rawStatus':'筛选未通过','appliedAt':'2026-09-01T02:00:00Z'}]
payload={'company':'美团','state':'connected','sourceUrl':url,'records':rows}
source(payload);source(payload)
jobs=[j for j in core.request()[1]['jobs'] if j['url']==url]
assert len(jobs)==2 and all(j['applied']==1 for j in jobs)
assert next(j for j in jobs if j['title']=='来源测试岗位一')['appliedAt'] is None
source({'company':'美团','state':'login_required','sourceUrl':url,'error':'需要登录','records':[]})
after=[j for j in core.request()[1]['jobs'] if j['url']==url]
assert [j['rawStatus'] for j in after]==[j['rawStatus'] for j in jobs]
assert all(j['checkError']=='需要登录' for j in after)
source({**payload,'state':'error'},400)
source({**payload,'sourceUrl':'https://evil.test'},400)
source({**payload,'records':[rows[0],rows[0]]},400)
with core.cleanup.open('a',encoding='utf-8') as file:file.write(f"\nDELETE FROM sources WHERE sourceUrl LIKE '%{core.marker}%';")
print('Source checks passed: shared listing URLs, missing application dates, idempotency, failed login preserves original status, host validation, duplicate rejection.')
