# Mao 渠道支持火山官方 content[] 输入并规范化设计

日期：2026-08-11  
状态：已确认设计，待实现  
关联：`docs/superpowers/specs/2026-08-11-mao-seedance-adaptive-channel-design.md`  
参考：`docs/superpowers/specs/2026-07-12-83zi-volc-official-normalize-design.md`

## 1. 目标

让 **mao 渠道（类型 68）** 在收到火山官方视频请求格式（`content[]`）时，自动转换成 catertx / Seedance 扁平提交字段；并按 `role` 区分首帧、尾帧与参考图。非火山扁平请求行为不变。

## 2. 范围

### 做

- 仅改 `relay/channel/task/mao/`
- JSON 路径：检测 → 日志 → 规范化 → 现有 `buildUpstreamPayload`（含分辨率自适应模型映射）
- 映射 `text` / `image_url`（含 role）/ `video_url` / `audio_url`
- `generate_audio` 缺省 `true`，`watermark` 缺省 `false`
- 转换后删除 `content`，避免脏字段进入上游

### 不做

- 不改 83zi / 7tai / doubao / sora 适配器
- 不改公共 `TaskSubmitReq` 解析层
- 不处理 multipart（火山官方为 JSON `content[]`）
- 不做 83zi 式分辨率强制纠正（mao 用 `resolution` 做自适应模型映射）

## 3. 数据流

```
客户端 JSON（火山官方或扁平）
  → BuildRequestBody
  → readRequestBodyMap
  → detectAndNormalizeVolcOfficial（新增；未命中则跳过）
  → buildUpstreamPayload（逻辑模型 + 分辨率 → sd-*）
  → c.Set RequestBody（异步重试已有）
  → POST /v1/video/generations
```

新增文件：

- `relay/channel/task/mao/volc_normalize.go`
- `relay/channel/task/mao/volc_normalize_test.go`

## 4. 判定条件

原始 JSON（或 body map）存在非空 `content` 数组，且至少一项 `type` 为：

- `text`
- `image_url`
- `video_url`
- `audio_url`

否则不做任何转换。

## 5. 字段映射

| 火山官方 | mao 上游字段 |
|----------|--------------|
| `content[].type=text` → 多段 `\n` 拼接 | `prompt`（仅当原 `prompt` 为空时写入） |
| `image_url` + `role=first_frame` | `image`（多项时后者覆盖） |
| `image_url` + `role=last_frame` | `last_frame` |
| `image_url` + `role=reference_image` 或无/其它 role | `metadata.reference_images[]` |
| `video_url` → URL | `videos[]` |
| `audio_url` → URL | `audios[]` |
| 顶层 `ratio` / `aspect_ratio` | 现有逻辑（`ratio`） |
| 顶层 `duration` / `seconds` | 现有逻辑 |
| 顶层 `seed` | 透传 |
| 顶层 `resolution` | **保留**，供自适应模型映射；**不**强制改 720p |
| 顶层 `generate_audio` | 写入顶层后由 `buildUpstreamPayload` 并入 `metadata`；缺省 **true** |
| 顶层 `watermark` | 并入 `metadata`；缺省 **false** |
| 顶层 `camera_fixed` | 有则写入 `metadata`；mini 仍由现有逻辑剥离 |
| `content` | 规范化后 **delete** |

URL 抽取兼容：`image_url.url` 对象、纯字符串、或 item 顶层 `url`（对齐 83zi/7tai）。

## 6. 与 83zi 的差异

| 点 | 83zi | mao |
|----|------|-----|
| `role` | 忽略，全部进 image 列表 | **读取**，映射 first/last/reference |
| 图片字段 | `image_urls[]` | `image` / `last_frame` / `metadata.reference_images` |
| 音视频字段 | `video_urls` / `audio_urls` | `videos` / `audios` |
| resolution | 强制 720p/1080p | 保留原值给模型映射 |
| generate_audio 缺省 | true | true（一致） |

## 7. 日志

检测到时（不打印完整 URL / prompt）：

```
[mao] detected VolcEngine official content format; model=<logic> images=N videos=N audios=N first_frame=bool last_frame=bool
```

其中 `images` 计 reference 张数（不含 first/last 亦可，实现时在日志字段中区分清楚即可）。

## 8. 测试要点

- 命中判定：仅有无关 content type 不转换
- text → prompt；已有 prompt 不被覆盖
- first_frame / last_frame / reference_image 分别进正确字段
- 无 role 的 image_url → reference_images
- videos / audios 数组
- generate_audio 缺省 true；watermark 缺省 false
- 转换后无 `content` 键
- 非火山扁平 body 原样进入 `buildUpstreamPayload`
- 与分辨率映射联调：火山 + `resolution:1080p` + `guanzhuan-seedance2.0` → 上游 model `sd-2-0-1080p`

## 9. 非目标补充

- 不在本需求中改前端 seedance-debug（若已能打火山格式即可测）
- 不强制 `return_last_frame` 等火山专有输出字段
