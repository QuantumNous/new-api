# Vidu 渠道升级方案

## 背景

aiapi114 当前已经内置 Vidu 渠道类型和视频任务适配器，但能力停留在早期视频接口阶段。当前合作范围需要同时接入图片生成和视频生成服务，其中图片生成最低要求覆盖 `gpt-image-2` 的文生图、编辑、参考图生图。

本方案基于以下资料整理：

- Vidu 官方更新记录：`https://platform.vidu.com/docs/update`
- Vidu 图片生成接口：`https://platform.vidu.com/docs/reference-to-image`
- Vidu 视频生成接口：`https://platform.vidu.com/docs/text-to-video`、`https://platform.vidu.com/docs/image-to-video`、`https://platform.vidu.com/docs/reference-to-video`
- Vidu 任务结果查询：`https://platform.vidu.com/docs/get-generation`
- Vidu 回调验签：`https://platform.vidu.com/docs/callback-signature`
- 飞书资料页需要登录，当前只记录为合作方资料来源，不作为可审计接口事实依据。

## 目标

### 最低交付目标

- 保留现有 Vidu 渠道类型 `52`，不新增服务商类型。
- 支持用户以 `gpt-image-2` 调用图片生成能力。
- 将 `gpt-image-2` 映射为 Vidu 上游模型 `viduimage-2`。
- 支持 `gpt-image-2` 文生图、图片编辑、参考图生图。
- 支持用户以 `nano-banana-2` 或平台统一别名调用 Vidu 上游 `Q3-fast`。
- Vidu 图片接口按异步任务处理，支持提交、轮询、结果查询、失败退款。
- 保持视频能力可用，并补齐当前官方文档中的新字段和新模型映射。

### 非目标

- 不把 Vidu 上游模型名直接暴露为主要用户模型名。
- 不在首版实现完整图片生成前端工作台。
- 不在首版承诺 `/v1/images/generations` 同步阻塞直到图片生成完成。
- 不把 Vidu 结果 URL 当作永久资源；官方结果链接有有效期，长期可用需要后续接入对象存储转存。

## 当前代码现状

### 已存在能力

- 渠道类型已存在：`constant/channel.go` 中 `ChannelTypeVidu = 52`。
- 默认地址已存在：`constant/channel.go` 中 Vidu 默认 `https://api.vidu.cn`。
- 后端任务适配器已注册：`relay/relay_adaptor.go` 中 `ChannelTypeVidu` 返回 `relay/channel/task/vidu.TaskAdaptor`。
- 视频任务路由已存在：`router/video-router.go` 支持 `/v1/videos`、`/v1/videos/{task_id}`、`/v1/videos/{task_id}/content`。
- 任务日志页面已存在：默认前端 `/usage-logs/task` 可展示异步任务。
- 渠道管理页面已包含 Vidu 下拉选项：`web/default/src/features/channels/constants.ts` 和 `web/classic/src/constants/channel.constants.js`。

### 主要缺口

- Vidu 没有普通图片 adaptor，无法通过现有 OpenAI 图片中继链路完成图片生成。
- `common/api_type.go` 未将 `ChannelTypeVidu` 映射到独立 APIType。
- 现有 `relay/channel/task/vidu/adaptor.go` 只覆盖视频任务，请求字段落后于当前官方文档。
- 现有 Vidu 任务模型列表较旧，缺少业务映射模型。
- 任务系统当前更偏视频任务，图片结果展示和图片任务类型需要补齐。
- 计费尚未按 Vidu `credits` 做最终校准。
- 回调验签未接入，当前主要依赖轮询。

## 模型映射策略

用户可见模型名与 Vidu 上游模型名必须分离：

| 用户可见模型 | Vidu 上游模型 | 说明 |
| --- | --- | --- |
| `gpt-image-2` | `viduimage-2` | 主推图片模型，最低交付范围必须支持 |
| `nano-banana-2` | `Q3-fast` | 业务约定为 Gemini 3.1 Flash / Nano Banana 2 对应能力 |

推荐实现方式：

1. 渠道能力、价格页、用户文档、调用示例统一展示用户可见模型名。
2. Vidu 渠道配置的模型列表填用户可见模型名。
3. 渠道模型映射中配置：

```json
{
  "gpt-image-2": "viduimage-2",
  "nano-banana-2": "Q3-fast"
}
```

4. 后端向 Vidu 发起请求时使用 `info.UpstreamModelName` 填入 Vidu 请求体 `model`。
5. 日志和账单保留用户请求模型名，同时在任务属性中记录上游模型名，便于排查。

## 图片接入设计

### 推荐路线

首版按任务式图片生成接入，不强行伪装成同步 OpenAI 图片接口。

原因：

- Vidu 图片接口本身是异步任务接口。
- 现有 aiapi114 已有任务表、轮询、预扣费、失败退款、任务日志。
- 同步阻塞会放大 HTTP 超时、并发占用、用户重试和重复扣费问题。

### API 入口

最低实现建议提供两类入口：

1. OpenAI 兼容提交入口：接受 `/v1/images/generations`、`/v1/images/edits` 的请求体，转换为 Vidu 图片任务并返回平台任务对象。
2. 平台任务查询入口：复用 `/api/task/self` 和任务日志；必要时新增图片任务详情响应格式。

如果必须保持 OpenAI SDK 完全兼容，可以增加短轮询模式：

- 提交 Vidu 任务后等待最多 15-30 秒。
- 成功则返回 OpenAI `ImageResponse`。
- 未完成则返回任务 ID 和 `processing` 状态。
- 该模式必须通过渠道设置或全局设置显式开启，默认关闭。

### 请求转换

新增 `relay/channel/vidu` 或 `relay/channel/task/vidu/image.go`，按职责拆分：

- `image_request.go`：OpenAI 图片请求到 Vidu `reference2image` 请求体转换。
- `image_response.go`：Vidu 图片提交和结果响应解析。
- `models.go`：Vidu 模型映射、能力常量、默认参数。
- `billing.go`：Vidu credits 计费估算和完成校准。

图片请求体核心字段：

| aiapi114 输入 | Vidu 字段 | 规则 |
| --- | --- | --- |
| `model` | `model` | 使用 `info.UpstreamModelName`，例如 `viduimage-2` |
| `prompt` | `prompt` | 必填 |
| `image` / `images` | `images` | URL 或 Base64 数组，支持 0-7 张 |
| `size` | `aspect_ratio` / `size` 映射 | 需要按 Vidu 文档映射，不能直接透传 OpenAI 尺寸 |
| `n` | `count` 或任务数量 | Vidu 如不支持单请求多图，按多任务提交或限制为 1 |
| `metadata` | 透传字段 | 仅允许白名单字段，避免未知字段导致上游拒绝 |

三种最低能力统一走 `reference2image`：

- 文生图：`images` 为空。
- 编辑：`images` 至少 1 张，`prompt` 表达修改目标。
- 参考图生图：`images` 至少 1 张，按参考图语义处理。

### 结果处理

Vidu 查询接口返回 `state`、`err_code`、`credits`、`creations`。平台映射规则：

| Vidu state | aiapi114 TaskStatus |
| --- | --- |
| `created` / `queueing` | `SUBMITTED` 或 `QUEUED` |
| `processing` | `IN_PROGRESS` |
| `success` | `SUCCESS` |
| `failed` | `FAILURE` |

成功时：

- 将第一张图片 URL 写入 `task.PrivateData.ResultURL`。
- 将完整 `creations` 写入 `task.Data`，便于多图结果展示。
- 对 OpenAI 兼容查询响应可转换为 `data: [{ url }]`。

失败时：

- 将 `err_code` 写入 `FailReason`。
- 触发任务失败退款。
- 日志记录上游错误码，不记录敏感请求内容。

## 视频升级设计

保留现有 `relay/channel/task/vidu/adaptor.go`，但需要升级字段和模型：

- 补齐 `text2video`、`img2video`、`start-end2video`、`reference2video` 当前文档字段。
- 支持 `callback_url`、`payload`、`off_peak`、`is_rec`、`audio`、`audio_type`、`voice_id` 等官方字段。
- 支持参考生视频的 `subjects` / `images` / `videos` 结构。
- 移除或收敛旧模型列表，改为以平台模型配置为准。
- 继续使用 `Authorization: Token <key>`。

视频首版不改变用户 API：

- `/v1/videos`
- `/v1/videos/{task_id}`
- `/v1/videos/{task_id}/content`
- `/v1/video/generations`
- `/v1/video/generations/{task_id}`

## 计费方案

### 首版策略

1. 提交前按平台模型价格预扣。
2. Vidu 提交响应或完成查询包含 `credits` 时，记录到任务数据。
3. 任务完成后按实际 `credits` 做结算校准。
4. 任务失败按现有任务失败退款逻辑退款。

### 配置建议

- `gpt-image-2` 以固定单次价格或表达式计费起步。
- `nano-banana-2` 独立配置价格，不和 `gpt-image-2` 共用。
- 视频按模型、时长、分辨率、是否 off-peak 分层计费。
- 若 Vidu credits 口径发生调整，只更新模型价格配置和 credits 换算，不改业务代码。

## 回调与轮询

首版优先轮询，回调作为增强项。

轮询：

- 复用现有 `TaskPollingLoop`。
- 图片任务和视频任务统一走 Vidu 查询接口。
- 控制并发、超时和重试间隔，避免对 Vidu 任务查询形成突刺。

回调增强：

- 新增 Vidu callback endpoint。
- 验证 `X-HMAC-SIGNATURE`、`X-HMAC-ALGORITHM`、`X-HMAC-ACCESS-KEY`、`x-request-nonce`。
- 签名通过后更新任务状态。
- 回调失败不影响轮询兜底。

## 前端与后台配置

### 渠道管理

现有页面已能选择 Vidu。需要补充：

- Vidu 渠道 key 提示：填写 token 原文，不要包含 `Token ` 前缀。
- Vidu 默认 base_url 提示：留空使用默认地址；合作方给专用域名时填写根地址，不带 `/ent/v2`。
- Vidu 不支持普通渠道测试，测试按钮应提示“异步任务渠道需通过任务提交验证”。

### 模型与价格

需要在模型管理中配置：

- `gpt-image-2`
- `nano-banana-2`
- 需要接入的视频模型别名

每个模型需要配置：

- 可见名称
- endpoint 类型：图片为 `image-generation` 或新增异步图片类型；视频为 `openai-video`
- 模型倍率或固定价格
- 分组权限
- 关联 Vidu 渠道能力

### 任务日志

需要增强任务日志结果列：

- 图片任务成功时展示图片预览/打开链接。
- 视频任务成功时保留现有视频内容代理。
- 失败时展示 Vidu `err_code`。
- 管理员可按平台、模型、渠道筛选。

## 实施路线

### 阶段 1：文档与配置基线

产出：

- 本方案文档。
- Vidu 模型映射表。
- 管理员配置样例。
- 计费配置草案。

验收：

- `gpt-image-2 -> viduimage-2` 映射口径明确。
- `nano-banana-2 -> Q3-fast` 映射口径明确。
- 图片首版走任务式异步接入的决策明确。

### 阶段 2：后端图片任务适配

产出：

- Vidu 图片请求转换。
- Vidu 图片提交。
- Vidu 图片任务查询和状态解析。
- 图片任务落库和任务日志数据。
- 基础计费预扣与失败退款。

验收：

- 文生图请求可返回任务 ID。
- 编辑请求可返回任务 ID。
- 参考图生图请求可返回任务 ID。
- 查询任务成功后能拿到图片 URL。
- 失败任务能记录原因并退款。

### 阶段 3：视频适配升级

产出：

- 现有 Vidu 视频 adaptor 补齐当前文档字段。
- 现有视频模型映射更新。
- reference2video 对 `subjects` / `videos` 的支持。

验收：

- 现有 Vidu 视频调用不回归。
- 新参数可通过 metadata 透传。
- 任务查询仍能返回 OpenAI Video 格式。

### 阶段 4：后台与文档体验

产出：

- 渠道配置提示更新。
- 任务日志图片结果展示。
- 帮助文档补充 Vidu / `gpt-image-2` 调用示例。

验收：

- 管理员能按文档完成 Vidu 渠道配置。
- 用户能在任务日志看到图片任务结果。
- API 示例可直接复制验证。

### 阶段 5：回调与生产加固

产出：

- Vidu 回调验签。
- 回调任务状态更新。
- 回调失败轮询兜底。
- 结果 URL 转存方案评估。

验收：

- 合法回调能更新任务。
- 非法签名被拒绝。
- 未收到回调的任务仍能由轮询完成。

## 测试用例规划

### 单元测试

#### 模型映射

| 用例 | 输入 | 预期 |
| --- | --- | --- |
| gpt-image-2 映射 | `model=gpt-image-2` | 上游请求 `model=viduimage-2` |
| nano-banana-2 映射 | `model=nano-banana-2` | 上游请求 `model=Q3-fast` |
| 未配置映射 | `model=unknown-image-model` | 返回模型不可用或无可用渠道 |

#### 图片请求转换

| 用例 | 输入 | 预期 |
| --- | --- | --- |
| 文生图 | prompt，无 images | 请求 `reference2image`，`images=[]` |
| 单图编辑 | prompt，1 张 image | 请求包含 1 张图片 |
| 多参考图 | prompt，2-7 张 images | 请求包含全部图片 |
| 图片超限 | 8 张 images | 本地返回 400 |
| prompt 缺失 | 无 prompt | 本地返回 400 |
| metadata 透传 | metadata 含白名单字段 | 上游请求包含对应字段 |
| metadata 非法字段 | metadata 含未知对象 | 丢弃或返回 400，按实现策略固定 |

#### 状态解析

| 用例 | Vidu 返回 | 预期 |
| --- | --- | --- |
| created | `state=created` | `SUBMITTED` |
| queueing | `state=queueing` | `QUEUED` 或 `SUBMITTED` |
| processing | `state=processing` | `IN_PROGRESS` |
| success | `state=success` 且有 creations | `SUCCESS`，写入 URL |
| failed | `state=failed` 且有 err_code | `FAILURE`，写入失败原因 |
| 未知状态 | `state=paused` | 解析错误并记录上游异常 |

#### 计费

| 用例 | 场景 | 预期 |
| --- | --- | --- |
| 提交预扣 | 正常提交 | 用户额度减少预估值 |
| 成功校准 | 完成 credits 高于预估 | 补扣差额 |
| 成功返还 | 完成 credits 低于预估 | 返还差额 |
| 失败退款 | 任务失败 | 返还预扣额度 |
| 重复轮询 | 已终态任务再次轮询 | 不重复扣费或退款 |

### 集成测试

#### 渠道选择

- Vidu 渠道配置 `models=gpt-image-2`，mapping 为 `gpt-image-2 -> viduimage-2`。
- 用户请求 `gpt-image-2` 时命中 Vidu 渠道。
- 用户分组无权限时返回模型不可用。
- 多 Vidu 渠道存在时按优先级/权重选择。

#### 图片任务

- `POST /v1/images/generations` 提交 `gpt-image-2` 文生图。
- `POST /v1/images/edits` 提交 `gpt-image-2` 图片编辑。
- 参考图生图使用 `images` 数组提交。
- 任务写入 `tasks` 表，platform 或 channel type 可识别为 Vidu。
- `GET /api/task/self` 能查询到任务。
- 任务完成后任务日志显示图片 URL。

#### 视频任务回归

- `POST /v1/videos` 文生视频仍能提交。
- `POST /v1/videos` 单图图生视频仍能提交。
- `POST /v1/videos` 两图首尾帧仍能提交。
- `POST /v1/videos` 多图参考生视频仍能提交。
- `GET /v1/videos/{task_id}` 返回 OpenAI Video 格式。
- `GET /v1/videos/{task_id}/content` 能代理成功视频内容。

### 回调测试

| 用例 | 输入 | 预期 |
| --- | --- | --- |
| 合法签名 | 正确 HMAC 头 | 更新任务状态 |
| 错误签名 | 篡改 body 或签名 | 返回 401/403 |
| 重放请求 | nonce 重复 | 拒绝或忽略 |
| 未知 task_id | 合法签名但任务不存在 | 返回可审计错误 |
| 回调先于轮询 | 回调已完成，轮询随后执行 | 不重复结算 |

### 手工验收

1. 管理员新增 Vidu 渠道，选择 Vidu 类型。
2. 填写 Vidu token，不带 `Token ` 前缀。
3. 配置模型 `gpt-image-2`，映射到 `viduimage-2`。
4. 配置模型 `nano-banana-2`，映射到 `Q3-fast`。
5. 给测试用户分组开放模型权限。
6. 用 API 提交文生图任务。
7. 用 API 提交图片编辑任务。
8. 用 API 提交参考图生图任务。
9. 在任务日志确认任务状态、渠道、模型、结果 URL、扣费记录。
10. 人工触发失败请求，确认错误信息和退款。

## 工期评估

### 最低可用版

预计 3-4 个工作日。

范围：

- Vidu 图片任务适配。
- `gpt-image-2` / `nano-banana-2` 模型映射。
- 任务提交、查询、失败退款。
- 基础任务日志展示。
- 核心单元测试和集成测试。

### 完整生产版

预计 6-8 个工作日。

增加范围：

- OpenAI Images API 短轮询兼容策略。
- multipart 图片编辑完整兼容。
- Vidu 视频当前文档字段补齐。
- 回调验签。
- 图片结果预览增强。
- 生产级计费校准和审计日志。

## 风险与约束

- `gpt-image-2`、`nano-banana-2` 是平台对外模型名，Vidu 上游实际使用 `viduimage-2`、`Q3-fast`，所有日志和计费必须明确区分。
- Vidu 图片和视频均为异步任务，强行同步兼容会增加超时和重复提交风险。
- Vidu 结果 URL 有有效期，长期可访问需要对象存储转存。
- 官方文档更新频繁，上线前需要再次核对模型、字段、credits 口径。
- Vidu 现有通道测试被后端列为不支持，验收应使用真实任务提交，不使用普通渠道测试按钮。
- 当前仓库存在大量未提交改动，实施时应在干净分支或独立 worktree 中完成，避免混入无关变更。

## 推荐上线顺序

1. 先上线任务式 `gpt-image-2` 图片能力。
2. 再升级 Vidu 视频字段和模型映射。
3. 再补图片结果展示体验。
4. 最后接入回调验签和结果转存。

这个顺序能先覆盖合作范围的最低商业可用能力，同时把兼容层和展示层的风险后置。
