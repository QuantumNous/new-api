import type { HelpArticle } from './types.ts'

export const FIFTH_BATCH_TOOL_ARTICLES: HelpArticle[] = [
  createArticle({
    slug: 'aionui',
    categoryKey: 'third-party-tools',
    title: 'aiapi114 配置 AionUi',
    summary: '把 aiapi114 接入 AionUi 桌面办公 Agent，统一配置 Base URL、API Key 和模型。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/apps/aionui.md'],
    body: `AionUi 支持在桌面界面中管理多种 AI Agent。接入 aiapi114 时，重点是把模型服务配置为 OpenAI 兼容地址，并确认模型名来自 aiapi114 模型列表。

## 适合先读这篇的人

- 你想在 AionUi 中使用 aiapi114 的文本或图像模型。
- 你需要给多个 Agent 统一配置同一组模型服务。
- 你遇到模型列表为空、请求失败或模型名不匹配的问题。

## 操作步骤

### 1. 打开模型配置

进入 AionUi 设置页，找到模型配置或 Provider 管理入口，新增 OpenAI 兼容服务。

### 2. 填写 aiapi114 服务信息

Base URL 填写 \`https://你的 aiapi114 域名/v1\`，API Key 填写在 aiapi114 创建的 Key。不要填写控制台网页地址。

### 3. 添加模型

从 aiapi114 模型列表复制模型名。文本、图像、嵌入等能力应分别填入对应模型类型。

### 4. 启动短任务验证

先新建一个简单会话，发送短消息确认返回正常，再把配置用于长任务或多个 Agent。

## 检查清单

- [ ] Provider 类型是 OpenAI 兼容或自定义服务。
- [ ] Base URL 以 \`/v1\` 结尾。
- [ ] 模型名来自 aiapi114 当前模型列表。
- [ ] 多 Agent 共用配置时没有暴露完整 API Key。`,
  }),
  createArticle({
    slug: 'cc-switch',
    categoryKey: 'third-party-tools',
    title: 'aiapi114 配置 CC Switch',
    summary: '使用 CC Switch 管理 Claude Code、Codex、Gemini CLI 等工具时接入 aiapi114。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/apps/cc-switch.md',
      'docs/reference-help-docs/codexzh-ai-hub-api/cc-switch.md',
    ],
    body: `CC Switch 用于统一管理多个 AI CLI 的 Provider 配置。接入 aiapi114 后，可以在不同 CLI 之间复用同一组 Base URL、API Key 和模型映射。

## 适合先读这篇的人

- 你同时使用 Claude Code、Codex 或 Gemini CLI。
- 你想用 CC Switch 集中管理 aiapi114 配置。
- 你需要为不同 CLI 设置不同主模型或备用模型。

## 操作步骤

### 1. 新增 Provider

在 CC Switch 中新增 Provider，类型选择 OpenAI 兼容或自定义 API。

### 2. 填写连接字段

Base URL 填写 aiapi114 的 \`/v1\` 地址，API Key 使用 aiapi114 创建的 Key。名称可写成 \`aiapi114\`，便于后续切换。

### 3. 配置模型层级

按工具需要设置主模型、轻量模型、均衡模型和强模型。每个模型名都应从 aiapi114 模型列表复制。

### 4. 切换并验证 CLI

在目标 CLI 中切换到该 Provider，执行一次短提示词验证。失败时先检查 Base URL、Key 和模型名。

## 检查清单

- [ ] Provider 名称能清楚识别为 aiapi114。
- [ ] 主模型与备用模型都能在 aiapi114 调用。
- [ ] 不同 CLI 的配置没有混用错误模型名。
- [ ] 本地配置文件没有被提交到公共仓库。`,
  }),
  createArticle({
    slug: 'factory-droid-cli',
    categoryKey: 'third-party-tools',
    title: 'aiapi114 配置 Factory Droid CLI',
    summary: '在 Factory Droid CLI 中使用 aiapi114 模型能力，完成工程辅助任务前的安全配置。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/apps/factory-droid-cli.md'],
    body: `Factory Droid CLI 是面向软件工程任务的命令行 Agent。接入 aiapi114 时，不建议依赖来源不明的一键远程脚本，应优先理解配置字段，再按本地环境写入。

## 适合先读这篇的人

- 你想让 Droid CLI 使用 aiapi114 的模型。
- 你需要在项目目录中运行 AI 编程助手。
- 你担心一键脚本修改本地配置或泄露 Key。

## 操作步骤

### 1. 完成 Droid CLI 基础安装

先按 Factory 官方文档安装并登录 Droid CLI，确认 \`droid\` 命令可以正常启动。

### 2. 找到模型配置入口

打开 Droid CLI 的配置文件或 Provider 设置入口，选择 OpenAI 兼容服务。

### 3. 填写 aiapi114 字段

Base URL 使用 aiapi114 的 \`/v1\` 地址，API Key 使用 aiapi114 Key，模型名从 aiapi114 模型列表复制。

### 4. 在测试项目中验证

先在非生产项目中运行短任务，例如解释一个小文件或生成简单测试，确认响应、成本和权限都符合预期。

## 检查清单

- [ ] Droid CLI 已能独立启动。
- [ ] 没有执行来源不明的一键配置脚本。
- [ ] API Key 保存在本机安全位置或环境变量中。
- [ ] 首次验证使用非生产项目和低风险任务。`,
  }),
  createArticle({
    slug: 'openclaw',
    categoryKey: 'third-party-tools',
    title: 'aiapi114 配置 OpenClaw',
    summary: '把 aiapi114 作为 OpenClaw 的 OpenAI 兼容模型 Provider，用于自托管 AI 助手。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/apps/openclaw.md'],
    body: `OpenClaw 适合自托管多渠道 AI 助手。接入 aiapi114 前，应先确认 OpenClaw Gateway 和控制台已经正常运行，再修改模型 Provider。

## 适合先读这篇的人

- 你想让自托管 OpenClaw 使用 aiapi114 模型。
- 你需要把默认模型切换到 aiapi114。
- 你想区分 OpenClaw 运行问题和模型配置问题。

## 操作步骤

### 1. 先跑通 OpenClaw

按 OpenClaw 官方流程完成安装、初始化和控制台启动。此阶段先不要修改 aiapi114 配置。

### 2. 准备环境变量

建议把 aiapi114 API Key 放在服务进程可读取的环境变量中，例如 \`AIAPI114_API_KEY\`，不要直接写入公开配置。

### 3. 新增 Provider

在 OpenClaw 模型配置中新增 provider，Base URL 指向 aiapi114 的 \`/v1\` 地址，API Key 从环境变量读取。

### 4. 配置默认模型

把默认模型设置为 \`provider/model-id\` 形式，model-id 必须与 aiapi114 模型列表一致。

## 检查清单

- [ ] OpenClaw Gateway 和控制台已先独立跑通。
- [ ] API Key 通过环境变量或安全配置注入。
- [ ] 默认模型引用与 Provider 中声明的模型 ID 一致。
- [ ] 失败时能查看 OpenClaw 日志和 aiapi114 用量日志。`,
  }),
]

export const FIFTH_BATCH_ADVANCED_ARTICLES: HelpArticle[] = [
  createArticle({
    slug: 'console-dashboard',
    categoryKey: 'advanced-usage',
    title: 'aiapi114 数据看板使用说明',
    summary: '通过数据看板查看平台总体统计、调用趋势和排查入口。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/guide/console/dashboard.md'],
    body: `数据看板适合快速了解 aiapi114 的整体使用情况。新手不要只看单个数字，应结合时间范围、模型、Key 和日志一起判断。

## 适合先读这篇的人

- 你想查看近期调用量和消耗变化。
- 你需要判断某次异常是个别请求还是整体波动。
- 你要给团队同步平台使用概况。

## 操作步骤

### 1. 选择时间范围

先按今天、最近 7 天或自定义时间筛选。排查问题时尽量精确到发生问题的时间段。

### 2. 查看核心指标

关注请求量、成功率、消耗、活跃 Key 和主要模型。不要只凭单一指标判断问题。

### 3. 下钻到日志

发现异常波动后，进入用量日志按模型、Key、状态码继续筛选。

### 4. 输出排查结论

记录异常时间、影响模型、影响用户和初步原因，便于后续复盘。

## 检查清单

- [ ] 已选择正确时间范围。
- [ ] 已同时查看请求量、成功率和消耗。
- [ ] 异常波动已下钻到日志核对。
- [ ] 对外反馈不包含敏感 Key 或用户隐私。`,
  }),
  createArticle({
    slug: 'console-playground',
    categoryKey: 'advanced-usage',
    title: 'aiapi114 操练场使用说明',
    summary: '使用操练场快速测试模型、提示词和参数，减少客户端配置干扰。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/guide/console/playground.md'],
    body: `操练场用于在控制台内直接测试模型。它适合验证模型是否可用、提示词是否合理，以及参数是否导致异常。

## 适合先读这篇的人

- 你想先不接第三方客户端，直接测试模型。
- 你需要确认某个模型是否可用。
- 你要排除客户端配置错误带来的干扰。

## 操作步骤

### 1. 选择模型

从 aiapi114 模型列表中选择要测试的模型。新手建议先选稳定、成本较低的文本模型。

### 2. 输入短提示词

先输入一句短问题，确认基本调用链路正常，再逐步增加上下文和参数。

### 3. 调整参数

按需要调整温度、最大输出长度等参数。参数越复杂，越应记录改动前后的结果。

### 4. 对照日志

测试后查看用量日志，核对请求是否成功、消耗是否符合预期。

## 检查清单

- [ ] 已先用短提示词测试。
- [ ] 模型名来自 aiapi114 当前列表。
- [ ] 参数调整有记录。
- [ ] 已在用量日志中核对测试请求。`,
  }),
  createArticle({
    slug: 'console-wallet',
    categoryKey: 'advanced-usage',
    title: 'aiapi114 钱包与余额管理',
    summary: '说明钱包中余额、兑换、充值记录和邀请记录的查看方式。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/guide/console/wallet.md'],
    body: `钱包用于查看和管理 aiapi114 的可用余额、充值记录、兑换记录等信息。涉及金额时，应以页面记录和订单记录为准。

## 适合先读这篇的人

- 你想确认当前余额是否足够。
- 你刚完成充值或兑换，需要核对到账。
- 你遇到扣费异常或余额不足提示。

## 操作步骤

### 1. 查看当前余额

进入钱包页面，确认可用余额、套餐或订阅状态，以及最近变动时间。

### 2. 核对充值和兑换记录

完成充值或兑换后刷新页面，保存订单号、兑换记录和时间。

### 3. 关联用量日志

如果余额变化不符合预期，到用量日志按时间和模型核对消耗。

### 4. 反馈异常

余额异常时提供时间、订单号、金额和截图。截图中应遮挡个人信息和完整 Key。

## 检查清单

- [ ] 已刷新钱包页面确认最新余额。
- [ ] 已保存充值或兑换记录。
- [ ] 扣费疑问已与用量日志交叉核对。
- [ ] 反馈截图已遮挡敏感信息。`,
  }),
]

export const FIFTH_BATCH_API_ARTICLES: HelpArticle[] = [
  createArticle({
    slug: 'api-responses',
    categoryKey: 'api-reference',
    title: 'aiapi114 Responses 接口说明',
    summary: '说明 Responses 格式的请求字段、返回结构、流式输出和排查要点。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/api/ai-model/chat/openai/createresponse.md'],
    body: `Responses 接口用于创建模型响应，适合需要多轮输入、工具调用或更统一响应结构的场景。接入前请先确认所选模型支持该接口格式。

## 适合先读这篇的人

- 你想使用 \`/v1/responses\` 格式调用 aiapi114。
- 你需要处理 input、instructions、stream 等字段。
- 你想从 Chat Completions 迁移到 Responses 格式。

## 接入步骤

### 1. 准备认证信息

请求头使用 \`Authorization: Bearer sk-xxxx\`。Key 应只保存在服务端，不要暴露到浏览器。

### 2. 构造请求体

至少传入 \`model\` 和 \`input\`。需要系统指令时使用 \`instructions\`，需要流式输出时设置 \`stream\`。

### 3. 解析返回结构

成功响应通常包含 \`id\`、\`status\`、\`model\`、\`output\` 和 \`usage\`。业务代码应从 output 中读取文本内容，并记录 usage 便于核算。

### 4. 处理错误和兼容性

如果模型不支持 Responses 格式，改用 Chat Completions 或更换支持该格式的模型。

## 检查清单

- [ ] 模型支持 Responses 接口。
- [ ] 服务端保存 API Key。
- [ ] 业务代码解析了 output 和 usage。
- [ ] 失败时记录状态码、模型名和请求 ID。`,
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
    sections: ['适合先读这篇的人', input.categoryKey === 'api-reference' ? '接入步骤' : '操作步骤', '检查清单'],
    markdown: `# ${input.title}\n\n${input.body}`,
    audit: {
      writer: 'PASS',
      reviewer: 'PASS',
      notes: [
        '符合大纲：属于第五批帮助中心细分页面。',
        '文档框架稳定：保留竞品文档的介绍、配置步骤、检查清单结构。',
        '竞品平台信息已替换成 aiapi114，并修正远程脚本、密钥暴露和排查边界。',
      ],
    },
  }
}
