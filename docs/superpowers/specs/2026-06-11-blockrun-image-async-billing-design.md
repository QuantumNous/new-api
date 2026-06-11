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

**非目标**
- RealFace / Portrait 登记流程（独立排期）。
- 图像 `stream:true` 流式（后续演进）。
- 以 `price.amount` 作为计费基准的精准计费（二期；本期计费基准 = 后台配按张/按次价，属运营配置）。
- `aspect_ratio` / `duration` 取值域校验增强（非阻塞，另行小改）。

## 3. 设计

### D1 base SDK 升级（已完成验证，落地即 go.mod bump）

`go.mod`：`github.com/BlockRunAI/blockrun-llm-go v0.11.0 → v0.17.0`。无代码改动（4 符号 API 兼容、x402.go 零 diff）。回归跑两个 blockrun 包测试。

### D2 图像 202 异步轮询（核心，`relay/channel/blockrun/adaptor.go`）

将 `normalizeImageAccepted` 替换为**响应判别 + 轮询**，仅作用于图像 RelayMode（generations / edits），在 `DoRequest` 的 x402 两跳完成后调用（`firstResp` 无 402 路径与 `retryResp` 路径两处）：

```
判别（读 body 一次，io.LimitReader 上限 64MB，读后重建 resp.Body）：
├─ 非 202                                → 原样交 DoResponse
├─ 202 且 body 含非空 data[]              → 改写 200 透传（兼容旧快路径怪癖）
├─ 202 且 body 含 poll_url               → 进入轮询循环
└─ 202 其它                              → 原样（DoResponse 走既有错误处理）

轮询循环（参照 base v0.17.0 submitImageAndMaybePoll + 我们 seedance FetchTask）：
  pollURL = ResolveReference(ChannelBaseUrl, poll_url)   // 复用 seedance absoluteURL 模式
  循环（总预算 300s，间隔 3s，尊重 c.Request.Context() 取消）：
    GET pollURL
    → 402 → SignX402PaymentForImage 签名（900s 窗口上限，函数已有）
            → 设 PAYMENT-SIGNATURE 与 X-PAYMENT 双头（对齐官方 SDK）→ 重试一次；
            重试后仍 402 → 报错退出（防重复签名，对齐 chat/seedance 守卫）
    → 200 且 data[] 非空（completed）→ 合成 200 http.Response（application/json）
                                       交 DoResponse；并提取 price/tx_hash（见 D3）
    → 202（queued / in_progress）→ sleep 3s 继续
    → status=failed 或其它状态码 → NewAPIError（白标安全文案，如
      "image generation failed upstream"），不暴露 BlockRun 字样原文
  超时（300s 未见 completed）→ NewAPIError 超时文案
```

**资金安全**：依据事实基线 #2，未观察到 `completed` 即不结算——超时放弃与 failed 都不产生扣费；轮询路径无资损风险。每轮 402→重签（不复用签名），与 seedance 一致，不依赖签名窗口跨轮存活。

**阻塞时长**：最坏 ~30s 内联 + 300s 轮询 ≈ 5.5min << Cloud Run 3600s。图像无流式，阻塞安全。`http.Client` 单次轮询超时取 60s（与 SDK 一致），总预算由循环 deadline 控制。

### D3 结算数据落地（`price.amount` / `tx_hash` → 消费日志 other）

- 新增 context key（`constant/` 包，如 `ContextKeyBlockRunSettlement`），D2 在拿到含结算信息的响应时 `c.Set(key, {price_amount, currency, tx_hash})`。`tx_hash` 优先取 `X-Payment-Receipt` 响应头，body `tx_hash` 兜底；`price` 取异步信封/completed 体内 `price.amount`（同步 200 快路径没有就不写，不造数）。
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

`createRequest` 增加 `LastFrameURL string`、`ReferenceImageURLs []string`（`omitempty`；slice 空即省略，标量遵守 Rule 5 指针约定）。`last_frame_url` 需 `image_url` 同在（上游约束），缺首帧时 fail-fast。

## 4. 错误处理

- 轮询任何阶段的错误均返回 `types.NewAPIError`，文案白标安全（不含上游品牌/host）；上游原始 body 仅进服务端日志。
- 信封 JSON 解析失败 / 缺 `poll_url`：按"202 其它"分支原样交 DoResponse 报错。
- JSON 统一走 `common.Unmarshal`（Rule 1）。

## 5. 测试策略（TDD）

**图像（`relay/channel/blockrun/adaptor_test.go` 扩展）**，httptest 假网关：
1. 快路径 200 → 透传不变；
2. 202+data[] → 改 200 透传（回归既有用例）；
3. 202+poll_url → queued → in_progress → completed(200+data) → 客户端拿到 200+data；
4. 轮询 402 → 签名重试 → 完成；重试后仍 402 → 报错；
5. failed → 报错且文案白标；
6. 超时（短预算注入）→ 报错；
7. 相对 poll_url 解析为绝对；
8. completed 缺 data → 报错；
9. price/tx_hash 提取并入 context（含 `X-Payment-Receipt` 头优先）。

**视频（`request_test.go` 扩展）**：首尾帧映射、多图→reference、>9 拒、三类 seed 互斥、缺首帧拒、video/audio 仍拒。

**结算注入**：`GenerateTextOtherInfo` 存在/不存在 key 两态。

**回归**：`go build ./...`、blockrun + blockrunseedance + service 相关测试全绿。

## 6. 上线 checklist（代码外）

1. **运营配价**：后台给 `openai/gpt-image-2` 等图像模型配按张价、`seedance-*` 配按次价（价格模式非倍率，≥ 上游成本+毛利）——否则 token=1 兜底继续以 quota≈3 结算。
2. 部署后生产验证：慢图（>30s prompt）端到端拿图；图生图端到端；消费日志可见 `upstream_price_usd`/`upstream_tx_hash`。
3. 视频侧 PR #92 已合并，随本次部署一并生产验证 create→poll→content 全链路。

## 7. 风险与缓解

| 风险 | 缓解 |
|---|---|
| 上游协议再变（信封字段/状态枚举与实测不符） | 判别失败兜底为"原样交 DoResponse 报错"，不会卡死；测试用例锚定当前协议 |
| 客户端自身超时 < 我们轮询时长 | 客户端放弃不影响资金（未 completed 不结算）；文档注明最长等待 ~5.5min |
| `price.amount` 在同步快路径缺失 | 不造数，缺失即不写 other；对账以 tx_hash 为准 |
| 升级 SDK 引入隐性行为变化 | 已验证 x402.go 零 diff + 全量构建/测试绿；仅 bump 不改调用 |
