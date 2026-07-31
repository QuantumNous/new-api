export interface CodeSample {
  lang: string
  code: string
}

export interface QuickStartSection {
  heading: string
  body: string
  code?: CodeSample
}

export interface QuickStartContent {
  title: string
  description: string
  intro: string
  sections: QuickStartSection[]
}

const API_BASE = 'https://api.91flow.com/v1'

export const quickstart: Record<'en' | 'zh', QuickStartContent> = {
  en: {
    title: 'Quick Start | OriginFlow',
    description:
      'Connect to Chinese and global AI models through one OpenAI-compatible API. Get your key and send your first request in minutes.',
    intro:
      'OriginFlow exposes an OpenAI-compatible API at api.91flow.com. Use your existing OpenAI SDK — just point the base URL at OriginFlow and use your OriginFlow API key.',
    sections: [
      {
        heading: '1. Get your API key',
        body: 'Sign in to the console at app.91flow.com, open "API Keys", and create a new key. Keep it secret — it carries the same privileges as your account.',
      },
      {
        heading: '2. Base URL',
        body: 'All requests go to the OpenAI-compatible endpoint below.',
        code: { lang: 'text', code: API_BASE },
      },
      {
        heading: '3. Call a model (Python)',
        body: 'Install the official OpenAI SDK and set the base URL to OriginFlow.',
        code: {
          lang: 'python',
          code: `from openai import OpenAI

client = OpenAI(
    base_url="${API_BASE}",
    api_key="YOUR_ORIGINFLOW_API_KEY",
)

resp = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello from OriginFlow!"}],
)
print(resp.choices[0].message.content)`,
        },
      },
      {
        heading: '4. Call a model (Node.js)',
        body: 'The same SDK works in Node.js with the OriginFlow base URL.',
        code: {
          lang: 'javascript',
          code: `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${API_BASE}",
  apiKey: "YOUR_ORIGINFLOW_API_KEY",
});

const resp = await client.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Hello from OriginFlow!" }],
});
console.log(resp.choices[0].message.content);`,
        },
      },
      {
        heading: '5. Raw request (curl)',
        body: 'No SDK? Any HTTP client works — here is a minimal curl example.',
        code: {
          lang: 'bash',
          code: `curl ${API_BASE}/chat/completions \\
  -H "Authorization: Bearer YOUR_ORIGINFLOW_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"Hello"}]}'`,
        },
      },
    ],
  },
  zh: {
    title: '快速开始 | 元点流商 OriginFlow',
    description:
      '通过一个兼容 OpenAI 的 API 接入中国与全球大模型。获取密钥，几分钟内发出你的第一个请求。',
    intro:
      'OriginFlow 在 api.91flow.com 提供兼容 OpenAI 的 API。复用你现有的 OpenAI SDK——只需把 base URL 指向 OriginFlow，并使用你的 OriginFlow API Key。',
    sections: [
      {
        heading: '1. 获取 API Key',
        body: '登录 app.91flow.com 控制台，进入「API Keys」创建新密钥。请妥善保管——它拥有与你账户相同的权限。',
      },
      {
        heading: '2. 接口地址（Base URL）',
        body: '所有请求都发往以下兼容 OpenAI 的端点。',
        code: { lang: 'text', code: API_BASE },
      },
      {
        heading: '3. 调用模型（Python）',
        body: '安装官方 OpenAI SDK，并将 base URL 设置为 OriginFlow。',
        code: {
          lang: 'python',
          code: `from openai import OpenAI

client = OpenAI(
    base_url="${API_BASE}",
    api_key="YOUR_ORIGINFLOW_API_KEY",
)

resp = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "你好，OriginFlow！"}],
)
print(resp.choices[0].message.content)`,
        },
      },
      {
        heading: '4. 调用模型（Node.js）',
        body: '同一个 SDK 在 Node.js 下也可用，只需更换 OriginFlow 的 base URL。',
        code: {
          lang: 'javascript',
          code: `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${API_BASE}",
  apiKey: "YOUR_ORIGINFLOW_API_KEY",
});

const resp = await client.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "你好，OriginFlow！" }],
});
console.log(resp.choices[0].message.content);`,
        },
      },
      {
        heading: '5. 原始请求（curl）',
        body: '没有 SDK？任何 HTTP 客户端都可以——下面是一个最小 curl 示例。',
        code: {
          lang: 'bash',
          code: `curl ${API_BASE}/chat/completions \\
  -H "Authorization: Bearer YOUR_ORIGINFLOW_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"你好"}]}'`,
        },
      },
    ],
  },
}
