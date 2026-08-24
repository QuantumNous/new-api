# MiniMax H3 V2 隔离接入方案

> 状态：研究方案，不包含产品代码实现
> 基线：本地 `main`，`65f4e4c53901c8a39534eb8322750b963f371d9d`
> Worktree：`/Users/jjcc/develop_project/shulex/new-api/.worktrees/minimax-h3-plan`
> 分支：`codex/minimax-h3-plan`
> 上游参考：[QuantumNous/new-api#6591](https://github.com/QuantumNous/new-api/pull/6591)

## 结论

采用“**独立渠道类型 + 独立 H3 V2 TaskAdaptor**”方案：新增下游渠道类型 `ChannelTypeMiniMaxH3 = 110`，新增 `relay/channel/task/hailuo_v2/`，让任务从提交开始就以平台 `110` 持久化。不要把 `MiniMax-H3` 直接塞进现有 `ChannelTypeMiniMax = 35`，也不要修改现有 `hailuo` V1 适配器。

该方案的目标不是最少新增文件，而是最小化共享行为变化：

- 不修改 `relay.RelayTaskSubmit` 的平台选择顺序。
- 不修改 `controller.RelayTask` 的提交、结算和任务落库流程。
- 不修改 `service.TaskPollingAdaptor`、`settleTaskBillingOnComplete` 或共享 billing contract。
- 不修改 `model.Task` 结构，不增加数据库迁移。
- 不改变现有 MiniMax V1、Sora、Doubao、Gemini、Ali 等异步任务的 platform/adaptor 选择。
- H3 的协议、校验、状态映射和按秒计费全部收敛在 H3 适配器内部。

唯一必须触碰的高扇出符号是 `relay.GetTaskAdaptor`：GitNexus 报告其为 **CRITICAL**（10 个上游影响点、7 个直接调用者）。实施时只允许添加一个互斥 `case`，不得重排或改写现有分支，并用注册回归测试锁定 `35 -> hailuo V1` 和 `110 -> hailuo V2`。

## 证据与现状

### MiniMax 官方 H3 V2 契约

官方资料（国际站为本方案实现目标，中国站用于交叉核对协议差异）：

- [国际站：创建视频生成任务](https://platform.minimax.io/docs/api-reference/video-generation-v2-create)
- [国际站：查询任务](https://platform.minimax.io/docs/api-reference/video-generation-v2-query)
- [国际站：按量计费](https://platform.minimax.io/docs/guides/pricing-paygo)
- [用户提供的中国站创建文档](https://platform.minimaxi.com/docs/api-reference/video-generation-v2-create)

截至 2026-08-05，本方案明确以实际凭证验证通过的**国际站**契约为准：文档域名
`platform.minimax.io`、API 域名 `api.minimax.io`、美元账户计费。中国站
`platform.minimaxi.com` / `api.minimaxi.com` 使用人民币价格（768P ¥0.50/s、2K
¥0.80/s、额外图片 ¥0.20/张），属于另一结算区域；实现、默认 Base URL 和默认价格
不得跨区域混用。

国际站 H3 使用：

- `POST https://api.minimax.io/v2/video_generation`
- `GET https://api.minimax.io/v2/query/video_generation/{task_id}`
- `Authorization: Bearer <API key>`
- 模型名：`MiniMax-H3`
- 创建入参：必填 `model`、`content[]`、`resolution`、`duration`
- 分辨率：`768P`、`2K`
- 时长：整数 `4..15`
- 状态：`queued`、`running`、`succeeded`、`failed`、`cancelled`
- 成功结果：`task.content.url`；链接有时效，任务仅可查询最近 7 天
- 输出价格：768P 为 $0.08/秒，2K 为 $0.13/秒
- 输入视频：按输入秒数及输出分辨率同价计费
- 输入图片：前 5 张免费，超出部分 $0.04/张；音频免费

2026-08-05 对用户提供凭证做了无密钥落盘的区域探测：中国站查询接口返回 401
`invalid api key`；国际站查询不存在任务返回业务层 `record not found`，证明鉴权通过。余额补充后，
国际站 768P/2K text-only、768P first-frame、768P reference video + audio、768P 六张
reference image 五类请求均实测完成，状态为 `queued -> running -> succeeded` 且返回非空临时 URL。
reference video 用例的 6 秒输入与 4 秒输出得到 `total_seconds: 10`；reference audio 未产生独立
计费用量。六图用例得到 `total_seconds: 4`、`input_image_count: 6`。这验证了完成结算所依赖的
usage 语义和临时 URL 契约；实际金额尚未与账户账单对账，单价仍以官方价格表为依据。

### 本地现有 MiniMax V1

现有 `ChannelTypeMiniMax = 35` 在 [`constant/channel.go`](../../../constant/channel.go) 中默认指向 `https://api.minimax.chat`。异步任务工厂在 [`relay/relay_adaptor.go`](../../../relay/relay_adaptor.go) 中将平台 35 固定映射到 `hailuo.TaskAdaptor`。

V1 适配器位于 [`relay/channel/task/hailuo/adaptor.go`](../../../relay/channel/task/hailuo/adaptor.go)：

- 创建路径 `/v1/video_generation`
- 入站 `TaskSubmitReq`，上游字段是 `prompt`、`first_frame_image` 等
- 查询路径 `/v1/query/video_generation?task_id=...`
- 状态是 `Preparing/Queueing/Processing/Success/Fail`
- 成功后还要根据 `file_id` 调 `/v1/files/retrieve`

V1 与 H3 V2 在请求、查询和结果三处均为不同协议，不能靠新增模型名兼容。

### 当前任务框架已经提供的隔离接缝

- [`relay/relay_task.go`](../../../relay/relay_task.go) 的 `RelayTaskSubmit` 先按渠道类型取得 platform/adaptor，再完成模型映射、预扣、提交与结果解析。
- 同文件已有私有接口 `taskRequestValidatorAfterModelMapping`；H3 适配器可利用它在模型映射完成后校验最终上游模型，不需要改提交编排。
- [`model/task.go`](../../../model/task.go) 的 `Task.Platform` 已落库并建索引；`InitTask` 会保存提交结果中的 platform。
- [`service/task_polling.go`](../../../service/task_polling.go) 按持久化 platform 分组轮询，再通过 `GetTaskAdaptorFunc(platform)` 恢复适配器。多节点同时推进终态时使用 `UpdateWithStatus` CAS，只有胜者执行结算或退款。
- 同文件已有私有可选接口 `perCallTaskBillingAdjuster`。按次模型只要实现 `AdjustPerCallBillingOnComplete`，即可完成实际用量差额结算，不需要引入上游 PR 的 `CompletionBillingAdaptor` 或 `AdjustBillingOnCompleteChecked` 共享接口。
- [`relay/channel/task/taskcommon/helpers.go`](../../../relay/channel/task/taskcommon/helpers.go) 的 `BaseBilling` 已提供三段式计费 no-op 默认实现。

## 上游 PR #6591 评估

PR 当前为 `OPEN`、`REVIEW_REQUIRED`、`mergeStateStatus=BLOCKED`，尚未进入上游 `main`。可以复用其 H3 DTO、V2 URL、状态映射、公开 task ID 隔离和基础测试思路，但不应原样 cherry-pick。

需要修正或删除的部分：

1. **删除共享任务路由改造。** PR 复用 `ChannelTypeMiniMax`，因此新增 `TaskPlatformMiniMaxV2`、`GetTaskPlatformForModel`，并重排 `RelayTaskSubmit` 的模型映射/平台选择。它还触发了 action-only 提交路径的审查风险。独立渠道类型不需要这些修改。
2. **删除共享 billing contract 改造。** PR 新增 `CompletionBillingAdaptor`、checked adjustment 和 controller/service 改动。本地 `main` 已有 `AdjustPerCallBillingOnComplete` 接缝，能够只在 H3 adaptor 内实现。
3. **补齐 768P。** PR 的 `validateVideoRequest` 只接受 `2K`，与当前官方 `768P | 2K` 契约冲突。
4. **补齐国际站价格档位。** PR 的 `0.13 USD/s` 只覆盖国际站 2K，缺少 768P。应以国际站 768P `$0.08/s` 为可配置 base price，并在适配器中应用 `0.13 / 0.08 = 1.625` 的 2K 倍率。若未来支持中国站，应新增显式区域配置/渠道类型与独立价格，不能根据汇率暗中切换上游结算区域。
5. **保留 callback 拒绝策略。** 直接把客户端 `callback_url` 传给 MiniMax 会让上游回调携带真实 task ID，绕过 new-api 的公开 ID 隔离。第一版明确返回 `unsupported_callback_url`；后续若支持，必须由网关托管回调并重写 ID。
6. **不要依赖跨仓库三方合并。** 本地 `main` 与上游 PR 基线差异很大；只移植经过验证的适配器逻辑和测试用例，不 cherry-pick 两个 PR commit。

## 架构边界

### 方案比较

| 方案 | 优点 | 主要问题 | 决策 |
| --- | --- | --- | --- |
| 复用 `ChannelTypeMiniMax=35`，按模型选择 V1/V2 platform | 一个渠道可共用 Key；与上游 PR 一致 | 必须改共享提交编排；轮询必须持久化新字符串平台；一个渠道混放两套协议；模型映射和 action-only 路径复杂 | 不采用 |
| 在现有 `hailuo.TaskAdaptor` 内按模型分支 | 文件少 | polling 时工厂只有 platform，没有逐任务模型；V1/V2 URL、状态、结果完全不同；容易破坏旧模型 | 不采用 |
| 新增 `ChannelTypeMiniMaxH3=110` 和专用 adaptor | platform 天然持久化；提交/重启/多节点轮询均确定；不改其他渠道；可独立启停和回滚 | 管理端需要新增一个渠道选项；同一 Key 如同时跑 V1/V2 需建两条渠道记录 | **采用** |

### 选定调用链

```text
POST /v1/videos, model=MiniMax-H3
  -> middleware 按 ability 选择 ChannelTypeMiniMaxH3(110)
  -> GetTaskPlatform() 得到 "110"
  -> GetTaskAdaptor("110") 得到 hailuo_v2.TaskAdaptor
  -> 模型映射（支持客户端别名 -> MiniMax-H3）
  -> H3 私有校验、预扣、POST /v2/video_generation
  -> Task.Platform="110" + 上游 task_id 落库
  -> 任一节点按 Platform="110" 分组轮询
  -> GET /v2/query/video_generation/{task_id}
  -> CAS 赢得终态更新的节点执行差额结算/退款
```

隔离约束：

- `ChannelTypeMiniMax` 继续只走 `hailuo` V1。
- H3 渠道只允许映射后的上游模型为 `MiniMax-H3`。
- 不向 `taskcommon` 添加 H3 逻辑；H3 不是 Seedance 渠道，使用独立 DTO，避免扩大共享验证语义。
- 不把 H3 注册成白标渠道。结果可按现有 MiniMax 行为返回上游临时 URL，但错误响应不得泄漏 API Key、请求头或内部 task 数据。
- 第一版不支持 H3-Context-IR、视频再生成、列表和删除任务；这些使用独立模型/动作，不能隐式落入生成适配器。

### 请求与响应模型

在 `relay/channel/task/hailuo_v2/models.go` 定义 H3 私有 wire DTO：

- `VideoRequest`：`model`、`content`、`resolution`、`duration`、可选 `ratio`、`callback_url`、`aigc_watermark`
- `ContentItem`：`type`，以及互斥的 `text/image_url/video_url/audio_url` 和 `role`
- `CreateResponse`：`task_id`
- `QueryResponse`：嵌套 `task`；`usage`、`usage.total_seconds`、`usage.input_image_count` 使用指针字段，以区分缺失和显式零值
- `VideoTask`：`status/content/error/usage/resolution/duration/ratio`
- 所有可选标量使用指针 + `omitempty`；尤其 `aigc_watermark=false` 必须能显式透传

不复用 `dto.SeedanceVideoRequest`：它的最小验证允许没有文本、字段名使用 `watermark`，而 H3 要求每次都有非空文本且字段名为 `aigc_watermark`。强行复用会让两个供应商的协议语义耦合。

### 模型映射与校验时序

H3 adaptor 实现当前已有的 `ValidateRequestAfterModelMapping`：

1. 等 `helper.ModelMappedHelper` 完成。
2. 要求 `info.UpstreamModelName == "MiniMax-H3"`，否则本地返回 `unsupported_model`。
3. 解析 reusable body，把上游 `model` 强制改成映射结果，禁止客户端 body 或扩展字段覆盖计费模型。
4. 设置 `info.Action = TaskActionGenerate` 并保存 H3 request 到 context。

同时保留 `ValidateRequestAndSetAction`，直接委托相同私有验证函数，满足 `TaskAdaptor` 接口和单测调用；正常 `/v1/videos` 路径由 after-mapping 方法执行一次。

H3 私有校验至少覆盖：

- `duration` 4..15，并同时服从项目全局任务时长上限。
- `resolution` 只能为 `768P` 或 `2K`。
- 必须包含一个非空 text；文本不超过 7000 字符。
- text-only 必须明确提供非 `adaptive` ratio。
- first/last frame 与 reference_* 互斥。
- first frame、last frame 各最多 1；参考图最多 9；参考视频/音频各最多 3。
- reference audio 不能单独存在。
- `callback_url` 第一版拒绝。
- 媒体真实格式、尺寸、时长和远程 URL 可达性继续由上游校验；本地只做结构、数量和总请求大小限制。

### 轮询、结果和多节点

`FetchTask` 使用 path 参数并通过 `url.PathEscape(taskID)` 构建 URL；鉴权保持 Bearer。`ParseTaskResult` 映射：

- `queued -> QUEUED`
- `running -> IN_PROGRESS`
- `succeeded -> SUCCESS`，但必须同时满足 `task.content.url` 非空、`usage` 存在、`usage.total_seconds` 存在且大于 0、`usage.input_image_count` 存在且不小于 0、`task.resolution` 为 `768P | 2K`；否则返回协议解析错误，保持任务非终态并在后续轮询重试，不能让缺失字段解码成零值绕过门禁，不能让共享层用代理 URL 掩盖空结果，也不能按最大预留额静默结算
- `failed/cancelled -> FAILURE`，失败原因取 `task.error`
- 未知状态返回解析错误，保留任务等待下一轮，不臆造终态

H3 平台值随任务落库，所以进程重启和不同节点无需重新猜测协议。共享 CAS 继续保证同一任务只结算一次。不得使用进程内 map、锁或“某节点先提交”的顺序保证正确性。

H3 URL 有时效。第一版维持现有任务框架行为：成功轮询时保存当时 URL，并在 API 文档中要求客户端及时下载。自动刷新过期 URL 是独立需求，不和首次接入捆绑。

轮询错误按可恢复性分类：网络错误、5xx、429 和成功 envelope 中缺失 URL/usage 的协议错误保持原状态并重试、告警；明确的 400/401/403/404、上游 `failed/cancelled` 转为失败终态并走共享退款。协议错误超过运维告警阈值后人工核对，不能为了结束轮询而自动接受不完整的成功响应。

### 计费边界

`MiniMax-H3` 在 `defaultModelPrice` 中使用国际站 **768P 单秒美元价 `$0.08`**作为 base price。运营覆盖该值时，其语义保持为“768P 每秒价格”。H3 adaptor 负责把请求转换为 billable units：

- 768P 秒价倍率：1.0
- 2K 秒价倍率：`0.13 / 0.08 = 1.625`
- 输出预留秒数：请求 `duration`
- 有 reference_video 时，输入总时长无法在本地可信取得，提交阶段额外预留官方最大总输入时长 15 秒
- 超过 5 张的图片按 `$0.04` 每张加入估算成本
- 音频不收费

`EstimateBilling` 通过 `TaskBillingContext.OtherRatios` 持久化三个值：参与额度乘法的 `billable_units = estimatedUSD / info.PriceData.ModelPrice`，以及值固定为 `1.0`、不改变乘积的 `h3_region_intl` 和二选一 `h3_resolution_768p | h3_resolution_2k` 标记。完成结算只接受完整且互斥的 region/resolution 标记，从而不读取已被轮询响应覆盖的提交 `task.Data`，也不依赖可能在任务运行期间被修改的渠道 Base URL。

完成时由一个 H3 私有函数读取已经写入 `task.Data` 的查询响应，以 `usage.total_seconds`、`usage.input_image_count` 和响应 `resolution` 计算 actual billable units，并要求响应分辨率与 `OtherRatios` 中的提交标记一致；再按 `task.Quota * actualUnits / reservedUnits` 得出实际 quota。`AdjustBillingOnComplete` 和现有可选接口 `AdjustPerCallBillingOnComplete` 都委托该私有函数，其中本模型实际通过 per-call 分支结算。这样复用提交时已经冻结的 group ratio、订阅权重和运营覆盖价格，不需要改共享结算代码。

安全规则分两层：`ParseTaskResult` 在成功状态缺失/非法 usage、URL 或 resolution 时直接返回错误，不进入终态结算；结算函数若遇到持久化预留快照缺失、NaN/Inf、分辨率不一致或计算溢出，也返回 0 并发出高优先级告警，保持预扣额度等待人工对账。失败任务仍走共享全额退款。测试必须证明 768P/2K、reference video、5/6 张图片、缺失 usage/URL、分辨率不一致和计算溢出路径。

## 实施步骤

### 1. 渠道身份与管理端

1. 在 `constant/channel.go` 新增 `ChannelTypeMiniMaxH3 = 110`、默认 Base URL `https://api.minimax.io` 和名称 `MiniMaxH3`；保留 59..99 给上游，避免未来同步冲突。
2. 新增常量测试，锁定 ID、Base URL 和名称。
3. 在 `web/default/src/features/channels/constants.ts` 加入 110、显示顺序；在 `channel-utils.ts` 复用 MiniMax 图标。
4. 如果 label 通过 `t()` 展示，把品牌键 `MiniMax H3` 同步加入全部 8 个 locale，并运行 `bun run i18n:sync`。品牌名允许各语言保持一致。
5. 第一版不把 110 映射到同步 `APITypeMiniMax`，避免 H3 视频渠道错误暴露 MiniMax chat/image 模型和同步 channel test。管理员为该渠道配置唯一模型 `MiniMax-H3`；后续若需要专用异步渠道测试，应新增 task test 流程，而不是复用同步 adaptor。
6. 在 `common/endpoint_type.go` 把 110 精确映射为 `EndpointTypeOpenAIVideo`，并更新 `common/endpoint_type_test.go`；这只影响新类型，避免其被默认识别成 chat endpoint。

### 2. H3 V2 适配器

新增：

- `relay/channel/task/hailuo_v2/AGENTS.md`
- `relay/channel/task/hailuo_v2/models.go`
- `relay/channel/task/hailuo_v2/adaptor.go`
- `relay/channel/task/hailuo_v2/adaptor_test.go`

适配器嵌入 `taskcommon.BaseBilling`，只覆盖 H3 需要的方法和按次完成结算方法。`normalizeBaseURL` 只负责去除尾斜杠；空值走常量默认 URL，不把旧 `api.minimax.chat` 静默改写为新域名，配置错误应显式暴露。

适配器必须实现 `channel.OpenAIVideoConverter.ConvertToOpenAIVideo`，否则 `GET /v1/videos/{id}` 会返回 501。转换只使用 `originTask.TaskID`、统一状态、进度、模型名和 `originTask.GetResultURL()`；不得序列化 `PrivateData.UpstreamTaskID`。失败时输出标准 `OpenAIVideoError`，成功时输出临时 URL；usage 继续由通用 fetch 路径从 `PrivateData` 注入，避免重复来源。

### 3. 工厂注册

在 `relay/relay_adaptor.go` 的数字 channel switch 中增加：

```go
case constant.ChannelTypeMiniMaxH3:
    return &hailuov2.TaskAdaptor{}
```

不修改 `GetTaskPlatform`、`RelayTaskSubmit` 或其他 case。更新 `relay/relay_adaptor_test.go`：

- `110` 返回 `hailuov2.TaskAdaptor`
- `35` 仍返回 `hailuo.TaskAdaptor`
- 一个已有非 MiniMax 视频类型仍返回原 adaptor，防止误改 switch

### 4. 默认计费

在 `setting/ratio_setting/model_ratio.go` 的 `defaultModelPrice` 添加 `MiniMax-H3` 的国际站 768P 单秒 base price `$0.08`，并写清 2K 由 adaptor 应用 1.625 倍率。不要加入 `TaskPricePatches`，不要修改共享结算优先级。

### 5. 文档与运行配置

- 在 `docs/api/minimax-h3-video-api.md` 增加 H3 请求示例：text-only、first-frame、reference 模式各一份。
- 明确 `callback_url` 暂不支持、结果 URL 有时效、只支持 generation。
- 渠道配置使用新的类型 110、Base URL `https://api.minimax.io`、模型 `MiniMax-H3`。
- 不增加环境变量、数据库迁移、Terraform 或 Cloudflare 配置。

## 文件级变更清单

| 文件 | 变化 | 对其他渠道的影响 |
| --- | --- | --- |
| `constant/channel.go` | 新增 110/URL/name | 追加独立常量；不改旧 ID |
| `constant/minimax_h3_channel_test.go` | 常量回归测试 | 无运行时影响 |
| `relay/channel/task/hailuo_v2/*` | 新增私有协议、校验、状态、计费 | 无共享逻辑 |
| `relay/relay_adaptor.go` | 增加一个互斥 case | 高扇出工厂；由类型回归测试保护 |
| `relay/relay_adaptor_test.go` | 锁定 V1/V2/其他渠道映射 | 防回归 |
| `common/endpoint_type.go`、`common/endpoint_type_test.go` | 110 只声明 OpenAI Video endpoint | 避免新类型落入默认 chat 分类 |
| `setting/ratio_setting/model_ratio.go` | 新增 H3 base price | 只影响模型名精确命中 |
| `web/default/src/features/channels/constants.ts` | 增加渠道选项/排序 | 只新增 UI 选项 |
| `web/default/src/features/channels/lib/channel-utils.ts` | 110 复用 MiniMax 图标 | 无其他类型变化 |
| `web/default/src/i18n/locales/*.json` | 品牌键（若实际渲染需要） | 只新增键 |
| `docs/api/minimax-h3-video-api.md` | 配置、区域边界与请求示例 | 文档 |

明确不改：`controller/relay.go`、`relay/relay_task.go`、`service/task_polling.go`、`service/task_billing.go`、`model/task.go`、现有 `relay/channel/task/hailuo/*`、`common/api_type.go`。

## 测试矩阵

### H3 adaptor 单元测试

| 类别 | 用例 |
| --- | --- |
| 模型映射 | alias 映射到 MiniMax-H3 成功；映射到其他模型本地拒绝 |
| 必填字段 | 缺 model/content/resolution/duration；空 text；text > 7000 |
| 分辨率/时长 | 768P、2K；4、15 成功；边界外失败 |
| ratio | text-only 缺失/adaptive 失败；六个固定比例成功；frame 默认 adaptive |
| content | 首尾帧；reference image/video/audio；互斥；数量上限；audio-only 失败 |
| 零值语义 | `aigc_watermark=false` 仍序列化；未传则省略 |
| callback | 非空 callback_url 返回 `unsupported_callback_url` |
| 创建 | URL、Bearer、JSON body；只返回公开 task ID，不泄漏上游 ID |
| 查询 | URL path escape；queued/running/succeeded/failed/cancelled；直接 URL；错误 envelope；未知状态；success 缺 URL/usage/resolution 不终态化 |
| 计费预留 | 768P/2K；reference video 15 秒预留；5/6 张图片 |
| 完成结算 | usage total seconds、input image count；缺 usage 保持预留并告警；异常数值/溢出 |
| 计费快照 | international region 标记；768P/2K 标记恢复；标记缺失/并存/响应 mismatch 均不结算并告警 |
| OpenAI Video 转换 | 公开 ID、统一状态、临时 URL、失败错误；不暴露 upstream task ID；usage 由通用层单次注入 |

### 集成与回归

- 工厂：35 -> V1，110 -> V2，已有其他视频渠道不变。
- 任务落库：H3 `Task.Platform == "110"`；重建 adaptor 后可继续轮询。
- 多节点：两个轮询者竞争同一终态，CAS 只有一个执行差额结算；协议不完整的 success 不触发 CAS 终态。
- 失败：H3 failed/cancelled 只退款一次。
- 查询：`GET /v1/videos/{public_id}` 通过 `ConvertToOpenAIVideo` 返回公开 ID、正确状态和 URL，不暴露上游 task ID；success 分别缺 `usage`、`total_seconds`、`input_image_count`、URL 时均不终态化，后续完整轮询只结算一次。
- V1 回归：现有 MiniMax-Hailuo-2.3 创建/查询 URL 和结果转换不变。

建议验证命令：

```bash
go test ./constant/... ./relay/channel/task/hailuo/... ./relay/channel/task/hailuo_v2/... ./relay/... ./service/...
go vet ./...
go build ./...
cd web/default && bun run i18n:sync && bun run typecheck && bun run build:check
```

实施提交前必须运行 GitNexus `detect_changes(scope="compare", base_ref="main")`，确认受影响 execution flow 只来自新增渠道注册、H3 adaptor 和精确模型价格。

## 发布与回滚

### 部署建议

- **Router deploy：required。** `/v1/videos` 提交、异步 adaptor、状态解析和计费均在 Go router 运行路径。
- **Other deploy targets：newapi-console required**（若包含渠道管理 UI）；legacy `newapi` 建议与 router/console 使用同一 Go 镜像版本。`newapi-web`、Terraform、Cloudflare 不涉及。
- **数据库迁移：无。** `Task.Platform` 已存在，`110` 只是新值。

### 安全发布顺序

1. 在 staging 部署包含 adaptor 但尚未创建/启用 H3 渠道的版本。
2. 验证 768P/2K text-only、first-frame、reference video；核对上游账单与本地 quota。
3. 确认所有会执行任务轮询的实例均已升级后，再创建类型 110 渠道并小流量启用。
4. 观察创建错误率、任务终态耗时、usage 缺失告警、预扣与实际差额、取消/失败退款。
5. 再逐步扩大可用分组。

禁止在滚动升级尚未完成时提前提交 H3 任务：旧实例不认识 platform 110，可能无法轮询。生产是多节点，功能开关应以“渠道是否启用/是否挂载 ability”控制，而不是进程内状态。

### 回滚

1. 立即禁用类型 110 渠道，阻止新任务。
2. 保持至少一个含 H3 adaptor 的轮询实例运行，直到已提交任务全部终态；不要直接把所有实例回滚到不认识 110 的版本。
3. 如必须立即代码回滚，先导出未完成 H3 task ID，通过官方 V2 查询完成状态和人工对账/退款。
4. 无 DB schema 回滚；完成任务保留 platform 110 历史记录。

## 风险与待确认项

1. 当前凭证只通过国际站鉴权，因此第一版锁定国际站 `$0.08/$0.13/$0.04`。中国站支持不在本次范围；若以后需要同时支持，必须使用独立渠道身份和独立价格配置，不能只改 Base URL。
2. 五类真实成功请求已验证 `usage.total_seconds = input_seconds + output_seconds`、音频无独立计费用量、图片通过 `input_image_count` 计数。reference video 用例按官方单价计算为 `$0.80`，六图用例为 `$0.36`；实际金额仍需与账户账单抽样对账，因此继续保留最大输入时长预留和基于完整 usage 的完成结算。
3. 临时视频 URL 的刷新不在第一版；若产品要求长期下载，需要单独设计按 task ID 重新查询或受控代理缓存。
4. 当前通用同步 channel test 不适合纯异步 H3 类型；第一版用 staging 真实 `/v1/videos` smoke test，后续可建设 task-aware channel test。
5. 管理台仅维护 `web/default`；若生产仍允许切换 `web/classic`，需另开兼容任务补充类型 110，否则通过管理 API 配置。

## 验收标准

- 所有 H3 代码路径由 ChannelType 110 隔离，旧类型 35 和其他视频渠道没有行为变化。
- 官方 768P/2K、4..15 秒和 content[] 三种生成场景通过。
- platform 110 持久化后，重启和多节点轮询都能恢复正确 adaptor。
- 预扣、成功差额结算、失败退款各最多执行一次，并与真实上游账单抽样一致。
- callback 不泄漏上游 task ID；客户端响应只出现公开 task ID。
- 目标测试、全量 build/vet、前端 typecheck/build 通过。
- staging 小流量完成后再启用生产 ability。
