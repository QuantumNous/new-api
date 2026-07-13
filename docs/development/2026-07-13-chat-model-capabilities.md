# 对话模型能力元数据

`GET /api/user/chat-models` 会把后台聊天模型配置中的能力元数据返回给桌面客户端，用于生成 OpenClaw provider 模型目录。

支持的字段：

- `api`：OpenClaw 请求 adapter，支持 `openai-completions`、`openai-responses` 和 `anthropic-messages`。
- `input`：OpenClaw 固定输入类型，必须包含 `text`，可额外包含 `image`、`video`、`audio`；OpenClaw 当前不接受 `file`/`document` 作为该字段的值。
- `contextWindow`：模型原生上下文窗口；`0` 表示未配置，用户接口会省略该字段。
- `contextTokens`：实际运行时上下文预算；`0` 表示未配置，当 `contextWindow` 已配置时不能大于它。
- `maxTokens`：模型最大输出 token 数；`0` 表示未配置，当 `contextWindow` 已配置时不能大于它。
- `reasoning`：是否支持推理能力。

管理员可通过 `POST /api/chat-models/` 和 `PATCH /api/chat-models/{id}` 写入这些字段。历史记录没有能力配置时按纯文本模型处理，即返回 `input: ["text"]`；上下文窗口和最大输出不会使用猜测值。

classic/default 两套管理页面都提供固定输入类型多选、API adapter 选择、上下文窗口、运行时上下文预算、最大输出和推理能力配置。PPTX 等文件输入不能通过扩展 `input` 枚举实现；后续应由 Responses/文件预处理链路把文件转换为 OpenClaw 和上游实际支持的输入内容。
