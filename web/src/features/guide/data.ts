/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
/*
 * Beginner guide content data.
 *
 * The guide body is authored in Chinese (the primary audience of the
 * operator-provided onboarding handbook). Address strings use placeholders
 * that are substituted at render time with the deployment's real address,
 * so changing the domain never requires touching this file:
 *   {{BASE_URL}}  -> https://<host>/v1
 *   {{FULL_URL}}  -> https://<host>/v1/chat/completions
 *   {{HOST}}      -> https://<host>
 */

export type ToolCategory =
  | 'chat'
  | 'translate'
  | 'coding'
  | 'manager'
  | 'platform'

/**
 * Compatibility status, following the handbook's color legend:
 * - green:  works with the OpenAI-compatible address directly
 * - yellow: needs a config file, or only some features work
 * - blue:   needs a dedicated protocol (Anthropic / Gemini / Responses)
 * - gray:   cannot customize the Base URL right now
 */
export type ToolStatus = 'green' | 'yellow' | 'blue' | 'gray'

export interface GuideTool {
  id: string
  name: string
  category: ToolCategory
  status: ToolStatus
  /** One-line description in plain language. */
  summary: string
  /** Step-by-step instructions (Chinese, with address placeholders). */
  steps: string[]
  /** Optional extra warnings / tips. */
  tips?: string[]
  /** Optional code/config snippet with placeholders. */
  snippet?: { label: string; code: string }
  recommended?: boolean
}

export const guideTools: GuideTool[] = [
  // ── 聊天与办公 ────────────────────────────────────────────────────────
  {
    id: 'workbuddy',
    name: 'WorkBuddy / CodeBuddy',
    category: 'chat',
    status: 'green',
    recommended: true,
    summary: '国产办公智能体,可操作本地文件',
    steps: [
      '打开 WorkBuddy,点击左下角账户头像',
      '进入「设置」→「模型」,点击「添加模型」',
      '提供商选择「自定义 / Custom」',
      '接口地址填完整地址 {{FULL_URL}}',
      'API Key 填 sk-... 密钥',
      '模型名称填模型广场里的完整模型 ID',
      '第一次测试先只开「工具调用」,「图片输入」「推理模式」仅在模型明确支持时开启',
      '保存后回到对话框选择刚添加的模型',
    ],
    tips: [
      '有「完整 URL」开关的版本:填完整地址时打开开关;只填 {{BASE_URL}} 时关闭开关让软件自动补路径。两者不要同时用,否则容易 404',
    ],
  },
  {
    id: 'cherry-studio',
    name: 'Cherry Studio',
    category: 'chat',
    status: 'green',
    summary: '桌面聊天客户端,支持 OpenAI 兼容接口',
    steps: [
      '打开 Cherry Studio,点击左下角「设置」',
      '进入「模型服务」,点击「添加」,类型选择「OpenAI」或「OpenAI Compatible」',
      '名称随意填,例如本站名称',
      'API Key 填你创建的 sk-... 密钥',
      'API 地址填 {{BASE_URL}}',
      '点击「管理」或「添加模型」,粘贴完整模型 ID',
      '点击「检查」,成功后打开右上角启用开关',
      '回到聊天页选择刚添加的模型,发一句「你好」测试',
    ],
    tips: [
      '如果检查时报 404,把 API 地址改成 {{HOST}} 再试(不同版本对 /v1 的自动补全方式不同)',
    ],
  },
  {
    id: 'chatbox',
    name: 'Chatbox',
    category: 'chat',
    status: 'green',
    summary: '轻量聊天客户端,手机电脑都能用',
    steps: [
      '打开 Chatbox,点击侧边栏「设置」',
      '进入「模型提供方」,点击「添加」,类型选「OpenAI API compatible」',
      '如果界面显示「API Host」,填 {{HOST}}',
      '如果界面显示「Base URL」,填 {{BASE_URL}}',
      'API Key 填 sk-... 密钥',
      'API Path 保持 /v1/chat/completions,没有这个输入框就不用管',
      '添加模型 ID,保存并点击「检查」',
    ],
  },
  {
    id: 'lobechat',
    name: 'LobeChat',
    category: 'chat',
    status: 'green',
    summary: '漂亮的开源聊天界面,可自建团队版',
    steps: [
      '进入「设置」→「语言模型」',
      '选择 OpenAI,或创建自定义 OpenAI 提供商',
      'API Key 填 sk-...',
      'Base URL 填 {{BASE_URL}}',
      '保存后测试连接;如果没有自动显示模型,手动添加模型 ID',
    ],
  },
  {
    id: 'nextchat',
    name: 'NextChat',
    category: 'chat',
    status: 'green',
    summary: '开源网页聊天,一键部署',
    steps: [
      '打开设置页,找到「自定义接口」或「接口地址」',
      '地址填 {{BASE_URL}}',
      '密钥填 sk-...',
      '在自定义模型中填写模型 ID',
      '保存后新建会话测试',
    ],
    tips: ['如果版本会自动把 /v1 附加到地址后面,接口地址只填 {{HOST}}'],
  },
  {
    id: 'open-webui',
    name: 'Open WebUI',
    category: 'chat',
    status: 'green',
    summary: '团队自建聊天平台,需管理员权限',
    steps: [
      '点击头像,进入「管理员设置」',
      '打开「Connections / 连接」,找到 OpenAI,点击「管理」',
      '点击「添加连接」,URL 填 {{BASE_URL}}',
      'API Key 填 sk-...',
      '模型过滤留空可尝试自动读取;读不到时手动添加模型 ID',
      '保存并启用该连接',
    ],
  },
  {
    id: 'other-chat-clients',
    name: 'DeepChat / AionUI / OpenCat 等',
    category: 'chat',
    status: 'green',
    summary: '其他聊天客户端的通用配置方法',
    steps: [
      '优先在本站「API 密钥」页寻找一键导入按钮',
      '手动配置时,类型选「OpenAI Compatible」',
      'Base URL 填 {{BASE_URL}}',
      'API Key 填你的 sk-... 密钥',
      'Model 填模型广场上的完整模型 ID',
    ],
  },
  // ── 翻译 ─────────────────────────────────────────────────────────────
  {
    id: 'immersive-translate',
    name: '沉浸式翻译',
    category: 'translate',
    status: 'green',
    recommended: true,
    summary: '网页、PDF、字幕翻译神器',
    steps: [
      '打开沉浸式翻译设置',
      '在「翻译服务」中选择 OpenAI,或添加 OpenAI 兼容服务',
      'API Key 填 sk-...',
      '自定义模型填模型 ID',
      '「自定义 URL」填完整地址 {{FULL_URL}}',
      '保存并用一小段网页文字测试',
    ],
    tips: [
      '翻译网页会短时间发出很多小请求。遇到 429 时降低「每秒请求数」,不要连续反复点重试',
    ],
  },
  {
    id: 'fluent-read',
    name: '流畅阅读 FluentRead',
    category: 'translate',
    status: 'green',
    summary: '开源沉浸式阅读翻译插件',
    steps: [
      '在流畅阅读中添加「OpenAI 兼容」翻译服务',
      '地址填 {{BASE_URL}};如果界面明确要求完整地址,则填 {{FULL_URL}}',
      '填写密钥和模型 ID',
      '先用短网页测试,再翻译 PDF 或长页面',
    ],
  },
  // ── 编程 ───────────────────────���─────────────────────────────────────
  {
    id: 'claude-code',
    name: 'Claude Code',
    category: 'coding',
    status: 'blue',
    summary: '使用 Anthropic 协议,需专用地址',
    steps: [
      'Claude Code 使用 Anthropic Messages 协议,不能直接把 OpenAI 地址填进 ANTHROPIC_BASE_URL',
      '只有当平台另外提供「Anthropic 专用地址」时才能配置:',
      'export ANTHROPIC_BASE_URL="平台提供的Anthropic专用地址"',
      'export ANTHROPIC_AUTH_TOKEN="你的密钥"',
    ],
    tips: [
      '不要把 /v1/chat/completions 当作 Anthropic /v1/messages 使用。没有专用地址时请改用 Cline、Roo Code、OpenCode',
    ],
  },
  {
    id: 'codex',
    name: 'Codex CLI',
    category: 'coding',
    status: 'blue',
    summary: '仅支持 Responses API 兼容的模型',
    steps: [
      'Codex 的自定义提供商使用 Responses API,不能把只支持 Chat Completions 的模型硬套进去',
      '只有所选模型明确支持 /v1/responses 时才配置(见示例)',
      '启动前设置对应的环境变量',
    ],
    snippet: {
      label: 'config.toml',
      code: `model = "请替换为支持Responses的模型ID"
model_provider = "myprovider"

[model_providers.myprovider]
name = "我的中转"
base_url = "{{BASE_URL}}"
env_key = "MY_API_KEY"
wire_api = "responses"`,
    },
    tips: [
      '如果报 404 /responses 或持续工具调用失败,请改用 Cline、Roo Code、OpenCode,不要反复改地址碰运气',
    ],
  },
  {
    id: 'dsh',
    name: 'DeepSeek Harness (DSH)',
    category: 'coding',
    status: 'green',
    recommended: true,
    summary: 'DeepSeek 官方开源 Agent,支持自定义 OpenAI 兼容供应商',
    steps: [
      '先安装 Node.js,在项目目录运行 npx @deepseek-ai/dsh web',
      '浏览器打开 http://127.0.0.1:3080,进入「Settings」→「Models」',
      '选择「Add a custom provider」,Provider ID 填一个小写英文名称,例如 yecai',
      'API protocol 选择「OpenAI Completions」,Base URL 填 {{BASE_URL}}',
      'Credential / API Key 填自己的 sk-... 密钥',
      '添加完整模型 ID,保存后返回会话并选择项目目录开始使用',
    ],
    tips: [
      'DSH 当前仍处于开发者预览阶段,升级后界面和配置格式可能变化',
      '模型必须支持工具调用;只能聊天、不能执行任务时,先换用支持 tools/function calling 的模型',
    ],
  },
  {
    id: 'pi-agent',
    name: 'Pi Coding Agent',
    category: 'coding',
    status: 'yellow',
    summary: '轻量可扩展的终端 Agent',
    steps: [
      '安装:npm install -g @mariozechner/pi-coding-agent',
      '创建或编辑 ~/.pi/agent/models.json,按下面的示例配置',
      '设置环境变量后启动 pi,输入 /model 选择模型',
      '先确认基础聊天和工具调用正常,再逐个增加扩展',
    ],
    snippet: {
      label: '~/.pi/agent/models.json',
      code: `{
  "providers": {
    "myprovider": {
      "baseUrl": "{{BASE_URL}}",
      "api": "openai-completions",
      "apiKey": "$MY_API_KEY",
      "authHeader": true,
      "models": [{ "id": "请替换为模型ID", "name": "中转模型" }]
    }
  }
}`,
    },
    tips: ['不要把完整的 /chat/completions 地址写进 baseUrl'],
  },
  {
    id: 'cline',
    name: 'Cline',
    category: 'coding',
    status: 'green',
    summary: 'VS Code 里的 AI 编程助手,新手编程首选',
    steps: [
      '在 VS Code 中安装 Cline,打开面板点击齿轮',
      'API Provider 选择「OpenAI Compatible」',
      'Base URL 填 {{BASE_URL}}',
      'API Key 填 sk-...',
      'Model ID 填完整模型 ID',
      '保存后让它读取一个小文件或解释一段代码测试',
    ],
    tips: [
      '聊天能回复但不能修改文件时,通常不是密钥问题,而是模型不支持工具调用。换支持 tools 的模型再试',
    ],
  },
  {
    id: 'roo-code',
    name: 'Roo Code',
    category: 'coding',
    status: 'green',
    summary: 'VS Code AI Agent,依赖原生工具调用',
    steps: [
      '打开 Roo Code 设置',
      'API Provider 选择「OpenAI Compatible」',
      'Base URL 填 {{BASE_URL}}',
      'API Key 填 sk-...',
      'Model ID 填完整模型 ID',
      '保存并执行一个只读的小任务测试',
    ],
    tips: ['模型必须支持 tools/function calling,否则无法执行 Agent 任务'],
  },
  {
    id: 'kilo-code',
    name: 'Kilo Code',
    category: 'coding',
    status: 'green',
    summary: 'VS Code / CLI,原生支持自定义供应商',
    steps: [
      '打开 Kilo Code 设置,进入 Providers,选择「添加自定义供应商」',
      'Provider ID 随意填,显示名称填本站名称',
      'Provider API 选择「OpenAI Compatible」',
      'Base URL 填 {{BASE_URL}}',
      'API Key 填 sk-... 密钥',
      '从自动获取的列表选择模型;获取不到时手动添加完整模型 ID',
      '保存后先运行一个小任务测试工具调用',
    ],
  },
  {
    id: 'continue',
    name: 'Continue',
    category: 'coding',
    status: 'yellow',
    summary: 'VS Code / JetBrains 插件,需编辑配置文件',
    steps: [
      '打开 Continue 的配置文件,按下面的示例添加模型',
      '把 apiBase 填为 {{BASE_URL}},apiKey 填你的密钥',
      '保存后重启编辑器测试',
    ],
    snippet: {
      label: 'config.yaml',
      code: `models:
  - name: 我的中转模型
    provider: openai
    model: 请替换为模型ID
    apiBase: {{BASE_URL}}
    apiKey: 请替换为你的密钥
    capabilities:
      - tool_use`,
    },
    tips: [
      '如果 Continue 自动改用 /responses 后报错,在模型配置中增加 useResponsesApi: false',
    ],
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    category: 'coding',
    status: 'yellow',
    summary: '终端编程 Agent,需编辑 opencode.json',
    steps: [
      '运行 /connect,选择「Other」,设置一个提供商 ID',
      '在 opencode.json 中按下面的示例配置',
      '重启 OpenCode,输入 /models 选择你的模型',
      '用一个小项目测试读取、编辑和命令调用',
    ],
    snippet: {
      label: 'opencode.json',
      code: `{
  "provider": {
    "myprovider": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "我的中转",
      "options": { "baseURL": "{{BASE_URL}}" },
      "models": { "请替换为模型ID": { "name": "中转模型" } }
    }
  }
}`,
    },
  },
  {
    id: 'aider',
    name: 'Aider',
    category: 'coding',
    status: 'yellow',
    summary: '命令行结对编程,用环境变量配置',
    steps: ['在终端设置环境变量后启动(见下方示例)'],
    snippet: {
      label: 'macOS / Linux',
      code: `export OPENAI_API_BASE="{{BASE_URL}}"
export OPENAI_API_KEY="请替换为你的密钥"
aider --model openai/请替换为模型ID`,
    },
  },
  {
    id: 'qwen-code',
    name: 'Qwen Code',
    category: 'coding',
    status: 'yellow',
    summary: '命令行编程工具,需编辑 settings.json',
    steps: [
      '在 ~/.qwen/settings.json 中按下面的示例配置',
      '启动前设置对应的环境变量,然后用 /model 选择该模型',
    ],
    snippet: {
      label: '~/.qwen/settings.json',
      code: `{
  "modelProviders": {
    "openai": [
      {
        "id": "请替换为模型ID",
        "name": "我的中转",
        "envKey": "MY_API_KEY",
        "baseUrl": "{{BASE_URL}}"
      }
    ]
  }
}`,
    },
  },
  {
    id: 'trae',
    name: 'Trae / TraeCode CLI',
    category: 'coding',
    status: 'green',
    recommended: true,
    summary: '国产编程工具,支持自定义 OpenAI 模型',
    steps: [
      '进入「设置」→「模型」→「添加模型」',
      'API 格式选择 OpenAI',
      'Base URL 填 {{BASE_URL}}',
      'API Key 填 sk-...',
      '模型填完整模型 ID',
    ],
  },
  {
    id: 'crush',
    name: 'Crush',
    category: 'coding',
    status: 'yellow',
    summary: '终端编程 Agent,适合命令行熟手',
    steps: [
      '在供应商管理中添加 openai-compat 类型的自定义供应商(见示例)',
      '用 model add 添加模型,模型 ID 必须与模型广场完全一致',
      '上下文长度、最大输出等参数以模型页面为准,不要照抄别家同名模型',
    ],
    snippet: {
      label: '终端',
      code: `provider add myprovider --type openai-compat \\
  --base-url "{{BASE_URL}}" \\
  --api-key "$MY_API_KEY"`,
    },
  },
  {
    id: 'gemini-cli',
    name: 'Gemini CLI',
    category: 'coding',
    status: 'blue',
    summary: '使用 Gemini 原生协议,需专用地址',
    steps: [
      '只有��台提供「Gemini 专用地址」时才能配置:',
      'export GEMINI_API_KEY="你的密钥"',
      'export GOOGLE_GEMINI_BASE_URL="平台提供的Gemini专用地址"',
    ],
    tips: ['普通 OpenAI 兼容地址不能直接代替 Gemini 原生地址'],
  },
  {
    id: 'cursor',
    name: 'Cursor',
    category: 'coding',
    status: 'yellow',
    summary: '有限支持,可能影响内置模型',
    steps: [
      '打开 Cursor Settings → Models',
      '填写 OpenAI API Key(你的 sk-... 密钥)',
      '打开 Override OpenAI Base URL,填 {{BASE_URL}}',
      '添加或选择模型 ID',
      '先用 Ask/Chat 测试,不要一开始运行大型 Agent 任务',
    ],
    tips: [
      '自定义 Key 主要用于普通聊天;Tab 补全等功能仍走 Cursor 自己的服务。需要稳定使用第三方接口时更推荐 Cline 或 Roo Code',
    ],
  },
  {
    id: 'windsurf',
    name: 'Windsurf',
    category: 'coding',
    status: 'gray',
    summary: '暂无通用自定义 Base URL,不建议',
    steps: [
      'Windsurf 官方 BYOK 只对它列出的部分模型开放,没有面向任意 OpenAI 兼容服务的通用 Base URL 配置',
      '不要把密钥直接填进官方 OpenAI / Anthropic / Google Key 输入框后期待它自动识别中转地址',
      '当前建议使用 Cline、Roo Code、Continue 或 Trae',
    ],
  },
  // ── 配置与账号管理 ───────────────────────────────────────────────────
  {
    id: 'cc-switch',
    name: 'CC Switch',
    category: 'manager',
    status: 'yellow',
    summary: '多个编程 CLI 的地址、Key、MCP 统一切换器',
    steps: [
      '先安装并至少启动一次目标应用(推荐 OpenCode),让 CC Switch 能找到它的配置目录',
      '打开 CC Switch,顶部选择「OpenCode」',
      '点击右上角「+」添加供应商,选择「应用专属供应商」,不要先选「通用供应商」',
      '预设选择「OpenAI Compatible」;没有该预设就选「Custom / 自定义」',
      'API Key 填自己的 sk-... 密钥',
      'Endpoint / Base URL 填 {{BASE_URL}}',
      '点击「获取模型」;失败时手动粘贴完整模型 ID',
      '保存后点击「启用」,完全退出并重新打开目标应用',
    ],
    tips: [
      '不要把同一配置通过「通用供应商」直接同步给 Claude Code 和 Gemini CLI,它们使用的原生协议不同',
      '切换后大多数 CLI 需要重启才能读取新配置;旧地址仍生效时先检查系统环境变量是否覆盖了配置',
      '首次使用前建议导出备份,避免切换时覆盖原有的 MCP、模型或登录配置',
    ],
  },
  {
    id: 'cockpit-tools',
    name: 'Cockpit Tools',
    category: 'manager',
    status: 'green',
    summary: '支持 Codex API Key、自定义 Base URL 与本地 API 服务',
    steps: [
      '升级到最新版 Cockpit Tools,打开 Codex 账号页',
      '选择「API Key」方式添加账号,供应商模式选「自定义」',
      'API Key 填自己的 sk-... 密钥,Base URL 填 {{BASE_URL}}',
      '按本站模型广场填写或同步模型 ID,协议选择与模型匹配的 Responses 或 OpenAI 兼容模式',
      '保存并切换到该账号;需要给其他工具调用时,再到「Codex API Service」创建客户端 Key 并启用本地服务',
      '把 Cockpit Tools 显示的本地 Base URL 和客户端 Key 填进目标工具,先发一条短消息测试',
    ],
    tips: [
      'Cockpit Tools 的本地 API Service 地址通常是 localhost 加动态端口,不要误填成本站上游地址',
      '只从官方项目下载;切换前备份配置,不要把包含 Token、Cookie 或客户端 Key 的备份发给别人',
    ],
  },
  // ── 知识库与工作流 ───────────────────────────────────────────────────
  {
    id: 'dify',
    name: 'Dify',
    category: 'platform',
    status: 'green',
    summary: '知识库与工作流平台,需管理员权限',
    steps: [
      '进入「设置」→「模型供应商」',
      '安装或打开 OpenAI 模型供应商',
      '填 API Key',
      '自定义基础 URL 填 {{BASE_URL}}',
      '添加或选择模型 ID,测试并保存',
    ],
    tips: [
      '如果插件只显示官方 OpenAI 模型、不能添加自定义模型,需换用支持自定义模型 ID 的 OpenAI 兼容插件',
    ],
  },
  {
    id: 'fastgpt',
    name: 'FastGPT',
    category: 'platform',
    status: 'green',
    summary: '知识库平台,管理员配置',
    steps: [
      '在「模型供应商」中添加 OpenAI 协议渠道',
      'Base URL 填 {{BASE_URL}}',
      'Key 填 sk-...',
      '模型填完整模型 ID',
    ],
    tips: [
      '自部署版本也可通过 OPENAI_BASE_URL 和 CHAT_API_KEY 环境变量配置。不要把完整 /chat/completions 地址当作 Base URL',
    ],
  },
  {
    id: 'flowise',
    name: 'Flowise',
    category: 'platform',
    status: 'green',
    summary: '可视化工作流编排',
    steps: [
      '使用 ChatOpenAI 节点',
      '创建 OpenAI 凭据并填入密钥',
      '在 Additional Parameters 中将 Base Path 改为 {{BASE_URL}}',
      '内置列表没有该模型时,使用 ChatOpenAI Custom 并填写模型 ID',
    ],
  },
  {
    id: 'n8n-langflow',
    name: 'n8n / Langflow / Coze 等',
    category: 'platform',
    status: 'yellow',
    summary: '其他自动化平台的通用判断方法',
    steps: [
      '先看它的模型凭据页面有没有三个输入框:API Key、Base URL / Endpoint、Model ID',
      '三个都有,并且明确写着 OpenAI Compatible,通常可以接入',
      '只有 API Key、没有 Base URL 的,通常只能连接官方服务,不能接入自定义中转',
    ],
    tips: ['找不到 Base URL 时,不要把地址填进 API Key 或 Organization 字段'],
  },
]

/** 报错排查表(通俗解释 + 处理方法)。 */
export interface TroubleshootRow {
  error: string
  meaning: string
  fix: string
}

export const troubleshootRows: TroubleshootRow[] = [
  {
    error: '401 Invalid API key',
    meaning: '密钥错、被删除、复制不完整或前后有空格',
    fix: '重新复制完整密钥;仍失败就新建一枚',
  },
  {
    error: '404 Not Found',
    meaning: '地址或路径拼错',
    fix: '检查是否重复了 /v1 或 /chat/completions',
  },
  {
    error: '400 model not found',
    meaning: '模型 ID 写错或当前分组无权使用',
    fix: '从模型广场重新复制模型 ID',
  },
  {
    error: '400 response_format unavailable',
    meaning: '客户端发送了该模型不支持的格式参数',
    fix: '关闭 JSON/结构化输出,或换模型/客户端',
  },
  {
    error: '429 Too Many Requests',
    meaning: '请求太快、并发过高或额度窗口已满',
    fix: '降低并发,稍等后再试,不要疯狂重试',
  },
  {
    error: '500 Internal server error',
    meaning: '服务内部异常,也可能是上游返回异常',
    fix: '保存请求 ID,稍后重试一次;持续出现再反馈',
  },
  {
    error: '502 all upstream attempts failed',
    meaning: '可用上游暂时全部失败',
    fix: '换模型或等待恢复,并带请求 ID 反馈',
  },
  {
    error: '503 Service Unavailable',
    meaning: '上游繁忙、维护或当前无可用线路',
    fix: '等待片刻或换模型',
  },
  {
    error: '一直转圈、30 秒后失败',
    meaning: '客户端超时或首字太慢',
    fix: '将超时调到 120 秒;先测试短问题',
  },
  {
    error: '能聊天但不能改文件',
    meaning: '模型不支持工具调用,或工具协议不兼容',
    fix: '换支持 tools/function calling 的模型',
  },
  {
    error: '模型列表为空',
    meaning: '客户端没成功读取 /v1/models',
    fix: '手动添加模型 ID,不代表密钥失效',
  },
  {
    error: '上下文提前压缩',
    meaning: '客户端自己的压缩策略触发',
    fix: '查看客户端上下文设置;不等于服务端只有小上下文',
  },
]

/** 「帮我选工具」快速推荐。 */
export interface UseCaseRow {
  useCase: string
  tools: string
  difficulty: '简单' | '中等' | '较难'
}

export const useCaseRows: UseCaseRow[] = [
  {
    useCase: '国产办公智能体、操作本地文件',
    tools: 'WorkBuddy / CodeBuddy',
    difficulty: '简单',
  },
  {
    useCase: '网页、PDF、字幕翻译',
    tools: '沉浸式翻译、流畅阅读',
    difficulty: '简单',
  },
  {
    useCase: '用 DeepSeek 官方 Agent 执行任务',
    tools: 'DeepSeek Harness (DSH)',
    difficulty: '中等',
  },
  {
    useCase: '用国产工具辅助编程',
    tools: 'Trae / TraeCode CLI',
    difficulty: '简单',
  },
  {
    useCase: '终端里写代码',
    tools: 'Claude Code、Codex、Pi、OpenCode、Crush',
    difficulty: '中等',
  },
  {
    useCase: 'VS Code 里写代码',
    tools: 'Cline、Roo Code、Kilo Code、Continue',
    difficulty: '简单',
  },
  {
    useCase: '同时切换多个 CLI 的配置',
    tools: 'CC Switch',
    difficulty: '中等',
  },
  {
    useCase: '自建团队聊天网页',
    tools: 'Open WebUI、LobeChat、NextChat',
    difficulty: '中等',
  },
  {
    useCase: '搭建知识库或工作流',
    tools: 'Dify、FastGPT、Flowise',
    difficulty: '较难',
  },
]
