# DeepRouter — PRD v0.1

> 文档状态：Draft v0.1 · 待评审
> 编写日期：2026-05-11（迁入 DeepRouter repo：2026-05-12）
> 作者：Lightman
> 平行文档：`DeepRouter-BP.md`（融资 BP）、`design.md`（设计系统）
> 上游开源项目：`QuantumNous/new-api`（32K stars，Go，fork 自 stalled 的 `songquanpeng/one-api`）
> 主要消费方（V0/V1）：
> - Airbotix Kids（见 `~/Documents/sites/airbotix/docs/product/prd/kids-ai-platform-prd.md` + `kids-opencode-spec.md`）
> - JR Academy（匠人学院）
> - 未来：C 端华人开发者 + 中小团队 + 企业客户（详见 `DeepRouter-BP.md`）
> 评审/讨论：TBD
>
> **本文档定位**：DeepRouter 是 Lightman 主导的**独立产品**（已 Pre-seed 融资轨道）。本 PRD 描述 V0 工程范围、架构、12 周执行计划、与各 tenant 消费方的接口契约。**Airbotix Kids 是 V0 阶段的两个主要 tenant 之一**（与 JR Academy 并列），其合规需求（`kids_mode`）作为 DeepRouter 的一项 tenant 功能交付。商业化定位与对外销售策略见 `DeepRouter-BP.md`，本文档不重复。

---

## 1. 背景与愿景

### 1.1 为什么 DeepRouter 要独立存在

Lightman 同时是两家需要 LLM 基础设施的公司创始人/CEO：

| 公司 | 角色 | LLM 用途 |
|---|---|---|
| **Airbotix** | K-12 AI + 机器人教育（澳洲 + 海外华人） | Kids OpenCode（agentic coding）、低龄创作平台（图像/TTS/音乐）、AI Tutor |
| **JR Academy 匠人学院** | 全球华人 AI/Coding 教育平台 | 已有的中文 AI 学习产品、Bootcamp、SigmaQ 测评 |

两家公司都需要：
- **多模型路由**（Anthropic / OpenAI / 国产豆包/Qwen/GLM/Kimi/DeepSeek）
- **统一 API**（OpenAI 兼容 `/v1`）
- **配额 / 计费 / 审计 / 密钥轮换**
- **内容安全策略**（其中 Airbotix Kids 是 kid-safe 极严，JR Academy 是成人内容可放开）

**结论**：与其在两家公司各建一套，不如建一个独立的多租户 Gateway，**Build once, leverage twice**。同时为未来 V2+ 对外 SaaS（其它华人 EdTech）保留路径。

### 1.2 一句话叙述

> **DeepRouter 是一个 OpenAI 兼容的多租户 LLM 网关，为多个产品/公司提供统一的多模型接入、按租户隔离的策略与计费，以及对中文模型供应商的一等公民支持。**

### 1.3 与 Airbotix 主线的关系

DeepRouter 是 Airbotix 3-Layer Stack 中 Layer 2 **Kids-Safe AI Platform** 的基础设施层。但它在产品形态上**独立**：

```
                                 ┌─ Airbotix Kids（airbotix-kids 租户）
                                 │     ├─ Kids OpenCode（旗舰）
DeepRouter（独立产品） ───────────┼─────└─ 低龄创作平台
                                 │
                                 ├─ JR Academy（jr-academy 租户）
                                 │     └─ 现有 AI 学习产品
                                 │
                                 └─ External-X（external-x 租户，V2+）
                                       └─ 未来 SaaS 客户
```

---

## 2. 产品范围与非目标

### 2.1 DeepRouter 是

- ✅ **多供应商 LLM 路由网关**（Anthropic、OpenAI、豆包、Qwen、GLM、Kimi、DeepSeek 等）
- ✅ **OpenAI 兼容 API**（`/v1/chat/completions`、`/v1/messages`、`/v1/embeddings`、`/v1/images/generations`）
- ✅ **跨协议转换层**（OpenAI ↔ Anthropic Messages ↔ Gemini，让上游消费者用一种协议、访问任意模型）
- ✅ **多租户隔离**（每个租户独立配额、策略、计费、审计）
- ✅ **内容策略中间件**（每租户可配的入口/出口过滤，kid-safe 注入）
- ✅ **管理后台**（fork 自 NewAPI，租户/供应商/密钥/日志/账单）

### 2.2 DeepRouter 不是

- ❌ **Agent 框架**（不做 ReAct、planning、tool orchestration —— 这是 Kids OpenCode / 上游消费者的职责）
- ❌ **微调平台**（不做训练、LoRA、模型托管）
- ❌ **向量数据库**（不做 RAG/Vector Store —— 用第三方）
- ❌ **Prompt 管理 SaaS**（不做 Prompt 版本控制、A/B 测试 IDE）
- ❌ **免费的公网 LLM 代理**（不是给陌生人免费跑模型，租户须经显式 onboard）

### 2.3 为什么以 NewAPI 为基础（关键决策）

调研了三个候选：`LiteLLM`、`portkey`、`QuantumNous/new-api`。最终选 NewAPI，原因：

| 维度 | LiteLLM | Portkey | **NewAPI** ✅ |
|---|---|---|---|
| 中文模型一等公民支持（豆包/Qwen/GLM/Kimi/DeepSeek） | ⚠️ 部分 | ⚠️ 部分 | ✅ 原生 |
| 内置 Admin UI | ❌ 需自建 | ✅ SaaS | ✅ 自带 |
| 内置 quota / key / billing 骨架 | ⚠️ 简陋 | ✅ | ✅ |
| 跨协议转换（OpenAI ↔ Claude ↔ Gemini） | ⚠️ 部分 | ✅ | ✅ |
| 部署形态 | Python 多依赖 | SaaS / self-host | Go 单 binary |
| Star / 活跃度 | 高 | 商业产品 | 32K，今日仍有 push |
| 中文社区维护者网络 | 弱 | 无 | 强（匹配 Lightman 网络） |
| 协议 | MIT | 商业 | Apache 2.0 |

**判断**：NewAPI 的内置功能覆盖 V0 范围的 70%，剩余 30%（多租户策略中间件 + 跨公司计费回调 + kid-safe 策略层）正是 DeepRouter 自有价值所在。

### 2.4 与上游 NewAPI 的关系

- Fork 到 `JR-Academy-AI` 组织，**公开 repo**，继承上游 AGPL v3.0 license
- 保留 upstream remote，定期 cherry-pick 上游 bugfix
- 商业模式与开源关系：参考 Supabase / Plausible / Cal.com —— **开源代码 + 卖 hosted SaaS + 企业支持/SLA/私有部署服务合同**。Hosted 服务 + 跨境链路工程化 + 合规闭环（发票/对公/SOC）+ 品牌信任 才是真正的护城河，不是源码闭锁
- 开源本身是正资产：吸引社区贡献内容过滤词表 / provider adapter / 多语言文档；中文开发者市场对"开源可审计"信任度高
- **关键设计原则：NewAPI 的"user"概念直接当我们的"租户"用**（每个租户就是 NewAPI 里的一个 user），不重写 schema。租户数量级是个位数（airbotix-kids / jr-academy / 未来个别 SaaS 客户），不是几千家庭。家庭级 Stars 扣减由 Airbotix Platform 自己做，DeepRouter 视角只看到"airbotix-kids 这个 user 总共调用多少"。
- 核心改造点（薄薄一层，不污染易 merge 目录）：
  - User 表加几个字段：`policy_profile` (enum: kid-safe / adult / passthrough)、`billing_webhook_url`、`custom_pricing_id`
  - 新增 `internal/policy/` 内容策略中间件（读 user.policy_profile 决定行为）
  - 新增 `internal/billing/` 计费回调（每请求结束 POST 到 user.billing_webhook_url）
  - 改 `web/` admin UI 加上面三个字段的编辑入口
- **V2 评估**：若分歧过大，考虑公开 fork 改名 `deeprouter` 单独维护

---

## 3. 用户 / 租户

DeepRouter 没有"终端用户"。它的"用户"是**租户（tenant）= 一个使用它的产品/公司**。

**设计原则**：租户就是 NewAPI 现成的 user concept，**不做额外抽象**。租户数量是个位数（不是 SaaS 那种几千几万家），所以不需要批量管理 / 自助注册 / 复杂权限模型。每个租户由 Super Admin 在 admin UI 手动创建，5 分钟搞定。家庭级 / 学生级 / 课堂级的细粒度计费是租户产品（Airbotix Platform、JR Academy）自己的事，DeepRouter 不关心。

### 3.1 三个 V0/V1 租户

| 租户 ID | 所属 | 用途 | 安全策略 | 计费模式 | V0 状态 |
|---|---|---|---|---|---|
| `airbotix-kids` | Airbotix | Kids OpenCode + 低龄创作平台 | **kid-safe 极严** | Airbotix Stars 扣减 | P0，Week 6 上线 |
| `jr-academy` | JR Academy 匠人学院 | 中文 AI 学习平台、Bootcamp、SigmaQ | 成人允许 / 教育合规 | JR 自有计费（DeepRouter 仅 metering） | P1，Week 12 上线 |
| `external-x` | 第三方 EdTech（未定） | 测试租户，验证 SaaS 形态 | 中等 | 月度 invoice（V2+） | V2 |

### 3.2 租户的差异化需求

| 维度 | airbotix-kids | jr-academy | external-x |
|---|---|---|---|
| 默认 system prompt 注入 | 强儿童安全 + 不假装人类 | 教学者助手 | 客户自定义 |
| 输入过滤强度 | 极严（暴力/性/政治/自残） | 教育内容白名单 | 客户配置 |
| 输出过滤强度 | NSFW + 暴力 + 恐怖 | 教育合规 | 客户配置 |
| 默认模型 | Claude Haiku / Doubao Lite（成本敏感） | Claude Sonnet / Qwen-Max | 客户选 |
| 主区域 | SG + AU | SG + CN 代理 | 全球 |
| 计费 | Stars 扣减 webhook | 度量 webhook 推 JR 自有账单 | DeepRouter 直接月度账单 |
| 模态 | Chat + Image + TTS | Chat + Embeddings + Code | 全 |

### 3.3 租户 onboard 流程（Admin UI）

```
[Super Admin]
  └─ 新建租户 → 填基础信息（名称 / 联系人 / 区域 / 默认模型组）
       └─ 生成租户 API key
       └─ 设置默认策略（从 template 选 kid-safe / adult / passthrough）
       └─ 设置配额上限（RPM / TPM / 月度 token 上限 / 月度成本上限）
       └─ 设置计费 webhook URL（每请求结束 POST 到此 URL）
[租户产品集成]
  └─ 设 base_url = https://api.deeprouter.ai/v1
  └─ 设 api_key = tenant_xxx
  └─ 开始用，像调 OpenAI 一样
```

---

## 4. 核心功能

### 4.1 功能清单（V0）

| 编号 | 功能 | 优先级 | 来源 |
|---|---|---|---|
| F1 | 多供应商路由（≥ 5 个 provider） | P0 | NewAPI 自带 + 扩展 |
| F2 | OpenAI 兼容 `/v1/chat/completions`（流式 + 非流式） | **P0**（卡 Kids OpenCode） | NewAPI |
| F3 | OpenAI 兼容 `/v1/messages`（Anthropic 格式） | P0 | NewAPI |
| F4 | OpenAI 兼容 `/v1/embeddings` | P1 | NewAPI |
| F5 | OpenAI 兼容 `/v1/images/generations` | P1 | NewAPI |
| F6 | 跨协议转换（OpenAI ↔ Anthropic ↔ Gemini） | **P0** | NewAPI |
| F7 | 多租户隔离（用 NewAPI 自带 user 隔离 + 加 `policy_profile` / `billing_webhook_url` 字段） | P0 | NewAPI + 薄扩展 |
| F8 | 每租户策略中间件（kid-safe 注入 / 过滤） | **P0**（自建） | 自建 |
| F9 | 每租户配额（RPM / TPM / 月度上限） | P0 | NewAPI 扩展 |
| F10 | 每租户计费 webhook | **P0**（自建） | 自建 |
| F11 | 审计日志（每租户独立，留存 90 天） | P0 | NewAPI 扩展 |
| F12 | Admin UI（租户管理、供应商配置、密钥轮换） | P0 | NewAPI fork |
| F13 | Provider 故障 failover（同等级模型组内） | P1 | NewAPI |
| F14 | 按租户的 Prometheus 指标 | P2 | 自建 |

### 4.2 跨协议转换（关键差异化）

Kids OpenCode（fork 自 `opencode`）原生用 **OpenAI API 协议**对接模型层。但 Kids OpenCode 实际要用的最强模型可能是 **Claude**（agentic 表现最好）或 **Gemini Flash**（成本最低）。

DeepRouter 跨协议层让消费者**一次集成、随时切换模型**：

```
[Kids OpenCode]
  └─ 用 OpenAI SDK 调 POST /v1/chat/completions
       (model="claude-3-5-sonnet" 或 model="gemini-2.0-flash")
            ↓
       [DeepRouter 跨协议层]
            ├─ if model 属于 Anthropic → 翻译成 /v1/messages 调 Anthropic
            ├─ if model 属于 Gemini → 翻译成 Gemini API
            └─ if model 属于 OpenAI → 透传
            ↓
       响应再翻译回 OpenAI Chat Completion 格式
```

**坑位**（V0 必须覆盖）：
- `tool_calls` ↔ Anthropic `tool_use` 的映射
- 多轮工具调用历史的格式互转
- 流式 SSE 分包对齐
- `system` prompt 位置差异（OpenAI 在 messages 内 / Anthropic 在顶层）

NewAPI 已实现大部分，需补 V0 测试用例 + 修真实使用时发现的 bug。

### 4.3 Provider 优先级（V0）

| 优先级 | Provider | 用途 | 备注 |
|---|---|---|---|
| P0 | Anthropic | Claude，Kids OpenCode agentic 主力 | 全球；**HK 不可用**，国内用户走 SG 节点 |
| P0 | OpenAI | GPT-4o-mini，低成本对话 | 全球 |
| P0 | 豆包 / Doubao | 中文场景成本低，JR Academy 主力 | 火山引擎 |
| P0 | DeepSeek | 性价比之王，code 任务备选 | 直连 |
| P1 | Qwen | 阿里通义，多模态备选 | 阿里云 |
| P1 | GLM / 智谱 | GLM-4，中文研究强 | 直连 |
| P2 | Kimi / Moonshot | 长上下文场景 | 直连 |
| P2 | Google Gemini | Flash 极低价 fallback | 全球 |
| P2 | 自托管开源模型 | Llama / Qwen-self-hosted，未来 cost 控制 | V1+ |

### 4.4 不在 V0 范围

- ❌ 自动 prompt 缓存（V1）
- ❌ 多区域 active-active 部署（V1）
- ❌ Per-user 计费（DeepRouter 视角只到 tenant，租户内部 per-user 由租户产品自己管）
- ❌ 自定义模型托管（V2+）
- ❌ 公开 marketplace（V2+）

---

## 5. 架构

### 5.1 高层架构图

```
┌─────────────────────────────────────────────────────────────┐
│                       Consumers（按租户）                       │
│                                                              │
│  Airbotix Kids OpenCode     JR Academy        External-X     │
│  Airbotix 低龄创作              Bootcamp / SigmaQ              │
└────────────┬──────────────────┬─────────────────┬────────────┘
             │ OpenAI-compat    │ OpenAI-compat   │
             │ Bearer tenant_*  │ Bearer tenant_* │
             ▼                  ▼                 ▼
┌─────────────────────────────────────────────────────────────┐
│                        DeepRouter                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  API Gateway 层（OpenAI 兼容 /v1/*）                  │    │
│  └────────────┬─────────────────────────────────────────┘    │
│               ▼                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Tenant Resolver（NewAPI 现成：API key → User）       │    │
│  └────────────┬─────────────────────────────────────────┘    │
│               ▼                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Policy Middleware（kid-safe 注入 / 过滤）            │    │
│  │  - System prompt injection                            │    │
│  │  - Input filter（黑名单 + LLM classifier）            │    │
│  │  - Quota check（RPM/TPM/月度）                        │    │
│  └────────────┬─────────────────────────────────────────┘    │
│               ▼                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Protocol Adapter（OpenAI ↔ Anthropic ↔ Gemini）      │    │
│  └────────────┬─────────────────────────────────────────┘    │
│               ▼                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Provider Pool（多 provider，failover）               │    │
│  └────────────┬─────────────────────────────────────────┘    │
│               ▼ （响应返回路径）                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Output Filter（NSFW / 暴力 / 教学合规）              │    │
│  └────────────┬─────────────────────────────────────────┘    │
│               ▼                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Billing Hook（POST tenant_billing_webhook）          │    │
│  │  Audit Log（per-tenant，保留 90 天）                  │    │
│  └────────────┬─────────────────────────────────────────┘    │
└───────────────┼──────────────────────────────────────────────┘
                ▼
   ┌──────────────────────────────────────────────────────┐
   │  Providers: Anthropic / OpenAI / Doubao / DeepSeek    │
   │             / Qwen / GLM / Kimi / Gemini              │
   └──────────────────────────────────────────────────────┘

   ┌──────────────────────────────────────────────────────┐
   │  Admin UI（fork NewAPI 后台）                          │
   │  - 租户管理 / 供应商配置 / 密钥 / 日志 / 账单           │
   └──────────────────────────────────────────────────────┘
```

### 5.2 组件清单

| 组件 | 来源 | 自建/继承 | 备注 |
|---|---|---|---|
| API Gateway 层 | NewAPI | 继承 | Gin 框架 |
| Tenant Resolver | NewAPI | 继承 | 现成 API key → User 映射；DeepRouter 仅加 `kids_mode` / `policy_profile` / `billing_webhook_url` 三个字段 |
| Policy Middleware | 自建 | **自建** | V0 自建核心代码大部分在此 |
| Protocol Adapter | NewAPI | 继承 + 修 | 跨协议转换 |
| Provider Pool | NewAPI | 继承 + 扩 | 加豆包/Qwen/DeepSeek 必要时补 |
| Output Filter | 自建 | **自建** | 复用 Airbotix Kids 安全 classifier 接口 |
| Billing Hook | 自建 | **自建** | Webhook 调用，重试，幂等 |
| Audit Log | NewAPI | 继承 + 扩 | 加 tenant_id 索引 |
| Admin UI | NewAPI | Fork + 改 | React，加多租户视图 |
| DB（Postgres） | NewAPI | 继承 | NewAPI 默认 SQLite，V0 切 Postgres |
| Cache / RL（Redis） | NewAPI | 继承 | 限流、缓存 |

### 5.3 技术栈

| 层 | 选型 | 原因 |
|---|---|---|
| 语言 | Go 1.22+ | NewAPI 原生 |
| Web 框架 | Gin | NewAPI 自带 |
| 数据库 | PostgreSQL 15 | RDS / Supabase / self-host |
| 缓存 | Redis 7 | 限流、token bucket |
| 部署 | Docker + Fly.io（V0）/ VPS（V1+） | 单 binary，启动快 |
| 监控 | Prometheus + Grafana（V1） | 标准 |
| 日志 | JSON 结构化 → 对象存储 | 留存 90 天 |
| 域名 | `api.deeprouter.ai` / `admin.deeprouter.ai` | 域名待定，见 D-DR3 |

### 5.4 部署形态

**V0**：
- 单区域单实例 + 备用（Fly.io SG region 或 SG VPS）
- Postgres 单实例（带每日备份）
- Redis 单实例
- 域名 + Cloudflare（DDoS 兜底）

**V1**：
- 多区域 active-passive（SG 主 + AU 备 + 可选 US-West）
- 读副本

### 5.5 Provider Key Pool（多 key 轮换，V0 必须）

**背景**：上游 provider（特别是 Anthropic）按账号级别分 Tier，每 Tier 决定 RPM/TPM 上限。

**Anthropic Tier 真实约束**（Workshop V0 算账）：
- Tier 1（默认新账号）RPM 极低（≈ 50 量级），20 个孩子并发 100-200 RPM **直接打爆**
- Tier 2 需 $40 累计 + 7 天等待
- Tier 3 需 $200 累计 + 7 天
- Tier 4 需 $400 累计 + 14 天
- → **充钱不能立即升级，必须提前累计**

**解决方案：单 provider 多 key + NewAPI 现成的 Channel 机制**

NewAPI 的"Channel"概念允许**同一 provider 配置多个 key**，每个 key 是一个独立 Channel，DeepRouter 在 channel pool 内做路由。

```
Anthropic Provider Pool（V0 启动时）:
  ├─ Channel #1: airbotix-prod-1   (Tier 3+)  weight=10   primary
  ├─ Channel #2: airbotix-prod-2   (Tier 2)   weight=5    burst
  ├─ Channel #3: airbotix-dev      (Tier 2)   weight=2    fallback
  └─ Channel #4: airbotix-backup   (Tier 1)   weight=1    emergency only
```

**Channel 元数据**（NewAPI 已有 + 我们加少量）：

| 字段 | 来源 | 用途 |
|---|---|---|
| `key` | NewAPI | 上游 API key（加密存储） |
| `provider_type` | NewAPI | anthropic / openai / doubao / ... |
| `priority` | NewAPI | 优先级（高优先级 key 先用） |
| `weight` | NewAPI | 同优先级内的权重分配 |
| `status` | NewAPI | active / disabled / auto-disabled |
| `tier_label`（新增）| 自建 | "tier-3" 等，仅作运维标签 |
| `account_owner_label`（新增）| 自建 | "airbotix-prod" 等，用于成本归属 |
| `rpm_budget` / `tpm_budget`（新增）| 自建 | 这个 key 当前 Tier 的理论上限，给 DeepRouter 做客户端 token bucket |

**路由策略**（V0 推荐）：

1. 按 priority 降序选可用 channel
2. 同 priority 内按 weight 分配
3. 每个 channel 维护客户端 token bucket（按其 `rpm_budget`）
4. 选中 channel 时尝试扣 bucket，扣不到 → 试下一个 channel
5. 所有 channel bucket 耗尽 → 进入 §6.5 限流处理

### 5.6 部署 V1 演进
- 读副本 / 多区域 active-passive
- Channel 自动 tier 探测（自动校准 rpm_budget）
- Cost 异常告警自动 disable key

---

## 6. 策略中间件（V0 自建代码主体）

DeepRouter V0 的核心差异化 = 多租户策略中间件。这部分代码大部分要自建。

### 6.1 入口流程

```
请求进入 → tenant 已识别
    ↓
[Step 1] 加载租户 policy 配置
    ↓
[Step 2] System prompt 注入
    - airbotix-kids: "You are a kid-friendly AI tutor. Never pretend to be human. Refuse adult topics."
    - jr-academy: "You are a teaching assistant for Chinese learners."
    - external-x: 客户自定义
    ↓
[Step 3] Input filter
    - 黑名单关键词检查（每租户独立词表）
    - LLM-as-classifier 二次判断（仅 airbotix-kids 启用）
    - 命中 → 返回 403 + reason，**不消耗 token**
    ↓
[Step 4] Tenant Quota check（下游/租户侧）
    - 当前租户 RPM / TPM / 月度 token / 月度 cost 是否超限
    - 超限 → 返回 429（明确："tenant_quota_exceeded"）
    ↓
[Step 4.5] Upstream Key Selection（上游/provider 侧，见 §6.5）
    - 按 §5.5 路由策略从 Channel Pool 选可用 key
    - 所有 key bucket 耗尽 → 进入排队 / 503
    ↓
[Step 5] 转发到 Provider（用选中的 key）
```

### 6.5 上游限流处理（§5.5 配套）

DeepRouter 必须区分**两种限流**，错误码也不同：
- **Tenant quota exhausted**：租户自己的预算/RPM 用完 → 返回 429，错误码 `tenant_quota_exceeded`，**不**应该 retry
- **Upstream key exhausted**：所有上游 key bucket 都打满 → 返回 503，错误码 `upstream_capacity_exceeded`，**可** retry

#### 6.5.1 选 key 算法（伪代码）

```python
def select_channel(provider, requested_model):
    candidates = [c for c in channels[provider]
                  if c.status == 'active'
                  and requested_model in c.supported_models]
    candidates.sort(key=lambda c: (-c.priority, -c.weight))
    
    for channel in candidates:
        if channel.token_bucket.try_acquire(1):
            return channel
    
    # 所有 key bucket 都耗尽
    return None  # 进入 6.5.2 排队 / 503
```

#### 6.5.2 全 pool 耗尽时的行为

| Tenant 配置 | 行为 |
|---|---|
| `upstream_overflow_policy: queue` | 持连接最多 N 秒等 bucket 回填；超时 → 503 |
| `upstream_overflow_policy: reject` | 立刻 503 |

**默认**：`airbotix-kids` tenant = `queue`，N=5 秒（Workshop 课堂体验优先；agent loop 偶尔等 5 秒可接受）。`jr-academy` = `reject`（他们自己重试更可控）。

#### 6.5.3 单 key 失败处理

| Upstream 返回 | DeepRouter 行为 |
|---|---|
| 429（provider rate limit）| 标记该 channel bucket 当前窗口耗尽，本请求 retry 下一个 channel；窗口结束自动恢复 |
| 401 / 403（key 失效/封禁）| 立即将 channel 标 `auto-disabled`，**触发 PagerDuty**，本请求 retry 下一个 channel |
| 5xx（provider 故障）| 临时降权该 channel（weight × 0.3，5 分钟恢复），本请求 retry 下一个 channel |
| 网络超时 | 同 5xx |

#### 6.5.4 Anthropic V0 启动策略（关键操作！）

**Workshop V0 之前的 12 周窗口必须执行**：

| Week | 动作 | 谁 |
|---|---|---|
| Week 0（立即）| Lightman 用 Airbotix 公司账号给 Anthropic 充值 $500，**开始累计 Tier** | Lightman |
| Week 0-2 | Joe 与 Team A 用该 key 做开发 + spike，自然产生消耗 | Joe + Team A |
| Week 2 | 申请开第二个 Anthropic 账号（airbotix-prod-2），充 $100 | Lightman |
| Week 4 | 第一个账号应到 Tier 2（$40 累计 + 7 天），第二个开始累计 | — |
| Week 8 | 第一个账号到 Tier 3（$200 累计 + 7 天）| — |
| Week 11 | 第一个账号到 Tier 4（$400 累计 + 14 天），第二个到 Tier 2/3 | — |
| Week 12 (Workshop V0)| 主 key Tier 4 + 备 key Tier 2-3，**预算 RPM > 4000，覆盖 200 RPM workshop 需求 20 倍 buffer** | — |

**关键提示**：Tier 升级是 (累计金额 + 等待天数) 双条件，不能用钱"跳级"。所以必须 Week 0 启动累计，不能等 Week 10 才开始。

#### 6.5.5 OpenAI Tier 同样适用

OpenAI 也有 Tier，但 Tier 1 即 500 RPM（远好于 Anthropic），workshop 场景下单 key 通常够。仍建议配 2 个 OpenAI key 用于 burst + 成本归属。



### 6.2 出口流程

```
Provider 返回 → 
    ↓
[Step 1] Output filter
    - 文本：再次过滤（防止生成不当评论或恶意代码）
    - 图像：NSFW classifier（airbotix-kids 严，jr-academy 宽）
    - 命中 → 替换为安全 fallback + 不计入用户配额（但仍计入 cost 因为 provider 已扣费）
    ↓
[Step 2] Billing hook
    - POST tenant.billing_webhook_url
    - body: { request_id, tenant_id, model, prompt_tokens, completion_tokens, 
              image_count, cost_usd, timestamp }
    - 失败重试 3 次（指数退避）+ 死信队列
    ↓
[Step 3] Audit log
    - 写入 tenant-specific 表，保留 90 天
    ↓
返回给客户端
```

### 6.3 策略覆盖路径

| 场景 | airbotix-kids | jr-academy |
|---|---|---|
| 用户问"如何制造炸弹" | ❌ 入口拒绝 + 警告记录 | ❌ 入口拒绝 |
| 用户问"什么是恋爱" | ⚠️ 引导到年龄适宜回答 | ✅ 正常回答 |
| 用户求成人小说创作 | ❌ 拒绝 | ⚠️ 教学场景允许文学讨论 |
| 代码生成含 `os.system("rm -rf /")` | ❌ 出口过滤 + 替换 | ⚠️ 加警告但不替换（教学价值） |
| 用户问编程问题 | ✅ | ✅ |

### 6.4-pre Kids 模式（tenant-level 一键开关，硬约束集合）

合规要求（来自 `docs/product/compliance/minors-compliance.md`）不散在各处，而是收成一个**租户级布尔开关** `kids_mode`。开启后，下列行为**自动且不可被配置覆盖**：

| 自动行为 | 实现 |
|---|---|
| 上游请求 strip 所有可识别孩子身份的 metadata | request header / body 里的 `user_id` / `kid_profile_id` / `family_id` / `user_agent` 等字段在转发前清除；仅保留 `tenant_id`（外部不可识别个体） |
| OpenAI 类 provider 强制 `store: false`（ZDR） | Protocol Adapter 在调 OpenAI 系列前注入；任何代码路径不允许绕过 |
| Anthropic 类 provider 优先用官方 child-safety system prompt | 若 Anthropic 发布官方 prompt，自动注入；fallback 用 Airbotix 自家 kid-safe prompt |
| Input filter 强制 LLM classifier（不只黑名单） | 即使 tenant policy 关闭 LLM classifier，`kids_mode` 也强行启用 |
| Output filter 强制最严档（NSFW + 暴力 + 仇恨）| 不允许 tenant 配置宽松档 |
| 模型选择限定 "kids-safe model whitelist" | 每个 provider 标记 `kids_eligible: bool`；非 eligible 的模型即使被 client 请求也拒绝并 fallback |
| 审计日志强制 100% 留存（不允许采样） | 不可被配置覆盖 |

**对 airbotix-kids tenant**：`kids_mode = true`（永久锁定，admin UI 不允许关闭）。
**对 jr-academy tenant**：`kids_mode = false`（成人学习场景）。
**对 external-x tenant（未来 SaaS）**：客户可选；若为儿童产品强烈推荐开启。

**实现层**：这是一个 schema 上的 `users.kids_mode` boolean 字段，但其触发的行为分散在 Tenant Resolver、Protocol Adapter、Policy Middleware、Provider Pool 各层。每一层在 V0 实现时**必须有 unit test 覆盖 kids_mode=true 时的硬约束行为**，否则视为安全缺陷。

### 6.4 策略配置示例（YAML，存 DB）

```yaml
tenant: airbotix-kids
kids_mode: true                 # ← 一旦 true，下方很多设置被硬约束 override（见 §6.4-pre）
system_prompt: |
  You are a kid-friendly AI tutor for ages 6-15...
input_filter:
  blocklist_id: kids_strict_v1
  llm_classifier: enabled        # kids_mode=true 强制 enabled
  classifier_model: claude-3-haiku
output_filter:
  text_classifier: enabled       # kids_mode=true 强制 enabled
  image_nsfw: strict             # kids_mode=true 强制 strict
  code_dangerous_api: replace
metadata_strip:                  # kids_mode=true 自动启用全部
  strip_user_id: true
  strip_user_agent: true
  strip_kid_profile_id: true
quota:
  rpm: 60                        # tenant 侧限流
  tpm: 100000
  monthly_token: 示例占位         # 真实 per-tenant 配置
  monthly_cost_usd: 示例占位
billing:
  webhook_url: https://api.airbotix.ai/internal/deeprouter/billing
  webhook_secret: ${AIRBOTIX_WEBHOOK_SECRET}
upstream_overflow_policy: queue  # queue / reject，详见 §6.5.2
upstream_queue_window_sec: 5
```

---

## 7. 计费 & Stars 集成

### 7.1 计费模型

DeepRouter 内部对 provider 按真实 token 计费（USD）。对外按租户配置：

| 租户 | DeepRouter → 租户 计费方式 |
|---|---|
| `airbotix-kids` | DeepRouter 每请求结束 → POST Airbotix `/internal/deeprouter/billing` → Airbotix Stars 系统扣减 |
| `jr-academy` | DeepRouter 每请求结束 → POST JR Academy 度量端点 → JR 自有账单系统结算 |
| `external-x`（V2+） | DeepRouter 累计 → 月度发送 invoice + Stripe 自动收款 |

### 7.2 与 Airbotix Stars Pack 的映射

Airbotix Stars Pack（来自 `kids-ai-platform-prd.md` §8.3）：

| Pack | 价格 (AUD) | Stars | 单价 |
|---|---|---|---|
| Starter | $10 | 100 ⭐ | $0.10 |
| Family | $30 | 350 ⭐ | $0.086 (+16%) |
| Mega | $50 | 650 ⭐ | $0.077 (+30%) |
| School | $100 | 1500 ⭐ | $0.067 (+50%) |

**单 Star 平均价格 ≈ $0.08 AUD ≈ $0.052 USD**。

**Stars 消耗映射**（DeepRouter 计算 cost → Airbotix 扣 Stars）：

| 动作 | DeepRouter 内部成本 (USD) | Airbotix 收 Stars | 毛利 |
|---|---|---|---|
| Chat round-trip (1K in + 0.5K out Haiku) | $0.0008 | 1 ⭐ ≈ $0.052 | ~98% |
| Coding round-trip (Sonnet, 2K + 1K) | $0.020 | 1-2 ⭐ | ~50% |
| 长上下文 coding (50K + 4K, Sonnet) | $0.21 | 5-7 ⭐ | ~30% |
| AI 图像 1024 HD | $0.04 | 3 ⭐ ≈ $0.156 | ~75% |
| AI Tutor 短对话 | $0.0002 | 0.2-0.5 ⭐ | ~95% |

**毛利目标**：≥ 40%（来自 Airbotix BP），DeepRouter 设计本身贡献 ~20-30% 透明加价，剩余空间靠 Stars Pack 加价（+16% 到 +50% bonus）。

### 7.2.1 责任边界（重要）

**Platform 永远只看 Stars，不暴露真实模型成本给消费端**。模型选型与单 Star 毛利目标是 **DeepRouter 的职责**，消费端（Airbotix Platform / Kids OpenCode）不需要知道 gpt-image-1 vs Flux Schnell 的差价。

- 上表是 V0 启动时的初始映射；DeepRouter 团队负责持续维护
- 当上游模型涨价 / 新模型上线 / 我们切到更便宜的同质 provider 时，DeepRouter **自由调整后端模型选择**（在质量约束内）以保持单 Star 毛利 ≥ 40%
- 极端情况短期被吃穿毛利，DeepRouter 团队上报，由商务决定：调 Stars 消耗表 / 切模型 / 容忍
- 因此 Platform PRD §9 Stars 消耗表是**面向用户的稳定承诺**，不会随上游成本日常变动 —— 真实成本管理在 DeepRouter 这层吸收

### 7.3 计费 webhook 协议

```
POST {tenant.billing_webhook_url}
Headers: X-DeepRouter-Signature: HMAC-SHA256({secret}, {body})
Body:
{
  "request_id": "req_abc123",
  "tenant_id": "airbotix-kids",
  "kid_profile_id": "...",        // 由消费端通过 X-Tenant-User header 传入
  "model": "claude-3-5-haiku",
  "provider": "anthropic",
  "prompt_tokens": 1200,
  "completion_tokens": 480,
  "image_count": 0,
  "cost_usd": 0.00084,
  "policy_violations": [],
  "started_at": "2026-05-11T12:00:00Z",
  "finished_at": "2026-05-11T12:00:02Z"
}
```

Airbotix 端实现 webhook handler → 根据 cost_usd 折算 Stars → 扣减对应 kid_profile_id 的家庭钱包。

### 7.4 一致性

- DeepRouter 端**只负责按 cost 通知**，不直接管 Stars 余额
- 余额检查由 Airbotix 在**请求前**通过自家 API 做（DeepRouter 不知道用户余额）
- 若 Airbotix 检查失败，根本不会发出对 DeepRouter 的请求

---

## 8. 12 周并行执行计划

> 与 Airbotix Kids OpenCode（Team B）、低龄创作平台（Team C）并行。DeepRouter 是 **Team A**。

### 8.1 关键依赖

```
Week 1 ─────────── Week 4 ────────── Week 6 ──────── Week 12

Team A (DeepRouter): │ fork & 本地  │ 多租户  │ /v1 上线 │ providers + 策略 │ JR onboard │
Team B (Kids OpenCode): │ fork opencode │ wire DeepRouter │ kid-safe agent │ stars 集成 │
Team C (低龄创作平台):    │ UI 设计 │ Stars / Wallet │ image / TTS │ V0 集成测试 │
                                                  ▲
                                                  └── Team B 强依赖 Week 6 DeepRouter /v1
```

### 8.2 Week-by-week

**Week 0（不在 12 周内但必须做）— Anthropic Tier 累计启动**

- [ ] **Lightman**：Airbotix 公司 Anthropic 账号充值 $500，启动 Tier 累计（见 §6.5.4）
- [ ] **Lightman**：注册第二个 Anthropic 账号 airbotix-prod-2 备用
- [ ] **Lightman**：申请 OpenAI / 豆包 / DeepSeek 公司账号 key

> ⚠️ Tier 升级需"累计金额 + 等待天数"双条件，**不能延后**。Week 0 不做 = Workshop V0 必挂。

**Week 1-2**：基础

- [ ] Fork `QuantumNous/new-api` 到 `JR-Academy-AI` org，**公开 repo**（继承 AGPL v3.0，与 Supabase/Plausible 同模式）
- [ ] 本地 docker-compose 跑起来（Postgres + Redis + Go server + Web UI）
- [ ] 代码 deep dive：读 routing、provider adapter、protocol converter、**Channel 机制**
- [ ] 注册 `deeprouter.ai`（D-DR3）
- [ ] 将 Week 0 申请的 keys 录入 NewAPI Channel 配置
- [ ] 写 `ARCHITECTURE.md` 描述自建模块边界

**Week 3-4**：策略 + 计费薄层（直接复用 NewAPI 现成 user 模型作为租户）

- [ ] User 表加三个字段：`policy_profile` (enum) / `billing_webhook_url` / `custom_pricing_id`
- [ ] `internal/policy/` 中间件骨架：根据 user.policy_profile 注入 system prompt / 过滤 input
- [ ] `internal/billing/` 计费 hook：每请求结束 POST 到 user.billing_webhook_url
- [ ] Admin UI 在 user 编辑页加上面三个字段的入口
- [ ] 创建三个测试 user：`airbotix-kids`、`jr-academy-test`、`external-x-test`
- [ ] e2e 测试：同一 endpoint 用不同 API key 调用，policy 行为不同

**Week 5-6**：**P0 里程碑 — OpenAI 兼容 `/v1` 上线**

- [ ] `/v1/chat/completions` 跑通（OpenAI / Anthropic 两个 provider）
- [ ] 跨协议转换 e2e 测试（model=claude-3-5-sonnet 用 OpenAI SDK 调通）
- [ ] 流式 SSE 测试通过
- [ ] 配额检查（RPM / TPM）跑通
- [ ] **里程碑：Kids OpenCode dev 环境用 DeepRouter base_url 跑通第一个对话**
- [ ] 部署到 staging（Fly.io）

**Week 7-8**：Provider 集成 + 多 Key 限流

- [ ] 豆包 provider 适配 + 测试
- [ ] DeepSeek provider 适配 + 测试
- [ ] Qwen provider 适配（如时间允许）
- [ ] **多 Channel 配置 + 客户端 token bucket（§5.5、§6.5）**
- [ ] **`tenant_quota_exceeded` (429) vs `upstream_capacity_exceeded` (503) 错误码区分**
- [ ] **Channel auto-disable on 401/403 + PagerDuty 告警**
- [ ] **`upstream_overflow_policy: queue` 排队逻辑实现 + 测试**
- [ ] Provider failover 逻辑测试（同等级模型组）
- [ ] **burst 压测：模拟 20 个 workshop 孩子同时启动，全程 200 RPM 持续 10 分钟，零 503**
- [ ] 真实成本核算表更新

**Week 9-10**：策略中间件 + 计费

- [ ] System prompt 注入逻辑
- [ ] Input filter（blocklist + LLM classifier）
- [ ] Output filter（文本 / NSFW 图像）
- [ ] Billing webhook 实现 + 重试 + 死信
- [ ] Airbotix 端实现 `/internal/deeprouter/billing` handler
- [ ] e2e 测试：airbotix-kids 完整请求 → Stars 扣减成功

**Week 11-12**：JR Academy POC

- [ ] JR Academy 团队对齐 metering 协议
- [ ] JR 现有 LLM 调用代理到 DeepRouter（先 1% 流量）
- [ ] 监控 + 对账（DeepRouter cost vs JR 自有账单）
- [ ] 灰度放量到 100%
- [ ] **里程碑：JR Academy 当日 ≥ 1M token 走 DeepRouter，零事故**

### 8.3 团队配置建议

| Team | 人 | 角色 |
|---|---|---|
| Team A (DeepRouter) | 1 Go 工程师 + 0.5 Lightman（架构 review） | 全栈 Go |
| Team B (Kids OpenCode) | 1-2 TS/Go 工程师 + Joe（ex-Google） | Fork opencode |
| Team C (低龄创作平台) | 1 前端 + 0.5 后端 | React + Supabase |

---

## 9. 待决策项（Open Decisions）

| ID | 决策项 | 重要性 | 推荐 / 状态 |
|---|---|---|---|
| ~~D-DR1~~ | ~~部署区域：AU / HK / SG / 多区域~~ | — | ✅ **已决策（2026-05-11）：SG（新加坡）**。HK 排除（Anthropic / OpenAI 明确不服务 HK）；SG 是唯一同时满足 Anthropic/OpenAI 可达 + 华人用户合理延迟 + 中国 provider 可达的选项。AU 数据本地化由消费端单独处理 |
| **D-DR2** | 长期定位：永远内部 / 未来 SaaS 化 | 高 | 推荐**架构上为 SaaS 准备，商业上 V0-V1 只服务自有租户**。即代码不写死"只有两个租户"，但不投入 marketing 资源 |
| **D-DR3** | 域名：`deeprouter.ai` / `.io` / `.com` / 备选 | 中 | 优先 `.ai`，被占则 `.dev` 或 `deeproute.ai`。Week 1 立即查域名注册 |
| **D-DR4** | 品牌：独立品牌 / "Powered by Airbotix" 子品牌 | 中 | V0-V1 用**独立品牌**（避免对 JR Academy 客户暴露 Airbotix 品牌错位）。V2 视 SaaS 化决策再定 |
| **D-DR5** | 是否开源策略层 | 中 | V2 评估。开源策略层可吸引社区贡献内容过滤词表，但暴露内部安全细节 |
| D-DR6 | Output filter 失败时的 fallback 策略 | 中 | "礼貌拒绝"模板 vs 重新生成。V0 用模板（成本低） |
| D-DR7 | Audit log 留存超 90 天的法规要求 | 中 | 需法务确认 AU + CN 双标准 |
| D-DR8 | 模型成本异常波动时的告警阈值 | 低 | V0 设置 daily cost > 2x 7-day-avg 触发 PagerDuty |
| D-DR9 | NewAPI upstream 分歧策略 | 低 | 每月 cherry-pick；分歧 > 30% 时考虑改名独立 |

---

## 10. 成功指标

### 10.1 Week 6 里程碑（P0 卡 Kids OpenCode）

- ✅ `POST /v1/chat/completions` 在 dev 环境返回 200
- ✅ Kids OpenCode 集成 DeepRouter 成功跑通第一个 agentic 工具调用循环
- ✅ 三个测试租户隔离验证通过（无串数据）
- ✅ 跨协议转换 e2e 测试通过（OpenAI client → Claude / Gemini）

### 10.2 Week 12 里程碑

- ✅ JR Academy 当日 ≥ **1M token** 通过 DeepRouter，零事故 24h
- ✅ Airbotix Kids dev cohort（≥ 20 个孩子档案）至少使用一次
- ✅ Billing webhook 投递成功率 ≥ 99.5%
- ✅ p95 延迟 < provider 原生 +50ms

### 10.3 经济指标

| 指标 | 目标 |
|---|---|
| 整体毛利（token 转售） | ≥ 30%（目标 40%+） |
| Provider 真实成本占 Airbotix 收入比 | ≤ 60% |
| 每月运行成本（infra） | ≤ $300 USD（V0） |

### 10.4 安全 / 质量指标

| 指标 | 目标 |
|---|---|
| 内容策略违反命中率（test set 召回） | ≥ 95% |
| 误杀率（false positive） | ≤ 2% |
| 跨租户串数据事故 | **0**（任何 1 次即重大事故） |
| API 可用性 | ≥ 99.5%（V0），≥ 99.9%（V1） |
| 审计日志完整性 | 100%（每个请求都能追溯） |

### 10.5 上游容量指标（Anthropic 多 key 健康度）

| 指标 | 目标 |
|---|---|
| Channel pool 日均利用率（峰值时段）| < 80%（保留 20% buffer 应对突发） |
| `upstream_capacity_exceeded` (503) 占比 | < 1% 总请求 |
| Channel auto-disable 事件 | < 1 次/月（多了说明 key 不健康或被封）|
| Workshop V0 启动周（Week 12）Anthropic 主 key Tier | ≥ Tier 3，理想 Tier 4 |
| Anthropic 累计消费进度（Week 8 检查点）| ≥ $200（确保 Tier 3 可达）|

---

## 11. 风险

| 风险 | 等级 | 缓解 |
|---|---|---|
| **Scope creep**（gateway → 全栈 LLMOps → managed service） | 极高 | 严守 §2.2 非目标边界；任何 V0 范围外的功能都进 backlog |
| **NewAPI 上游分歧**（重度 fork 后难 merge upstream fixes） | 高 | 自建代码放独立目录；每月 cherry-pick；分歧 > 30% 触发独立 fork 决策（D-DR9） |
| **跨协议转换 bug**（罕见但痛苦） | 高 | V0 必须 e2e 测试覆盖所有 model/provider 组合的 tool_calls / streaming 路径 |
| **Provider 出 outage** | 高 | 多 Channel pool（§5.5）+ failover 路由（§6.5.3）+ 监控 + 自动剔除 |
| **Workshop 集中启动导致 channel pool 瞬时耗尽** | 高 | Anthropic 多 key + Tier 4 主力（§6.5.4）；`upstream_overflow_policy: queue` 兜底；Week 8 burst 压测验证 |
| **Anthropic Tier 累计没启动**（Workshop V0 时仍卡 Tier 1）| 🔴 极高 | Week 0 强制启动充值；进度每周 Lightman + Joe sync；Week 8 复核累计达 $200+ 否则报警 |
| **多租户串数据**（A 看到 B 日志） | 中 | NewAPI 自带 per-user 隔离已经成熟（其单租户部署本质就是按 user 隔离），不引入额外串数据风险。只需保证 admin UI 不暴露跨 user 数据 |
| **Kids OpenCode Week 6 没拿到 /v1** | 极高 | Week 4 起每周 sync Team B；提前部署 staging 版供 Team B 集成；mock 兜底 |
| **Stars cost 模型与真实 token cost 错配** | 中 | V0 设大 buffer（毛利预算 40%+）；月度 review 调整定价 |
| **JR Academy 集成阻力**（他们已有 LLM stack） | 中 | Week 1 与 JR 技术 lead 对齐；从低风险 endpoint 切起；保留快速 rollback 路径 |
| **法规变化**（AI gateway 数据本地化要求） | 中 | 部署架构保留区域切换能力；法务每季度回看 |
| **DeepSeek / 国内 provider 出口管控** | 中 | 多 provider 冗余；不把任何一个 provider 设为唯一路径 |
| **License（NewAPI AGPL v3.0 copyleft）** | ✅ 已处理 | **公开 repo 接受 AGPL**；商业靠 hosted + SLA + 跨境链路 + 合规闭环；与 Supabase / Plausible / Cal.com 模式一致；BP 中"企业版/私有部署"措辞需调整为"hosted 企业版 + 私有部署服务合同"（卖服务不卖代码） |

---

## 12. 与其它 PRD / 系统的关系

| 文档 / 系统 | 关系 |
|---|---|
| `kids-ai-platform-prd.md` | **消费者**。Airbotix 低龄创作平台与 Kids OpenCode 是 `airbotix-kids` 租户的两个产品 |
| `kids-opencode-spec.md` | **强依赖**。Kids OpenCode（fork 自 `opencode`，158K stars）的所有 LLM 调用都走 DeepRouter，Week 6 是阻塞依赖 |
| JR Academy 现有系统（`~/Documents/sites/jr-academy-ai`） | **第二租户**。Week 11-12 灰度迁移 |
| Airbotix `super-admin` | **不相关**。super-admin 管学员/课程，不管 LLM 调用 |
| Airbotix `auth-backend` | **Airbotix 端 Stars 扣减集成点**。DeepRouter billing webhook 调用 Airbotix 此服务的 internal endpoint |
| `BP.md` / `pitch-deck.md` | DeepRouter 不在 fundraising materials 中明示，是基础设施层；可在 due-diligence 阶段作为"为什么 Airbotix 团队也服务 JR Academy 不是 distraction"的补充材料（"我们建一次基础设施，两个业务都受益"） |

---

## 附录 A：与上游 NewAPI 的功能差距

| 功能 | NewAPI 已有 | DeepRouter V0 需自建 |
|---|---|---|
| 多 provider 路由 | ✅ | — |
| OpenAI 兼容 API | ✅ | — |
| 跨协议转换 | ✅（基础）| 补 tool_calls 边缘 case + e2e 测试 |
| Admin UI | ✅ | 改多租户视图 |
| Token 配额 | ✅（用户级）| 改租户级 + 月度 cost 上限 |
| Billing | ⚠️ 简陋 | **全自建 webhook 协议** |
| 内容策略中间件 | ❌ | **全自建** |
| 跨租户隔离 | ✅ NewAPI 的 user 隔离原生支持 | 不重写 |
| Audit log per-tenant | ⚠️ 部分 | 扩展 tenant_id 索引 + 留存策略 |

---

## 附录 B：关键链接

- 上游 NewAPI：https://github.com/QuantumNous/new-api
- 上游 opencode（Kids OpenCode 的 fork 源）：https://github.com/anomalyco/opencode
- Airbotix Kids 平台 PRD：`./kids-ai-platform-prd.md`
- Airbotix BP：`../../../BP.md`
- Airbotix Pitch Deck：`../../../pitch-deck.md`

---

## 附录 C：术语表

| 术语 | 定义 |
|---|---|
| **租户（Tenant）** | DeepRouter 视角的一个独立产品/公司，对应一组 API key + 策略 + 配额 + 计费回调 |
| **Provider** | 上游模型供应商（Anthropic、OpenAI、豆包 ...） |
| **跨协议转换** | 把上游消费者用的 API 协议（如 OpenAI）翻译成 provider 协议（如 Anthropic Messages） |
| **Policy Middleware** | 入口/出口的内容过滤、prompt 注入、配额检查逻辑 |
| **Billing Webhook** | DeepRouter 在每次请求完成后通知租户系统进行计费的 HTTP 回调 |
| **Stars** | Airbotix 的虚拟消耗单位（见 `kids-ai-platform-prd.md` §8） |
| **Kids OpenCode** | Airbotix 旗舰 agentic AI coding 产品，fork 自 opencode |
