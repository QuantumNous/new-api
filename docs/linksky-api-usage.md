# LinkSky API 调用文档

本文档基于 `https://linksky.top/pricing` 对应的公开定价接口 `https://linksky.top/api/pricing` 整理，抓取时间为 `2026-04-13`。  
当前公开可见模型共 `15` 个，覆盖文本、图片、图片编辑、视频生成四类能力。

## 1. 接入信息

- 服务地址: `https://linksky.top`
- OpenAI 兼容 Base URL: `https://linksky.top/v1`
- 认证方式: `Authorization: Bearer <你的_API_Key>`
- 内容类型:
  - 文本、图片、视频: `application/json`
  - 标准图片编辑上传文件: `multipart/form-data`

建议先通过下面两个接口确认账号下可用模型和当前计费信息:

```bash
curl https://linksky.top/api/pricing
```

```bash
curl https://linksky.top/v1/models \
  -H "Authorization: Bearer $LINKSKY_API_KEY"
```

## 2. 当前支持的主要接口

| 接口 | 用途 | 说明 |
| --- | --- | --- |
| `POST /v1/chat/completions` | 文本对话 | OpenAI Chat Completions 兼容 |
| `POST /v1/responses` | Responses 风格对话 | 当前 Grok 文本模型支持 |
| `POST /v1/images/generations` | 文生图 | 适合 `grok-imagine-1.0` |
| `POST /v1/images/edits` | 图生图/编辑 | 适合 `grok-imagine-1.0-edit` |
| `POST /v1/images/async-generations` | 异步文生图 | 立即返回 `task_id`，后台生成 |
| `POST /v1/images/async-edits` | 异步图生图/编辑 | 立即返回 `task_id`，后台生成 |
| `GET /v1/images/async-generations/{task_id}` | 查询异步图片任务 | 轮询获取状态与图片结果 |
| `GET /v1/images/async-edits/{task_id}` | 查询异步图片编辑任务 | 轮询获取状态与图片结果 |
| `POST /v1/chat/completions` | Banana 系列图片生成/编辑 | 适合 `nano-banana-pro` / `nano-banana2` |
| `POST /v1/video/generations` | 视频生成 | 异步任务，返回 `task_id` |
| `GET /v1/video/generations/{task_id}` | 查询视频任务 | 轮询获取状态与结果 |
| `POST /v1/video/async-generations` | 严格异步视频生成 | 立即返回本地 `task_id`，后台生成 |
| `GET /v1/video/async-generations/{task_id}` | 查询严格异步视频任务 | 轮询获取状态与结果 |

## 3. 当前公开模型清单

### 3.1 文本模型

这批文本模型当前属于“倍率计费”模型。  
`model_ratio` 是输入倍率，`completion_ratio` 是输出倍率，不是直接的“每次固定价格”。

| 模型 | 推荐接口 | 厂商 | 输入倍率 | 输出倍率 |
| --- | --- | --- | ---: | ---: |
| `gpt-5.3-codex` | `/v1/chat/completions` | OpenAI | 0.25 | 8 |
| `gpt-5.4` | `/v1/chat/completions` | OpenAI | 0.30 | 6 |
| `gpt-5.4-mini` | `/v1/chat/completions` | OpenAI | 0.15 | 6 |
| `grok-4.1-expert` | `/v1/chat/completions` 或 `/v1/responses` | xAI | 0.04 | 1 |
| `grok-4.1-fast` | `/v1/chat/completions` 或 `/v1/responses` | xAI | 0.04 | 1 |
| `grok-4.1-mini` | `/v1/chat/completions` 或 `/v1/responses` | xAI | 0.04 | 1 |
| `grok-4.1-thinking` | `/v1/chat/completions` 或 `/v1/responses` | xAI | 0.04 | 1 |
| `grok-4.20-beta` | `/v1/chat/completions` 或 `/v1/responses` | xAI | 0.09 | 1 |

### 3.2 图片模型

| 模型 | 推荐接口 | 计费方式 | 当前价格 |
| --- | --- | --- | --- |
| `grok-imagine-1.0` | `/v1/images/generations` | 按次 | `0.03/次` |
| `grok-imagine-1.0-edit` | `/v1/images/edits` | 按次 | `0.03/次` |
| `nano-banana-pro` | `/v1/chat/completions` | 按分辨率 | `1K: 0.09` / `2K: 0.18` / `4K: 0.35` |
| `nano-banana2` | `/v1/chat/completions` | 按分辨率 | `1K: 0.09` / `2K: 0.18` / `4K: 0.35` |

说明:
`nano-banana-pro` 和 `nano-banana2` 在当前项目适配中走的是 `POST /v1/chat/completions`。
是否属于“文生图”还是“图生图”，取决于 `messages` 里是否带了 `image_url`。
它们仍支持 `aspect_ratio`、`output_resolution` 等参数。

### 3.3 视频模型

| 模型 | 推荐接口 | 计费方式 | 当前价格 |
| --- | --- | --- | --- |
| `grok-imagine-1.0-video` | `/v1/video/generations` | 按秒数档位 | `6s: 0.06` / `8s: 0.08` / `10s: 0.10` |
| `veo31-fast` | `/v1/video/generations` | 按秒数档位 | `4s: 0.08` / `6s: 0.12` / `8s: 0.16` |
| `veo31-ref` | `/v1/video/generations` | 按秒数档位 | `4s: 0.08` / `6s: 0.12` / `8s: 0.16` |

`veo31-ref` 适合带参考图的视频生成。  
`grok-imagine-1.0-video` 也支持带图参考，可以在请求里传 `image`。

## 4. 推荐调用方式

### 4.1 文本对话: Chat Completions

适合 `gpt-5.4`、`gpt-5.4-mini`、`gpt-5.3-codex`，也适合全部 Grok 文本模型。

```bash
curl https://linksky.top/v1/chat/completions \
  -H "Authorization: Bearer $LINKSKY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-5.4-mini",
    "messages": [
      {"role": "system", "content": "你是一个简洁的中文助手。"},
      {"role": "user", "content": "帮我写一段产品介绍。"}
    ],
    "temperature": 0.7,
    "stream": false
  }'
```

### 4.2 文本对话: Responses

如果你更偏向 OpenAI Responses 风格，当前推荐使用 Grok 文本模型。

```bash
curl https://linksky.top/v1/responses \
  -H "Authorization: Bearer $LINKSKY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "grok-4.1-fast",
    "input": "请把下面内容整理成一段正式公告：今晚 8 点上线新版本。",
    "stream": false
  }'
```

### 4.3 文生图

#### Grok 文生图

```bash
curl https://linksky.top/v1/images/generations \
  -H "Authorization: Bearer $LINKSKY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "grok-imagine-1.0",
    "prompt": "一只戴宇航员头盔的柴犬，站在霓虹城市屋顶，电影感光影，超清细节",
    "size": "1024x1024",
    "response_format": "url"
  }'
```

#### Banana 系列图片生成

`nano-banana-pro` 和 `nano-banana2` 在当前项目适配中统一走 `POST /v1/chat/completions`。
没有 `image_url` 时可视为文生图，带 `image_url` 时可视为图生图/参考图生成。

推荐参数说明:
- `output_resolution`: 建议直接使用 `1K`、`2K`、`4K`
- `aspect_ratio`: 建议使用类似 `1:1`、`4:3`、`3:4`、`16:9`、`9:16` 的写法
- 对 Banana 系列，优先传 `output_resolution`，不建议再按传统文生图思路只传 `size`

分辨率档位与当前公开价格:

| output_resolution | 当前价格 |
| --- | --- |
| `1K` | `0.09` |
| `2K` | `0.18` |
| `4K` | `0.35` |

```bash
curl https://linksky.top/v1/chat/completions \
  -H "Authorization: Bearer $LINKSKY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "nano-banana-pro",
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "text",
            "text": "高端护肤品广告海报，极简背景，玻璃反光，商业摄影风格"
          }
        ]
      }
    ],
    "aspect_ratio": "1:1",
    "output_resolution": "2K",
    "stream": false,
    "extra_body": {
      "google": {
        "image_config": {
          "aspect_ratio": "1:1",
          "image_size": "2K"
        }
      }
    }
  }'
```

如果你只是做最小可用测试，可以直接替换 `output_resolution`:

```bash
"output_resolution": "1K"
```

```bash
"output_resolution": "2K"
```

```bash
"output_resolution": "4K"
```

### 4.4 图生图 / 图片编辑

当前 `grok-imagine-1.0-edit` 可直接传远程图片 URL。

```bash
curl https://linksky.top/v1/images/edits \
  -H "Authorization: Bearer $LINKSKY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "grok-imagine-1.0-edit",
    "prompt": "把画面改成黄昏氛围，并增加赛博朋克霓虹灯",
    "image": "https://example.com/source.png",
    "response_format": "url"
  }'
```

#### Banana 系列图生图

`nano-banana-pro` 和 `nano-banana2` 的图生图也走 `POST /v1/chat/completions`，
区别只是把参考图放进 `messages[].content[].image_url`。

推荐参数说明:
- `output_resolution`: 建议直接使用 `1K`、`2K`、`4K`
- `aspect_ratio`: 建议使用类似 `1:1`、`4:3`、`3:4`、`16:9`、`9:16` 的写法
- 图生图时 `image` 建议传真实可访问图片 URL，或按 OpenAI 兼容方式上传文件

常见组合示例:
- 商品主图重绘: `aspect_ratio: "1:1"` + `output_resolution: "2K"`
- 横版海报重绘: `aspect_ratio: "16:9"` + `output_resolution: "2K"`
- 竖版封面重绘: `aspect_ratio: "3:4"` 或 `9:16` + `output_resolution: "2K"`

```bash
curl https://linksky.top/v1/chat/completions \
  -H "Authorization: Bearer $LINKSKY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "nano-banana-pro",
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "text",
            "text": "保留主体构图，把画面改成高级商业海报风格，增强玻璃反射和边缘高光"
          },
          {
            "type": "image_url",
            "image_url": {
              "url": "https://example.com/source.png"
            }
          }
        ]
      }
    ],
    "aspect_ratio": "1:1",
    "output_resolution": "2K",
    "stream": false,
    "extra_body": {
      "google": {
        "image_config": {
          "aspect_ratio": "1:1",
          "image_size": "2K"
        }
      }
    }
  }'
```

如果你接的是标准 OpenAI 文件上传流，也可以改用 `multipart/form-data` 上传本地图片文件。

### 4.5 图片异步任务

如果下游需要“提交任务 -> 轮询结果”的异步模式，可以使用异步图片接口。它不会改动原来的同步接口行为，后台仍复用现有图片生成/编辑链路，因此模型适配、分组价格、扣费和使用日志规则与 `/v1/images/generations`、`/v1/images/edits` 保持一致。

#### 异步文生图

```bash
curl https://linksky.top/v1/images/async-generations \
  -H "Authorization: Bearer $LINKSKY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "grok-imagine-1.0",
    "prompt": "一张复古科幻旅行海报，火星城市、火箭、胶片颗粒质感",
    "size": "1024x1024",
    "response_format": "url"
  }'
```

提交成功会立即返回类似:

```json
{
  "id": "task_xxx",
  "task_id": "task_xxx",
  "object": "image.task",
  "model": "grok-imagine-1.0",
  "status": "queued",
  "progress": 10,
  "created_at": 1776146800
}
```

轮询查询:

```bash
curl https://linksky.top/v1/images/async-generations/<task_id> \
  -H "Authorization: Bearer $LINKSKY_API_KEY"
```

完成后会返回 `status: "completed"`，并在 `result_url` 和 `data[].url` 中带图片结果；失败时会返回 `status: "failed"` 和 `error.message`。

#### 异步图生图 / 图片编辑

```bash
curl https://linksky.top/v1/images/async-edits \
  -H "Authorization: Bearer $LINKSKY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "grok-imagine-1.0-edit",
    "prompt": "保留主体构图，把画面改成黄昏氛围，并增加赛博朋克霓虹灯",
    "image": "https://example.com/source.png",
    "response_format": "url"
  }'
```

轮询查询:

```bash
curl https://linksky.top/v1/images/async-edits/<task_id> \
  -H "Authorization: Bearer $LINKSKY_API_KEY"
```

### 4.6 视频生成

视频接口是异步任务模式。  
先 `POST /v1/video/generations` 获取 `task_id`，再轮询 `GET /v1/video/generations/{task_id}`。

如果下游要求“提交后立刻返回，不等待上游生成完成”，请使用严格异步接口:

```bash
curl https://linksky.top/v1/video/async-generations \
  -H "Authorization: Bearer $LINKSKY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "grok-imagine-1.0-video",
    "prompt": "夜晚的海边公路，一辆复古跑车驶过，镜头平滑跟拍，电影感",
    "duration": 8,
    "width": 1280,
    "height": 720
  }'
```

提交成功会立即返回类似:

```json
{
  "id": "task_xxx",
  "task_id": "task_xxx",
  "object": "video",
  "model": "grok-imagine-1.0-video",
  "status": "queued",
  "progress": 10,
  "created_at": 1776223000
}
```

轮询查询:

```bash
curl https://linksky.top/v1/video/async-generations/<task_id> \
  -H "Authorization: Bearer $LINKSKY_API_KEY"
```

完成后会返回 `status: "completed"`，并在 `url` 中带视频结果；失败时会返回 `status: "failed"` 和 `error.message`。

#### 文生视频

```bash
curl https://linksky.top/v1/video/generations \
  -H "Authorization: Bearer $LINKSKY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "grok-imagine-1.0-video",
    "prompt": "夜晚的海边公路，一辆复古跑车驶过，镜头平滑跟拍，电影感",
    "duration": 8,
    "width": 1280,
    "height": 720
  }'
```

#### Grok 图生视频

`grok-imagine-1.0-video` 也支持带参考图的视频生成，可以直接在请求体中传 `image`。
适合做人像动作延展、商品镜头动画化、海报转动态短视频等场景。

推荐参数说明:
- `image`: 建议传真实可访问的图片 URL
- `duration`: 当前公开价格档位为 `6`、`8`、`10` 秒
- `width` / `height`: 建议与素材构图保持一致，常见可用 `1280x720` 或 `720x1280`

支持参数总表:
- `model`: 固定传 `grok-imagine-1.0-video`
- `prompt`: 视频生成提示词
- `image`: 单张参考图 URL，适合最常见的图生视频调用
- `images`: 多张参考图数组，项目会自动归并为 `image_reference`
- `image_reference`: 参考图数组，适合你想显式按上游字段传参时使用
- `duration`: 视频时长，当前文档建议使用 `6`、`8`、`10`
- `seconds`: `duration` 的兼容写法，项目计费和任务逻辑会优先读取它
- `quality`: 质量档位，项目内对 Grok 兼容 `standard`、`high`
- `resolution_name`: 分辨率档位，当前项目会把 `480p` 映射到 `standard`，`720p` 映射到 `high`
- `preset`: 视频风格预设，项目会原样透传给上游
- `video_config`: 可传对象，当前项目会读取其中的 `resolution_name` 和 `preset`
- `width` / `height`: 兼容透传参数，适合在你自己的请求体里保留明确横竖版信息

参数关系说明:
- 如果同时传 `quality` 和 `resolution_name`，项目会自动做对齐
- `quality: "high"` 通常会补成 `resolution_name: "720p"`
- `quality: "standard"` 通常会补成 `resolution_name: "480p"`
- 如果你传了 `image` 或 `images`，项目会自动整理成 `image_reference`
- 如果你更想贴近项目内部兼容逻辑，推荐优先使用: `prompt` + `image` + `duration` + `quality` + `preset`

横版图生视频示例:

```bash
curl https://linksky.top/v1/video/generations \
  -H "Authorization: Bearer $LINKSKY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "grok-imagine-1.0-video",
    "prompt": "保留主体和整体色调，让画面中的人物缓慢转身并看向镜头，背景霓虹灯轻微闪烁，镜头平滑推进",
    "image": "https://example.com/reference.jpg",
    "duration": 8,
    "width": 1280,
    "height": 720
  }'
```

竖版图生视频示例:

```bash
curl https://linksky.top/v1/video/generations \
  -H "Authorization: Bearer $LINKSKY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "grok-imagine-1.0-video",
    "prompt": "让人物保持服装和面部特征一致，做一个轻微抬头和向前走近镜头的动作，适合短视频封面动态化",
    "image": "https://example.com/reference-portrait.jpg",
    "duration": 6,
    "width": 720,
    "height": 1280
  }'
```

#### 带参考图视频

```bash
curl https://linksky.top/v1/video/generations \
  -H "Authorization: Bearer $LINKSKY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "veo31-ref",
    "prompt": "让人物做一个转身并看向镜头的动作，保持原有服装和场景风格",
    "image": "https://example.com/reference.jpg",
    "duration": 4,
    "width": 1280,
    "height": 720
  }'
```

#### 查询视频任务

```bash
curl https://linksky.top/v1/video/generations/<task_id> \
  -H "Authorization: Bearer $LINKSKY_API_KEY"
```

返回状态通常关注以下值:

- `queued`: 排队中
- `in_progress`: 生成中
- `completed`: 已完成
- `failed`: 失败

## 5. OpenAI SDK 接入示例

### Node.js

```javascript
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.LINKSKY_API_KEY,
  baseURL: "https://linksky.top/v1",
});

const resp = await client.chat.completions.create({
  model: "gpt-5.4-mini",
  messages: [{ role: "user", content: "你好，做个自我介绍" }],
});

console.log(resp.choices[0].message);
```

### Python

```python
from openai import OpenAI

client = OpenAI(
    api_key="YOUR_LINKSKY_API_KEY",
    base_url="https://linksky.top/v1",
)

resp = client.chat.completions.create(
    model="grok-4.1-fast",
    messages=[{"role": "user", "content": "给我写三条营销标题"}],
)

print(resp.choices[0].message)
```

## 6. 使用建议

- 文本通用场景优先: `gpt-5.4-mini`、`grok-4.1-fast`
- 代码和复杂开发任务优先: `gpt-5.3-codex`
- 高质量文生图优先: `nano-banana-pro`
- 图片修改优先: `grok-imagine-1.0-edit`
- 高质量图生图优先: `nano-banana-pro`
- 创意短视频优先: `grok-imagine-1.0-video`
- 参考图视频优先: `veo31-ref`

## 7. 备注

- 本文档中的模型和价格取自 `2026-04-13` 抓取到的 LinkSky 公开定价数据，后续如有调整，请重新以 `https://linksky.top/api/pricing` 为准。
- 当前公开定价数据里，所有模型的 `enable_groups` 均包含 `default`。
- 如果你要做程序里的动态模型下拉框，推荐直接读取 `GET /api/pricing` 或带鉴权调用 `GET /v1/models`。
