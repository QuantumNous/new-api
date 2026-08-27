# AI SDK 4×4 协议转换深度测试

该程序使用与当前 OpenCode `dev` 分支一致的 AI SDK 主版本和 provider 版本，真实调用 NewAPI，覆盖：

- Chat Completions：`@ai-sdk/openai-compatible@2.0.41`
- OpenAI Responses：`@ai-sdk/openai@3.0.84`
- Claude Messages：`@ai-sdk/anthropic@3.0.82`
- Gemini generateContent：`@ai-sdk/google@3.0.73`
- AI SDK Core：`ai@6.0.168`

同时应用 OpenCode 当前仓库中的两个相关补丁：

- `@ai-sdk/openai-compatible`：保留流式错误对象，而不是只保留 `error.message`；
- `@ai-sdk/google`：过滤转换后为空的 model content，避免 Gemini 拒绝空消息。

## 矩阵含义

本文中的 **A → B** 与项目约定一致：

- A：客户端使用的协议和 AI SDK provider；
- B：NewAPI 选中的上游原生协议；
- 列模型用于把请求路由到对应原生上游。

| 原生上游格式 | 测试模型 |
| --- | --- |
| Chat | `kimi-k2.7-code` |
| Responses | `gpt-5.6-terra` |
| Claude | `minimax-m3` |
| Gemini | `gemini-3.7-flash` |

因此完整深度模式是 4 个客户端格式 × 4 个原生上游格式 × 3 类场景。

## 场景

### 1. conversation

同一个 AI SDK 消息历史中连续执行：

1. 写入唯一上下文 marker；
2. 提交停车费复杂题并请求供应商公开的 reasoning summary/thought；
3. 强制流式工具调用，工具参数包含嵌套的 5 笔交易，AI SDK 自动执行后发起第二个模型 step；
4. 再发一轮，检查初始 marker、工具 receipt、题目结论是否都还存在。

该场景会发现：

- 流式 SSE 解析异常；
- tool call ID 为空、包含控制字符、回放后被目标协议拒绝；
- 参数分片形成空调用、重复调用或错误 JSON；
- assistant/tool 历史在下一 step 转换失败；
- 多轮上下文丢失；
- reasoning summary/thought 未投影回客户端。

停车题的确定性验收口径为：

- 所有现金转账完成后，司机和保安的**现金净额都是 0**；
- 但司机获得了价值 40 的停车服务而实际停车费净支付为 0；
- 因而司机在经济上获益 40，停车场/物业侧少收并损失 40 收入。

### 2. file

上传真实 `application/pdf` 文件，要求读取：

- `FILE_TOKEN: CEDAR-48291`
- `ROW_TOTAL: 137`
- `OWNER: SHUANGHUA`

如果某个源 AI SDK 在发出 HTTP 前就拒绝 PDF，结果标记为 `SDK UNSUPPORTED`，不会误判为 NewAPI 转换失败。Claude → Gemini 文件路径会真实发出 Claude Messages 风格文档请求，因此适合复现 ZCode 一类客户端的问题。

### 3. image

上传真实 PNG，检查：

- OCR 代码 `IMG-ORANGE-7391`；
- 3 个橙色圆形；
- 2 个蓝色方形。

## 安装与检查

```bash
cd tests/ai-sdk-protocol-matrix
bun install
bun run check
```

## 安全配置

密钥只从环境变量读取，程序不会把鉴权头或 query key 原样写入产物：

```bash
# PowerShell
$env:NEWAPI_API_KEY = "你的测试 key"
$env:NEWAPI_BASE_URL = "http://107.175.65.211:3000"

# Bash
export NEWAPI_API_KEY="你的测试 key"
export NEWAPI_BASE_URL="http://107.175.65.211:3000"
```

不要把真实 key 写进 `.env.example`、源码、README 或命令行参数。已经在聊天、截图或工单中公开过的 key，测试结束后应轮换。

## 先查看执行计划

```bash
bun run matrix --dry-run
```

默认 deep 模式预计最多约 112 次 HTTP 请求：每个单元格 conversation 约 5 次，file 1 次，image 1 次。工具首步使用 OpenCode/AI SDK 默认的 `auto` 选择，工具返回后的第二步禁用再次调用；默认输出上限为 8192 tokens，降低 reasoning 模型在正文前被截断的概率。

所有生成请求统一使用同一个全局输出 token 配置，不再存在场景级短输出限额。若要完全省略测试程序传给 `streamText` 的输出 token 限制，使用：

```bash
bun run matrix --confirm-live --no-max-output-tokens
```

此时 Chat、Responses 和 Gemini provider 使用各自上游默认值。Claude Messages 协议要求 `max_tokens`，`@ai-sdk/anthropic` 会按模型能力自动填写 SDK 默认值；测试程序不会主动指定该值。

## 运行完整 4×4

```bash
bun run matrix --confirm-live
```

为防止误触发付费请求，没有 `--confirm-live` 时程序拒绝联网执行。

## 精确复现问题

Chat → Gemini，重点检查 tool call ID 和工具回放：

```bash
bun run matrix --confirm-live \
  --source chat \
  --target gemini \
  --scenario conversation
```

Claude → Gemini，重点检查文件上传：

```bash
bun run matrix --confirm-live \
  --source claude \
  --target gemini \
  --scenario file
```

Smoke 模式只执行 Chat → Gemini conversation：

```bash
bun run matrix --confirm-live --mode smoke
```

也可以覆盖模型：

```bash
export MATRIX_CHAT_MODEL="kimi-k2.7-code"
export MATRIX_RESPONSES_MODEL="gpt-5.6-terra"
export MATRIX_CLAUDE_MODEL="minimax-m3"
export MATRIX_GEMINI_MODEL="gemini-3.7-flash"
```

## 产物

默认写入：

```text
artifacts/<run-id>/
├── manifest.json
├── summary.json
├── summary.md
└── cells/
    └── chat-to-gemini/
        ├── cell-result.json
        ├── conversation/
        │   ├── turn-01-context-seed/
        │   ├── turn-02-reasoning-puzzle/
        │   ├── turn-03-streaming-tool-lifecycle/
        │   └── turn-04-context-recall/
        ├── file/file-upload-pdf/
        └── image/image-upload-png/
```

每个操作目录记录：

- `sdk-input.json`：送入 AI SDK 的消息结构和 provider options；本地二进制以长度与 SHA-256 摘要记录；
- `sdk-full-stream.jsonl`：AI SDK 解析后的完整流事件；
- `sdk-result.json`：steps、tool calls/results、usage、provider metadata、异常和最终消息；
- `http-NNN.request.json` 与 `.body.txt`：AI SDK → NewAPI 完整请求；
- `http-NNN.response.json` 与 `.body.txt`：NewAPI → AI SDK 完整 HTTP/SSE 响应。

鉴权字段会被替换为 `[REDACTED]`。请求正文中的文件和图片 base64 会保留在 HTTP body 日志中，以便确认附件是否在客户端协议层正确编码。

## 服务端转换后请求的边界

客户端程序能够完整记录 **AI SDK ↔ NewAPI** 的线协议，但无法从客户端直接看到 **NewAPI → 模型上游** 的转换后请求。要证明某个字段在服务端出站时被改坏，应使用响应头/request ID 与测试服务器日志关联，并在服务器侧开启脱敏后的 relay 请求记录。

这两层证据应结合使用：

1. 本程序证明真实 OpenCode 同代 AI SDK 发出了什么、收到了什么；
2. NewAPI 服务端日志证明转换后真正发给上游的内容。

## 关于“思维链”

测试只检测供应商通过 API 公开返回的 `reasoning summary`、`reasoning_content`、Claude thinking 或 Gemini thought。没有检测到公开 reasoning 会标记 `WARN`，但不能据此断言模型没有内部推理。测试不要求、也不应记录模型私有完整思维链。
