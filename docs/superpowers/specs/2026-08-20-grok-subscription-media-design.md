# Grok Subscription 图片与视频适配设计

## 背景

PR #757 已把 Grok Subscription（渠道类型 `113`）的 OAuth、CLI 文本请求、跨节点刷新 lease 和管理端授权流程合入 `main`，但该里程碑明确只支持文本：

- 图片请求仍在 `ConvertImageRequest` 返回不支持；
- 异步视频 `GetTaskAdaptor` 没有渠道类型 `113`；
- 默认模型与 Ability 只有 `grok-4.6`；
- 已存在的 xAI 图片渠道和 Grok 视频渠道使用普通 API Key，不能直接复用订阅 OAuth 的主机、Header 或凭证生命周期。

本迭代在不新增 xAI 专属公开出口的前提下，把 Grok Subscription 接入 Flatkey 现有图片与异步视频体系。客户端继续只面对 Flatkey 已有的 OpenAI 兼容接口，渠道适配器负责把请求翻译成 xAI Imagine 协议。

基线为 `origin/main@50ca884eb03cbdf082aed65aa42254068e3512a6`，实现分支为 `feature/grok-subscription-media`。旧 `feature/grok-subscription` 工作树中的未合并图片实验不进入此分支；其中思路只能作为参考，代码必须按本规格重新实现和验证。

## 目标

- 让渠道类型 `113` 支持 `grok-imagine-image-2.0` 的图片生成和单图/多图编辑。
- 让渠道类型 `113` 支持视频生成、编辑、扩展三类动作。
- Flatkey 对外保持一套稳定接口，不暴露 xAI 的 `/generations`、`/edits`、`/extensions` 三套视频创建路径。
- 复用现有渠道选择、并发限制、预扣费、异步轮询、终态 CAS、退款和内容代理体系。
- 媒体写请求只允许具有新鲜、正向付费订阅证据的 Grok Subscription 渠道执行。
- 不把 OAuth 凭证、xAI `request_id`、临时视频 URL 或原始响应暴露给客户端或重复持久化到任务记录。
- 在多节点部署下，凭证刷新、计费快照更新、任务终态结算和临时 URL 更新均保持一致性。

## 非目标

- 不增加公开的 `/v1/videos/generations`、`/v1/videos/edits`、`/v1/videos/extensions`。
- 不删除或改变其他视频渠道已有的请求格式和兼容路由。
- 不开放 xAI Files API、`file_id` 输入或 `storage_options`；Flatkey 不替客户端创建永久 xAI 文件。
- 不开放客户端覆盖 xAI Authorization、CLI 身份 Header 或上游 `user` 字段。
- 不在本迭代为同步图片增加新的持久化资产库或图片内容代理。
- 不根据字段存在与否猜测视频动作；动作必须由 `action` 明确决定。

## 方案选择

### 方案 A：复用 Flatkey 公开接口，在渠道内部翻译（选定）

- 图片继续使用现有 `/v1/images/generations` 和 `/v1/images/edits`。
- 视频创建只使用现有 `POST /v1/videos`，新增顶层 `action`。
- 渠道类型 `113` 分别实现同步图片适配和异步 `TaskAdaptor`。

这与 Flatkey “一个公开出口、内部适配供应商”的产品边界一致，也能直接复用现有计费和任务生命周期。

### 方案 B：公开 xAI 原生的三套视频创建接口（拒绝）

该方案最接近上游文档，但会把供应商协议泄漏成 Flatkey 公共契约，客户端迁移和后续多供应商适配都会分叉。

### 方案 C：把所有视频渠道强制迁移到同一个新 DTO（拒绝）

统一程度最高，但会破坏已有 Seedance、Sora 和其他任务渠道的请求兼容性，超出本迭代范围。此次只为 `/v1/videos` 增加向后兼容字段，其他适配器可忽略它们。

## 对外 API 契约

### 图片生成

公开接口保持：

```http
POST /v1/images/generations
```

支持的 Grok Imagine 请求字段：

```json
{
  "model": "grok-imagine-image-2.0",
  "prompt": "A glass city floating above the ocean",
  "n": 1,
  "response_format": "url",
  "aspect_ratio": "16:9",
  "resolution": "1k",
  "quality": "low"
}
```

约束：

- `model` 必须为 `grok-imagine-image-2.0`；
- `prompt` 必填且去除首尾空白后不能为空；
- `n` 允许 `1..10`，缺省为 `1`；
- `response_format` 允许 `url`、`b64_json`；
- `resolution` 允许 `1k`、`2k`；
- `quality` 允许 `low`、`medium`；
- `aspect_ratio` 允许 `1:1`、`16:9`、`9:16`、`4:3`、`3:4`、`3:2`、`2:3`、`2:1`、`1:2`、`19.5:9`、`9:19.5`、`20:9`、`9:20`、`auto`；
- 所有可选标量使用指针与 `omitempty`，明确传入的零值不能在转换中静默消失；
- `user`、`file_id` 和 `storage_options` 不转发；不支持的媒体持久化字段直接返回本地 `400`。

响应继续使用现有 OpenAI 图片响应。`url` 模式返回 xAI 的短期图片 URL；`b64_json` 原样映射为 OpenAI 兼容字段。本迭代不为同步图片新增 Flatkey 资产代理，因此调用方应及时下载 URL 结果。

### 图片编辑

公开接口保持：

```http
POST /v1/images/edits
```

接受两类输入：

1. OpenAI 兼容 multipart：`image` 文件、`prompt`、`model` 以及可选生成参数；同名 `image` 最多 3 个。
2. JSON：单图使用 `image`，多图使用 `images`；每项只允许 HTTPS URL 或受支持图片 MIME 的 base64 data URI。

JSON 示例：

```json
{
  "model": "grok-imagine-image-2.0",
  "prompt": "Combine the subjects into one cinematic scene",
  "images": [
    {"url": "https://example.com/a.png"},
    {"url": "data:image/jpeg;base64,..."}
  ],
  "aspect_ratio": "3:2",
  "resolution": "2k",
  "quality": "medium",
  "response_format": "url"
}
```

编辑约束：

- 必须有 `1..3` 张源图；multipart 文件在内存/临时文件限制内转为 data URI 后再交给适配器；
- 只支持 `image/jpeg`、`image/png`，并沿用系统现有请求体与上传大小限制；
- 单图编辑保持输入图宽高比，显式 `aspect_ratio` 只允许多图编辑；
- 不支持 `mask`、`file_id` 或 `storage_options`；出现时本地返回 `400`，不静默忽略；
- `n`、`response_format`、`resolution`、`quality` 的取值规则与图片生成相同。

`relay/image_handler.go` 对渠道类型 `113` 必须强制执行语义转换，即使全局或渠道打开 `PassThroughBodyEnabled` 也不能绕过。否则 multipart、Header 隔离和上游字段白名单都无法保证。

### 统一视频创建

公开接口保持且唯一使用：

```http
POST /v1/videos
```

统一请求：

```json
{
  "model": "grok-imagine-video-1.5",
  "action": "generate",
  "prompt": "The person from <IMAGE_0> speaks with <AUDIO_0>",
  "duration": 8,
  "aspect_ratio": "16:9",
  "resolution": "720p",
  "image": {"url": "https://example.com/first-frame.png"},
  "video": {"url": "https://example.com/source.mp4"},
  "reference_images": [{"url": "https://example.com/person.png"}],
  "reference_audios": [{"voice_id": "eve"}]
}
```

`action` 规则：

| action | 缺省 | 必填输入 | 允许模型 | xAI 内部路径 |
| --- | --- | --- | --- | --- |
| `generate` | 是 | `prompt` | `grok-imagine-video-1.5`、`grok-imagine-video` | `/v1/videos/generations` |
| `edit` | 否 | `prompt` + `video` | `grok-imagine-video` | `/v1/videos/edits` |
| `extend` | 否 | `prompt` + `video` | `grok-imagine-video` | `/v1/videos/extensions` |

通用规则：

- `action` 省略时为 `generate`；未知值返回 `400`；
- `prompt` 必填且非空；
- 所有 `image`、`video`、`reference_images` 只允许 HTTPS URL 或 data URI；不接受 `file_id`；
- 不转发 `user` 和 `storage_options`；
- 适配器只按 `action` 选择路径，不根据 `video`、`image` 等字段猜测动作。

`generate` 支持四种输入形态：

1. 纯文本：不提供任何媒体输入；
2. 图生视频：只提供 `image`，该图作为第一帧；
3. 参考生成：提供 `reference_images`、`reference_audios`，或两者同时提供；
4. 不允许 `image` 与任意 `reference_*` 同时出现，也不允许 `video`。

生成约束：

- `duration` 为 `1..15` 秒；
- `aspect_ratio` 允许 `1:1`、`16:9`、`9:16`、`4:3`、`3:4`、`3:2`、`2:3`；
- `resolution` 允许 `480p`、`720p`、`1080p`；
- `grok-imagine-video-1.5` 的纯文本和图生视频允许到 `1080p`；参考生成最高 `720p`；
- `grok-imagine-video` 只允许 `480p`、`720p`，且不支持 `reference_audios`；
- `reference_images` 最多 7 张；`reference_audios` 最多 3 个，只接受预置 `voice_id`；
- 引用列表至少包含一项；未知 voice ID 由上游以 `400` 返回并清洗后映射。

`edit` 约束：

- 只允许 `grok-imagine-video`；
- `video` 与 `prompt` 必填；
- 拒绝 `image`、`reference_images`、`reference_audios`、`duration`、`aspect_ratio`、`resolution`；
- 远程视频的编码、格式和时长由 xAI 校验，Flatkey 只做 URL/data URI、安全大小和明显类型校验。

`extend` 约束：

- 只允许 `grok-imagine-video`；
- `video` 与 `prompt` 必填；
- `duration` 为 `2..10` 秒，缺省 `6`，表示新增片段而非最终总长度；
- 拒绝 `image`、`reference_images`、`reference_audios`、`aspect_ratio`、`resolution`；
- 上游要求输入为受支持编码的 MP4 且时长 `2..15` 秒；Flatkey 不为校验而预下载任意远程视频，无法本地确认的格式/时长由上游处理。

已有其他视频渠道继续按当前 DTO 和路由工作。新字段对不认识它们的适配器保持可选，不能把 Seedance `content[]` 等现有协议强制改成 Grok 结构。

## 内部架构

### 同步图片链路

1. 现有图片路由进入 `ImageHelper`。
2. 渠道类型 `113` 无条件进入 `ConvertImageRequest`，完成 multipart/JSON 归一化、模型动作校验和 xAI DTO 生成。
3. 媒体预检加载当前渠道凭证和付费证据；只在尚未发出上游写请求时允许切换候选渠道。
4. 请求固定发送到 `https://api.x.ai/v1/images/generations` 或 `/v1/images/edits`。
5. `DoResponse` 复用现有 OpenAI 图片响应转换，并把生成张数写入现有图片计费上下文。
6. Flatkey 按本地模型价格和 `n` 结算；上游 `usage.cost_in_usd_ticks` 只用于审计日志，不反算用户售价。

图片价格保持一个可配置的 Flatkey `ModelPrice`，按输出张数相乘；`resolution`、`quality` 和编辑输入图数量不会在本迭代引入动态售价。上线价格必须由运营配置覆盖最坏上游成本，不能把 Grok 订阅剩余额度直接当作 Flatkey 售价。

### 异步视频链路

新增独立的 `relay/channel/task/groksubscription`，实现完整 `channel.TaskAdaptor`，不扩展同步文本适配器：

1. `RelayTask` 解析统一请求、生成公开 `task_*` ID、映射模型并估算费用。
2. 视频提交强制全额预扣；适配器将 `action` 映射到 xAI 内部路径。
3. xAI 返回 `request_id`；适配器持久化为私有 `UpstreamTaskID`，公开响应只返回 Flatkey `task_*`。
4. 如果上游成功使用 HTTP `202`，适配器在进入通用 `DoResponse` 前归一化为 `200`；`200` 继续原样处理。
5. 轮询任务使用 `GET https://api.x.ai/v1/videos/{request_id}`，状态映射如下：

| xAI | Flatkey 内部 | OpenAI 视频公开状态 |
| --- | --- | --- |
| `pending` | `QUEUED` | `queued` |
| `done` | `SUCCESS` | `completed` |
| `failed`、`expired` | `FAILURE` | `failed` |

未知状态不猜测为成功或失败：本轮轮询返回可重试的上游协议错误，保留任务原状态，并受现有轮询重试/超时策略约束。

6. 成功终态保存临时 `video.url`、时长、分辨率和上游 usage 到任务私有数据；失败原因必须清洗供应商主机、原始响应和敏感字段。
7. 任务状态仍由现有 CAS 保证只有一个节点完成终态结算或退款：失败全退预扣，成功按实际时长/分辨率结算并调整差额。
8. `ConvertToOpenAIVideo` 重写 ID 为公开 `task_*`，不返回 xAI `request_id` 或临时 URL。

视频售价使用现有按模型、分辨率、秒数计算的异步计费路径。`grok-imagine-video-1.5` 与 `grok-imagine-video` 的本地价格表是 Flatkey 销售价；上游 `cost_in_usd_ticks` 仅作为审计信息和对账依据，不能覆盖已冻结的提交时计费快照。

### 任务凭证与私有数据

- 类型 `113` 的任务不得把完整 `Channel.Key`、access token 或 refresh token复制到 `Task`。
- 任务只保存 `origin_channel_id`、公开 ID、xAI `request_id`、动作和结算所需的非秘密快照。
- 提交前、轮询和临时 URL 刷新都按 `origin_channel_id` 重新读取当前渠道凭证；这样 token 刷新或轮换后，旧任务无需改写即可继续。
- 轮询是幂等 GET，遇到 token 过期可走现有跨节点刷新 lease 后重试一次。
- 渠道被删除后无法再取得凭证，任务按现有轮询失败策略处理；不得回退到另一个订阅账号查询同一个 xAI `request_id`。

## 订阅付费资格与 Ability

### 快照结构

复用 `grok_channel_states`，新增独立的 `billing_observed_at` 字段；`quota_snapshot` 改存显式版本的非秘密 JSON：

```json
{
  "version": 1,
  "plan": "SuperGrok",
  "tier": "",
  "monthly": {
    "status_code": 200,
    "usage_percent": 12.5,
    "used_percent": 20,
    "monthly_limit_cents": 15000
  },
  "weekly": {
    "status_code": 200,
    "usage_percent": 8
  }
}
```

约束：

- JSON 必须带 `version`；未知版本按不可用处理，不能按旧结构猜测；
- `billing_observed_at` 是新鲜度和单调写入的唯一时间源，不依赖 JSON 内嵌时间；
- `BillingPlan`、`TierRaw` 保持非秘密的管理端投影，但媒体资格判断以版本化快照和 `billing_observed_at` 为准；
- 上游原始响应、token、cookie、完整错误体不持久化。

### 探测和单调更新

- 管理端授权完成或“刷新”成功后，使用 CLI 专属主机与 CLI 身份 Header 读取月度 `/billing` 和周度 `/billing?format=credits`。
- 媒体请求发现快照缺失或超过 24 小时时，可在发起媒体写请求之前执行一次只读 JIT 探测；探测受同一个 channel-scoped 跨节点 refresh lease 保护，其他节点等待短暂结果后重读状态。
- 探测开始时间取数据库时间。保存时同时校验 lease owner，并只允许比当前 `billing_observed_at` 更新的成功探测覆盖，防止过期执行者覆盖新结果。
- 探测失败不清空旧快照、不延长新鲜度，也不把 OAuth 状态改成 `needs_reauth`；只有真正的 token 刷新失败或凭证不可恢复才改变认证状态。
- 明确得到免费/基础 tier 或无正向付费字段时，保存成功探测结果并撤销媒体 Ability；模糊或损坏响应按失败关闭，不授予资格。

### 付费判定

媒体写请求要求同时满足：

- 快照版本受支持；
- `billing_observed_at` 不早于当前数据库时间 24 小时，且不能明显位于未来；
- 月度和周度窗口没有任一 `401/403`；
- 至少一个窗口成功，并存在可识别的 `SuperGrok`/`SuperGrok Heavy` 方案、正数月度上限或权威 usage 字段；
- `TierRaw` 和快照 tier 均不是 `free`、`0`、`x_basic` 等明确拒绝值。

图片/视频状态读取和视频内容下载不受此写资格限制，避免订阅后来过期时用户无法取得已付费生成的结果。

### Ability 更新

- 类型 `113` 的文本 Ability 继续按 PR #757 行为工作。
- 每次授权完成、管理端刷新、JIT 探测成功或明确付费状态变化后，精确重建该渠道的媒体 Ability。
- 正向付费证据增加 `grok-imagine-image-2.0`、`grok-imagine-video-1.5`、`grok-imagine-video`；明确免费、无资格或 token 不可恢复时移除这三项。
- 更新必须保留该渠道的分组、优先级、权重、并发设置、模型映射和无关模型，并触发现有跨节点渠道缓存失效。
- 即使 Ability 缓存尚未收敛，实际适配器仍在发送前再次执行付费资格检查；缓存不是安全边界。

## OAuth、主机与 Header 安全

Grok Subscription 有两类完全隔离的上游请求：

| 请求 | 主机 | Header |
| --- | --- | --- |
| 文本、token 刷新、billing 探测 | PR #757 允许的 CLI 主机 | Bearer + CLI client identity |
| 图片、视频提交/轮询 | 固定 `api.x.ai` 区域 allowlist | 仅 Bearer 与必要的 Content-Type/Accept |

媒体链路要求：

- 目标 URL 由适配器按动作固定生成，忽略渠道自定义 BaseURL、请求中的 URL 和 `{api_key}` 模板；
- `Authorization` 必须来自解析后的当前 OAuth 凭证，禁止用户/渠道 Header Override 覆盖；
- 不发送 `x-xai-token-auth`、Grok CLI client ID/version、CLI User-Agent 或 cookie；
- 不转发客户端 `Authorization`、`user`、hop-by-hop Header；
- 错误和日志只记录 channel ID、公开 task ID、动作、HTTP 状态等白名单字段，不能记录 credential JSON、临时 URL 或原始 body。

### token 新鲜度和写请求重试

- 在任何媒体 POST 前检查 credential expiry；接近过期时先通过现有跨节点 lease 刷新 token，再加载新凭证并执行付费检查。
- 一旦媒体 POST 已经发出，`401`、`429`、超时、连接中断或 `5xx` 都不能自动把同一写请求重放到同账号或另一账号，因为上游可能已接受任务但响应丢失。
- 上游 POST 返回 `401` 时可为后续请求刷新/标记凭证状态，但当前请求返回清洗后的鉴权错误；不重放当前图片或视频写入。
- 只有确定发生在发送前的本地校验、凭证加载、付费探测或连接建立失败，才允许现有控制器选择另一个候选渠道。
- 轮询、billing 探测和结果刷新属于幂等 GET，可在刷新 token 后重试一次。

## 视频内容代理与临时 URL 刷新

公开下载保持：

```http
GET /v1/videos/{task_id}/content
```

类型 `113` 注册专用 resolver：

1. 用公开 `task_id` 读取成功任务并取得私有 xAI `request_id` 和缓存临时 URL。
2. SSRF 校验后代理内容，去除 cookie、供应商 Header 和重定向泄漏。
3. 如果临时 URL 返回 `401`、`403`、`404` 或 `410`，按 `origin_channel_id` 加载当前凭证，对 `GET /v1/videos/{request_id}` 刷新结果。
4. 新 URL 再次经过 allowlist/SSRF 校验，并以 CAS/事务更新任务私有数据；内容请求只重试一次。
5. 刷新仍失败时返回 Flatkey 统一错误，不把 xAI URL、主机、request ID 或响应体返回客户端。

任务查询 `GET /v1/videos/{task_id}` 只返回现有 OpenAI 视频 DTO和 Flatkey content URL，不返回保存的临时 URL。

## 错误语义

- 本地字段、动作、模型组合、URL/data URI 格式错误：`400 invalid_request_error`，不重试。
- 渠道缺少新鲜正向付费证据：渠道内部标记为 `403 media_subscription_required`；在未发送上游请求时允许控制器尝试下一个候选，最终没有合格渠道时返回该错误。
- token 无法刷新或上游明确拒绝鉴权：清洗后的 `401 upstream_auth_error`，当前媒体写不重放。
- 上游限流：`429`，写请求不跨账号重放。
- 上游确定的参数/能力拒绝：保留合理的 `4xx`，清洗供应商身份与原始正文。
- 不确定写入结果的超时、网络断开或 `5xx`：返回统一上游错误，记录“结果不确定”供排查，不自动退款后重试另一账号；同步图片仍按现有失败结算路径退款用户预扣，异步视频只有在没有得到 `request_id` 时按提交失败退款。
- 已取得视频 `request_id` 后，后续失败必须进入任务生命周期，不能把提交当作从未发生。

## 多节点一致性

- OAuth/token/billing 探测共用按渠道的数据库 refresh lease，不能使用进程内锁保证正确性。
- billing 快照写入同时校验 lease owner 与单调 `billing_observed_at`；旧探测不能覆盖新探测。
- Ability 改动发布现有渠道配置失效事件，所有 router 节点最终读取同一 DB 状态；发送前付费检查作为强一致安全门。
- 视频终态继续使用现有 Task CAS，只有状态转换赢家结算或退款。
- 临时 URL 更新只改任务私有字段，可重复执行且以后写覆盖必须来自同一 `request_id` 的更新结果。
- 任务轮询不依赖创建任务节点的内存或旧 token。

## 测试策略

实施采用 TDD：先补充能证明当前 `main` 不支持目标行为的失败测试，再写最小实现。

### 图片适配器

- 生成请求：模型、`n`、response format、全 aspect ratio、1K/2K、low/medium 映射。
- JSON 编辑和 OpenAI multipart 编辑；单图、多图、3 图上限、data URI、HTTPS URL。
- 拒绝第 4 张图、mask、file ID、storage options、HTTP URL、非法 MIME 和空 prompt。
- 单图 aspect ratio 限制与多图 aspect ratio 转换。
- `PassThroughBodyEnabled` 开启时仍强制走类型 `113` 转换。
- 媒体 Header 只含 API Bearer，CLI Header 和 Header Override 均不能进入请求。
- 上游 URL/b64 响应、usage、`n` 计费与错误清洗。

### 订阅付费状态

- 版本 1 快照解析、未知版本 fail-closed、明确免费 tier 拒绝。
- 24 小时边界、未来时钟偏差、任一窗口 401/403、部分成功和无权威字段。
- 探测失败不覆盖旧快照、不延长 `billing_observed_at`、不改 `needs_reauth`。
- 旧 lease owner 和更旧 observed time 不能覆盖较新快照；覆盖逻辑在 SQLite、MySQL、PostgreSQL 兼容的 GORM 条件更新上测试。
- 资格变化精确增加/移除三项媒体 Ability，并触发缓存失效；文本和无关 Ability 保留。

### 视频 TaskAdaptor

- `generate` 的纯文本、图生视频、参考图、参考音频和混合参考输入。
- 所有 action/model/字段互斥矩阵、时长、比例、分辨率、7 图/3 voice 上限。
- `edit`、`extend` 的内部路径和 payload；extend 默认时长 `6`。
- `200`/`202` 提交、公开 ID 与私有 request ID 隔离。
- `pending`、进行中、`done`、`failed`、`expired` 状态映射。
- 任务不持久化 OAuth credential；poll 总是加载 origin channel 当前凭证。
- 完成 usage、按秒计费、差额结算、失败退款、终态 CAS 只能结算一次。
- 所有公开 DTO和错误不包含供应商名、主机、临时 URL 或 xAI request ID。

### 内容代理

- 成功代理、SSRF 拒绝、cookie/Header 清除。
- 临时 URL 对 `401/403/404/410` 触发一次结果刷新和一次内容重试。
- 刷新使用 origin channel 新凭证，URL 再校验后才保存和请求。
- 并发刷新不会破坏任务私有数据，失败不泄漏上游信息。

### 回归与验证命令

至少执行：

```text
go test ./relay/channel/groksubscription/...
go test ./relay/channel/task/groksubscription/...
go test ./relay/...
go test ./controller/...
go test ./service/...
go test ./model/...
go test ./...
go build ./...
```

如果更新 OpenAPI 文档，额外运行仓库现有 OpenAPI 校验。实现完成后启动受影响的本地 Go 服务，使用本地 URL 验证图片生成请求、视频提交/查询/内容代理的路由行为；如果本地环境缺少可用 OAuth 或数据库配置，必须明确记录阻塞，不能用单元测试冒充本地在线验证。

## 测试环境验收（渠道 ID 27）

合并到 `staging` 并等待 staging backend 部署后，使用已授权渠道 `27` 做受控 smoke test。测试必须使用低成本参数，记录 Flatkey request/task ID、HTTP 状态、耗时、用户扣费和渠道日志，不记录 OAuth token 或上游 URL。

验收动作：

1. 图片生成：1K/low、`n=1`、URL 或 b64 至少一种；
2. 图片编辑：单图；
3. 图片编辑：2 张参考图；
4. 视频纯文本生成；
5. 图生视频；
6. reference image 生成；
7. preset voice 或图+voice 参考生成；
8. `grok-imagine-video` 编辑；
9. `grok-imagine-video` 扩展；
10. 视频状态轮询直到终态并经 Flatkey content URL 下载；
11. 人为使用过期临时 URL验证自动刷新；
12. 验证无付费/过期快照得到 `403`，文本 `grok-4.6` 不受影响；
13. 对每个成功和失败场景核对预扣、结算或退款只发生一次。

任何 live 媒体 POST 都是有成本且可能产生不可撤销上游任务的外部写操作。实现与自动测试完成后，执行 staging smoke test 前需确认测试 token、提示词和预算边界；不在生产渠道直接试错。

## 文档与兼容性

- 更新 Flatkey 视频 API 文档，记录 `action` 和各动作参数矩阵，但不出现 Grok Subscription 的内部 OAuth/主机细节。
- 更新 OpenAPI 中图片扩展字段和 `/v1/videos` 可选字段。
- 现有未带 `action` 的 `/v1/videos` 请求仍按 `generate` 处理。
- 现有 `/v1/video/generations` 等兼容路由不删除，但类型 `113` 的完整能力只以本规格的一套公开契约为准。

## 部署影响

- Router deploy：required。修改图片 `/v1/images/*`、视频 `/v1/videos*`、渠道选择、异步轮询、内容代理和计费结算路径。
- Other deploy targets：`newapi-console` 也需要部署，因为管理端授权/刷新会探测 billing 并更新 Ability；无需 `newapi-web`、Terraform 或 Cloudflare。
- Database：`grok_channel_states` 增加 `billing_observed_at`，必须通过 GORM/现有迁移机制同时兼容 SQLite、MySQL 5.7.8+、PostgreSQL 9.6+。
- Rollout：先部署 staging，完成渠道 `27` 全动作 smoke test和计费核对；生产发布 router 与 console，观察媒体错误率、任务终态、退款、OAuth 刷新和代理下载。
- Rollback：回滚应用时新增列可保留；移除媒体 Ability 即可停止新媒体写入，已创建任务仍应由兼容的轮询代码处理完毕，因此生产回滚前必须确认是否存在进行中的类型 `113` 视频任务。

## 官方依据（2026-08-20 核验）

- [Imagine Overview](https://docs.x.ai/developers/model-capabilities/imagine)：`grok-imagine-image-2.0`、图片 1K/2K、多图编辑、视频能力总览。
- [Image Generation](https://docs.x.ai/developers/model-capabilities/images/generation)：`n`、aspect ratio、resolution、response format。
- [Images REST API](https://docs.x.ai/developers/rest-api-reference/inference/images)：图片生成/编辑路径和响应 usage。
- [Video Generation](https://docs.x.ai/developers/model-capabilities/video/generation)：生成时长、比例、分辨率和异步语义。
- [Reference-to-Video](https://docs.x.ai/developers/model-capabilities/video/reference-to-video)：最多 7 张参考图与 3 个预置 voice。
- [Video Extension](https://docs.x.ai/developers/model-capabilities/video/extension)：输入时长、扩展时长与不支持的输出参数。
- [Videos REST API](https://docs.x.ai/developers/rest-api-reference/inference/videos)：三类内部创建路径、`request_id` 和查询路径。
- [API Pricing](https://docs.x.ai/developers/pricing)：图片输入/输出和视频按分辨率、秒数的上游价格，仅用于成本与默认售价配置参考。

## 完成标准

- 渠道 `113` 的图片生成/编辑和视频三动作全部通过单元与集成测试。
- 对外只增加向后兼容字段，不增加 xAI 专属公开视频路径。
- 付费资格、OAuth/Header、任务私有数据和临时 URL 均满足 fail-closed 与不泄漏要求。
- 多节点下 billing、refresh、Ability、任务结算和 URL 刷新没有进程内正确性依赖。
- staging 渠道 `27` 完成所有受支持动作的低成本 smoke test，扣费/退款核对无重复。
- 分支从最新 `origin/main` 创建，提交和 PR 不包含旧图片实验或其他无关改动。
