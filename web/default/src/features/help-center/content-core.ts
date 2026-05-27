import type { HelpArticle } from './types.ts'

export const CORE_HELP_ARTICLES: HelpArticle[] = [
  {
    slug: 'getting-started',
    categoryKey: 'getting-started',
    title: 'aiapi114 新手入门',
    summary: '适合第一次使用 aiapi114 的用户，目标是在 10 分钟内完成账号、API Key、模型名和首次调用。',
    difficulty: '新手',
    readTime: '约 6 分钟',
    sourceBasis: [
      'docs/reference-help-docs/codexzh-ai-hub-api/quick-start.md',
      'docs/reference-help-docs/ikuncode/guide/registration.md',
      'docs/reference-help-docs/ikuncode/guide/create-key.md',
      'docs/reference-help-docs/codexzh-ai-hub-api/quick-start.md',
    ],
    sections: ['适合先读这篇的人', '你需要准备什么', '操作步骤', '检查清单', '下一步'],
    markdown: `# aiapi114 新手入门

这篇文档帮助你从零开始完成 aiapi114 的第一次可用配置。先记住三个信息：**Base URL**、**API Key** 和 **模型名**。

## 适合先读这篇的人

- 你刚注册 aiapi114，还不知道从哪里开始。
- 你想把 aiapi114 接入客户端、代码或命令行工具。
- 你已经有 API Key，但第一次调用仍然失败。

## 你需要准备什么

| 项目 | 说明 | 建议 |
| --- | --- | --- |
| aiapi114 账号 | 用于登录控制台、查看余额和创建 API Key。 | 先完成平台要求的登录验证。 |
| 可用额度 | 调用模型前需要有可用余额或套餐额度。 | 首次测试建议选择低成本文本模型。 |
| API Key | 第三方工具和代码调用时使用。 | 只保存一次，不要公开完整 Key。 |
| 模型名 | 文本、图像、语音等模型的具体 ID。 | 从 aiapi114 模型列表复制，避免手动输入。 |

## 操作步骤

### 1. 注册并登录

打开 aiapi114 首页，进入注册或登录页面。完成登录后，先确认控制台可以正常打开。如果平台要求邮箱验证、两步验证或安全校验，请先完成验证。

### 2. 查看余额或套餐

进入钱包、充值、套餐或用量相关页面，确认账号已有可用额度。没有额度时，请先按页面提示充值或开通套餐。

### 3. 创建 API Key

进入 **令牌 / API Key** 页面，创建一个新的 Key。建议名称写清用途，例如“Cherry Studio 测试”或“本地开发”。

> 安全提醒：API Key 通常只在创建时完整显示。请保存到本地安全位置，不要发到公开群、截图、工单或代码仓库。

### 4. 复制 Base URL

aiapi114 的 OpenAI 兼容接口通常使用下面格式：

\`\`\`text
https://你的 aiapi114 域名/v1
\`\`\`

第三方工具里常见字段名包括 **API 地址**、**Base URL**、**API Host** 或 **Endpoint**。

### 5. 复制模型名

进入模型列表或定价页面，复制你要使用的模型名。不要只复制模型显示标题，代码和客户端通常需要精确的模型 ID。

### 6. 完成第一次调用

使用下面的最小示例测试文本对话：

\`\`\`bash
curl https://你的 aiapi114 域名/v1/chat/completions \\
  -H "Authorization: Bearer 你的_API_Key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "复制的模型名",
    "messages": [{"role": "user", "content": "你好，请用一句话介绍 aiapi114"}]
  }'
\`\`\`

请求成功后，你会收到模型回复。这说明账号、Key、Base URL 和模型名已经能正常工作。

## 检查清单

- [ ] 已经能登录 aiapi114 控制台。
- [ ] 账号里有可用额度或可用套餐。
- [ ] 已创建并保存 API Key。
- [ ] Base URL 以 \`/v1\` 结尾，且没有多余空格。
- [ ] 模型名从 aiapi114 模型列表复制。
- [ ] curl 或第三方工具已完成一次成功调用。

## 下一步

完成新手入门后，建议继续阅读 **aiapi114 快速使用**。如果调用失败，先查看 **常见错误答疑**，不要公开发送完整 API Key。`,
    audit: {
      writer: 'PASS',
      reviewer: 'PASS',
      notes: [
        '符合大纲：覆盖新手入门路径，包含账号、Key、Base URL、模型名和首次调用。',
        '文档框架稳定：按准备事项、操作步骤、检查清单组织，便于新手照做。',
        '竞品平台信息已替换成 aiapi114，仅保留通用 API 概念。',
      ],
    },
  },
  {
    slug: 'quick-use',
    categoryKey: 'quick-use',
    title: 'aiapi114 快速使用',
    summary: '面向已经有 API Key 的用户，快速完成文本、图像、模型列表和用量查看。',
    difficulty: '基础',
    readTime: '约 7 分钟',
    sourceBasis: [
      'docs/reference-help-docs/codexzh-ai-hub-api/api-examples.md',
      'docs/reference-help-docs/codexzh-ai-hub-api/chat-tutorial.md',
      'docs/reference-help-docs/codexzh-ai-hub-api/image-tutorial.md',
      'docs/reference-help-docs/newapi-ai/guide/feature-guide/user/api.md',
    ],
    sections: ['适合先读这篇的人', '快速判断要用哪个入口', '操作步骤', '检查清单', '常见下一步'],
    markdown: `# aiapi114 快速使用

这篇文档给已经拿到 API Key 的用户使用。你可以按自己的目标选择入口：文本对话、图像生成、模型列表或用量查询。

## 适合先读这篇的人

- 你已经完成注册并创建 API Key。
- 你想先用最短路径验证 aiapi114 是否可用。
- 你需要把 aiapi114 填到客户端或自己的代码里。

## 快速判断要用哪个入口

| 你的目标 | 推荐入口 | 需要填写 |
| --- | --- | --- |
| 让模型回答问题 | Chat Completions | Base URL、API Key、文本模型名 |
| 生成图片 | Images | Base URL、API Key、图像模型名、提示词 |
| 查看可用模型 | Models | Base URL、API Key |
| 排查消耗 | 用量记录 / 日志 | 时间范围、模型名、API Key 后四位 |

## 操作步骤

### 1. 文本对话调用

文本对话适合聊天、总结、改写、代码解释等场景。先用短问题测试，再接入正式业务。

\`\`\`bash
curl https://你的 aiapi114 域名/v1/chat/completions \\
  -H "Authorization: Bearer 你的_API_Key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "文本模型名",
    "messages": [
      {"role": "system", "content": "你是一个简洁的助手。"},
      {"role": "user", "content": "用三点说明如何开始使用 aiapi114。"}
    ]
  }'
\`\`\`

### 2. 流式输出

需要边生成边显示时，开启 \`stream\`。多数聊天客户端会自动处理流式结果。

\`\`\`json
{
  "model": "文本模型名",
  "stream": true,
  "messages": [{"role": "user", "content": "写一段简短说明"}]
}
\`\`\`

### 3. 图像生成

图像生成通常比文本对话更慢，也可能以任务形式返回。先确认模型列表里有可用图像模型。

\`\`\`bash
curl https://你的 aiapi114 域名/v1/images/generations \\
  -H "Authorization: Bearer 你的_API_Key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "图像模型名",
    "prompt": "一张干净的产品帮助中心插图，浅色背景，科技感但不夸张",
    "size": "1024x1024"
  }'
\`\`\`

### 4. 获取模型列表

当你不确定模型名时，优先从 aiapi114 页面复制。如果你要在程序里动态读取，可以调用模型列表接口。

\`\`\`bash
curl https://你的 aiapi114 域名/v1/models \\
  -H "Authorization: Bearer 你的_API_Key"
\`\`\`

### 5. 查看用量与日志

如果请求成功但成本不符合预期，进入用量记录或日志页面，按时间、模型名、API Key 后四位筛选。核对时重点看输入、输出、倍率和最终扣费。

## 检查清单

- [ ] 已确认本次场景需要文本、图像、音频还是视频模型。
- [ ] 模型名来自 aiapi114 的模型列表或定价页。
- [ ] 第三方工具中的 Base URL 与 curl 示例使用同一个域名。
- [ ] 请求失败时保存了错误码、请求时间和模型名。
- [ ] 用量异常时先在日志里按时间范围筛选。

## 常见下一步

- 要接入客户端：继续阅读第三方工具配置文档。
- 要控制成本：继续阅读进阶使用文档。
- 要排查失败：继续阅读常见错误答疑。`,
    audit: {
      writer: 'PASS',
      reviewer: 'PASS',
      notes: [
        '符合大纲：覆盖快速使用，包含文本、图像、模型列表和用量查看。',
        '文档框架稳定：用目标入口表格建立主次，再给最小示例。',
        '竞品平台信息已替换成 aiapi114，示例域名使用中性占位。',
      ],
    },
  },
  {
    slug: 'faq',
    categoryKey: 'faq',
    title: 'aiapi114 常见错误答疑',
    summary: '把高频问题按错误表现拆开，帮助新手先自行定位认证、余额、模型、限速和客户端配置问题。',
    difficulty: '排障',
    readTime: '约 8 分钟',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/support/faq.md',
      'docs/reference-help-docs/ikuncode/support/faq.md',
      'docs/reference-help-docs/ikuncode/support/troubleshooting.md',
      'docs/reference-help-docs/newapi-ai/support/feedback-issues.md',
    ],
    sections: ['适合先读这篇的人', '先看错误属于哪一类', '操作步骤', '检查清单', '联系支持前准备'],
    markdown: `# aiapi114 常见错误答疑

遇到调用失败时，先不要反复重试。按错误表现定位问题，通常能更快找到原因，也能避免不必要的额度消耗。

## 适合先读这篇的人

- 你已经创建 API Key，但请求返回错误。
- 第三方客户端配置后无法对话或无法生成图片。
- 你需要联系支持，但不确定应该提供哪些信息。

## 先看错误属于哪一类

| 错误表现 | 常见原因 | 先做什么 |
| --- | --- | --- |
| 401 / unauthorized | API Key 错误、Header 格式错误、Key 被删除。 | 重新复制 Key，确认格式是 \`Authorization: Bearer sk-...\`。 |
| 余额不足 | 账号额度不足、模型倍率较高、套餐不覆盖当前模型。 | 查看钱包和用量记录。 |
| model not found | 模型名拼错、分组无权限、模型暂不可用。 | 从 aiapi114 模型列表重新复制模型名。 |
| 429 / rate limit | 请求过快、并发过高、Key 或账号触发限制。 | 降低并发，稍后重试。 |
| timeout | 上游响应慢、网络不稳定、客户端超时太短。 | 换低延迟模型或调长客户端超时。 |
| 客户端不生效 | Base URL 少了 \`/v1\`、配置文件优先级覆盖、旧配置缓存。 | 用 curl 先验证同一组参数。 |

## 操作步骤

### 1. 先确认 API Key 没有问题

检查请求头是否包含 Bearer：

\`\`\`text
Authorization: Bearer 你的_API_Key
\`\`\`

不要把完整 Key 发给别人。排查时最多提供 Key 后四位。

### 2. 再确认 Base URL

多数 OpenAI 兼容客户端需要填写到 \`/v1\`：

\`\`\`text
https://你的 aiapi114 域名/v1
\`\`\`

常见错误包括：漏写 \`https://\`、漏写 \`/v1\`、末尾多一个空格、把网页地址填成 API 地址。

### 3. 检查模型名和权限

如果提示模型不存在，请从 aiapi114 模型列表重新复制模型名。不要使用截图里的显示名，也不要把不同平台的模型别名直接填进 aiapi114。

### 4. 检查余额和用量记录

余额不足时，先查看钱包、套餐和用量记录。部分模型的消耗高于普通文本模型，图像、视频、长上下文任务也可能消耗更多。

### 5. 用 curl 做最小复现

当第三方工具无法使用时，先用 curl 测试同一组 Base URL、API Key 和模型名。curl 成功但客户端失败，说明问题大概率在客户端配置。

### 6. 处理超时和限速

超时不一定表示 Key 错误。可以尝试降低并发、换模型、缩短输入内容、稍后重试，或在客户端里调长超时时间。

## 检查清单

- [ ] Base URL 使用 aiapi114 域名，并以 \`/v1\` 结尾。
- [ ] 请求头格式是 \`Authorization: Bearer 你的_API_Key\`。
- [ ] 模型名从 aiapi114 当前模型列表复制。
- [ ] 账号有可用余额或套餐额度。
- [ ] 第三方工具失败时，已用 curl 验证同一组配置。
- [ ] 没有在公开渠道发送完整 API Key。

## 联系支持前准备

为了更快定位问题，请准备以下信息：

- 出错时间，精确到分钟。
- 使用的模型名。
- API Key 后四位，不要提供完整 Key。
- 错误码和完整错误信息。
- 使用方式：curl、代码、Cherry Studio、Claude Code、Codex CLI 或其他客户端。
- 如果有请求 ID，请一并提供。

> 安全提醒：截图前请遮挡完整 API Key、邮箱、订单号等敏感信息。`,
    audit: {
      writer: 'PASS',
      reviewer: 'PASS',
      notes: [
        '符合大纲：覆盖常见错误答疑，优先面向新手定位问题。',
        '文档框架稳定：按错误表现、操作步骤、检查清单、支持信息组织。',
        '竞品平台信息已替换成 aiapi114，并补充完整 Key 不外发提醒。',
      ],
    },
  },
]
