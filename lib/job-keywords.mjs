// Compatibility aliases for older saved presets; every other value is a free-form keyword.
const legacy={
 '大模型应用算法':/大模型|\bLLM\b|\bRAG\b|检索增强|生成式|AIGC/i,
 'Agent':/\bagent\b|智能体|多智能体/i,
 '后训练':/后训练|post[ -]?train|RLHF|RLVR|GRPO|DPO|SFT|奖励模型|对齐|强化学习/i,
 '业务算法':/推荐|广告|搜索|排序|召回|策略算法|风控算法|业务算法|机器学习|数据挖掘|自然语言|对话系统|NLP/i
};
const normalized=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
export function matchTargets(job,keywords){
 if(!keywords?.length)return {state:'review',reason:'请先设置目标岗位名称或关键词',direction:''};
 const text=normalized((job.title||'')+'\n'+(job.description||''));
 const found=keywords.find(word=>text.includes(normalized(word))||legacy[word]?.test(text));
 return found?{state:'matched',reason:'命中目标岗位／关键词：'+found,direction:found}:{state:'excluded',reason:'未命中目标岗位名称或关键词',direction:''};
}
export function searchPlan(preferences,companies){return preferences.companies.filter(c=>companies.includes(c.name)&&c.enabled).map(c=>({company:c.name,entryUrl:c.url,queries:[...new Set(preferences.directions)],cities:preferences.cities,employment:preferences.employment,includeKeywords:preferences.includeKeywords,excludeKeywords:preferences.excludeKeywords}));}
