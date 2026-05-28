# AI 聚合站 / LK888 视频渠道接入文档

最后更新：2026-05-28

> **2026-05-28 状态**：`grok-video-3` 今天上游 LK888 返回"参数验证失败"，2026-05-24 曾验证可用，疑似上游临时问题。建议上游当前改用 `grok-imagine-1.0-video`（937qq/Qilin 链路，已验证可用）。详情见 [api-usage.md](./api-usage.md)。

本文档描述通过本项目统一 OpenAI Video 入口调用 AI 聚合站（LK888）的视频模型。当前只接入并暴露 Sora 与 Grok 两个模型，其他视频模型已完成能力发现，但暂不注册到生产渠道。

## 快速结论

| 项目 | 值 |
|------|-----|
| 本项目入口 | `POST /v1/videos`、`GET /v1/videos/{task_id}` |
| 渠道类型 | `58` / OpenAI Video |
| 渠道名 | `ai-juhe-lk888` |
| 下游 Base URL | `https://api.lk888.ai/api` |
| 下游认证 | `Authorization: Bearer <channel key>` |
| 下游创建任务 | `POST /v1/media/generate` |
| 下游查询任务 | `GET /v1/skills/task-status?task_id={task_id}` |
| 当前暴露模型 | `sora-2`、`grok-video-3` |

## 已启用模型

| 模型 | 能力 | 关键参数 | 当前用途 |
|------|------|----------|----------|
| `sora-2` | 文生视频、图生视频 | `duration=4/8/12`，`orientation=portrait/landscape`，`input_reference` | Sora 备用/验证线路 |
| `grok-video-3` | 文生视频、图生视频、首帧参考 | `duration=6/10`，`aspect_ratio=2:3/3:2/1:1`，`size=720P/1080P`，`images` | Grok 视频线路 |

LK888 返回的视频模型总数为 38 个，包含 Seedance、Veo、Kling、Vidu、Wan、PixVerse、HappyHorse、Hailuo 等。当前不注册这些模型，后续需要时再按模型逐个补参数映射、计费和回归记录。

## 请求映射

调用方继续使用本项目 OpenAI Video 风格请求：

```json
{
  "model": "grok-video-3",
  "prompt": "A small red cube rotates slowly on a clean white studio background.",
  "duration": 6,
  "orientation": "landscape"
}
```

LK888 下游要求媒体生成参数放入 `params` 对象。Provider 会自动转换为：

```json
{
  "model": "grok-video-3",
  "prompt": "A small red cube rotates slowly on a clean white studio background.",
  "params": {
    "duration": "6",
    "aspect_ratio": "3:2"
  }
}
```

通用转换规则：

| 调用方字段 | LK888 字段 |
|------------|------------|
| `duration` / `seconds` | `params.duration`，字符串 |
| `orientation=landscape` | Sora: `params.orientation=landscape`；Grok: `params.aspect_ratio=3:2` |
| `orientation=portrait` | Sora: `params.orientation=portrait`；Grok: `params.aspect_ratio=2:3` |
| `aspect_ratio=16:9` / `size=1280x720` | Grok: `params.aspect_ratio=3:2` |
| `aspect_ratio=9:16` / `size=720x1280` | Grok: `params.aspect_ratio=2:3` |
| `images` | `params.images` |
| `image` / `input_reference` / `image_url` | `params.images` |
| `params` | 原样合并，优先级高于顶层兼容字段 |

## Sora 示例

```bash
curl -s "http://192.129.209.36:3001/v1/videos" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "sora-2",
    "prompt": "A calm sunrise over a mountain lake, cinematic, slow camera movement, no text.",
    "duration": 4,
    "orientation": "landscape"
  }'
```

已验证任务：

| 项目 | 值 |
|------|-----|
| 任务 ID | `task_Iqqit0P2UcMJAYNbzyrqcK5OrSKSNSXW` |
| 状态 | `completed` |
| 命中渠道 | `ai-juhe-lk888`，上游任务 ID `26081355` |
| 下载 | `GET /v1/videos/task_Iqqit0P2UcMJAYNbzyrqcK5OrSKSNSXW/content` 返回 `200 OK`，`Content-Type: video/mp4` |

## Grok 示例

```bash
curl -s "http://192.129.209.36:3001/v1/videos" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "grok-video-3",
    "prompt": "A small red cube rotates slowly on a clean white studio background, simple product demo, no text.",
    "duration": 6,
    "orientation": "landscape"
  }'
```

已验证任务：

| 项目 | 值 |
|------|-----|
| 任务 ID | `task_mtkqjxwQRWoherMjTEJx0qfyyCPKSeep` |
| 状态 | `completed` |
| 下载 | `GET /v1/videos/task_mtkqjxwQRWoherMjTEJx0qfyyCPKSeep/content` 返回 `200 OK`，`Content-Type: video/mp4` |

## Sora 路由说明

`sora-2` 与现有 Hongniao 渠道重名。当前远端将 LK888 渠道设置为低优先级备用；生产默认仍优先走现有 Sora 主路径。测试 LK888 Sora 时临时把 LK888 渠道优先级从 `35` 调到 `95`，任务完成后已恢复为 `35`。

## 任务查询与下载

查询：

```bash
curl -s "http://192.129.209.36:3001/v1/videos/$TASK_ID" \
  -H "Authorization: Bearer $API_KEY"
```

完成响应会返回本项目代理地址：

```json
{
  "id": "task_xxx",
  "object": "video",
  "model": "grok-video-3",
  "status": "completed",
  "progress": 100,
  "video_url": "http://192.129.209.36:3001/v1/videos/task_xxx/content"
}
```

下载：

```bash
curl -L "http://192.129.209.36:3001/v1/videos/$TASK_ID/content" \
  -H "Authorization: Bearer $API_KEY" \
  -o output.mp4
```

Provider 会保存 LK888 的真实 `result_url`，对外展示和下载统一走本项目 `/content` 代理，避免调用方直接依赖下游 CDN 地址。

## 实现位置

| 文件 | 说明 |
|------|------|
| `relay/channel/task/openaivideo/lk888.go` | LK888 submit/query/参数归一化 |
| `relay/channel/task/openaivideo/provider.go` | `other=lk888` 或 `api.lk888.ai` 选择 LK888 provider |
| `relay/channel/task/openaivideo/adaptor.go` | LK888 结果 URL 对外转成本项目 `/content` 代理 |
| `relay/channel/task/openaivideo/constants.go` | 当前只新增 `grok-video-3`；`sora-2` 已存在 |

## 注意事项

- 下游能力发现接口：`GET https://api.lk888.ai/api/v1/skills/models?type=video`。
- 下游模型详情接口：`GET /v1/skills/models/{model_name}`，新增模型必须先看参数定义。
- 下游价格接口：`GET /v1/skills/models/{model_name}/pricing?status=active`。
- 付费接口调用前可查余额：`GET /v1/skills/balance`。
- LK888 媒体接口要求模型特定参数放在 `params` 内；不要把未知顶层字段直接透传到下游。
- 上传类参数必须是公网 URL；平台不提供文件上传托管。
