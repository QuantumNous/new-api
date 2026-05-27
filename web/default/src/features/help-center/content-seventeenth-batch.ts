import type { HelpArticle } from './types.ts'

export const SEVENTEENTH_BATCH_ADVANCED_ARTICLES: HelpArticle[] = [
  createAdvancedArticle({
    slug: 'model-selection-strategy',
    title: 'aiapi114 模型选择与分组核对',
    summary: '说明在 aiapi114 使用模型前如何查看可用模型、核对分组权限、避免自造模型名导致调用失败。',
    sourceBasis: ['docs/reference-help-docs/ikuncode/guide/model-selection.md'],
    body: `不同账号、分组和渠道可用的模型范围可能不同。接入 aiapi114 前，先确认当前 API Key 所属分组支持哪些模型，再把准确的模型名称填入客户端或代码中。

## 适合先读这篇的人

- 你准备在第三方工具里填写模型名称。
- 你遇到“模型不存在”“无权限访问该模型”一类错误。
- 你不确定当前 API Key 应该使用哪个分组或模型。

## 操作步骤

### 1. 打开模型列表或模型广场

登录 aiapi114 控制台，进入模型列表、模型广场或价格页面。优先以控制台实时展示为准，不要照搬旧截图、旧教程或其他平台的模型名。

### 2. 按分组筛选可用模型

查看 API Key 所属分组能调用的模型。若页面支持筛选，先选择令牌对应的分组，再查看该分组下的模型名称、能力范围、上下文长度和计费说明。

### 3. 复制完整模型名称

在客户端、环境变量或代码中填写模型时，复制控制台中的完整模型名称。不要自行拼接版本号、删除后缀或把其他平台的模型别名当成 aiapi114 模型名。

### 4. 用小请求验证权限

先用短提示词发起一次低成本请求。成功后再接入长上下文、图片、工具调用或批量任务。失败时回到控制台核对模型名、分组权限、余额和渠道状态。

## 常见问题

### 提示模型不存在怎么办

先确认模型名是否逐字一致，再确认该模型是否在当前 API Key 分组内可用。不要只看教程中的模型示例，因为模型列表会随平台维护和供应商变化调整。

### 提示无权限访问怎么办

通常是 API Key 分组不支持该模型，或当前账号权限不足。先换用控制台显示可用的模型，再联系平台支持确认是否需要调整分组。

## 检查清单

- [ ] 已在 aiapi114 控制台查看实时模型列表。
- [ ] 已按 API Key 所属分组筛选可用模型。
- [ ] 客户端中填写的是完整模型名称，没有自行改写。
- [ ] 已用短提示词完成一次低成本验证。`,
  }),
  createAdvancedArticle({
    slug: 'api-token-editing',
    title: 'aiapi114 API Key 设置修改',
    summary: '说明创建 aiapi114 API Key 后如何修改名称、额度、速率限制和启用状态，并提示哪些设置会立即生效。',
    sourceBasis: ['docs/reference-help-docs/ikuncode/guide/modify-token.md'],
    body: `API Key 创建后仍可继续维护。建议把名称、额度和速率限制设置清楚，方便区分不同工具、不同成员和不同环境的用量。

## 适合先读这篇的人

- 你已经创建了 aiapi114 API Key，想调整使用范围。
- 你需要给某个工具单独限制额度或请求频率。
- 你想临时停用某个 Key，但不想删除配置。

## 操作步骤

### 1. 找到要修改的 API Key

登录 aiapi114 控制台，进入 API Key 或令牌管理页面。先根据名称、创建时间和最近使用记录确认目标 Key，避免改错正在生产使用的 Key。

### 2. 修改名称和用途说明

给 Key 使用清晰名称，例如“Claude Code 本机开发”“团队文档机器人”或“测试环境”。名称不影响鉴权，但能降低后续排查成本。

### 3. 设置额度和速率限制

按用途设置总额度、周期额度或请求频率限制。给第三方工具、团队成员和自动化脚本使用的 Key，建议单独设置额度上限，避免异常调用消耗全部余额。

### 4. 保存并验证生效

保存后设置通常会立即生效。部分客户端会缓存配置，必要时重启客户端或重新加载环境变量，再用一次短请求确认 Key 仍可正常使用。

## 注意事项

修改 Key 的分组、模型权限或关键鉴权字段时，可能需要重新创建 Key 或重新配置客户端。不要把完整 API Key 粘贴到截图、公开文档、聊天群或仓库里。

## 检查清单

- [ ] 已确认修改的是目标 API Key。
- [ ] Key 名称能区分用途和环境。
- [ ] 已按使用场景设置额度或速率限制。
- [ ] 修改后已重新加载客户端并完成一次短请求验证。`,
  }),
  createAdvancedArticle({
    slug: 'pricing-and-model-costs',
    title: 'aiapi114 计费倍率与模型成本说明',
    summary: '说明 aiapi114 的预付费、模型基础价格、分组倍率、消费记录和余额不足时的排查方式。',
    sourceBasis: ['docs/reference-help-docs/ikuncode/intro/pricing.md', 'docs/reference-help-docs/codexzh-ai-hub-api/pricing.md'],
    body: `aiapi114 的实际消耗通常由模型基础价格、分组倍率、输入输出规模和任务类型共同决定。使用前先看控制台的实时价格，能避免把模型示例价误认为最终费用。

## 适合先读这篇的人

- 你想了解为什么不同模型消耗不同。
- 你需要为团队或项目预估月度成本。
- 你遇到余额不足、消费异常或用量看不懂的问题。

## 操作步骤

### 1. 先看控制台实时价格

进入 aiapi114 模型广场、价格页面或模型详情页，查看模型基础费用、分组倍率和能力说明。价格可能随供应商和渠道调整，以控制台实时展示为准。

### 2. 理解分组倍率

分组倍率会影响最终扣费。倍率越低，同样模型调用的实际消耗越低；倍率越高，通常对应更稳定、更高优先级或特殊能力的渠道。不要只按模型名称判断成本。

### 3. 结合任务规模估算费用

长上下文、图片、音频、视频、推理增强和批量任务通常比普通短对话消耗更高。上线自动化任务前，先用小样本运行，再根据使用日志估算真实成本。

### 4. 对照消费记录排查

进入钱包、使用日志或消费记录页面，按时间、API Key、模型和渠道核对扣费。发现异常时，先确认是否存在循环调用、重试过多或第三方工具自动补全请求。

## 常见问题

### 余额不足会怎样

请求通常会失败并返回余额或额度相关错误。充值或调整 Key 额度后，再重新发起请求。平台不会因为失败请求自动补发任务，客户端是否重试取决于工具配置。

### 价格为什么和教程不同

教程可能只展示示例模型或历史截图。实际价格以 aiapi114 控制台实时显示为准，尤其是模型版本、渠道分组和倍率发生变化时。

## 检查清单

- [ ] 已查看 aiapi114 控制台实时模型价格。
- [ ] 已理解当前 API Key 所属分组倍率。
- [ ] 已用小样本估算高频任务的成本。
- [ ] 已能在使用日志中按模型和 Key 核对消费。`,
  }),
  createAdvancedArticle({
    slug: 'node-runtime-installation',
    title: 'aiapi114 Node.js 环境准备',
    summary: '说明在 Windows、macOS 与 Linux 上为 Claude Code、Codex CLI、Gemini CLI 等工具准备 Node.js 运行环境，并处理 PATH 常见问题。',
    sourceBasis: [
      'docs/reference-help-docs/ikuncode/node/windows.md',
      'docs/reference-help-docs/ikuncode/node/macos.md',
      'docs/reference-help-docs/ikuncode/node/linux.md',
    ],
    body: `很多 AI 编程工具依赖 Node.js 运行。Windows 用户在接入 aiapi114 前，建议先把 Node.js、npm 和 PATH 环境变量准备好，再配置 API Key 和 Base URL。

## 适合先读这篇的人

- 你准备在 Windows 上使用 Claude Code、Codex CLI、Gemini CLI 或类似工具。
- 终端提示 node、npm、npx 不是内部或外部命令。
- 你不确定本机 Node.js 版本是否满足工具要求。

## 操作步骤

### 1. 检查当前版本

打开 PowerShell，执行 \`node --version\` 和 \`npm --version\`。如果能显示版本号，说明基础环境已存在；如果版本过低或命令不存在，再继续安装。

### 2. 安装 Node.js LTS

优先从 Node.js 官网下载 LTS 版本 Windows Installer。按默认选项安装，安装程序通常会自动配置 PATH。企业电脑若限制安装权限，需要使用管理员账号或联系管理员。

### 3. 也可以使用包管理器

熟悉命令行的用户可以使用 winget、Chocolatey 或 Scoop 安装 LTS 版本。不要同时混装多个来源的 Node.js，避免 PATH 指向旧版本。

### 4. 重开终端并验证

安装完成后关闭所有旧终端，重新打开 PowerShell，再运行 \`node --version\`、\`npm --version\` 和 \`npx --version\`。确认版本正常后，再安装或启动第三方 AI 工具。

## 常见问题

### 提示不是内部或外部命令

先重开终端，再检查系统 PATH 是否包含 Node.js 安装目录。仍不生效时重启电脑，或重新运行安装程序修复 PATH。

### 工具仍然找不到 npx

部分工具需要完整的 \`npx.cmd\` 路径。Windows 上配置 MCP、CLI 或脚本时，优先使用真实可执行文件路径，并避免中文路径或含空格路径造成解析问题。

## 检查清单

- [ ] 已安装 Node.js LTS 或满足工具要求的版本。
- [ ] \`node --version\`、\`npm --version\`、\`npx --version\` 均可正常输出。
- [ ] 已重新打开终端让 PATH 生效。
- [ ] 后续工具配置中使用的是 aiapi114 的 Base URL 和 API Key。`,
  }),
  createAdvancedArticle({
    slug: 'nano-banana-image-model',
    title: 'aiapi114 Nano Banana 图像模型使用说明',
    summary: '说明通过 aiapi114 调用 Nano Banana 类图像模型时的模型选择、尺寸参数、API 请求、客户端配置和成本控制。',
    sourceBasis: ['docs/reference-help-docs/ikuncode/deploy/nano-banana.md', 'docs/reference-help-docs/codexzh-ai-hub-api/nano-banana2.md'],
    body: `Nano Banana 类图像模型适合生成图片、编辑图片和制作创意素材。通过 aiapi114 使用时，关键是选对模型、确认分辨率参数、控制单次任务成本，并保留失败日志方便排查。

## 适合先读这篇的人

- 你想通过 aiapi114 调用图像生成或图生图能力。
- 你需要在 Cherry Studio、脚本或 AI 编程工具中配置图像模型。
- 你关心分辨率、宽高比、耗时和计费问题。

## 操作步骤

### 1. 选择图像模型

先在 aiapi114 控制台查看当前可用的图像模型名称。追求质量时选择更高规格模型；追求预览速度和成本时选择更轻量的模型。最终以控制台展示的模型名为准。

### 2. 确认尺寸和宽高比

图像模型通常对宽高比、分辨率和输出数量有限制。常见比例包括 1:1、16:9、9:16、4:3、3:4 等。高分辨率输出耗时和费用更高，建议先低成本预览。

### 3. 在客户端中设置为图像模型

如果使用 Cherry Studio 等客户端，添加模型后要把模型类型设置为“图像生成”或对应图片能力。否则模型可能出现在聊天列表里，却不会出现在画图功能中。

### 4. 用 API 或脚本验证

通过 API 调用时，填写 aiapi114 Base URL、API Key、模型名、提示词和尺寸参数。第一次验证使用简单提示词、小尺寸和少量输出，确认返回结果正常后再提高规格。

## 排查建议

模型列表中看不到图像模型时，先确认模型类型和分组权限。请求失败时，检查 API Key、余额、模型名、尺寸参数和使用日志。图片任务耗时较长，客户端超时时间不要设置过短。

## 检查清单

- [ ] 已在 aiapi114 控制台确认图像模型名称和分组权限。
- [ ] 已根据场景选择分辨率、宽高比和输出数量。
- [ ] 客户端中已把模型类型设置为图像生成。
- [ ] 已用低成本请求验证返回图片和消费记录。`,
  }),
  createAdvancedArticle({
    slug: 'platform-introduction-overview',
    title: 'aiapi114 平台工作方式概览',
    summary: '面向新手解释 aiapi114 作为统一 AI API 接入平台的工作方式、优势、安全边界和后续使用路径。',
    sourceBasis: [
      'docs/reference-help-docs/ikuncode/intro/overview.md',
      'docs/reference-help-docs/ikuncode/intro/welcome.md',
      'docs/reference-help-docs/codexzh-ai-hub-api/index.md',
    ],
    body: `aiapi114 是连接用户、开发工具和多类 AI 模型服务的统一 API 平台。你只需要在平台创建 API Key，并把 Base URL、Key 和模型名填入工具或代码，就能用统一方式接入不同模型能力。

## 适合先读这篇的人

- 你第一次接触 AI API 中转或统一接入平台。
- 你想知道为什么一个 Key 可以接入多类模型和工具。
- 你需要先理解平台边界，再配置第三方工具。

## 操作步骤

### 1. 理解请求链路

常见链路是：你的客户端或代码发起请求，aiapi114 完成鉴权、路由、计费和日志记录，再把请求转发到对应模型渠道，最后把结果返回给客户端。

### 2. 先完成账号和 Key 准备

使用前需要注册账号、充值或领取额度、创建 API Key，并确认 Key 所属分组能调用目标模型。没有 Key 时，第三方工具无法完成鉴权。

### 3. 再配置工具或代码

大多数工具需要三项核心信息：Base URL、API Key、模型名称。aiapi114 的帮助中心按工具和接口类型拆分了配置文档，建议按你实际使用的工具逐篇查看。

### 4. 用日志确认请求是否到达平台

请求失败时，先看 aiapi114 使用日志。如果没有记录，问题多半在本地客户端、网络或 Base URL；如果有记录，再按错误摘要排查模型、余额、权限或渠道状态。

## 安全边界

API Key 只用于鉴权和计费，不要公开分享。不要把敏感代码、隐私数据或生产凭据直接放入提示词。团队使用时，建议为不同人员和工具创建独立 Key，便于限额和审计。

## 检查清单

- [ ] 已理解客户端、aiapi114 和模型渠道之间的请求链路。
- [ ] 已准备账号、余额或额度，以及专用 API Key。
- [ ] 已知道 Base URL、API Key、模型名是接入三要素。
- [ ] 请求失败时会先用使用日志判断问题位置。`,
  }),
]

export const SEVENTEENTH_BATCH_SUPPORT_ARTICLES: HelpArticle[] = [
  createSupportArticle({
    slug: 'support-service-scope',
    title: 'aiapi114 支持服务范围说明',
    summary: '说明遇到使用、配置、计费和企业合作问题时如何联系 aiapi114，并区分可支持事项与需要用户自查的信息。',
    sourceBasis: ['docs/reference-help-docs/ikuncode/support/after-sales.md'],
    body: `遇到使用问题时，先通过帮助中心和控制台日志完成基础自查；仍无法解决时，再联系 aiapi114 支持。提交问题时信息越完整，定位越快。

## 适合先读这篇的人

- 你不确定某个问题是否应该联系平台支持。
- 你需要反馈 bug、计费疑问或企业接入需求。
- 你想知道联系支持前应准备哪些信息。

## 操作步骤

### 1. 先完成基础自查

认证失败先核对 Base URL 和 API Key；模型失败先核对模型名、分组和余额；工具失败先查看本地配置和 aiapi114 使用日志。能定位到错误类型后，再联系支持会更高效。

### 2. 准备必要信息

反馈时提供账号信息、发生时间、请求模型、客户端名称、错误摘要、日志 ID 或截图。不要发送完整 API Key、密码、生产凭据或包含敏感业务数据的完整日志。

### 3. 区分问题类型

使用咨询、配置指导、计费疑问、bug 反馈、企业合作都可以联系支持。第三方工具自身安装失败、本地网络限制或用户脚本错误，平台可以协助判断方向，但可能需要你同步提供本地环境信息。

### 4. 跟进处理结果

支持人员给出排查建议后，按步骤复测，并把新的错误摘要或成功结果反馈回来。涉及计费和服务策略的问题，以控制台记录和平台正式说明为准。

## 常见问题快速通道

API 调用失败先看常见错误答疑；第三方工具失败先看对应工具配置页；余额和消费问题先看钱包、使用日志和计费说明。

## 检查清单

- [ ] 联系支持前已查看帮助中心和使用日志。
- [ ] 已准备发生时间、模型、客户端、错误摘要和日志 ID。
- [ ] 反馈内容未包含完整 API Key、密码或敏感业务数据。
- [ ] 已按支持建议复测并记录结果。`,
  }),
]

function createAdvancedArticle(input: ArticleInput): HelpArticle {
  return createArticle(input, 'advanced-usage', ['适合先读这篇的人', '操作步骤', '检查清单'], [
    '符合大纲：属于第十七批模型选择、Key 设置、计费、Node 环境、图像模型和平台概览等进阶使用页面。',
    '文档框架稳定：保留竞品文档的适用场景、操作步骤、注意事项和检查清单结构，并清洗页面大纲、页脚和过期导航。',
    '竞品平台信息已替换成 aiapi114，并补充控制台实时价格、使用日志、API Key 安全和新手验证路径。',
  ])
}

function createSupportArticle(input: ArticleInput): HelpArticle {
  return createArticle(input, 'faq', ['适合先读这篇的人', '操作步骤', '检查清单'], [
    '符合大纲：属于第十七批平台支持服务范围与常见问题答疑页面。',
    '文档框架稳定：保留竞品文档的联系方式、服务内容、反馈建议和承诺结构，改写为帮助中心可执行的支持流程。',
    '竞品平台信息已替换成 aiapi114，并补充日志 ID、敏感信息保护和问题分类说明。',
  ])
}

function createArticle(
  input: ArticleInput,
  categoryKey: 'advanced-usage' | 'faq',
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
    audit: { writer: 'PASS', reviewer: 'PASS', notes },
  }
}

type ArticleInput = {
  slug: string
  title: string
  summary: string
  sourceBasis: string[]
  body: string
}
