# MegaByAI 异步视频渠道设计

日期：2026-07-20  
状态：已确认设计，待实现

## 1. 上游文档结论

Base URL：`https://newapi.megabyai.cc`  
鉴权：`Authorization: Bearer YOUR_API_KEY`  
协议形态：OpenAI Videos 风格（`/v1/videos`），请求字段为 MegaByAI 扩展（`ratio` / `resolution` / `reference*`）。

| 接口 | 方法 | 路径 |
|------|------|------|
| 查询模型 | GET | `/v1/models` |
| 创建任务 | POST | `/v1/videos` |
| 查询任务 | GET | `/v1/videos/{task_id}` |
| 下载成片 | GET | `/v1/videos/{task_id}/content` |

### 创建请求（文档）

```json
{
  "model": "videos-mini",
  "prompt": "...",
  "duration": 5,
  "ratio": "16:9",
  "resolution": "720p",
  "referenceImages": ["https://...jpg"],
  "referenceVideos": ["https://...mp4"],
  "referenceAudios": ["https://...mp3"]
}
```

约束（文档）：

- `duration`：4–15，默认 5
- `ratio`：`16:9` / `9:16` / `1:1`，默认 `16:9`
- `resolution`：`720p` / `480p`，默认 `720p`
- `referenceImages` 最多 9；`referenceVideos` / `referenceAudios` 各最多 3，总时长各不超过 15 秒
- 不支持 `first_image` / `last_image`；传入应返回不支持错误

### 创建 / 查询响应

- 任务 ID：`id` / `task_id`（形如 `videos-mini_...`）
- 状态机：`queued` → `in_progress` → `completed` | `failed`
- 成功时 `url` / `video_url` / `metadata.content_url` 指向需鉴权的 `/content`
- 失败时 `error.code` + `error.message`
- `metadata.cost_credits` 仅透传，不参与本渠道结算

### 上游模型

| id | 说明 |
|----|------|
| `videos-standard` | Standard async video |
| `videos-fast` | Fast async video |
| `videos-mini` | Mini async video |

## 2. 接入方案（选定）

新增渠道类型 **`ChannelTypeMegabyai = 65`**，名称 `megabyai`。

- 包路径：`relay/channel/task/megabyai/`
- **以 Sora 适配器为底**：路径、轮询、`/content` 鉴权 URL 代理改写、状态解析均对齐 OpenAI Videos
- 对外统一接口仍为平台视频 generations（提交 + 轮询）
- 不复用 / 不修改现有 Sora、豆包、th12345ai 行为

### 请求字段映射（创建前）

| 平台字段 | 上游字段 |
|----------|----------|
| model（映射后） | `model` |
| prompt | `prompt` |
| seconds / duration | `duration`（同时保持 `seconds` 同步，兼容双读上游） |
| ratio / aspect_ratio | `ratio` |
| resolution | `resolution`（规范为小写 `720p` / `480p`） |
| size（如 `1280x720` / `720x1280` / `1024x1024`） | 解析为 `ratio` + `resolution`；已有显式 `ratio`/`resolution` 不覆盖 |
| images[] / image / input_reference | `referenceImages` |
| videos[] | `referenceVideos` |
| audios[] | `referenceAudios` |
| referenceImages / referenceVideos / referenceAudios | 原样保留 |

`size` → `ratio` 约定：

| size | ratio |
|------|-------|
| 宽 > 高（如 `1280x720`） | `16:9` |
| 高 > 宽（如 `720x1280`） | `9:16` |
| 宽 = 高 | `1:1` |

`size` / `resolution` → `resolution`：取较短边或显式 `*p` 字符串，规范到 `720p` / `480p`（无法识别时保留原值或走上游默认）。

### 校验

- 若请求显式包含 `first_image` / `last_image`（含 metadata）：本地返回不支持错误，不转发上游
- 参考素材 URL 必须为公网 `http`/`https`（与文档一致；具体长度上限由上游校验）

### 计费

按次（不走 per-second OtherRatios）；预扣由模型倍率配置决定。  
不对接上游 `cost_credits` 实扣。

### 成片 URL

沿用 Sora：`ConvertToOpenAIVideo` 将鉴权门控的 `/v1/videos/{id}/content` 改写为平台代理 URL。

## 3. 非目标

- 不做 remix（`/v1/videos/{id}/remix`）
- 不改 Sora / 豆包 / th12345ai 现有渠道
- 不接入上游 credits 结算
- 文档与代码中不落真实卡密

## 4. 代码落点

| 区域 | 变更 |
|------|------|
| `relay/channel/task/megabyai/` | 新适配器 + constants + 映射/解析单测 |
| `constant/channel.go` | type=65、名称、默认 Base URL |
| `relay/relay_adaptor.go` | 注册 TaskAdaptor |
| `web/default`（及 classic 对应表） | 渠道类型名、默认 URL、key 提示文案 |

建议对外模型（渠道模型重定向，可按运营调整）：

| 对外（示例） | 上游 |
|--------------|------|
| 保持上游名或自定义别名 | `videos-standard` / `videos-fast` / `videos-mini` |

## 5. 测试计划

- 单元：`size`→`ratio`/`resolution`；`images`→`referenceImages`；`seconds`↔`duration`；首尾帧拒绝；状态机解析；content URL 识别与改写
- 联调：文生、图+音频参考、轮询至 `completed`、经代理下载 MP4
