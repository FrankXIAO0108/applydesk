# 参与开发

先阅读 AGENTS.md，围绕一个可复现问题或小功能提交变更。

PR 说明应包含问题、最终行为、验证步骤、尚未完成的部分。新增官网适配器只用合成或去标识化夹具，不能提交真实投递记录或浏览器会话。

提交前运行 `npm test`、`npm run typecheck`、`npm run privacy:check` 和 `npm run build`。数据库变化使用 `npm run db:generate` 追加迁移，不能重写已应用的迁移。

使用 AI 编码工具时说明它完成了什么、你验证了什么；不要用生成的测试数量替代行为验证。
