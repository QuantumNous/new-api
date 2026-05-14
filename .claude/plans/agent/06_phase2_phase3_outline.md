# Phase 2 / Phase 3 蓝图（仅占位，不实现）

> 本文不指导 Phase 1 开发，作为架构演进路标，避免 Phase 1 设计时把后续路堵死。

---

## Phase 2（2–6 月）：执行能力升级

### 2.1 RAG 知识库（调研报告 §4.3.1）

- 新表：`agent_kb_docs`（文档表）+ `agent_kb_chunks`（切片+向量）
- 向量库选型：Phase 2 评估时再定（pgvector / sqlite-vec / 外置 Qdrant）
- 数据来源：管理员后台上传的平台文档 + FAQ
- 工具新增：`search_knowledge`（在 `tools_readonly.go` 增加）

**Phase 1 占位**：在 `service/agent/orchestrator.go` 留一个 `kbSearcher KnowledgeSearcher` 接口位（默认实现是 nil，调用时短路返回空），Phase 2 直接换实现，不改业务代码。

---

### 2.2 故障自助修复（半自动）

新增工具：
- `auto_retry_request`（用户失败的请求自动重试，可换通道）
- `switch_channel`（切换备用通道，二次确认）
- `regenerate_token`（一键重置失效 Token，二次确认）

**Phase 1 占位**：错误归因工具 `explain_error` 在结果里返回 `suggested_actions: [{tool_name, args}]`，Phase 1 前端只展示文字建议，Phase 2 加"一键执行"按钮。

---

### 2.3 MCP 协议适配层

- 新增 `service/agent/mcp/`（包级目录）
- 抽象 `ToolDefinition` 为接口，原 Function Calling 工具是一个 implementor，新增 MCP 工具是另一个
- 接入第三方 MCP 服务（如 GitHub MCP Server、Notion MCP Server）

**Phase 1 占位**：`Registry` 里 `RegisterTool` 接收的就是接口（不是结构体指针），未来加 MCP 实现时不改 Registry 签名。

---

### 2.4 长期记忆 + 用户偏好

- 新表：`agent_user_memory`（key/value 形式存用户偏好）
- 工具新增：`remember_preference` / `recall_preference`
- 存什么：用户常用模型、预算偏好、语言偏好

**Phase 1 占位**：`agent_sessions` 表暂时只有短期记忆（当前会话上下文），不预先建 memory 表。

---

### 2.5 余额管家（智能告警）

- 新表：`agent_alert_rules`（如"余额低于 ¥10 自动通知 + 推荐充值"）
- 与现有 `notify` 体系打通

**Phase 1 占位**：无，等 Phase 2 单独设计。

---

### 2.6 配置生成器（调研报告 §3.2 TOP2）

工具：`generate_third_party_config`，参数 `client_type: "chatbox" | "open-webui" | "lobe-chat"`。

返回：完整的配置 JSON / 配置截图 + 跳转链接。

**Phase 1 占位**：可以放在 Phase 1 末尾作为 G3 工具加进去（如果时间允许），但不计入 MVP 必做范围。

---

## Phase 3（6–12 月）：平台化

### 3.1 多 Agent 协同（调研报告 §4.3.3 扇出-汇聚式）

```
Router Agent（决策） → Doc Agent + SQL Agent + Pricing Agent → Verifier Agent → Writer Agent
```

- 引入 AgentScope 或 LangGraph（Go 等价库 / 自研）
- 跨模型工作流编排（任务拆给不同 LLM）

**Phase 1 占位**：`Orchestrator` 不要写死单 LLM 单线程，留好多 worker 协程的扩展点。

---

### 3.2 Agent 商店（调研报告 §5.2）

- 第三方开发者发布预置 Agent
- 用户一键启用
- 平台与开发者收益分成

**Phase 1 占位**：`agent_definitions` 表可以提前规划，但 Phase 1 用单一硬编码 Agent。

---

### 3.3 云端沙箱执行（CodeAct 范式，调研报告 §2.4 Manus）

- Agent 在沙箱里跑代码完成复杂任务
- Docker / Firecracker / WebAssembly 沙箱

**Phase 1 占位**：架构上明确"工具调用"和"代码执行"是两条路，工具是声明式有限白名单，代码执行是 Phase 3 才考虑的。

---

### 3.4 商业模式落地

| 维度 | Phase 3 计划 |
|---|---|
| 免费 Agent | Phase 1 工具 + 基础问答 |
| 高级 Agent | 跨模型工作流 + 自动化任务，按次/订阅收费 |
| Agent 商店分成 | 平台 30%，开发者 70%（行业惯例） |

---

## 跨阶段技术债清单（Phase 1 写代码时注意为后续留接口）

1. `Registry` 用接口，不用结构体指针 → Phase 2 加 MCP 工具不改注册逻辑
2. `Orchestrator.RunStream` 返回 channel，**不**直接写 gin SSE → 未来可换 WebSocket 输出
3. `LLMClient.Call` 不依赖 gin.Context，纯 ctx + 数据 → Phase 3 多 Agent 时可并发调用
4. `AgentEvent` 类型集合留前缀分组（`tool_*` / `text_*` / `meta_*`）→ 未来加 `subagent_*` 前缀方便扩展
5. 数据库表都加 `created_at` `updated_at`，禁止用 `deleted_at` 软删除（Phase 2 加 Agent 商店时和管理表关联会复杂）
6. 前端 SSE 解析层独立成 hook，Phase 2 复用到 RAG 检索结果流
