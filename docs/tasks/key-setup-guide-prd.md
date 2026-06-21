# PRD — Key 配置与使用引导（Setup Guide v3）

> Status: Draft v1 · 2026-06-08 · author: Claude（待 Lightman 评审）
> Owner: DeepRouter Frontend
> Scope: `/keys` 页用户拿到 key 之后「怎么配置、怎么用」的全部体验 ——
> Setup guide 弹窗 + 密钥页「怎么用」区 + 自检工具的入口与文案。
> Parents（先读）: `docs/BUSINESS-LOGIC.md`（尤其 §0 D1/D2），
> `docs/onboarding-v2-prd.md` §7.5/§7.6，`docs/tasks/casual-ux-prd.md`，
> `docs/tasks/api-key-simple-advanced-prd.md`，`CLAUDE.md` §0。
> 代码: `web/default/src/features/keys/`（`api-key-integration-dialog.tsx`,
> `api-keys-cells.tsx`, `lib/integration.ts`, `keys/test.tsx` 自检页）。

---

## 0. 为什么要这份 PRD（现状问题）

当前 Setup guide（3 步：复制凭证 → 选 curl/Python/Node → 验证）**逐条违反
既定 persona 设计**，且显示的值是错的，导致连 IT 背景用户都照着配不通：

| 现状 bug | 证据 | 影响 |
|---|---|---|
| 默认就甩 cURL/Python/Node + Base URL + SDK + 点名第三方客户端 | 违反 `onboarding-v2-prd.md:§7.4` 黑话禁令 | 非技术用户 5 秒懵 |
| 模型名显示 `deeprouter` | 实测网关返 **503**；只有 `deeprouter-auto` 路由（`middleware/smart_router.go:18`） | ✅ 已修 2026-06-11：`modelNameForPurpose()` 一律返回 `deeprouter-auto` |
| Base URL 显示 `http://localhost:17231/v1` | 前端 dev 端口未代理 `/v1`，真网关 `:3300` | ✅ 已修 2026-06-11：rsbuild devProxy 加了 `/v1`，该 URL 实测 200（OpenAI+Anthropic 双协议） |
| 真正给小白的「自检」被缩成一个小链接 | `onboarding-v2-prd.md:§7.6` 要求自检是密钥页核心一步 | 用户无法当场确认"钱变成了算力" |

**根因**：没有把这块锚回 persona。本 PRD 的目标就是给出一套**默认服务非技术
用户、开发者细节折叠**、且**每个展示值都经活网关验证**的 key 使用引导。

---

## 1. 目标 / 非目标

**目标**
1. 非技术用户拿到 key 后，**不看视频、不问人**，能在 1 分钟内确认 key 可用，并知道下一步把它放哪。
2. 开发者/企业用户能一键拿到**正确、可直接跑通**的接入配置（Base URL + model + 各客户端/语言）。
3. 任何展示给用户的值（model 名、Base URL、整段配置）**必须真实可用**——构建期对活网关校验。

**非目标**
- 不教用户 AI 能干什么（用户不是冷启动 — `onboarding-v2-prd.md:§2 洞察2`）。
- 不做 chat / playground（红线，另有页面）。
- 不替代运营的 workshop/视频（`casual-ux-prd.md:§1.1`）。
- 本 PRD 不决定 D1（产品定位）；它在 D1 未定下也成立，因为按"casual 默认 + 开发者折叠"分层。

---

## 2. 两种用户、两种模式（核心结构）

引导默认 **Casual 模式**；开发者内容收在 **「开发者模式」** 开关后（与
`api-key-simple-advanced-prd.md` 的 Simple/Advanced 一致，复用同一个开关状态）。

| | Casual（默认） | 开发者模式（开关后） |
|---|---|---|
| 看到什么 | 「测一下能不能用」自检 + 「密钥怎么用」一句话 + 能调哪些模型 | Base URL、model id、各客户端整段配置、curl/Python/Node |
| 黑话 | **绝不出现** API/token/Base URL/网关/SDK/模型路由（`§7.4`） | 允许，这是开发者要的 |
| 目标动作 | 确认能用 → 把 key 粘到自己的工具 | 复制可跑通的配置接进代码/客户端 |

> 注：`onboarding-v2-prd.md:§7.4` 连「第三方客户端品牌名」都列入 casual 禁词，
> 但现实里 opencode/Cursor 这类工具**必须填 Base URL + model 才能配**。这是文档
> 内部的真实冲突（见 §7 开放问题 Q1），本 PRD 的处理：casual 默认只给"自检 + 一句话 +
> 复制整段"，把"整段"做成无需理解的黑盒；具体客户端配方放进开发者模式。

---

## 3. Casual 模式规格（默认屏）

密钥页 / Setup guide 第一屏，从上到下三块，**只有这三块**：

1. **你的调用密钥（API Key）** — 整串可复制；首次创建后提示"只显示一次，请立即保存"
   （`§7.5`）。再次访问默认隐藏，可「重新生成」（旧 key 立即失效）。
2. **这串密钥能用吗？** — 一个大按钮「▶ 测一下能不能用」→ 跑 §5 自检。这是这屏的
   **主行动**（`§7.6`：用户付完钱必须当场确认钱变成了算力）。
3. **怎么用 / 能调哪些模型** —
   - 一句话（`§7.5` 原文）："把这串密钥粘到你正在用的 AI 工具的设置里，找带
     『API Key』的输入框，粘进去保存。"
   - 「需要更多设置（Base URL / 代码）？」→ 一个不喧宾夺主的链接 → 展开**开发者模式**。
   - 「你的密钥可以调用这些模型」：从 `GET /api/pricing/purpose-summary` 取可用清单 +
     体感价（`api-key-simple-advanced-prd.md:§5.3`）。

**两个入口（用户已确认要的）**：API Key 列**复制按钮**旁已加「📖 Setup guide」按钮，
与行菜单「Setup guide」、顶部按钮打开同一弹窗（已实现于 `api-keys-cells.tsx`）。

---

## 4. 开发者模式规格（开关后）

展示**经活网关验证的正确值**：

- **Base URL**：取自部署配置的对外 API 域名（生产 = 控制台同源 `/v1`；本地 dev =
  `http://localhost:3300/v1`）。**禁止**用前端 `window.location`（那会得到 dev 的
  17231 端口）。`lib/integration.ts:defaultBaseUrl()` 需改为读后端注入的
  `server_address`/API base，而非浏览器 origin。
- **模型名**：默认 `deeprouter-auto`（D2 定案前以代码实际可路由者为准；`deeprouter`
  当前 503）。
- **客户端配方（整段可复制）**——至少覆盖：
  - **opencode**（已实测网关返 200）：`~/.config/opencode/opencode.json`
    ```json
    {
      "$schema": "https://opencode.ai/config.json",
      "provider": { "deeprouter": {
        "npm": "@ai-sdk/openai-compatible",
        "name": "DeepRouter",
        "options": { "baseURL": "<BASE_URL>", "apiKey": "<KEY>" },
        "models": { "deeprouter-auto": { "name": "DeepRouter Auto" } }
      }}
    }
    ```
  - **OpenAI 兼容通用**（Cursor / Cherry Studio / ChatBox / Claude Code 等）：
    填 Base URL + API Key + model `deeprouter-auto`，文案统一为"找 Base URL（有时叫
    Endpoint）+ API Key 两个框，粘进去保存"。
- **代码片段**：curl / Python / Node（`lib/integration.ts:buildIntegrationSnippets`
  已有，仅需修正注入的 baseUrl/model）。

---

## 5. 自检工具（§7.6，决定性体验）

- 入口：casual 屏主按钮 + 现有 `/keys/test` 页。
- 行为：用该 key 对 `<BASE_URL>/chat/completions`、model `deeprouter-auto` 发一条
  最小请求，**不需要用户填任何东西**。
- 成功态：✓ 密钥工作正常（展示模型回了一句话）。
- 失败态映射（人话，不暴露 HTTP 码）：
  - 401 → "密钥无效，请重新生成"
  - 402 / 余额不足 → "余额不足，请先充值"（带充值入口）
  - 503 / `upstream_capacity_exceeded` → "模型暂时繁忙，请稍后重试"
  - 429 / `tenant_quota_exceeded` → "已达用量上限"

---

## 6. 正确性要求（硬约束，杜绝再翻车）

1. **展示值构建期校验**：CI/lint 或 dev 启动时，对 `defaultBaseUrl()` + 默认 model
   发一次真实 `/chat/completions`，非 2xx 则报错。"显示了跑不通的值"视为 P0 bug。
2. **dev 可用性**：要么前端 dev proxy 增加 `/v1`（及 relay 路径）代理到网关，要么
   Base URL 直接显示网关地址 —— 二选一，保证 dev 下复制的配置也能跑。
3. **单一事实源**：Base URL / model / 体感价只能来自后端 API 注入，前端不得硬编码。

---

## 7. 开放问题（依赖上层决策）

- **Q1（依赖 D1）**：casual 是否允许出现 Base URL / 客户端品牌名？`§7.4` 说禁，但
  OpenAI 兼容客户端必须有 Base URL。建议：casual 给"复制整段黑盒"，品牌配方进开发者模式。
- **Q2（依赖 D2）**：用户面 canonical 模型名 = `deeprouter` 还是 `deeprouter-auto`？
  定了之后代码、引导、文档三处统一。
- **Q3**：开发者模式开关与 `api-key-simple-advanced-prd.md` 的 Simple/Advanced 是否
  共用同一状态（建议共用，避免两个"高级"概念）。

---

## 8. 验收标准

- [ ] 非技术用户在第一屏即可点「测一下能不能用」并看到人话结果，全程无黑话。
- [ ] 默认不出现 Base URL / 代码 / SDK / 客户端品牌（除非展开开发者模式）。
- [ ] 开发者模式中复制的 opencode/通用配置 + curl/Python/Node，**对当前部署活网关
      直接跑通**（model `deeprouter-auto`、正确 Base URL）。
- [ ] dev 环境下复制的配置同样可跑通（§6.2）。
- [ ] 复制按钮旁的 Setup guide 入口与其它两处打开同一弹窗（已完成）。
- [ ] 失败态文案按 §5 映射，不裸露 HTTP 码。
