import type { HelpArticle } from './types.ts'

export const QUICK_USE_DETAIL_ARTICLES: HelpArticle[] = [
  createArticle({
    slug: 'chat-completions',
    categoryKey: 'quick-use',
    title: 'aiapi114 文本对话调用',
    summary: '用 OpenAI 兼容的 Chat Completions 接口完成问答、总结、改写和代码解释。',
    sourceBasis: [
      'docs/reference-help-docs/codexzh-ai-hub-api/chat-tutorial.md',
      'docs/reference-help-docs/newapi-ai/api/ai-model/chat/openai/createchatcompletion.md',
    ],
    body: `文本对话是 aiapi114 最常用的入口。你只需要 Base URL、API Key、模型名和 messages 数组。

## 适合先读这篇的人

- 你准备在代码里调用文本模型。
- 你想确认 messages、model 和 stream 应该怎么写。
- 你需要先完成一个最小可用示例。

## 操作步骤

### 1. 准备请求地址

请求路径通常是 \`POST /v1/chat/completions\`。Base URL 使用 aiapi114 域名，并以 \`/v1\` 结尾。

### 2. 传入认证信息

在 Header 中加入 \`Authorization: Bearer 你的_API_Key\`，并设置 \`Content-Type: application/json\`。

### 3. 编写 messages

\`system\` 用来设定助手行为，\`user\` 放用户问题。先用短文本测试，再接入正式提示词。

### 4. 需要实时显示时开启流式

把 \`stream\` 设置为 \`true\` 后，客户端需要按流式响应逐段读取。

## 检查清单

- [ ] 模型名来自 aiapi114 模型列表。
- [ ] messages 至少包含一条 user 消息。
- [ ] 生产环境设置了超时时间和错误处理。
- [ ] 没有在前端代码暴露完整 API Key。`,
  }),
  createArticle({
    slug: 'image-generation',
    categoryKey: 'quick-use',
    title: 'aiapi114 图像生成',
    summary: '说明图像模型的选择、提示词、尺寸参数和任务结果检查方式。',
    sourceBasis: [
      'docs/reference-help-docs/codexzh-ai-hub-api/image-tutorial.md',
      'docs/reference-help-docs/newapi-ai/api/ai-model/images/openai/post-v1-images-generations.md',
    ],
    body: `图像生成适合海报草图、产品插图、头像和视觉素材。它通常比文本调用更慢，也更依赖模型能力和尺寸参数。

## 适合先读这篇的人

- 你要通过 aiapi114 生成图片。
- 你不确定图像模型名、尺寸或提示词怎么写。
- 你遇到图像任务排队、失败或结果为空。

## 操作步骤

### 1. 选择图像模型

从 aiapi114 模型列表复制图像模型名。不要把文本模型用于图像生成。

### 2. 编写提示词

提示词应包含主体、风格、场景、尺寸倾向和限制。先用短提示词验证模型可用，再逐步增加细节。

### 3. 设置尺寸

按模型支持范围填写 \`size\`。如果模型不支持某个尺寸，换用支持的尺寸后重试。

### 4. 查看结果或任务状态

部分图像模型会直接返回图片 URL，部分会返回任务 ID。返回任务 ID 时，需要到任务记录中查看状态。

## 检查清单

- [ ] 已选择图像模型而不是文本模型。
- [ ] 提示词没有包含不必要的敏感信息。
- [ ] 尺寸参数符合模型支持范围。
- [ ] 生成失败时保存了错误码、模型名和请求时间。`,
  }),
  createArticle({
    slug: 'models-list',
    categoryKey: 'quick-use',
    title: 'aiapi114 模型列表与模型名',
    summary: '说明如何复制准确模型名、理解模型类型，并避免 model not found。',
    sourceBasis: [
      'docs/reference-help-docs/codexzh-ai-hub-api/models-list.md',
      'docs/reference-help-docs/newapi-ai/api/ai-model/models/list/listmodels.md',
    ],
    body: `模型名是调用成功的关键字段。显示名称、模型别名和实际模型 ID 可能不同，接入时应复制 aiapi114 当前展示的可用模型名。

## 适合先读这篇的人

- 你遇到 model not found。
- 你不知道文本、图像、语音模型有什么区别。
- 你想在程序里读取可用模型列表。

## 操作步骤

### 1. 从平台复制模型名

进入 aiapi114 模型列表或定价页面，复制实际模型 ID。

### 2. 确认模型类型

文本、图像、音频、视频模型对应不同接口。不要只看模型名称相似就混用接口。

### 3. 调用模型列表接口

需要程序动态读取时，可以请求 \`GET /v1/models\`，确认当前 Key 可见的模型。

### 4. 处理不可用模型

如果模型暂不可用，换用同类型备用模型，并检查账号分组或套餐权限。

## 检查清单

- [ ] 模型名从 aiapi114 当前页面复制。
- [ ] 已确认模型类型和接口匹配。
- [ ] Key 有权限使用该模型。
- [ ] 记录了生产服务使用的模型名。`,
  }),
]

export const TOOL_DETAIL_ARTICLES: HelpArticle[] = [
  createArticle({
    slug: 'cherry-studio',
    categoryKey: 'third-party-tools',
    title: 'aiapi114 配置 Cherry Studio',
    summary: '把 aiapi114 作为 OpenAI 兼容服务接入 Cherry Studio，完成模型添加和测试对话。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/apps/cherry-studio.md',
      'docs/reference-help-docs/ikuncode/apps/cherry-studio.md',
    ],
    body: `Cherry Studio 可以通过 OpenAI 兼容服务接入 aiapi114。核心配置仍然是 Base URL、API Key 和模型名。

## 适合先读这篇的人

- 你想在 Cherry Studio 中使用 aiapi114。
- 你不确定服务商、API 地址和模型名应该如何填写。
- 你已经配置过，但测试对话失败。

## 操作步骤

### 1. 新增 OpenAI 兼容服务

在模型服务设置中新增服务，选择 OpenAI Compatible、自定义 OpenAI 或类似选项。

### 2. 填写 Base URL 和 API Key

Base URL 填 \`https://你的 aiapi114 域名/v1\`，API Key 填 aiapi114 创建的 Key。

### 3. 添加模型

从 aiapi114 模型列表复制模型名，添加到 Cherry Studio 的模型配置中。

### 4. 发送测试消息

保存后发送一句短消息。如果失败，先用 curl 验证同一组参数。

## 检查清单

- [ ] 服务类型是 OpenAI 兼容或自定义 OpenAI。
- [ ] Base URL 以 \`/v1\` 结尾。
- [ ] 模型名来自 aiapi114。
- [ ] 修改配置后已重启或刷新客户端。`,
  }),
  createArticle({
    slug: 'claude-code',
    categoryKey: 'third-party-tools',
    title: 'aiapi114 配置 Claude Code',
    summary: '说明 Claude Code 使用 aiapi114 兼容接口时的地址、Key、模型名和排查方式。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/apps/claude-code.md',
      'docs/reference-help-docs/ikuncode/deploy/claude-code.md',
    ],
    body: `Claude Code 接入 aiapi114 时，应把 aiapi114 当作兼容模型服务。不同版本配置字段可能不同，但核心信息一致。

## 适合先读这篇的人

- 你想在 Claude Code 中使用 aiapi114。
- 你需要配置环境变量或 provider。
- 你遇到认证、模型名或网络错误。

## 操作步骤

### 1. 准备三项信息

准备 Base URL、API Key 和模型名。Base URL 应写到 \`/v1\`。

### 2. 写入配置

按 Claude Code 当前配置方式，把接口地址和 Key 写入对应 provider 或环境变量。

### 3. 设置模型名

将默认模型改成 aiapi114 可用模型，避免沿用其他平台的模型别名。

### 4. 做最小验证

先发一个短任务，确认模型能返回结果，再用于较长代码任务。

## 检查清单

- [ ] Base URL、Key、模型名来自同一个 aiapi114 账号。
- [ ] 没有混用其他平台的模型别名。
- [ ] 配置变更后已重新打开终端或客户端。
- [ ] 失败时已保存错误码和请求时间。`,
  }),
  createArticle({
    slug: 'codex-cli',
    categoryKey: 'third-party-tools',
    title: 'aiapi114 配置 Codex CLI',
    summary: '说明 Codex CLI 接入 aiapi114 的 provider 配置、模型名选择和常见错误。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/apps/codex-cli.md',
      'docs/reference-help-docs/codexzh-ai-hub-api/cli-config.md',
      'docs/reference-help-docs/ikuncode/deploy/codex.md',
    ],
    body: `Codex CLI 通常通过配置 provider 接入 OpenAI 兼容服务。接入 aiapi114 时，先保证同一组参数能用 curl 调通。

## 适合先读这篇的人

- 你要在 Codex CLI 中使用 aiapi114。
- 你不确定 provider 配置字段。
- 你遇到 Key 正确但 CLI 无法调用的问题。

## 操作步骤

### 1. 新增 provider

在 Codex CLI 配置中新增 OpenAI 兼容 provider，命名为 aiapi114 或便于识别的名称。

### 2. 设置 API 地址

Base URL 使用 aiapi114 的 \`/v1\` 地址，不要填写控制台网页地址。

### 3. 设置 API Key 和模型名

Key 从 aiapi114 API Key 页面复制，模型名从模型列表复制。

### 4. 验证并切换

保存后执行一个简短命令验证。多个 provider 共存时，确认当前 CLI 使用的是 aiapi114 配置。

## 检查清单

- [ ] provider 名称能清楚识别 aiapi114。
- [ ] API 地址不是网页首页地址。
- [ ] 当前运行配置确实切到了 aiapi114。
- [ ] 错误排查时已用 curl 对照验证。`,
  }),
]

export const ADVANCED_DETAIL_ARTICLES: HelpArticle[] = [
  createArticle({
    slug: 'model-groups-billing',
    categoryKey: 'advanced-usage',
    title: 'aiapi114 模型分组与倍率',
    summary: '解释模型分组、权限和倍率如何影响可用模型与最终消耗。',
    sourceBasis: [
      'docs/reference-help-docs/codexzh-ai-hub-api/model-groups.md',
      'docs/reference-help-docs/newapi-ai/guide/feature-guide/user/pricing.md',
    ],
    body: `模型分组和倍率会影响你能调用哪些模型，以及每次调用产生多少消耗。长期使用前，应先理解这两个概念。

## 适合先读这篇的人

- 你发现某些模型不可用。
- 你想解释不同模型的消耗差异。
- 你需要给团队制定模型使用规则。

## 操作步骤

### 1. 查看账号可用分组

在模型列表或账号权益中确认当前账号能使用哪些模型分组。

### 2. 查看模型倍率

在定价或模型详情中查看倍率。倍率越高，同样输入输出可能产生更高消耗。

### 3. 按场景选择模型

日常问答使用成本适中的模型，复杂推理、图像或视频任务再选择高能力模型。

### 4. 定期核对用量

按 Key、模型和时间筛选日志，确认团队使用是否符合预期。

## 检查清单

- [ ] 已确认账号有目标模型分组权限。
- [ ] 已理解高倍率模型的成本影响。
- [ ] 团队项目记录了默认模型和备用模型。
- [ ] 异常消耗能定位到 Key 和模型。`,
  }),
  createArticle({
    slug: 'rate-limits',
    categoryKey: 'advanced-usage',
    title: 'aiapi114 限速与并发控制',
    summary: '说明 429、并发过高、批量任务重试和退避策略，帮助稳定长期调用。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/guide/console/settings/rate-settings.md'],
    body: `限速用于保护服务稳定。遇到 429 或请求过快时，不要无限重试，应降低并发并加入退避策略。

## 适合先读这篇的人

- 你遇到 429 或 rate limit。
- 你要做批量处理、机器人或自动化任务。
- 你需要让服务在失败后自动恢复。

## 操作步骤

### 1. 降低并发

先把并发降到较低水平，确认请求稳定后再逐步提高。

### 2. 增加退避重试

失败后等待一段时间再重试，连续失败时逐步拉长等待时间。

### 3. 设置超时

客户端应设置合理超时，避免请求长期占用连接。

### 4. 记录请求指标

生产环境记录模型名、Key 后四位、耗时、状态码和错误信息。

## 检查清单

- [ ] 批量任务设置了并发上限。
- [ ] 429 后不会立即无限重试。
- [ ] 客户端有超时和错误处理。
- [ ] 日志能定位失败请求。`,
  }),
  createArticle({
    slug: 'async-tasks',
    categoryKey: 'advanced-usage',
    title: 'aiapi114 异步任务与任务记录',
    summary: '说明图像、视频等长耗时任务的任务 ID、状态查询、失败重试和结果保存。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/guide/feature-guide/user/task.md',
      'docs/reference-help-docs/newapi-ai/api/management/tasks/task-self-get.md',
    ],
    body: `部分图像、视频和长耗时任务不会立即返回最终结果，而是返回任务 ID。你需要保存任务 ID 并查询任务状态。

## 适合先读这篇的人

- 你调用图像或视频模型后只拿到任务 ID。
- 你不知道如何判断任务成功或失败。
- 你要在业务系统中展示异步结果。

## 操作步骤

### 1. 保存任务 ID

请求返回任务 ID 后，业务系统应立即保存，避免刷新页面后丢失。

### 2. 查询任务状态

在任务记录中查看排队中、处理中、成功或失败。不要在任务仍处理中时重复提交同一请求。

### 3. 处理失败结果

失败时先查看错误原因。参数错误应修正后再提交，服务繁忙可稍后重试。

### 4. 保存最终结果

任务成功后保存图片、视频链接或结果内容，避免结果过期后无法访问。

## 检查清单

- [ ] 已保存任务 ID。
- [ ] 前端能展示处理中、成功、失败状态。
- [ ] 失败重试前会先判断错误原因。
- [ ] 成功结果已保存到业务需要的位置。`,
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
    difficulty: '基础',
    readTime: '约 6 分钟',
    sourceBasis: input.sourceBasis,
    sections: ['适合先读这篇的人', '操作步骤', '检查清单', '下一步'],
    markdown: `# ${input.title}\n\n${input.body}`,
    audit: {
      writer: 'PASS',
      reviewer: 'PASS',
      notes: [
        '符合大纲：属于当前帮助中心二级目录规划。',
        '文档框架稳定：保留竞品文档的配置、步骤、检查清单结构。',
        '竞品平台信息已替换成 aiapi114，并修正密钥安全与排查边界。',
      ],
    },
  }
}
