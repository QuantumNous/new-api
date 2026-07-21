# th12345ai 异步视频渠道设计

日期：2026-07-20  
状态：已实测上游，按 7tai 模式接入

## 1. 上游实测结论

Base URL：`https://sd.12345ai.net`  
鉴权：`Authorization: Bearer LD-...`

| 接口 | 方法 | 路径 |
|------|------|------|
| 创建任务 | POST | `/api/tasks` |
| 查询任务 | GET | `/api/tasks/{id}` |
| 模型列表 | GET | `/api/models` |
| 健康检查 | GET | `/api/health` |

### 创建请求（实测）

```json
{
  "kind": "video",
  "model": "videos_stable",
  "prompt": "...",
  "ratio": "9:16",
  "resolution": "720p",
  "duration": 5,
  "referenceImages": ["https://...png"]
}
```

可选：`referenceVideos[]`、`referenceAudios[]`。

### 创建响应

- 任务 ID：`id`（UUID）
- 初始状态：`queued`
- 计费：`estimatedCost`（按次，`billingUnit=task`）

### 查询响应状态机

`queued` → `processing` → `succeeded` | `failed`

成功时成片在 `video_url`；失败原因在 `errorMessage`。

实测样例（图生视频）：约 7 分钟完成，`status=succeeded`，返回 OSS `video_url`。

### 上游模型（GET /api/models）

| code | 单价 | 计费 | duration |
|------|------|------|----------|
| `videos_stable` | 35/次 | task | 4–15 |
| `videos_stable_fast` | 30/次 | task | 10, 15 |

## 2. 接入方案（选定）

新增渠道类型 **`ChannelTypeTh12345ai = 64`**，名称 `th12345ai`。

- 包路径：`relay/channel/task/th12345ai/`
- 对齐现有 `task7tai` 异步视频适配器模式
- 对外统一接口仍为平台视频 generations（提交 + 轮询）
- 上游映射：

| 平台字段 | 上游字段 |
|----------|----------|
| model（映射后） | `model`（默认 `videos_stable`） |
| prompt | `prompt` |
| ratio / aspect_ratio | `ratio` |
| resolution / size | `resolution`（小写 `720p`） |
| duration / seconds | `duration` |
| images[] | `referenceImages` |
| metadata.referenceVideos / videos | `referenceVideos` |
| metadata.referenceAudios / audios | `referenceAudios` |
| （固定） | `kind: "video"` |

计费：按次（不走 per-second）；预扣由模型倍率配置决定。

## 3. 非目标

- 不接入素材组 / 真人认证 API
- 不复用 83zi / 7tai 渠道类型
- 文档与代码中不落真实卡密

## 4. 前端

default + classic 同步注册 type=64，默认 Base URL `https://sd.12345ai.net`。

对外模型（建议渠道模型重定向）：

| 对外 | 上游 |
|------|------|
| `sd2-431` | `videos_stable` |
| `sd2-fast-431` | `videos_stable_fast` |

调试页 `/seedance-debug.html` 已加入上述两个模型 profile（family=`th12345ai`，路径 `/v1/video/generations`）。
