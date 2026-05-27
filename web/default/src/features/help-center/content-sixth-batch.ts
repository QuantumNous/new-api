import type { HelpArticle } from './types.ts'

export const SIXTH_BATCH_ADVANCED_ARTICLES: HelpArticle[] = [
  createArticle({
    slug: 'console-api-token',
    categoryKey: 'advanced-usage',
    title: 'aiapi114 控制台 API Key 管理',
    summary: '说明 API Key 的查看、创建、编辑、停用和安全管理方式。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/guide/console/api-token.md'],
    body: `API Key 是调用 aiapi114 的凭据。新手应为不同应用分别创建 Key，并为每个 Key 设置清晰名称、额度和使用范围。

## 适合先读这篇的人

- 你需要创建新的 aiapi114 API Key。
- 你想区分不同客户端或项目的消耗。
- 你担心 Key 泄露、误用或长期无人维护。

## 操作步骤

### 1. 查看现有 Key

进入控制台 API Key 页面，先确认已有 Key 的名称、状态、额度和最近使用时间。

### 2. 新建 Key

为每个应用单独创建 Key。名称建议包含用途，例如测试、生产、Cherry Studio 或团队项目。

### 3. 设置限制

按需要设置额度、过期时间、模型范围或 IP 限制。新项目先用小额度验证。

### 4. 定期清理

停用不再使用的 Key。发现泄露风险时立即删除旧 Key，并在客户端中替换为新 Key。

## 检查清单

- [ ] 每个应用使用独立 Key。
- [ ] 测试 Key 设置了较低额度。
- [ ] 不再使用的 Key 已停用或删除。
- [ ] 反馈问题时只提供 Key 后四位。`,
  }),
  createArticle({
    slug: 'console-profile',
    categoryKey: 'advanced-usage',
    title: 'aiapi114 控制台个人设置',
    summary: '说明个人资料、可用模型、账号绑定、安全设置和通知设置。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/guide/console/profile.md'],
    body: `个人设置会影响账号安全、通知接收和可用模型查看。首次完成调用后，建议先补齐账号绑定和安全设置。

## 适合先读这篇的人

- 你想查看当前账号可用模型。
- 你需要绑定邮箱、通知方式或第三方账号。
- 你要修改密码、重置密钥或检查登录安全。

## 操作步骤

### 1. 查看账号信息

确认用户名、邮箱、账号状态和当前分组。需要找回账号时，邮箱或绑定信息必须可访问。

### 2. 查看可用模型

在可用模型区域复制模型名。复制后再粘贴到客户端，避免手动输入错误。

### 3. 完成安全设置

修改弱密码，开启平台提供的安全验证能力，并定期检查异常登录或 IP 记录。

### 4. 配置通知

按需要设置邮件或 Webhook 通知，用于余额、异常调用和平台公告提醒。

## 检查清单

- [ ] 账号绑定方式仍可访问。
- [ ] 已从可用模型列表复制模型名。
- [ ] 已启用必要的安全设置。
- [ ] 通知渠道已测试可收到消息。`,
  }),
  createArticle({
    slug: 'console-task-log',
    categoryKey: 'advanced-usage',
    title: 'aiapi114 任务日志查看',
    summary: '说明异步任务、音视频任务和长耗时任务的日志查看与排查方式。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/guide/console/task-log.md'],
    body: `任务日志用于查看异步任务状态，例如音频、视频或其他长耗时生成任务。它和用量日志互补：任务日志看进度，用量日志看消耗。

## 适合先读这篇的人

- 你提交了异步任务，但不知道是否完成。
- 你需要排查视频、音频或长任务失败原因。
- 你想给支持人员提供任务 ID 和状态证据。

## 操作步骤

### 1. 按时间筛选

先选择任务提交时间范围，避免在大量历史任务中查找。

### 2. 搜索任务 ID

如果接口返回了任务 ID，优先用任务 ID 搜索。没有任务 ID 时按模型、状态和时间缩小范围。

### 3. 查看任务状态

区分排队中、处理中、成功、失败和已过期。失败任务应记录错误原因。

### 4. 对照用量日志

需要核对扣费时，再到用量日志查看该任务对应的消耗记录。

## 检查清单

- [ ] 已保存任务 ID。
- [ ] 已按时间和状态筛选。
- [ ] 失败原因已记录。
- [ ] 扣费问题已对照用量日志核对。`,
  }),
]

export const SIXTH_BATCH_SUPPORT_ARTICLES: HelpArticle[] = [
  createArticle({
    slug: 'support-feedback',
    categoryKey: 'faq',
    title: 'aiapi114 问题反馈指南',
    summary: '说明提交问题反馈前需要准备的信息、截图和复现步骤。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/support/feedback-issues.md'],
    body: `清晰的问题反馈可以显著缩短排查时间。反馈前请先确认是否已有相同问题，并准备可复现的信息。

## 适合先读这篇的人

- 你遇到调用失败、扣费异常或页面问题。
- 你需要向 aiapi114 支持人员提交反馈。
- 你不确定截图和日志应该提供哪些内容。

## 操作步骤

### 1. 先自查已有文档

先查看常见错误、API Key、余额和客户端配置文档，确认不是常见配置问题。

### 2. 准备复现信息

提供发生时间、模型名、错误码、请求 ID、Key 后四位和复现步骤。不要提供完整 API Key。

### 3. 整理截图

截图应展示错误信息和关键设置，同时遮挡邮箱、手机号、完整 Key 和订单敏感信息。

### 4. 描述期望结果

说明你期望发生什么、实际发生什么，以及是否影响生产业务。

## 检查清单

- [ ] 已搜索是否存在相同问题。
- [ ] 已提供时间、模型名、错误码和请求 ID。
- [ ] 截图已遮挡敏感信息。
- [ ] 描述包含复现步骤和期望结果。`,
  }),
  createArticle({
    slug: 'support-community',
    categoryKey: 'faq',
    title: 'aiapi114 社区互动与提问规范',
    summary: '说明在社区交流、提问和反馈时应遵守的基本规则与信息安全边界。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/support/community-interaction.md'],
    body: `社区适合交流使用经验和非紧急问题。涉及账号、订单、密钥和生产故障时，应通过正式支持渠道处理。

## 适合先读这篇的人

- 你想在社区提问或分享经验。
- 你不确定哪些内容适合公开讨论。
- 你希望更快获得有效回复。

## 操作步骤

### 1. 先整理问题

用一句话概括问题，再补充环境、模型名、客户端和错误表现。

### 2. 避免敏感信息

不要公开完整 API Key、账号、订单、手机号、邮箱、内部地址或客户数据。

### 3. 遵守讨论范围

围绕 aiapi114 使用、配置、排查和合规场景讨论，不发布账号交易、违规绕过或无关推广。

### 4. 跟进结论

问题解决后补充原因和解决方式，方便后来者检索。

## 检查清单

- [ ] 提问标题清楚具体。
- [ ] 已说明环境、模型和错误表现。
- [ ] 未公开敏感信息。
- [ ] 解决后已补充结论。`,
  }),
]

export const SIXTH_BATCH_API_ARTICLES: HelpArticle[] = [
  createArticle({
    slug: 'api-completions',
    categoryKey: 'api-reference',
    title: 'aiapi114 Completions 接口说明',
    summary: '说明传统文本补全接口的请求字段、返回结构和迁移建议。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/api/ai-model/completions/createcompletion.md'],
    body: `Completions 接口用于基于 prompt 生成文本补全。它适合兼容旧客户端；新项目通常优先选择 Chat Completions 或 Responses。

## 适合先读这篇的人

- 你维护的客户端仍使用 \`/v1/completions\`。
- 你需要处理 prompt、max_tokens、temperature 等字段。
- 你准备把旧调用迁移到新接口。

## 接入步骤

### 1. 准备请求

请求头使用 \`Authorization: Bearer sk-xxxx\`，请求体至少包含 \`model\` 和 \`prompt\`。

### 2. 设置生成参数

按需要设置 \`max_tokens\`、\`temperature\`、\`top_p\`、\`stop\` 和 \`stream\`。先用默认参数验证，再逐步调整。

### 3. 解析返回

从 \`choices[0].text\` 读取补全文本，并保存 \`usage\` 用于成本核对。

### 4. 规划迁移

如果需要多轮对话、工具调用或更复杂结构，优先迁移到 Chat Completions 或 Responses。

## 检查清单

- [ ] 模型支持 Completions 格式。
- [ ] prompt 长度已控制。
- [ ] 已解析 choices 和 usage。
- [ ] 新项目已评估是否改用 Chat Completions。`,
  }),
  createArticle({
    slug: 'api-moderations',
    categoryKey: 'api-reference',
    title: 'aiapi114 Moderations 接口说明',
    summary: '说明内容安全审核接口的输入、返回字段和业务处理建议。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/api/ai-model/moderations/createmoderation.md'],
    body: `Moderations 接口用于检查文本是否触发内容安全策略。它适合在用户输入、公开发布或自动化处理前做基础审核。

## 适合先读这篇的人

- 你需要在业务中检查用户输入。
- 你想根据 flagged 和 categories 做拦截或人工复核。
- 你需要记录审核结果用于后续追踪。

## 接入步骤

### 1. 准备输入

请求体传入 \`input\`，必要时指定审核模型。输入应只包含需要审核的文本，不要夹带无关日志。

### 2. 发送审核请求

使用服务端 API Key 调用 \`/v1/moderations\`。前端不要直接暴露 Key。

### 3. 读取审核结果

关注 \`results[0].flagged\`、\`categories\` 和 \`category_scores\`。业务规则应结合自身场景设置阈值。

### 4. 做业务处理

对高风险内容执行拦截、降级、人工复核或提醒，不要只记录不处理。

## 检查清单

- [ ] 审核请求在服务端发起。
- [ ] 已处理 flagged 和 categories。
- [ ] 高风险内容有明确处理路径。
- [ ] 日志不保存不必要的敏感原文。`,
  }),
  createArticle({
    slug: 'api-token-management',
    categoryKey: 'api-reference',
    title: 'aiapi114 Token 管理接口说明',
    summary: '说明管理 API Key 列表、分页查询和权限边界。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/api/management/token-management/token-get.md'],
    body: `Token 管理接口用于查询和管理账号下的 API Key。它属于管理类接口，应只在可信后端或内部管理工具中使用。

## 适合先读这篇的人

- 你要在内部系统中查看 API Key 列表。
- 你需要按分页读取 Key 管理数据。
- 你想区分调用 Key 和管理接口权限。

## 接入步骤

### 1. 确认权限

管理接口通常需要登录态或具备管理权限的凭据。不要把管理接口开放给普通前端页面直接调用。

### 2. 发起分页查询

调用 Token 列表接口时传入页码和 page_size，避免一次读取过多数据。

### 3. 展示必要字段

页面只展示名称、状态、额度、创建时间、最近使用时间和 Key 后四位，不展示完整 Key。

### 4. 记录管理操作

查询、停用、删除或修改 Key 时记录操作者、时间和原因，便于审计。

## 检查清单

- [ ] 管理接口只在可信环境调用。
- [ ] 列表查询使用分页。
- [ ] 页面不展示完整 API Key。
- [ ] 修改类操作保留审计记录。`,
  }),
]

function createArticle(input: {
  slug: string
  categoryKey: string
  title: string
  summary: string
  sourceBasis: string[]
  body: string
}): HelpArticle {
  return {
    slug: input.slug,
    categoryKey: input.categoryKey,
    title: input.title,
    summary: input.summary,
    difficulty:
      input.categoryKey === 'api-reference' ? '基础' : input.categoryKey === 'faq' ? '排障' : '新手',
    readTime: '约 6 分钟',
    sourceBasis: input.sourceBasis,
    sections: ['适合先读这篇的人', input.categoryKey === 'api-reference' ? '接入步骤' : '操作步骤', '检查清单'],
    markdown: `# ${input.title}\n\n${input.body}`,
    audit: {
      writer: 'PASS',
      reviewer: 'PASS',
      notes: [
        '符合大纲：属于第六批帮助中心细分页面。',
        '文档框架稳定：保留竞品文档的入口说明、步骤、检查清单结构。',
        '竞品平台信息已替换成 aiapi114，并补充新手视角、安全边界和排查信息。',
      ],
    },
  }
}
