# OpenCode Zen / Go

选择 OpenCode 渠道（type 65）：`opencode-zen` 对应 `https://opencode.ai/zen`，`opencode-go` 对应 `https://opencode.ai/zen/go`。

## 请求头

自动补齐 `User-Agent`、`x-opencode-client`、`x-opencode-project`、`x-opencode-session` 和 `x-opencode-request`，兼容 OpenCode CLI 1.18.31。默认客户端为 `cli`，项目为 `global`。

- 保留有效的客户端 `ses_...` / `msg_...`、项目、客户端标识及 OpenCode User-Agent。
- 缺失或格式无效的 ID 按官方算法生成：时间戳与共享计数编码为 12 位十六进制，再拼接 14 位加密随机 Base62；session 使用倒序编码。
- 生成的 ID 仅在当前请求及其重试中复用。跨请求会话亲和需要客户端持续传入同一 `x-opencode-session`，不会按用户或令牌合并全部对话。
- 渠道请求头覆盖仍具有最终优先级；固定或无效的 ID 覆盖值可能导致上游拒绝。

## 模型与端点

| Zen 模型 | 上游端点 |
| --- | --- |
| MiMo Free、Ling Free、Nemotron Free、Big Pickle | `/v1/chat/completions` |
| Muse Spark Contributor Free | `/v1/responses` |
| `jev-1.13`、`jev-1.13-free` | `/v1/systemone` |

近期新增模型按以下端点路由：

| 渠道 | 上游端点 | 模型 ID |
| --- | --- | --- |
| Zen | `/v1/responses` | `gpt-6-astra`、`gpt-6.1-sol`、`gpt-6-sol`、`gpt-6-luna`、`grok-4.7`、`muse-spark-1.3` |
| Zen | `/v1/messages` | `claude-fable-5-1`、`claude-opus-5-5`、`claude-sonnet-5-5`、`claude-sonnet-4`、`qwen3.8-flash` |
| Zen | `/v1/models/{model}:generateContent` | `gemini-3.8-flash` |
| Zen | `/v1/chat/completions` | `deepseek-v4.1-flash`、`deepseek-v4-flash-vision-exp`、`glm-5.3-flash`、`glm-5.3`、`qwen3.8-max`、`space-bunny-free`、`longcat-2.5-preview-free` |
| Go | `/v1/responses` | `grok-4.7`、`grok-4.6`、`gpt-6-luna`、`muse-spark-1.3-contributor` |
| Go | `/v1/messages` | `qwen3.8-flash`、`qwen3.5-plus` |
| Go | `/v1/chat/completions` | `glm-5.3-flash`、`glm-5`、`kimi-k2.5`、`longcat-2.0`、`longcat-2.5-preview-free`、`deepseek-v4.1-flash`、`deepseek-v4-flash-vision-exp`、`deepseek-flash`、`mimo-v2.6-flash`、`mimo-v2.6-pro`、`mimo-v2-pro`、`mimo-v2-omni`、`hy4-preview`、`hy3-preview`、`omen-alpha` |

Zen 已下架 `qwen3.7-max`、`qwen3.7-plus`、`hy3-free`、`x-preview-f-free`（上游返回 Model is unavailable），本站路由表同步移除；Go 仍保留 qwen3.7 系列。
Go 渠道的 `space-bunny-free` 经渠道实测仅支持 Chat；作为 RouteOnly 例外保留 Chat 路由，不加入 Go 静态模型回退列表。

Chat、Responses、Claude Messages 和 Gemini generateContent 入站均按 Zen/Go 的模型协议表选上游端点：同协议保持原生格式，异协议双向转换，优先于全局或渠道请求体透传；未登记模型保留原透传规则。模型映射后按实际上游模型名匹配。count_tokens、Responses compact 等非文本生成端点不自动转换。

动态模型列表仍来自上游 `/v1/models`；未登记的 Alpha 模型可手动配置并使用其实际支持的端点，不按名称猜测协议。模型列表可能与文档不同，隐藏模型和账号权限仍由上游决定。

上游地区、账号权限和限流规则仍然生效；请求头兼容不代表所有模型都可使用。

`-free` 表示上游产品名称，不自动修改本站计费倍率。免费模型可能用于提供方的数据收集，不要发送敏感内容。

## Free 文本请求

既有 Free 兼容模型及 Big Pickle 自动使用上游流式并补齐 `bash/edit/glob/grep/read`；`space-bunny-free` 只走 Chat 端点，不启用该请求整形。客户端仍按原协议接收 JSON 或 SSE，保留实际 usage。

- 保留调用方已有工具及选择；无工具的 Chat 请求默认禁用工具调用，Responses 保持上游支持的自动选择。补入工具的调用会被拒绝，不交给客户端执行。
- 非流式聚合上限 32 MiB，单个 SSE 事件上限 8 MiB；遵守客户端取消及流式空闲超时，缺少结束事件、上游报错或截断均按失败处理。
- 未登记模型的请求体透传跳过兼容处理；JEV、付费模型和 `space-bunny-free` 不套用。补入声明会计入上游输入用量，不改变本站倍率或渠道认证。

## JEV

JEV 只接受原生 `POST /v1/systemone`，不支持 Chat/Responses 转换或流式。OpenCode Go 不支持该端点。渠道测试自动选择 System One 并使用非流式请求。

```json
{
  "model": "jev-1.13-free",
  "state": "The customer reports a failed payment.",
  "questions": {
    "is_urgent": { "type": "noul", "instructions": "Does this require urgent attention?" }
  }
}
```

`state`、`questions`、附加字段及上游响应原样传递；模型映射只改写 `model`，渠道参数覆盖按原有规则应用。用量从 `usage.input_tokens/output_tokens` 提取。

参考：[Zen 文档](https://opencode.ai/docs/zen/) · [Go 文档](https://opencode.ai/docs/go/) · [CLI 请求头](https://github.com/anomalyco/opencode/blob/v1.18.31/packages/opencode/src/session/llm/request.ts) · [ID 算法](https://github.com/anomalyco/opencode/blob/v1.18.31/packages/schema/src/identifier.ts)
