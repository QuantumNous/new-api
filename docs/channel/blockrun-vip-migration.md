# BlockRun 渠道 VIP 原生透传改造方案

> 状态:**方案已定稿,待实现**(创建于 2026-06-03)
> 范围:**仅类型 100(BlockRun chat 渠道)**。视频 / Seedance / RealFace / Portrait 由**另一个独立 session** 负责,不在本方案内。
> 配套文档:现有协议/安全/注册说明见 [`blockrun.md`](./blockrun.md)。

---

## 1. 背景与目标

BlockRun 推出了 **VIP 能力**:对白名单钱包开放**原生透传**端点 —— Anthropic 走原生 `/v1/messages`、OpenAI 走原生 `/v1/chat/completions`,**零模型替换、零响应重塑**,客户端拿到上游真实信号(Claude thinking 签名、原生 content blocks、cache token、原生流式)。

现有类型 100 适配器的行为是**把所有格式都委托给 `openai.Adaptor` 并强制打 `/v1/chat/completions`**(Claude 入流被转成 OpenAI、响应被重塑成 OpenAI 格式)。本次改造将其升级为**按入流格式原生透传**。

---

## 2. 已敲定的关键决策

| # | 决策 | 结论 |
|---|---|---|
| 1 | Gemini 入流如何处理 | **报"不支持"**(严格对齐 VIP,VIP 仅原生支持 Anthropic + OpenAI) |
| 2 | OpenAI 格式调用 Claude 模型(`anthropic/claude-*`) | **一律打 `/v1/chat/completions`**,让网关按 model 名路由;响应仍是 OpenAI 格式(最纯透传) |
| 3 | 模型清单 / 模型命名 | **保持现有命名空间格式**(`anthropic/claude-*`、`openai/gpt-*` 等)。已与网关 `GET /v1/models` 实际清单核对 |
| 4 | 是否引入 `blockrun-llm-go-vip` 包 | **不引入**。改为升级底层 `blockrun-llm-go` `v0.7.0 → v0.11.0`(详见 §4) |
| 5 | 是否复刻 demo 的 `injectCache`(自动打 prompt-cache 标记) | **不做**,纯透传,cache_control 由客户端自行控制 |
| 6 | `/v1/messages/count_tokens` | 网关大概率不支持该 x402 端点 → **优雅报错**,不崩溃 |

### 模型清单(网关 `GET /v1/models` 实测,2026-06-03)

- 共 62 个模型;命名空间分布:openai(22)、google(10)、anthropic(6)、nvidia(6)、zai(4)、deepseek(3)、minimax(3)、xai(3)、bytedance(3)、moonshot(1)、azure(1)
- anthropic 系:`anthropic/claude-haiku-4.5`、`claude-sonnet-4.5`、`claude-sonnet-4.6`、`claude-opus-4.5`、`claude-opus-4.7`、`claude-opus-4.8`
- 上游新增/下线模型时,重新 `curl /v1/models` 同步即可;清单仅为"填充默认模型"初始集,管理端可覆盖

---

## 3. 为什么不直接 import `blockrun-llm-go-vip`(关键论证)

渠道方(BlockRun-Vicky)推荐 `blockrun-llm-vip`,称"穿透最准、专门给你们准备"。**该说法本身没错**,但需区分"用 VIP 能力"与"import VIP Go 包"两件事:

- **"穿透最准"的来源** = 打原生端点(`/v1/messages`)+ 字节级原样转发、不重塑。本方案给 newapi 的就是**同一种准**:同端点、同 x402 两跳、用 newapi 自己的 `claude`/`openai` handler 原样回字节流。
- **不 import 的原因(纯工程匹配)**:`blockrun-llm-go-vip` 的公开 API 返回的是**官方 `anthropic.Client` / `openai.Client`(强类型 client)**:
  - newapi 是 raw-HTTP/SSE 代理管线,喂入字节、吐出字节流;官方 client 要的是强类型 params、给的是已解析 struct。
  - 硬用 → 入流 JSON 映射成官方 params + 把解析好的 struct **重序列化**回 SSE = **多一层重塑,反而更不准**,与目标相悖。
  - 还会拖入 `anthropic-sdk-go` + `openai-go` 重依赖,且用不上我们更强的 x402 信任边界校验。
  - vip 包真正干活的 `x402Middleware` 是**未导出**的,拿不到字节级钩子。
- **对照先例**:AWS Bedrock 渠道能用官方 SDK,是因为其 `InvokeModel` 本身是**字节透传 API**;而 vip 的 `NewAnthropic/NewOpenAI` 是**强类型 client**,形状不符。
- **真正可复用、由 BlockRun 维护的协议代码(x402 签名)在底层 `blockrun-llm-go`**,本方案正是升级它。
- **实现时以 vip 包源码为"行为基准规范"**(其 `x402_middleware.go`、端点约定)逐字节对齐,既拿"最准的穿透"又不引入冲突的强类型 client。

> 一句话:**用她的 VIP 能力 ✅(同端点同协议同不重塑);import 她的 vip Go 包 ❌(强类型 client 不适配 newapi 代理模型 + 引入重塑)。**

### 3.1 两个官方 Go SDK 的区别(`blockrun-llm-go` vs `blockrun-llm-go-vip`)

VIP 包不是普通版的替代,而是**建在普通版之上**(其 `go.mod` 直接 `require github.com/BlockRunAI/blockrun-llm-go v0.11.0`,复用其 x402 签名与视频客户端)。核对自两仓源码(2026-06-03):

| 维度 | 普通版 `blockrun-llm-go`(散户) | VIP `blockrun-llm-go-vip` |
|---|---|---|
| chat/anthropic client | **BlockRun 自研**:`NewLLMClient`→`*LLMClient`、`NewAnthropicClient`→`*AnthropicClient` | **官方 SDK**:`NewAnthropic()`→`anthropic.Client`、`NewOpenAI()`→`openai.Client`,只换 transport + baseURL |
| 响应解析 | 解析进 BlockRun **自定义结构体** | 上游响应 **verbatim**,由**官方 SDK** 解析 |
| 原生信号保真 | **会丢**:自定义 `AnthropicContentBlock` **无 `Signature` 字段**(thinking 签名丢失),`AnthropicUsage` 仅 `InputTokens/OutputTokens`(**无 cache 明细**) | **完整**:真实 thinking `Signature`、原生 content blocks、cache token 用量、原生流式事件、GPT `system_fingerprint`/JSON mode |
| 依赖 | 仅 `go-ethereum`(自包含),go 1.22 | `blockrun-llm-go` + `anthropic-sdk-go v1.46` + `openai-go v1.12`,go 1.23 |
| 产品覆盖 | **极广**:chat / anthropic / image / video / music / voice / search / surf / market / prediction_market / phone / x_twitter / balance / realface / portrait(10+ client) | **窄**:仅 Anthropic + OpenAI 原生透传 +(re-export 普通版的)Seedance video/realface/portrait,共 5 个 .go 文件 |
| x402 支付 | 在此实现(`CreatePaymentPayload`/`ParsePaymentRequired`/`ExtractPaymentDetails`) | **复用普通版**,自身仅加一个 transport middleware(`x402_middleware.go`,未导出) |
| 支付链 | Base(+ Sepolia) | Base only(Solana 未移植) |

**"VIP 穿透最准"的本质**:不是端点不同(普通版的 `AnthropicClient` 也打 `/v1/messages`),而是 **"官方 SDK 解析 + 不重塑" vs "自研精简结构体重新表示"** —— 普通版会丢掉 thinking 签名、cache 明细、原生流式事件类型。

**对 newapi 的含义**:newapi 不消费"官方 client 对象",所以 import VIP 包无价值;我们**复刻 VIP 的网关行为**(同 `/v1/messages`、同 x402 协议、用 newapi `claude` handler **字节透传**)即可拿到与 VIP 等效的原生保真(签名/cache 都在原始字节里),**只从普通版借 x402 签名原语**。实测已验证:走 `/v1/messages` 拿回的就是原生 Anthropic 形状 + `input_tokens/output_tokens`。

---

## 4. 底层 SDK 升级

- `github.com/BlockRunAI/blockrun-llm-go`:`v0.7.0 → v0.11.0`(即 vip 包自身依赖的版本)
- **兼容性已核对**:`CreatePaymentPayload` 签名不变;`ParsePaymentRequired` 不变;`PaymentRequirement.Accepts` / `PaymentOption` 字段都在 → 现有 `x402.go` 可直接编译
- v0.11.0 新增 `ExtractPaymentDetails`(带 v1/v2 amount 兼容兜底),**可选采纳**
- 仓库内仅 `relay/channel/blockrun/x402.go` 一处 import 该 SDK,升级影响面极小;`go mod tidy` 处理 transitive 依赖

---

## 5. 核心设计:按 `info.RelayFormat` 分派的原生透传

适配器同时持有 `openai.Adaptor` 与 `claude.Adaptor`,每个接口方法按入流格式分派:

| 方法 | Claude 入流(RelayFormatClaude) | OpenAI 入流 | Gemini 入流 |
|---|---|---|---|
| `GetRequestURL` | `{base}/v1/messages`(+`?beta=true` 视 `ChannelOtherSettings.ClaudeBetaQuery`) | `{base}/v1/chat/completions` | 报错 |
| `ConvertClaudeRequest` | **原样透传**(`return request, nil`,不再转 OpenAI) | — | — |
| `ConvertOpenAIRequest` | — | 原样透传 | — |
| `ConvertGeminiRequest` | — | — | **报"不支持"** |
| `DoResponse` | 委托 `claude` 原生 handler(原样回 Claude SSE/JSON,含 thinking 签名) | 委托 `openai` handler | — |

### 安全红线 —— `SetupRequestHeader` 必须自写,不能委托

- claude 适配器默认会 `req.Set("x-api-key", info.ApiKey)`、openai 默认设 `Authorization: Bearer` —— 而 `info.ApiKey` 在本渠道是**钱包私钥**,**绝不能进 HTTP 头**。
- 自写的 `SetupRequestHeader`:设 content-type/accept;Claude 面补 `anthropic-version`、透传客户端 `anthropic-beta`;retry 时注入 `PAYMENT-SIGNATURE`;**绝不设 `x-api-key` / `Authorization`**。
- 跳过 `ClaudeSettings.WriteHeaders`(按命名空间模型名对不上,且偏离纯透传)。

### `DoRequest` —— x402 两跳(保留现有逻辑)

1. `channel.DoApiRequest` 发起(无签名)→ 期待 402
2. 解析 `Payment-Required` / `X-Payment-Required` / `Www-Authenticate: X402 ...`
3. `validatePaymentOption` 白名单校验(**保留**:≤300s 窗口、Base USDC、≤5 USDC 上限)
4. `CreatePaymentPayload` 做 EIP-712 签名
5. `c.Set(ctxKeyPaymentSignature, b64)` → 再发一次 → 200
6. 若仍 402:显式 error,不再循环(防资损)

> x402 两跳逻辑**格式无关**,对 `/v1/messages` 与 `/v1/chat/completions` 同样适用。

---

## 6. 文件改动清单

| 文件 | 改动 |
|---|---|
| `relay/channel/blockrun/adaptor.go` | 重写为分派式(见 §5) |
| `relay/channel/blockrun/x402.go` | 基本不动;**导出** `SignX402Payment`(原 `signX402Payment`)供视频 session 复用;保留全部信任边界校验 |
| `relay/channel/blockrun/constants.go` | `ModelList` 保持命名空间格式,按网关实际清单微调(可选) |
| `go.mod` / `go.sum` | `blockrun-llm-go` 升 v0.11.0,`go mod tidy` |
| `relay/channel/blockrun/url_test.go` | 改:Claude→`/v1/messages`、OpenAI→`/v1/chat/completions`、Gemini 报错 |
| `relay/channel/blockrun/x402_validate_test.go` | 校验单测保留(v0.11.0 `PaymentOption` 结构不变) |
| `docs/channel/blockrun.md` | 更新为原生透传说明 |

**前端**:类型 100 已注册,本次为纯后端行为改动,hint 文案("Pay-per-call USDC on Base via x402")仍准确,无需改。

---

## 7. 为视频 session 预留的兼容点

- **x402 签名导出**:视频若走"手拼 HTTP TaskAdaptor"可直接 `blockrun.SignX402Payment(...)`,无需复制
- **base SDK v0.11.0** 是两块共用版本(含视频 `VideoClient`/`RealFaceClient`/`PortraitClient`),先升到位
- **模型命名空间**(`bytedance/seedance-2.0` 等)、**钱包私钥即渠道密钥**的模型,两块一致
- 视频是异步任务,需新增 **x402 视频渠道类型(下一个空闲 ID = 102)** 走 `TaskAdaptor`;SDK 的 `VideoClient.Generate` 是阻塞式(网关内部轮询),与 newapi 异步轮询模型的取舍由视频 session 决定

---

## 8. 验证记录

### VIP 钱包实测(2026-06-03,base SDK v0.11.0 直连)

钱包 `0x2B4Ee3387008E5fF1A9996fc8B48D2fd61389037`:

| 测试 | 端点 / 模型 | 结果 |
|---|---|---|
| A 基线 | `/v1/chat/completions` `openai/gpt-5.4-nano` | ✅ OK(返回 "Hello",usage 正常) |
| B VIP | `/v1/messages` `anthropic/claude-haiku-4.5` | ✅ OK(原生 Anthropic 响应,`usage.input_tokens/output_tokens`) |

**结论:该钱包 VIP 已开通,原生 `/v1/messages` 透传可用,余额充足、签名被接受。方案可直接落地。**

> ⚠️ 安全:测试时私钥曾出现在协作对话中,建议**轮换该钱包**(转走余额 → 换新私钥 → 重新配渠道)。

### 全链路 E2E 实测矩阵(2026-06-03,直连 type-100 → blockrun.ai,真实钱包/USDC)

通过临时 new-api 服务(SQLite,type-100 渠道直连 `blockrun.ai/api`,无 api2 中转)对真实网关发起带计费的请求验证:

| 维度 | 路径 / 模型 | 结果 | 关键证据 |
|---|---|---|---|
| OpenAI 原生 | `/v1/chat/completions` `openai/gpt-5.4-nano` | ✅ | OpenAI `chat.completion` 形状,usage 正常 |
| OpenAI 调 Claude 模型 | `/v1/chat/completions` `anthropic/claude-haiku-4.5` | ✅ | 仍 OpenAI 形状(决策 #2) |
| **Claude 原生** | `/v1/messages` `anthropic/claude-haiku-4.5` | ✅ | 原生 Anthropic 形状(`type:message`、content blocks、`usage.input_tokens/output_tokens`) |
| **thinking(扩展思考)** | `/v1/messages` `anthropic/claude-sonnet-4.5` | ✅ | `type:thinking` 块 + **完整 1040 字符 `signature`**、`thinking_tokens=272` |
| **web_search(服务端工具)** | `/v1/messages` `anthropic/claude-sonnet-4.5` | ✅ | HTTP **200(非 400)**,`server_tool_use` + `web_search_tool_result`(含引用 URL) |
| **长输出(流式)** | `/v1/messages` `claude-sonnet-4.5` `max_tokens:2000` | ✅ | 流完整到 `message_stop`,`output_tokens=1647`、`stop_reason=end_turn`、无截断 |
| **prompt caching** | `/v1/messages` `claude-sonnet-4.5`(cache_control) | ✅ | call1 `cache_creation_input_tokens=1407`、call2 `cache_read_input_tokens=1407`,一致透出 |
| **错误透传 / 防泄露** | `/v1/messages` 非法 thinking budget | ✅ | 原生 Anthropic 错误形状;**无敏感泄露**(无钱包私钥/内部路径);文档 URL 被脱敏 |

**意义**:此前生产 QA 报告(链路 `new-api → api2(flatkey proxy.mjs / @blockrun/llm JS SDK)→ blockrun`)中标红的 **thinking 缺失 / web_search 失败 / 长输出截断 / cache token 不一致 / usage 缺失 / 错误信息泄露**,经实测在**本 PR 的直连原生透传**下全部通过——根因是被绕掉的 api2 那层 JS Zod 校验(网关侧已由渠道方修复),与 Go SDK 无关。

> 钱包私钥全程未出现在服务日志中(已 grep 校验 `0x`/去前缀/尾段三种形态均 0 命中)。

### 单测 / CI

- `go test ./relay/channel/blockrun/...`(无 build tag,含分派路由 + 钱包私钥不泄漏红线 + PAYMENT-SIGNATURE 注入,全绿)
- `gofmt` / `go vet` / `go build ./relay/...` 全清

### 已知问题(独立跟踪,不在本 PR 范围)

- Claude 格式错误透传时上游 `error.type` 被透出为字面量 `"<nil>"`(保真度小瑕疵,非安全问题,属共享 `relay/channel/claude/` 错误处理,影响所有 claude 渠道)。详见 [`claude-error-type-nil-followup.md`](./claude-error-type-nil-followup.md)。

---

## 9. 实现前置提醒(动手时务必检查)

1. `SetupRequestHeader` **屏蔽** `x-api-key`/`Authorization`(钱包私钥安全红线)
2. x402 两跳对**两个端点**都生效
3. Claude 原生流式 usage 计费走 newapi `claude` handler(网关返回标准 Anthropic usage,已确认)
4. 钱包需已开 VIP 白名单,否则原生 `/v1/messages` 会失败(OpenAI 端点不受此限)
