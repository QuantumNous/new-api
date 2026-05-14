# 待确认问题（开工前必须答完）

> 本文是开工前必须找你拍板的关键决策。每个问题如果答错了后期改起来代价很大。
> 我会用 `AskUserQuestion` 工具一组一组问你（一次最多 4 个）。本文是问题汇总目录。

---

## 一组问题（影响计费）

### Q1. Agent 自身消耗的 LLM 算力，谁来出钱？

- A. **方案 A 破冰额度池**：每个用户首次进入 Agent 送 N 次免费调用，用完再扣余额（推荐，吻合调研报告 §5.1）
- B. **方案 B 直接扣用户余额**：Agent 调 LLM 跟用户自己调一样扣费（实现最简单）
- C. **方案 C 平台兜底**：全平台买单（有刷羊毛风险）
- D. **暂时方案 B，Phase 2 再加破冰额度**（折中）

**为什么需要确认**：
- 影响是否要在 Phase 1 建 `agent_user_quota` 表
- 影响是否要在 `service/agent/icebreaker.go` 写"先扣破冰再扣余额"的两段式扣费

---

### Q2. Agent 自己调 LLM 用哪个模型 / 哪个通道？

- A. **管理员指定一个固定通道 + 固定模型**（如配置 `agent.llm_channel_id=5, agent.llm_model="gpt-4o-mini"`）
- B. **从用户已有 group 里挑性价比最高的**
- C. **支持多模型回退链**（GPT-4o-mini → 国产备用 → DeepSeek-V3）
- D. **混合**：默认 A，用户余额特别多时用更好的模型

**为什么需要确认**：
- 影响 `setting/agent_setting/setting.go` 的字段设计
- 影响是否需要在管理员后台新增"Agent 专用通道"配置 UI

---

## 二组问题（影响入口和可见性）

### Q3. Agent 入口怎么放？

- A. **悬浮按钮 + 侧边栏菜单 + 独立页面**三入口都做（调研报告 §4.4 推荐）
- B. **只做侧边栏菜单 + 独立页面**（更简单）
- C. **只做悬浮按钮**（更轻量）
- D. **现阶段只做独立页面，悬浮按钮 Phase 2 再加**

### Q4. Agent 对哪些用户可见？

- A. **全员可见**（最激进）
- B. **白名单灰度**（管理员后台勾选用户）
- C. **新注册用户优先**（注册 30 天内）
- D. **管理员开关，默认关闭，要主动开**（最稳）

---

## 三组问题（影响存储与会话）

### Q5. 审计日志放哪？

- A. **独立表 `agent_audit_logs`**（推荐，隔离 + 隐私）
- B. **复用现有 `logs` 表加 `tool_name` 字段**（耦合大）
- C. **写文件不入库**（不便查询）

### Q6. 会话历史的存储位置？

- A. **后端持久化**：`agent_sessions` + `agent_messages` 入库（用户能跨设备看历史）
- B. **只存浏览器 localStorage**（隐私好但换设备就没了）
- C. **A + 用户可在设置里选「不记录」**（最灵活但工作量大）

### Q7. 会话保留期？

- A. **永久**（直到用户手动删）
- B. **30 天滚动删除**
- C. **90 天滚动删除**（推荐，与审计日志统一）
- D. **管理员可配置**

---

## 四组问题（影响实现路径）

### Q8. Agent 调 LLM 的实现方式？

- A. **同进程函数调用**（重构 relay 内部函数让其不依赖 gin.Context，推荐）
- B. **HTTP loopback**：仿造 `internal/pg`，新增 `internal/agent` 路由 + `InternalAgentAuth` 中间件
- C. **A 优先尝试，遇到耦合太重时回退到 B**（折中）

### Q9. Phase 1 是否引入 RAG 知识库？

- A. **引入**（让用户可以问"怎么充值"等平台知识）
- B. **不引入，Phase 2 再做**（推荐，先把工具调用闭环跑通）
- C. **简化版**：在 `doc_links.go` 里硬编码 30 条 FAQ + 关键词匹配，不上向量库

### Q10. 二次确认的 UI 形式？

- A. **聊天流里展示卡片**（确认/拒绝按钮在卡片上）
- B. **Modal 弹窗**（强打断）
- C. **A 默认，删除/危险操作用 B**（折中）

---

## 五组问题（影响 i18n 和品牌）

### Q11. Agent 的"自我身份"叫什么？

- A. **"AI 管家"**（调研报告称呼）
- B. **"知豆"**（项目内部代号）
- C. **"小新"** 或别的名字
- D. **由管理员自定义 / 用户自定义**

### Q12. Phase 1 支持几种语言？

- A. **只支持中文**（最快上线）
- B. **中文 + 英文**（标准做法，与 console 其他页面一致）
- C. **中英 + 法俄日越**（与现有前端 i18n 完全对齐）

---

## 六组问题（影响开发流程）

### Q13. 是否一次性开发完 Phase 1 后才上线？

- A. **一次性 Phase 1 全做完才放出来**（保守）
- B. **Phase 1 内部分 Sprint 多次小步上线**（敏捷，调研报告 §6.2 推荐）
- C. **后端先上，前端隐藏入口，团队内测，再放公测**（推荐）

### Q14. 工具列表是否需要管理员后台 UI 管理？

- A. **代码硬编码注册**（Phase 1 推荐，最简单）
- B. **代码注册 + 数据库表存"是否启用"开关**（管理员可临时关闭某工具）
- C. **完全数据库驱动**（管理员能新增工具）—— 工作量大，**不推荐**

### Q15. 现有 `feat/agent-scaffold` 分支的 5 个 stub 文件，你希望我怎么处理？

- A. **基于该分支继续填充**（推荐，保留 stub 结构）
- B. **新开 `feat/agent-phase1` 分支**，把 stub 合并进去
- C. **先 review stub 是否符合本方案，按需调整**

---

## 七组问题（影响安全策略）

### Q16. 是否允许 Agent 在 Phase 1 调任何"花钱"的工具？

- A. **完全不允许**（最稳，但可能让用户体验割裂）
- B. **只允许"生成跳转链接"**（推荐，调研报告 §4.3.4 红线）
- C. **允许小额（如 ¥10 以内）自动操作 + 强二次确认**（激进）

### Q17. 是否允许用户在前端"改 system prompt"？

- A. **完全锁死**（推荐，防 prompt injection）
- B. **管理员可在后台改 system prompt**（多语言版本）
- C. **用户可加个性化指令，但不能覆盖核心系统提示**（半开放）

### Q18. 失败重试策略？

- A. **不自动重试，给用户明确提示**（最稳）
- B. **网络/超时类错误自动重试 1 次**（推荐）
- C. **任何 5xx 都自动重试 3 次**（激进）

---

## 八组问题（开发资源相关）

### Q19. 谁主导前端 / 谁主导后端？

- 影响：是否需要 spawn 子 agent 并行开发（已有 `frontend-agent-ui-builder` skill）

### Q20. 上线时机有硬约束吗？

- A. 90 天 MVP（调研报告默认）
- B. 60 天激进
- C. 没有硬约束，做扎实

---

## 提问顺序（我会按这个序列在对话里发问）

1. **第一轮（最关键）**：Q1（计费方案）、Q2（Agent LLM 模型）、Q8（同进程 vs HTTP loopback）、Q15（分支策略）
2. **第二轮（影响功能范围）**：Q9（RAG 是否进 Phase 1）、Q14（工具列表管理）、Q16（花钱工具范围）、Q17（system prompt 是否可改）
3. **第三轮（影响 UX/UI）**：Q3（入口形式）、Q10（确认 UI 形式）、Q11（Agent 名字）、Q12（语言支持）
4. **第四轮（影响存储）**：Q5（审计日志位置）、Q6（会话存储）、Q7（保留期）、Q4（用户可见性）
5. **第五轮（开发流程）**：Q13（一次性 vs 分步）、Q18（重试策略）、Q19（资源分工）、Q20（上线时机）

> 每轮我用 `AskUserQuestion` 工具一次发出，最多 4 个问题。
> 你答完一轮我才进入下一轮。**未答之前不写任何业务代码。**

---

## 已确认决策（持续记录）

### 第一轮确认（2026-05-15）

- **Q1 = B 破冰额度池**：每个用户首次进 Agent 送 N 次免费调用，用完扣余额
  - 需要建表：`agent_user_quota`
  - 需要实现：`service/agent/icebreaker.go` 两段式扣费
  - Setting 新增：`agent.icebreaker_quota_per_user`（默认值待定）
- **Q2 = A 管理员指定固定通道+固定模型**：
  - Setting 新增字段：`agent.llm_channel_id`、`agent.llm_model_name`
  - 不做模型回退链，不做 group 动态选择
  - 管理员后台需新增"Agent LLM 配置"区块（最小：两个输入框）
- **Q8 = A 同进程函数调用**：
  - 需要先在 relay 包内抽出**不依赖 gin.Context** 的纯函数版本（如 `relay.RunChatCompletionInternal(ctx, params, userId, channelId)`）
  - 不新增 internal HTTP 路由
  - **风险**：relay 当前重度依赖 gin.Context，重构成本可能不低，需在动手前评估
- **Q15 = B 新开 feat/agent-phase1 分支**：
  - 从 `feat/agent-scaffold` 切出新分支
  - 把现有 5 个 stub 合并进新分支后再填充
  - PR 合并目标：`main`（合并前必跑 `zhidou-regression-gate`）

### 第二轮确认（2026-05-15）

- **Q9 = C 上完整向量库 RAG**：
  - **⚠️ 工作量警告**：Phase 1 范围从"工具调用闭环"扩大到包含：
    - 向量库选型与部署（pgvector / sqlite-vec / 外置 Qdrant，与 Rule 2 三库兼容性强相关）
    - 文档摄取管道（admin 上传 → 切片 → 向量化 → 落库）
    - 检索接口 + RAG 重排
    - 知识库管理后台 UI
  - **预计 Phase 1 周期 60→80 天**，仍在 90 天 MVP 内但缓冲收窄
  - 新增表：`agent_kb_docs`、`agent_kb_chunks`、`agent_kb_collections`
  - 新增工具：`search_knowledge`（在 `tools_readonly.go` 加，工具数 12→13）
  - **追加确认 Q9.1**：向量库走哪个方案？— 已加入第二轮追加问题
- **Q14 = B 代码注册 + 数据库开关**：
  - 新增表：`agent_tool_settings`（tool_name PK / enabled / updated_at）
  - 启动时仍在代码里 `RegisterAll`，但每次 Orchestrator 取工具列表前查一次内存缓存（带 60s TTL，从该表加载）
  - 管理员后台新增"Agent 工具开关"页（一个 Switch 列表）
- **Q16 = C 允许小额调起支付 + 强二次确认**：
  - **⚠️ 严重风险警告**：此选择突破调研报告 §4.3.4 红线和 KiKi 标杆做法，需要严格的护栏设计：
    - Agent 触发支付的金额硬上限：建议 ¥10/次、¥50/天（在 Setting 配置）
    - 必须强制二次确认（不可跳过）
    - 必须把金额参数从 LLM 推断中独立出来（防 prompt injection 把 ¥10 改成 ¥10000）
    - 必须新增 `agent_payment_intents` 表追踪 Agent 触发的支付订单
    - **必须明确**：Agent 只能调 `RequestEpay` 等"创建订单"接口，**仍然绝对禁止**碰任何 `*Webhook` 函数（高压线 3）
  - **追加确认 Q16.1**：金额上限怎么设？— 已加入第二轮追加问题
  - **追加确认 Q16.2**：本期是否真的现在就做这个工具，还是放到 Phase 1 末尾或 Phase 2？
- **Q17 = C 用户可加技能指令，不可覆盖核心**：
  - 实现：`final_system_prompt = core_locked_prompt + "\n\n## 用户偏好\n" + user_extra_prompt`
  - 用户输入的 user_extra_prompt 必须 escape 反斜杠和 `</system>` 等关键 token
  - 长度上限：1000 字符
  - 新增表：`agent_user_settings`（user_id PK / extra_prompt / updated_at）
  - 后端 `service/agent/prompt_builder.go` 拼接 system prompt

### 第二轮追加确认（2026-05-15）

- **Q9.1 = B 表存向量 + 应用层计算相似度**：
  - 完全符合 Rule 2（三库兼容）
  - 表 `agent_kb_chunks` 增加 `embedding TEXT` 字段（存 JSON 数组）
  - 检索层在 Go 里跑余弦相似度（cosine similarity）
  - 适用场景：单租户知识库 < 5 万 chunks 时可接受（计算 O(N) 但每个比较是浮点点积）
  - 当文档量超过 5 万 chunks 时性能会退化，需要提前与产品对齐知识库规模上限
  - **建议补充**：在 setting 加一个 `agent.kb_max_chunks` 阈值，超过给管理员提醒
- **Q16.1 = D 默认 ¥10/次、¥50/天，管理员可调**：
  - Setting 字段：
    - `agent.payment_per_call_max_cny`（默认 10）
    - `agent.payment_per_day_max_cny`（默认 50）
  - 实现位置：`service/agent/payment_guard.go`（新增），在调起 `RequestEpay` 等接口前查 `agent_payment_intents` 表当日累计
  - 严格服务端校验，**永远不信任 LLM 推断的金额参数**——前端 UI 也只允许从下拉里选预置金额，不让用户/LLM 自由输入
- **Q16.2 = B 与其他工具同期上线**：
  - **⚠️ 这是激进选择**。Phase 1 必须同时上：支付调起工具 + 调研报告 §4.3.4 的强二次确认 + 金额上限护栏 + 防注入校验
  - 工具 W3 加进 Phase 1 工具清单（`04_phase1_tools.md` 需更新）：
    ```
    W3. trigger_topup（小额支付，需二次确认 + 金额白名单）
    ```
  - 工具数从 12 → 13（含 RAG 搜索）→ 14
- **破冰额度默认 = 10 次**：
  - **⚠️ 用量警告**：一次多轮对话（用户问 + LLM 推理 + 1~2 次 tool call + LLM 总结）通常消耗 4~6 次 LLM 调用。10 次 ≈ 用户能完整聊 1.5~2 次会话就用完。
  - 这意味着用户大概率会被引导去用自己余额，符合"破冰只是体验"定位
  - Setting 字段：`agent.icebreaker_quota_per_user = 10`
  - 用完后给前端推送提示："您的免费试用已用完，后续将从余额扣费（每次约 ¥0.0X）"

### 第三轮确认（2026-05-15）

- **Q3 = A 三入口都做**：
  - 全局悬浮按钮（fixed bottom-right，登录后所有 console 页面可见）
  - 侧边栏菜单项「豆哥」（顶部位置）
  - 独立页面 `/console/agent`（全屏聊天）
  - 三入口共享同一套会话状态（用 React Context 或 zustand 类全局态管理）
- **Q10 = C 混合模式**：
  - 低风险写工具（建/删 Token）→ 聊天流卡片
  - 高风险（删除批量、调起支付 trigger_topup）→ Modal 强打断
  - 在 `ToolDefinition` 里加字段 `risk_level: "low" | "medium" | "high"`，前端按此渲染
- **Q11 = "豆哥"（自定义）**：
  - 与 CLAUDE.md Rule 5 不冲突（豆哥不替代 new-api / QuantumNous 品牌）
  - 默认头像：豆形态 emoji 或自绘 SVG（可后期加 mascot）
  - 默认 setting：`agent.display_name = "豆哥"`，管理员可改
  - 不沿用调研报告里的"AI 管家"和早期"知豆"代号
  - **注意**：CLAUDE.md / `.claude/skills/` 里仍保留 zhidou-* skill 名（这些是开发期工具名，不暴露给用户）
- **Q12 = C 中英双语 + 预留其他语言 key**：
  - i18n 文案 zh.json / en.json 同步增加
  - fr/ru/ja/vi 的 JSON 文件**预留 key 但不翻译**（后期用 `bun run i18n:sync` 让 fallback 到 zh）
  - Agent 的 system prompt 双语版本（管理员可在后台维护，由 setting 中 `agent.system_prompt_zh` / `agent.system_prompt_en` 控制）
  - 用户切语言时 Agent 自动切对应 system prompt

### 第四轮确认（2026-05-15）

- **Q5 = A 独立表 agent_audit_logs**（与 `02_phase1_backend.md` §4.3 一致）
- **Q6 = A 后端持久化**：
  - `agent_sessions` + `agent_messages` 落库
  - 用户登录后能跨设备/跨浏览器看历史
  - 历史侧栏分页加载（每页 20 条）
- **Q7 = A 永久保留**：
  - **⚠️ 数据增长警告**：消息表会一直涨，对运维有要求
  - 建议：
    - 表上 `created_at` 必加索引
    - 在 `cron/agent_archive.go` 预留归档脚本（按月归档到 `agent_messages_archive`，Phase 1 不实施但留接口位）
    - 大客户可手动开启"超过 N 天的会话压缩存储"（Phase 2 加）
- **Q4 = A 上线即全员可见**：
  - 全局开关：`setting.agent.enabled`（默认值 = false 直到管理员主动开）
  - 一旦开启 → 所有登录用户立即可见
  - **回滚预案**：管理员后台一键关闭，前端轮询 `/api/agent/config` 拿到 enabled=false 后立即移除入口（轮询频率：登录后一次 + 每 5 分钟）
  - 后端紧急熔断：当错误率 > 50% 持续 3 分钟，自动 set `agent.enabled = false`（触发条件可在 setting 调）

### 第五轮确认（2026-05-15）

- **Q13 = A 一次性 Phase 1 全部完成上线**：
  - 与 Q4「全员可见」配套，必须做扎实再放开
  - 内部测试期：管理员手动 `agent.enabled = true` 仅在 staging 环境，所有功能跑通后才在 prod 打开
  - **隐含约束**：所有 Phase 1 工具（含 RAG / 支付调起）必须**同期完成**，不能分批
- **Q18 = C 任何 5xx 重试 3 次**：
  - **⚠️ 雪崩警告**：与 Q4「全员可见」叠加后，上游 5xx → 3 次重试 × N 工具 × M 用户 = 流量放大风险
  - 强制配套护栏：
    - 重试间使用指数退避 + 抖动（500ms / 1.2s / 3s ± 30% jitter）
    - 单个 session 同一工具失败累计 3 次后冷却 30 秒
    - 配合 Q4 的"错误率熔断"自动关停 Agent
  - 实现位置：`service/agent/retry.go`（新增）
- **Q19 = A 一个人全栈**：
  - 顺序推进：先后端骨架 → 工具实现 → 前端 UI → 联调
  - 不 spawn 并行子 agent
  - 每完成一个里程碑跑一次 `zhidou-regression-gate`
- **Q20 = C 没硬约束，按范围评估**：
  - 综合本期决策（RAG 全量 + 支付调起 + Q8 解耦 + 全员可见 + 雪崩护栏 + 永久保留 + 三入口 + 双语），重新评估 Phase 1 工时
  - 评估结果将体现在 `08_final_scope.md` 的里程碑甘特里
  - 我会在动手前给出工时估算，超出预期会主动来跟你商量降范围
