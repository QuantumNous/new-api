# xixiapi.cc — `gpt-image-2` 图像生成接口文档

> 本文档基于对 `https://xixiapi.cc` 第三方网关的实测整理(2026-04-27),记录 `gpt-image-2` 模型在 OpenAI Responses API 形态下的请求/响应规格、参数支持矩阵与已知差异。

---

## 1. 接口端点

| 项 | 值 |
|----|----|
| **Method** | `POST` |
| **URL** | `https://xixiapi.cc/v1/responses` |
| **Content-Type** | `application/json` |
| **Auth** | `Authorization: Bearer <API_KEY>` |
| **协议** | HTTP/1.1 + 可选 SSE(`Accept: text/event-stream`) |

---

## 2. 请求体(顶层)

```json
{
  "model": "gpt-image-2",
  "input": "A cute orange cat sitting on a windowsill",
  "stream": false,
  "tools": [
    {
      "type": "image_generation",
      "size": "1536x1024",
      "quality": "high",
      "output_format": "jpeg",
      "output_compression": 95,
      "background": "auto",
      "moderation": "auto",
      "partial_images": 0
    }
  ]
}
```

### 2.1 顶层字段

| 字段 | 类型 | 必填 | 默认 | 说明 |
|------|------|------|------|------|
| `model` | string | ✅ | — | 固定 `gpt-image-2` |
| `input` | string | ✅ | — | 提示词 |
| `stream` | bool | ❌ | `false` | `true` 时返回 SSE,**强烈推荐**(TTFB ~5s) |
| `tools` | array | ✅ | — | 必须包含一个 `{"type":"image_generation"}` |

### 2.2 `image_generation` 工具字段

| 字段 | 类型 | 默认 | 取值 | 说明 |
|------|------|------|------|------|
| `type` | string | — | `"image_generation"` | 必填 |
| `size` | string | `"auto"` | `"WxH"` | **见 §3 约束** |
| `quality` | string | `"auto"` | `low` / `medium` / `high` / `auto` | `low` 用于草图 |
| `output_format` | string | `"png"` | `png` / `jpeg` | ⚠️ `webp` 会被网关静默忽略,实际返回 PNG |
| `output_compression` | int | `100` | `0-100` | 仅对 `jpeg` 有效;推荐 q=95 视觉无损 |
| `background` | string | `"auto"` | `auto` / `opaque` | ⚠️ **不支持 `transparent`** |
| `moderation` | string | `"auto"` | `low` / `auto` | `low` 略快 |
| `partial_images` | int | `0` | `0-3` | 仅 `stream=true` 有意义,**实际帧数由模型自决,可能少于请求值** |

### 2.3 已知不支持的字段

| 字段 | 行为 | 替代方案 |
|------|------|----------|
| `n: 2`(单次多张) | 502 | 串行多次调用 |
| `background: "transparent"` | 502 | 用 PNG + alpha 后处理 |
| `output_format: "webp"` | 静默忽略,返回 PNG | 服务端转码 |
| `input_fidelity`(任意取值/位置) | 502 | 不可用,见 §10.3 |
| 编辑模式 base64 内联 webp | 502(超时后) | 服务端转 png/jpeg 再传,见 §10.2 |

---

## 3. `size` 参数约束(强制,违反一律 502)

满足以下**全部** 4 条:

1. **每条边长 ≤ 3840 px**
2. **每条边长是 16 的倍数**
3. **长边 : 短边 ≤ 3 : 1**
4. **总像素数 ∈ [655,360, 8,294,400]**

### 3.1 已实测可用尺寸

| 比例 | 尺寸 | 像素 | 用途 |
|------|------|------|------|
| 1:1 | `1024x1024` | 1.05 M | 头像/方图 |
| 1:1 | `2048x2048` | 4.19 M | 2K 方图 |
| 3:2 | `1536x1024` | 1.57 M | 摄影横构图 |
| 2:3 | `1024x1536` | 1.57 M | 摄影竖构图 |
| 4:3 | `1216x912` | 1.11 M | 老式横屏 |
| 3:4 | `912x1216` | 1.11 M | 老式竖屏 |
| 5:4 | `1280x1024` | 1.31 M | — |
| 16:9 | `2048x1152` | 2.36 M | 2K 横 |
| 9:16 | `1152x2048` | 2.36 M | 2K 竖 |
| **16:9** | **`3840x2160`** | **8.29 M** | **4K 横(像素上限)** |
| 9:16 | `2160x3840` | 8.29 M | 4K 竖 |
| 21:9 | `2688x1152` | 3.10 M | 超宽影院 |
| 9:21 | `1152x2688` | 3.10 M | 超长竖 |
| 3:1 | `2400x800` | 1.92 M | 极限横幅 |
| 1:3 | `800x2400` | 1.92 M | 极限竖幅 |

### 3.2 故意违规的实测结果

| 违反规则 | 测试值 | HTTP |
|----------|--------|------|
| 长短比 > 3:1 | `2800x800`(3.5:1) | 502 |
| 边长非 16 倍数 | `1023x1024` | 502 |
| 像素 < 655,360 | `800x800` | 502 |
| 像素 > 8,294,400 | `3840x2240` | 502 |

---

## 4. 响应结构(非流式 `stream=false`)

### 4.1 顶层字段(节选高频字段,完整字段见 §4.3)

```json
{
  "id": "resp_0822c8eb7fc79e530169ee...",
  "object": "response",
  "created_at": 1745700000,
  "completed_at": 1745700060,
  "model": "gpt-image-2",
  "status": "completed",
  "output": [
    {
      "id": "ig_0822c8eb...",
      "type": "image_generation_call",
      "status": "completed",
      "result": "<base64_string>",
      "background": "opaque",
      "output_format": "jpeg",
      "quality": "high",
      "size": "3840x2160"
    },
    {
      "id": "msg_0822c8eb...",
      "type": "message",
      "status": "completed",
      "content": [
        { "type": "output_text", "text": "<模型对图像的简短描述>" }
      ]
    }
  ],
  "usage": { "input_tokens": 0, "output_tokens": 0, "total_tokens": 0 },
  "tool_usage": { "image_generation": { "...": "..." } },
  "error": null
}
```

### 4.2 `output[]` 元素类型

| `type` | 关键字段 | 说明 |
|--------|----------|------|
| `image_generation_call` | `result`(base64)、`size`、`output_format`、`quality`、`background` | 主图,**base64 路径:`output[?(@.type=='image_generation_call')].result`** |
| `message` | `content[].text` | 模型对图像的文字简介(可忽略) |

### 4.3 完整顶层字段清单(实测全集)

```
id, object, model, status, created_at, completed_at,
output, error, incomplete_details,
instructions, max_output_tokens, max_tool_calls,
metadata, moderation, parallel_tool_calls,
previous_response_id, prompt_cache_key, prompt_cache_retention,
reasoning, safety_identifier, service_tier, store,
temperature, text, tool_choice, tool_usage, tools,
top_logprobs, top_p, truncation, usage, user,
background, frequency_penalty, presence_penalty
```

---

## 5. 响应结构(流式 `stream=true`)

请求需带 `Accept: text/event-stream`,响应为 SSE。

### 5.1 事件序列

| 顺序 | `event` 类型 | 说明 |
|------|--------------|------|
| 1 | `response.created` | TTFB ~4s |
| 2 | `response.in_progress` | |
| 3 | `response.output_item.added` | image_generation_call 占位 |
| 4 | `response.image_generation_call.in_progress` | |
| 5 | `response.image_generation_call.generating` | |
| 6 | `response.image_generation_call.partial_image` | **含 `partial_image_b64`(base64)**;0~N 帧 |
| 7 | `response.output_item.done` | 含完整 `result` base64 |
| 8 | `response.output_item.added` (msg) | 文本输出占位 |
| 9 | `response.content_part.added` / `output_text.done` / `content_part.done` | 文本部分 |
| 10 | `response.completed` | 整个 response 副本 |

### 5.2 partial_image 事件示例

```
event: response.image_generation_call.partial_image
data: {
  "type": "response.image_generation_call.partial_image",
  "item_id": "ig_xxx",
  "output_index": 0,
  "sequence_number": 5,
  "partial_image_index": 0,
  "partial_image_b64": "<base64>",
  "size": "3840x2160",
  "quality": "high",
  "output_format": "jpeg",
  "background": "opaque"
}
```

### 5.3 最终图位置

最终完整图同时出现在两处,任选其一即可:

1. `response.output_item.done` 事件 → `data.item.result`
2. `response.completed` 事件 → `data.response.output[?(@.type=='image_generation_call')].result`

---

## 6. 错误响应

| HTTP | Body | 触发条件 |
|------|------|----------|
| `200` | 正常 JSON / SSE | — |
| `502` | `error code: 502`(纯文本 15 字节,**无详细信息**) | 参数违规 / 上游超时 / `n>1` / `background: transparent` |

⚠️ 502 不区分错误类型,**建议在中转层做客户端预校验**(`size` 4 条约束 + 不支持参数白名单),把 502 转成清晰的 400 报错。

---

## 7. 性能参考(实测)

| 配置 | TTFB | 总耗时 | 响应体积 | 图片体积 |
|------|------|--------|----------|----------|
| 1024×1024 jpeg q75 | — | ~20s | 195 KB | 145 KB |
| 1536×1024 jpeg q90 | — | ~50s | 235 KB | 175 KB |
| 1536×1024 png(默认) | — | ~56s | 2.89 MB | 2.17 MB |
| 3840×2160 jpeg q95 high | — | ~61s | 1.43 MB | 1.0 MB |
| 3840×2160 png high | — | ~103s | 15.2 MB | 11 MB |
| **3840×2160 jpeg q95 stream** | **~4.2s** | ~61s | 3.4 MB(含多帧) | 1.0 MB |

### 关键结论

- **流式把 TTFB 从 60s+ 降到 4s**,客户端体感速度提升一个数量级
- **JPEG q=95 视觉无损,响应体积只有 PNG 的 1/12**(4K 场景)
- **PNG 在 4K + high 时需要 ≥120s 读超时**,Cloudflare 等 CDN 默认 100s 会掐断
- 任何大图都建议优先用 JPEG

---

## 8. 快速示例

### 8.1 最简调用(curl)

```bash
curl -X POST https://xixiapi.cc/v1/responses \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-image-2",
    "input": "a cute orange cat",
    "tools": [{"type": "image_generation", "size": "1024x1024"}]
  }'
```

### 8.2 推荐生产配置(4K JPEG + 流式)

```bash
curl -N -X POST https://xixiapi.cc/v1/responses \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{
    "model": "gpt-image-2",
    "input": "a cinematic snow leopard at dawn",
    "stream": true,
    "tools": [{
      "type": "image_generation",
      "size": "3840x2160",
      "quality": "high",
      "output_format": "jpeg",
      "output_compression": 95,
      "partial_images": 2
    }]
  }'
```

### 8.3 解码 base64 → 图片(Python)

```python
import json, base64, requests

resp = requests.post(
    "https://xixiapi.cc/v1/responses",
    headers={"Authorization": f"Bearer {API_KEY}"},
    json={
        "model": "gpt-image-2",
        "input": "a red apple",
        "tools": [{"type": "image_generation", "size": "1024x1024",
                   "output_format": "jpeg", "output_compression": 90}],
    },
    timeout=180,
)
data = resp.json()
for item in data["output"]:
    if item.get("type") == "image_generation_call":
        with open("out.jpg", "wb") as f:
            f.write(base64.b64decode(item["result"]))
        break
```

---

## 9. 与官方 OpenAI Responses API 的差异

| 项 | 官方 OpenAI | xixiapi.cc |
|----|------------|------------|
| 模型名 | `gpt-image-1` | `gpt-image-2`(第三方版本) |
| 错误信息 | 详细 JSON 错误体 | 502 + 15 字节文本 |
| `webp` 输出 | 支持 | 静默忽略,返回 PNG |
| `n` 参数 | 支持(部分模型) | 502 |
| `background: transparent` | 支持(`gpt-image-1`) | 502(`gpt-image-2` 本身就不支持) |
| 其他 Responses API 顶层字段 | 标准 | 完全兼容 |

---

## 10. 编辑模式 (Image Editing)

`gpt-image-2` 支持两种工作模式,通过 `input` 字段的形态切换:

| 模式 | `input` 类型 | 用途 |
|------|--------------|------|
| **生成** (text → image) | string | 凭空创作,见 §2 |
| **编辑** (image + text → image) | 多模态 array | 基于现有图修改 |

### 10.1 编辑请求结构

```json
{
  "model": "gpt-image-2",
  "input": [
    {
      "role": "user",
      "content": [
        {"type": "input_text",  "text": "Add a small red Christmas hat on top, keep everything else the same"},
        {"type": "input_image", "image_url": "https://example.com/source.jpg"}
      ]
    }
  ],
  "tools": [
    {
      "type": "image_generation",
      "size": "1024x1024",
      "output_format": "jpeg",
      "output_compression": 90
    }
  ]
}
```

### 10.2 输入图来源(`image_url`)

支持两种形式:

| 来源 | 输入图格式 | 实测结果 | 备注 |
|------|------------|----------|------|
| **HTTPS URL** | png / jpeg / webp | ✅ 可用 | 网关自己抓取,**省客户端上行带宽** |
| **base64 data URI** | png | ✅ 可用 | `data:image/png;base64,...` |
| **base64 data URI** | jpeg | ✅ 可用 | `data:image/jpeg;base64,...` |
| **base64 data URI** | webp | ❌ 502(72s 后) | webp 仅 URL 形式可用,**不能内联** |

### 10.3 ⚠️ `input_fidelity` 在 xixiapi 上不支持

OpenAI 官方 Responses API 提供 `input_fidelity: low/high` 用于控制"保留原图程度",但 xixiapi 网关**完全拒收**该参数(任意位置 / 任意拼写均失败):

| 测试位置 / 拼写 | 结果 |
|------------------|------|
| `tools[0].input_fidelity: "high"` | 502(~4s) |
| `tools[0].input_fidelity: "low"` | 502(~4s) |
| `content[].input_fidelity: ...` | 502 |
| 顶层 `input_fidelity: ...` | 502 |
| `tools[0].fidelity: "high"`(改名) | 502 |
| `tools[0].image_fidelity: "high"`(改名) | 502 |

**保真度由模型默认行为决定,客户端无法控制。** 如需"严格保留原图、只动局部",建议在 prompt 里明确写出来,例如 `keep everything else exactly the same`。

### 10.4 性能参考(实测,1024×1024 输出 JPEG q=85~90)

| 输入方式 | 输入大小 | 耗时 | 输出大小 |
|----------|----------|------|----------|
| HTTPS URL(webp 1200×1200) | 73 KB | ~68 s | 100 KB |
| base64 PNG(原图 1200×1200) | 1.0 MB | ~57 s | 102 KB |
| base64 JPEG(原图 1200×1200) | 173 KB | ~63 s | 101 KB |

### 10.5 推荐实现策略(中转层)

```
客户端上传图 → 你的中转
                ↓
   ┌─ 客户端给 URL 且公网可达 → 直接透传 URL 给 xixiapi(最省带宽)
   ├─ 客户端给 base64 webp     → 服务端转 PNG 再传(webp 内联必 502)
   └─ 客户端给 base64 png/jpeg → 直接透传
                ↓
              不要附加 input_fidelity(传了必 502)
```

---

## 11. 已知问题与 TODO

- [ ] `error_code: 502` 信息缺失,建议中转层增加参数预校验函数
- [ ] `webp` 静默降级为 PNG —— 需要服务端二次编码才能真正出 webp
- [ ] `partial_images` 实际帧数由模型决定,客户端不能假设固定帧数
- [ ] 4K PNG + high 在默认 100s 超时下会被中间代理断流,需统一调到 ≥120s
- [ ] **编辑模式 webp 输入歧视**:URL 可,base64 不可 —— 中转层应统一在 base64 路径上转码
- [ ] **编辑模式 `input_fidelity` 缺失**:无法精确控制"保留原图程度",仅能靠 prompt 文案引导

---

*文档版本:1.0 — 基于 2026-04-27 实测数据*
