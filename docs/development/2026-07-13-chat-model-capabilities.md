# 对话模型能力元数据

`GET /api/user/chat-models` 会把后台聊天模型配置中的能力元数据返回给桌面客户端，用于生成 OpenClaw provider 模型目录。

支持的字段：

- `api`：OpenClaw 请求 adapter，支持 `openai-completions`、`openai-responses` 和 `anthropic-messages`。
- `input`：OpenClaw 固定输入类型，必须包含 `text`，可额外包含 `image`、`video`、`audio`；OpenClaw 当前不接受 `file`/`document` 作为该字段的值。
- `contextWindow`：模型原生上下文窗口；`0` 表示未配置，用户接口会省略该字段。
- `contextTokens`：实际运行时上下文预算；`0` 表示未配置，当 `contextWindow` 已配置时不能大于它。
- `maxTokens`：模型最大输出 token 数；`0` 表示未配置，当 `contextWindow` 已配置时不能大于它。
- `thinkingLevels`：该条模型在当前 provider 下实际支持的思考深度 ID，顺序也是客户端展示顺序。后端不维护固定枚举；不同模型（包括同一系列的不同模型）可以保存完全不同的列表。
- `thinkingDefault`：可选默认思考深度，必须包含在 `thinkingLevels` 中。
- `reasoning`：兼容旧客户端的粗粒度推理标志。配置了 `thinkingLevels` 时由后端根据列表是否包含非 `off` 档位派生；未配置列表时仍可单独维护。
- `supportsFastMode`：当前模型和 provider 是否支持 OpenClaw 快速模式。默认 `false`；客户端只有在该字段为 `true` 时才展示“标准 / 快速”选择。

管理员可通过 `POST /api/chat-models/` 和 `PATCH /api/chat-models/{id}` 写入这些字段。`thinkingLevels` 最多 32 项，服务端只做格式、去重和默认值归属校验，不按模型名猜测能力，也不内置 OpenAI、MiniMax 或其他 provider 的档位表。传空数组可清除模型的思考档位和默认值；此时 `reasoning` 仍按请求中的兼容开关维护。快速模式同样不按模型名称或 provider 猜测，必须由管理员为确认支持的模型显式开启 `supportsFastMode`。

思考档位 ID 会由 OpenClaw 作为 `reasoning_effort` 发送，后续是否直传或转换由对应 relay channel adapter 决定。只有上游模型和 adapter 都实际支持的值才应写入列表；例如 GPT 模型可以配置其上游支持的 `xhigh` / `max`，MiniMax 等模型必须按对应渠道的真实请求契约单独配置，不能因为模型名称相近而复用。

历史记录没有能力配置时按纯文本模型处理，即返回 `input: ["text"]`；上下文窗口、最大输出和思考档位都不会使用猜测值。桌面端会把每条模型的 `thinkingLevels` 投影给 OpenClaw，最终选择器仍以 `sessions.list` 对当前 model/provider 解析后的结果为准。因此后台未配置某个模型时只出现 `off` 是预期的安全降级，不代表相近型号也只有 `off`。

classic/default 两套管理页面都提供固定输入类型多选、API adapter 选择、上下文窗口、运行时上下文预算、最大输出、动态思考档位/默认值、兼容推理开关和“支持快速模式”开关。思考档位是可创建的多选项：页面内置 `off`、`minimal`、`low`、`medium`、`high`、`xhigh` 作为常用快捷候选，同时通过 `GET /api/chat-models/thinking-levels` 汇总后台已经配置过的档位；遇到 provider 新档位时仍可输入后按 Enter 添加。内置值和接口返回值都只用于候选展示，不代表当前模型支持这些档位，也不构成后端固定枚举。默认思考深度只能从当前模型已选择的档位中选择，删除档位时不再有效的默认值会自动清空。PPTX 等文件输入不能通过扩展 `input` 枚举实现；后续应由 Responses/文件预处理链路把文件转换为 OpenClaw 和上游实际支持的输入内容。
