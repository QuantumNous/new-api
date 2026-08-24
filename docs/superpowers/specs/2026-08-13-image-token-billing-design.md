# 图片真实 Token 计费设计

## 目标

将图片计费统一到“有上游真实 token usage 就按百万 token 计费”的口径，同时保留没有可靠 token usage 的图片模型按次计费。此次不使用本地估算 token 伪装供应商 usage，也不改变供应商本身按次计费的模型。

## 当前事实

- Codex `gpt-image-2` 通过 `tool_usage.image_gen` 返回图像输入/输出 token，并已经走文本额度结算链路。
- Gemini 的生成式图片模型可以通过 `UsageMetadata` 返回候选输出的图像 token；Gemini 图片 tiered expression 使用 `img_o` 变量。
- `imagen-*` 的专用预测接口当前 handler 使用固定 token 兜底，不属于可靠的上游真实 usage。
- `grok-imagine-image*`、Jimeng、Minimax、BlockRun 等图片路径当前没有可靠的 token usage，继续使用按次价格。
- 图片请求在 `relay/image_handler.go` 中统一进入预扣、响应 usage 解析和 `PostTextConsumeQuota` 结算。

## 计费分类

### Token 计费

只有以下条件同时满足时，模型才使用百万 token 计费：

1. 模型定价配置为 token 模式（`quota_type=0`，即 `model_ratio`/`completion_ratio` 体系）；
2. 响应 handler 能提供真实的输入/输出 token usage；
3. usage 映射保留图像 token 子类，或已明确其 token 已包含在普通输入/输出总量中。

目标覆盖：

- Codex image generation/edit；
- Gemini 生成式图片模型的真实 `UsageMetadata` 路径；
- 未来新增、且满足上述 usage 契约的 OpenAI 兼容图片路径。

### 按次计费

以下路径保持 `quota_type=1`/`model_price` 计费，不生成合成 token：

- `grok-imagine-image*`；
- `imagen-*` 专用预测接口；
- Jimeng、Minimax、BlockRun 及其他当前响应没有可靠 token usage 的图片路径。

## 计费数据流

```text
图片请求
  -> ImageHelper 预扣
  -> 渠道 handler 解析响应
      -> token 模式：返回真实 PromptTokens / CompletionTokens
         并映射 ImageTokens / CompletionTokenDetails.ImageTokens
      -> 按次模式：返回空 usage，由 model_price + n 结算
  -> PostTextConsumeQuota
      -> 按 token ratio 或 model_price 结算
```

### Codex

- 从 `tool_usage.image_gen` 读取 `input_tokens`、`output_tokens`、`total_tokens`。
- 图生图额外读取 `input_tokens_details.image_tokens`，映射到 `PromptTokensDetails.ImageTokens`。
- 输出图像 token 映射到 `CompletionTokenDetails.ImageTokens`；普通文本 token 保持在普通输入/输出字段。
- 上游生成图片但 usage 缺失时，保留现有安全兜底并记录错误；增加测试确保不会把图生图输入静默算成免费。

### Gemini

- 继续使用 `UsageMetadata` 的 prompt/candidate token counts。
- 候选 `IMAGE` modality 映射到 `CompletionTokenDetails.ImageTokens`。
- tiered expression 通过 `img_o` 计算图片输出 token 价格。
- 专用 `imagen-*` 预测响应中的固定 258 token 不作为真实 usage，继续按次计费。

### 通用 OpenAI 兼容图片路径

- 只有响应携带明确 `usage` 时才允许该模型配置为 token 模式。
- 没有 usage 的响应不能通过“生成一张图 = 1 token”来伪造 token 计费；该模型应继续按次。
- 对 token 模式发生 usage 缺失的情况增加诊断日志和回归测试，避免无声少收费。

## 定价与公开展示

- 保留当前线上实际定价，不在本变更中重新设定价格。
- `gpt-image-2` 以线上 pricing API 返回值为准：输入 `$3/M`、输出 `$18/M`、图像输入 `$4.8/M`（Economy 组）。
- 代码默认值与线上覆盖值不一致时，补齐测试并视为配置一致性问题处理，避免重启或清空配置后出现不同账单。
- 公开 pricing API 和前端继续使用 `quota_type` 区分 token 模型与按次模型；token 模型展示每百万 token，按次模型展示每请求/张。

## 错误与安全边界

- 不将供应商按次价格改写成合成 token 价格。
- 不在响应返回后动态改变已经完成的预扣模式；计费模式必须在请求前由模型配置确定。
- token 模式的 handler 必须返回非零、可解释的 usage；否则记录明确诊断并走现有安全结算路径。
- 保持现有按次模型的 `n` 乘数只应用一次。

## 测试计划

1. **Codex usage 映射**：文生图、图生图、输入图 token、输出图 token、usage 缺失兜底。
2. **Gemini usage 映射**：`IMAGE` 候选 modality、tiered `img_o` 结算、专用 `imagen-*` 按次路径。
3. **通用结算**：输入/输出/图像 token ratio 组合计算；按次模型保持 `model_price * n`。
4. **公开定价**：token 与按次模型的 `quota_type`、价格字段和 endpoint 展示一致。
5. **回归验证**：运行受影响 Go package 的 targeted tests，再运行完整可用的 lint/typecheck/test；如果工作区现有未完成改动阻塞全量测试，记录具体阻塞项。

## 非目标

- 不为没有供应商 token usage 的模型新增图像 token 估算算法。
- 不在本次变更中调整套餐、用户组倍率、充值或支付逻辑。
- 不修改视频、音频或普通文本模型的计费口径。
