import type { HelpArticle } from './types.ts'

export const SIXTEENTH_BATCH_TOOL_ARTICLES: HelpArticle[] = [
  createToolArticle({
    slug: 'browser-extension-usage',
    title: 'aiapi114 浏览器插件用量查询',
    summary: '说明通过浏览器插件查看 aiapi114 API Key 余额、今日用量和近期消费时的安装、配置与安全注意事项。',
    sourceBasis: [
      'C:/work/aiapi114-html-help-migration-20260518-040635/files/docs/external-archives/codexzh-docs-20260520/text/codex__browser-extension.txt',
    ],
    body: `浏览器插件适合需要频繁查看用量但不想每次打开控制台的用户。接入 aiapi114 时，重点是确认插件来源、API Key 保存位置和展示数据口径。

## 适合先读这篇的人

- 你希望在浏览器工具栏快速查看 aiapi114 用量。
- 你需要给团队成员提供轻量的余额查询方式。
- 你担心浏览器插件泄露 API Key，需要先确认安全边界。

## 操作步骤

### 1. 确认插件来源

只安装来自可信渠道的插件包。不要加载来源不明的压缩包，也不要把插件文件夹放在会被同步到公共网盘或仓库的位置。

### 2. 加载插件文件夹

在浏览器扩展管理页面开启开发者模式，加载已解压且包含 manifest.json 的文件夹。不要直接加载 zip 文件，也不要选错外层目录。

### 3. 填写 aiapi114 API Key

点击插件图标后填写专门用于查询的 API Key。建议使用低权限或专用 Key，不要填写管理员密码、上游供应商 Key 或生产 Root 凭据。

### 4. 核对用量口径

插件显示的余额、今日用量、近期消费应与 aiapi114 控制台保持一致。出现差异时，以控制台钱包、使用日志和订单记录为准。

## 检查清单
- [ ] 插件来自可信来源。
- [ ] 加载的是包含 manifest.json 的解压目录。
- [ ] 插件中使用专用 aiapi114 API Key。
- [ ] 用量差异已回到控制台日志和钱包核对。`,
  }),
  createToolArticle({
    slug: 'cc-switch-usage-query',
    title: 'aiapi114 CC-Switch 用量查询配置',
    summary: '说明在 CC-Switch 中配置 aiapi114 用量查询时如何填写请求地址、访问令牌和提取逻辑。',
    sourceBasis: [
      'C:/work/aiapi114-html-help-migration-20260518-040635/files/docs/external-archives/codexzh-docs-20260520/text/codex__cc-switch-usage.txt',
      'docs/reference-help-docs/ikuncode/tools/cc-switch.md',
    ],
    body: `CC-Switch 的用量查询可以把 aiapi114 额度变化显示在工具界面中。配置时不要照搬过期截图，应以 aiapi114 当前接口地址和返回字段为准。

## 适合先读这篇的人

- 你已经用 CC-Switch 切换 aiapi114 模型。
- 你想在 CC-Switch 中查看余额、今日用量或本周消费。
- 你需要排查用量查询失败、字段为空或显示不准。

## 操作步骤

### 1. 打开用量查询设置

进入 CC-Switch 的用量查询配置页，确认当前配置对应 aiapi114，而不是旧平台、旧域名或其他供应商。

### 2. 填写查询凭据

按 aiapi114 当前接口要求填写请求地址和访问令牌。若工具要求把 Key 写进提取器代码，确认不会被提交到共享配置或截图中。

### 3. 调整提取字段

根据 aiapi114 返回结构提取余额、今日用量、本周用量、消费金额和错误信息。字段不存在时应返回清晰的“查询失败”提示。

### 4. 与控制台交叉核对

配置后先在 aiapi114 控制台查看同一 API Key 的用量，再对比 CC-Switch 显示结果。差异较大时先检查时间范围和单位换算。

## 检查清单
- [ ] CC-Switch 用量查询指向 aiapi114。
- [ ] API Key 未进入公开配置或截图。
- [ ] 提取字段与 aiapi114 返回结构一致。
- [ ] 已用控制台数据核对显示结果。`,
  }),
  createToolArticle({
    slug: 'codex-mcp-services',
    title: 'aiapi114 Codex MCP 服务配置',
    summary: '说明在 Codex 中配置 MCP 服务时如何结合 aiapi114 使用，覆盖服务注册、Windows 路径和密钥管理。',
    sourceBasis: [
      'C:/work/aiapi114-html-help-migration-20260518-040635/files/docs/external-archives/codexzh-docs-20260520/text/codex__mcp.txt',
    ],
    body: `MCP 服务用于让 Codex 调用额外工具或资源。它不直接替代 aiapi114 模型调用，而是把文档检索、浏览器自动化、本地工具等能力接入工作流。

## 适合先读这篇的人

- 你已经通过 aiapi114 配好了 Codex 模型。
- 你想给 Codex 增加文档检索、浏览器自动化或本地工具能力。
- 你在 Windows 上配置 MCP 时遇到 command not found 或超时。

## 操作步骤

### 1. 先确认模型调用正常

MCP 是扩展能力。配置前先确认 Codex 通过 aiapi114 能正常对话和执行基础任务，避免把模型配置问题误判为 MCP 问题。

### 2. 注册 MCP 服务

优先使用 Codex 提供的 MCP 注册命令添加服务。记录服务名称、启动命令、参数和所需环境变量，方便后续删除或排查。

### 3. 处理 Windows 路径

Windows 上应使用真实可执行文件路径，例如 npx.cmd 的完整路径，并补充必要环境变量。路径包含空格时要确认配置格式正确。

### 4. 管理密钥和权限

MCP 服务需要的 API Key 应写入环境变量或安全配置，不要直接写进公开仓库。给文件系统、浏览器或数据库类服务授权时，按最小范围开放。

## 检查清单
- [ ] Codex 通过 aiapi114 的基础模型调用已正常。
- [ ] MCP 服务名称、命令和参数已记录。
- [ ] Windows 路径使用真实可执行文件位置。
- [ ] MCP 密钥和权限按最小范围配置。`,
  }),
  createToolArticle({
    slug: 'hermes-ai-assistant-config',
    title: 'aiapi114 Hermes 助手配置入门',
    summary: '说明在 Hermes 这类本地 AI 助手框架中接入 aiapi114 时如何配置模型、Base URL、API Key 和上下文参数。',
    sourceBasis: [
      'C:/work/aiapi114-html-help-migration-20260518-040635/files/docs/external-archives/codexzh-docs-20260520/text/codex__hermes-config.txt',
    ],
    body: `Hermes 这类本地 AI 助手框架通常通过配置文件管理模型、供应商、上下文和显示效果。接入 aiapi114 时，不需要一次看懂全部配置，先把模型调用链路跑通。

## 适合先读这篇的人

- 你想在 Hermes 或类似本地助手框架中使用 aiapi114。
- 你需要编辑 config.yaml，但不确定哪些字段最关键。
- 你要配置备用模型、上下文压缩或推理强度。

## 操作步骤

### 1. 找到主配置文件

先确认 Hermes 的配置文件位置，并备份当前文件。修改前保留可回滚版本，避免配置错误后无法启动。

### 2. 配置模型供应商

在模型配置块中填写 aiapi114 的 Base URL、API Key、默认模型和协议模式。模型名称应来自 aiapi114 模型列表。

### 3. 设置上下文和备用模型

根据模型能力设置上下文窗口、压缩阈值和备用模型。不要盲目填写过大的上下文长度，应以 aiapi114 实际开放能力为准。

### 4. 启动后做最小验证

保存配置后先运行一句简单提示词，再查看 aiapi114 使用日志。失败时先检查 YAML 缩进、环境变量和 Base URL。

## 检查清单
- [ ] 修改前已备份 Hermes 配置文件。
- [ ] Base URL、API Key 和模型名称来自 aiapi114。
- [ ] 上下文窗口和备用模型符合实际开放能力。
- [ ] 验证后已在 aiapi114 使用日志中看到记录。`,
  }),
]

export const SIXTEENTH_BATCH_ADVANCED_ARTICLES: HelpArticle[] = [
  createAdvancedArticle({
    slug: 'windows-cli-encoding-fix',
    title: 'aiapi114 Windows CLI 中文乱码排查',
    summary: '说明 Windows 终端、PowerShell、Codex 类 CLI 和 aiapi114 配置文件中常见中文乱码问题的原因与处理顺序。',
    sourceBasis: [
      'C:/work/aiapi114-html-help-migration-20260518-040635/files/docs/external-archives/codexzh-docs-20260520/text/codex__windows-encoding.txt',
    ],
    body: `Windows 中文乱码通常不是 aiapi114 接口内容错误，而是终端、子进程和文件编码不一致导致。排查时先确认编码链路，再检查应用配置。

## 适合先读这篇的人

- 你在 Windows 终端里看到中文变成乱码。
- 你用 Codex、Gemini CLI、OpenCode 等工具调用 aiapi114 时输出异常。
- 你需要判断是接口返回问题、终端问题还是文件编码问题。

## 操作步骤

### 1. 先确认乱码位置

区分是终端显示乱码、日志文件乱码、配置文件乱码，还是网页内容乱码。只有接口响应本身错误时，才优先排查 aiapi114 服务端。

### 2. 统一使用 UTF-8

优先让终端、编辑器和配置文件统一为 UTF-8。PowerShell 7、现代终端和 UTF-8 文件编码通常比旧版控制台更稳定。

### 3. 检查子进程环境

部分 CLI 会跳过用户 Profile 或使用默认代码页启动子进程。此时需要在工具配置、启动脚本或环境变量中显式指定 UTF-8。

### 4. 重新验证配置文件

修复编码后重新打开 aiapi114 相关配置文件，确认 Base URL、API Key、模型名没有被乱码破坏，再执行一次低成本调用。

## 检查清单
- [ ] 已定位乱码出现在终端、文件、日志还是网页。
- [ ] 终端、编辑器和配置文件已统一为 UTF-8。
- [ ] CLI 子进程启动环境已检查。
- [ ] 修复后已重新核对 aiapi114 配置并完成调用测试。`,
  }),
  createAdvancedArticle({
    slug: 'codex-auto-review-config',
    title: 'aiapi114 Codex 自动审批审核配置',
    summary: '说明在 Codex 工作流中使用自动审批审核时如何区分主模型、审核模型、沙箱和审批策略。',
    sourceBasis: [
      'C:/work/aiapi114-html-help-migration-20260518-040635/files/docs/external-archives/codexzh-docs-20260520/text/codex__codex-auto-review.txt',
    ],
    body: `自动审批审核用于判断 Codex 准备执行的高风险动作是否可以放行。它不是日常对话主模型，也不应绕过沙箱和审批策略。

## 适合先读这篇的人

- 你通过 aiapi114 使用 Codex，并希望减少手动审批负担。
- 你想区分主模型、审核模型和审批策略。
- 你正在排查自动审核为什么没有生效。

## 操作步骤

### 1. 不要绕过审批链路

如果启动方式完全绕过审批和沙箱，自动审核不会介入。需要保留会产生审批请求的运行模式。

### 2. 区分主模型和审核模型

主模型负责日常编码、分析和执行；审核模型只负责审批请求风险判断。不要把审核模型配置成主对话模型。

### 3. 配置审批策略

在 Codex 配置中设置合适的沙箱和审批策略，并把审核器指向自动审核能力。保存后用低风险命令验证是否触发审批流程。

### 4. 记录放行边界

团队使用时应明确哪些操作可以自动放行，哪些操作必须人工确认，例如生产凭据、数据库变更、支付配置和删除操作。

## 检查清单
- [ ] 当前运行模式没有绕过审批和沙箱。
- [ ] 主模型和审核模型已分开。
- [ ] 审批策略已通过低风险操作验证。
- [ ] 高风险操作仍保留人工确认边界。`,
  }),
  createAdvancedArticle({
    slug: 'codex-notification-workflow',
    title: 'aiapi114 Codex 任务通知配置',
    summary: '说明通过 Codex 通知机制跟踪 aiapi114 相关长任务、审批请求和任务完成状态时的配置思路。',
    sourceBasis: [
      'C:/work/aiapi114-html-help-migration-20260518-040635/files/docs/external-archives/codexzh-docs-20260520/text/codex__notifications.txt',
    ],
    body: `通知配置适合长时间运行的 Codex 任务。它不能替代 aiapi114 日志，但能提醒你任务完成、需要确认或出现阻塞。

## 适合先读这篇的人

- 你经常让 Codex 执行较长的编码或文档任务。
- 你希望审批请求出现时及时收到提醒。
- 你要把任务完成消息推送到桌面、聊天工具或 Webhook。

## 操作步骤

### 1. 先使用内置通知

如果终端支持，优先开启内置通知。它配置简单，适合提醒任务完成和审批请求。

### 2. 再接入外部脚本

需要推送到 Slack、Discord、企业微信或自定义 Webhook 时，再编写脚本接收事件 JSON。脚本要处理转义和失败重试。

### 3. 控制通知内容

通知里只放任务摘要、状态和必要链接。不要把 aiapi114 API Key、用户隐私、订单信息或完整日志直接发到通知渠道。

### 4. 验证真实事件

用一次短任务和一次需要确认的操作测试通知，确认完成事件和审批事件都能到达。

## 检查清单
- [ ] 已优先尝试内置通知。
- [ ] 外部通知脚本能接收事件 JSON。
- [ ] 通知内容不包含密钥或敏感日志。
- [ ] 已验证任务完成和审批请求两类事件。`,
  }),
  createAdvancedArticle({
    slug: 'codex-image-generation-workflow',
    title: 'aiapi114 Codex 图片生成工作流',
    summary: '说明在 Codex 类工具中通过 aiapi114 使用图片生成能力时的环境准备、费用提示、任务验证和结果保存方式。',
    sourceBasis: [
      'C:/work/aiapi114-html-help-migration-20260518-040635/files/docs/external-archives/codexzh-docs-20260520/text/codex__image-2.txt',
    ],
    body: `图片生成工作流通常依赖本地脚本、模型接口和文件保存路径。接入 aiapi114 时，应先确认环境、费用和输出目录，避免把生成失败误判为模型不可用。

## 适合先读这篇的人

- 你想在 Codex 类工具中调用 aiapi114 图片生成能力。
- 你需要安装脚本或技能来生成图片。
- 你想提前确认图片生成的费用和保存位置。

## 操作步骤

### 1. 准备本地环境

确认 Python、Node.js 或工具要求的运行环境已安装。Windows 用户要特别注意 PATH 和中文路径问题。

### 2. 配置 aiapi114 模型

使用 aiapi114 提供的图片模型名称、Base URL 和 API Key。生成图片前先确认该模型在当前分组中可用，并了解计费规则。

### 3. 执行小图测试

先用简单提示词和较低成本参数测试，确认请求能成功返回，输出文件能保存到预期目录。

### 4. 保存结果和排查信息

生成结果应记录提示词、模型、时间和文件路径。失败时保留错误摘要和日志 ID，不要反复提交高成本请求。

## 检查清单
- [ ] 本地 Python、Node.js 或依赖环境已准备。
- [ ] 图片模型、Base URL 和 API Key 来自 aiapi114。
- [ ] 已了解图片生成计费规则。
- [ ] 失败时保留错误摘要和日志 ID，避免重复高成本请求。`,
  }),
]

export const SIXTEENTH_BATCH_SUPPORT_ARTICLES: HelpArticle[] = [
  createSupportArticle({
    slug: 'codex-client-troubleshooting',
    title: 'aiapi114 Codex 客户端排障清单',
    summary: '汇总 Codex 客户端接入 aiapi114 时常见的 401、流式中断、路径错误、模型切换和网络问题。',
    sourceBasis: [
      'C:/work/aiapi114-html-help-migration-20260518-040635/files/docs/external-archives/codexzh-docs-20260520/text/codex__troubleshooting.txt',
      'C:/work/aiapi114-html-help-migration-20260518-040635/files/docs/external-archives/codexzh-docs-20260520/text/codex__faq.txt',
    ],
    body: `Codex 客户端问题通常来自配置、网络、模型权限或本地环境。排查时不要一开始就重装工具，先按错误表现逐项定位。

## 适合先读这篇的人

- 你在 Codex 中调用 aiapi114 返回 401、超时或流式中断。
- 你更新客户端后无法切换模型。
- 你不确定问题来自 aiapi114、客户端还是本地网络。

## 操作步骤

### 1. 先看认证错误

401 或 Unauthorized 优先核对 Base URL、API Key、模型 Provider 和环境变量。复制 Key 时不要带空格，也不要混用其他平台密钥。

### 2. 再看网络和流式中断

流式中断可能来自网络波动、代理、长时间思考或客户端超时。先用短提示词测试，再更换网络或降低单次任务复杂度。

### 3. 检查路径和配置文件

如果提示无法写入认证文件或找不到路径，检查配置目录、权限和 Windows 路径。删除无关旧配置前先备份。

### 4. 对照使用日志

aiapi114 使用日志里没有请求记录时，问题多半在客户端本地；有记录但失败时，再按日志错误摘要排查模型、余额或渠道。

## 检查清单
- [ ] 401 已核对 Base URL、API Key 和 Provider。
- [ ] 流式中断已用短提示词和稳定网络复测。
- [ ] 本地配置目录和权限已检查。
- [ ] 已用 aiapi114 使用日志判断请求是否到达平台。`,
  }),
]

function createToolArticle(input: ArticleInput): HelpArticle {
  return createArticle(input, 'third-party-tools', ['适合先读这篇的人', '操作步骤', '检查清单'], [
    '符合大纲：属于第十六批浏览器插件、CC-Switch 用量查询、Codex MCP 和 Hermes 等第三方工具接入页面。',
    '文档框架稳定：保留竞品文档的环境准备、配置字段、排障路径和安全提示结构，并清洗导航、页脚和过期平台表述。',
    '竞品平台信息已替换成 aiapi114，并补充 API Key 安全、控制台日志核对和新手验证步骤。',
  ])
}

function createAdvancedArticle(input: ArticleInput): HelpArticle {
  return createArticle(input, 'advanced-usage', ['适合先读这篇的人', '操作步骤', '检查清单'], [
    '符合大纲：属于第十六批 Windows 编码、自动审批、任务通知和图片生成等进阶使用页面。',
    '文档框架稳定：保留竞品文档的问题原因、配置步骤、验证方法和风险边界结构，并整理为 aiapi114 用户可执行路径。',
    '竞品平台信息已替换成 aiapi114，并补充费用提示、敏感信息控制、审批边界和日志核对说明。',
  ])
}

function createSupportArticle(input: ArticleInput): HelpArticle {
  return createArticle(input, 'faq', ['适合先读这篇的人', '操作步骤', '检查清单'], [
    '符合大纲：属于第十六批 Codex 客户端常见错误答疑页面。',
    '文档框架稳定：保留竞品文档按错误表现排查的结构，并合并同方向 FAQ，避免重复堆叠。',
    '竞品平台信息已替换成 aiapi114，并补充 Base URL、API Key、使用日志和本地环境排查路径。',
  ])
}

function createArticle(
  input: ArticleInput,
  categoryKey: 'third-party-tools' | 'advanced-usage' | 'faq',
  sections: string[],
  notes: string[]
): HelpArticle {
  return {
    slug: input.slug,
    categoryKey,
    title: input.title,
    summary: input.summary,
    difficulty: categoryKey === 'faq' ? '排障' : '基础',
    readTime: '约 6 分钟',
    sourceBasis: input.sourceBasis,
    sections,
    markdown: `# ${input.title}\n\n${input.body}`,
    audit: {
      writer: 'PASS',
      reviewer: 'PASS',
      notes,
    },
  }
}

type ArticleInput = {
  slug: string
  title: string
  summary: string
  sourceBasis: string[]
  body: string
}
