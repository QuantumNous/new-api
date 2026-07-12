# 83zi 渠道接受火山官方视频格式并规范化设计

日期：2026-07-12  
状态：已确认并实现

## 目标

让 **83zi 渠道（类型 62）** 在收到火山官方视频请求格式（`content[]`）时，自动转换成 83zi / mingiz-sd2 上游提交格式，并输出一条检测日志。

## 范围

### 做

- 仅改 `relay/channel/task/sd283zi/`
- JSON 请求路径：检测 → 日志 → 规范化 → 现有 `convertCreatePayload`
- 83zi 下全部模型（`mingiz-sd2` / `sd2` / `sd2fast` 等）均生效
- 完整映射 `text` / `image_url` / `video_url` / `audio_url`
- `generate_audio` 缺省 `true`，`watermark` 缺省 `false`

### 不做

- 不改 Doubao / VolcEngine 渠道适配器
- 不改公共 `TaskSubmitReq` 解析层
- 不处理 multipart（火山官方为 JSON `content[]`）
- 不透传 `seed` / `camera_fixed` / `return_last_frame` 等专有字段

## 架构与数据流

```
客户端 JSON
  → GetTaskRequest
  → detectAndNormalizeVolcOfficial（仅 83zi）
       命中：SysLog + 写入 prompt/images + 媒体 URL 等
  → convertCreatePayload（现有）
  → POST /api/generate-video
```

新增文件：`relay/channel/task/sd283zi/volc_normalize.go`  
测试：`relay/channel/task/sd283zi/volc_normalize_test.go`

## 判定条件

原始 JSON 存在非空 `content` 数组，且至少一项 `type` 为：

- `text`
- `image_url`
- `video_url`
- `audio_url`

否则不做任何转换。

## 字段映射

| 火山官方 | 83zi / mingiz 提交字段 |
|----------|------------------------|
| `content[].type=text` → `text`（多段 `\n` 拼接） | `prompt`（仅当原 `prompt` 为空时写入） |
| `content[].type=image_url` → `image_url.url` | `image_urls[{url,file_name,content_type}]` |
| `content[].type=video_url` → `video_url.url` | `reference_video_urls[]` |
| `content[].type=audio_url` → `audio_url.url` | `audio_urls[]` |
| 顶层 `ratio` / `aspect_ratio` | `ratio`（已由现有逻辑处理） |
| 顶层 `resolution` | `resolution` |
| 顶层 `duration` | `duration` |
| 顶层 `generate_audio` | `generate_audio`；缺省 `true` |
| 顶层 `watermark` | `watermark`；缺省 `false` |
| 顶层 `resolution` | 仅保留 `720p` / `1080p`；`480p` 等强制改为 `720p`；火山格式缺省时补 `720p` |

模型名不改，仍走 `resolveUpstreamModel`。

> 上游「9图 API」清晰度只支持 720p/1080p；火山客户端常传 480p，转换时自动纠正。

## 日志

检测到时：

```
[83zi] detected VolcEngine official content format, converting to 83zi payload; model=<origin> images=N videos=N audios=N
```

不打印完整 URL / prompt。

## 错误处理

- 命中但无可用 text/媒体：不硬失败，交给现有逻辑 / 上游
- `content` 项缺 URL：跳过该项
- 非火山格式：完全不碰

## 测试要点

1. 纯 mingiz 格式 → 不转换
2. 典型火山 `content[]`（text + image_url）→ prompt / image_urls
3. video_url / audio_url → reference_video_urls / audio_urls
4. generate_audio / watermark 缺省 true / false
5. 非官方 type 的 content → 不触发转换
