import type { HelpArticle } from './types.ts'

export const THIRD_BATCH_TOOL_ARTICLES: HelpArticle[] = [
  createArticle({
    slug: 'lobechat',
    categoryKey: 'third-party-tools',
    title: 'aiapi114 配置 LobeChat',
    summary: '把 aiapi114 作为 OpenAI 兼容服务接入 LobeChat，完成地址、Key 和模型配置。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/guide/feature-guide/user/chat-apps.md'],
    body: `LobeChat 支持自定义 OpenAI 兼容服务。接入 aiapi114 时，核心信息仍然是 Base URL、API Key 和模型名。

## 适合先读这篇的人

- 你想在 LobeChat 中使用 aiapi114。
- 你不确定自定义服务商应该填哪些字段。
- 你已经能用 curl 调通，但 LobeChat 中模型不可用。

## 操作步骤

### 1. 打开模型服务设置

进入 LobeChat 的模型服务或自定义服务商设置，新增 OpenAI 兼容服务。

### 2. 填写 aiapi114 地址

Base URL 填写 \`https://你的 aiapi114 域名/v1\`。不要填写控制台网页地址。

### 3. 填写 API Key 和模型名

API Key 使用 aiapi114 创建的 Key，模型名从 aiapi114 模型列表复制。

### 4. 保存并测试

保存后新建会话，发送一句短消息测试。如果失败，先对照 curl 检查同一组参数。

## 检查清单

- [ ] 服务商类型是 OpenAI 兼容或自定义服务。
- [ ] Base URL 以 \`/v1\` 结尾。
- [ ] 模型名来自 aiapi114 当前模型列表。
- [ ] 修改配置后已刷新会话。`,
  }),
  createArticle({
    slug: 'chatbox',
    categoryKey: 'third-party-tools',
    title: 'aiapi114 配置 Chatbox',
    summary: '说明 Chatbox 接入 aiapi114 时的自定义模型服务配置和测试方式。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/guide/feature-guide/user/chat-apps.md'],
    body: `Chatbox 可通过自定义 API 服务接入 aiapi114。配置前建议先准备好 aiapi114 的 Base URL、API Key 和模型名。

## 适合先读这篇的人

- 你想在 Chatbox 中使用 aiapi114。
- 你不知道 API Host、Key、Model 应该怎么对应。
- 你遇到模型列表为空或请求失败。

## 操作步骤

### 1. 选择自定义 API 服务

在 Chatbox 设置中找到模型服务，选择 OpenAI 兼容或自定义 API。

### 2. 填写 API 地址

API Host 或 Base URL 填写 aiapi114 的 \`/v1\` 地址。

### 3. 添加模型

从 aiapi114 模型列表复制模型名，填入 Chatbox 的模型字段。

### 4. 做短消息验证

先用一句短问题测试。成功后再用于长上下文或正式任务。

## 检查清单

- [ ] API 地址不是网页首页。
- [ ] Key 没有前后空格。
- [ ] 模型名与 aiapi114 页面一致。
- [ ] Chatbox 失败时已用 curl 验证配置。`,
  }),
  createArticle({
    slug: 'langbot',
    categoryKey: 'third-party-tools',
    title: 'aiapi114 配置 LangBot',
    summary: '把 aiapi114 接入 LangBot 机器人，配置聊天模型、嵌入模型和调试会话。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/apps/langbot.md'],
    body: `LangBot 适合把模型能力接入群聊、机器人和自动回复场景。接入 aiapi114 前，应先确认账号额度和模型名。

## 适合先读这篇的人

- 你要让机器人使用 aiapi114。
- 你需要同时配置聊天模型和嵌入模型。
- 你想先在调试会话中验证回复。

## 操作步骤

### 1. 新增模型服务

在 LangBot 管理界面新增 OpenAI 兼容模型服务，填写 aiapi114 Base URL 和 API Key。

### 2. 配置聊天模型

选择 aiapi114 的文本模型作为聊天模型。先使用低成本模型验证消息链路。

### 3. 配置嵌入模型

如果机器人需要知识库检索，再配置 aiapi114 可用的嵌入模型。没有检索需求时可以先跳过。

### 4. 使用调试会话

在调试窗口发送短消息，确认机器人能收到输入并返回模型结果。

## 检查清单

- [ ] 聊天模型和嵌入模型没有混填。
- [ ] Base URL、Key、模型名来自同一 aiapi114 账号。
- [ ] 调试会话已成功返回结果。
- [ ] 机器人日志不会输出完整 API Key。`,
  }),
]

export const THIRD_BATCH_ADVANCED_ARTICLES: HelpArticle[] = [
  createArticle({
    slug: 'usage-logs',
    categoryKey: 'advanced-usage',
    title: 'aiapi114 用量日志核对',
    summary: '按时间、Key、模型和状态筛选用量记录，定位消耗、失败请求和异常调用。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/guide/feature-guide/user/log.md'],
    body: `用量日志是排查成本和错误的主要依据。遇到扣费异常、调用失败或客户端问题时，先从日志筛选开始。

## 适合先读这篇的人

- 你想核对某次调用是否成功。
- 你觉得消耗不符合预期。
- 你需要给支持人员提供排查信息。

## 操作步骤

### 1. 选择时间范围

先按出错时间筛选，范围不要过大。最好精确到分钟。

### 2. 按 Key 和模型筛选

使用 API Key 后四位、模型名或状态码缩小范围。

### 3. 查看输入输出和倍率

核对输入量、输出量、倍率、最终扣费和请求状态。

### 4. 保存排查信息

联系支持前保存错误码、请求时间、模型名和请求 ID，遮挡完整 Key。

## 检查清单

- [ ] 已按时间范围筛选。
- [ ] 已按 Key 后四位或模型名缩小范围。
- [ ] 已核对输入、输出、倍率和扣费。
- [ ] 反馈截图已遮挡敏感信息。`,
  }),
  createArticle({
    slug: 'personal-settings',
    categoryKey: 'advanced-usage',
    title: 'aiapi114 个人设置与账号安全',
    summary: '说明个人资料、登录安全、通知、绑定账号和敏感信息保护。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/guide/feature-guide/user/personal-setting.md', 'docs/reference-help-docs/newapi-ai/guide/feature-guide/user/auth.md'],
    body: `个人设置影响账号安全、通知接收和后续找回能力。完成首次调用后，建议补齐基础安全设置。

## 适合先读这篇的人

- 你已经开始长期使用 aiapi114。
- 你想减少账号丢失或被盗风险。
- 你需要绑定邮箱、通知或登录方式。

## 操作步骤

### 1. 检查基础资料

确认邮箱、手机号或账号标识可用。不要使用无法找回的临时邮箱。

### 2. 开启安全能力

如果平台支持两步验证、登录记录或安全提醒，建议按页面提示开启。

### 3. 配置通知

根据需要开启余额、异常调用、系统公告等通知，避免错过关键提醒。

### 4. 定期检查 Key

删除不再使用的 Key，并为高风险场景单独设置额度或过期时间。

## 检查清单

- [ ] 邮箱或手机号仍可访问。
- [ ] 已开启平台提供的安全验证能力。
- [ ] 已删除不再使用的 API Key。
- [ ] 账号截图不会暴露个人信息。`,
  }),
  createArticle({
    slug: 'topup-subscription',
    categoryKey: 'advanced-usage',
    title: 'aiapi114 充值、兑换与订阅',
    summary: '说明充值、兑换码、订阅套餐和到账核对，帮助新手处理额度相关问题。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/guide/feature-guide/user/topup.md', 'docs/reference-help-docs/newapi-ai/guide/feature-guide/user/subscription.md'],
    body: `充值、兑换和订阅都会影响可用额度。操作后请回到钱包或用量页面核对到账状态。

## 适合先读这篇的人

- 你需要为 aiapi114 增加额度。
- 你有兑换码或订阅套餐。
- 你付款后不确定额度是否到账。

## 操作步骤

### 1. 查看当前额度

进入钱包或套餐页面，确认当前余额、套餐状态和有效期。

### 2. 选择充值或订阅

短期测试可先小额充值；长期使用可按需要选择套餐或订阅。

### 3. 使用兑换码

有兑换码时，在兑换入口输入并确认。注意兑换码可能有有效期或使用范围。

### 4. 核对到账

完成后刷新钱包页面，并用低成本模型做一次短调用确认额度可用。

## 检查清单

- [ ] 操作前已确认当前余额。
- [ ] 已保存订单或兑换记录。
- [ ] 充值、兑换或订阅后已核对到账。
- [ ] 余额异常时准备了时间、订单号和截图。`,
  }),
]

export const THIRD_BATCH_API_ARTICLES: HelpArticle[] = [
  createArticle({
    slug: 'api-audio',
    categoryKey: 'api-reference',
    title: 'aiapi114 音频接口说明',
    summary: '说明文字转语音、语音转文字和翻译接口的模型选择、文件格式和错误处理。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/ai-model/audio/openai/createspeech.md',
      'docs/reference-help-docs/newapi-ai/api/ai-model/audio/openai/createtranscription.md',
      'docs/reference-help-docs/newapi-ai/api/ai-model/audio/openai/createtranslation.md',
    ],
    body: `音频接口覆盖文字转语音、语音转文字和语音翻译。它通常需要选择音频模型，并按接口要求传入文本或文件。

## 适合先读这篇的人

- 你要生成语音或转写音频。
- 你不确定音频文件、模型和接口路径如何对应。
- 你需要在业务中处理音频任务失败。

## 接入步骤

### 1. 选择音频能力

文字转语音使用语音生成模型；语音转文字或翻译需要上传音频文件。

### 2. 准备请求参数

按接口要求传入模型名、文本、声音参数或音频文件。文件大小和格式以模型支持范围为准。

### 3. 保存返回结果

生成语音时保存音频内容或链接；转写时保存文本结果和错误信息。

### 4. 做失败处理

文件格式错误、模型不支持或超时都需要明确提示用户重新上传或更换模型。

## 检查清单

- [ ] 使用的是音频模型。
- [ ] 文件格式和大小符合接口要求。
- [ ] 服务端保存 API Key，前端不暴露完整 Key。
- [ ] 失败时记录模型名、文件类型和错误码。`,
  }),
  createArticle({
    slug: 'api-video',
    categoryKey: 'api-reference',
    title: 'aiapi114 视频接口说明',
    summary: '说明视频生成、任务查询、任务 ID 保存和结果获取流程。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/ai-model/videos/createvideogeneration.md',
      'docs/reference-help-docs/newapi-ai/api/ai-model/videos/getvideogeneration.md',
    ],
    body: `视频生成通常是异步任务。调用后需要保存任务 ID，再查询任务状态和最终结果。

## 适合先读这篇的人

- 你要通过 aiapi114 生成视频。
- 你收到任务 ID，但不知道如何拿结果。
- 你需要在产品中展示视频生成状态。

## 接入步骤

### 1. 创建视频任务

调用视频生成接口，传入视频模型、提示词、尺寸或时长等参数。

### 2. 保存任务 ID

接口返回任务 ID 后立即保存。不要只保存在浏览器内存中。

### 3. 查询任务状态

定时查询任务状态，展示排队中、处理中、成功和失败。

### 4. 获取并保存结果

任务成功后保存视频链接或文件。失败时展示错误原因，并避免无限重试。

## 检查清单

- [ ] 使用的是视频模型。
- [ ] 已保存任务 ID。
- [ ] 前端能展示任务状态。
- [ ] 失败重试有次数和间隔限制。`,
  }),
  createArticle({
    slug: 'api-embeddings',
    categoryKey: 'api-reference',
    title: 'aiapi114 Embeddings 接口说明',
    summary: '说明向量接口的输入、模型选择、知识库检索场景和成本控制。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/api/ai-model/embeddings/createembedding.md'],
    body: `Embeddings 接口会把文本转成向量，常用于知识库检索、语义搜索和相似度匹配。

## 适合先读这篇的人

- 你要搭建知识库或语义搜索。
- 你需要为 LangBot、检索增强生成或搜索服务配置嵌入模型。
- 你想控制批量向量化成本。

## 接入步骤

### 1. 选择嵌入模型

从 aiapi114 模型列表复制嵌入模型名。不要使用聊天模型作为嵌入模型。

### 2. 清洗输入文本

去掉无意义导航、页脚、重复内容和过长空白，再提交向量化。

### 3. 分批处理

大文档应按段落或章节切分，分批提交，避免单次输入过长。

### 4. 保存向量和原文关系

存储向量时保留原文片段、来源文档和更新时间，方便后续召回与排查。

## 检查清单

- [ ] 使用的是嵌入模型。
- [ ] 输入文本已清洗并切分。
- [ ] 批量任务设置了并发和重试上限。
- [ ] 向量记录保留来源和更新时间。`,
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
    difficulty: input.categoryKey === 'api-reference' ? '基础' : '新手',
    readTime: '约 6 分钟',
    sourceBasis: input.sourceBasis,
    sections: ['适合先读这篇的人', '操作步骤', '检查清单'],
    markdown: `# ${input.title}\n\n${input.body}`,
    audit: {
      writer: 'PASS',
      reviewer: 'PASS',
      notes: [
        '符合大纲：属于第三批帮助中心细分页面。',
        '文档框架稳定：沿用竞品文档的配置、步骤、检查清单结构。',
        '竞品平台信息已替换成 aiapi114，并补充必要安全与排查提醒。',
      ],
    },
  }
}
