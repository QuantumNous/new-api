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
 * Guide prose is stored as English translation keys and translated at render
 * time. Address strings use placeholders
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
  /** Step-by-step instructions (translation keys with address placeholders). */
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
    summary: 'A Chinese office agent with local file access.',
    steps: [
      'Open WorkBuddy and click the account avatar at the bottom left.',
      'Go to Settings → Models and click Add model.',
      'Choose Custom as the provider.',
      'Set the full endpoint URL to {{FULL_URL}}.',
      'Enter your sk-... key in API Key.',
      'Use the exact model ID from the model catalog.',
      'For the first test, enable only tool calling. Enable image input or reasoning only if the model explicitly supports it.',
      'Save, then return to chat and select the model you added.',
    ],
    tips: [
      'If your version has a Full URL switch, enable it for the full endpoint. Disable it when entering only {{BASE_URL}} so the app adds the path. Do not combine both, or you may get a 404.',
    ],
  },
  {
    id: 'cherry-studio',
    name: 'Cherry Studio',
    category: 'chat',
    status: 'green',
    summary: 'Desktop chat client supporting OpenAI-compatible APIs.',
    steps: [
      'Open Cherry Studio and click Settings at the bottom left.',
      'Open Model services, click Add, and choose OpenAI or OpenAI Compatible.',
      "Choose any name, such as this site's name.",
      'Enter the sk-... key you created in API Key.',
      'Set the API address to {{BASE_URL}}.',
      'Click Manage or Add model and paste the exact model ID.',
      'Click Check. If it succeeds, turn on the enable switch at the top right.',
      'Return to chat, select the new model, and send a short greeting to test it.',
    ],
    tips: [
      'If Check returns 404, try {{HOST}} as the API address; versions differ in how they append /v1.',
    ],
  },
  {
    id: 'chatbox',
    name: 'Chatbox',
    category: 'chat',
    status: 'green',
    summary: 'Lightweight chat client for phones and computers.',
    steps: [
      'Open Chatbox and click Settings in the sidebar.',
      'Open Model providers, click Add, and choose OpenAI API compatible.',
      'If the field is API Host, enter {{HOST}}.',
      'If the field is Base URL, enter {{BASE_URL}}.',
      'Enter your sk-... key in API Key.',
      'Keep API Path as /v1/chat/completions. Skip this if there is no such field.',
      'Add the model ID, save, and click Check.',
    ],
  },
  {
    id: 'lobechat',
    name: 'LobeChat',
    category: 'chat',
    status: 'green',
    summary: 'An open-source chat interface you can host for your team.',
    steps: [
      'Go to Settings → Language models.',
      'Select OpenAI or create a custom OpenAI provider.',
      'Set API Key to sk-....',
      'Set Base URL to {{BASE_URL}}.',
      'Save and test the connection. Add the model ID manually if models do not appear automatically.',
    ],
  },
  {
    id: 'nextchat',
    name: 'NextChat',
    category: 'chat',
    status: 'green',
    summary: 'Open-source web chat with one-click deployment.',
    steps: [
      'Open Settings and find Custom endpoint or API address.',
      'Enter {{BASE_URL}} as the address.',
      'Enter sk-... as the key.',
      'Enter the model ID under custom models.',
      'Save and start a new chat to test.',
    ],
    tips: [
      'If your version adds /v1 automatically, enter only {{HOST}} as the endpoint.',
    ],
  },
  {
    id: 'open-webui',
    name: 'Open WebUI',
    category: 'chat',
    status: 'green',
    summary: 'Self-hosted team chat platform requiring administrator access.',
    steps: [
      'Click your avatar and open Admin settings.',
      'Open Connections, find OpenAI, and click Manage.',
      'Click Add connection and set the URL to {{BASE_URL}}.',
      'Set API Key to sk-....',
      'Leave the model filter empty to try automatic discovery; add the model ID manually if it fails.',
      'Save and enable the connection.',
    ],
  },
  {
    id: 'other-chat-clients',
    name: 'DeepChat / AionUI / OpenCat and others',
    category: 'chat',
    status: 'green',
    summary: 'General setup for other chat clients.',
    steps: [
      "First look for a one-click import button on this site's API Keys page.",
      'For manual setup, choose OpenAI Compatible.',
      'Set Base URL to {{BASE_URL}}.',
      'Set API Key to your sk-... key.',
      'Set Model to the exact ID from the model catalog.',
    ],
  },
  // ── 翻译 ─────────────────────────────────────────────────────────────
  {
    id: 'immersive-translate',
    name: 'Immersive Translate',
    category: 'translate',
    status: 'green',
    recommended: true,
    summary: 'Translate web pages, PDFs, and subtitles.',
    steps: [
      'Open Immersive Translate settings.',
      'Choose OpenAI under Translation service, or add an OpenAI-compatible service.',
      'Set API Key to sk-....',
      'Enter the model ID in Custom model.',
      'Set Custom URL to the full endpoint {{FULL_URL}}.',
      'Save and test with a short section of a web page.',
    ],
    tips: [
      'Page translation sends many small requests quickly. If you see 429, lower requests per second instead of repeatedly retrying.',
    ],
  },
  {
    id: 'fluent-read',
    name: 'FluentRead',
    category: 'translate',
    status: 'green',
    summary: 'Open-source extension for immersive reading and translation.',
    steps: [
      'Add an OpenAI-compatible translation service in FluentRead.',
      'Enter {{BASE_URL}}, or {{FULL_URL}} if the field explicitly asks for the full endpoint.',
      'Enter the API key and model ID.',
      'Test with a short web page before translating PDFs or long pages.',
    ],
  },
  // Coding tools
  {
    id: 'claude-code',
    name: 'Claude Code',
    category: 'coding',
    status: 'blue',
    summary: 'Uses the Anthropic protocol and requires its dedicated endpoint.',
    steps: [
      'Claude Code uses Anthropic Messages. Do not put an OpenAI endpoint in ANTHROPIC_BASE_URL.',
      'Configure this only if the platform provides a dedicated Anthropic endpoint:',
      'export ANTHROPIC_BASE_URL="YOUR_ANTHROPIC_ENDPOINT"',
      'export ANTHROPIC_AUTH_TOKEN="YOUR_API_KEY"',
    ],
    tips: [
      'Do not substitute /v1/chat/completions for Anthropic /v1/messages. Without a dedicated endpoint, use Cline, Roo Code, or OpenCode.',
    ],
  },
  {
    id: 'codex',
    name: 'Codex CLI',
    category: 'coding',
    status: 'blue',
    summary: 'Supports only models compatible with the Responses API.',
    steps: [
      'Codex custom providers use the Responses API; Chat Completions-only models will not work.',
      'Configure this only if the selected model explicitly supports /v1/responses; see the example.',
      'Set the corresponding environment variable before starting.',
    ],
    snippet: {
      label: 'config.toml',
      code: `model = "YOUR_RESPONSES_MODEL_ID"
model_provider = "myprovider"

[model_providers.myprovider]
name = "My API provider"
base_url = "{{BASE_URL}}"
env_key = "MY_API_KEY"
wire_api = "responses"`,
    },
    tips: [
      'If /responses returns 404 or tool calls keep failing, use Cline, Roo Code, or OpenCode instead of repeatedly guessing URLs.',
    ],
  },
  {
    id: 'dsh',
    name: 'DeepSeek Harness (DSH)',
    category: 'coding',
    status: 'green',
    recommended: true,
    summary:
      "DeepSeek's official open-source agent with custom OpenAI-compatible providers.",
    steps: [
      'Install Node.js, then run npx @deepseek-ai/dsh web in your project directory.',
      'Open http://127.0.0.1:3080 in your browser and go to Settings → Models.',
      'Choose Add a custom provider and enter a lowercase Provider ID, such as yecai.',
      'Choose OpenAI Completions for API protocol and set Base URL to {{BASE_URL}}.',
      'Enter your sk-... key in Credential / API Key.',
      'Add the exact model ID, save, then return to the session and select a project directory.',
    ],
    tips: [
      'DSH is still in developer preview; its interface and configuration format may change after updates.',
      'The model must support tool calling. If chat works but tasks do not, switch to a model supporting tools/function calling.',
    ],
  },
  {
    id: 'pi-agent',
    name: 'Pi Coding Agent',
    category: 'coding',
    status: 'yellow',
    summary: 'A lightweight, extensible terminal agent.',
    steps: [
      'Install with npm install -g @mariozechner/pi-coding-agent.',
      'Create or edit ~/.pi/agent/models.json using the example below.',
      'Set the environment variable, start pi, and use /model to select a model.',
      'Verify basic chat and tool calls before adding extensions one by one.',
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
      "models": [{ "id": "YOUR_MODEL_ID", "name": "API model" }]
    }
  }
}`,
    },
    tips: ['Do not put the full /chat/completions endpoint in baseUrl.'],
  },
  {
    id: 'cline',
    name: 'Cline',
    category: 'coding',
    status: 'green',
    summary: 'AI coding assistant in VS Code, suitable for beginners.',
    steps: [
      'Install Cline in VS Code, open its panel, and click the gear icon.',
      'Choose OpenAI Compatible as API Provider.',
      'Set Base URL to {{BASE_URL}}.',
      'Set API Key to sk-....',
      'Enter the exact model ID in Model ID.',
      'Save and test by asking it to read a small file or explain some code.',
    ],
    tips: [
      'If chat works but file edits do not, the model usually lacks tool support rather than having a key problem. Try a tools-capable model.',
    ],
  },
  {
    id: 'roo-code',
    name: 'Roo Code',
    category: 'coding',
    status: 'green',
    summary: 'VS Code AI agent that relies on native tool calling.',
    steps: [
      'Open Roo Code settings.',
      'Choose OpenAI Compatible as API Provider.',
      'Set Base URL to {{BASE_URL}}.',
      'Set API Key to sk-....',
      'Enter the exact model ID in Model ID.',
      'Save and test with a small read-only task.',
    ],
    tips: ['The model must support tools/function calling to run agent tasks.'],
  },
  {
    id: 'kilo-code',
    name: 'Kilo Code',
    category: 'coding',
    status: 'green',
    summary: 'VS Code / CLI with native support for custom providers.',
    steps: [
      'Open Kilo Code settings, go to Providers, and add a custom provider.',
      "Choose any Provider ID and use this site's name as the display name.",
      'Choose OpenAI Compatible as Provider API.',
      'Set Base URL to {{BASE_URL}}.',
      'Enter your sk-... key in API Key.',
      'Select a model from the fetched list, or add its exact ID manually if fetching fails.',
      'Save, then run a small task to test tool calling.',
    ],
  },
  {
    id: 'continue',
    name: 'Continue',
    category: 'coding',
    status: 'yellow',
    summary: 'VS Code / JetBrains extension requiring a configuration file.',
    steps: [
      "Open Continue's configuration file and add a model using the example below.",
      'Set apiBase to {{BASE_URL}} and apiKey to your key.',
      'Save and restart the editor to test.',
    ],
    snippet: {
      label: 'config.yaml',
      code: `models:
  - name: My API model
    provider: openai
    model: YOUR_MODEL_ID
    apiBase: {{BASE_URL}}
    apiKey: YOUR_API_KEY
    capabilities:
      - tool_use`,
    },
    tips: [
      'If Continue fails after automatically switching to /responses, add useResponsesApi: false to the model configuration.',
    ],
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    category: 'coding',
    status: 'yellow',
    summary: 'Terminal coding agent configured through opencode.json.',
    steps: [
      'Run /connect, choose Other, and set a provider ID.',
      'Configure opencode.json using the example below.',
      'Restart OpenCode and use /models to select your model.',
      'Test reading, editing, and command execution in a small project.',
    ],
    snippet: {
      label: 'opencode.json',
      code: `{
  "provider": {
    "myprovider": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "My API provider",
      "options": { "baseURL": "{{BASE_URL}}" },
      "models": { "YOUR_MODEL_ID": { "name": "API model" } }
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
    summary:
      'Command-line pair programming configured with environment variables.',
    steps: [
      'Set the environment variables in your terminal before starting; see the example below.',
    ],
    snippet: {
      label: 'macOS / Linux',
      code: `export OPENAI_API_BASE="{{BASE_URL}}"
export OPENAI_API_KEY="YOUR_API_KEY"
aider --model openai/YOUR_MODEL_ID`,
    },
  },
  {
    id: 'qwen-code',
    name: 'Qwen Code',
    category: 'coding',
    status: 'yellow',
    summary: 'Command-line coding tool configured through settings.json.',
    steps: [
      'Configure ~/.qwen/settings.json using the example below.',
      'Set the corresponding environment variable before starting, then select the model with /model.',
    ],
    snippet: {
      label: '~/.qwen/settings.json',
      code: `{
  "modelProviders": {
    "openai": [
      {
        "id": "YOUR_MODEL_ID",
        "name": "My API provider",
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
    summary: 'Chinese coding tool supporting custom OpenAI models.',
    steps: [
      'Go to Settings → Models → Add model.',
      'Choose OpenAI as the API format.',
      'Set Base URL to {{BASE_URL}}.',
      'Set API Key to sk-....',
      'Enter the exact model ID as the model.',
    ],
  },
  {
    id: 'crush',
    name: 'Crush',
    category: 'coding',
    status: 'yellow',
    summary: 'Terminal coding agent for experienced command-line users.',
    steps: [
      'Add a custom provider of type openai-compat in provider management; see the example.',
      'Use model add to add a model whose ID exactly matches the model catalog.',
      'Use the model page for context length and output limits; do not copy settings from a similarly named model elsewhere.',
    ],
    snippet: {
      label: 'Terminal',
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
    summary:
      "Uses Gemini's native protocol and requires its dedicated endpoint.",
    steps: [
      'Configure this only if the platform provides a dedicated Gemini endpoint:',
      'export GEMINI_API_KEY="YOUR_API_KEY"',
      'export GOOGLE_GEMINI_BASE_URL="YOUR_GEMINI_ENDPOINT"',
    ],
    tips: [
      'A standard OpenAI-compatible endpoint cannot replace a native Gemini endpoint.',
    ],
  },
  {
    id: 'cursor',
    name: 'Cursor',
    category: 'coding',
    status: 'yellow',
    summary: 'Limited support that may affect built-in models.',
    steps: [
      'Open Cursor Settings → Models.',
      'Enter your sk-... key as the OpenAI API Key.',
      'Enable Override OpenAI Base URL and enter {{BASE_URL}}.',
      'Add or select the model ID.',
      'Test with Ask/Chat first; do not begin with a large agent task.',
    ],
    tips: [
      "Custom keys mainly serve regular chat. Tab completion still uses Cursor's services. Prefer Cline or Roo Code for reliable third-party API use.",
    ],
  },
  {
    id: 'windsurf',
    name: 'Windsurf',
    category: 'coding',
    status: 'gray',
    summary: 'No general custom Base URL support; not recommended.',
    steps: [
      'Windsurf BYOK supports only selected listed models and has no general Base URL setting for arbitrary OpenAI-compatible services.',
      'Do not expect an official OpenAI / Anthropic / Google key field to detect your custom proxy address automatically.',
      'Use Cline, Roo Code, Continue, or Trae instead.',
    ],
  },
  // ── 配置与账号管理 ───────────────────────────────────────────────────
  {
    id: 'cc-switch',
    name: 'CC Switch',
    category: 'manager',
    status: 'yellow',
    summary: 'Switch endpoints, keys, and MCP settings across coding CLIs.',
    steps: [
      'Install and start the target app at least once, so CC Switch can find its configuration directory.',
      'Open CC Switch and select the target app you want to configure at the top.',
      'Click + at the top right, then choose an app-specific provider rather than a universal provider.',
      'Choose the OpenAI Compatible preset, or Custom if that preset is unavailable.',
      'Enter your own sk-... key in API Key.',
      'Set Endpoint / Base URL to {{BASE_URL}}.',
      'Click Fetch models; paste the exact model ID manually if it fails.',
      'Save, click Enable, then fully quit and reopen the target app.',
    ],
    tips: [
      'Do not sync one universal configuration directly to Claude Code and Gemini CLI; they use different native protocols.',
      'Most CLIs must restart after switching. If the old endpoint remains active, check whether system environment variables override the configuration.',
      'Export a backup before first use to avoid overwriting existing MCP, model, or login settings.',
    ],
  },
  {
    id: 'cockpit-tools',
    name: 'Cockpit Tools',
    category: 'manager',
    status: 'green',
    summary:
      'Supports Codex API keys, custom Base URLs, and a local API service.',
    steps: [
      'Update Cockpit Tools to the latest version and open the Codex accounts page.',
      'Add an account using API Key and choose Custom as the provider mode.',
      'Enter your sk-... key and set Base URL to {{BASE_URL}}.',
      "Enter or sync model IDs from this site's catalog, then choose Responses or OpenAI-compatible mode to match the model.",
      'Save and switch to this account. To connect other tools, create a client key in Codex API Service and enable the local service.',
      'Enter the local Base URL and client key shown by Cockpit Tools into your target tool, then send a short test message.',
    ],
    tips: [
      "Cockpit Tools' local API service usually uses localhost with a dynamic port. Do not confuse it with this site's upstream address.",
      'Download only from the official project and back up settings before switching. Never share backups containing tokens, cookies, or client keys.',
    ],
  },
  // ── 知识库与工作流 ───────────────────────────────────────────────────
  {
    id: 'dify',
    name: 'Dify',
    category: 'platform',
    status: 'green',
    summary:
      'Knowledge-base and workflow platform requiring administrator access.',
    steps: [
      'Go to Settings → Model providers.',
      'Install or open the OpenAI model provider.',
      'Enter your API key.',
      'Set the custom base URL to {{BASE_URL}}.',
      'Add or select a model ID, test, and save.',
    ],
    tips: [
      'If the plugin only lists official OpenAI models and cannot add custom IDs, use an OpenAI-compatible plugin that supports custom model IDs.',
    ],
  },
  {
    id: 'fastgpt',
    name: 'FastGPT',
    category: 'platform',
    status: 'green',
    summary: 'Knowledge-base platform configured by an administrator.',
    steps: [
      'Add an OpenAI-protocol channel under Model providers.',
      'Set Base URL to {{BASE_URL}}.',
      'Set Key to sk-....',
      'Enter the exact model ID as the model.',
    ],
    tips: [
      'Self-hosted versions can also use OPENAI_BASE_URL and CHAT_API_KEY. Do not use the full /chat/completions endpoint as the Base URL.',
    ],
  },
  {
    id: 'flowise',
    name: 'Flowise',
    category: 'platform',
    status: 'green',
    summary: 'Visual workflow orchestration.',
    steps: [
      'Use a ChatOpenAI node.',
      'Create OpenAI credentials and enter the key.',
      'In Additional Parameters, set Base Path to {{BASE_URL}}.',
      'If the model is absent from the built-in list, use ChatOpenAI Custom and enter its ID.',
    ],
  },
  {
    id: 'n8n-langflow',
    name: 'n8n / Langflow / Coze and others',
    category: 'platform',
    status: 'yellow',
    summary: 'How to assess support in other automation platforms.',
    steps: [
      'Look for three fields on the model credentials page: API Key, Base URL / Endpoint, and Model ID.',
      'If all three exist and OpenAI Compatible is explicitly supported, the platform can usually connect.',
      'If there is only an API Key field and no Base URL, it usually supports official services only, not a custom proxy.',
    ],
    tips: [
      'If you cannot find Base URL, do not put the address in API Key or Organization.',
    ],
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
    meaning:
      'The key is incorrect, deleted, incomplete, or has surrounding spaces.',
    fix: 'Copy the complete key again; create a new one if it still fails.',
  },
  {
    error: '404 Not Found',
    meaning: 'The address or path is misspelled.',
    fix: 'Check for a duplicated /v1 or /chat/completions in the URL.',
  },
  {
    error: '400 model not found',
    meaning: 'The model ID is incorrect or unavailable to the current group.',
    fix: 'Copy the model ID again from the model catalog.',
  },
  {
    error: '400 response_format unavailable',
    meaning: 'The client sent a format parameter unsupported by this model.',
    fix: 'Disable JSON/structured output, or switch the model or client.',
  },
  {
    error: '429 Too Many Requests',
    meaning:
      'Requests are too frequent, concurrency is too high, or the quota window is exhausted.',
    fix: 'Reduce concurrency and wait before retrying; avoid repeated rapid retries.',
  },
  {
    error: '500 Internal server error',
    meaning:
      'An internal service error occurred, possibly from the upstream provider.',
    fix: 'Save the request ID and retry once later. Report it if the issue persists.',
  },
  {
    error: '502 all upstream attempts failed',
    meaning: 'All available upstream providers have temporarily failed.',
    fix: 'Switch models or wait for recovery, and include the request ID in your report.',
  },
  {
    error: '503 Service Unavailable',
    meaning:
      'The upstream is busy, under maintenance, or has no available route.',
    fix: 'Wait a moment or choose another model.',
  },
  {
    error: 'Keeps loading, then fails after 30 seconds',
    meaning: 'The client timed out or the first response token was too slow.',
    fix: 'Set the timeout to 120 seconds and test with a short question first.',
  },
  {
    error: 'Chat works but files cannot be edited',
    meaning:
      'The model lacks tool calling or uses an incompatible tool protocol.',
    fix: 'Switch to a model supporting tools/function calling.',
  },
  {
    error: 'The model list is empty',
    meaning: 'The client could not fetch /v1/models.',
    fix: 'Add the model ID manually; an empty list does not mean the key is invalid.',
  },
  {
    error: 'Context is compressed too early',
    meaning: "The client's own context-compaction policy was triggered.",
    fix: "Check the client's context settings; this does not imply a small server-side context window.",
  },
]

/** 「帮我选工具」快速推荐。 */
export interface UseCaseRow {
  useCase: string
  tools: string
  difficulty: 'Easy' | 'Medium' | 'Advanced'
  /** ids in {@link guideTools} this use case leads to. */
  toolIds: string[]
}

export const useCaseRows: UseCaseRow[] = [
  {
    useCase: 'Office agents and local file tasks',
    tools: 'WorkBuddy / CodeBuddy',
    difficulty: 'Easy',
    toolIds: ['workbuddy'],
  },
  {
    useCase: 'Translate web pages, PDFs, and subtitles',
    tools: 'Immersive Translate, FluentRead',
    difficulty: 'Easy',
    toolIds: ['immersive-translate', 'fluent-read'],
  },
  {
    useCase: "Run tasks with DeepSeek's official agent",
    tools: 'DeepSeek Harness (DSH)',
    difficulty: 'Medium',
    toolIds: ['dsh'],
  },
  {
    useCase: 'Code with Chinese developer tools',
    tools: 'Trae / TraeCode CLI',
    difficulty: 'Easy',
    toolIds: ['trae'],
  },
  {
    useCase: 'Write code in the terminal',
    tools: 'Claude Code、Codex、Pi、OpenCode、Crush',
    difficulty: 'Medium',
    toolIds: ['claude-code', 'codex', 'pi-agent', 'opencode', 'crush'],
  },
  {
    useCase: 'Write code in VS Code',
    tools: 'Cline、Roo Code、Kilo Code、Continue',
    difficulty: 'Easy',
    toolIds: ['cline', 'roo-code', 'kilo-code', 'continue'],
  },
  {
    useCase: 'Switch configurations for several CLIs',
    tools: 'CC Switch',
    difficulty: 'Medium',
    toolIds: ['cc-switch'],
  },
  {
    useCase: 'Host a team chat website',
    tools: 'Open WebUI、LobeChat、NextChat',
    difficulty: 'Medium',
    toolIds: ['open-webui', 'lobechat', 'nextchat'],
  },
  {
    useCase: 'Build a knowledge base or workflow',
    tools: 'Dify、FastGPT、Flowise',
    difficulty: 'Advanced',
    toolIds: ['dify', 'fastgpt', 'flowise'],
  },
]
