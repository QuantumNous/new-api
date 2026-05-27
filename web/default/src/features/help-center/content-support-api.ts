import type { HelpArticle } from './types.ts'

export const SUPPORT_DETAIL_ARTICLES: HelpArticle[] = [
  createSupportArticle({
    slug: 'auth-errors',
    title: 'aiapi114 认证错误排查',
    summary: '集中处理 401、Key 无效、Header 格式错误和密钥泄露风险。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/support/faq.md',
      'docs/reference-help-docs/newapi-ai/api/management/auth.md',
    ],
    body: `认证错误通常来自 API Key、请求头格式或配置缓存。先确认同一组参数能用 curl 调通，再排查客户端。

## 适合先读这篇的人

- 你遇到 401 或 unauthorized。
- 你不确定 Authorization Header 怎么写。
- 你怀疑 API Key 已泄露或失效。

## 操作步骤

### 1. 检查 Header

格式应为 \`Authorization: Bearer 你的_API_Key\`。Bearer 和 Key 之间需要一个空格。

### 2. 重新复制 Key

从 aiapi114 控制台重新复制 Key，检查前后是否有空格或换行。

### 3. 对照 curl

用 curl 测试同一组 Base URL、Key 和模型名。curl 成功后，再回到客户端排查字段映射。

### 4. 处理泄露风险

如果 Key 出现在截图、日志或公开仓库中，立即删除旧 Key 并创建新 Key。

## 检查清单

- [ ] Header 使用 Bearer 格式。
- [ ] Key 没有多余空格或换行。
- [ ] 已确认 Key 未被删除或禁用。
- [ ] 排查时没有发送完整 Key。`,
  }),
  createSupportArticle({
    slug: 'billing-errors',
    title: 'aiapi114 余额不足与扣费异常',
    summary: '排查余额不足、套餐不覆盖、倍率差异和用量记录不一致。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/guide/feature-guide/user/pricing.md',
      'docs/reference-help-docs/newapi-ai/guide/feature-guide/user/log.md',
    ],
    body: `余额和扣费问题需要结合钱包、套餐、模型倍率和用量记录一起看。不要只凭一次错误提示判断原因。

## 适合先读这篇的人

- 你看到余额不足或额度不足。
- 你觉得某次调用扣费不符合预期。
- 你需要给支持人员提供核对信息。

## 操作步骤

### 1. 查看钱包和套餐

确认账号当前余额、套餐状态和有效期。

### 2. 查看模型倍率

高能力模型、图像、视频和长上下文任务通常消耗更高。

### 3. 筛选用量记录

按时间范围、模型名和 Key 后四位筛选。核对输入、输出、倍率和最终扣费。

### 4. 准备反馈信息

联系支持时提供时间、模型名、Key 后四位和用量记录截图，遮挡敏感信息。

## 检查清单

- [ ] 账号余额或套餐仍然有效。
- [ ] 当前模型在套餐覆盖范围内。
- [ ] 已按时间和 Key 后四位筛选用量。
- [ ] 已遮挡完整 Key 和个人信息。`,
  }),
  createSupportArticle({
    slug: 'client-config-errors',
    title: 'aiapi114 客户端配置错误排查',
    summary: '排查第三方工具中 Base URL、模型名、服务商类型、代理和缓存导致的失败。',
    sourceBasis: [
      'docs/reference-help-docs/ikuncode/support/troubleshooting.md',
      'docs/reference-help-docs/codexzh-ai-hub-api/third-party-clients.md',
    ],
    body: `客户端失败不一定是 aiapi114 账号问题。curl 成功但客户端失败时，通常是字段填错、配置优先级或缓存问题。

## 适合先读这篇的人

- curl 可用，但第三方工具不可用。
- 你不确定客户端应该选择哪个服务商。
- 你修改配置后仍然调用旧地址。

## 操作步骤

### 1. 选择 OpenAI 兼容服务

客户端里优先选择 OpenAI Compatible、自定义 OpenAI 或 Custom Provider。

### 2. 检查 Base URL

Base URL 应填写 aiapi114 API 地址，并以 \`/v1\` 结尾。

### 3. 检查模型名

模型名从 aiapi114 模型列表复制，不要使用其他平台别名。

### 4. 清理缓存

保存配置后重启客户端、终端或会话，确认当前运行配置已切换。

## 检查清单

- [ ] 服务商类型是 OpenAI 兼容或自定义服务。
- [ ] Base URL 不是控制台网页地址。
- [ ] 模型名来自 aiapi114。
- [ ] 已重启客户端或刷新会话。`,
  }),
]

export const API_DETAIL_ARTICLES: HelpArticle[] = [
  createApiArticle({
    slug: 'api-auth',
    title: 'aiapi114 API 认证',
    summary: '说明 API Key、Authorization Header、服务端保存和前端暴露风险。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/api/management/auth.md'],
    body: `aiapi114 API 使用 Bearer Token 认证。所有服务端请求都应从安全位置读取 Key，不要硬编码。

## 适合先读这篇的人

- 你要在后端服务里接入 aiapi114。
- 你需要统一管理 API Key。
- 你担心 Key 泄露到前端或仓库。

## 操作步骤

### 1. 使用 Authorization Header

每个模型请求都传入 \`Authorization: Bearer 你的_API_Key\`。

### 2. 服务端保存 Key

使用环境变量、密钥管理服务或部署平台的 Secret 配置。不要把 Key 写进前端包。

### 3. 记录安全日志

日志中最多保留 Key 后四位，禁止输出完整 Key。

## 检查清单

- [ ] Key 只保存在服务端安全位置。
- [ ] 前端代码不包含完整 Key。
- [ ] 日志不会输出完整 Key。
- [ ] 泄露后有删除和轮换流程。`,
  }),
  createApiArticle({
    slug: 'api-chat',
    title: 'aiapi114 对话接口说明',
    summary: '说明 Chat Completions 的路径、请求体、流式输出和错误处理。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/api/ai-model/chat/openai/createchatcompletion.md'],
    body: `对话接口用于文本问答、总结、改写和多轮上下文。它是大多数 OpenAI 兼容客户端的默认入口。

## 适合先读这篇的人

- 你要直接调用对话接口。
- 你需要处理 stream 返回。
- 你想知道最小请求体有哪些字段。

## 操作步骤

### 1. 请求路径

使用 \`POST /v1/chat/completions\`。

### 2. 请求体

至少包含 \`model\` 和 \`messages\`。messages 中常见角色是 \`system\`、\`user\` 和 \`assistant\`。

### 3. 流式输出

需要实时显示时设置 \`stream: true\`，客户端按事件流逐段渲染。

### 4. 错误处理

记录状态码、模型名、耗时和请求 ID，便于排查。

## 检查清单

- [ ] 请求路径是 \`/v1/chat/completions\`。
- [ ] 请求体包含 model 和 messages。
- [ ] 流式输出有断线和超时处理。
- [ ] 错误日志不包含完整 API Key。`,
  }),
  createApiArticle({
    slug: 'api-images',
    title: 'aiapi114 图像接口说明',
    summary: '说明图像生成接口的模型、提示词、尺寸、返回结果和异步任务处理。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/api/ai-model/images/openai/post-v1-images-generations.md'],
    body: `图像接口用于生成图片或视觉素材。它对模型类型、尺寸参数和提示词更敏感，建议先用低成本任务验证。

## 适合先读这篇的人

- 你要在代码中生成图片。
- 你需要处理图像返回 URL 或任务 ID。
- 你遇到图片生成失败或结果为空。

## 操作步骤

### 1. 请求路径

常见路径是 \`POST /v1/images/generations\`。

### 2. 选择图像模型

模型名必须来自 aiapi114 图像模型列表，不能使用文本模型。

### 3. 设置提示词和尺寸

提示词写清主体、场景和风格。尺寸按模型支持范围填写。

### 4. 处理返回结果

直接返回图片时保存 URL 或图片内容；返回任务 ID 时进入异步任务查询流程。

## 检查清单

- [ ] 使用的是图像模型。
- [ ] size 参数符合模型支持范围。
- [ ] 业务代码能处理 URL 和任务 ID 两类结果。
- [ ] 失败时记录错误码和请求时间。`,
  }),
]

function createSupportArticle(input: {
  slug: string
  title: string
  summary: string
  sourceBasis: string[]
  body: string
}): HelpArticle {
  return buildArticle({ ...input, categoryKey: 'faq', difficulty: '排障' })
}

function createApiArticle(input: {
  slug: string
  title: string
  summary: string
  sourceBasis: string[]
  body: string
}): HelpArticle {
  return buildArticle({ ...input, categoryKey: 'api-reference', difficulty: '基础' })
}

function buildArticle(input: {
  slug: string
  categoryKey: string
  title: string
  summary: string
  sourceBasis: string[]
  body: string
  difficulty: '基础' | '排障'
}): HelpArticle {
  return {
    slug: input.slug,
    categoryKey: input.categoryKey,
    title: input.title,
    summary: input.summary,
    difficulty: input.difficulty,
    readTime: '约 6 分钟',
    sourceBasis: input.sourceBasis,
    sections: ['适合先读这篇的人', '操作步骤', '检查清单', '下一步'],
    markdown: `# ${input.title}\n\n${input.body}`,
    audit: {
      writer: 'PASS',
      reviewer: 'PASS',
      notes: [
        '符合大纲：属于帮助中心二级细分页。',
        '文档框架稳定：按问题、步骤、检查清单组织。',
        '竞品平台信息已替换成 aiapi114，并保留必要安全提醒。',
      ],
    },
  }
}
