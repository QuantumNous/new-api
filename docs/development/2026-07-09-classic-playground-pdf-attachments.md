# Classic Playground 文件附件支持

## 背景

`/console/playground` 的 classic 前端聊天模式支持在发送按钮旁选择文件。当前版本支持 PDF、DOCX、XLSX、TXT、JSON，发送时前端提取文件文本，并把提取结果作为普通 `text` content part 放入本次聊天请求。

本次变更仅覆盖 `web/classic`。`web/default` 已有附件 UI 雏形，可作为后续参考，但本次不修改 default 前端。

## 行为

- 文件附件按钮显示在聊天输入区发送按钮旁，鼠标悬停时提示支持 PDF、DOCX、XLSX、TXT、JSON。
- 仅聊天模式支持文件附件；图片、视频和自定义请求体模式会禁用/清理临时文件选择。
- 当前限制为单个文件，最大 20MB。
- 支持格式：
  - PDF：使用 `pdfjs-dist` 提取文本型 PDF 内容。
  - DOCX：使用 `mammoth` 提取 Word 文档正文文本。
  - XLSX：使用 `xlsx` 读取工作表并转成文本。
  - TXT：使用浏览器 `File.text()` 读取文本内容。
  - JSON：使用浏览器 `File.text()` 读取内容；合法 JSON 会格式化后写入聊天上下文，非法 JSON 按原文本写入。
- `.doc` 和 `.xls` 不解析，选择后提示用户转换为 `.docx` 或 `.xlsx` 后上传。
- 用户选择文件后，前端立即提取文本。
- 文件解析期间附件 chip 显示 loading 状态，发送按钮禁用；如果用户按 Enter 触发发送，发送逻辑也会阻止请求。
- 文件解析成功后，即使输入框没有手动输入文字，用户也可以直接发送文件内容开启对话。
- 发送时按 `chat-file-inline` 示例的测试思路组装 content parts：
  - 用户输入作为一个 `type: "text"` part。
  - 每个文件的提取文本作为额外 `type: "text"` part，格式为 `File: <filename>\n\n<extracted text>`。
- 用户界面显示文件附件 chip；PDF、DOCX、XLSX 历史展示分别使用 `public/pdf.svg`、`public/docx.svg`、`public/xlsx.svg`，TXT/JSON 使用 `public/file.svg`。

## 存储策略

提取出的文件文本只通过临时 `apiContent` 用于当前请求，不保存到本地历史、IndexedDB 会话状态或后端 Playground 会话记录。历史消息只保留文件名用于展示，避免大文本占满浏览器存储或同步到后端。

从历史消息重新发送时，已保存的文件 chip 只作为展示，不会重新附带文件内容。

## 兼容性

该实现以普通文本请求兼容多数聊天渠道。扫描版 PDF、图片型 Office 内容或无法提取文本的文件会提示用户重新选择可解析的文件。
