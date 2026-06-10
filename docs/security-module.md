# AI 内容安全管理模块

New-API 内置 AI 内容安全管理模块，用于检测和拦截用户请求及 AI 响应中的敏感内容。

## 功能概述

- **敏感词分组管理**：支持嵌套分组（Materialized Path），可创建多层级的分类体系。
- **检测规则**：支持关键词、正则表达式、NER（占位）和 AI 智能检测四种规则类型。
- **用户策略**：将分组绑定到具体用户，配置生效范围（仅请求 / 仅响应 / 双向）和默认动作。
- **实时检测**：在 `/v1/chat/completions` 等聊天接口上自动执行请求和响应内容检测。
- **动作类型**：
  - Pass（放行）
  - Alert（告警并放行）
  - Mask（脱敏后放行）
  - Block（拦截）
  - Review（人工复核）
- **审计日志**：记录每次命中事件，存储内容 SHA-256 哈希而非原始内容，支持导出 CSV/Excel。
- **统计看板**：汇总检测次数、拦截次数、告警次数、Top 分类/用户/模型、风险分布等。

## 环境变量

在 `.env` 或运行环境中配置以下变量：

| 变量 | 说明 | 默认值 |
|---|---|---|
| `SECURITY_ENABLED` | 是否启用安全模块 | `true` |
| `SECURITY_AI_TIMEOUT` | AI 检测超时时间（秒） | `3` |
| `SECURITY_AI_URL` | AI 检测服务地址（可选） | 空 |
| `SECURITY_AI_KEY` | AI 检测服务密钥（可选） | 空 |

## 快速开始

1. **启动后端并执行数据库迁移**，确保以下表已创建：
   - `security_groups`
   - `security_rules`
   - `security_user_policies`
   - `security_hit_logs`
   - `security_audit_logs`

2. **登录管理后台**，进入左侧菜单「Security」→「Groups」，创建一个敏感词分组。

3. **进入「Rules」**，在刚刚创建的分组中添加规则：
   - 关键词类型：在 Content 中填入多个关键词，用英文逗号分隔，例如 `机密, 内部资料`
   - 正则类型：填入合法正则，例如 `1[3-9]\d{9}` 用于匹配手机号

4. **进入「Policies」**，将分组绑定到目标用户：
   - Scope 选择 `Both` 可同时检测请求和响应
   - Default Action 选择 `Block` 或 `Mask`

5. **使用被绑定用户的 Token 调用 `/v1/chat/completions`**，发送包含敏感内容的消息，观察是否被拦截或脱敏。

6. **进入「Logs」**查看命中日志，进入 Dashboard 查看统计图表。

## 动作优先级

当多个规则同时命中时，系统按以下优先级选择最终动作（数值越大优先级越高）：

```
Block > Review > Mask > Alert > Pass
```

## 请求/响应检测流程

1. 中间件读取请求体，提取用户消息内容。
2. 根据用户 ID 查询生效策略及关联规则。
3. 并行执行关键词和正则检测；NER 顺序执行；AI 检测带超时降级。
4. 聚合命中结果，按优先级选择动作。
5. Block：返回 403 错误；Mask：替换敏感内容后转发；Alert/Pass：放行并记录日志。
6. 对于非流式响应，拦截响应体并执行相同检测流程。

## 注意事项

- 当前响应检测仅支持非流式 JSON 响应。流式 SSE 响应由于逐步输出，暂无法完整拦截。
- 所有命中日志仅存储原始内容的 SHA-256 哈希，避免敏感数据泄露。
- 正则规则使用 `dlclark/regexp2` 库，支持 .NET 风格的正则语法。

## 相关文件

- 后端中间件：`middleware/security.go`
- 后端控制器：`controller/security.go`
- 检测引擎：`service/security/detector.go`
- 前端页面：`web/default/src/features/security/pages/`
- 前端组件：`web/default/src/features/security/components/`
- 端到端验证：`specs/001-ai-content-security/quickstart.md`
