# BlockRun 图像异步轮询 + 结算数据落地 + 视频字段补全 — 设计

- 日期：2026-06-11
- 分支：`worktree-blockrun-image-async-billing`
- 状态：已与用户对齐范围（含 base SDK 升级；RealFace 移出）

## 1. 背景与事实基线（均已核验）

1. **BlockRun 图像端点是"速度分流"混合模式**：同一端点（`/v1/images/generations`、`/v1/images/image2image`），生成 ≤30s 同步返回 `200 {data:[{url}]}`；>30s 返回 `202 {id, status, poll_url, poll_instructions, price, payment_status}` 异步信封。图生图恒走异步。来源：生产实测 + base SDK v0.17.0 `image.go` `submitImageAndMaybePoll` 注释。
2. **结算时机（权威定论）**：x402 在提交跳只做签名/授权校验，**USDC 仅在首次轮询观察到 `completed` 时链上转账**；放弃不轮询、任务 `failed` 均不扣费。来源：vip SDK v0.4.1/v0.4.2 `video.go` 修正后注释 + base v0.17.0 `image.go` 注释（"the gateway settles USDC only on the first poll that observes status=completed"）。旧认知"提交即扣款"作废。
3. **图像/视频上游不返回 usage token**：`ImageResponse = {created, data[], tx_hash}`、`VideoResponse = {created, model, data[], txHash}`，仅 chat 有 `Usage`。成本信号只有 `price.amount`（USD，异步信封内）与 `tx_hash`（结算回执，v0.17.0 新增，来自 `X-Payment-Receipt` 头）。
4. **现状缺口**：
   - `relay/channel/blockrun/adaptor.go` 的 `normalizeImageAccepted` 把所有图像 202 盲改 200（按旧认知写的），慢图信封被原样透传给客户端 → 客户端拿到 `data:[]` 无图。
   - `relay/image_handler.go:153-157` 对 usage 兜底 token=1 → 未配价模型 quota=3 极低额结算。
   - 视频 `request.go` 误拒上游实际支持的首尾帧（`last_frame_url`）与 omni 多参考图（`reference_image_urls` ≤9）。
5. **base SDK v0.11.0 → v0.17.0 升级已验证可行**：我们仅依赖 `ParsePaymentRequired` / `CreatePaymentPayload` / `PaymentRequirement` / `PaymentOption` 4 个符号（`relay/channel/blockrun/x402.go`）；两版 `x402.go` **零 diff**；worktree 实测 `go get v0.17.0` 后全仓构建绿、`relay/channel/blockrun` 与 `relay/channel/task/blockrunseedance` 测试绿。

## 2. 目标 / 非目标

**目标**
- G1 客户端调图像接口获得**完全同步的 OpenAI 兼容体验**：慢图与图生图由 new-api 内部轮询，最终统一返回 `{data:[...]}`；客户端永不见异步信封。
- G2 `price.amount` / `tx_hash` 落入消费日志 `other` 字段，供成本对账。
- G3 视频出站映射补全 `last_frame_url`、`reference_image_urls`，解除误拒；对齐上游三类 seed 互斥规则。
- G4 base SDK 升级至 v0.17.0。
- G5 图像支持 `stream:true`：客户端请求流式时，new-api 本地合成 OpenAI 兼容 SSE（上游不支持流式），连接即刻建立、轮询期间心跳保活，根治"慢图超过客户端自身超时"问题。

**非目标**
- RealFace / Portrait 登记流程（独立排期）。
- 以 `price.amount` 作为计费基准的精准计费（二期；本期计费基准 = 后台配按张/按次价，属运营配置）。
- `aspect_ratio` / `duration` 取值域校验增强（非阻塞，另行小改）。

## 3. 设计

### D1 base SDK 升级（已完成验证，落地即 go.mod bump）

`go.mod`：`github.com/BlockRunAI/blockrun-llm-go v0.11.0 → v0.17.0`。**已在本 worktree 落地并验证**（commit `53fd1ebea`：全仓构建绿 + 两个 blockrun 包测试绿；4 符号 API 兼容、SDK x402.go 两版零 diff）。剩余工作仅为最终回归。注意：升级本身不带来代码减法——我们不采用 SDK `ImageClient`（架构上与 DoRequest→DoResponse 委派链不兼容），它仅作 D2 的参考实现。

### D2 图像 202 异步轮询（核心，`relay/channel/blockrun/adaptor.go`）

将 `normalizeImageAccepted` 替换为**响应判别 + 轮询**，仅作用于图像 RelayMode（generations / edits），在 `DoRequest` 的 x402 两跳完成后调用（`firstResp` 无 402 路径与 `retryResp` 路径两处）：

```
判别（读 body 一次，io.LimitReader 上限 64MB，读后重建 resp.Body）：
├─ 非 202                                → 原样交 DoResponse
├─ 202 且 body 含非空 data[]              → 改写 200 透传（兼容旧快路径怪癖）
├─ 202 且 body 含 poll_url               → 进入轮询循环
└─ 202 其它                              → 原样（DoResponse 走既有错误处理）

轮询循环（对齐 base v0.17.0 submitImageAndMaybePoll 的「单签名复用」模型）：
  pollURL = ResolveReference(ChannelBaseUrl, poll_url)
  签名 = 提交跳已产生的 PAYMENT-SIGNATURE（DoRequest 已 stash 于 gin context，
        adaptor.go ctxKeyPaymentSignature 机制现成；由 SignX402PaymentWithCaps +
        maxImageAuthorizationWindowSeconds(900s) 签出。900s ≥ SDK 为轮询预留的
        600s floor（image.go:301-304），覆盖 300s 预算绰绰有余）
  循环（总预算 300s，间隔 3s）：
    GET pollURL — 必须 http.NewRequestWithContext(c.Request.Context(), ...)，
                  每轮携带同一 PAYMENT-SIGNATURE 与 X-PAYMENT 双头
                  （对齐 SDK image.go:389 — SDK 轮询从不重签、也从无 402 分支）
    → 200 且 body 为 completed 形状（data[] 非空）→ 合成 200 http.Response
        （application/json）交 DoResponse
    → 202（status ∈ queued / in_progress）→ sleep 3s 继续
    → 504 → 视为瞬时抖动继续轮询（对齐 SDK image.go:420-429）
    → 402 → 硬错误退出：签名被拒。绝不在轮询中重签——重签可能产生第二次
        链上授权（资损风险）
    → status=failed 或其它 → NewAPIError（白标文案如 "image generation
        failed upstream"，不含上游品牌/host），不扣费
  超时（300s 未见 completed）→ NewAPIError 超时文案，不扣费
```

**资金安全（双向）**：
- **用户/钱包侧**：未观察到 `completed` 即不结算（基线 #2）——超时放弃、failed、客户端中途断开均不产生上游扣费。
- **平台侧（critic 补充的反向缺口）**：首次观察到 `completed` 的瞬间链上结算即不可逆。自该时刻起**必须保证本地计费落账**：不得因客户端断开或写响应失败而跳过 `PostTextConsumeQuota`；且 completed 之后的任何错误必须带 `ErrOptionWithSkipRetry`，禁止外层渠道重试造成二次提交二次付费。
- **签名模型**：单签名跨轮复用（900s 窗口覆盖全程 ~330s 最坏情形）；轮询中收到 402 按"签名被拒"硬失败，绝不重签。

**阻塞时长与取消**：最坏 ~30s 内联 + 300s 轮询 ≈ 5.5min << Cloud Run 3600s。图像无流式，阻塞安全。`http.Client` 单轮超时 60s（与 SDK 一致），总预算由循环 deadline 控制。取消传播必须用 `c.Request.Context().Done()`——本仓未启用 gin `ContextWithFallback`，`c.Done()` 恒为 nil，禁止使用。并发占用风险见 §7。

### D3 结算数据落地（`price.amount` / `tx_hash` → 消费日志 other）

- 新增 context key（`constant/` 包，如 `ContextKeyBlockRunSettlement`），D2 在拿到含结算信息的响应时 `c.Set(key, {price_amount, currency, tx_hash})`。
- **price 来源 = 202 异步信封体**（D2 判别时本就要读该 body 提 `poll_url`，顺手提取 `price.amount` 并 stash）。**不假设 completed 体携带 price**——SDK `decodeImageResponse` 不解析 price，该假设未经证实（critic M2）。同步 200 快路径无 price 即不写，不造数。
- `tx_hash` 优先取 completed/同步响应的 `X-Payment-Receipt` 头，body `tx_hash` 兜底。
- `service/log_info_generate.go` 的 `GenerateTextOtherInfo` 末尾读取该 key，存在则叠加 `upstream_price_usd` / `upstream_tx_hash` 字段——沿用 `InjectTieredBillingInfo` 的叠加模式，零侵入 handler 链（`PostTextConsumeQuota` → `GenerateTextOtherInfo` → `RecordConsumeLogParams.Other`，机制现成于 `model/log.go:219`）。
- **计费基准不变**：仍按后台模型价格结算。配价是上线 checklist 项（§6）。

### D4 视频字段补全（`relay/channel/task/blockrunseedance/request.go`）

入站统一 seedance `content[]`（Rule 8 不变），出站映射扩展：

| 入站形态 | 出站 | 现状 → 变更 |
|---|---|---|
| 单图无角色 | `image_url` | 不变 |
| `first_frame` + `last_frame` 角色图 | `image_url` + `last_frame_url` | **解除 `HasFirstLastFrame()` 误拒** |
| 多图无角色（2–9 张） | `reference_image_urls` | **解除 `len>1` 拒绝**；>9 仍拒 |
| `image_url` 组 / `reference_image_urls` / `real_face_asset_id` 同时出现 | — | fail-fast 互斥（对齐 vip v0.4.2 `buildVideoBody` 规则） |
| `video_url` / `audio_url` | — | 维持 fail-fast（上游确实不支持） |

`createRequest` 增加 `LastFrameURL string`、`ReferenceImageURLs []string`（`omitempty`；slice 空即省略，标量遵守 Rule 5 指针约定）。`last_frame_url` 需 `image_url` 同在（上游约束）：有 `last_frame` 角色而无首帧时 **fail-fast 硬错，不自动把尾帧提升为首帧**（对齐 vip video.go:218-223）。

### D5 图像 `stream:true` 本地 SSE 合成（BlockRun 渠道）

上游不支持图像流式（协议是"同步 200 或 202+poll"），`stream:true` 由 new-api 本地合成；这同时是慢图对抗"客户端自身超时"的根治手段（连接建立后靠心跳保活，不再依赖客户端容忍 ~5.5min 静默）。

**入站**
- `dto/openai_image.go` 启用被注释的 `Stream` 字段，定义为 `Stream *bool \`json:"stream,omitempty"\``（Rule 5 指针）。现状：`stream` 落入 `Extra`（`json:"-"` 不回传上游），等于被静默吞——启用后对 OpenAI 等原生支持图像流式的渠道是行为解锁（透传后走既有 Content-Type 嗅探通路，`image_handler.go:117`），需回归确认无副作用。
- BlockRun `ConvertImageRequest`：请求 `stream==true` 时置 `info.IsStream=true`，并从上游 body **剥离 `stream` 与 `partial_images`**（上游不识别，剥离防 400）。

**出站合成（blockrun adaptor 内）**
```
stream 模式下（仅图像 RelayMode）：
  DoRequest 入口即写 SSE 响应头并 flush（连接立刻建立）；
  x402 提交 + D2 轮询期间，每 ~10s 发 SSE 注释心跳（helper.PingData）；
  结果就绪后由 DoResponse 写终态事件：
    generations → image_generation.completed；edits → image_edit.completed
    payload 含 b64_json / created_at / size 等字段
  b64 来源：上游给 b64_json 直接用；只给 url 时由 new-api 下载（≤64MB cap）
    转 base64（顺带白标收益：不暴露上游 CDN）；下载失败降级为事件携带
    url 字段并记日志
  n>1：每张图一条 completed 事件
  partial_images：恒发 0 个 partial（OpenAI 语义允许 final 先于 partial 到达，
    合法）；不向上游转发
  SSE 已开始后出错：发 error 事件后关闭；错误一律带 ErrOptionWithSkipRetry
    （字节已写出，外层不可重试）
```

**钉死项**：终态事件的精确线格式（`event:` 行 vs data-only、是否 `[DONE]` 终止符、字段全集）实施时以 OpenAI 官方 Image Streaming 文档为准核对，测试锚定核对结果。计费路径不变（usage 构造与非流式一致，M3 平台侧保证同样适用）。

## 4. 错误处理

- 轮询任何阶段的错误均返回 `types.NewAPIError`，文案白标安全（不含上游品牌/host）；上游原始 body 仅进服务端日志。
- 信封 JSON 解析失败 / 缺 `poll_url`：按"202 其它"分支原样交 DoResponse 报错。
- JSON 统一走 `common.Unmarshal`（Rule 1）。

## 5. 测试策略（TDD）

**图像（`relay/channel/blockrun/adaptor_test.go` 扩展）**，httptest 假网关：
1. 快路径 200 → 透传不变；
2. 202+data[] → 改 200 透传（**重写 `TestNormalizeImageAccepted`**——旧测试断言"无条件 202→200"，与新判别语义冲突，必须替换而非追加）；
3. 202+poll_url → queued → in_progress → completed(200+data) → 客户端拿到 200+data，且每轮 GET 均携带同一 PAYMENT-SIGNATURE/X-PAYMENT；
4. 轮询收到 402 → **硬错误（不重签）**；
5. 轮询收到 504 → 继续轮询直至 completed；
6. failed → 报错且文案白标；
7. 超时（短预算注入）→ 报错；
8. 相对 poll_url 解析为绝对；
9. completed 缺 data → 报错；
10. `n>1` → 单次 completed body 返回全部 n 张图；
11. price 自 202 信封提取、tx_hash 自 `X-Payment-Receipt` 头优先提取，入 context。

**图像 stream（D5）**：
12. stream + 快路径（同步 200）→ SSE：headers 立即可见、一条 completed 事件；
13. stream + 慢路径（202→poll→completed）→ 轮询期间可观测到心跳注释、终态 completed 事件；
14. stream + failed → SSE error 事件且带 SkipRetry；
15. b64 下载降级：url 下载失败 → 事件携带 url 字段；
16. 上游 body 已剥离 `stream`/`partial_images`（假网关断言收到的 body）；
17. 非流式路径回归不受 `Stream` 字段启用影响（含其它渠道序列化抽查）。

**视频（`request_test.go` 扩展）**：首尾帧映射、多图→reference、>9 拒、三类 seed 互斥、缺首帧拒、video/audio 仍拒。

**结算注入**：`GenerateTextOtherInfo` 存在/不存在 key 两态。

**回归**：`go build ./...`、blockrun + blockrunseedance + service 相关测试全绿。

## 6. 上线 checklist（代码外）

1. **运营配价**：后台给 `openai/gpt-image-2` 等图像模型配按张价、`seedance-*` 配按次价（价格模式非倍率，≥ 上游成本+毛利）——否则 token=1 兜底继续以 quota≈3 结算。
2. 部署后生产验证：慢图（>30s prompt）端到端拿图；图生图端到端；消费日志可见 `upstream_price_usd`/`upstream_tx_hash`。
   **首次生产验证须抓取完整协议样本**（202 信封原文、每轮 poll 状态码、completed body），确认两个设计假设：① 轮询携带复用签名时是否从不 402；② price 是否确实只在 202 信封。若与假设不符，回修 D2/D3 再放量。
3. 视频侧 PR #92 已合并，随本次部署一并生产验证 create→poll→content 全链路。

## 7. 风险与缓解

| 风险 | 缓解 |
|---|---|
| 上游协议再变（信封字段/状态枚举与实测不符） | 判别失败兜底为"原样交 DoResponse 报错"，不会卡死；测试用例锚定当前协议；首验抓包确认（§6.2） |
| 轮询期上游意外返回 402（与 SDK 单签名模型不符） | 按"签名被拒"硬失败、绝不重签（重签=二次链上授权风险）；若生产抓包证实轮询确实要求重签，回评审签名策略 |
| **completed 已结算但客户端已断开** → 平台已付上游、用户未计费 | completed 观察后视结算为既成事实：不因 ctx 取消跳过 `PostTextConsumeQuota`；其后错误一律带 `ErrOptionWithSkipRetry` 防外层重试二次付费 |
| 内联阻塞下并发慢图占用 goroutine/连接池（每张慢图挂起一个 handler 最长 ~5.5min） | 本期接受（图像 QPS 低、Cloud Run 可横向扩容）；记录跟进项：必要时加 per-channel in-flight 上限 |
| 客户端自身超时 < 我们轮询时长 | 客户端放弃不影响钱包资金（未 completed 不结算）；文档注明最长等待 ~5.5min |
| `price.amount` 在同步快路径缺失 | 不造数，缺失即不写 other；对账以 tx_hash 为准 |
| 升级 SDK 引入隐性行为变化 | 已验证 x402.go 零 diff + 全量构建/测试绿；仅 bump 不改调用 |
| SSE 头已发出后才出错（无法再改状态码） | 发 OpenAI 风格 error 事件后关闭 + SkipRetry；事件格式实施时对官方文档核对 |
| b64 合成需经 new-api 下载图片（额外一跳，MB 级） | 64MB cap + 失败降级 url 字段；顺带白标收益 |
| 启用 `Stream` 字段改变其它渠道图像请求序列化 | 指针+omitempty 缺省不变；显式 true 对 OpenAI 系是行为解锁而非破坏；§5.17 回归锚定 |
