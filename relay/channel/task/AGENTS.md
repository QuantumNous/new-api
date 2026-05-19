<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-18 | Updated: 2026-05-18 -->

# relay/channel/task

## Purpose

task 目录是所有**异步任务类 provider** 适配器的容器。与同步 `Adaptor`（chat/embedding/image 等）不同，异步任务 provider 实现 `TaskAdaptor` 接口，采用"提交 → 轮询"两阶段模型：

1. **提交阶段**：`BuildRequestURL` / `BuildRequestHeader` / `BuildRequestBody` → `DoRequest` → `DoResponse` 获取上游任务 ID。
2. **轮询阶段**：`FetchTask` 按上游任务 ID 查询状态，`ParseTaskResult` 解析返回的状态结构为统一 `TaskInfo`。
3. **计费三段式**：`EstimateBilling`（提交前预估）→ `AdjustBillingOnSubmit`（提交后调整）→ `AdjustBillingOnComplete`（任务完成后结算）。

典型用途：AI 视频生成、AI 音乐生成、AI 图像（异步大图）生成。

## Key Files

| File | Description |
|------|-------------|
| `taskcommon/helpers.go` | 跨 provider 共享的辅助函数：白标渠道检测（`ShouldWhitelabelPlatform`）、品牌词脱敏（`ScrubBrandedText`）、公开任务 ID 生成等 |
| `taskcommon/helpers_test.go` | taskcommon 单元测试 |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `ali/` | 阿里云异步任务（通义视频等），`adaptor.go` + `constants.go` |
| `doubao/` | 豆包视频（火山引擎），对应 `ChannelTypeDoubaoVideo` / `ChannelTypeVolcEngine` |
| `gemini/` | Google Gemini 异步任务（Veo 视频生成等） |
| `hailuo/` | 海螺 / MiniMax 视频，`adaptor.go` + `constants.go` + `models.go` |
| `jimeng/` | 即梦视频异步任务，`adaptor.go` + `constants.go`（注意：即梦图像同步接口在 `relay/channel/jimeng/`） |
| `kling/` | 可灵视频（快手），`adaptor.go`，使用 JWT 鉴权 |
| `kuaizi/` | 筷子立臻（白标渠道），`adaptor.go`，结果 URL 经代理返回，不暴露上游地址 |
| `sora/` | OpenAI Sora 视频，`adaptor.go` |
| `suno/` | Suno AI 音乐生成，`adaptor.go` + `models.go`，轮询采用专用批量拉取路径而非通用 `ParseTaskResult` |
| `vertex/` | Google Vertex AI 异步任务（Veo 等） |
| `vidu/` | Vidu 视频生成，`adaptor.go` |
| `taskcommon/` | 跨 provider 共享工具（白标、品牌脱敏等），`helpers.go` + `helpers_test.go` |

## For AI Agents

### 同步 Adaptor 与异步 TaskAdaptor 的关键差异

| 维度 | `Adaptor`（同步） | `TaskAdaptor`（异步） |
|------|-------------------|----------------------|
| 接口定义 | `channel/adapter.go: Adaptor` | `channel/adapter.go: TaskAdaptor` |
| 请求格式 | `Convert*Request` → 返回 `any` body | `BuildRequestBody` → 返回 `io.Reader` |
| 响应处理 | `DoResponse` 写回客户端 | `DoResponse` 返回 `(taskID, taskData, err)` |
| 计费 | `ModelPriceHelper` 单次结算 | 三段式：`EstimateBilling` → `AdjustBillingOnSubmit` → `AdjustBillingOnComplete` |
| 轮询 | 无 | `FetchTask` + `ParseTaskResult` |
| 注册入口 | `relay_adaptor.go: GetAdaptor` | `relay_adaptor.go: GetTaskAdaptor` |

### Working In This Directory

- **Rule 1**：所有 JSON 操作必须通过 `common.Marshal` / `common.Unmarshal`（`CLAUDE.md` Rule 1）。
- **Rule 6**：上游请求 DTO 的可选字段用指针 + `omitempty`，防止零值被静默丢弃（`CLAUDE.md` Rule 6）。
- **白标渠道**：`kuaizi` 等白标渠道的结果 URL 不得直接返回给客户端，必须经由代理，使用 `taskcommon.ShouldWhitelabelPlatform` 判断，`ScrubBrandedText` 脱敏错误信息。
- **计费预扣**：异步任务必须在提交前锁定全额（`info.ForcePreConsume = true`），因为请求返回后任务仍在运行。
- **任务 ID 隔离**：`info.PublicTaskID` 是暴露给客户端的 `task_xxxx` 格式 ID，不得将上游真实 ID 直接返回。

### 添加新异步任务 Provider 的步骤

1. 在 `relay/channel/task/<name>/` 新建 `adaptor.go`，实现 `TaskAdaptor` 接口全部方法。
2. 在 `constant/` 包添加 `ChannelType<Name>` 常量。
3. 在 `relay/relay_adaptor.go` 的 `GetTaskAdaptor` switch 中注册。
4. 在 `setting/ratio_setting/` 中为模型添加默认价格/倍率。
5. 若为白标渠道，在 `taskcommon/helpers.go` 的 `whitelabelChannels` map 中注册，并在 `brandKeywords` 中添加品牌词。

### Testing Requirements

- 运行 `go test ./relay/channel/task/...` 跑现有测试。
- 新增 provider 后运行 `go build ./...` 确认全量编译通过。
- 建议手动提交一个任务并验证任务 ID 格式、轮询状态转换（`PROCESSING` → `SUCCESS` / `FAILURE`）。

### Common Patterns

- **`BaseBilling` 嵌入**：大多数 TaskAdaptor 嵌入 `taskcommon.BaseBilling` 获得默认的计费三段式实现，仅覆盖需要自定义的方法。
- **`ValidateRequestAndSetAction`**：解析客户端请求，设置 `info.Action`，并将解析后的请求对象存入 gin context（供 `BuildRequestBody` 读取）。
- **`ParseTaskResult`**：接收上游轮询响应的原始字节，返回统一 `relaycommon.TaskInfo`（含 `Status`、`TaskID`、`Url` 等字段），状态值统一为 `SUCCESS` / `FAILURE` / `PROCESSING`。
- **Suno 特例**：Suno 使用批量拉取路径（`service.UpdateSunoTasks`），`ParseTaskResult` 方法不适用，直接返回错误。
- **Kling JWT 鉴权**：Kling 在 `BuildRequestHeader` 中动态生成 JWT token，而非直接透传 API Key。

## Dependencies

### Internal

- `relay/common/` — `RelayInfo`、`TaskInfo`、`TaskSubmitReq`
- `relay/channel/task/taskcommon/` — 白标、品牌脱敏等共享工具
- `dto/` — `TaskError`、各 provider 的请求/响应 DTO
- `model/` — `Task` 数据库模型
- `constant/` — `ChannelType*`、`TaskPlatform`、`TaskAction*`
- `service/` — `TaskErrorWrapper`、`TaskErrorWrapperLocal`

### External

- `net/http` — HTTP 客户端
- `github.com/gin-gonic/gin` — gin context
- `github.com/golang-jwt/jwt/v5` — Kling JWT 鉴权

<!-- MANUAL: 手动补充内容写在此分隔线下方，重新生成时保留 -->
