import type { HelpArticle } from './types.ts'

export const EXTENDED_HELP_ARTICLES: HelpArticle[] = [
  {
    slug: 'third-party-tools',
    categoryKey: 'third-party-tools',
    title: 'aiapi114 第三方工具配置',
    summary: '把 aiapi114 接入 Cherry Studio、Claude Code、Codex CLI、机器人和其他 OpenAI 兼容客户端。',
    difficulty: '基础',
    readTime: '约 9 分钟',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/apps/cherry-studio.md',
      'docs/reference-help-docs/newapi-ai/apps/claude-code.md',
      'docs/reference-help-docs/newapi-ai/apps/codex-cli.md',
      'docs/reference-help-docs/codexzh-ai-hub-api/cli-config.md',
      'docs/reference-help-docs/ikuncode/tools/cc-switch.md',
    ],
    sections: ['适合先读这篇的人', '通用配置项', '操作步骤', '检查清单', '排查方向'],
    markdown: `# aiapi114 第三方工具配置

大多数第三方工具接入 aiapi114 时，本质上只需要三项：**Base URL**、**API Key** 和 **模型名**。先用通用配置项理解规则，再按工具填写。

## 适合先读这篇的人

- 你想在桌面客户端、CLI、插件或机器人里使用 aiapi114。
- 你不知道 API 地址应该填到哪里。
- 同一组 Key 在 curl 可用，但在客户端里失败。

## 通用配置项

| 字段 | 填写内容 | 常见别名 |
| --- | --- | --- |
| Base URL | \`https://你的 aiapi114 域名/v1\` | API Host、Endpoint、API 地址 |
| API Key | aiapi114 创建的 Key | Token、Secret Key、访问令牌 |
| Model | 从 aiapi114 模型列表复制 | 模型 ID、Deployment、模型名称 |
| Provider | 选择 OpenAI Compatible 或自定义服务商 | OpenAI、自定义、第三方 API |

## 操作步骤

### 1. 先用通用 OpenAI 兼容配置

如果工具里有服务商选项，优先选择 **OpenAI Compatible**、**自定义 OpenAI** 或 **Custom Provider**。不要选择只支持官方账号登录的模式。

### 2. 配置 Cherry Studio

进入模型服务设置，新增 OpenAI 兼容服务。填写 aiapi114 的 Base URL 和 API Key，然后添加文本或图像模型。保存后先发一句短消息测试。

### 3. 配置 Claude Code

Claude Code 常见配置方式是环境变量或配置文件。将 Base URL 指向 aiapi114 的兼容接口，把 API Key 写入对应字段，再把模型名改成 aiapi114 可用模型。

### 4. 配置 Codex CLI

在 Codex CLI 的配置文件中新增 provider。核心字段保持一致：Base URL 写到 \`/v1\`，Key 使用 aiapi114 创建的 API Key，模型名从平台复制。

### 5. 配置机器人和其他客户端

LangBot、AstrBot、LobeChat、Chatbox、DeepChat 等工具通常都支持 OpenAI 兼容接口。找不到 aiapi114 选项时，选择自定义 OpenAI 服务即可。

### 6. 使用 CC-Switch 管理多个配置

如果你经常在多个工具或多个服务之间切换，可以使用配置切换工具集中保存 aiapi114 的 Base URL、Key 和模型名。切换后重启对应客户端，避免旧配置缓存。

## 检查清单

- [ ] 工具服务商选择了 OpenAI 兼容或自定义服务。
- [ ] Base URL 使用 aiapi114 域名，并以 \`/v1\` 结尾。
- [ ] API Key 没有多余空格，没有误填成账号密码。
- [ ] 模型名从 aiapi114 模型列表复制。
- [ ] 客户端失败时，已用 curl 验证同一组配置。
- [ ] 修改配置后已重启客户端或刷新会话。

## 排查方向

curl 成功但客户端失败，优先检查客户端字段映射、配置文件优先级、代理设置和缓存。curl 也失败，则回到常见错误答疑检查 Key、余额、模型权限和限速。`,
    audit: {
      writer: 'PASS',
      reviewer: 'PASS',
      notes: [
        '符合大纲：覆盖第三方工具配置，按通用字段和常用工具组织。',
        '文档框架稳定：先讲通用配置，再列工具步骤和检查清单。',
        '竞品平台信息已替换成 aiapi114，没有保留原平台品牌。',
      ],
    },
  },
  {
    slug: 'advanced-usage',
    categoryKey: 'advanced-usage',
    title: 'aiapi114 进阶使用',
    summary: '理解模型分组、计费倍率、速率限制、日志核对和异步任务，适合长期使用或团队使用。',
    difficulty: '基础',
    readTime: '约 10 分钟',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/guide/feature-guide/user/pricing.md',
      'docs/reference-help-docs/newapi-ai/guide/console/settings/rate-settings.md',
      'docs/reference-help-docs/newapi-ai/guide/feature-guide/user/log.md',
      'docs/reference-help-docs/newapi-ai/guide/feature-guide/user/task.md',
      'docs/reference-help-docs/codexzh-ai-hub-api/model-groups.md',
    ],
    sections: ['适合先读这篇的人', '核心概念', '操作步骤', '检查清单', '最佳实践'],
    markdown: `# aiapi114 进阶使用

当你已经能正常调用 aiapi114 后，下一步是理解模型、分组、计费、限速和任务记录。这样可以减少调用失败，也能更准确地控制成本。

## 适合先读这篇的人

- 你已经完成第一次 API 调用。
- 你需要给多个工具或多个项目分别管理 Key。
- 你想知道为什么不同模型扣费不同、速度不同或权限不同。

## 核心概念

| 概念 | 说明 | 你需要关注 |
| --- | --- | --- |
| 模型 | 实际被调用的 AI 能力，例如文本、图像、语音或视频模型。 | 模型名必须精确。 |
| 分组 | 平台对模型、价格或权限的组织方式。 | 账号是否有权限使用对应分组。 |
| 倍率 | 影响最终消耗的计费系数。 | 高能力模型通常成本更高。 |
| 速率限制 | 每分钟请求数、Token 数或并发限制。 | 高频调用需要做重试和排队。 |
| 异步任务 | 图像、视频等不一定立即返回结果的任务。 | 需要查询任务状态和结果。 |

## 操作步骤

### 1. 按场景选择模型

文本总结、改写、问答优先选择稳定、成本适中的文本模型。图像、视频、语音等场景必须选择对应类型模型，不要用文本模型发多媒体任务。

### 2. 为不同用途创建不同 API Key

建议按用途拆分 Key，例如“个人客户端”“项目后端”“测试环境”。这样出现异常消耗时，可以快速定位来源，也方便单独禁用。

### 3. 核对计费和用量

进入用量记录或日志页面，按时间、模型、Key、用户筛选。核对时重点看输入量、输出量、倍率、最终扣费和请求状态。

### 4. 处理速率限制

如果遇到 429 或请求过快，降低并发、增加重试间隔，或把大批量任务拆成队列。不要在失败后立即无限重试。

### 5. 使用异步任务记录

图像、视频、音乐等任务可能先返回任务 ID。你需要在任务记录里查看排队中、处理中、成功、失败等状态，并根据结果决定是否重试。

### 6. 管理员配置入口

如果你是站点管理员，还需要关注渠道状态、模型映射、分组权限、倍率设置和系统公告。普通用户不需要理解上游密钥或渠道权重细节。

## 检查清单

- [ ] 已按用途拆分 API Key，而不是所有工具共用一个 Key。
- [ ] 重要项目记录了使用的模型名和调用场景。
- [ ] 定期查看用量记录，确认没有异常消耗。
- [ ] 批量任务设置了重试间隔和并发上限。
- [ ] 异步任务失败时先查看任务状态和错误原因。
- [ ] 管理员配置变更后已做一次低成本测试调用。

## 最佳实践

团队使用时，建议给每个项目或成员单独创建 Key，并设定额度或速率限制。生产服务应记录请求 ID、模型名、耗时和错误码，方便后续排查。`,
    audit: {
      writer: 'PASS',
      reviewer: 'PASS',
      notes: [
        '符合大纲：覆盖进阶使用，包含分组、计费、限速、任务和管理员入口。',
        '文档框架稳定：按概念表、操作步骤、检查清单组织，主次明确。',
        '竞品平台信息已替换成 aiapi114，并避免暴露上游管理细节给新手。',
      ],
    },
  },
  {
    slug: 'api-reference',
    categoryKey: 'api-reference',
    title: 'aiapi114 平台 API 接口描述',
    summary: '开发者接入 aiapi114 的总览文档，覆盖认证、模型、对话、图像、音频、异步任务和错误处理。',
    difficulty: '基础',
    readTime: '约 11 分钟',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/index.md',
      'docs/reference-help-docs/newapi-ai/api/management/auth.md',
      'docs/reference-help-docs/newapi-ai/api/ai-model/chat/openai/createchatcompletion.md',
      'docs/reference-help-docs/newapi-ai/api/ai-model/images/openai/post-v1-images-generations.md',
      'docs/reference-help-docs/codexzh-ai-hub-api/api-examples.md',
    ],
    sections: ['适合先读这篇的人', '接口基础', '操作步骤', '检查清单', '错误处理'],
    markdown: `# aiapi114 平台 API 接口描述

aiapi114 提供 OpenAI 兼容接口，方便你把现有客户端、SDK 或服务端代码迁移到 aiapi114。本文先给总览，具体参数以后按接口拆分成独立页面。

## 适合先读这篇的人

- 你要在代码里直接调用 aiapi114。
- 你正在从其他 OpenAI 兼容服务迁移。
- 你需要确认认证方式、接口路径和错误处理约定。

## 接口基础

| 项目 | 说明 |
| --- | --- |
| Base URL | \`https://你的 aiapi114 域名/v1\` |
| 认证方式 | Header 中传入 \`Authorization: Bearer 你的_API_Key\` |
| 请求格式 | 通常使用 JSON，上传文件或图片编辑按接口要求使用表单。 |
| 返回格式 | 成功返回模型结果；失败返回 HTTP 状态码和错误信息。 |

## 操作步骤

### 1. 认证

所有需要调用模型的接口都应携带 API Key：

\`\`\`text
Authorization: Bearer 你的_API_Key
\`\`\`

服务端保存 Key 时，应使用环境变量或密钥管理服务，不要硬编码到前端代码或公开仓库。

### 2. 文本对话接口

常用路径：

\`\`\`text
POST /v1/chat/completions
\`\`\`

最小请求体：

\`\`\`json
{
  "model": "文本模型名",
  "messages": [
    {"role": "user", "content": "你好"}
  ]
}
\`\`\`

### 3. 模型列表接口

常用路径：

\`\`\`text
GET /v1/models
\`\`\`

用于确认当前 Key 可见的模型。页面模型列表仍是新手最推荐的复制来源。

### 4. 图像接口

常用路径：

\`\`\`text
POST /v1/images/generations
\`\`\`

图像模型的参数、尺寸和返回格式可能与文本模型不同。调用前先确认模型支持的能力和尺寸。

### 5. 音频和多模态接口

语音转文字、文字转语音、图片理解等能力需要选择对应模型，并按接口要求传入文件、文本或多模态消息。

### 6. 异步任务接口

视频、复杂图像或长时间任务可能返回任务 ID。业务代码应保存任务 ID，并提供查询状态、失败重试和结果展示逻辑。

## 检查清单

- [ ] 服务端使用环境变量保存 API Key。
- [ ] Base URL 只配置一处，避免不同模块使用不同域名。
- [ ] 所有请求都记录模型名、耗时、状态码和错误信息。
- [ ] 批量调用设置了超时、重试和并发上限。
- [ ] 前端页面不暴露完整 API Key。
- [ ] 生产环境上线前已用低成本模型完成端到端测试。

## 错误处理

- 401：检查 API Key 和 Authorization Header。
- 402 或余额相关错误：检查余额、套餐和模型倍率。
- 404 或模型不存在：重新复制 aiapi114 模型名。
- 429：降低并发，增加退避重试。
- 5xx：记录请求 ID、时间和模型名，稍后重试或联系支持。

联系支持时，请提供错误码、请求时间、模型名、Key 后四位和请求 ID，不要提供完整 API Key。`,
    audit: {
      writer: 'PASS',
      reviewer: 'PASS',
      notes: [
        '符合大纲：覆盖平台 API 接口描述，包含认证、核心接口、异步任务和错误处理。',
        '文档框架稳定：先给基础约定，再按接口类型说明，适合后续拆分。',
        '竞品平台信息已替换成 aiapi114，并补充密钥安全要求。',
      ],
    },
  },
]

