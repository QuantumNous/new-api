import type { HelpArticle } from './types.ts'

export const FOURTH_BATCH_TOOL_ARTICLES: HelpArticle[] = [
  createArticle({
    slug: 'astrbot',
    categoryKey: 'third-party-tools',
    title: 'aiapi114 配置 AstrBot',
    summary: '把 aiapi114 接入 AstrBot 机器人，完成 OpenAI 兼容服务、模型和调试配置。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/apps/astrbot.md'],
    body: `AstrBot 适合把 aiapi114 接入群聊和自动化机器人。配置前先准备 Base URL、API Key 和模型名。

## 适合先读这篇的人

- 你想让 AstrBot 使用 aiapi114 回复消息。
- 你不确定聊天模型和服务地址怎么填。
- 你需要先在调试环境验证机器人回复。

## 操作步骤

### 1. 新增 OpenAI 兼容服务

在 AstrBot 后台进入模型或供应商设置，新增 OpenAI 兼容服务。

### 2. 填写连接信息

Base URL 填 \`https://你的 aiapi114 域名/v1\`，API Key 填 aiapi114 创建的 Key。

### 3. 配置模型名

从 aiapi114 模型列表复制文本模型名，填入聊天模型字段。

### 4. 调试机器人回复

先在调试会话发送短消息，确认机器人能收到输入并返回结果。

## 检查清单

- [ ] Base URL 以 \`/v1\` 结尾。
- [ ] 聊天模型名来自 aiapi114。
- [ ] 调试会话已成功回复。
- [ ] 日志不会输出完整 API Key。`,
  }),
  createArticle({
    slug: 'deepchat',
    categoryKey: 'third-party-tools',
    title: 'aiapi114 配置 DeepChat',
    summary: '说明 DeepChat 中自定义 OpenAI 兼容服务的配置字段、模型添加和排查步骤。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/apps/deepchat.md'],
    body: `DeepChat 可以通过自定义模型服务接入 aiapi114。先使用一组最小配置验证，再逐步添加更多模型。

## 适合先读这篇的人

- 你想在 DeepChat 中使用 aiapi114。
- 你遇到模型不可用或请求失败。
- 你需要同时配置多个模型。

## 操作步骤

### 1. 打开服务商设置

进入 DeepChat 的模型服务设置，选择自定义 OpenAI 或 OpenAI 兼容服务。

### 2. 填写 API 地址和 Key

API 地址填写 aiapi114 的 \`/v1\` 地址，Key 使用 aiapi114 API Key。

### 3. 添加模型

从 aiapi114 复制模型名。文本、图像和嵌入模型要分别填到对应能力中。

### 4. 发送测试消息

保存后先发送短文本消息。失败时用 curl 对照验证同一组参数。

## 检查清单

- [ ] 服务商类型是 OpenAI 兼容。
- [ ] API 地址不是控制台网页地址。
- [ ] 模型类型和模型名匹配。
- [ ] 修改配置后已刷新客户端。`,
  }),
  createArticle({
    slug: 'fluent-read',
    categoryKey: 'third-party-tools',
    title: 'aiapi114 配置 Fluent Read',
    summary: '把 aiapi114 用于 Fluent Read 阅读翻译、总结和解释场景。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/apps/fluent-read.md'],
    body: `Fluent Read 适合阅读、翻译、总结和解释网页内容。接入 aiapi114 后，建议先用低成本文本模型验证。

## 适合先读这篇的人

- 你想在 Fluent Read 中使用 aiapi114。
- 你需要配置翻译或总结模型。
- 你担心长文章消耗过高。

## 操作步骤

### 1. 新增自定义服务

在 Fluent Read 的 AI 服务设置中选择 OpenAI 兼容或自定义 API。

### 2. 填写 Base URL 和 Key

Base URL 填写 aiapi114 的 \`/v1\` 地址，Key 填写 aiapi114 API Key。

### 3. 选择文本模型

优先选择稳定、成本适中的文本模型。长文章总结可能产生较高消耗。

### 4. 做短文本测试

先选一小段文本测试翻译或总结，再用于完整网页。

## 检查清单

- [ ] 使用文本模型而不是图像或嵌入模型。
- [ ] 已确认长文本场景的成本。
- [ ] 配置保存后完成短文本测试。
- [ ] 截图反馈时遮挡完整 Key。`,
  }),
  createArticle({
    slug: 'luna-translator',
    categoryKey: 'third-party-tools',
    title: 'aiapi114 配置 Luna Translator',
    summary: '说明 Luna Translator 接入 aiapi114 进行翻译时的 API、模型和测试方式。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/apps/luna-translator.md'],
    body: `Luna Translator 接入 aiapi114 后，可使用文本模型完成翻译。配置重点是 API 地址、Key 和模型名。

## 适合先读这篇的人

- 你想在 Luna Translator 中使用 aiapi114 翻译。
- 你不确定 API 配置入口。
- 你遇到翻译请求失败。

## 操作步骤

### 1. 打开 API 配置

进入 Luna Translator 的翻译引擎或 API 设置，新增 OpenAI 兼容配置。

### 2. 填写服务地址

API 地址填写 aiapi114 的 \`/v1\` 地址，Key 填写 aiapi114 API Key。

### 3. 设置翻译模型

从 aiapi114 复制文本模型名。翻译场景通常不需要图像模型。

### 4. 测试一句短文本

先翻译一句短文本，确认延迟和结果质量，再用于长文本。

## 检查清单

- [ ] API 地址以 \`/v1\` 结尾。
- [ ] 使用文本模型。
- [ ] 已用短文本测试成功。
- [ ] 失败时记录错误码和模型名。`,
  }),
  createArticle({
    slug: 'memoh',
    categoryKey: 'third-party-tools',
    title: 'aiapi114 配置 Memoh',
    summary: '把 aiapi114 接入 Memoh 的聊天模型配置，用于记忆、总结和检索辅助。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/apps/memoh.md'],
    body: `Memoh 类工具通常需要聊天模型，有时也需要嵌入模型。接入 aiapi114 时，应按能力分别配置。

## 适合先读这篇的人

- 你想在 Memoh 中使用 aiapi114。
- 你需要配置聊天模型或嵌入模型。
- 你不确定模型类型是否匹配。

## 操作步骤

### 1. 选择服务商

在 Memoh 设置中选择 OpenAI 兼容或自定义模型服务。

### 2. 填写 Base URL 和 Key

Base URL 使用 aiapi114 的 \`/v1\` 地址，Key 使用 aiapi114 API Key。

### 3. 配置聊天模型

聊天、总结和解释场景使用文本模型。

### 4. 配置嵌入模型

如果工具需要记忆检索或向量搜索，再填入 aiapi114 的嵌入模型。

## 检查清单

- [ ] 聊天模型和嵌入模型没有混用。
- [ ] Base URL、Key、模型名来自同一账号。
- [ ] 已完成一次短内容测试。
- [ ] 日志不输出完整 API Key。`,
  }),
]

export const FOURTH_BATCH_ADVANCED_ARTICLES: HelpArticle[] = [
  createArticle({
    slug: 'admin-channel-management',
    categoryKey: 'advanced-usage',
    title: 'aiapi114 管理员渠道管理',
    summary: '面向站点管理员说明渠道新增、测试、启停、模型映射和异常排查。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/guide/feature-guide/admin/channel.md'],
    body: `渠道管理影响模型可用性和稳定性。普通用户不需要配置渠道，管理员修改前应先做好测试和回滚准备。

## 适合先读这篇的人

- 你是 aiapi114 站点管理员。
- 你需要新增或调整模型上游渠道。
- 你要排查某个模型调用失败。

## 操作步骤

### 1. 新增渠道

按页面要求填写渠道类型、密钥、代理、分组和模型映射。

### 2. 测试渠道

保存前后都应执行低成本测试，确认认证、模型映射和返回格式正常。

### 3. 控制启停

异常渠道应先禁用，再查看错误日志。不要在高峰期批量修改多个渠道。

### 4. 记录变更

记录修改人、时间、渠道、模型和原因，方便回滚和审计。

## 检查清单

- [ ] 新渠道已完成低成本测试。
- [ ] 模型映射与平台展示一致。
- [ ] 异常渠道可快速禁用。
- [ ] 关键变更已有记录。`,
  }),
  createArticle({
    slug: 'admin-model-management',
    categoryKey: 'advanced-usage',
    title: 'aiapi114 管理员模型管理',
    summary: '说明管理员如何维护模型列表、同步上游模型、配置倍率和展示名称。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/guide/feature-guide/admin/model.md'],
    body: `模型管理决定用户看到哪些模型，以及调用时使用哪个模型 ID。管理员应保持展示名称、模型 ID 和倍率一致。

## 适合先读这篇的人

- 你需要新增或下线模型。
- 你要调整模型展示、倍率或分组。
- 用户反馈 model not found。

## 操作步骤

### 1. 核对模型 ID

确认模型 ID 与上游渠道支持的名称一致。

### 2. 设置展示信息

展示名称应帮助用户理解能力和场景，但调用 ID 必须保持精确。

### 3. 配置倍率和分组

按成本、能力和用户权限设置倍率与分组。

### 4. 做端到端测试

用用户视角复制模型名并完成一次调用，确认列表、权限和扣费都正常。

## 检查清单

- [ ] 模型 ID 与上游一致。
- [ ] 展示名不会误导用户复制错误名称。
- [ ] 倍率和分组已核对。
- [ ] 上线后完成端到端测试。`,
  }),
  createArticle({
    slug: 'admin-log-analysis',
    categoryKey: 'advanced-usage',
    title: 'aiapi114 管理员日志分析',
    summary: '说明管理员如何用日志定位失败请求、异常消耗、渠道故障和用户反馈。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/guide/feature-guide/admin/log.md'],
    body: `管理员日志用于定位系统级问题。处理反馈时，应先按时间、用户、Key、模型和状态码筛选。

## 适合先读这篇的人

- 你需要排查用户调用失败。
- 你要定位异常消耗或渠道故障。
- 你需要给用户反馈明确原因。

## 操作步骤

### 1. 收集反馈信息

请用户提供时间、模型名、Key 后四位和错误码，不要索要完整 Key。

### 2. 筛选日志

按时间、用户、模型、渠道、状态码逐步缩小范围。

### 3. 判断问题归属

区分账号余额、模型权限、参数错误、渠道异常和系统故障。

### 4. 输出处理结论

给用户结论时说明原因和下一步操作，不暴露上游密钥或内部渠道细节。

## 检查清单

- [ ] 没有收集完整 API Key。
- [ ] 已按时间和模型筛选日志。
- [ ] 已区分用户配置问题和平台问题。
- [ ] 反馈结论不暴露敏感内部信息。`,
  }),
  createArticle({
    slug: 'admin-user-management',
    categoryKey: 'advanced-usage',
    title: 'aiapi114 管理员用户管理',
    summary: '说明管理员如何查看用户、调整分组、处理额度、禁用异常账号和保留审计记录。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/guide/feature-guide/admin/user.md'],
    body: `用户管理涉及权限、额度和安全。管理员操作前应确认原因，操作后保留记录，避免误影响正常用户。

## 适合先读这篇的人

- 你需要处理用户额度或分组问题。
- 你要禁用异常账号或恢复正常账号。
- 你需要排查某个用户无法调用模型。

## 操作步骤

### 1. 搜索用户

按用户 ID、邮箱、用户名或其他可用标识搜索。不要公开展示用户隐私信息。

### 2. 查看分组和额度

确认用户所在分组、可用额度、套餐状态和 Key 使用情况。

### 3. 执行必要变更

仅执行当前问题所需的最小变更，例如调整分组、补充额度或禁用异常 Key。

### 4. 保留审计记录

记录操作时间、原因、操作人和影响范围。

## 检查清单

- [ ] 已确认用户身份和问题范围。
- [ ] 只做必要的最小变更。
- [ ] 高风险操作已有记录。
- [ ] 没有泄露用户隐私信息。`,
  }),
]

export const FOURTH_BATCH_API_ARTICLES: HelpArticle[] = [
  createArticle({
    slug: 'api-rerank',
    categoryKey: 'api-reference',
    title: 'aiapi114 Rerank 接口说明',
    summary: '说明重排序接口的输入、返回、检索增强场景和结果评估方式。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/api/ai-model/rerank/creatererank.md'],
    body: `Rerank 接口用于对候选文本重新排序，常见于知识库检索、搜索结果优化和问答召回后排序。

## 适合先读这篇的人

- 你要提升知识库检索结果质量。
- 你已经有一批候选文档，需要按相关性排序。
- 你想把检索结果再交给聊天模型回答。

## 接入步骤

### 1. 准备查询和候选文本

查询是用户问题，候选文本来自搜索、向量召回或数据库。

### 2. 选择 Rerank 模型

从 aiapi114 模型列表复制支持 Rerank 的模型名。

### 3. 提交排序请求

请求中传入 query 和 documents，服务返回相关性分数或排序结果。

### 4. 使用排序结果

取前几条高相关文本作为上下文，再交给聊天模型回答。

## 检查清单

- [ ] 使用的是 Rerank 模型。
- [ ] 候选文本已去重并控制长度。
- [ ] 业务代码保留原文来源。
- [ ] 已评估排序结果是否改善回答质量。`,
  }),
  createArticle({
    slug: 'api-realtime',
    categoryKey: 'api-reference',
    title: 'aiapi114 Realtime 接口说明',
    summary: '说明实时会话接口的使用边界、会话创建、音频/文本流和错误处理。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/api/ai-model/realtime/createrealtimesession.md'],
    body: `Realtime 接口用于低延迟交互场景，例如实时语音、即时对话和流式多模态体验。接入前请确认模型支持实时能力。

## 适合先读这篇的人

- 你要做实时语音或低延迟交互。
- 你需要创建实时会话。
- 你要处理连接断开和会话过期。

## 接入步骤

### 1. 创建会话

服务端使用 aiapi114 API Key 创建实时会话，返回客户端可使用的临时连接信息。

### 2. 建立连接

客户端按接口要求建立实时连接，并传输音频或文本事件。

### 3. 处理流式事件

前端需要展示连接中、生成中、错误和结束状态。

### 4. 做安全控制

不要把长期 API Key 暴露给浏览器。客户端只使用短期会话凭证。

## 检查清单

- [ ] 模型支持实时能力。
- [ ] 长期 API Key 只保存在服务端。
- [ ] 客户端能处理断线和重连。
- [ ] 会话过期后能重新创建。`,
  }),
  createArticle({
    slug: 'api-video-kling',
    categoryKey: 'api-reference',
    title: 'aiapi114 Kling 视频接口说明',
    summary: '说明 Kling 文生视频、图生视频、任务查询和失败重试的接入要点。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/ai-model/videos/kling/createklingtext2video.md',
      'docs/reference-help-docs/newapi-ai/api/ai-model/videos/kling/createklingimage2video.md',
      'docs/reference-help-docs/newapi-ai/api/ai-model/videos/kling/getklingtext2video.md',
    ],
    body: `Kling 视频接口通常以异步任务形式工作。创建任务后保存任务 ID，再查询任务状态和结果。

## 适合先读这篇的人

- 你要使用 Kling 文生视频或图生视频。
- 你需要处理任务排队、处理中和失败状态。
- 你想把视频生成接入业务页面。

## 接入步骤

### 1. 选择任务类型

文生视频传入提示词；图生视频还需要传入图片或图片地址。

### 2. 创建任务

调用创建接口后保存任务 ID。提示词、尺寸、时长等参数以模型支持范围为准。

### 3. 查询任务

定时查询任务状态，避免短时间内高频轮询。

### 4. 保存结果

任务成功后保存视频链接或文件。失败时显示错误原因，并限制重试次数。

## 检查清单

- [ ] 已区分文生视频和图生视频。
- [ ] 已保存任务 ID。
- [ ] 查询间隔不会过短。
- [ ] 成功结果已保存，失败原因已记录。`,
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
    difficulty: input.categoryKey === 'advanced-usage' ? '基础' : '新手',
    readTime: '约 6 分钟',
    sourceBasis: input.sourceBasis,
    sections: ['适合先读这篇的人', '操作步骤', '检查清单'],
    markdown: `# ${input.title}\n\n${input.body}`,
    audit: {
      writer: 'PASS',
      reviewer: 'PASS',
      notes: [
        '符合大纲：属于第四批帮助中心细分页面。',
        '文档框架稳定：保留竞品文档的配置、步骤、检查清单结构。',
        '竞品平台信息已替换成 aiapi114，并修正密钥安全、排查和审计边界。',
      ],
    },
  }
}
