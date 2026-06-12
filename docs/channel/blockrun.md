# BlockRun 渠道接入说明（类型 100，VIP 原生透传）

本文记录 newapi 接入 [BlockRun](https://blockrun.ai) 作为上游 AI 中转渠道（**渠道类型 100**）的完整设计、协议、配置与运维要点。

> **本文描述的是 VIP 原生透传行为**（2026-06-03 改造后)。改造前的"全部委托 `openai.Adaptor`、强制打 `/v1/chat/completions`、Claude 入流转 OpenAI"旧行为已废弃。设计/决策的完整论证见配套文档 [`blockrun-vip-migration.md`](./blockrun-vip-migration.md)。

BlockRun 对**白名单钱包**开放 **VIP 原生透传**能力，按客户端入流格式分派到对应的原生上游端点，**零模型替换、零响应重塑**：

| 入流格式 | 上游端点 | 行为 |
|---|---|---|
| **Anthropic / Claude Messages**（`/v1/messages`）| `POST {base}/v1/messages` | 请求原样透传；响应是**原生 Anthropic 格式**（保留 thinking 签名、原生 content blocks、cache token、原生 SSE 流式）。**无任何 Claude→OpenAI 转换** |
| **OpenAI Chat Completions**（`/v1/chat/completions`）| `POST {base}/v1/chat/completions` | 请求原样透传；响应是**原生 OpenAI 格式**，直接回传 |
| **Gemini**（`/v1beta/...`）| — | **不支持**，返回错误（VIP 仅原生支持 Anthropic + OpenAI）|

BlockRun 不使用传统 API key — **每次调用都通过 x402 v2 微支付协议在 Base 链上用 USDC 即时结算**。渠道在 newapi 后台的"密钥"字段存的是 **EVM 钱包私钥**，每个请求由 newapi 在本地用 EIP-712 / ERC-3009 签一次授权后再发送，私钥从不离开服务器。

> ⚠️ **VIP 前置条件**:原生 `/v1/messages` 端点仅对**已加入 VIP 白名单的钱包**开放。钱包未开通 VIP 时，Claude 入流会从上游失败;OpenAI `/v1/chat/completions` 端点不受此限制。x402 按调用计费的协议本身在两个端点上完全相同，未因 VIP 改动。

---

## 1. 协议背景

| 项 | 值 |
|---|---|
| 协议 | [x402 v2 over HTTP](https://github.com/coinbase/x402)（Coinbase 设计的 internet-native payment standard）|
| 结算链 | Base 主网（CAIP-2: `eip155:8453`），同时兼容 Base Sepolia 测试网（`eip155:84532`）|
| 结算资产 | USDC v2（Base 合约 `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`）|
| 签名标准 | EIP-712 typed data + ERC-3009 `TransferWithAuthorization` |
| 上游 endpoint（OpenAI 入流）| `POST https://blockrun.ai/api/v1/chat/completions`（OpenAI 兼容）|
| 上游 endpoint（Anthropic 入流，VIP）| `POST https://blockrun.ai/api/v1/messages`（原生 Anthropic Messages API，需钱包 VIP 白名单）|
| 计费模式 | Pay-per-call（按调用一次性扣固定 USDC，无 token 单价）；两个端点的 x402 计费协议一致 |

x402 是个"两跳"协议：客户端先发不带签名的请求，服务器回 `402 Payment Required` 携带支付要求；客户端在本地用钱包私钥签一个 ERC-3009 转账授权，把签名放进 `Payment-Signature` 头重发，服务器验签后落账并返回 200。私钥**始终留在客户端**，链上只看到由 facilitator 提交的 USDC transfer 交易。

---

## 2. 完整链路图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ① newapi 侧（本项目）                              │
└─────────────────────────────────────────────────────────────────────────────┘

   终端用户 / 业务系统
   (OpenAI SDK / Anthropic SDK / Claude Code / curl)
            │
            │  Authorization: Bearer <newapi-token>
            │  POST /v1/chat/completions     ← OpenAI 兼容
            │       /v1/messages             ← Claude Messages API
            ▼
   ┌──────────────────────────────────────────────────────────┐
   │              newapi  Gin HTTP Server                     │
   │  router/  →  middleware/(auth, ratelimit, distribute)    │
   │     │                                                    │
   │     ▼                                                    │
   │  controller/relay  →  service/  →  relay/                │
   │                                                          │
   │  ┌────────────────────────────────────────────────────┐  │
   │  │  relay/channel/blockrun/  ← VIP 原生透传适配器     │  │
   │  │  （内嵌 openai.Adaptor + claude.Adaptor，          │  │
   │  │    每个方法按 info.RelayFormat 分派）              │  │
   │  │                                                    │  │
   │  │  · ConvertClaudeRequest  → 原样透传(return req)   │  │
   │  │  · ConvertOpenAIRequest  → 原样透传(return req)   │  │
   │  │  · ConvertGeminiRequest  → 报错(不支持)           │  │
   │  │  · GetRequestURL → 按格式分派:                    │  │
   │  │      Claude → /v1/messages (+?beta=true 视情况)   │  │
   │  │      OpenAI → /v1/chat/completions                │  │
   │  │      Gemini → error                               │  │
   │  │  · SetupRequestHeader → 安全红线:绝不设            │  │
   │  │      x-api-key / Authorization(私钥不入头);       │  │
   │  │      Claude 面补 anthropic-version、透传           │  │
   │  │      anthropic-beta;retry 时注入 Payment-Signature│  │
   │  │                                                    │  │
   │  │  DoRequest 两跳（格式无关，两端点通用）:           │  │
   │  │    1) channel.DoApiRequest 发起 → 期待 402        │  │
   │  │    2) 解析 Payment-Required 头 / x-payment-required│  │
   │  │       / www-authenticate: X402 ...                │  │
   │  │    3) validatePaymentOption 白名单校验            │  │
   │  │    4) SDK CreatePaymentPayload 做 EIP-712 签名    │  │
   │  │       (经 SignX402Payment)                        │  │
   │  │    5) c.Set(ctxKeyPaymentSignature, b64)          │  │
   │  │    6) channel.DoApiRequest 再发一次 → 200         │  │
   │  │    7) 若仍 402: 显式 error,不再循环（防资损）     │  │
   │  │                                                    │  │
   │  │  DoResponse → 委托原生 handler，原样回字节:        │  │
   │  │    · OpenAI 入流 → 委托 openai.Adaptor(原生)      │  │
   │  │    · Claude 入流 → 委托 claude.Adaptor(原生       │  │
   │  │      Anthropic SSE/JSON，含 thinking 签名)        │  │
   │  └────────────────────────────────────────────────────┘  │
   │     │                                                    │
   │     ▼                                                    │
   │  GORM (MySQL/PG/SQLite) + Redis     配额 / 限流 / 日志    │
   └──────────────────────────────────────────────────────────┘
            │
            │  HTTPS (TLS-verifying client)
            │  Host: blockrun.ai
            ▼

┌─────────────────────────────────────────────────────────────────────────────┐
│                       ② BlockRun 公网入口                                    │
└─────────────────────────────────────────────────────────────────────────────┘

   ┌──────────────────────────────────────────────────────┐
   │  Cloudflare Edge                                     │
   │   · Universal SSL · Argo Smart Routing               │
   └──────────────────────────────────────────────────────┘
            │
            ▼
   第一次 POST /v1/chat/completions 或 /v1/messages (no auth)
            │
            ▼  HTTP/2 402 Payment Required
            │  www-authenticate: X402 requirements="<base64 JSON>"
            │  payment-required: <base64 JSON>
            │  x-payment-required: <base64 JSON>
            │
   ╭────── 客户端在本地完成 ───────╮
   │  1. base64 decode 三选一头     │
   │  2. validatePaymentOption()    │
   │     · timeout ≤ 300s           │
   │     · network 白名单           │
   │     · asset == Base USDC v2    │
   │     · payTo 合法 ETH 地址      │
   │     · amount ≤ 5 USDC          │
   │  3. EIP-712 typed-data hash:   │
   │     domain = {USD Coin, 2,     │
   │              8453, USDC addr}  │
   │     msg   = TransferWith       │
   │              Authorization{    │
   │                from, to, value,│
   │                validAfter,     │
   │                validBefore,    │
   │                nonce(32B rnd)  │
   │              }                 │
   │  4. secp256k1 sign(digest)     │
   │  5. payload = {x402Version,    │
   │     resource, accepted,        │
   │     payload:{signature,        │
   │              authorization}}   │
   │  6. base64(JSON(payload))      │
   ╰─────────────────────────────────╯
            │
            ▼  第二次 POST（同一端点：/v1/chat/completions 或 /v1/messages）
            │  Payment-Signature: <base64 payload>
            │
            ▼
   ┌──────────────────────────────────────────────────────┐
   │  BlockRun Server                                     │
   │   · 验证签名 / payload schema                        │
   │   · 调用 Coinbase CDP facilitator                    │
   │   · facilitator 提交 transferWithAuthorization       │
   │     到 Base 主网 USDC 合约（gasless 转账，由         │
   │     facilitator 支付 gas）                           │
   │   · 等待落账 (~1-3s on Base)                         │
   │   · 转发请求到上游模型节点（AWS Bedrock /            │
   │     OpenAI / Google / DeepSeek / Moonshot / ...）    │
   └──────────────────────────────────────────────────────┘
            │
            ▼  HTTP/2 200 OK
            │  Payment-Response: <base64 settlement receipt>
            │  Body（OpenAI 入流）: 原生 OpenAI ChatCompletion / SSE
            │  Body（Claude 入流）: 原生 Anthropic Messages / SSE
            ▼
   newapi DoResponse → 按格式委托原生 handler，原样回字节
            · OpenAI 入流 → openai.Adaptor（原生 OpenAI）
            · Claude 入流 → claude.Adaptor（原生 Anthropic，
              含 thinking 签名 / content blocks / cache token）
            ▼
   终端用户

┌─────────────────────────────────────────────────────────────────────────────┐
│                       ③ BlockRun 上游模型节点                                │
└─────────────────────────────────────────────────────────────────────────────┘

   BlockRun 自身是聚合中转。两个端点都按 model 字段路由到不同上游
   （/v1/messages 走原生 Anthropic 通道，/v1/chat/completions 走 OpenAI
   兼容通道）：

     anthropic/claude-*          → AWS Bedrock Claude
     openai/gpt-5.*              → OpenAI Platform
     google/gemini-*             → Google AI Studio / Vertex
     deepseek/deepseek-*         → DeepSeek 官方
     moonshot/kimi-*             → Moonshot 官方
     zai/glm-*                   → 智谱 GLM
     minimax/minimax-*           → MiniMax 官方
     nvidia/{model}              → NVIDIA NIM 托管开源模型
```

---

## 3. 文件结构

```
relay/channel/blockrun/
├── adaptor.go                  channel.Adaptor 接口实现（按 RelayFormat 分派的原生透传）
├── x402.go                     x402 v2 协议核心：签名(SignX402Payment)、校验、头解析
├── constants.go                ChannelName + ModelList
├── adaptor_test.go             Convert*/SetupRequestHeader 单测（含私钥不泄漏断言）
├── x402_validate_test.go       validatePaymentOption / parsePrivateKey 单测
├── url_test.go                 GetRequestURL 按格式分派路径单测（Claude→/v1/messages、OpenAI→/v1/chat/completions、Gemini 报错）
└── x402_e2e_test.go            实链 e2e（build tag e2e_blockrun 门控）
```

依赖：`github.com/BlockRunAI/blockrun-llm-go v0.11.0`(**base SDK，非 `blockrun-llm-go-vip`**；仅调它的 `CreatePaymentPayload` 和 `ParsePaymentRequired` 两个公开函数，自写 HTTP 二跳逻辑以支持流式 SSE)。

> 为何不 import `blockrun-llm-go-vip`:vip 包返回强类型 `anthropic.Client`/`openai.Client`,与 newapi 的 raw-HTTP/SSE 字节透传管线形状不符,硬用反而多一层重塑,且其 x402 中间件未导出。VIP 能力的"准"来自**打原生端点 + 字节原样转发**,本适配器已用同端点 + 同 x402 协议 + 原生 handler 达成。详细论证见 [`blockrun-vip-migration.md`](./blockrun-vip-migration.md) §3。

适配器结构上**内嵌 `openai.Adaptor` 与 `claude.Adaptor`**，每个接口方法按 `info.RelayFormat` 分派；仅 `DoResponse` 委托给内嵌的原生 handler，`GetRequestURL`/`SetupRequestHeader`/`Convert*`/`DoRequest` 均自写（以套用 x402 两跳与钱包私钥安全红线）。

---

## 4. 安全模型与信任边界

### 4.1 私钥保护

- 私钥仅在 `relay/channel/blockrun/x402.go` 的 `parsePrivateKey` 中通过 `crypto.HexToECDSA` 解析为 `*ecdsa.PrivateKey`，不进入任何日志、错误消息、HTTP 头、JSON marshal 路径
- `RelayInfo.ToString()` 自动 mask 所有 `ApiKey` 字段（含 BlockRun 渠道）
- 错误信息固定字符串："wallet private key must be 64 hex chars (got N)" / "wallet private key is not valid secp256k1 hex"，**绝不回显 key 内容**
- 单测 `TestParsePrivateKey/rejects_non-hex_with_fixed_message_and_no_key_content` 在 CI 中持续校验这一点

#### 私钥绝不进 HTTP 头(原生透传下的安全红线)

`info.ApiKey` 在本渠道是**钱包私钥**。本适配器委托响应处理的 `claude.Adaptor` 默认会 `req.Set("x-api-key", info.ApiKey)`、`openai.Adaptor` 默认设 `Authorization: Bearer info.ApiKey` —— 这正是适配器**自写 `SetupRequestHeader` 而不委托**头部设置的根本原因:

- `SetupRequestHeader` **绝不**设 `x-api-key` / `Authorization`;鉴权完全靠 EIP-712 x402 签名(`Payment-Signature` 头),没有任何"传输的密钥"。
- 它只设 content-type/accept;Claude 面补 `anthropic-version`(默认 `2023-06-01`)、透传客户端 `anthropic-beta`;retry 时注入 `Payment-Signature`。
- 跳过 `ClaudeSettings.WriteHeaders`(命名空间模型名对不上,且偏离纯透传)。
- 单测 `TestSetupRequestHeader_NoWalletKeyLeak` 断言 OpenAI / Claude 两种入流下,生成的请求头里都不出现钱包私钥内容。

### 4.2 上游 402 的信任边界

402 响应里的 `payTo` / `amount` / `asset` / `network` / `maxTimeoutSeconds` 全部由上游 BlockRun 自己宣告 — 如果 BlockRun 被攻陷或者 TLS 出问题被 MITM 替换，可能宣告 `payTo = 攻击者地址` + `amount = 钱包全部余额` + `maxTimeoutSeconds = 31536000` 让我们签一个一年内有效的"全余额转账"授权。

为防止这类资损，`validatePaymentOption` 在签名前**强制校验**：

| 字段 | 规则 | 失败行为 |
|---|---|---|
| `MaxTimeoutSeconds` | `0 < t ≤ 300` 秒 | 拒签 |
| `Network` | 严格等于 `eip155:8453` 或 `eip155:84532` | 拒签（不允许其他链）|
| `Asset` | `strings.EqualFold` 等于 `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | 拒签（不允许其他 ERC-20）|
| `PayTo` | 0x 前缀 + 40 hex 字符 | 拒签 |
| `Amount` | `big.Int` 解析后为正、≤ 5_000_000（5 USDC）| 拒签 |

所有校验路径都有单测覆盖（24 个 reject case 涵盖前导零、零宽空格、null byte、科学计数法、负数、超界等 bypass 尝试）。

### 4.3 钱包余额管理

- 钱包 USDC 余额耗尽时，上游返回签名后仍 402，newapi 显式 `error("payment signature rejected by upstream...")` → 触发 newapi 的**自动渠道禁用 + 跨渠道重试**
- 建议给每个 BlockRun 钱包设独立的"低余额"监控告警（外部脚本调 Base USDC 合约 `balanceOf`）
- 多 key 模式可以把多个钱包配在一个渠道里做余额分摊

---

## 5. 注册位点速查

| 文件 | 改动 |
|---|---|
| `constant/channel.go` | `ChannelTypeBlockRun = 100`（59-99 保留给上游主仓库），`ChannelBaseURLs[100] = "https://blockrun.ai/api"`，`ChannelTypeNames` map entry |
| `constant/api_type.go` | `APITypeBlockRun` iota（追加于 APITypeCodex 后）|
| `common/api_type.go` | `ChannelType2APIType` switch 追加 case |
| `relay/relay_adaptor.go` | import + `GetAdaptor` switch 追加 case |
| `relay/common/relay_info.go` | `streamSupportedChannels[BlockRun] = true` |
| `web/default/src/features/channels/constants.ts` | `CHANNEL_TYPES[100] = 'BlockRun'` + `CHANNEL_TYPE_DISPLAY_ORDER` |
| `web/default/src/features/channels/lib/channel-type-config.ts` | defaultBaseUrl + hints 配置 |
| `web/default/src/features/channels/lib/channel-utils.ts` | TYPE_TO_ICON 映射 |
| `web/default/src/i18n/locales/{en,zh,fr,ja,ru,vi}.json` | `"BlockRun": "BlockRun"` 翻译 key |
| `web/classic/src/constants/channel.constants.js` | `CHANNEL_OPTIONS` 数组追加 |

ID 100 + 59-99 保留段：避免后续 `git pull` 从 QuantumNous/new-api 主仓库同步代码时出现 channel ID 冲突。

---

## 6. 支持的模型清单

通过实际调用 `GET https://blockrun.ai/api/v1/models` 抓取，仅保留 chat completions 类（image / video / music 走独立 endpoint，本适配器目前未实现）：

| 命名空间 | 模型 |
|---|---|
| `anthropic/` | claude-haiku-4.5, claude-sonnet-4.5, claude-sonnet-4.6, claude-opus-4.5, claude-opus-4.7, claude-opus-4.8 |
| `openai/` | gpt-5.5, gpt-5.4, gpt-5.4-pro, gpt-5.4-mini, gpt-5.4-nano, gpt-5.3, gpt-5.3-codex, gpt-5.2, gpt-5.2-pro, gpt-5-mini, o1, o1-mini, o3, o3-mini |
| `google/` | gemini-3.1-pro, gemini-3-pro-preview, gemini-3-flash-preview, gemini-3.1-flash-lite, gemini-2.5-pro, gemini-2.5-flash, gemini-2.5-flash-lite |
| `deepseek/` | deepseek-v4-pro, deepseek-chat, deepseek-reasoner |
| `moonshot/` | kimi-k2.6 |
| `zai/` | glm-5.1, glm-5, glm-5-turbo |
| `minimax/` | minimax-m2.7 |
| `nvidia/` | deepseek-v4-flash, qwen3-coder-480b, qwen3-next-80b-a3b-thinking, llama-4-maverick, mistral-small-4-119b, nemotron-3-nano-omni-30b-a3b-reasoning |

清单可在管理端覆盖。上游若新增/下线模型，重新 `curl /v1/models` 同步即可。

---

## 7. 使用指南

### 7.1 管理员配置渠道

1. 准备一个 Base 链 EVM 钱包，充入足够 USDC（建议 ≥ $10）
2. 在 newapi 后台「渠道」→「创建渠道」：
   - **类型**：BlockRun
   - **名称**：自定义
   - **API 地址**：留空（默认 `https://blockrun.ai/api`）
   - **密钥**：钱包私钥（0x 前缀 64 hex）
   - **模型**：点"填充默认模型"自动填默认清单（当前 41 个，见 §6）
   - **分组 / 优先级 / 权重**：跟其他渠道一致
3. 可选 — 加 model mapping 让用户用官方模型名调用：
   ```json
   {
     "claude-opus-4-20250514": "anthropic/claude-opus-4.7",
     "claude-sonnet-4-5-20250219": "anthropic/claude-sonnet-4.6",
     "claude-haiku-4-5-20251001": "anthropic/claude-haiku-4.5",
     "gpt-4o": "openai/gpt-5.4-mini",
     "gemini-1.5-pro": "google/gemini-2.5-pro"
   }
   ```
   > model mapping 映射的是**模型名**,与入流**格式**无关:用 OpenAI SDK 调 `gemini-1.5-pro` 会被改写为 `google/gemini-2.5-pro` 并走 `/v1/chat/completions`(OpenAI 格式)正常工作;**不支持**的是用 Gemini **原生 API 格式**(`generateContent`)入流(见 §10)。
4. 保存 → 用渠道列表上的"测试"按钮做内置 ping 测试（会真实扣一笔 USDC）

### 7.2 终端用户调用（OpenAI SDK）

```python
from openai import OpenAI
client = OpenAI(
    base_url="https://your-newapi.example.com/v1",
    api_key="sk-newapi-token",
)
resp = client.chat.completions.create(
    model="anthropic/claude-haiku-4.5",
    messages=[{"role": "user", "content": "Hello"}],
)
```

### 7.3 Claude Code 配置

```bash
export ANTHROPIC_BASE_URL=https://your-newapi.example.com
export ANTHROPIC_AUTH_TOKEN=sk-newapi-token
claude
```

或写进 `~/.claude/settings.json`：
```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://your-newapi.example.com",
    "ANTHROPIC_AUTH_TOKEN": "sk-newapi-token"
  }
}
```

Claude Code 会调 `POST /v1/messages`，newapi 识别为 Claude format → BlockRun adaptor **原样透传**到上游原生 `/v1/messages`(无 Claude→OpenAI 转换)→ 上游回**原生 Anthropic 响应** → newapi 用原生 claude handler **原样回字节**给 Claude Code。客户端因此拿到上游真实信号:**thinking 签名、原生 content blocks、cache token、原生 SSE 流式**。

> 该路径要求渠道钱包**已加入 VIP 白名单**。否则上游原生 `/v1/messages` 会失败 —— 此时建议改用 OpenAI SDK 走 `/v1/chat/completions`(不受 VIP 限制)。

### 7.4 计费的双层结构

| 计费层 | 谁出钱 | 怎么算 |
|---|---|---|
| **newapi 内部计费** | 终端用户的 newapi 配额 | 按 `usage.prompt_tokens × input_price + usage.completion_tokens × output_price`（管理员在模型价格表里设的 ratio）|
| **链上 USDC 扣款** | 管理员的钱包 | BlockRun 在 402 里报多少就扣多少（按调用一次性，**不是按 token**）|

两层独立计费 — 管理员需要参考 BlockRun 报价（claude-haiku-4.5 ~$0.005/call、claude-opus-4.7 ~$0.022/call 等）合理设置 newapi 价格表，避免倒贴。

---

## 8. 测试 / 验证

### 8.1 单测（无 build tag，可在 CI 跑）

```bash
go test ./relay/channel/blockrun/...
```

覆盖：
- `TestValidatePaymentOption_*` — accept(baseline / Base Sepolia / 大小写 asset) + reject case，覆盖所有 bypass 向量
- `TestValidatePaymentOption_AtCapBoundary` / `AtTimeoutBoundary` — 边界值精确等于 cap 必须通过
- `TestLooksLikeEthAddress` — 3 good + 7 bad
- `TestParsePrivateKey` — 含"错误消息绝不泄漏 key 内容"断言
- `TestGetRequestURL_NativePassthroughByFormat` / `ClaudeBetaQuery` / `GeminiUnsupported` — 按格式分派(Claude→`/v1/messages`、OpenAI→`/v1/chat/completions`、Gemini 报错)及 `?beta=true` 拼接
- `TestConvertClaudeRequest_Passthrough` / `TestConvertOpenAIRequest_Passthrough` — 原样透传(返回原 request)
- `TestConvertGeminiRequest_Unsupported` — Gemini 入流报错
- `TestSetupRequestHeader_NoWalletKeyLeak` — OpenAI / Claude 两种入流下请求头都不含钱包私钥
- `TestSetupRequestHeader_ClaudeAnthropicVersionDefault` / `OpenAINoAnthropicVersion` / `PaymentSignatureInjection` — 头部行为

### 8.2 实链 e2e（需要钱包私钥 + 链上 USDC 余额）

```bash
BLOCKRUN_TEST_WALLET_KEY=0x... \
  go test -tags=e2e_blockrun -v ./relay/channel/blockrun/...
```

走完整 402 → 签名 → 200 流程，链上真实扣一笔 USDC。

### 8.3 本机端到端验证

```bash
# 后端启动后（默认 localhost:3000）
TOKEN="sk-your-newapi-token"

# OpenAI 非流式 → 原生 /v1/chat/completions，返回原生 OpenAI 格式
curl localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"model":"openai/gpt-5.4-nano","messages":[{"role":"user","content":"pong"}],"max_tokens":20}'

# OpenAI 流式
curl -N localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"model":"openai/gpt-5.4-nano","messages":[{"role":"user","content":"hi"}],"stream":true,"max_tokens":20}'

# Claude Messages API（Claude Code 路径，VIP）→ 原生 /v1/messages，返回原生 Anthropic 格式
curl localhost:3000/v1/messages \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -H "anthropic-version: 2023-06-01" \
  -d '{"model":"anthropic/claude-haiku-4.5","messages":[{"role":"user","content":"pong"}],"max_tokens":20}'
```

---

## 9. 故障排查

| 症状 | 原因 | 解决 |
|---|---|---|
| 渠道测试失败，日志显示 `payment signature rejected by upstream` | 钱包 USDC 余额不足 | 给钱包充值，重新测试 |
| 日志显示 `blockrun: refusing Ns authorization window` | 上游 402 宣告的 timeout 超过 300s — 可能是 BlockRun 配置变更或 MITM | 不要绕过校验，先排查网络 / TLS / 上游变更 |
| 日志显示 `blockrun: unexpected network` 或 `unexpected asset` | 上游协议变更，新网络/资产 | 在 `x402.go` 的 `expectedNetwork*` / `expectedAsset*` 白名单加新值并加测试 |
| 日志显示 `wallet private key must be 64 hex chars` | 渠道密钥字段不是合法私钥 | 重新检查并粘贴正确的 0x 前缀私钥 |
| `payment-required header in 402 response` 解析失败 | 上游协议升级到 x402 v3 等 | 升级 `BlockRunAI/blockrun-llm-go` 或在 `extractPaymentRequired` 加新头格式 |
| Claude Code 请求模型名 404 | 用了 Anthropic 官方模型名但没配 model mapping | 在渠道配置加 model mapping，把官方名映射到 `anthropic/claude-*` |
| `/v1/messages`（Claude 入流）从上游失败，OpenAI 端点却正常 | 钱包**未开通 VIP 白名单** —— 原生 `/v1/messages` 仅对白名单钱包开放 | 联系 BlockRun 为该钱包开通 VIP；或临时改用 OpenAI SDK 走 `/v1/chat/completions`（不受 VIP 限制）|
| 调用返回 `blockrun: gemini format not supported ...` | 用 Gemini **格式**（`generateContent`）入流 | VIP 仅原生支持 Anthropic + OpenAI；若要用 `google/gemini-*` 模型，改走 OpenAI SDK / `/v1/chat/completions` |
| 调用返回 `image not supported` 等 | 尝试用 BlockRun 渠道走 image / video / audio / embedding endpoint | 这些目前未实现，需后续开发 |

实时日志：管理端「日志」页搜 channel = BlockRun 看具体错误。

---

## 10. 当前限制 / 未来工作

| 能力 | 当前 | 备注 |
|---|---|---|
| OpenAI Chat Completions（`/v1/chat/completions`）| ✅ | 原生透传，流式 + 非流式 + tool use + 多模态 |
| Anthropic Messages（`/v1/messages`，VIP）| ✅ | 原生透传，保留 thinking 签名 / 原生 content blocks / cache token / 原生 SSE。**需钱包 VIP 白名单** |
| Gemini 入流（`/v1beta/...generateContent`）| ❌ | VIP 仅原生支持 Anthropic + OpenAI，Gemini **格式**入流直接报错。注：`google/gemini-*` **模型**仍可经 OpenAI SDK 走 `/v1/chat/completions` 调用 |
| `/v1/messages/count_tokens` | ❌ | relay/constant 无对应 RelayMode，无法路由到本适配器，超出当前范围 |
| Image Generation | ❌ | 上游 BlockRun 支持 dall-e-3 / gpt-image-* / nano-banana / cogview-4 / grok-imagine-image 等，需在 adaptor 实现 `ConvertImageRequest` + 改 `GetRequestURL` 指向 `/v1/images/generations` |
| Video Generation | ❌ | 上游是异步任务模式（提交→轮询），需要走 newapi 的 `TaskAdaptor` 接口而非 `Adaptor` |
| Music Generation | ❌ | 同视频 |
| Embedding / Rerank / Audio | ❌ | 待评估上游支持情况 |
| Responses API | ❌ | BlockRun 当前不支持 |
| BlockRun 链上工具类（Exa / 0x Swap / Prediction Market / Phone / Twitter） | ❌ | 不在 newapi 抽象内，需要扩展整个框架 |
| 钱包余额自动查询 | ❌ | 需要在 `controller/channel-billing.go` 加 `updateChannelBlockRunBalance`（调 Base USDC `balanceOf`），可选改进 |
| Prompt caching（`cache_control`）端到端 | ✅ | 原生透传下,Claude 入流的 `cache_control` 原样转发上游、响应原生 `usage.cache_creation_input_tokens` / `cache_read_input_tokens` 原样返回。改造前依赖 Claude→OpenAI 转换链的限制已消除(不再做 `injectCache`,缓存标记由客户端自控)|

---

## 11. 参考资料

- x402 协议规范：<https://github.com/coinbase/x402/blob/main/specs/x402-specification-v2.md>
- x402 HTTP transport：<https://github.com/coinbase/x402/blob/main/specs/transports-v2/http.md>
- x402 EVM exact scheme：<https://github.com/coinbase/x402/blob/main/specs/schemes/exact/scheme_exact_evm.md>
- ERC-3009（Transfer With Authorization）：<https://eips.ethereum.org/EIPS/eip-3009>
- EIP-712（Typed Structured Data Hashing）：<https://eips.ethereum.org/EIPS/eip-712>
- Base 主网 USDC 合约：<https://basescan.org/address/0x833589fcd6edb6e08f4c7c32d4f71b54bda02913>
- BlockRun 官方文档：<https://blockrun.ai/docs>
- BlockRun Go SDK（base，`v0.11.0`，本渠道依赖）：<https://github.com/BlockRunAI/blockrun-llm-go>
- VIP 原生透传改造方案（设计/决策来源）：[`blockrun-vip-migration.md`](./blockrun-vip-migration.md)
