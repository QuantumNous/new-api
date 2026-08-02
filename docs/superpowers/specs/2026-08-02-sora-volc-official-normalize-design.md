# Sora 渠道接受火山官方视频格式并规范化设计

日期：2026-08-02  
状态：已确认

## 目标

让 **Sora / OpenAI 视频渠道（类型 55 / 1）** 在收到火山官方视频请求格式（`content[]`）时，自动转换成 OpenAI Videos 风格字段（`prompt` / `images` / `videos` / `audios` 等），再转发到上游 `/v1/videos`。

## 范围

### 做

- 仅改 `relay/channel/task/sora/`
- JSON 请求路径：检测 → 日志 → 规范化 → 现有 face-pass / duration 同步
- 完整映射 `text` / `image_url` / `video_url` / `audio_url`
- 视频/音频同时写数组字段与单字段（兼容）
- `generate_audio` 缺省 `true`，`watermark` 缺省 `false`

### 不做

- 不改 Doubao / 83zi / 7tai 适配器
- 不处理 multipart
- 不透传 `seed` / `camera_fixed` / `return_last_frame` 等专有字段

## 字段映射

| 火山官方 | 上游 OpenAI Videos 字段 |
|----------|-------------------------|
| `content[].type=text` | `prompt`（原 prompt 为空时写入） |
| `content[].type=image_url` | `images[]` + `image`（首张） |
| `content[].type=video_url` | `videos[]` + `video_url`（首条） |
| `content[].type=audio_url` | `audios[]` + `audio_url`（首条） |
| 顶层 `duration` / `ratio` / `resolution` | 保留 |
| 顶层 `generate_audio` / `watermark` | 保留；缺省 true / false |
| `content` | 转换后删除 |

## 判定

原始 JSON 存在非空 `content` 数组，且至少一项 `type` 为 `text` / `image_url` / `video_url` / `audio_url`。
