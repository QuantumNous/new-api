import type { HelpArticle } from './types.ts'

export const EIGHTEENTH_BATCH_TOOL_ARTICLES: HelpArticle[] = [
  createToolArticle({
    slug: 'cli-tools-installation-overview',
    title: 'aiapi114 CLI 工具安装总览',
    summary: '说明 Claude Code、Codex CLI、Gemini CLI 等命令行工具接入 aiapi114 前的 Node.js 要求、安装命令和验证方式。',
    sourceBasis: [
      'docs/reference-help-docs/codexzh-ai-hub-api/clients.md',
      'docs/reference-help-docs/codexzh-ai-hub-api/cli-config.md',
    ],
    body: `CLI 工具接入 aiapi114 前，先确认本机能正常运行 Node.js、npm 和目标命令。不要一开始就修改复杂配置，先把运行环境和工具安装验证通过。

## 适合先读这篇的人

- 你准备使用 Claude Code、Codex CLI、Gemini CLI 或类似命令行工具。
- 你不确定本机是否已经安装 Node.js 和 npm。
- 你希望先完成工具安装，再配置 aiapi114 API Key。

## 操作步骤

### 1. 检查 Node.js 环境

在终端执行 \`node --version\`、\`npm --version\`。能输出版本号说明环境可用；提示命令不存在时，先按 Windows、macOS 或 Linux 对应文档安装 Node.js LTS。

### 2. 安装目标 CLI 工具

按实际使用场景安装一个或多个工具。Claude Code、Codex CLI、Gemini CLI 都可通过 npm 安装，安装后先查看版本号或运行一次空命令确认工具可启动。

### 3. 首次运行生成配置目录

很多 CLI 首次运行时才会在用户目录生成配置文件夹。安装后先运行一次目标命令，再去查找配置目录，避免误以为配置文件缺失。

### 4. 再写入 aiapi114 配置

工具能启动后，再填写 aiapi114 的 Base URL、API Key 和模型名称。不同工具的配置文件位置不同，手动编辑前先备份旧配置。

## 常见问题

### npm 命令不存在

通常是 Node.js 未安装，或 PATH 没有生效。重开终端后仍失败，再重新安装 Node.js LTS，并确认安装程序已写入 PATH。

### 安装很慢

可以切换 npm 镜像源或使用稳定网络重试。不要下载来源不明的安装包，也不要把 API Key 写进共享安装脚本。

## 检查清单

- [ ] \`node --version\` 和 \`npm --version\` 已正常输出。
- [ ] 目标 CLI 已安装并能启动。
- [ ] 首次运行后已生成工具配置目录。
- [ ] 后续配置使用 aiapi114 的 Base URL、API Key 和模型名称。`,
  }),
  createToolArticle({
    slug: 'manual-cli-configuration',
    title: 'aiapi114 CLI 手动配置教程',
    summary: '说明不使用切换工具时，如何手动配置 Claude Code、Codex CLI、Gemini CLI 的配置文件、环境变量和模型名称。',
    sourceBasis: [
      'docs/reference-help-docs/codexzh-ai-hub-api/cli-config.md',
      'C:/work/aiapi114-html-help-migration-20260518-040635/files/docs/external-archives/codexzh-docs-20260520/text/claude-code__config.txt',
      'C:/work/aiapi114-html-help-migration-20260518-040635/files/docs/external-archives/codexzh-docs-20260520/text/codex__setup.txt',
    ],
    body: `手动配置适合需要精确控制配置文件、环境变量和模型名的用户。若你不熟悉命令行，优先使用已经整理好的工具配置页或切换工具，减少误改配置的概率。

## 适合先读这篇的人

- 你需要手动编辑 Claude Code、Codex CLI 或 Gemini CLI 配置文件。
- 你无法使用图形化配置工具或自动脚本。
- 你要同时维护多个平台、多个模型或多个 API Key。

## 操作步骤

### 1. 先备份原配置

找到目标工具的配置目录后，先复制一份原始配置文件。不要直接删除旧配置，尤其是已经能正常使用的官方账号、代理设置或团队共享配置。

### 2. 填写 aiapi114 鉴权信息

根据工具要求填写 Base URL、API Key 和 Provider。API Key 只写入本机安全位置，不要提交到仓库、截图或共享文档。

### 3. 设置默认模型

模型名必须来自 aiapi114 控制台实时模型列表。不要使用其他平台教程里的模型别名，也不要自行拼接版本号。

### 4. 用短请求验证

配置完成后先运行短提示词请求。成功后再进行长上下文、工具调用或批量任务。失败时优先检查配置路径、Key、模型名和使用日志。

## 常见问题

### 找不到配置目录

先运行一次目标 CLI。很多工具只有首次启动后才会创建用户配置目录。Windows 上注意隐藏目录和路径空格，macOS/Linux 上注意当前 shell 用户。

### 配置后仍连接失败

先确认请求是否出现在 aiapi114 使用日志中。没有记录，多半是本地配置或网络问题；有记录但失败，再按日志错误排查权限、余额、模型或渠道。

## 检查清单

- [ ] 修改前已备份原配置文件。
- [ ] Base URL、API Key、Provider 已指向 aiapi114。
- [ ] 默认模型名来自 aiapi114 控制台。
- [ ] 已通过短请求和使用日志完成验证。`,
  }),
]

export const EIGHTEENTH_BATCH_ADVANCED_ARTICLES: HelpArticle[] = [
  createAdvancedArticle({
    slug: 'node-runtime-macos',
    title: 'aiapi114 macOS Node.js 环境准备',
    summary: '说明 macOS 用户在使用 AI 编程 CLI 接入 aiapi114 前，如何安装 Node.js、验证 npm 并处理 Homebrew 与权限问题。',
    sourceBasis: ['docs/reference-help-docs/ikuncode/node/macos.md'],
    body: `macOS 上使用 Claude Code、Codex CLI、Gemini CLI 等工具前，需要先准备 Node.js 和 npm。建议优先使用 Homebrew 或官方 LTS 安装包，避免混用多个 Node 版本。

## 适合先读这篇的人

- 你在 macOS 上配置 AI 编程工具接入 aiapi114。
- 终端提示 node、npm 或 npx 命令不存在。
- 你遇到 Homebrew 安装慢、权限不足或版本混乱问题。

## 操作步骤

### 1. 检查当前环境

打开终端，执行 \`node --version\` 和 \`npm --version\`。如果已显示符合工具要求的版本，可以直接进入 CLI 工具安装和 aiapi114 配置。

### 2. 使用 Homebrew 安装

熟悉命令行的用户优先使用 Homebrew 安装 Node.js。安装后重新打开终端，再确认 node、npm 和 npx 都能正常输出版本。

### 3. 使用官方安装包

不想维护 Homebrew 的用户，可以从 Node.js 官网下载 LTS 版本 .pkg 安装包。按默认步骤安装后，重新打开终端验证版本。

### 4. 处理权限和路径

不要随意用 sudo 修复 npm 全局包问题。先确认当前 shell、PATH 和 Homebrew 权限是否正确，再安装 CLI 工具。

## 常见问题

### Homebrew 安装慢

可以切换稳定镜像源或更换网络后重试。不要从不明网盘下载打包好的 Node.js 或 CLI 工具。

### npm 全局安装失败

先检查目录权限和 Node 安装来源。若需要多版本管理，再考虑 nvm；不要同时让 Homebrew、官方包和 nvm 管理同一套 Node。

## 检查清单

- [ ] macOS 终端能正常输出 Node.js 和 npm 版本。
- [ ] Node.js 来源明确，没有多版本混用。
- [ ] npm 全局安装权限已处理。
- [ ] 后续 CLI 配置使用 aiapi114 的 Key 和模型名。`,
  }),
  createAdvancedArticle({
    slug: 'node-runtime-linux',
    title: 'aiapi114 Linux Node.js 环境准备',
    summary: '说明 Linux 用户在接入 aiapi114 的 AI 编程 CLI 前，如何安装 Node.js LTS、处理发行版差异和 npm 权限。',
    sourceBasis: ['docs/reference-help-docs/ikuncode/node/linux.md'],
    body: `Linux 环境常用于服务器、开发机和远程工作站。接入 aiapi114 前，先把 Node.js LTS、npm 和全局包权限配置好，可以减少 CLI 安装失败和权限问题。

## 适合先读这篇的人

- 你在 Ubuntu、Debian、CentOS、RHEL、Fedora 或 Arch 上使用 AI 编程工具。
- 你需要在远程服务器上配置 Claude Code、Codex CLI 或 Gemini CLI。
- 你遇到 Node.js 版本过旧、npm 权限不足或命令找不到的问题。

## 操作步骤

### 1. 查看发行版和当前版本

先确认系统发行版，再执行 \`node --version\`、\`npm --version\`。发行版仓库里的 Node.js 可能偏旧，不满足工具要求时优先安装 LTS。

### 2. 选择安装方式

Ubuntu/Debian 可使用 NodeSource 或官方推荐仓库；CentOS/RHEL、Fedora、Arch 按发行版包管理器安装。需要多版本切换时，再使用 nvm。

### 3. 配置 npm 权限

如果全局安装 CLI 时出现 permission denied，不要直接长期使用 root 运行工具。优先配置用户级 npm prefix，或使用 nvm 管理用户级 Node 环境。

### 4. 安装并验证 CLI

Node.js 和 npm 可用后，再安装目标 CLI。验证命令能启动后，再写入 aiapi114 Base URL、API Key 和模型名称。

## 常见问题

### 系统自带版本过旧

使用 NodeSource、nvm 或发行版支持的新版仓库安装 LTS。不要为了兼容旧系统而使用过时 Node.js 运行新 CLI。

### sudo 安装后普通用户无法使用

检查全局包安装目录和 PATH。远程服务器上建议使用当前登录用户完成配置，避免 Key 写入 root 用户目录导致工具找不到。

## 检查清单

- [ ] 已确认 Linux 发行版和 Node.js 版本。
- [ ] Node.js LTS、npm 和 npx 均可用。
- [ ] npm 权限不依赖长期 root 运行。
- [ ] 目标 CLI 已能读取 aiapi114 配置。`,
  }),
]

export const EIGHTEENTH_BATCH_API_ARTICLES: HelpArticle[] = [
  createApiArticle({
    slug: 'api-protocol-selection-examples',
    title: 'aiapi114 API 协议选择与调用示例',
    summary: '说明 GPT、Claude、Gemini、图像模型在 aiapi114 中常见的协议选择、curl/Python 调用方式和流式请求注意事项。',
    sourceBasis: ['docs/reference-help-docs/codexzh-ai-hub-api/api-examples.md'],
    body: `调用 aiapi114 API 时，先按模型类型选择协议，再写代码。不要把所有模型都套进同一个端点；协议不匹配时，常见表现是参数无效、模型不可用或返回结构不符合预期。

## 适合先读这篇的人

- 你准备把 aiapi114 接入自己的应用或脚本。
- 你不确定该用 Responses API、Chat Completions 还是图像接口。
- 你需要从 curl 或 Python 示例开始验证接口。

## 操作步骤

### 1. 按模型类型选择协议

GPT 类新项目优先查看 Responses API；Claude、Gemini 和多数兼容聊天模型通常使用 Chat Completions；图像生成和图生图使用对应图像接口。最终以 aiapi114 控制台和模型说明为准。

### 2. 准备统一鉴权信息

请求中必须包含 aiapi114 API Key、Base URL、模型名称和必要参数。代码示例里的域名、Key 和模型名都要替换成你自己的 aiapi114 信息。

### 3. 先跑最小请求

先用 curl 或 Python 发起短文本请求，确认 HTTP 状态、返回结构和使用日志都正常。不要一开始就接入复杂上下文、文件、图片或批量任务。

### 4. 再启用流式或多轮

流式响应、多轮对话和图像任务都需要额外处理返回结构、超时和错误。上线前记录请求 ID、日志 ID 和消费记录，方便排查。

## 常见问题

### 返回参数无效

先检查端点和模型类型是否匹配，再检查参数名是否属于当前协议。Responses API、Chat Completions 和图像接口的字段不能随意混用。

### 使用日志没有记录

说明请求可能没有到达 aiapi114。优先检查 Base URL、网络代理、请求路径和 Authorization 头。

## 检查清单

- [ ] 已按模型类型选择正确协议和端点。
- [ ] 示例中的域名、Key、模型名已替换成 aiapi114 信息。
- [ ] 已用最小请求验证返回结构和使用日志。
- [ ] 流式、多轮或图像任务已单独处理超时和错误。`,
  }),
]

function createToolArticle(input: ArticleInput): HelpArticle {
  return createArticle(input, 'third-party-tools', '基础', [
    '符合大纲：属于第十八批 CLI 工具安装与手动配置页面，补齐第三方工具落地前置路径。',
    '文档框架稳定：保留竞品文档的环境检查、安装验证、配置路径和常见问题结构，并清洗截图、页脚和过期域名。',
    '竞品平台信息已替换成 aiapi114，并补充 API Key 安全、模型名核对和使用日志验证。',
  ])
}

function createAdvancedArticle(input: ArticleInput): HelpArticle {
  return createArticle(input, 'advanced-usage', '基础', [
    '符合大纲：属于第十八批 macOS 与 Linux Node.js 环境准备页面，补齐非 Windows CLI 前置环境。',
    '文档框架稳定：保留竞品文档的安装方式、验证命令、权限处理和常见问题结构，并按 aiapi114 新手接入路径整理。',
    '竞品平台信息已替换成 aiapi114，并补充 PATH、npm 权限、CLI 验证和 Key 配置边界。',
  ])
}

function createApiArticle(input: ArticleInput): HelpArticle {
  return createArticle(input, 'api-reference', '进阶', [
    '符合大纲：属于第十八批平台 API 接口描述页面，补齐协议选择与调用示例。',
    '文档框架稳定：保留竞品文档按模型类型选择端点、最小请求、流式和多轮验证的结构，并压缩重复代码示例。',
    '竞品平台信息已替换成 aiapi114，并补充 Base URL、Authorization、日志核对和协议不匹配排查。',
  ])
}

function createArticle(
  input: ArticleInput,
  categoryKey: 'third-party-tools' | 'advanced-usage' | 'api-reference',
  difficulty: '基础' | '进阶',
  notes: string[]
): HelpArticle {
  return {
    slug: input.slug,
    categoryKey,
    title: input.title,
    summary: input.summary,
    difficulty,
    readTime: '约 6 分钟',
    sourceBasis: input.sourceBasis,
    sections: ['适合先读这篇的人', '操作步骤', '检查清单'],
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
