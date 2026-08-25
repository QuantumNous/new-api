# Playground 文件与照片附件设计

## 目标

让 Playground 的 Attach 菜单真正支持上传图片和文本文件，并将附件作为当前聊天消息内容发送给模型，同时保留消息重试、刷新恢复和 Playground 记录所需的数据。

## 范围与限制

- 支持图片：PNG、JPEG、WebP、GIF。图片以 `data:` URL 作为 Chat Completions 的 `image_url` part。
- 支持文本文件：TXT、MD、CSV、JSON。文件在浏览器读取为 UTF-8 文本，以带文件名的 `text` part 发送。
- 单条消息最多 5 个附件；单个附件最大 10 MiB；文本附件读取后最大 1 MiB，超过限制拒绝发送。
- `PromptInput` 的选择、拖放和粘贴均复用现有附件机制；输入区展示附件 chip、图片预览和移除操作。
- 图片/视频生成模型的独立媒体接口目前不接受这些附件。若用户在媒体模型下提交附件，阻止发送并显示本地化提示；纯文本媒体提示仍保持现有行为。
- 不新增后端存储或数据库字段。附件数据随前端 Playground 消息及现有记录快照保存，刷新恢复后仍可重新发送。

## 架构与数据流

1. `PlaygroundInput` 将 `PromptInputMessage.files` 传给页面回调，并使用 `accept`、最大数量/大小和 `onError` 做第一层限制。
2. Playground 附件工具函数校验 MIME/扩展名，读取文本 data URL，并归一化为 `PlaygroundAttachment`：图片保留 data URL，文本保存文件名、MIME 和文本内容。
3. `createUserMessage` 将归一化附件存入当前 `MessageVersion`，可供 UI、持久化和重试复用。
4. `formatMessageForAPI` 调用 payload builder，将文本 prompt、文本附件和图片附件转换为 `ChatCompletionMessage.content` 数组。无附件时继续发送原有字符串，保持兼容。
5. `PlaygroundChat` 在用户消息中渲染附件 chip/缩略图；编辑用户文本只修改文本，不丢失附件。
6. 生成链路将附件随 `Message` 传递；媒体生成分支在有附件时拒绝请求，聊天分支继续通过现有流式/非流式 handler。

## 错误处理与安全

- 文件选择阶段拒绝未知 MIME/扩展名、空文件、超过 10 MiB 或超过 5 个附件，并通过 `PromptInput.onError` 显示翻译文案。
- 文本读取失败、非 UTF-8/无法解码或超过 1 MiB 时不发送该消息，保留用户已选附件并提示错误。
- API payload 只接受归一化后的图片 data URL 和文本内容；不把本地 blob URL、任意二进制或用户提供的 HTML 当作可执行内容。
- 渲染图片使用普通 `img`，文本附件通过消息 part 发送，不使用 `dangerouslySetInnerHTML`。

## 测试策略

- 纯函数测试：附件校验/归一化、data URL 文本解码、payload part 顺序及无附件兼容性。
- 组件测试：菜单打开文件/照片选择器、附件 chip/缩略图、移除、提交回调携带附件、错误提示。
- 页面/持久化测试：用户消息保留附件，聊天 payload 使用附件，媒体模型阻止带附件请求。
- 验证命令：`bun test`（Playground 相关测试）、`bun run typecheck`、`bun run lint`、`bun run build:check`。
