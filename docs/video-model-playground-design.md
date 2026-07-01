# 视频模型（文生视频）页面设计文档

> 适用前端：`web/classic`（React 18 + Vite + Semi Design）
> 关联入口：左侧栏「体验区域 / 爱芯AI智能助手」下的「视频模型」页签
> 状态：设计稿，待评审确认后再实现

本设计与已完成的「图片模型」共用大量模式（三栏布局、对话历史、按对话聚合、生成即锁定参数、管理员声明模型等），下文重点说明**与图片不同**之处。

## 1. 与图片模型的关键差异

| 维度 | 图片模型 | 视频模型 |
|------|---------|---------|
| 生成方式 | 准同步：一次请求拿到结果 | **异步任务**：提交→轮询→取内容 |
| 返回形态 | url 或 base64 | **只有 url**（走我方内容代理端点），**无 base64** |
| 后端链路 | `Relay`（RelayFormatOpenAIImage） | **`RelayTask`/`RelayTaskFetch`**（任务系统） |
| 结果展示 | `<img>` + 预览翻转缩放 | **`<video>` 播放器** + 下载 |
| 额外参数 | 尺寸 | 尺寸 + **时长(seconds)**（按供应商） |

## 2. 后端：异步任务流 + 会话鉴权（核心待决策点）

OpenAI 兼容视频接口（`dto/openai_video.go`）：

1. **创建**：`POST /v1/videos` → `controller.RelayTask` → 返回 `OpenAIVideo{ id, status:"queued", progress, model, size, seconds }`。
2. **轮询**：`GET /v1/videos/:task_id` → `controller.RelayTaskFetch` → `status: queued → in_progress → completed/failed`，带 `progress`。
3. **取内容**：`GET /v1/videos/:task_id/content` → `controller.VideoProxy` → 视频字节流。

现状鉴权：
- 内容端点 `/v1/videos/:task_id/content` 已用 **`TokenOrUserAuth`**（**已支持会话鉴权**）→ 仪表盘可直接用。
- 但**创建/轮询**（`/v1/videos`、`/v1/videos/:id`）是 **`TokenAuth`（API key）+ Distribute**，**没有会话鉴权路径**（不像 chat 有 `/pg/chat/completions`）。

### 方案（建议）：新增 `/pg` 会话鉴权视频路由

- `POST /pg/videos` → 新 `controller.PlaygroundVideo`（仿 `PlaygroundImage`：为登录用户签发临时 token → `RelayTask`）。
- `GET /pg/videos/:task_id` → 新 `controller.PlaygroundVideoFetch`（临时 token → `RelayTaskFetch`）。
- 内容：直接复用 `GET /v1/videos/:task_id/content`（已支持会话鉴权）。
- **需要的小改动**：
  - `RelayMode`/任务路径识别：`relay/relay_task.go` 里用 `strings.HasPrefix(path, "/v1/videos/")` 判定 OpenAI 视频 API，需要同时接受 `/pg/videos/`（与图片那次 `relay_mode.go` 放宽 `/pg/` 同理）。
  - `distributor` 已对 `/pg/` 前缀生效 body `group`（图片那次已改），视频复用。

> **待你决策**：是走「新增 `/pg/videos` + `/pg/videos/:id`」（推荐，和图片一致、最干净），还是「给现有 `/v1/videos` 创建/轮询也加 `TokenOrUserAuth`」（改动小但动了公共 API 鉴权，不推荐）。

## 3. 视频模型 / 分组的能力过滤

诉求：视频页**只显示有视频能力的模型与分组**。

- 能力判定：`/api/pricing` 的 `supported_endpoint_types` 含 **`openai-video`**（`constant/endpoint_type.go`）。
- **但**：后端 `GetEndpointTypesByChannelType` 目前只有 `ChannelTypeSora` → `openai-video`；任务型视频渠道（Kling/Jimeng/Hailuo 等）**未被打上视频端点类型**（代码里相关 case 是注释掉的）。所以你的视频模型很可能后端识别不到——**和图片的 z-image 同样的问题**。
- **沿用图片的方案**：视频模型集合 = 后端识别(`openai-video`) **∪ 管理员在「视频模型配置」里声明的模型**。分组过滤同图片（取这些模型的 `enable_groups` 并集、含哨兵 `"all"` 时放行所有分组）。
- 新增运营设置「**视频模型配置**」：声明视频模型 + 每模型可选**尺寸**与**时长**（参考图片的「图片模型尺寸配置」）。

## 4. 文本模型也要按能力过滤（本次一并做）

诉求：文本模型页**只显示有文本能力的模型与分组**。

- 现状：文本操练场（Playground）**不按能力过滤**，所有模型都列；选到图片/视频/embedding 模型时只弹 `UnsupportedModelModal` 提示。
- 改法：复用已有的 `helpers/playground.js` 的 `isPlaygroundSupported(model, modelEndpointTypes)`（它在模型 `supported_endpoint_types` 命中 `PLAYGROUND_UNSUPPORTED_ENDPOINTS`（image-generation / openai-video / embeddings / jina-rerank）时返回 false）。
  - 模型下拉：仅保留 `isPlaygroundSupported(m) === true` 的模型。
  - 分组下拉：仅保留含至少一个文本模型的分组（同图片的分组过滤套路，含 `"all"` 放行）。
- **注意**：图片模型的 `supported_endpoint_types` 通常是 `["image-generation","openai"]`（后端默认会补 `openai`），所以文本过滤必须用「**排除** image/video/embedding/rerank」而不是「**包含** openai」，否则图片模型会混进文本页。`isPlaygroundSupported` 正是排除式，符合要求。
- 三页过滤口径统一汇总：
  - 文本：`isPlaygroundSupported`（排除式）
  - 图片：含 `image-generation`
  - 视频：含 `openai-video`（∪ 管理员声明）

## 5. 前端页面（沿用图片三栏 + 异步播放器）

- 顶部标签：**文生视频**（本期）；**图生视频** 预留置灰（Kling 等支持 image2video，后续再做）。
- 左「模型配置」：分组 / 模型（按上面过滤）/ 尺寸 /（可选）时长。
- 中对话区：用户提示词气泡 + 助手结果。结果为 `<video controls>` 播放器 + 下载/重新生成。
- **生成中进度展示**（参考多阶段 stepper，但精简为 3 步）：
  - 阶段：**① 排队中 → ② 生成中 → ③ 完成**（`status: queued/in_progress/completed` 直接映射，不做 6 段那么细）。
  - 进度条 + **百分比**：用轮询返回的 `progress`（如「生成中 30%」）；供应商不返回 progress 时退化为 loading 动画（不显示百分比）。
  - **「停止任务」按钮**：点击停止前端轮询、把该次标记为「已取消」（后端若支持取消任务则一并调用；不支持则仅停止轮询）。
- 右「对话历史」：按对话聚合（同图片）；条目显示模型、提示词、状态（排队/生成中 N%/已完成/失败/已取消）、时间。
- **轮询**：提交后拿到 `task_id`，前端定时 `GET /pg/videos/:task_id`（建议 4s 间隔，带最大次数/时长上限），`completed` 后用 `/v1/videos/:id/content` 作为 `<video src>`；`failed`/超时显示错误。
- **历史持久化**：localStorage。**视频本身不进 localStorage**（只存 `task_id` / 内容 URL + 元信息）——视频天然是 URL（内容端点），不存在 base64 撑爆的问题，这点比图片简单。
  - 注意：内容 URL 指向我方 `/v1/videos/:id/content`，刷新后只要任务未过期仍可播放；过期则提示重新生成。

## 6. 沿用图片的产品规则

- 生成即锁定分组/模型/尺寸（到「新对话」解锁）。
- 历史按对话聚合，点开恢复整段 + 带出参数。
- 对话段数上限、单段对话次数上限（沿用常量）。
- 显示/隐藏：侧边栏模块开关 `chat.video`，默认隐藏。

## 7. 涉及文件（预估）

后端：
- `controller/playground.go`：`PlaygroundVideo` / `PlaygroundVideoFetch`（复用 `playgroundRelay` 思路，但走 `RelayTask`/`RelayTaskFetch`）。
- `router/relay-router.go`（或 video-router）：`POST /pg/videos`、`GET /pg/videos/:task_id`。
- `relay/relay_task.go`：OpenAI 视频路径识别放宽到 `/pg/videos/`。
- `controller/misc.go`：`/api/status` 暴露 `VideoModelConfig`。

前端：
- `pages/Video/index.jsx`（替换占位页）+ `components/videoPlayground/*`（配置面板 / 对话区+播放器 / 历史）。
- `hooks/videoPlayground/useVideoGeneration.js`（数据加载+能力过滤+提交+轮询+历史）。
- `constants/videoPlayground.constants.js`。
- 运营设置「视频模型配置」：`pages/Setting/Operation/SettingsVideoModels.jsx` + 接入 `OperationSetting.jsx`。
- **文本模型过滤**：改 `hooks/playground/useDataLoader.js`（模型/分组按 `isPlaygroundSupported` 过滤）。

## 8. 已确认决策 / 待补

已确认：
1. **会话鉴权**：新增 `/pg/videos` + `/pg/videos/:task_id`（会话鉴权），内容端点复用现有 `/v1/videos/:id/content`；任务路径识别放宽到 `/pg/videos/`。
2. **本期范围**：只做**文生视频(text2video)**；图生视频标签预留置灰。
3. **时长(seconds)**：做，按模型配置（和尺寸同一套「视频模型配置」）。
4. **文本模型过滤**：把不支持的模型（图片/视频/embedding/rerank）**从下拉直接隐藏**（用 `isPlaygroundSupported` 排除式过滤），分组同理。
5. **视频模型识别**：管理员在「视频模型配置」里声明（∪ 后端 `openai-video`）。

待补（实现时按合理默认处理，可随时调整）：
- **轮询参数**：建议每 4s 轮询一次、最长约 5 分钟（~75 次）后超时提示「生成超时，请稍后在历史中重试」。
- **视频模型清单**：由你在「视频模型配置」里填实际模型名 + 各自尺寸/时长选项（实现不依赖具体名字）。
