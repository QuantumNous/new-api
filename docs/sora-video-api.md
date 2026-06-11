# Sora 视频生成渠道调用文档

最后更新：2026-05-28

> **2026-05-28 回归验证**：`xb-sora2` 重新通过真实验证（task `task_AnRb9zA2TNPKnUl3WjK0ep2yvbBgdaoD`，约 3.5 分钟完成，产出 6.4MB MP4）。`ss-sora-2` 首次通过真实验证（task `task_s4H8Mwn0LwsUMviZTWviEH2GVBHvC7V4`，约 3 分钟完成，产出 7.8MB MP4）。`openai-sora-2` 仍因 seconds 归一化问题不可用。

本文档描述通过本服务调用 Sora/Hongniao 视频生成渠道。调用方只需要使用本项目统一的 OpenAI Video 兼容入口，不需要感知 Hongniao 的下游 API Key、接口路径和响应包装。

## 快速结论

生产调用时按下面规则传参：

| 目标 | 推荐写法 |
|------|----------|
| 创建视频 | `POST /v1/videos`，JSON 请求体 |
| 查询任务 | `GET /v1/videos/{task_id}` |
| 推荐模型 | `xb-sora2` |
| 参考图 | 传 `images: ["https://..."]`，保持数组 |
| 本地参考图 | 先上传成公网 URL；小图可传 `data:image/...;base64,...` |
| 横屏 | `orientation: "landscape"` 或 `aspect_ratio: "16:9"` |
| 竖屏 | `orientation: "portrait"` 或 `aspect_ratio: "9:16"` |
| 时长 | `duration: 8` 或 `duration: 12`；不传默认按模型补齐 |

`xb-sora2` 是当前主路径，已经通过生产网关验证文生视频和单参考图视频。AI 聚合站 / LK888 也已接入 `sora-2`，当前作为低优先级备用/验证线路，详情见 [AI 聚合站 / LK888 视频渠道接入文档](./lk888-video-api.md)。

## 连接信息

调用方连接本项目，不直接连接 Hongniao：

| 项目 | 值 |
|------|-----|
| Base URL | `http://192.129.209.36:3001/v1` |
| 认证方式 | HTTP Header `Authorization: Bearer <api-key>` |
| 创建任务 | `POST /v1/videos` |
| 查询任务 | `GET /v1/videos/{task_id}` |
| 下载内容 | `GET /v1/videos/{task_id}/content` |

下游 Hongniao 渠道配置：

| 项目 | 值 |
|------|-----|
| 渠道类型 | `58` / OpenAI Video |
| 渠道名 | `xb-sora2` |
| 下游 Base URL | `https://open.hongniaoai.com/v1` |
| 下游认证 | `X-API-Key` |
| 下游创建任务 | `POST /videos/generate` |
| 下游查询任务 | `GET /videos/{task_id}` |
| 下游模型发现 | `GET /models` |

## 模型列表

远端已从 Hongniao `/models` 拉取并配置以下真实模型。建议业务侧优先使用 `xb-sora2`，其他模型用于明确指定线路或做排障对比。

| 模型名 | 说明 | 推荐时长 |
|--------|------|----------|
| `xb-sora2` | Sora-2 线路 XB，当前稳定主路径 | 8 / 12 |
| `ss-sora-2` | Sora-2 线路 S | 4 / 8 / 12 |
| `sora-2(线路BF)` | Sora-2 线路 BF | 4 / 8 / 12 |
| `sora-2-pro(线路BF)` | Sora-2 Pro 线路 BF | 4 / 8 / 12 |
| `je-grok` | Grok 视频线路 JE | 6 / 10 |
| `grok-video-3(线路W)` | Grok 视频线路 W | 6 / 10 |
| `全能视频2.0` | Hongniao 全能视频 | 4 / 5 / 8 / 10 / 15 |
| `香蕉2(线路V)` | Hongniao 返回的香蕉视频模型 | 按下游模型能力 |
| `香蕉pro(线路G)` | Hongniao 返回的香蕉 Pro 模型 | 按下游模型能力 |
| `gr-image-2` | Hongniao 返回的 gpt-image-2 相关模型 | 按下游模型能力 |
| `gpt-image-2(线路XF)` | Hongniao 返回的 gpt-image-2 线路 XF | 按下游模型能力 |

本项目还保留了文档兼容别名：

| 调用方模型 | 实际下游模型 |
|------------|--------------|
| `openai-sora-2` | `xb-sora2` |
| `sora-2-image-to-video` | `xb-sora2` |
| `sora-2-pro-text-to-video` | `sora-2-pro(线路BF)` |
| `sora-2` | `xb-sora2` |
| `sora-2-pro` | `sora-2-pro(线路BF)` |

## 参数说明

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `model` | string | 是 | 推荐 `xb-sora2` |
| `prompt` | string | 是 | 视频内容描述；建议写清楚主体、动作、镜头、风格 |
| `duration` | number | 否 | 视频时长。`xb-sora2` 建议 `8` 或 `12` |
| `seconds` | string/number | 否 | 兼容字段，会转换为 `duration` |
| `orientation` | string | 否 | `landscape` 或 `portrait` |
| `aspect_ratio` | string | 否 | `16:9` 会转 `landscape`，`9:16` 会转 `portrait` |
| `ratio` | string | 否 | 兼容比例字段，按 `aspect_ratio` 同规则处理 |
| `size` | string | 否 | 兼容字段，如 `1280x720` / `720x1280`，会转换为方向 |
| `images` | array[string] | 否 | 参考图片 URL 或 `data:image/...;base64,...`，Hongniao 文档说明最多 5 张 |
| `image` | string/array | 否 | 兼容字段，会收敛到 `images` |
| `input_reference` | string/array | 否 | 兼容字段，会收敛到 `images` |
| `image_url` | string/array | 否 | 兼容字段，会收敛到 `images` |

Provider 会删除 Hongniao 不需要的 OpenAI 兼容字段，例如 `n`、`seed`、`response_format`、`width`、`height`、`fps`、`user`。

## 文生视频

```bash
curl -s "http://192.129.209.36:3001/v1/videos" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "xb-sora2",
    "prompt": "A calm sunrise over a mountain lake, cinematic, slow camera movement",
    "orientation": "landscape",
    "duration": 8
  }'
```

成功响应：

```json
{
  "id": "task_woE206uzgDCVrYTOkPhyyTtVP14GldbP",
  "task_id": "task_woE206uzgDCVrYTOkPhyyTtVP14GldbP",
  "object": "video",
  "model": "xb-sora2",
  "status": "queued",
  "progress": 0
}
```

## 参考图视频

```bash
curl -s "http://192.129.209.36:3001/v1/videos" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "xb-sora2",
    "prompt": "Use the reference image as visual inspiration. A gentle cinematic camera move, warm daylight, high quality.",
    "orientation": "landscape",
    "duration": 8,
    "images": [
      "https://example.com/reference.png"
    ]
  }'
```

推荐只用 `images` 数组作为业务主字段。兼容字段 `image`、`input_reference`、`image_url` 可以用于旧调用方迁移，但新接入不要依赖这些字段。

## 查询任务

```bash
curl -s "http://192.129.209.36:3001/v1/videos/$TASK_ID" \
  -H "Authorization: Bearer $API_KEY"
```

处理中响应：

```json
{
  "id": "task_xxx",
  "object": "video",
  "model": "xb-sora2",
  "status": "in_progress",
  "progress": 30
}
```

完成响应：

```json
{
  "id": "task_xxx",
  "object": "video",
  "model": "xb-sora2",
  "status": "completed",
  "progress": 100,
  "video_url": "https://..."
}
```

## 内部转换规则

本项目对外保持统一 OpenAI Video 风格，内部由 `xbSoraProvider` 适配 Hongniao 协议。

| 调用方输入 | 下游处理 |
|------------|----------|
| `Authorization: Bearer <用户 token>` | 使用渠道密钥设置 `X-API-Key` |
| `/v1/videos` | 转发到 `POST https://open.hongniaoai.com/v1/videos/generate` |
| `/v1/videos/{task_id}` | 转发到 `GET https://open.hongniaoai.com/v1/videos/{upstream_task_id}` |
| `openai-sora-2` / `sora-2-image-to-video` | 映射为 `xb-sora2` |
| `sora-2-pro-text-to-video` | 映射为 `sora-2-pro(线路BF)` |
| `seconds` | 转为 `duration` |
| `aspect_ratio` / `ratio` / `size` | 转为 `orientation` |
| `images` / `image` / `input_reference` / `image_url` | 收敛为下游 `images` 数组 |
| Hongniao 外层 `code:"0000"` 响应 | 解包为本项目任务状态 |

## 已验证能力

| 能力 | 结果 | 任务 |
|------|------|------|
| 模型发现 | 通过 | `GET https://open.hongniaoai.com/v1/models` 返回 11 个真实模型 |
| 文生视频 | 通过 | `task_woE206uzgDCVrYTOkPhyyTtVP14GldbP`，`completed`，`progress=100`，返回视频 URL |
| 单参考图视频 | 通过 | `task_A80f7CbmU4xxDSCn7Xi6fCLGJREpPW0C`，`completed`，`progress=100`，返回视频 URL |

## 注意事项

- 生产推荐模型是 `xb-sora2`，不要默认使用文档里的 `openai-sora-2`。`openai-sora-2` 只是兼容别名，会映射到 `xb-sora2`。
- `sora-2` 还有 LK888 备用线路。由于当前生产主路径仍是 Hongniao，如需专门验证 LK888 Sora，需要临时调整渠道优先级；验证完成后保持 LK888 渠道低优先级。
- Hongniao 文档顶部曾出现 `https://localhost:3000/v1`，实际生产地址已确认为 `https://open.hongniaoai.com/v1`。
- `images` 已验证能被下游接受并完成任务，但人物身份一致性、首尾帧严格程度仍取决于 Hongniao 下游模型，不是网关能完全保证的能力。
- 下游返回的视频 URL 是签名 URL，可能有过期时间。长期保存请在生成完成后尽快下载或转存。
