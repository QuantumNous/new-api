# yk-video（KYY model-center）异步视频渠道设计

日期：2026-08-12  
状态：已确认设计；实现计划见 `docs/superpowers/specs/2026-08-12-yk-video-channel-plan.md`（已实现）

## 1. 背景与目标

将 KYY（`zcbservice.aizfw.cn` / `kyyReactApiServer`）的 **Model Center** 异步视频 API 接入 new-api，渠道名 **`yk-video`**。

上游提供两个模型：

| 对外逻辑模型 | 上游 model |
|--------------|------------|
| `seedance2.0-yk-933` | `videos_933_c1`（Seedance 2.0 特殊模型） |
| `seedance2.0-ykst-933` | `videos_stable` |

客户端也可直接传上游原名；适配器原样透传未知模型名（不强制改写）。

### 已确认产品决策

| 项 | 决策 |
|----|------|
| 接入方案 | 独立渠道类型（方案 1），不扩 `th12345ai`、不用 Custom 透传 |
| 对外入口 | `POST/GET /v1/video/generations`（对齐 th12345ai / 83zi / mao） |
| 计费 | **按次**（per-task）；单价由后台模型倍率配置 |
| 火山原生格式 | **支持**：仿 83zi / mao，检测 `content[]` 并规范化 |
| remix / 取消 / 余额 / 素材库 | 首版不做 |

## 2. 上游 API 摘要

- Base URL：`https://zcbservice.aizfw.cn/kyyReactApiServer`
- 鉴权：`Authorization: Bearer <API_KEY>`
- Content-Type：`application/json`

| 接口 | 方法 | 路径 |
|------|------|------|
| 创建任务 | POST | `/v2/model-center/tasks` |
| 查询任务 | GET | `/v2/model-center/tasks/{id}` |

### 2.1 创建请求（示例字段）

两模型共用创建路径；字段按模型能力选用。

**`videos_933_c1` 典型字段：**

- `model`、`prompt`
- `reference_images` / `reference_videos` / `reference_audios`（URL 数组）
- `duration`、`aspect_ratio`、`resolution`
- `face_processing`、`generate_audio`、`reference_mode`

**`videos_stable` 额外/兼容字段：**

- `first_image` / `last_image`
- `start_image_url` / `end_image_url`
- `async`、`audio_reference`、`video_reference`

### 2.2 查询响应（完成样例）

```json
{
  "id": "mcp_example_123456",
  "object": "video",
  "created": 1774836724,
  "model": "videos_stable",
  "status": "completed",
  "progress": 100,
  "result_url": "https://example.com/result.mp4",
  "video_url": "https://example.com/result.mp4",
  "amount": 0.32,
  "actualDuration": 5,
  "error": null
}
```

状态流：`queued` → `processing` → `completed` | `failed`。  
成片优先读 `video_url`，其次 `result_url`。失败读 `error`（string 或对象 message）。

## 3. 接入方案

新增 **`ChannelTypeYkVideo = 69`**，名称 `yk-video`。

| 项 | 值 |
|----|-----|
| 包 | `relay/channel/task/ykvideo/` |
| 注册 | `relay/relay_adaptor.go` → `GetTaskAdaptor` |
| 默认 Base URL | `https://zcbservice.aizfw.cn/kyyReactApiServer` |
| Base URL 归一 | 去掉尾部 `/v2/model-center/tasks`、`/v2/model-center`、`/v2` 等后缀，避免路径重复 |
| 计费基类 | `taskcommon.BaseBilling`（按次；不走 per-second） |

不修改 `th12345ai` / `83zi` / `mao` 等现有渠道行为。

参考实现：

- 异步任务骨架：`relay/channel/task/th12345ai/`
- 火山 `content[]` 规范化：`relay/channel/task/sd283zi/volc_normalize.go`、`mao/volc_normalize.go`（含 `role=first_frame|last_frame`）

## 4. 请求映射（客户端 → 上游）

上游请求固定为 **JSON** + Bearer。

| 客户端字段 | 上游字段 | 规则 |
|------------|----------|------|
| `model`（映射后） | `model` | 见 §1 映射表；未知名透传 |
| `prompt` | `prompt` | 透传 |
| `duration` / `seconds` | `duration` | 优先显式 `duration`，否则解析 `seconds` |
| `aspect_ratio` / `ratio` | `aspect_ratio` | 已有 `aspect_ratio` 不覆盖；可用 `ratio` 回填 |
| `resolution` / `size`（如 `720p`） | `resolution` | 归一小写 `720p`/`1080p` 等 |
| `images` / `image` / `reference_images` | `reference_images` | URL 数组 |
| `reference_videos` / `videos` | `reference_videos` | 透传 |
| `reference_audios` / `audios` | `reference_audios` | 透传 |
| `first_image` / `last_image` | 同名 | 透传 |
| `start_image_url` / `end_image_url` | 同名 | 透传 |
| `face_processing` / `generate_audio` / `reference_mode` / `audio_reference` / `video_reference` / `async` | 同名 | 有则透传 |
| `metadata.*` | 合并进 body | 不覆盖已显式设置的顶层字段 |

不支持 remix：若 `Action=remix`，本地返回 `not_supported`。

## 5. 火山官方 `content[]` 规范化（仿 83zi）

### 判定

原始 JSON 存在非空 `content` 数组，且至少一项 `type` ∈：

- `text`
- `image_url`
- `video_url`
- `audio_url`

否则不做任何转换。

### 映射

| 火山官方 | yk-video 上游 |
|----------|----------------|
| `content[].type=text` → `text`（多段 `\n` 拼接） | `prompt`（仅当原 `prompt` 为空） |
| `image_url.url`，`role=first_frame` | `first_image` |
| `image_url.url`，`role=last_frame` | `last_image` |
| 其余 `image_url.url`（含 `reference_image` / 空 role） | `reference_images[]` |
| `video_url.url` | `reference_videos[]` |
| `audio_url.url` | `reference_audios[]` |
| 顶层 `ratio` / `aspect_ratio` | `aspect_ratio` |
| 顶层 `resolution` / `duration` | 同名透传 |
| 顶层 `generate_audio` | 透传；缺省 **true** |
| 顶层 `watermark` | 不强制发给上游（KYY 示例无此字段）；可忽略 |

命中时日志（不打印完整 URL / prompt）：

```
[yk-video] detected VolcEngine official content format; model=<origin> images=N videos=N audios=N first_frame=t/f last_frame=t/f
```

错误处理：

- 命中但无可用 text/媒体：不硬失败，交给现有逻辑 / 上游
- `content` 项缺 URL：跳过该项
- 非火山格式：完全不碰
- 不处理 multipart 火山格式（官方为 JSON `content[]`）

## 6. 响应与状态映射

| 上游 `status` | 内部 TaskStatus | 对外 OpenAI `status` |
|---------------|-----------------|----------------------|
| `queued` | Queued | `queued` |
| `processing` | InProgress | `in_progress` |
| `completed` + 成片 URL | Success | `completed` |
| `failed`（及 error 类） | Failure | `failed` |

| 上游 | 对外 / 内部 |
|------|-------------|
| `video_url` / `result_url` | 任务 `Url`；OpenAI Video `metadata.url`（优先 `video_url`） |
| `progress`（数字） | `"N%"`；缺省 queued≈10%、processing≈50% |
| `error` | Failure `Reason` / OpenAI `error.message` |

创建成功：对客户端返回 200 + OpenAI Video（`queued`），本地保存上游任务 `id`。

成片为公开 URL；本渠道 **不** 做本地 `/content` 鉴权代理。

## 7. 前端注册

default + classic 同步：

| 位置 | 内容 |
|------|------|
| type | `69`，显示名 `yk-video` |
| 默认 Base URL | `https://zcbservice.aizfw.cn/kyyReactApiServer` |
| 默认模型列表 | `seedance2.0-yk-933`、`seedance2.0-ykst-933` |
| Key 提示 | Bearer token（KYY / yk-video API Key） |
| 渠道说明 | 异步视频；创建 `POST /v2/model-center/tasks`，查询 `GET .../tasks/{id}`；支持火山 `content[]`；按次计费 |

可选：`seedance-debug.html` 增加两个 model profile（可与主实现同批）。

涉及文件（实现时）：

- `constant/channel.go`、`constant/channel_base_url_test.go`
- `relay/relay_adaptor.go`
- `relay/channel/task/ykvideo/`（adaptor、constants、volc_normalize、tests）
- `web/default`：`constants.ts`、`channel-utils.ts`、`channel-type-config.ts`、mutate drawer 如需
- `web/classic`：`channel.constants.js`、`EditChannelModal.jsx`、i18n 渠道说明、`lobe-icons.jsx`

## 8. 非目标

- 不接入 KYY Seedance 素材库 / 真人认证 API
- 不对接渠道积分余额 / `amount` 对账
- 不支持 remix、上游取消 DELETE
- 不改其他视频渠道行为
- 文档与代码不落真实卡密

## 9. 测试要点

1. 模型别名：`seedance2.0-yk-933`→`videos_933_c1`；`seedance2.0-ykst-933`→`videos_stable`；上游原名直传
2. 扁平字段透传：`reference_*`、`first_image`/`last_image`、`face_processing`、`generate_audio` 等
3. 火山 `content[]` → prompt / `reference_*`；`role=first_frame|last_frame` → `first_image`/`last_image`
4. 非火山格式不触发转换
5. 查询：`completed`+URL → success；`failed`+error → failure；`progress` → `"N%"`
6. Base URL 归一：带 `/v2/model-center/tasks` 后缀时不产生双路径
7. remix → 本地 `not_supported`
