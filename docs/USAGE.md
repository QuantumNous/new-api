# wstar Seedance 2 Fast 视频生成 API

对外模型名：**wstar-seedance-2-fast**

**服务地址（Base URL）**：`https://996k.cn`

---

## 鉴权

请求头需携带 API 密钥：

```
Authorization: Bearer 你的API密钥
Accept: application/json
```

---

## 1. 生成视频（提交任务）

**POST** `https://996k.cn/v1/videos`

请求类型：**multipart/form-data**

### 参数

| 参数 | 必填 | 说明 |
|------|------|------|
| `model` | 是 | 固定填 `wstar-seedance-2-fast` |
| `prompt` | 是 | 视频提示词 |
| `mode` | 否 | `reference_to_video`（参考图生视频）/ `text_to_video`（纯文本） |
| `duration` | 否 | 时长（秒），默认 15 |
| `aspect_ratio` | 否 | `16:9` 横屏 / `9:16` 竖屏 |
| `generate_audio` | 否 | `1` 生成配音 / `0` 不生成 |
| `reference_images` | 否 | 参考图文件，可传多张 |
| `resolution` | 否 | `720p` |

### 请求示例

```bash
curl -X POST "https://996k.cn/v1/videos" \
  -H "Authorization: Bearer 你的API密钥" \
  -H "Accept: application/json" \
  -F "model=wstar-seedance-2-fast" \
  -F "prompt=逃荒穿越到古来还要加班，真倒霉。" \
  -F "mode=reference_to_video" \
  -F "duration=15" \
  -F "generate_audio=1" \
  -F "aspect_ratio=16:9" \
  -F "reference_images=@./man.jpg"
```

### 响应示例

```json
{
  "id": "task_xxxxxxxx",
  "object": "video.generation",
  "model": "wstar-seedance-2-fast",
  "status": "queued"
}
```

请保存返回的 **`id`**（即 `task_id`），用于查询进度。

---

## 2. 查询视频（任务进度）

**GET** `https://996k.cn/v1/videos/{task_id}`

将 `{task_id}` 替换为提交任务时返回的 `id`。

### 请求示例

```bash
curl -H "Authorization: Bearer 你的API密钥" \
  -H "Accept: application/json" \
  "https://996k.cn/v1/videos/task_xxxxxxxx"
```

### 任务状态

| status | 含义 |
|--------|------|
| `queued` | 排队中 |
| `in_progress` | 生成中 |
| `completed` | 已完成 |
| `failed` | 失败 |

- `progress`：进度 0–100
- 完成后，视频地址在 **`metadata.url`**

### 完成响应示例

```json
{
  "id": "task_xxxxxxxx",
  "status": "completed",
  "progress": 100,
  "metadata": {
    "url": "https://example.com/video.mp4"
  }
}
```

---

## 使用建议

| 场景 | 建议参数 |
|------|----------|
| 竖屏短剧 | `aspect_ratio=9:16`，`duration=10~15` |
| 横屏视频 | `aspect_ratio=16:9` |
| 参考图生视频 | `mode=reference_to_video`，上传 `reference_images` |
| 纯文生视频 | `mode=text_to_video`，不传参考图 |

生成通常需要 **1～5 分钟**，请轮询查询接口直至 `status` 为 `completed` 或 `failed`。
