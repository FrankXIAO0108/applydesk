import source_smoke as src
import urllib.request, urllib.error, json
core=src.core
def search(payload,status=200):
    req=urllib.request.Request(core.base+'/api/search',data=json.dumps(payload,ensure_ascii=False).encode(),headers={'Content-Type':'application/json','Origin':core.base})
    try:
        with core.client.open(req) as r:code,data=r.status,json.loads(r.read())
    except urllib.error.HTTPError as e:code,data=e.code,json.loads(e.read())
    assert code==status,(code,data)
    return data
url='https://jobs.bytedance.com/campus/position/'+core.marker+'/detail'
item={'title':'测试专用 Agent 算法实习生','url':url,'location':'北京','employment':'日常实习','description':'强化学习与工具调用'}
payload={'company':'字节跳动','state':'ready','sourceUrl':'https://jobs.bytedance.com/campus/position?qa='+core.marker,'items':[item]}
search(payload);search(payload)
jobs=[j for j in core.request()[1]['jobs'] if j['url']==url]
assert len(jobs)==1 and jobs[0]['matchState']=='matched'
core.post({'action':'decide','id':jobs[0]['id'],'decision':'ignored'})
search(payload)
assert next(j for j in core.request()[1]['jobs'] if j['url']==url)['decision']=='ignored'
search({**payload,'company':'BOSS直聘'},400)
search({**payload,'company':'滴滴','sourceUrl':'https://app.mokahr.com/social-recruitment/other-company/1','items':[]},400)
search({**payload,'state':'blocked'},400)
src.source({'company':'美团','state':'partial','sourceUrl':src.url,'error':'测试部分读取','records':[{**src.rows[0],'appliedAt':'2026-09-28'}]})
src.source({'company':'美团','state':'connected','sourceUrl':src.url,'records':[{**src.rows[0],'appliedAt':'2026-02-30'}]},400)
assert next(j for j in core.request()[1]['jobs'] if j['recordKey']=='source:美团:'+src.rows[0]['sourceRecordId'])['appliedAt']=='2026-09-28'
with core.cleanup.open('a',encoding='utf-8') as f:f.write(f"\nDELETE FROM searches WHERE sourceUrl LIKE '%{core.marker}%';")
print('Search checks passed: 16-company scope, Boss excluded, tenant path isolation, deduplication, decisions preserved, partial snapshots and date precision.')
