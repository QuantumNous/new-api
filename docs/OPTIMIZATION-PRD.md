# DeepRouter 整体优化 PRD —— 从"半成品网关"到"全球化的专业大模型统一接入网关(中转站)"

> 定位说明:DeepRouter 是**全球化产品**,官网与产品**英文优先 + 多语言本地化**(前端 i18n 已含 en/zh/fr/ru/ja/vi)。供给以**海外前沿模型(Claude / OpenAI / Gemini)为核心需求驱动**——用户来 DeepRouter 主要就是为了用这些海外模型——国产模型(DeepSeek/Qwen/Doubao)为补充;受众是**全球开发者、企业与非技术用户**。"人民币 / 发票 / 中国可达"是其中一条**高价值的中国市场通道(China lane)**,通过本地化呈现,**不是**产品唯一身份——别做成"中文/中国专属"。

> Status: v0.1 · 2026-06-19 · author: Claude(综合 Lightman 本轮决策 + 代码现状审计 + hao.ai 竞品研究 + BP/landing 素材)
> Language: 中文优先(面向全球华人),代码/术语保留英文。
>
> **这份文档是什么。** 不是第七份产品规格,而是**总览级优化 PRD**:把分散在 5+ 份 PRD、BP、landing、代码里的东西,按"现状 vs 目标"拉成一条优化主线,给出**定位决策 + 缺口清单 + 分优先级路线图**。
>
> **法律层级(不在此重定义,冲突以它们为准):** `docs/BUSINESS-LOGIC.md §0`(D1/D2/D10 等开放决策)、`docs/onboarding-v2-prd.md`(personas / 黄金路径 / jargon ban / §7.5 密钥页 / §7.6 自检 / §9 红线)、`docs/tasks/*-prd.md`、`CLAUDE.md §0`。本 PRD 引用它们、不覆盖它们;凡有出入,按它们走、在此登记为 gap。
>
> **新输入(本轮 Lightman 决策,2026-06-19):** "我们不会做 chat,主要就是专业做这个中转站。" —— 这部分收敛了 D1(见 §1)。

---

## 0. 为什么需要这份 PRD(问题陈述)

三件事同时为真,导致 DeepRouter 当前"看起来差不多能用,实际既不专业也没护城河":

1. **工程上**:核心中转链路有洞——计费 webhook 实现了但**没接进 relay**(今天不扣费)、儿童安全审核**完全没做**、多 key 池/故障转移/监控/runbook 缺失。(§4 审计)
2. **商业上**:定位三套自相矛盾(D1 未决),网站只搬了"技术介绍",没搬 BP 里写好的"商业实体"(中国可达、人民币发票、定价表、自助注册)。(§1、§6.WS-D)
3. **竞争上**:同源对手(hao.ai 等 new-api 系中转站)已上线、有真实供给;DeepRouter 真正能拉开差距的东西(智能路由 + 合规 + 安全 + 开源)要么没做、要么没串成产品。(§3)

优化目标一句话:**把已经做好的两块护城河(smart-router 智能路由 + 非技术 console)和没做的三块(计费闭环、安全合规、商业表层)串成一个"专业、合规、可信"的中文大模型中转站,而不是又一个拼价格的灰产转发器。**

---

## 1. 战略定位(收敛 D1 —— 需 Lightman 最终签字)

D1 原本三选一冲突:(a) 内部 B2B 网关 / (b) 公开开发者+企业 SaaS / (c) 非技术 C 端。本轮"专业做中转站、不做 chat"把它收敛为:

> **DeepRouter = 全球化的专业大模型统一接入网关 / 中转站(自助 utility,非 chat destination)。**
> - 受众:**全球**开发者、企业、非技术用户;官网与产品**英文优先 + 多语言本地化**(en base / zh / fr / ru / ja / vi)。
> - 形态:**公开自助**的 (b)+(c) 混合——开发者改 `base_url` 即用;非技术用户拿 key 粘进现成 AI 工具。
> - 市场:**全球通用为主盘**;**中国 lane**(人民币/发票/对公/国内可达)是一条高价值差异化通道,经本地化呈现,**不是**全站主轴。
> - 锚点客户:(a) 内部租户(Airbotix Kids、JR Academy)作首批真实流量与信任背书。
> - 红线:**不做 chat / 不做 assistant**(`onboarding-v2 §2/§9`)。chat 只可作 Developer 模式下的"测试/对比"工具,绝不作主入口。

**与 hao.ai 的定位差(楔子,反复强调):** 不打价格战。BP §4.1 明确我们**对标官方价 + 服务溢价(毛利 70–80%)**,不是 hao.ai 的"0.15 折灰产供给"。我们赢的不是"更便宜",而是:

**一个 key 调全球所有模型 + 智能路由省钱 + 开源可审计 + 儿童安全合规 + 多市场可达(含中国 lane 的人民币·发票)。**

**核心需求事实(定位锚,不可写反):** 用户来 DeepRouter,主要是为了用 **Claude / OpenAI / Gemini 这些海外前沿模型**——这是需求驱动。国产模型是补充,不是卖点主轴。因此 Hero、定价表、Models 页都应**以海外前沿模型打头**。"中国 lane" 的独特价值,正是"**国内官方用不了 Claude / OpenAI → 我们给可达 + 人民币 + 发票**"——它放大的依然是"用上海外模型",不是"用国产模型"。

> ⚠️ **仍需 Lightman 明确签字**:(1) 首发受众——**(c)非技术用户** 先行 vs **(b)开发者** 先行?(2) 首发市场——**全球英文盘** 先行 vs **中国 lane** 先行?建议:受众 **(c) 先行**(对标已建好的 casual console + JR 学员),市场 **全球英文为主盘、中国 lane 作本地化并行**。确认后落进 `BUSINESS-LOGIC §0 D1`。

---

## 2. 目标用户(对齐既有 personas,不重定义)

| 优先级 | 用户 | 来源 | 他们要什么 |
|---|---|---|---|
| P0 | **非技术付费个人**(律师/老师/设计师/学生/创作者) | onboarding-v2 §3 | 拿 key 粘进 Cherry Studio/Cursor 等,2 分钟确认"钱变成了算力";零黑话、零代码 |
| P0 | **内部租户**(Airbotix Kids / JR Academy) | PRD §3 | kids_mode 硬约束、计费回传自家平台、稳定供给 |
| P1 | **开发者 / 中小团队(全球)** | BP §2.1 | 改 `base_url` 即用、一行切模型、用量/成本可见;中国 lane 另加人民币/发票 |
| P2 | **企业客户** | BP §2.1 | 对公、发票、SLA、私有部署、审计日志 |

---

## 3. 竞争格局与差异化

### 3.1 对手画像

| 对手 | 是什么 | 强 | 弱(我们的机会) |
|---|---|---|---|
| **hao.ai** | new-api 系中转站,0.15 折低价,闭源 | 已上线、价透明、UX 干净、cache 分项计价 | 灰产供给不稳、无合规/发票、闭源不可信、无智能路由、无安全 |
| AiHubMix / OhMyGPT / API2D | 国内老牌中转站 | 早入场、便宜、用户量 | 产品初级、B 端薄弱、同质化、个人作坊气质 |
| OpenRouter | 海外标杆 | 上游全、品牌强 | 中文区做得浅、无人民币/发票、中国不可直用 |
| 官方直连 | — | 一手价 | **中国大陆不可用 + 无合规发票** ← 我们最大的钩子 |

### 3.2 我们的护城河(已建 / 待建)

| 护城河 | 状态 | hao.ai 有吗 |
|---|---|---|
| smart-router 内容感知智能路由(Apache,<5ms) | ✅ 已建(2182 LOC) | ❌ |
| 非技术 console(注册→充值→拿 key→自检,屏蔽黑话) | ✅ 已建 | ❌(它面向开发者) |
| 计费闭环(per-request 计量回传自家平台) | 🔴 未接通 | 🟡 有 usage 面板 |
| 儿童安全 / 内容审核 / kids_mode 硬约束 | 🔴 未建 | ❌ |
| 人民币 / 发票 / 对公合规 | 🔴 未建(BP 有规划) | ❌ |
| 开源 AGPL + 主体透明 | ✅ 天然 | ❌ 闭源 |

### 3.3 借鉴 hao.ai 的"表现形式"(只借形式,不借灰产打法)

✅ 借:定价表(input/output/cache 三行 + 并排官方价)、可浏览 Models 页、导航有 Pricing/Models/Docs、自助 "Get API Key" CTA、3 步接入代码块、社群入口、**把 cache 折扣透传亮出来**(它没透传)。
❌ 不借:0.15 折价格战框架、chat/image/对比 demo(踩红线)、闭源不透明。

---

## 4. 产品现状审计(已验证的事实,不是计划文字)

> PLAN.md(05-12)已过时——Phase 1-6 复选框全空,但实际进度跑偏到了 casual 前端。以下为本会话核对代码后的真实状态。

| 模块 | 状态 | 证据 |
|---|---|---|
| smart-router 智能路由 | ✅ 完成,可端到端跑 | 2182 LOC,docker compose 起得来 |
| casual 用户旅程(注册→自检) | ✅ 基本完工 | casual-journey-readiness-prd G1-G3、B1-B2 已关闭 |
| `middleware/policy.go` | ✅ 存在 | 策略中间件已落 |
| **计费 webhook 接入 relay** | 🔴 **未接通** | `internal/billing` 实现+测试有,relay/controller/middleware **零调用点**(grep 只命中 README)→ **今天不扣费** |
| **内容审核 / 安全分类器** | 🔴 **完全缺失** | 无 `blocklist`、无 classifier(上轮核对) |
| 多 key Anthropic 池 + 压测 | 🔴 未做 | 无 burst-test;FAIL-1 故障转移未决 |
| 各 provider kids_mode e2e | 🔴 未做 | — |
| 生产监控 / 告警 / 备份演练 | 🔴 缺失 | 无 Prometheus→Grafana、无 backup drill |
| 运维 runbook | 🔴 缺失 | `docs/runbook/` 不存在 |
| 商业表层(定价页/Models 页/自助注册引导) | 🔴 缺失 | landing 是"Request access"邀请制门面 |
| landing 站 | ⚠️ 精致但定位错 | 英文 B2B 介绍,缺 BP 里的商业实体内容 |
| 计费幂等 chaos test | 🔴 未做 | — |

---

## 5. 优化原则(贯穿所有 workstream)

1. **先打通"能跑通的最薄商业闭环",再加宽。** 顺序:计费接通 → 安全 → 商业表层。半成品功能不如没有。
2. **护城河优先于功能对齐。** 不在 hao.ai 的价格战战场上耗;把它没有的(智能路由+合规+安全+开源)做成可感知的产品价值。
3. **每一个对用户展示的值必须先打真实网关验证 200**(`CLAUDE.md §0 rule 3`,2026-06-08 `deeprouter`/`:17231` 翻车教训)。
4. **License 边界不破**:商业/IP 逻辑(安全 ruleset、路由策略)进 Apache 的 smart-router 或独立服务,**不**进 AGPL 的 deeprouter(`../CLAUDE.md` 进程边界)。
5. **不做 chat 红线** 贯穿前端与营销。

---

## 6. 优化方案(按 workstream)

### WS-A · 核心中转链路打通(P0)

**目标**:一笔请求从进来到计费回传,全链路真实跑通且可对账。

- **A1 计费 webhook 接入 relay 完成路径**(PLAN Phase 2 遗留)
  - 在 token 统计/扣费处构建 `billing.Event`,goroutine 调 `billing.NewDispatcher().Send(...)`
  - 用 `User.WebhookSecret`(已有列,plaintext)做 HMAC
  - 验收:integration test + 同 request_id 并发 10 次 → **恰好一次扣费**(幂等 chaos test)
- **A2 多 key 上游池 + 故障转移**(Phase 3)
  - 渠道按 priority/weight 选;429 当分钟标记耗尽;401/403 自动禁用 + 告警
  - 解决 **FAIL-1**(跨 provider fallback 策略)
  - 验收:200 RPM × 10min 零 503;禁用一个 key 流量自动重分布
- **A3 跨协议转换边界用例**(OpenAI↔Anthropic↔Gemini 的 tool_calls/streaming)补测

### WS-B · 安全与合规(P0,护城河核心)

**目标**:做出 hao.ai 给不了的"敢给孩子用、敢让企业过财务"的能力。

- **B1 内容审核 sidecar(扩展 smart-router,不新开 repo)**
  - blocklist 关键词过滤放 smart-router(Apache,复用其 SIGHUP 热重载),加 `/moderate` 端点
  - LLM-as-classifier(Haiku/moderation)**不进 <5ms 快路径**:由 deeprouter middleware 把待审 prompt 当普通请求路由到便宜模型取 safe/unsafe;分类 prompt+阈值为 IP,放 Apache 侧
  - 解决 **CLASSIFIER-1**(Haiku vs OpenAI Moderation)
  - 验收:100 prompt 测试集 ≥95 拦截,教育集误杀 ≤2%
  - 拆独立 `kids-guard` repo 的判据:**当安全 ruleset 成为可单独售卖/被监管审计的资产时**,在此之前不拆(`../CLAUDE.md` 边界 + 避免第三套部署)
- **B2 kids_mode 端到端**:各 provider 跑通 whitelist/metadata strip/ZDR/child-safe prompt 的 e2e
- **B3 合规商业能力(B 端硬差异化,BP §2.2)**:人民币付费、开发票、对公转账通道。设计 + 落地(可分期,先发票后对公)

### WS-C · 商业表层 / console(P0→P1)

**目标**:从"能调 API"升级到"能自助下单、看价、看用量、要发票"的专业中转站。

- **C1 定价页**:每模型 input/output/cache 三行 + 并排官方价(国外模型标"国内不可直购");**亮出 cache 折扣透传**。数字用 BP §4 倍率。
- **C2 Models 页**:37 provider 可搜索/筛选 + 能力标签 + 价。把硬资产显性化。
- **C3 自助注册引导**:landing/console 主 CTA 从"Get in touch"改为"免费注册,领试用额度";打通 注册→充值→拿 key→自检 的自助闭环(casual journey 已建,补商业入口)
- **C4 用量/成本面板**:wallet 已有 ≈chats,扩成真实用量+成本分析(A1 计费接通后自然产出)
- **C5 发票/账单中心**(配合 B3)

### WS-D · 官网 landing 优化(P1)

**目标**:保留现有**英文优先 + 全球定位**(One API / Built on AWS / 37+ providers)与视觉风格(Plus Jakarta Sans + cream/charcoal),补上 hao.ai 已示范、而我们缺的"商业实体"内容(定价表 / Models 页 / 自助注册);用 i18n 做中文等本地化。**中国 lane(人民币/发票/可达)作本地化市场段落,不喧宾夺主、不改全站英文主轴。**

**★ 核心交互:个性化 Hero —— "Your AI, unlocked"**(轻量三步向导)。把"按国家差异化价值 + 智能路由演示"做进首页:既在英文主版内自然呈现中国 lane,又现场演示 smart-router 护城河,且不碰 chat 红线。

- **① 你在哪?**(国家/地区,IP 预填 + 可手动改)→ 文案随地区变:
  - 受限地区(中国等):"Claude / OpenAI 在你所在地区不直接提供 → DeepRouter 让你用上,国内直连 · 人民币 · 可开发票。"
  - 其他地区:"One key for every frontier lab — routed to the best + cheapest model per request."
- **② 你想要什么?**(两条入口)
  - (a) 知道要哪个模型 → 选 Claude / GPT / Gemini / … → "✓ 已支持,一个 key,无需单独开户。"
  - (b) 只想把事做成 → 选用途(写代码 / 写作 / 翻译 / 图像 / 研究 / 接进我的 App)→ 展示 smart-router **路由预览**:"deeprouter-auto 会路由到 `claude-haiku-4-5`(+ fallback),你不用选。"
- **③ CTA**:"Get your key → live in 2 minutes"(自助注册)

护栏:展示的模型/价格**必须真实可用**(`CLAUDE.md §0 rule 3`);按地区是**差异化文案,非 geo-gating**(检测+建议,用户可改);用途→模型是**静态预览,不是对话**(守 chat 红线,也借此与 hao.ai 的对比 chat demo 区隔)。

新站板块顺序(英文主版):
1. Hero(= 上述个性化交互向导;量化锚:**"One key. Every model, intelligently routed. Live in 2 minutes."** + 自助 CTA)
2. 信任数字条(37+ providers / <10ms / 1 API / 100% open source)
3. **定价表**(WS-C C1)★最缺
4. 双层智能路由图(保留,独有)
5. Built on AWS(保留)
6. Features 6 卡(保留,含 kids_mode 安全)
7. Models 清单(C2)
8. 开源/可审计(保留,对比 hao.ai 闭源)
9. 自助注册 CTA

**中国 lane(仅 zh 本地化版追加 / 地域化呈现):** 中国可达性痛点 + 人民币/发票/对公(BP §1/§2.2)——作本地化卖点,不进英文主版主轴。

跳过:chat/image/对比 demo(红线)。

### WS-E · 上线运维(P1→P2,PLAN Phase 6)

- E1 监控告警:Prometheus→Grafana;告警(key 禁用 / 池耗尽 / 计费 DLQ>0 / p99>2s)
- E2 备份:Postgres 日快照 + 7 天保留 + **恢复演练**
- E3 runbook:`docs/runbook/{provider-outage,key-rotation,incident-template}.md`
- E4 secrets 管理(解决 **SECRETS-1**:Doppler/1Password/aws-sm)
- E5 跨境链路工程化(BP §3.3,多线路 + 自动切换)——中国可达性的工程支撑

---

## 7. 优先级路线图

| 阶段 | 内容 | 出口标准 |
|---|---|---|
| **P0-1(立即)** | WS-A1 计费接通 + 幂等测试;WS-B1 审核 sidecar v1 | 每笔请求真实计费且只计一次;kids prompt 被拦 |
| **P0-2** | WS-B2 kids e2e;WS-C1 定价页 + C3 自助注册引导 | 内部租户可上;新用户能自助看价→注册→拿 key→自检 |
| **P1** | WS-A2 多 key 池+压测;WS-C2/C4/C5;WS-D 官网优化;WS-B3 发票 | 200RPM 零 503;官网英文主版+本地化上线;能开发票 |
| **P2** | WS-E 监控/备份/runbook;对公;企业版/私有部署 | 可对外承诺稳定性;过财务合规 |

> **关键依赖**:P0-1 的计费接通是一切商业化前提(不接通=上线即漏钱)。B1 安全是 kids/教育受众的红线。这两件**不卡任何决策**,应最先做。

---

## 8. 定位护栏(明确"不做什么")

- ❌ 不打价格战 / 不抄 0.15 折(我们是官方价+溢价,靠可达+合规赢)
- ❌ 不做 chat/assistant 作为产品主入口(红线)
- ❌ 不闭源、不学 WILLWAY 式主体隐身(开源透明是信任资产)
- ❌ 不用来路不明的灰产供给(对 kids/企业是毒药;稳定官方/合作供给是卖点)
- ❌ 安全/路由 IP 不进 AGPL 的 deeprouter(进 Apache smart-router)

---

## 9. 成功标准("优化完成"的定义)

1. ✅ 每笔请求真实计费、可对账(对账 diff <1%),幂等 chaos test 通过
2. ✅ kids_mode 内容审核 ≥95% 召回,教育集误杀 ≤2%
3. ✅ 新非技术用户**零支持**完成 注册→充值→拿 key→自检(沿用 casual 验收)
4. ✅ 官网英文主版(+多语言本地化)呈现定价表 + Models + 自助注册;中国 lane 的可达/人民币/发票作 zh 本地化段落;每个展示值经真实网关验证
5. ✅ 200 RPM × 2h 零 503;多 key 池自动重分布
6. ✅ 监控告警 + 备份恢复演练通过;runbook 齐全
7. ✅ 能开人民币发票(B3 至少发票闭环)

全部为真 = DeepRouter 从"半成品网关"完成到"专业中文中转站"的优化。

---

## 10. 仍开放的决策

| ID | 决策 | 影响 | Owner |
|---|---|---|---|
| **D1(收敛中)** | 首发受众 (c) 非技术先行 vs (b) 开发者先行 | onboarding/定价/文案侧重 | Lightman(本 PRD 建议 c 先行) |
| FAIL-1 | 跨 provider fallback 策略 | WS-A2 | Eng + Lightman |
| CLASSIFIER-1 | Haiku vs OpenAI Moderation | WS-B1 | Eng(成本/质量 spike) |
| COST-1 | Stars 成本公式 / model_pricing 表 | C1 定价、内部计费 | Eng + Airbotix backend |
| SECRETS-1 | secrets 管理选型 | E4 | Eng |
| 合规-1 | 发票/对公通道供应商 + 备案路径 | B3 | Lightman + 法务 |

---

## 11. 风险

| 风险 | 严重 | 应对 |
|---|---|---|
| 计费迟迟不接通 → 上线漏钱 | 🔴 | P0-1 最先做,作为商业化硬门槛 |
| 政策风险(中转监管收紧) | 🔴 | 提前备案;境内外双链路;国产模型作合规版主推(BP §9) |
| 灰产价格战内卷 | 中 | 不参战,以合规+智能路由+安全建溢价 |
| 上游封号/限流 | 中高 | 多 key 多账号池 + 自动禁用(WS-A2) |
| kids 安全出事(教育受众) | 🔴 | B1/B2 上线前必须过测试集 |
| 定位再次漂移回"开发者网关" | 中 | 本 PRD §1 + 红线 + casual PRD 为锚,每次客户侧改动回看 |

---

## 12. 修订记录

| 版本 | 日期 | 说明 |
|---|---|---|
| v0.1 | 2026-06-19 | 初版。综合代码现状审计、hao.ai 竞品、BP/landing 素材、Lightman "专业中转站不做 chat" 决策,产出总览级优化路线图。 |
