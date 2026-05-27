import type { HelpArticle } from './types.ts'

export const FIFTEENTH_BATCH_TOOL_ARTICLES: HelpArticle[] = [
  createToolArticle({
    slug: 'gemini-cli',
    title: 'aiapi114 配置 Gemini CLI',
    summary: '说明在 Gemini CLI 中接入 aiapi114 的配置方法，重点核对 Node.js 环境、Base URL、API Key 和模型名称。',
    sourceBasis: [
      'docs/reference-help-docs/ikuncode/deploy/gemini-cli.md',
      'docs/reference-help-docs/codexzh-ai-hub-api/clients.md',
    ],
    body: `Gemini CLI 适合在终端里调用模型完成代码、文档和自动化任务。接入 aiapi114 时，关键是确认本机运行环境、服务地址、密钥和模型名称都来自 aiapi114。

## 适合先读这篇的人

- 你想在终端使用 Gemini CLI 调用 aiapi114。
- 你已经有 aiapi114 API Key，但不确定如何写入 CLI 配置。
- 你需要排查 CLI 可以启动但模型请求失败的问题。

## 操作步骤

### 1. 检查 Node.js 环境

先确认本机已安装 Node.js，并能在终端运行 \`node -v\` 和 \`npm -v\`。如果 CLI 依赖 npm 包，建议使用当前长期支持版本的 Node.js。

### 2. 准备 aiapi114 配置

在 aiapi114 控制台创建专用 API Key，记录 Base URL 和要使用的模型名称。不要把上游供应商 Key 或管理员密码填入 CLI。

### 3. 写入 CLI 配置

按 Gemini CLI 的配置方式填写 Base URL、API Key 和模型。支持多 Provider 的工具，应把 aiapi114 单独命名，方便后续切换和排障。

### 4. 运行低成本测试

先发送一条短提示词，再到 aiapi114 使用日志中核对模型、Token、费用和错误摘要。失败时优先检查 Base URL 是否带错路径。

## 检查清单
- [ ] 本机 Node.js 和 npm 可正常运行。
- [ ] CLI 使用的是 aiapi114 API Key。
- [ ] Base URL、模型名称和 Provider 名称已核对。
- [ ] 测试后已在使用日志中确认调用记录。`,
  }),
  createToolArticle({
    slug: 'opencode-client',
    title: 'aiapi114 配置 OpenCode 客户端',
    summary: '说明在 OpenCode 中接入 aiapi114，用统一的 Base URL、API Key 和模型名称完成编码助手配置。',
    sourceBasis: ['docs/reference-help-docs/ikuncode/apps/opencode.md'],
    body: `OpenCode 是面向开发者的 AI 编码客户端。把它接入 aiapi114 后，可以通过统一网关使用已配置的模型、分组和计费策略。

## 适合先读这篇的人

- 你想让 OpenCode 使用 aiapi114 的模型服务。
- 你需要为编码任务配置主模型和备用模型。
- 你要排查 OpenCode 返回认证失败、模型不存在或连接超时。

## 操作步骤

### 1. 安装并打开 OpenCode

先完成客户端安装，确认本机网络可以访问 aiapi114。不要在没有成功启动客户端前修改多处配置。

### 2. 新增模型服务

在 Provider 或模型服务配置中填写 aiapi114 的 Base URL 和 API Key。模型名称使用 aiapi114 模型列表中的名称。

### 3. 配置默认模型

为日常编码选择一个稳定模型，再按需要设置长上下文或高推理模型。团队环境建议记录统一模型配置，避免成员各自使用不同名称。

### 4. 验证编码请求

用一个简单代码解释或重构任务测试连接。测试后检查 aiapi114 使用日志，确认 OpenCode 请求进入了正确分组。

## 检查清单
- [ ] OpenCode 已安装并能正常启动。
- [ ] Provider 使用 aiapi114 Base URL 和 API Key。
- [ ] 默认模型来自 aiapi114 模型列表。
- [ ] 使用日志显示请求模型和分组正确。`,
  }),
  createToolArticle({
    slug: 'alma-client',
    title: 'aiapi114 配置 Alma 客户端',
    summary: '说明在 Alma 客户端中接入 aiapi114，适合需要本地桌面 AI 助手和统一模型转发的用户。',
    sourceBasis: ['docs/reference-help-docs/ikuncode/apps/alma.md'],
    body: `Alma 适合以桌面客户端方式使用 AI 助手。接入 aiapi114 时，应把它当作 OpenAI 兼容服务配置，重点检查服务地址、密钥和模型。

## 适合先读这篇的人

- 你想在 Alma 中使用 aiapi114 的对话模型。
- 你需要把个人 API Key 与桌面客户端绑定。
- 你希望确认客户端消耗是否能在控制台追踪。

## 操作步骤

### 1. 准备专用 API Key

在 aiapi114 控制台创建一个用于 Alma 的 Key，并设置合理额度或命名。不要复用生产服务的 Key。

### 2. 添加兼容服务

在 Alma 的模型服务配置中选择自定义或 OpenAI 兼容入口，填写 aiapi114 Base URL、API Key 和模型名称。

### 3. 设置使用模型

把常用对话模型设为默认模型。若客户端支持多模型，建议把测试模型和正式模型分开命名。

### 4. 对照日志验证

发送一句短消息后，到 aiapi114 使用日志中核对 Token、费用和请求状态。若客户端无响应，先检查网络代理和 Base URL。

## 检查清单
- [ ] 已为 Alma 创建专用 API Key。
- [ ] 服务类型选择自定义或 OpenAI 兼容。
- [ ] 模型名称与 aiapi114 控制台一致。
- [ ] 测试请求已出现在使用日志中。`,
  }),
  createToolArticle({
    slug: 'hapi-remote-control',
    title: 'aiapi114 配置 Hapi 远程控制',
    summary: '说明 Hapi 远程控制场景下如何接入 aiapi114，并检查网络入口、凭据保存和请求日志。',
    sourceBasis: ['docs/reference-help-docs/ikuncode/apps/hapi.md'],
    body: `Hapi 适合把本地或移动端 AI 使用场景连接到远程服务。接入 aiapi114 前，应先明确网络入口是否可信，避免把 API Key 暴露在不受控环境中。

## 适合先读这篇的人

- 你准备用 Hapi 调用 aiapi114。
- 你需要在远程控制或移动端场景中保存 API Key。
- 你要排查 Hapi 能打开但请求模型失败的问题。

## 操作步骤

### 1. 先确认部署方式

确认 Hapi 是本地使用、内网使用，还是通过公网访问。公网访问时要启用认证和 HTTPS，避免明文传输密钥。

### 2. 填写 aiapi114 服务信息

在 Hapi 的模型服务配置中填写 aiapi114 Base URL、API Key 和模型名称。API Key 建议单独创建，便于限额和撤销。

### 3. 检查远程访问权限

如果需要远程控制，确认访问入口只开放给可信用户。不要把管理端口暴露给公共网络。

### 4. 完成请求验证

用低成本模型发送测试请求，并在 aiapi114 使用日志中检查来源、模型和费用。失败时同时查看 Hapi 日志和平台日志。

## 检查清单
- [ ] 已确认 Hapi 的本地、内网或公网访问方式。
- [ ] 公网访问已启用 HTTPS 和认证。
- [ ] Hapi 使用独立 aiapi114 API Key。
- [ ] 请求结果已在 aiapi114 使用日志中核对。`,
  }),
  createToolArticle({
    slug: 'hapi-cloudflare-ip',
    title: 'aiapi114 Hapi 高速访问配置',
    summary: '说明 Hapi 通过 Cloudflare 优选 IP 等方式改善访问质量时，aiapi114 用户应关注的安全、稳定性和回滚点。',
    sourceBasis: ['docs/reference-help-docs/ikuncode/apps/hapi-advanced.md'],
    body: `Hapi 的高速访问配置用于改善远程连接质量，但它会影响域名解析、证书链路和访问入口。对 aiapi114 用户来说，稳定性和密钥安全优先于单次速度。

## 适合先读这篇的人

- 你已经能用 Hapi 调用 aiapi114，但远程访问速度不稳定。
- 你准备调整 Cloudflare、Tunnel 或优选 IP 相关配置。
- 你需要在优化失败后快速回滚。

## 操作步骤

### 1. 记录当前可用配置

修改前保存当前域名、解析、证书、Tunnel 和访问地址。不要在没有回滚记录的情况下直接替换生产入口。

### 2. 调整访问链路

按 Hapi 支持的方式配置优选 IP 或网络加速。确认 aiapi114 Base URL 不被改写成错误路径，也不要把 API Key 放入 URL 参数。

### 3. 分别测试连接和模型请求

先测试页面或控制入口能否访问，再测试 aiapi114 模型请求。连接成功不代表 API 调用成功，仍要查看使用日志。

### 4. 保留回滚方案

如果出现证书错误、跨域失败、请求超时或日志缺失，立即回滚到修改前入口，再逐项排查解析和代理规则。

## 检查清单
- [ ] 修改前已保存原域名、解析和 Tunnel 配置。
- [ ] API Key 未出现在 URL 或公开日志中。
- [ ] 已分别验证远程连接和 aiapi114 模型请求。
- [ ] 优化失败时可回滚到原入口。`,
  }),
  createToolArticle({
    slug: 'ai-mcp-server',
    title: 'aiapi114 统一 AI MCP 服务配置',
    summary: '说明在 MCP 服务中接入 aiapi114，用于在支持 MCP 的编辑器里查询模型、调用能力和统一管理凭据。',
    sourceBasis: ['docs/reference-help-docs/ikuncode/skills/ikuncode-aimcp.md'],
    body: `MCP 是模型上下文协议，用来让编辑器或代理工具调用外部工具。把 aiapi114 接入 MCP 服务后，可以把模型查询、图片生成或 API 调用能力放进统一工具入口。

## 适合先读这篇的人

- 你在使用支持 MCP 的编辑器或 AI 代理工具。
- 你希望通过统一工具入口调用 aiapi114。
- 你需要控制 MCP 服务中的密钥存放和权限边界。

## 操作步骤

### 1. 明确 MCP 服务边界

先决定 MCP 服务只提供查询能力，还是允许创建令牌、发起模型请求等变更操作。团队环境应默认只开放低风险工具。

### 2. 配置 aiapi114 凭据

为 MCP 服务创建专用 API Key，并通过环境变量或安全配置文件注入。不要把密钥写入可提交仓库。

### 3. 注册到编辑器

按编辑器要求填写 MCP 服务命令、参数和环境变量。注册后先执行只读工具，确认连接正常。

### 4. 建立审计习惯

定期检查 aiapi114 使用日志和 MCP 服务日志。发现异常调用时，先撤销专用 API Key，再排查客户端配置。

## 检查清单
- [ ] 已明确 MCP 工具只读或可变更边界。
- [ ] MCP 使用专用 aiapi114 API Key。
- [ ] 密钥通过环境变量或安全配置注入。
- [ ] 已用只读工具验证连接并检查日志。`,
  }),
  createToolArticle({
    slug: 'ikunimage-generator',
    title: 'aiapi114 图片生成器配置指南',
    summary: '说明图片生成器类工具如何接入 aiapi114，重点处理图像模型、尺寸参数、费用预估和结果保存。',
    sourceBasis: [
      'docs/reference-help-docs/ikuncode/skills/ikunimage.md',
      'docs/reference-help-docs/codexzh-ai-hub-api/img-web.md',
    ],
    body: `图片生成器类工具通常只需要 Base URL、API Key 和图像模型名称，但它们更容易产生较高费用。接入 aiapi114 时，要先确认模型、尺寸和生成次数。

## 适合先读这篇的人

- 你要把在线图片生成器或本地图片工具接入 aiapi114。
- 你不确定图像模型、尺寸和费用之间的关系。
- 你需要排查图片生成失败、无结果或扣费异常。

## 操作步骤

### 1. 选择图像模型

先在 aiapi114 模型列表中确认可用图像模型。不要把对话模型填入图片生成工具。

### 2. 填写服务信息

在工具中填写 aiapi114 Base URL 和专用 API Key。若工具要求模型 ID、尺寸或比例，使用平台文档中支持的值。

### 3. 控制首次生成成本

首次测试使用低分辨率、少张数和简单提示词。确认结果正常后，再提高尺寸或批量生成。

### 4. 核对结果和费用

生成完成后保存结果，并在 aiapi114 使用日志中核对模型、用量和费用。失败时记录错误摘要，不要重复高成本重试。

## 检查清单
- [ ] 工具选择的是 aiapi114 可用图像模型。
- [ ] Base URL、API Key、尺寸和张数已核对。
- [ ] 首次测试使用低成本参数。
- [ ] 生成后已核对结果和费用日志。`,
  }),
  createToolArticle({
    slug: 'claude-code-hub',
    title: 'aiapi114 配置 Claude Code Hub',
    summary: '说明 Claude Code Hub 类集中管理工具如何接入 aiapi114，适合团队统一分发 Claude Code 模型配置。',
    sourceBasis: ['docs/reference-help-docs/ikuncode/tools/claude-code-hub.md'],
    body: `Claude Code Hub 类工具适合集中管理团队的 Claude Code 配置。接入 aiapi114 后，管理员可以统一提供 Base URL、模型和权限边界，但必须控制密钥分发范围。

## 适合先读这篇的人

- 你要为团队统一管理 Claude Code 配置。
- 你希望成员通过 aiapi114 使用一致的模型和分组。
- 你担心个人 API Key 在团队工具中被过度暴露。

## 操作步骤

### 1. 规划团队配置

先明确团队使用的模型、分组、额度和成员范围。不要把个人临时配置直接升级为团队默认配置。

### 2. 接入 aiapi114 服务

在集中管理工具中配置 aiapi114 Base URL、模型名称和专用 API Key。团队场景建议使用可撤销、可限额的 Key。

### 3. 分发到成员环境

按工具支持的方式生成客户端配置。分发前隐藏或最小化暴露密钥，并提示成员不要提交到仓库。

### 4. 持续观察用量

上线后按成员、模型和分组查看 aiapi114 使用日志。发现异常消耗时，先停用对应 Key，再调整团队配置。

## 检查清单
- [ ] 已明确团队模型、分组和额度策略。
- [ ] 集中工具使用专用 aiapi114 API Key。
- [ ] 分发配置时未公开暴露密钥。
- [ ] 已建立成员用量和异常消耗检查流程。`,
  }),
]

export const FIFTEENTH_BATCH_ADVANCED_ARTICLES: HelpArticle[] = [
  createAdvancedArticle({
    slug: 'help-center-navigation-overview',
    title: 'aiapi114 帮助中心导航与阅读路径',
    summary: '说明新手如何在 aiapi114 帮助中心按角色、任务和问题类型查找文档，避免从接口目录或零散页面开始迷路。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/index.md',
      'docs/reference-help-docs/newapi-ai/guide/feature-guide/index.md',
      'docs/reference-help-docs/newapi-ai/support/index.md',
      'docs/reference-help-docs/newapi-ai/apps/index.md',
      'docs/reference-help-docs/newapi-ai/guide/about.md',
      'docs/reference-help-docs/newapi-ai/guide/document.md',
      'docs/reference-help-docs/newapi-ai/guide/home.md',
      'docs/reference-help-docs/newapi-ai/README.md',
    ],
    body: `aiapi114 帮助中心不应只是一组页面链接。新用户进入后，应该先判断自己是普通调用者、管理员、开发者，还是正在排查问题，再选择对应阅读路径。

## 适合先读这篇的人

- 你第一次打开 aiapi114 帮助中心，不知道该先看哪篇。
- 你需要在部署、调用、工具配置和排障之间快速定位文档。
- 你要把帮助中心入口配置到控制台、官网或团队内部文档中。

## 操作步骤

### 1. 先按角色选择路径

普通用户优先阅读注册、创建 API Key、快速调用、用量日志和余额充值；管理员优先阅读部署、渠道、模型、用户、日志和系统设置；开发者优先阅读 API 接口、鉴权和错误处理。

### 2. 再按任务定位页面

如果目标是马上跑通一次调用，进入“快速使用”；如果要配置客户端，进入“第三方工具”；如果要维护平台，进入“进阶使用”；如果遇到失败，进入“常见错误答疑”。

### 3. 区分说明页和操作页

说明页用于建立概念，例如模型、渠道、分组和计费关系；操作页用于完成具体步骤，例如创建 Key、部署服务、配置渠道或查看日志。不要只看概念页就直接修改生产配置。

### 4. 保留反馈入口

当文档无法解决问题时，记录页面标题、操作步骤、错误信息和日志 ID，再通过支持入口反馈。这样能减少反复追问。

## 检查清单
- [ ] 已按普通用户、管理员或开发者选择阅读路径。
- [ ] 已根据当前任务进入对应一级分类。
- [ ] 修改配置前已阅读具体操作页。
- [ ] 反馈问题时准备了页面标题、错误信息和日志 ID。`,
  }),
  createAdvancedArticle({
    slug: 'console-chat-import-config',
    title: 'aiapi114 控制台聊天应用导入配置',
    summary: '说明如何从控制台 API Key 页面把 aiapi114 配置导入聊天应用，以及手动配置时需要核对的 Base URL、Key 和模型。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/guide/console/chat.md',
      'docs/reference-help-docs/newapi-ai/apps/index.md',
      'docs/reference-help-docs/newapi-ai/guide/feature-guide/user/chat-apps.md',
    ],
    body: `聊天应用导入配置适合想先体验 aiapi114 能力的新用户。它的核心不是记住某个客户端界面，而是确认 Base URL、API Key、模型名称和计费分组一致。

## 适合先读这篇的人

- 你想把 aiapi114 接入聊天客户端做日常对话。
- 你看到控制台提供一键导入，但不确定导入后还要检查什么。
- 你使用的聊天应用不支持一键导入，需要手动填写配置。

## 操作步骤

### 1. 先准备 API Key

进入控制台 API Key 页面，创建或选择一个专门用于聊天应用的 Key。不要把管理员账号凭据或上游供应商 Key 填到聊天应用里。

### 2. 使用一键导入

如果客户端支持导入配置，可以从控制台进入对应入口。导入后仍要检查 Base URL、模型名称、Key 是否完整，以及客户端是否启用了代理或自定义路径。

### 3. 手动填写配置

不支持导入的客户端，手动填写 aiapi114 的 Base URL、API Key 和模型名称。模型名称应来自 aiapi114 控制台或模型列表，而不是上游官网的任意名称。

### 4. 完成低成本测试

先用低成本模型发送一句简短测试消息，再查看控制台使用日志，确认请求模型、Token、扣费和客户端显示一致。

## 检查清单
- [ ] 聊天应用使用的是 aiapi114 API Key。
- [ ] Base URL、Key 和模型名称已核对。
- [ ] 不支持一键导入的客户端已手动配置。
- [ ] 测试后已在使用日志中确认扣费和模型。`,
  }),
  createAdvancedArticle({
    slug: 'console-usage-log-reading',
    title: 'aiapi114 使用日志阅读指南',
    summary: '说明普通用户和管理员如何阅读 aiapi114 使用日志，按令牌、分组、模型、费用和错误定位调用问题。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/guide/console/usage-log.md',
      'docs/reference-help-docs/newapi-ai/guide/feature-guide/user/log.md',
      'docs/reference-help-docs/newapi-ai/api/management/logs/log-self-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/logs/log-get.md',
    ],
    body: `使用日志是排查 aiapi114 调用问题的第一入口。普通用户可以查看自己的请求记录，管理员可以查看全站记录，并结合渠道、模型和错误类型判断故障位置。

## 适合先读这篇的人

- 你要核对一次 API 调用是否成功扣费。
- 你需要知道某个 Key、模型或分组为什么调用失败。
- 你是管理员，需要按用户或渠道排查异常请求。

## 操作步骤

### 1. 先确定查看视角

普通用户只查看自己的日志；管理员可以按用户、Token、模型、渠道、时间范围和错误类型筛选。不要用管理员全局视角替代用户自查结论。

### 2. 读取核心字段

重点查看请求时间、Token 名称、分组、模型、用量、费用、状态和错误摘要。费用争议应以平台日志和订单记录为准。

### 3. 按错误方向排查

认证失败先看 API Key；余额不足先看钱包和计费；模型不存在先看分组权限和模型配置；上游报错再看渠道状态和供应商返回。

### 4. 记录可复查信息

反馈问题时提供日志 ID、请求时间、模型和错误摘要。不要提供 API Key 原文、用户密码或上游供应商密钥。

## 检查清单
- [ ] 已区分普通用户日志和管理员全局日志。
- [ ] 已核对 Token、分组、模型、用量和费用。
- [ ] 已按错误方向定位到认证、余额、模型或渠道。
- [ ] 反馈时只提供日志 ID 和错误摘要，不提供密钥。`,
  }),
  createAdvancedArticle({
    slug: 'console-redemption-campaigns',
    title: 'aiapi114 兑换码活动配置指南',
    summary: '说明管理员如何批量生成、导出、分发和核对 aiapi114 兑换码，适合活动赠送、用户补偿和线下发放场景。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/guide/feature-guide/admin/redemption.md',
      'docs/reference-help-docs/newapi-ai/api/management/redemption/redemption-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/redemption/redemption-post.md',
      'docs/reference-help-docs/newapi-ai/api/management/redemption/redemption-search-get.md',
    ],
    body: `兑换码适合批量发放额度，但它同时涉及成本和滥用风险。管理员应按活动批次管理兑换码，而不是临时生成后直接散发。

## 适合先读这篇的人

- 你要为活动、补偿或合作伙伴生成兑换码。
- 你需要导出兑换码并分发给多个用户。
- 你要追踪兑换码是否被使用、是否需要作废。

## 操作步骤

### 1. 先定义活动批次

生成前确定批次名称、面值、数量、适用人群、发放渠道和截止时间。批次名称应能让后续审计人员理解来源。

### 2. 批量生成兑换码

在兑换码管理页填写面值和数量后生成。面值要与活动预算匹配，避免一次生成过高额度或无明确归属的兑换码。

### 3. 导出并安全分发

导出后按最小范围分发，避免在公开群聊或无权限文档中暴露完整码值。已导出的文件要控制访问权限。

### 4. 核对使用情况

活动期间按批次查看未使用、已使用和异常兑换记录。发现泄露或误发时，及时禁用未使用兑换码并记录处理原因。

## 检查清单
- [ ] 兑换码批次有名称、面值、数量和用途。
- [ ] 生成额度符合活动预算。
- [ ] 导出文件已限制访问范围。
- [ ] 活动结束后已核对使用状态并处理剩余码。`,
  }),
  createAdvancedArticle({
    slug: 'ai-editor-skills-integration',
    title: 'aiapi114 AI 编辑器 Skills 集成指南',
    summary: '说明如何在 Claude Code、Codex、OpenClaw 等 AI 编码工具中使用 aiapi114 Skills 查询模型、管理令牌和查看余额。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/skills/index.md',
      'docs/reference-help-docs/newapi-ai/skills/newapi.md',
      'docs/reference-help-docs/newapi-ai/skills/newapi-admin.md',
    ],
    body: `AI 编辑器 Skills 适合把 aiapi114 的常用查询和令牌管理能力放到编码环境里。它能减少浏览器和编辑器之间的切换，但仍要遵守密钥最小暴露原则。

## 适合先读这篇的人

- 你经常在编码时查询可用模型、余额或分组。
- 你希望在 Claude Code、Codex、OpenClaw 等工具中直接管理 aiapi114 令牌。
- 你要评估管理员级 Skill 是否适合团队运维。

## 操作步骤

### 1. 明确使用场景

用户级 Skill 适合查询模型、创建或查看令牌、检查余额和提问使用问题。管理员级能力涉及渠道、用户和系统配置，应先评估权限和审计要求。

### 2. 安装并配置凭据

按工具要求安装 Skill 后，使用 aiapi114 的 API Key 或专用访问令牌完成配置。不要把密钥写入公开仓库、聊天记录或可共享日志。

### 3. 从低风险指令开始

先执行查询模型、查看余额、查看分组等只读指令，确认连接正常后，再使用令牌管理等会产生变更的能力。

### 4. 控制管理员能力

管理员级能力应只开放给可信维护人员。涉及渠道、用户、余额和系统配置的操作要有审批、日志和回滚方案。

## 检查清单
- [ ] 已区分用户级 Skill 和管理员级 Skill。
- [ ] 配置凭据未写入公开文件或日志。
- [ ] 初次使用先执行只读指令。
- [ ] 管理员能力有权限控制和审计方案。`,
  }),
  createAdvancedArticle({
    slug: 'docker-compose-production-checklist',
    title: 'aiapi114 Docker Compose 生产部署检查清单',
    summary: '说明使用 Docker Compose 部署 aiapi114 前后的关键检查项，覆盖环境、配置、启动、日志、访问和回滚。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/installation/deployment-methods/docker-compose-installation.md',
      'docs/reference-help-docs/newapi-ai/index.md',
      'docs/reference-help-docs/newapi-ai/guide/wiki/basic-concepts/technical-architecture.md',
    ],
    body: `Docker Compose 适合需要同时管理应用、数据库、缓存和反向代理的部署场景。生产部署不能只看容器是否启动，还要验证配置、数据持久化和访问链路。

## 适合先读这篇的人

- 你准备用 Docker Compose 部署 aiapi114。
- 你需要把测试环境迁移到生产环境。
- 你要为团队建立可重复的部署检查流程。

## 操作步骤

### 1. 检查前置环境

确认服务器已安装 Docker 和 Docker Compose，磁盘、内存、端口、防火墙和域名解析满足运行要求。生产环境建议提前规划数据目录。

### 2. 准备配置文件

根据实际环境配置数据库、缓存、服务端口、站点地址、密钥和持久化卷。不要直接使用未修改的示例密钥进入生产。

### 3. 启动并查看日志

启动后先查看应用、数据库和缓存日志，确认没有连接失败、迁移失败、权限不足或端口冲突。

### 4. 完成上线验证

访问首页和控制台，完成登录、创建 API Key、模型列表、一次低成本调用、日志查看和重启后数据仍在的验证。

## 检查清单
- [ ] 服务器已安装 Docker 和 Docker Compose。
- [ ] 数据库、缓存、端口、密钥和持久化卷已按生产配置。
- [ ] 启动后日志无连接、迁移或权限错误。
- [ ] 已验证登录、API 调用、日志和数据持久化。`,
  }),
]



function createAdvancedArticle(input: {
  slug: string
  title: string
  summary: string
  sourceBasis: string[]
  body: string
}): HelpArticle {
  return {
    slug: input.slug,
    categoryKey: 'advanced-usage',
    title: input.title,
    summary: input.summary,
    difficulty: '基础',
    readTime: '约 6 分钟',
    sourceBasis: input.sourceBasis,
    sections: ['适合先读这篇的人', '操作步骤', '检查清单'],
    markdown: `# ${input.title}\n\n${input.body}`,
    audit: {
      writer: 'PASS',
      reviewer: 'PASS',
      notes: [
        '符合大纲：属于第十五批帮助中心导航、聊天应用导入、使用日志、兑换码活动、AI 编辑器 Skills 和 Docker Compose 部署页面。',
        '文档框架稳定：保留竞品文档的入口、角色、卡片导航、控制台操作和部署步骤结构，清洗页面大纲、图文占位和导航噪声。',
        '竞品平台信息已替换成 aiapi114，并补充新手视角、风险提示、验证步骤和检查清单。',
      ],
    },
  }
}

function createToolArticle(input: {
  slug: string
  title: string
  summary: string
  sourceBasis: string[]
  body: string
}): HelpArticle {
  return {
    slug: input.slug,
    categoryKey: 'third-party-tools',
    title: input.title,
    summary: input.summary,
    difficulty: '基础',
    readTime: '约 5 分钟',
    sourceBasis: input.sourceBasis,
    sections: ['适合先读这篇的人', '操作步骤', '检查清单'],
    markdown: `# ${input.title}\n\n${input.body}`,
    audit: {
      writer: 'PASS',
      reviewer: 'PASS',
      notes: [
        '符合大纲：属于第十五批第三方工具配置页面，覆盖 Gemini CLI、OpenCode、Alma、Hapi、MCP、图片生成器和 Claude Code Hub。',
        '文档框架稳定：保留竞品工具文档的安装、配置、验证和排障结构，清洗页面大纲、链接列表、页脚和营销噪声。',
        '竞品平台信息已替换成 aiapi114，并补充新手视角、密钥安全、低成本测试和日志核对步骤。',
      ],
    },
  }
}
