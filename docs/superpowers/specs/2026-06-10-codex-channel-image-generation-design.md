# Codex 渠道图像生成支持(方案 B)— 设计文档

- 日期:2026-06-10
- 模块:`relay/channel/codex/`
- 状态:待审

## 1. 背景与目标

线上有一批 `codex` 类型渠道(均为 ChatGPT 订阅 OAuth 账号,生产在跑)。当前 codex 渠道只支持文本(`/v1/responses`、`/v1/responses/compact`、`/v1/chat/completions`),`ConvertImageRequest` 直接返回 `endpoint not supported`(`relay/channel/codex/adaptor.go:37`)。

目标:让 codex 渠道通过**标准 OpenAI 图像接口** `/v1/images/generations` + `/v1/images/edits` 出图,纯增量、不动现有文本中继,对机群尽量低运维。

### 已验证的事实(实测,2026-06-10)

用一个 **ChatGPT Plus**(非 Pro,`plan_type=plus`)OAuth 账号直接打上游 `https://chatgpt.com/backend-api/codex/responses`,确认:

- 出图能力存在,**Plus 即可**,不限 Pro。机制 = Responses 原生 `image_generation` 工具,**不是独立图像端点/独立 image 模型**。
- 承载请求的是一个**文本模型**(实测用 `gpt-5.4`),图像模型 `gpt-image-2` 作为 `tools[].model` 传入,`tool_choice={type:image_generation}`。
- 返回 SSE 含 `response.image_generation_call.*`,base64 图片从 `response.output_item.done` 的 `image_generation_call.result` 取得(**不在** `response.completed.output` 里)。
- 上游返回两个用量对象:
  - `response.usage`(承载模型开销):input 1579 / output 34 / total 1613 —— 与图片无关的固定壳开销。
  - `response.tool_usage.image_gen`(真正出图用量,low/1024²):`input_tokens:21`、`output_tokens:196`(`image_tokens:196`)、`total:217`。`image_tokens` 干净反映 size×quality。
- 走订阅 OAuth 这条路是**订阅覆盖 + 限流**,无 API key 按量扣费;`image_gen` token 反映订阅内配额,不等于美元成本。
- **`tool.model` 不是严格选择器**:实测探测 `gpt-image-1/1.5/2/3`、`gpt-image-2-mini`(虚构)、`dall-e-2/3` **全部"出图成功"**(连不存在的名字都照画)。说明 codex 后端**只有一套原生图像能力**,`tool.model` 仅作标签透传,不在多个不同模型间切换。**真正决定画质的是 `quality`/`size` 参数,不是模型名。**
- `action=edit`(图生图)实测通过:`input_image` data URL 被接受;`image_gen.input_tokens` 含输入图的 `image_tokens`(实测 256),故方案 b 的 token 计费天然覆盖 edits 输入图成本。

参考实现(三方一致,均为 Responses + image_generation 工具 over OAuth):本地 sub2api(`backend/internal/service/openai_images_responses.go`,承载 gpt-5.4-mini)、smturtle2/codex-image-gen(承载 gpt-5.5)、openclaw issue #70703(Hermes)。验证脚本:`/tmp/codex_image_test.py`。

## 2. 决策汇总(brainstorming 已敲定)

| 项 | 决策 |
|---|---|
| 覆盖范围 | **generations + edits** |
| 客户端模型名 | **对外只暴露一个 `gpt-image-2`**(上游只有一套图像能力,模型名仅标签);`gpt-image-*` 透传到 `tool.model` 以便将来做计费别名档;需逐个加进各渠道「模型」列表才能路由 |
| 承载文本模型 | **三层**:per-channel 覆盖(`ChannelSetting.image_carrier_model`)> 全局设置(`model_setting` codex 图像承载模型)> 代码常量默认 `gpt-5.4`(`defaultImageCarrierModel`)。机群零改动即可用;官方改名时改一处全局设置救全部。**非纯写死** |
| 计费 | **方案 b:按 `tool_usage.image_gen` token,走 gpt-image-2 的 model ratio**;承载 1613 token 默认不计 |
| 路由启用 | 逐个把 `gpt-image-2` 加进渠道「模型」列表(用户已确认接受手动) |

## 3. 架构与数据流

```
POST /v1/images/generations|edits  (model=gpt-image-2)
  → distributor 路由到含 gpt-image-2 的 codex 渠道
  → relay/image_handler.go ImageHelper
      → adaptor.ConvertImageRequest  (拼 Responses+image_generation body)
      → adaptor.GetRequestURL        (→ /backend-api/codex/responses)
      → adaptor.DoRequest            (SSE 上游)
      → adaptor.DoResponse → RelayImageOverCodex
            · 抽 image_generation_call.result(base64)
            · 抽 tool_usage.image_gen 用量
            · 写 dto.ImageResponse 给客户端
            · 返回 dto.Usage
      → PostTextConsumeQuota          (token × gpt-image-2 ratio)
```

新增/改动全部在 `relay/channel/codex/` + 模型/比率配置,**不触碰** 文本路径。

## 4. 详细设计

### 4.1 模型与路由(`constants.go`)
- 把 `gpt-image-2` 加入 `GetModelList()`(便于"填充模型"按钮 + 渠道测试)。注意:`gpt-image-2` 不应进入 `baseModelList`(那会被 `withCompactModelSuffix` 加 `-compact` 变体);单独追加到 `ModelList`。
- 路由仍依据各渠道 DB 的 `models` 字段;启用某渠道出图需手动加 `gpt-image-2`。
- 走图像路径的判定:请求(映射后)`model` 以 `gpt-image-` 前缀开头。

### 4.2 承载模型(三层解析)
解析优先级 per-channel > 全局 > 代码默认:
1. **per-channel**:`info.ChannelSetting.ImageCarrierModel`(新增字段,留空=回退下一层)。需在 ChannelSetting 结构 + 渠道编辑页表单加该字段。
2. **全局设置**:`model_setting` 新增"codex 图像承载模型"(留空=回退默认),一处改对所有 codex 渠道生效——应对官方改名/下线。
3. **代码默认**:常量 `defaultImageCarrierModel = "gpt-5.4"`。
- 实现一个 `resolveImageCarrierModel(info) string` 按上述顺序取第一个非空值。

### 4.3 `ConvertImageRequest`(替换现有 not-supported 实现)
- 入参 `dto.ImageRequest`;`action` = generations→`generate` / edits→`edit`。
- 校验 `request.Model` 前缀 `gpt-image-`,否则报错。
- 设 `info.IsStream = true`(确保 `SetupRequestHeader` 用 `Accept: text/event-stream`)。
- 构造 body(map 或 typed):
  ```jsonc
  {
    "instructions": "",
    "stream": true,
    "store": false,
    "reasoning": {"effort": "medium", "summary": "auto"},   // 与实测一致;实测 reasoning_tokens=0,effort 在此场景近乎无影响
    "parallel_tool_calls": true,
    "include": ["reasoning.encrypted_content"],
    "model": "<承载模型>",
    "tool_choice": {"type": "image_generation"},
    "input": [{"type":"message","role":"user","content":[
        {"type":"input_text","text":"<prompt>"}
        // edits: 追加 {"type":"input_image","image_url":"<data URL>"} ...
    ]}],
    "tools": [{"type":"image_generation","action":"generate|edit","model":"<gpt-image-*>",
        // 可选透传: size / quality / background / output_format / output_compression / moderation / n
        // edits mask: "input_image_mask": {"image_url":"<data URL>"}
    }]
  }
  ```
- 参数映射来自 `dto.ImageRequest` 字段(Size/Quality/Background/OutputFormat/OutputCompression/Moderation/N/Images/Image/Mask)。空值不传。

### 4.4 `GetRequestURL`
- 增 `RelayModeImagesGenerations`、`RelayModeImagesEdits` 分支 → `/backend-api/codex/responses`。

### 4.5 `DoResponse` 图像分支 → 新函数 `RelayImageOverCodex(c, info, resp)`
- 流式读取 SSE,逐事件解析:
  - `response.output_item.done` 且 `item.type==image_generation_call` 且 `item.result!=""` → 收集 base64(多张=n)。
  - `response.completed` → 取 `response.tool_usage.image_gen` 用量。
- 写客户端:`dto.ImageResponse{Created, Data:[]ImageData{B64Json, RevisedPrompt}]}`(codex 只回 base64,故始终 `b64_json`;若客户端要 url,文档说明不支持/忽略)。
- 返回 `dto.Usage`:`PromptTokens=image_gen.input_tokens`、`CompletionTokens=image_gen.output_tokens`、`TotalTokens=image_gen.total_tokens`;若上游缺失则回退最小值(ImageHelper 会兜底 ≥1)。
- 错误事件(`response.failed` / 错误 JSON)→ 返回 `types.NewAPIError`。

### 4.6 计费(方案 b)
- `gpt-image-2` 在 `ratio_setting` 配 **model ratio**(token 计费,`PriceData.UsePrice=false`)。
- DoResponse 返回的 Usage × ratio 经 `PostTextConsumeQuota` 结算。
- `N` 不另乘比率:`image_gen.output_tokens` 已含 n 张的总量(plan 阶段需用 n>1 实测确认聚合行为)。

## 5. 兼容性与安全
- 纯增量:仅新增 `gpt-image-*` 分支、新模型、新响应函数、可选渠道设置字段。
- 现有 gpt-5.x 文本中继(responses/compact/chat)行为不变。
- 白标:沿用现有 codex 渠道(上游即 chatgpt 后端),无新增上游名泄漏。

## 6. 测试策略
- 单测 `ConvertImageRequest`:generate / edit 两种 body 结构正确(承载模型、tool.model、tool_choice、input、mask)。
- 单测 `RelayImageOverCodex`:用**真实 SSE fixture**(已抓到样本)→ 断言 `dto.ImageResponse` 与 `dto.Usage` 正确;覆盖多张(n>1)与错误事件。
- e2e:给一个 codex 渠道加 `gpt-image-2` + 配 ratio,调 `/v1/images/generations` 验证出图 + 计费日志;edits 用参考图 + mask 验证。

## 7. plan 阶段待核实(不影响整体设计)
1. `/v1/images/edits` multipart 的输入图/mask 最终落到 `dto.ImageRequest` 的哪个字段、什么格式(URL vs base64);据此写 `input_image` data URL 转换。`middleware/distributor.go:361-372` 仅处理 model 名,图片体解析在 image_handler/valid_request 链路。
2. `n>1` 时 `tool_usage.image_gen.output_tokens` 是否聚合所有图(决定 N 是否额外计入)。
3. 承载模型三层配置的接线位置:ChannelSetting 结构 + 渠道编辑页表单(`image_carrier_model`),以及 `model_setting` 全局"codex 图像承载模型"字段 + 控制台 UI。
4. `gpt-image-2` 的 model ratio 默认值与配置位置(`setting/ratio_setting/`)。

## 8. 非目标(YAGNI)
- 不做 codex CLI 文本请求自动注入 image_generation 工具(sub2api 的"路径 B");本设计只做图像接口。
- 不做 url 形式返回、不做 partial_images 流式回传(只回最终图)。
- 不做承载模型多级 fallback。

## 9. 已知限制 / 后续增强(刻意不做,2026-06-10)
**图像输入 token 不按「图像输入价格」计费。** 上游 `image_gen` 返回了图像/文本 token 细分(`input_tokens_details.image_tokens / text_tokens`,edit 实测输入图约 256 image_token),但 `RelayImageOverCodex` 只透出合计 `PromptTokens`、未设 `usage.PromptTokensDetails.ImageTokens`,故计费引擎对输入一律按文本输入价计,渠道的「图像输入价格」对本路径不生效。

不做原因:① 输入仅占总成本约 5%,图像价($8)与文本价($5)差异 ≈ 总账单 0.15%,收益极小;② 暗坑——`relay/helper/price.go` 取 imageRatio 时丢弃 `GetImageRatio` 的 ok 标志(`imageRatio, _ = ...`),模型未配图像倍率时默认 **0**;一旦透出 `ImageTokens`,`text_quota.go` 会把这些 token 从合计减去再 `×imageRatio(=0)` → 输入图被算成"免费",**少收费**。

将来要让「图像输入价格」精确生效的安全顺序:(a) 先给 gpt-image-2 配「图像输入价格」(如 $8/M,imageRatio≈1.6);(b) 把 price.go 的 imageRatio 未配兜底由 0 改 1(防免费,需评估对其他渠道影响);(c) 在 `RelayImageOverCodex` 设 `PromptTokensDetails.ImageTokens / TextTokens`;(d) e2e 校验 edits 账单。代码内同一备注见 `relay/channel/codex/image.go`(usage 赋值处)。
