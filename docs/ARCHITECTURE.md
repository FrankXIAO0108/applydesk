# 架构与接口

## 目录

| 路径 | 作用 |
| --- | --- |
| app/workspace.tsx | 看板、表单和可选 WebMCP 注册 |
| app/api/desk | 读取数据、录入、用户决定、观察状态、飞书同步 |
| app/api/source | 已投官网记录与连接状态导入 |
| app/api/search | 公开岗位检索结果导入 |
| lib/domain.mjs | URL 归属、筛选、状态归类、日期与表格单元格处理 |
| lib/auth.ts | 开发身份边界；生产默认拒绝 |
| lib/feishu.ts | 飞书专用表格同步与重试锁 |
| db/schema.ts / drizzle | 数据模型与追加式迁移 |

## 主要数据

`jobs` 同时存放候选岗位和已投岗位。`applied` 与 `appliedAt` 分离。`decision` 表示用户意愿，不表示提交完成。`rawStatus` 保留官网原文，`stage` 为展示分类，`checkError` 为最近检查异常。

`sources` 记录个人投递读取状态；`searches` 记录公开岗位检索状态；`events` 是变更记录；`settings` 保存飞书资源标识和同步状态。密钥不存进这些表。

## HTTP API

所有写请求使用同源 `application/json`。本机开发身份由回环中间件注入；生产模式没有有效身份时返回 401。

- `GET /api/desk`：看板数据。
- `POST /api/desk`：action 为 import、decide、observe、sync。
- `POST /api/search`：company、state、sourceUrl、items。state 为 ready/error/login_required/blocked。
- `POST /api/source`：company、state、sourceUrl、records。state 为 connected/partial/error/login_required/blocked。

### 公开岗位示例（虚构）

```json
{
  "company": "字节跳动",
  "state": "ready",
  "sourceUrl": "https://jobs.bytedance.com/campus/position",
  "items": [{
    "title": "【演示数据】Agent算法实习生",
    "url": "https://jobs.bytedance.com/campus/position",
    "location": "北京",
    "employment": "日常实习",
    "description": "虚构样例，用来演示工具调用与评测方向的岗位筛选。"
  }]
}
```

### 个人投递字段

record 包含 sourceRecordId、title、url、location、employment、description、applied=true、appliedAt、rawStatus。

优先使用官网记录编号去重；无编号时可采用岗位名与原始日期组合，但这只是回退标识，不能冒充官网编号。需要适配同名、重新投递和多业务志愿等情况。

## WebMCP

在支持该接口的浏览器中，页面注册 read_application_desk、sync_job_search、sync_recruitment_source、sync_feishu_records。运行时可能附加会话后缀，代理必须先发现工具。

这些工具复用服务器校验。它们是数据录入渠道，不包含网站登录、抓取或简历提交逻辑。普通浏览器不支持 WebMCP 时，看板和手动录入仍可使用。

## 已知限制

- 官网来源不是自动爬虫适配器；当前没有定时执行器。
- 规则匹配不能替代职位语义审查。
- 飞书创建请求在远端成功但本地超时的极端情况下，可能生成孤立表格；恢复前需核对远端结果。
- 本地只支持一个用户身份；生产认证必须独立实现。
