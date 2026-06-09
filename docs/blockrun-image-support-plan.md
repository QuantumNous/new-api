# BlockRun 渠道图像能力支持 — 实现计划

> 状态:**计划稿(待 review)** · 目标渠道:现有 `blockRun-openai-0603`(无需新建渠道类型)
> 范围:文生图 `gpt-image-2`(generations)+ 图生图 / 多图融合(image2image / edits,**JSON + base64 入站**)

---

## 1. 背景与结论

- BlockRun 官方 Go SDK(`github.com/BlockRunAI/blockrun-llm-go v0.11.0`)支持图像生成与编辑,模型含 `openai/gpt-image-2`($0.06–0.12/张,文生图+图生图通用,且是 Edit 默认模型)。
- new-api 现有 `relay/channel/blockrun` 适配器**只接入了 SDK 的 x402 支付函数**(`CreatePaymentPayload` / `ParsePaymentRequired`),图像 API 完全没接;`ConvertImageRequest` 直接返回 `image not supported`。
- 结论:**复用现有 BlockRun 渠道记录**,只需在 blockrun 适配器内补图像路由 + 转换,**不新增 channel type**。

### 关键 endpoint(SDK 源码确认)

| 能力 | 上游 endpoint | 请求体格式 |
|---|---|---|
| 文生图 generations | `POST {base}/v1/images/generations` | JSON `{prompt, model, size, n, quality}` |
| 图生图 image2image | `POST {base}/v1/images/image2image` | JSON `{prompt, model, image, mask?, size, n}` |

⚠️ image2image 的 JSON 字段名是 **`image`(单数)**:单图传字符串、多图融合传数组,都挂在 `image` 上(SDK `image.go:211/213`)。`mask` 与多图数组**互斥**。每张图必须是 base64 data URI(`data:image/...;base64,...`)。

---

## 2. 当前各方法行为诊断

| 方法 | 文件:行 | 图像请求时现状 | 是否要改 |
|---|---|---|---|
| `ConvertImageRequest` | adaptor.go:211 | 直接返回 `blockrun: image not supported` | ✅ 改 |
| `GetRequestURL` | adaptor.go:93 | 图像模式落入 default → 错误返回 `/v1/chat/completions` | ✅ 改 |
| `GetModelList` | adaptor.go:290 | 返回不含图像模型的 `ModelList` | ✅ 改(constants.go) |
| `DoResponse` | adaptor.go:283 | 非 Claude 已 delegate 到 `openaiAdaptor.DoResponse`,后者在 `RelayModeImagesGenerations/Edits` 分支调 `OpenaiHandlerWithUsage`(openai/adaptor.go:632) | ❌ **无需改** |
| `DoRequest` | adaptor.go:228 | x402 两段式签名,格式/模式无关;内部用 `GetRequestURL` 签名,改 URL 后自动一致 | ❌ **无需改** |
| `SetupRequestHeader` | adaptor.go:139 | 设 content-type + 支付签名,不设 x-api-key;JSON 图像请求适用 | ❌ **无需改** |

> 核心利好:**`DoResponse` 与 `DoRequest` 都不用动**,x402 支付链路对图像 endpoint 自动生效。

---

## 3. 中继链路(`relay/image_handler.go`)

客户端 → new-api `/v1/images/generations`(或 `/v1/images/edits`)→ `ImageHelper`:
1. `RelayMode` 由请求路径决定(`RelayModeImagesGenerations` / `RelayModeImagesEdits`,见 relay/constant/relay_mode.go:70-72)。
2. `adaptor.ConvertImageRequest(c, info, *request)`(image_handler.go:56)→ 转成上游 body。
3. `adaptor.DoRequest`(image_handler.go:93)→ blockrun x402 dance。
4. `adaptor.DoResponse`(image_handler.go:114)→ openai 图像 handler 整形 + usage。
5. `PostTextConsumeQuota` 计费,`n` 通过 `OtherRatio` 计入。

---

## 4. 代码改动清单

### 4.1 `relay/channel/blockrun/adaptor.go`

**(a) import 增加 relay 常量包**
```go
relayconstant "github.com/QuantumNous/new-api/relay/constant"
```

**(b) `GetRequestURL`:在 format switch 之前优先处理图像模式**
```go
func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
    switch info.RelayMode {
    case relayconstant.RelayModeImagesGenerations:
        return fmt.Sprintf("%s/v1/images/generations", info.ChannelBaseUrl), nil
    case relayconstant.RelayModeImagesEdits:
        return fmt.Sprintf("%s/v1/images/image2image", info.ChannelBaseUrl), nil
    }
    switch info.RelayFormat {
        // ... 现有 Claude / Gemini / default 分支保持不变 ...
    }
}
```
> 同一函数被 `DoRequest` 用于签名,改后两腿 URL 自动一致,x402 域不会错位。

**(c) `ConvertImageRequest`:按模式转换(替换现有 error 实现)**
```go
func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
    if request.Model == "" {
        return nil, errors.New("blockrun: image model is required")
    }
    switch info.RelayMode {
    case relayconstant.RelayModeImagesGenerations:
        // 文生图:OpenAI 兼容,纯 JSON 透传(复用 openai 适配器的 generations 分支)
        return a.openaiAdaptor.ConvertImageRequest(c, info, request)
    case relayconstant.RelayModeImagesEdits:
        // 图生图:构造 BlockRun image2image JSON body(JSON + base64 入站)
        return buildImage2ImageBody(&request)
    default:
        return nil, errors.New("blockrun: unsupported image relay mode")
    }
}
```

**(d) 新增 `buildImage2ImageBody`(本文件或新文件 `image.go`)**
```go
// buildImage2ImageBody 把入站的 OpenAI 风格 JSON 编辑请求映射为 BlockRun
// /v1/images/image2image 的请求体。image 字段:单图=字符串,多图融合=数组,
// 每张必须是 base64 data URI。mask 与多图数组互斥(由 BlockRun 强制,这里 fail fast)。
func buildImage2ImageBody(req *dto.ImageRequest) (any, error) {
    body := map[string]any{
        "prompt": req.Prompt,
        "model":  req.Model,
    }
    // 取 image(优先 req.Image,兼容客户端误用 req.Images)
    switch {
    case len(req.Image) > 0:
        body["image"] = req.Image      // json.RawMessage:字符串或数组原样透传
    case len(req.Images) > 0:
        body["image"] = req.Images
    default:
        return nil, errors.New("blockrun: image2image requires base64 data URI in `image`")
    }
    if len(req.Mask) > 0 {
        // mask 与多图融合互斥
        if common.GetJsonType(req.Image) == "array" {
            return nil, errors.New("blockrun: `mask` cannot be combined with multiple source images")
        }
        body["mask"] = req.Mask
    }
    if req.Size != "" {
        body["size"] = req.Size
    }
    if req.N != nil {
        body["n"] = *req.N
    }
    return body, nil
}
```
> `image_handler.go:66` 用 `common.Marshal(convertedRequest)` 序列化,map 内的 `json.RawMessage` 会被原样写出 → BlockRun 收到合法 `image` 字段。符合 CLAUDE.md Rule 1(只用 `common.*`)。

**(e) `DoResponse` / `DoRequest` / `SetupRequestHeader`:不改。**

### 4.2 `relay/channel/blockrun/constants.go`

在 `ModelList` 末尾追加图像模型(至少 `gpt-image-2`,建议补齐 edit-capable 集合):
```go
// Image (BlockRun image generation / image2image)
"openai/gpt-image-2",       // ChatGPT Images 2.0,文生图+图生图,Edit 默认模型
"openai/gpt-image-1",       // edit-capable
"openai/dall-e-3",
"google/nano-banana",       // edit-capable
"google/nano-banana-pro",   // edit-capable
"black-forest/flux-1.1-pro",
"xai/grok-imagine-image",
"xai/grok-imagine-image-pro",
"zai/cogview-4",
```
> 也可不改代码,直接在 `blockRun-openai-0603` 渠道管理端「模型」里手动补 `openai/gpt-image-2`。`ModelList` 仅作「填充默认模型」按钮的初始集合。

### 4.3 计费(运营配置,非代码)

- 给图像模型在 ratio / 价格设置里配置**按张价格**(BlockRun:`gpt-image-2` $0.06–0.12,`nano-banana-pro` $0.10–0.15 等),否则按默认计费导致与上游实际扣费(x402 链上)不一致。
- `n` 已由 `ImageHelper` 通过 `OtherRatio["n"]` 计入(image_handler.go:130),无需额外处理。

---

## 5. 风险与边界

1. **GitNexus 影响分析(已跑)**:`GetRequestURL` upstream 仅被 blockrun 自身 `DoRequest` 调用,**风险 LOW,改动局限 Blockrun 模块**,无跨模块/跨流程影响。
2. **x402 单笔上限**:`x402.go` 强制 ≤1 USDC/次。若 `n` 较大且单价高(如 `nano-banana-pro` × n),可能逼近/超上限导致签名被拒。建议文档提示用户控制 `n`,或后续按 `n` 做预校验。
3. **白标 / 响应 URL**:BlockRun 图像响应可能返回其 GCS 镜像 URL(`ImageData.BackedUp`)。直接透传会暴露上游 host。建议:
   - 文档推荐客户端用 `response_format=b64_json`(返回 base64,不暴露 host);或
   - Phase 2 再评估是否需要代理图片(参考 task 渠道的 content 代理思路)。
   - MVP 不阻塞,但需在交付说明里写明「url 为上游托管」。
4. **mask 校验**:`mask` + 多图数组互斥已在 `buildImage2ImageBody` fail fast。
5. **multipart 不支持**:本期 img2img 只接受 JSON + base64;客户端用 OpenAI 标准 multipart 二进制上传 `/v1/images/edits` 不在范围内(`openaiAdaptor.ConvertImageRequest` 的 multipart 分支不会被走到,因为我们对 edits 模式自行构造 body)。需在交付说明里明确。
6. **前端**:`web/default/.../channel-type-config.ts` 的「填充默认模型」按钮读取后端 `ModelList`,加模型后自动出现;预计无需改前端,落盘前确认一次。

---

## 6. 验证计划

- **编译**:`go build ./...`。
- **单测**:
  - `url_test.go`:新增 `GetRequestURL` 在 `RelayModeImagesGenerations` → `/v1/images/generations`、`RelayModeImagesEdits` → `/v1/images/image2image` 的用例。
  - `adaptor_test.go`:`ConvertImageRequest` generations 透传;edits 下 `buildImage2ImageBody` 的单图(字符串)/多图(数组)/mask 互斥/缺 image 报错 各一例。
- **端到端**(可选,需真实钱包):
  - 文生图:`POST /v1/images/generations` `{"model":"openai/gpt-image-2","prompt":"..."}` → 402→签名→重试→返回图像。
  - 图生图:`POST /v1/images/edits`(JSON)`{"model":"openai/gpt-image-2","prompt":"...","image":"data:image/png;base64,..."}`。

---

## 7. 改动文件汇总

| 文件 | 改动 |
|---|---|
| `relay/channel/blockrun/adaptor.go` | import relayconstant;`GetRequestURL` 加图像分支;`ConvertImageRequest` 按模式转换 |
| `relay/channel/blockrun/image.go`(新增,或并入 adaptor.go) | `buildImage2ImageBody` |
| `relay/channel/blockrun/constants.go` | `ModelList` 追加图像模型 |
| `relay/channel/blockrun/url_test.go` | 图像 URL 用例 |
| `relay/channel/blockrun/adaptor_test.go` | ConvertImageRequest / buildImage2ImageBody 用例 |
| 运营配置(非代码) | 图像模型按张计费 ratio |

> `DoRequest` / `DoResponse` / `SetupRequestHeader` / `x402.go` **不改**。
