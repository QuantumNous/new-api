# Grok 视频生成 API 调用文档

最后更新：2026-06-06

> **2026-05-28 回归验证**：`grok-imagine-1.0-video` 重新通过真实验证（task `task_0N4mwgTkQS8mlV8iYiTa1D385u2o2CRf`，产出 3.8MB MP4）。注意该模型**仅支持以下尺寸**：`720x1280`、`1280x720`、`1024x1024`、`1024x1792`、`1792x1024`，传入 `1920x1080` 会报错。`grok-imagine-1.0-video-20s` 今天返回 `model_not_found`（渠道未注册该模型）。

本文档主要描述通过本服务调用 937qq / Qilin 的 Grok 视频模型。调用方使用统一的 OpenAI Video 兼容入口，不需要知道 937qq / Qilin 的令牌、接口地址或私有字段。

## 快速结论

生产调用时按下面规则传参：

| 目标 | 推荐写法 |
|------|----------|
| 创建视频 | `POST /v1/videos`，JSON 请求体 |
| 参考图 | 传 `images: ["https://..."]`，保持数组 |
| 本地参考图 | 优先上传成公网 PNG URL；小图可传 `data:image/...;base64,...` |
| 时长 | 支持 `6`、`10`、`15`、`20`、`30` 秒；20/30 秒会自动映射到长时长传输模型 |
| 竖屏 | `aspect_ratio: "9:16"` 或 `size: "720x1280"` |
| 横屏 | `aspect_ratio: "16:9"` 或 `size: "1280x720"` |
| 方形 | `aspect_ratio: "1:1"` 或 `size: "1024x1024"` |
| 人物参考图 | Prompt 必须显式复述人物视觉特征，并排除错误身份 |
| 医生参考图 | 不要用 `him` / `his` 描述医生；如果参考图是女性，要写 `same elderly woman doctor` |

本服务会自动把上游的 `images` 转成 Qilin/Grok 下游更偏好的 `image_reference`。调用方不要直接依赖 `image_reference`，除非是在做供应商级排查。

AI 聚合站 / LK888 也已接入 `grok-video-3`，该线路使用 `/v1/media/generate` 和 `/v1/skills/task-status`，与 Qilin 的 `grok-imagine-*` 不是同一个下游协议。LK888 Grok 的调用、参数映射和已验证任务见 [AI 聚合站 / LK888 视频渠道接入文档](./lk888-video-api.md)。

## 连接信息

| 项目 | 值 |
|------|-----|
| Base URL | `http://192.129.209.36:3001/v1` |
| 模型 | `grok-imagine-1.0-video`、`grok-imagine-1.0-video-20s`、`grok-imagine-1.0-video-30s` |
| 认证方式 | HTTP Header `Authorization: Bearer <api-key>` |
| 内部测试 API Key | `EW93ybOP6Zr1axAPYNEu8VpehQzdTkZBTATszAGYEDiwpCmJ` |

## 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/v1/videos` | POST | 创建视频任务 |
| `/v1/videos/{task_id}` | GET | 查询任务状态和结果 |
| `/v1/videos/{task_id}/content` | GET | 下载视频文件 |

旧入口 `/v1/video/generations` 仍兼容，新接入方统一使用 `/v1/videos`。

## 生产推荐 Payload

### 单参考图生成视频

```json
{
  "model": "grok-imagine-1.0-video",
  "prompt": "Use the provided reference image as the exact character identity: an elderly Chinese woman doctor with gray hair, black traditional Chinese medical clothing, in an indoor clinic. Keep her face, age, gray hair, black outfit, and clinic room consistent. No subtitles, no on-screen text.",
  "images": [
    "https://example.com/reference.png"
  ],
  "mode": "r2v",
  "strength": 0.9,
  "aspect_ratio": "9:16",
  "size": "720x1280",
  "seconds": "6",
  "duration": 6,
  "resolution": "720p",
  "quality": "high"
}
```

### 真实医生讲解 Query 推荐写法

这是对真实医生参考图 query 的当前推荐版本，重点是保留参考图身份。

```json
{
  "model": "grok-imagine-1.0-video",
  "prompt": "Use the provided reference image as the exact doctor identity. The doctor must remain the same elderly Chinese woman from the reference image throughout the whole video: gray hair, elderly Chinese female face, black traditional Chinese medical clothing, calm indoor clinic room. Do not change her into a man. Do not change her into a white-coat western doctor. Create a vertical 9:16 medical explainer video with five fast distinct editorial shots. Use real hard cuts between shots, not camera tilt, pan, push, pull, reframing, or vertical movement pretending to be cuts. In every shot, the same elderly woman doctor stands beside one adult patient, speaks very fast but naturally in Mandarin Chinese directly to camera, and clearly points to one body part on the patient. No subtitles, no captions, no on-screen text, no written Chinese characters. Shot 1: the same woman doctor points at the patient's neck. Hard cut. Shot 2: the same woman doctor points at the patient's back. Hard cut. Shot 3: the same woman doctor points at the patient's head. Hard cut. Shot 4: the same woman doctor points at the patient's face. Hard cut. Shot 5: the same woman doctor points at the patient's knee. Keep her gray hair, face, age, black outfit, clinic room, and calm traditional Chinese medicine style consistent in all five shots. Spoken Mandarin line, delivered very fast and naturally: 日常养生贵在规律，三餐定时清淡饮食，少重油重盐与甜食。每日保证七至八小时睡眠，避免长期熬夜损伤脏腑。坚持适度运动，快走、慢跑均可增强体质。遇事放平心态，少生气少焦虑，情绪平和更益身心。多喝温水，远离久坐，养成良好习惯，才能长久守护身体健康。",
  "images": [
    "https://cdn.vdgen.shop/qy-tests/scene_01_524155a2.png"
  ],
  "mode": "r2v",
  "strength": 0.9,
  "aspect_ratio": "9:16",
  "size": "720x1280",
  "seconds": "10",
  "duration": 10,
  "resolution": "720p",
  "quality": "high"
}
```

实测任务 `task_k6Id9R1pS3LbK22GHLLnDbUHFVPfsF5x`：输出 `720×1280`、约 10 秒。抽帧确认参考图保留较好，医生保持为灰发老年中国女性、黑色中式服装、室内诊室环境，并出现指背、指脸、指膝腿等动作。

## 关键参数

| 参数 | 类型 | 必填 | 推荐/说明 |
|------|------|------|-----------|
| `model` | string | 是 | 推荐 `grok-imagine-1.0-video`。也可直接传 `grok-imagine-1.0-video-20s` / `grok-imagine-1.0-video-30s` |
| `prompt` | string | 是 | 建议英文描述；中文台词可放在 prompt 内 |
| `images` | array[string] | 否 | 推荐参考图字段。支持公网 URL 或 `data:image/...;base64,...`；新版插件上限为 7 张 |
| `mode` | string | 否 | 参考图任务建议传 `r2v` |
| `strength` | number | 否 | 参考图任务建议传 `0.9`；这是软约束 |
| `aspect_ratio` | string | 否 | 推荐 `9:16`、`16:9`、`1:1`；新版插件还映射 `4:3`、`3:4`、`21:9` |
| `size` | string | 否 | 推荐 `720x1280`、`1280x720`、`1024x1024`；宽高比字段会自动映射 |
| `seconds` | string | 否 | 支持 `6`、`10`、`15`、`20`、`30` |
| `duration` | integer | 否 | 可与 `seconds` 同传；不传时服务会从 `seconds` 自动补。基础模型传 20/30 秒时会自动转下游长时长模型 |
| `resolution` | string | 否 | 推荐 `720p`；不传时服务默认补 `720p` |
| `quality` | string | 否 | 推荐 `high`；不传时服务按 `resolution` 自动补 |

兼容但不推荐作为业务主路径的字段：`image`、`image_urls`、`reference_images`、`reference_image_urls`、`image_url`。这些字段会被服务端尽量转换成下游参考图结构，但新调用方统一使用 `images`。

不要这样传：

| 写法 | 原因 |
|------|------|
| `image: {"url": "..."}` | 937qq/Qilin 要求 `image` 是字符串，不接受对象 |
| `size: "9:16"` | `size` 只接受像素尺寸，不接受比例字符串 |
| prompt 里写 `@Image1` | 937qq/Qilin 这条链路会报 reference placeholder 错误 |
| 只把比例写在 prompt 里 | 实测不控制真实视频编码尺寸 |
| 人物参考图只写 `preserve identity` | 太弱，容易漂移 |
| 女性参考图里使用 `him` / `his` | 会把角色拉向男性 |

## 服务端自动转换

为了让调用方不感知下游差异，本服务会自动做这些处理：

| 调用方传入 | 服务端处理 |
|------------|------------|
| `images` / `image` / `image_urls` 等参考图字段 | 补 Qilin/Grok 原生 `image_reference` |
| `seconds: "10"` 且未传 `duration` | 补 `duration: 10` |
| `duration: 20` 且模型为 `grok-imagine-1.0-video` | 下游模型改为 `grok-imagine-1.0-video-20s`，并锁定 20 秒 |
| `duration: 30` 且模型为 `grok-imagine-1.0-video` | 下游模型改为 `grok-imagine-1.0-video-30s`，并锁定 30 秒 |
| 直接传 `grok-imagine-1.0-video-20s` / `30s` | 分别锁定 `duration` 和 `seconds` 为 20 / 30 |
| 未传 `resolution` | 补 `resolution: "720p"` |
| 未传 `quality` 且分辨率是 HD 档 | 补 `quality: "high"` |
| `aspect_ratio: "9:16"` 且未传 `size` | 补 `size: "720x1280"` |
| `aspect_ratio: "16:9"` 且未传 `size` | 补 `size: "1280x720"` |
| `aspect_ratio: "1:1"` 且未传 `size` | 补 `size: "1024x1024"` |
| `aspect_ratio: "4:3"` / `"3:4"` / `"21:9"` 且未传 `size` | 分别补 `1152x864` / `864x1152` / `1680x720` |
| `ratio` | 按 `aspect_ratio` 同样规则兼容 |

下游实际使用的参考图结构类似：

```json
{
  "image_reference": [
    {
      "type": "image_url",
      "image_url": {
        "url": "https://example.com/reference.png"
      }
    }
  ]
}
```

这是内部实现细节，调用方继续传 `images`。

## 参考图写作规范

参考图能否生效，主要取决于两件事：图片是否被下游接收，以及 prompt 是否把参考图中的关键视觉锚点写清楚。

### 推荐写法

在 prompt 前半段固定写：

```text
Use the provided reference image as the exact character identity.
The person must remain the same [age/gender/ethnicity] from the reference image:
[hair], [face/age], [clothing], [room/environment].
Do not change [him/her] into [common wrong identity].
Keep [face], [hair], [clothing], and [environment] consistent.
```

医生参考图示例：

```text
Use the provided reference image as the exact doctor identity.
The doctor must remain the same elderly Chinese woman from the reference image:
gray hair, elderly Chinese female face, black traditional Chinese medical clothing,
calm indoor clinic room.
Do not change her into a man.
Do not change her into a white-coat western doctor.
```

### 不推荐写法

```text
Use the provided reference image as the doctor identity and preserve the same doctor.
```

这句话太泛，模型容易生成白大褂医生、男性医生或完全重写人物。

## 参考图输入建议

| 输入方式 | 建议 |
|----------|------|
| 公网 URL | 推荐。确保 937qq/Grok 下游可直接访问 |
| `data:image/png;base64,...` | 可用于小图或快速验证 |
| 大 base64 | 不推荐，容易触发网关 body size 限制 |
| 本地 JPEG | 建议先转 PNG，再上传公网 URL |
| 真实人物图片 | 建议 PNG，长边控制到 1280 左右，文件控制到约 1.5MB |

下载目录里的麒麟插件会把本地图片转 PNG、压缩到约 1.5MB，再上传 OSS 得到 URL。这说明对真实人物参考图，PNG 公网 URL 是更稳的生产路径。

## 比例与尺寸

| 目标比例 | 推荐参数 | 已验证结果 |
|----------|----------|------------|
| 竖屏 | `aspect_ratio: "9:16"` 或 `size: "720x1280"` | 输出过 `720×1280`、`416×752` |
| 横屏 | `aspect_ratio: "16:9"` 或 `size: "1280x720"` | 输出过 `752×416` |
| 方形 | `aspect_ratio: "1:1"` 或 `size: "1024x1024"` | 输出过 `960×960` |
| 4:3 | `aspect_ratio: "4:3"` 或 `size: "1152x864"` | 按新版插件映射透传，未做生产实测承诺 |
| 3:4 | `aspect_ratio: "3:4"` 或 `size: "864x1152"` | 按新版插件映射透传，未做生产实测承诺 |
| 21:9 | `aspect_ratio: "21:9"` 或 `size: "1680x720"` | 按新版插件映射透传，未做生产实测承诺 |

注意：

- `size` 必须是像素尺寸，不要传 `"9:16"`。
- 只在 prompt 写 “vertical 9:16” 不可靠。
- `4:3`、`3:4`、`21:9` 已按新版麒麟插件映射透传，但还没有像 9:16 / 16:9 / 1:1 一样完成生产视频抽检。
- 下游会按自身编码规格缩放，不能保证像素级等于传入尺寸。

## 创建任务

```bash
curl -s "http://192.129.209.36:3001/v1/videos" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "grok-imagine-1.0-video",
    "prompt": "Use the provided reference image as the exact character identity: an elderly Chinese woman doctor with gray hair, black traditional Chinese medical clothing, in an indoor clinic. Keep her face, age, gray hair, black outfit, and clinic room consistent. No subtitles, no on-screen text.",
    "images": [
      "https://example.com/reference.png"
    ],
    "mode": "r2v",
    "strength": 0.9,
    "aspect_ratio": "9:16",
    "size": "720x1280",
    "seconds": "6",
    "duration": 6,
    "resolution": "720p",
    "quality": "high"
  }'
```

创建响应：

```json
{
  "id": "task_xxx",
  "task_id": "task_xxx",
  "object": "video",
  "model": "grok-imagine-1.0-video",
  "status": "queued",
  "progress": 0,
  "created_at": 0
}
```

## 查询任务

```bash
curl -s "http://192.129.209.36:3001/v1/videos/<task_id>" \
  -H "Authorization: Bearer $API_KEY"
```

完成响应：

```json
{
  "id": "task_xxx",
  "object": "video",
  "model": "grok-imagine-1.0-video",
  "status": "completed",
  "progress": 100,
  "video_url": "https://example.com/video.mp4",
  "created_at": 1778855922,
  "completed_at": 1778855936
}
```

失败响应：

```json
{
  "id": "task_xxx",
  "object": "video",
  "model": "grok-imagine-1.0-video",
  "status": "failed",
  "progress": 0,
  "error": {
    "message": "generation failed",
    "code": "generation_error"
  }
}
```

## 下载视频

```bash
curl -L "http://192.129.209.36:3001/v1/videos/<task_id>/content" \
  -H "Authorization: Bearer $API_KEY" \
  -o output.mp4
```

也可以直接下载查询响应中的 `video_url`。

## Python 示例

```python
import time
import requests

BASE_URL = "http://192.129.209.36:3001/v1"
API_KEY = "YOUR_API_KEY"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
}

payload = {
    "model": "grok-imagine-1.0-video",
    "prompt": (
        "Use the provided reference image as the exact character identity: "
        "an elderly Chinese woman doctor with gray hair, black traditional "
        "Chinese medical clothing, in an indoor clinic. Keep her face, age, "
        "gray hair, black outfit, and clinic room consistent. No subtitles, "
        "no on-screen text."
    ),
    "images": ["https://example.com/reference.png"],
    "mode": "r2v",
    "strength": 0.9,
    "aspect_ratio": "9:16",
    "size": "720x1280",
    "seconds": "6",
    "duration": 6,
    "resolution": "720p",
    "quality": "high",
}

submit = requests.post(f"{BASE_URL}/videos", headers=headers, json=payload).json()
task_id = submit["task_id"]

while True:
    time.sleep(10)
    result = requests.get(f"{BASE_URL}/videos/{task_id}", headers=headers).json()
    print(result["status"], result.get("progress", 0))

    if result["status"] == "completed":
        print(result["video_url"])
        break
    if result["status"] == "failed":
        raise RuntimeError(result.get("error", {}).get("message", "generation failed"))
```

## 能力边界

| 能力 | 当前结论 |
|------|----------|
| 文生视频 | 支持 |
| 单参考图 | 支持，生产推荐路径 |
| 首尾帧 | 支持，但 Grok 对“精确首尾帧”不如专门视频模型稳定 |
| 多张参考图 | 下游接受多图结构，但生产建议先用单张主参考图 |
| 人物身份一致性 | 可明显提升，但仍是软约束 |
| 多段硬切镜头 | 不稳定，可能生成连续动作 |
| 中文口播逐字准确 | 不稳定 |
| 禁止字幕/文字 | 不稳定，仍可能生成文字 |

如果业务必须严格五个镜头、严格硬切、严格台词，建议拆成多个短视频任务分别生成，再在业务侧拼接。不要指望单条 10 秒 prompt 同时稳定满足人物锁定、五段硬切、多人互动、长中文口播。

## 已验证任务

| 用例 | task_id | 结果 |
|------|---------|------|
| 真实医生 query 参考图优先改造 | `task_k6Id9R1pS3LbK22GHLLnDbUHFVPfsF5x` | 输出 720×1280；抽帧确认灰发老年女性、黑色中式服装、诊室环境和指背/指脸/指膝腿动作保留较好 |
| 部署后 `images` 自动转 `image_reference` | `task_QFcwttd20S49mJUdM9Y7wTDNM5XhBdtM` | 输出 720×1280；抽帧确认参考图身份、服装、场景和指膝腿动作生效 |
| 麒麟插件 `image_reference` schema | `task_x1uthTcUUSc2K2KtwUEBUpWEB36Wb0Al` | 输出竖屏；抽看视频，参考图身份和指腿动作保留明显 |
| `aspect_ratio=1:1` 自动映射 | `task_EocEzfLxfQGPZ04Y7nYKgga7l0hYnpZ6` | 输出 960×960；方形比例生效 |
| base64 单参考图 | `task_RVKBuqOx4q9gWxPg2GWYSPMJv6UcoRyG` | 抽帧确认参考图生效 |
| base64 首尾帧 | `task_9yHZfodDd4tVh6RWScooHkGUY59M6E9W` | 抽帧确认首尾帧生效 |

## 排障

### 参考图人物不像

检查：

- 是否传了 `images` 数组。
- 图片 URL 是否公网可访问。
- prompt 是否明确写了年龄、性别、发型、服装、环境。
- 是否错误使用了 `him` / `his` 等男性代词。
- 是否明确排除了常见错误身份，例如 `man`、`white-coat western doctor`。
- 是否把任务写得过复杂。复杂分镜、长口播、多人互动都会稀释参考图约束。

### 比例不对

检查：

- 竖屏传 `aspect_ratio: "9:16"` 或 `size: "720x1280"`。
- 横屏传 `aspect_ratio: "16:9"` 或 `size: "1280x720"`。
- 方形传 `aspect_ratio: "1:1"` 或 `size: "1024x1024"`。
- 不要只在 prompt 中写比例。

### 本地图片怎么传

生产建议：本地图片先转 PNG，长边约 1280，文件约 1.5MB 内，上传公网 URL，再放入 `images`。小图可以转成 `data:image/png;base64,...` 直接放入 `images`。
