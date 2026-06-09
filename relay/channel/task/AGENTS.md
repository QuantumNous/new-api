<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-18 | Updated: 2026-06-08 -->

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
| `blockrunseedance/` | BlockRun x402-paid Seedance 视频（seedance 系）；x402 双程签名鉴权（无 API Key，钱包私钥存 channel Key）；上游 submit 返回 202，**DoRequest 内 `normalizeAcceptedStatus` 将其归一为 200**（202-gate 模式，见下方说明）；poll_url 作为上游 task_id 存储；结果走 `/v1/videos/{task_id}/content` 代理 |
| `blockrunvideo/` | BlockRun 代理视频（OpenAI-style video 格式，通过 BlockRun 中间层转发）；`adaptor.go` + `constants.go` + `request.go` |
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
- **Rule 5**：上游请求 DTO 的可选字段用指针 + `omitempty`，防止零值被静默丢弃（`CLAUDE.md` Rule 5）。
- **白标渠道**：`kuaizi`、`blockrunseedance` 等白标渠道的结果 URL 不得直接返回给客户端，必须经由代理，使用 `taskcommon.ShouldWhitelabelPlatform` 判断，`ScrubBrandedText` 脱敏错误信息。
- **计费预扣**：异步任务必须在提交前锁定全额（`info.ForcePreConsume = true`），因为请求返回后任务仍在运行。
- **任务 ID 隔离**：`info.PublicTaskID` 是暴露给客户端的 `task_xxxx` 格式 ID，不得将上游真实 ID 直接返回。
- **202-gate（HTTP 202 归一化）**：`relay/relay_task.go` 的通用编排器在 `DoRequest` 返回非 200 响应时直接拒绝（不会调用 `DoResponse`）。若上游 submit 返回 202 Accepted（如 `blockrunseedance`），**必须在 `DoRequest` 内部将其归一化为 200**（即 `resp.StatusCode = http.StatusOK`），以确保 `DoResponse` 能正常运行并存储 task_id/poll_url。归一化函数命名惯例：`normalizeAcceptedStatus(resp)`，在返回前调用。相同策略同样适用于 poll 阶段：若 `FetchTask` 返回的 202 不归一化，`ParseTaskResult` 将永远收不到数据。

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

## SOP：新增 seedance 系渠道适配器（供后续同事 / AI / 会话遵循）

> 适用场景：要对接一个**新的 seedance 模型渠道商**（上游同样是 seedance 2.0 系视频生成）。
> 目标形态：**new-api 对客户端统一暴露「官方 seedance `content[]` 格式」，每个渠道适配器在内部把它映射成自己上游所需的参数。** 客户端无需关心背后是哪家供应商。
> 参考实现：`relay/channel/task/kuaizi/`（第一个样板）。

### 第 0 步：先判断「要不要新增渠道类型」（别一上来就建类型）

格式分发是**按渠道类型（ChannelType → adaptor）**走的，不是按模型名。先分清两个概念：

- **渠道实例**（channel）：DB 里一条配置（base URL / key / 服务哪些 model）。管理员后台建，**无需代码**。
- **渠道类型**（`ChannelType` 常量 + 对应 adaptor）：决定上游协议与入参映射，**代码层**。

| 情况 | 判断 | 怎么做 |
|---|---|---|
| **A：新供应商有自己的上游 API**（endpoint/鉴权/上游 body 与现有不同）——绝大多数 | 需要新协议 | **新增渠道类型 + 写 adaptor**（走下面步骤）|
| **B：新供应商上游 API 与某个已有渠道类型完全一致**（少见） | 协议相同 | **不写代码**，后台新建一个该类型的渠道实例（换 base URL/key/模型名）即可 |

模型名相关（与命中格式无关，见正文末「与模型名的关系」）：
- 命中官方 `content[]` 格式靠的是 **adaptor 复用 `BindSeedanceRequest`**，各渠道模型名可随意。
- 若要一个模型名在多个渠道间**负载均衡/容灾**，把它配成**同名 model 挂多个渠道**——但参与的渠道必须**同属 seedance 系（adaptor 都吃 content[]）**；切勿把同名 model 同时挂到非 seedance 渠道（如 sora/kling），否则同一份 content[] 请求换渠道会解析失败。

下文均针对**情况 A**。

### 架构接缝（务必沿用，不要每个渠道各发明一套入参）

```
客户端（官方 content[] 格式，POST /v1/videos）
        │
        ▼
dto.SeedanceVideoRequest         ← 共享、provider-neutral 入参契约（dto/video_seedance.go）
  + taskcommon.BindSeedanceRequest ← 共享：解析 + 校验 + 合成 task_request + 设 Action
        │
        ▼
build<Channel>CreateRequest()    ← 【渠道私有】纯函数：seedance → 本渠道上游 body
        ▼
该渠道上游 wire 格式
```

### 职责划分

| 共享层（已写好，直接复用，**勿重复造**） | 每个新渠道私有（接入时只写这部分） |
|---|---|
| `dto.SeedanceVideoRequest` + `PromptText()/Images()/Videos()/Audios()/HasFirstLastFrame()/Validate()` | model → 上游档位/变体 的映射 |
| `taskcommon.BindSeedanceRequest(c, info, action)`：解析+校验+合成 `task_request`+设 `Action` | `build<Channel>CreateRequest()`：字段映射纯函数 |
| 出参 `usage`（轮询落 `task.PrivateData` → 两套查询自动带，见 `service/task_polling.go` + `relay/relay_task.go`） | 上游不支持字段的丢弃 + 取值域校验（如 `validateResolution`） |
| 白标（`taskcommon.whitelabelChannels` 注册 → 结果走代理 URL、错误 `ScrubBrandedText`） | 本渠道扩展字段（非官方，如 `web_search` / 超分），用独立 struct 从同一 reusable body 解析 |
| 任务 ID 隔离、计费三段式（`BaseBilling`） | `ConvertToOpenAIVideo`（成功用 `GetResultURL()` 代理地址，失败脱敏） |

### 步骤

1. **建目录** `relay/channel/task/<name>/`，`adaptor.go` 实现 `channel.TaskAdaptor`，嵌入 `taskcommon.BaseBilling`。
2. **ValidateRequestAndSetAction**：调用共享帮手，再做渠道私有取值校验。
   ```go
   func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
       seedReq, err := taskcommon.BindSeedanceRequest(c, info, constant.TaskActionGenerate)
       if err != nil {
           return service.TaskErrorWrapperLocal(err, "invalid_request", http.StatusBadRequest)
       }
       if err := validateResolution(seedReq.Resolution); err != nil { // 渠道私有
           return service.TaskErrorWrapperLocal(err, "invalid_request", http.StatusBadRequest)
       }
       return nil
   }
   ```
3. **BuildRequestBody**：从（reusable）body 解析「官方字段 + 本渠道扩展」，调私有映射函数。
   ```go
   var inbound struct {
       dto.SeedanceVideoRequest
       <channel>Extensions // 仅本渠道支持的非官方字段；纯官方客户端不传
   }
   common.UnmarshalBodyReusable(c, &inbound)
   mode, ok := ModelToMode(info.UpstreamModelName) // 或本渠道的 model 映射
   body := build<Channel>CreateRequest(&inbound.SeedanceVideoRequest, inbound.<channel>Extensions, mode)
   data, _ := common.MarshalNoHTMLEscape(body) // 保留 URL 里的 '&'，勿用会 HTML 转义的 Marshal
   ```
4. **映射纯函数** `build<Channel>CreateRequest(*dto.SeedanceVideoRequest, ext, mode) <channelBody>`：
   - text → 上游 prompt 字段；`Images()/Videos()/Audios()` 的 URL+role → 上游对应数组；
   - `input_type` 之类按 `HasFirstLastFrame()` 推断；
   - **上游不支持的官方字段直接不映射**（如 `camera_fixed/frames/callback_url/return_last_frame`），并在 `common.DebugEnabled` 下用 `droppedSeedanceFields`-式日志提示；
   - 抽成纯函数（无 gin/IO）方便单测。
5. **ParseTaskResult**：上游状态/usage → 统一 `relaycommon.TaskInfo`（状态归一为 `SUBMITTED/QUEUED/IN_PROGRESS/SUCCESS/FAILURE`；`CompletionTokens/TotalTokens` 填上即可，框架自动落库 + 两套查询回传）。
6. **ConvertToOpenAIVideo**：成功 `ov.SetMetadata("url", originTask.GetResultURL())`（白标代理地址，**绝不暴露上游真实地址**）；失败 `taskcommon.ScrubBrandedText`。
7. **注册**：`relay/relay_adaptor.go` 的 `GetTaskAdaptor`；`setting/ratio_setting` 加模型价格/倍率；白标渠道在 `taskcommon.whitelabelChannels`（和品牌词）注册；`constant/` 加 `ChannelType<Name>`。

### Rule / 注意

- **Rule 1**：JSON 全用 `common.*`（出站保留 `&` 用 `common.MarshalNoHTMLEscape`）。
- **Rule 5**：可选标量字段用指针 + `omitempty`（显式 `false/0` 也要发上游，不传则省略）。
- **白标**：结果 URL 只给 `/v1/videos/{task_id}/content` 代理；错误脱敏；不要在任何返回/文档里出现上游供应商名、上游 host、内部模型名。
- **fail fast**：上游不支持的取值（如某渠道 resolution 上限）在 `ValidateRequestAndSetAction` 阶段就报错，别等发到上游才失败。
- **两套查询**：`GET /v1/videos/{id}`（OpenAI 格式，原生带 `usage`，推荐）与 `GET /v1/video/generations/{id}`（私有格式，也已带 `usage`）。

### 验收 Checklist

- [ ] 客户端按官方 `content[]` 发 → 创建/轮询/下载三步打通
- [ ] `usage` 在两套查询都出现（成功任务）
- [ ] 上游不支持字段被丢弃且有 DEBUG 提示；不支持取值提前报错
- [ ] 白标：响应/日志无上游品牌、host、内部模型名
- [ ] 单测：映射纯函数 + Validate/取值校验 + ConvertToOpenAIVideo usage
- [ ] `go build ./...`、`go test ./relay/channel/task/... ./dto/...`、`go vet` 全绿

### 关键文件

| 文件 | 作用 |
|---|---|
| `dto/video_seedance.go` | 共享入参契约 `SeedanceVideoRequest` + 方法 |
| `dto/openai_video.go` | `OpenAIVideo` + `OpenAIVideoUsage`（出参 usage） |
| `relay/channel/task/taskcommon/seedance.go` | `BindSeedanceRequest` 共享入口 |
| `relay/channel/task/kuaizi/adaptor.go` | **参考实现**（映射、取值校验、丢弃日志、usage） |
| `service/task_polling.go` / `relay/relay_task.go` | usage 落库（`PrivateData`）+ 两套查询回传 |
| `docs/api/seedance-video-api.html` | 对客户（白标）API 文档模板 |
