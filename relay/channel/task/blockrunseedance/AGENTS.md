<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-02 | Updated: 2026-07-02 -->

# relay/channel/task/blockrunseedance

## Purpose

BlockRun VIP Seedance 视频生成适配器（白标渠道）。上游为 BlockRun 网关 `POST /v1/videos/generations`，背后跑的是 ByteDance Seedance 2.0 / 2.0-fast / 1.5-pro 模型。**与其它 seedance 渠道（kuaizi/doubao）有三个本质差异**：

1. **x402 鉴权**：没有 `Authorization` 头。第一个请求由上游返回 HTTP 402 Payment Required，适配器用 channel Key 中存储的 EVM 钱包私钥签 EIP-712 USDC 授权（`SignX402PaymentWithCaps`），带 `PAYMENT-SIGNATURE` + `X-PAYMENT` 头重发。submit 是付费腿，poll 阶段在完成时再结算一次（poll 也可能 402 → 重签）。
2. **202-gate 归一化**：上游 submit 返回 202 `{id,status,poll_url}`，poll 进行中返回 202、完成返回 200。`DoRequest` / `FetchTask` 中显式调用 `normalizeAcceptedStatus` 把 202 改写成 200 再返回（详见 `relay/channel/task/AGENTS.md` 的 202-gate 约定）。
3. **`poll_url` 作为上游 task_id 存储**：`DoResponse` 把绝对化后的 `poll_url` 当作 task_id 返回给框架；`FetchTask` 直接 GET 这个 URL。

入站使用官方 seedance `content[]` 格式（`taskcommon.BindSeedanceRequest`），白标伪模型名（`seedance-2.0` / `seedance-2.0-fast` / `seedance-1.5-pro`）在 `constants.go` 的 `modelToUpstream` 里映射到上游真实模型 id（`bytedance/seedance-*`）。**结果走 `/v1/videos/{task_id}/content` 代理**，绝不暴露上游 host；错误信息经 `taskcommon.ScrubBrandedText` 脱敏。本渠道是 seedance SOP 的 x402 + 202-gate 参考实现（见父文档 SOP 章节）。

## Key Files

| File | Description |
|------|-------------|
| `adaptor.go` | `TaskAdaptor` 主实现。嵌入 `taskcommon.BaseBilling`。覆盖的方法：`Init`、`ValidateRequestAndSetAction`（`BindSeedanceRequest` + 取值校验）、`BuildRequestURL`、`BuildRequestHeader`（仅 Content-Type / Accept，**无** Authorization）、`BuildRequestBody`（调 `buildBlockrunSeedanceCreateRequest` + `common.MarshalNoHTMLEscape`）、`DoRequest`（x402 两程签名 + `normalizeAcceptedStatus`）、`DoResponse`（解析 `poll_url`、绝对化、写白标 envelope）、`FetchTask`（GET `poll_url`，402 再签 + 归一化）、`ParseTaskResult`、`ConvertToOpenAIVideo`（白标代理 URL + ScrubBrandedText）。还有导出的 `ExtractUpstreamVideoURL`（供 `controller.VideoProxy` 服务端解析真实 MP4 地址） |
| `constants.go` | `ChannelName = "blockrun-seedance"`；`ModelList`（3 个白标伪模型名）；`modelToUpstream` 反查表（伪名 + 上游 wire 名两种 key 都能解析）；`upstreamModel` / `supportsRealFaceAsset` / `supportsOmniReference` 模型能力查询；两个安全常量 `maxAmountAtomicUSDCVideo = 10_000_000`（10 USDC，6 decimals，单次视频金额上限）与 `maxAuthorizationWindowSecondsVideo = 1200`（20 分钟，覆盖 chat 默认的 300s，适配异步 submit→poll 结算时序） |
| `request.go` | 纯映射与取值校验逻辑，无 IO，便于单测。`createRequest`（上游 wire body，可选标量全部用指针 + `omitempty` 遵循 Rule 5）、`blockrunExtensions`（仅本渠道支持的非官方字段 `real_face_asset_id`）、`buildBlockrunSeedanceCreateRequest`（seedance → BlockRun body 映射纯函数）、`supportedResolutions` / `validateResolution`（fail fast）、`validateSeedanceValues`（输入模式与扩展字段互斥校验）、`droppedSeedanceFields` / `debugLogDropped`（DEBUG 日志：列出被丢弃的官方字段） |
| `adaptor_test.go` | adaptor 行为单测 |
| `constants_test.go` | `modelToUpstream` / `upstreamModel` / `supportsRealFaceAsset` / `supportsOmniReference` 表驱动测试 |
| `request_test.go` | `buildBlockrunSeedanceCreateRequest` 与 `validateSeedanceValues` 测试 |
| `request_seed_mapping_test.go` | seedance 图像（first_frame/last_frame/reference_image）→ BlockRun `image_url`/`last_frame_url`/`reference_image_urls` 的映射矩阵测试 |

## For AI Agents

### Working In This Directory

- **嵌入 `taskcommon.BaseBilling`**：获得默认的 `AdjustBillingOnSubmit` / `AdjustBillingOnComplete`，无需自定义 `EstimateBilling`（seedance 系按 `task.PrivateData` 里落库的 usage 自动结算，见父文档 SOP）。
- **入站 `BindSeedanceRequest`**：`ValidateRequestAndSetAction` 调用 `taskcommon.BindSeedanceRequest(c, info, constant.TaskActionGenerate)`，解析官方 `content[]` 并缓存到 gin context。**不再**有任何旧的 prompt/images/metadata 入参形态。
- **x402 三要点**（修改时必须同时考虑）：
  1. **钱包私钥存 channel Key**（`info.ApiKey`），格式为 `0x` 前缀 hex。**永远不能** 进入任何 header 除了派生签名本身。
  2. **金额/窗口上限是硬保护**：`maxAmountAtomicUSDCVideo` 拒绝明显恶意的 402；`maxAuthorizationWindowSecondsVideo` 限制 standing transfer order 的有效窗口。这两个常量任何调整都直接改变资金风险敞口，需谨慎。
  3. **402-after-signing 必须返回 Go error，不能返回响应**：否则通用 poller 会把 402 JSON 当作 in_progress，每个 tick 重新签名 → 重复扣费。代码里有显式注释强调这点。
- **202-gate**：`normalizeAcceptedStatus(resp)` 在 `DoRequest` 与 `FetchTask` 返回前调用，把 202 改写成 200。原因：通用编排器 `relay/relay_task.go` 在 `DoRequest` 非 200 时直接拒绝、不会调 `DoResponse`；poll 路径同理。父文档「202-gate」章节有完整说明。
- **`poll_url` 是上游 task_id**：`DoResponse` 用 `absoluteURL` 把相对 URL 解析成绝对（基于 `a.baseURL`），存为 task_id；`FetchTask` 直接 GET 这个 URL。
- **`common.MarshalNoHTMLEscape`（Rule 1）**：`BuildRequestBody` 用 `MarshalNoHTMLEscape` 而不是 `Marshal`，避免 URL 中的 `&` 被 HTML 转义成 `&`（上游会拒绝）。
- **Rule 5（指针 + omitempty）**：`createRequest` 中所有可选标量都用指针（`*int` / `*bool`），显式零值也要发上游；只有 `Prompt` 与 `Model` 例外（Prompt 即使空也发，FIX #9）。
- **seedance 图像映射（互斥）**：first_frame/last_frame 走 `image_url` + `last_frame_url`（不能配 reference）；2~9 张 reference（或 1 张显式 role=reference_image）走 `reference_image_urls`；单张无 role 当 image-to-video seed 走 `image_url`。互斥规则在 `validateSeedanceValues` 中 fail fast。
- **模型能力门控**：`real_face_asset_id` 与 `reference_image_urls` 仅 Seedance 2.0 / 2.0-fast 支持；其它模型在 `validateSeedanceValues` 提前报错，避免上游 4xx 烧预扣额。
- **白标**：渠道在 `taskcommon.whitelabelChannels` 注册；`ConvertToOpenAIVideo` 成功用 `originTask.GetResultURL()`（代理地址 `/v1/videos/{task_id}/content`），失败用 `taskcommon.ScrubBrandedText(originTask.FailReason)` 脱敏。
- **`ExtractUpstreamVideoURL` 是导出函数**：`controller.VideoProxy` 调用它从持久化的 `task.Data` 中解析出真实 MP4 地址，服务端下载后转发给客户端。
- **DEBUG 日志**：`debugLogDropped` 在 `common.DebugEnabled` 时打印被丢弃的官方 seedance 字段（`camera_fixed`/`frames`/`callback_url`），便于运维排查"为何我传的参数没生效"。

### Testing Requirements

- 已有完整单测：`adaptor_test.go`、`constants_test.go`、`request_test.go`、`request_seed_mapping_test.go`。
- `go test ./relay/channel/task/blockrunseedance/...` 必须通过。
- `go build ./...` 跑全量编译。
- 因涉及资金（x402 签名），任何改动都必须：新增覆盖映射纯函数 `buildBlockrunSeedanceCreateRequest` 与取值校验 `validateSeedanceValues` 的 case；手测一次 submit → poll → 下载全链路，验证金额上限与窗口上限未被触发。

### Common Patterns

- 修改模型清单：同时更新 `ModelList`（客户端可见名）+ `modelToUpstream`（双向 key）+ `supportsRealFaceAsset` / `supportsOmniReference` 中的 switch；测试在 `constants_test.go`。
- 修改金额上限：`constants.go` 的 `maxAmountAtomicUSDCVideo`；同步检查 chat 渠道（`relay/channel/blockrun/`）是否需要联动（通常 chat 用更短的 `maxAuthorizationWindowSeconds`）。
- 添加 BlockRun 私有扩展字段（非官方 seedance 字段）：扩 `blockrunExtensions` struct + `buildBlockrunSeedanceCreateRequest` 映射 + `validateSeedanceValues` 校验；客户端不传该字段时走纯官方 seedance 行为。

## Dependencies

### Internal

- `github.com/QuantumNous/new-api/common` — `Marshal` / `Unmarshal` / `MarshalNoHTMLEscape`、`DebugEnabled`、`SysLog`、`UnmarshalBodyReusable`
- `github.com/QuantumNous/new-api/constant` — `TaskActionGenerate`
- `github.com/QuantumNous/new-api/dto` — `SeedanceVideoRequest`、`SeedanceRoleFirstFrame`/`LastFrame`/`ReferenceImage`、`NewOpenAIVideo`、`OpenAIVideoError`、`TaskError`
- `github.com/QuantumNous/new-api/model` — `Task`、`TaskStatus*`
- `github.com/QuantumNous/new-api/relay/channel` — `DoTaskApiRequest`
- `blockrunchat "github.com/QuantumNous/new-api/relay/channel/blockrun"` — `SignX402PaymentWithCaps`（x402 签名工具，与 chat 渠道复用）
- `github.com/QuantumNous/new-api/relay/channel/task/taskcommon` — `BaseBilling`、`BindSeedanceRequest`、`ScrubBrandedText`、`ProgressQueued`/`InProgress`/`Complete`
- `relaycommon "github.com/QuantumNous/new-api/relay/common"` — `RelayInfo`、`TaskInfo`
- `github.com/QuantumNous/new-api/service` — `TaskErrorWrapper`、`TaskErrorWrapperLocal`、`GetHttpClientWithProxy`

### External

- `bytes`、`fmt`、`io`、`math/big`、`net/http`、`net/url`、`strings`、`time` — 标准库
- `github.com/gin-gonic/gin` — context
- `github.com/pkg/errors` — `errors.Wrap` / `Wrapf`

<!-- MANUAL: -->
