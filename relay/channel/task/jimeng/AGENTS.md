<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-02 | Updated: 2026-07-02 -->

# relay/channel/task/jimeng

## Purpose

火山引擎即梦视频异步任务适配器（注意：即梦**图像同步**接口在 `relay/channel/jimeng/`，与本目录独立）。上游为火山引擎 CV API（`/?Action=CVSync2AsyncSubmitTask&Version=2022-08-31` 创建、`/?Action=CVSync2AsyncGetResult&Version=2022-08-31` 轮询，均 POST）。入站使用 new-api 通用 `TaskSubmitReq`（`relaycommon.ValidateBasicTaskRequest` 解析），支持 multipart 上传多图（首尾帧生成）。

**双鉴权模式**：channel Key 格式 `access_key|secret_key` 时走火山引擎 V4 风格 HMAC-SHA256 签名（`signRequest`，region=`cn-north-1`，service=`cv`）；channel Key 以 `sk-` 开头时走 new-api 中转模式（`Authorization: Bearer <key>` + URL 加 `/jimeng/` 前缀，由上游 new-api 实例转发到真正的火山 API）。**ReqKey 动态映射**：jimeng_v30 系列会根据入参图像数量自动改写 ReqKey（`jimeng_t2v_v30` / `jimeng_i2v_first_v30` / `jimeng_i2v_first_tail_v30` / `jimeng_ti2v_v30_pro`），实现文生/图生/首尾帧/3.0-pro 的路由。**非白标渠道**：成功任务的 `data.video_url` 直接返回，不经代理。

## Key Files

| File | Description |
|------|-------------|
| `adaptor.go` | 唯一实现文件。嵌入 `taskcommon.BaseBilling`。定义 `requestPayload`（含 `req_key`/`binary_data_base64`/`image_urls`/`prompt`/`seed`/`aspect_ratio`/`frames`）、`responsePayload`/`responseTask`、`MaxFileSize = 4.7MB` 上传上限、`TaskAdaptor` 与全部接口方法。含 `signRequest`（火山 V4 HMAC-SHA256 完整签名实现）、`hmacSHA256`、`convertToRequestPayload`（含 jimeng_v30 ReqKey 动态改写逻辑）、`isNewAPIRelay`（按 `sk-` 前缀判断鉴权模式） |

## For AI Agents

### Working In This Directory

- **嵌入 `taskcommon.BaseBilling`**：获得默认三段式计费；本渠道无需自定义 `EstimateBilling`。
- **入站是 `TaskSubmitReq`，非 seedance `content[]`**：调用 `relaycommon.ValidateBasicTaskRequest`。`BuildRequestBody` 额外处理 multipart `input_reference` 多文件上传：单文件 → `TaskActionGenerate`，多文件 → `TaskActionFirstTailGenerate`（首尾帧）。文件转 base64 塞进 `req.Images`。
- **双鉴权模式判断**：`isNewAPIRelay(apiKey)` 按前缀 `sk-` 判断。注意 `FetchTask` 收到的 key 来自框架（与 `Init` 时的 `info.ApiKey` 是同一个），判断逻辑一致。
  - **直连火山（`ak|sk` 格式）**：URL 不加 `/jimeng/` 前缀；调 `signRequest` 签名（HMAC-SHA256 V4 风格）。
  - **new-api 中转（`sk-` 前缀）**：URL 加 `/jimeng/` 前缀（路径交给上游 new-api 实例转发）；用 `Authorization: Bearer <key>`，不签名。
- **签名实现 `signRequest`**：火山 V4 风格，要点：
  - region=`cn-north-1`、service=`cv`、credentialScope=`<shortDate>/cn-north-1/cv/request`；
  - 参与 canonical request 的 header：`host`/`x-date`/`x-content-sha256`（+ `content-type` 若存在）；
  - 派生 key 链：`kDate = HMAC(secretKey, shortDate)` → `kRegion = HMAC(kDate, region)` → `kService = HMAC(kRegion, "cv")` → `kSigning = HMAC(kService, "request")`；
  - body 读取后需 rewind（`req.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))`），因为签名已消费了 body。
- **ReqKey 动态改写（`convertToRequestPayload`）**：
  - 默认 ReqKey 来自 `info.UpstreamModelName`；
  - duration 决定 `frames`：10 秒 → 241 帧（24×10+1），其它 → 121 帧（24×5+1）；
  - 图像按前缀分流：`http` 开头走 `image_urls`，否则当 base64 走 `binary_data_base64`；
  - `req.Metadata` 通过 `taskcommon.UnmarshalMetadata` 覆盖式合并到 `requestPayload`；
  - **jimeng_v30 系列自动改写**：根据图像数量（`max(req.Images, binary_data_base64, image_urls)`）路由到 `jimeng_t2v_v30`/`jimeng_i2v_first_v30`/`jimeng_i2v_first_tail_v30`；`jimeng_v30_pro` 强制改成 `jimeng_ti2v_v30_pro`（无视图像数量）。改写规则参考火山官方文档（代码注释里有链接）。
- **`DoResponse` 校验 `code == 10000`**：火山成功码是 10000，其它视为失败（HTTP 500 + code 字符串）。
- **`FetchTask` 用 POST**（与多数渠道的 GET 不同）：URL `?Action=CVSync2AsyncGetResult&Version=2022-08-31`，body 含 `req_key="jimeng_vgfm_t2v_l20"`（**写死**，来自火山文档）+ `task_id`；同样按双鉴权模式签名或加 Bearer。
- **状态映射 `ParseTaskResult`**：`code != 10000` → Failure；`data.status == "in_queue"` → Queued（10%）；`data.status == "done"` → Success（100%，填 `data.video_url`）。注意 Success 状态没有显式 InProgress 分支——进行中状态依赖 `data.status` 的其它值（默认 `TaskInfo.Status` 为零值，由框架兜底处理）。
- **非白标**：不在 `taskcommon.whitelabelChannels` 注册；`ConvertToOpenAIVideo` 直接把 `jimengResp.Data.VideoUrl` 写到 `metadata.url`，**不**调 `task.GetResultURL()` 代理，错误信息**不**经 `ScrubBrandedText`。
- **Rule 1**：JSON 走 `common.Marshal` / `common.Unmarshal`。
- **无 202-gate 需求**：火山返回 200 + code。
- **文件大小限制**：`MaxFileSize = 4*1024*1024 + 700*1024`（4.7MB），来自火山官方限制；超过会在 `BuildRequestBody` 阶段返回错误。

### Testing Requirements

- 目录无 `_test.go` 文件。
- `go build ./relay/channel/task/jimeng/...` 必须通过。
- `go test ./relay/channel/task/...` 不会覆盖本目录。
- 修改 `signRequest` 时务必补单测（V4 签名细节多，火山文档有示例签名可对照）。
- 修改 jimeng_v30 ReqKey 改写逻辑时补覆盖矩阵测试（0/1/2 张图 × pro/普通）。
- 建议手测：双鉴权模式各跑一次（直连火山 + new-api 中转），验证签名/路由正确。

### Common Patterns

- `signRequest` 是完整的 V4 风格签名实现，修改时参考 AWS SigV4 / 火山文档；不要用 `encoding/json` 直接 marshal canonical request（必须是手工拼字符串，按固定字段顺序）。
- 添加新即梦模型：若新模型沿用 `jimeng_vgfm_t2v_l20` 查询 req_key 则无需改 `FetchTask`；若新 req_key 需按模型路由，需把写死的常量改成 `info.UpstreamModelName` 查表。
- `GetModelList` 当前硬编码 `["jimeng_vgfm_t2v_l20"]`，与 `constants.go` 风格不同（本目录无独立 constants 文件）；新增模型直接改这里。
- 即梦图像同步接口在 `relay/channel/jimeng/`（非 task 子目录），与本视频异步适配器是两个独立 adaptor，不要混淆。

## Dependencies

### Internal

- `github.com/QuantumNous/new-api/common` — `Marshal` / `Unmarshal`
- `github.com/QuantumNous/new-api/constant` — `TaskActionGenerate`、`TaskActionFirstTailGenerate`
- `github.com/QuantumNous/new-api/dto` — `NewOpenAIVideo`、`OpenAIVideoError`、`TaskError`
- `github.com/QuantumNous/new-api/model` — `Task`、`TaskStatus*`
- `github.com/QuantumNous/new-api/relay/channel` — `DoTaskApiRequest`
- `taskcommon "github.com/QuantumNous/new-api/relay/channel/task/taskcommon"` — `BaseBilling`、`UnmarshalMetadata`
- `relaycommon "github.com/QuantumNous/new-api/relay/common"` — `RelayInfo`、`TaskSubmitReq`、`TaskInfo`、`ValidateBasicTaskRequest`
- `github.com/QuantumNous/new-api/service` — `TaskErrorWrapper`、`GetHttpClientWithProxy`

### External

- `bytes`、`crypto/hmac`、`crypto/sha256`、`encoding/base64`、`encoding/hex`、`fmt`、`io`、`net/http`、`net/url`、`sort`、`strings`、`time` — 标准库
- `github.com/gin-gonic/gin` — context
- `github.com/pkg/errors` — `errors.Wrap` / `Wrapf`
- `github.com/samber/lo` — `lo.Max`（计算图像数量）

<!-- MANUAL: -->
