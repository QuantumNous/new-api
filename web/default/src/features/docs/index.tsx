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
import { useMemo, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { copyToClipboard } from '@/lib/copy-to-clipboard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PublicLayout } from '@/components/layout'

type Provider = 'OpenAI' | 'Anthropic' | 'Google'

type EndpointDoc = {
  id: string
  provider: Provider
  title: string
  description: string
  method: 'POST'
  baseUrl: string
  path: string
  authHeader: string
  parameters: Array<{
    name: string
    type: string
    required?: boolean
    description: string
  }>
  curl: string
  response: string
  notes?: string[]
}

const providerBaseUrls: Record<Provider, string> = {
  OpenAI: 'https://tokenfun.ai/openai',
  Anthropic: 'https://tokenfun.ai/anthropic',
  Google: 'https://tokenfun.ai/google',
}

const providerAuthHeaders: Record<Provider, string> = {
  OpenAI: 'Authorization: Bearer sk-pat-您的AccessToken',
  Anthropic: 'x-api-key: sk-pat-您的AccessToken',
  Google: 'x-goog-api-key: sk-pat-您的AccessToken',
}

const endpoints: EndpointDoc[] = [
  {
    id: 'openai-chat',
    provider: 'OpenAI',
    title: 'OpenAI Chat Completions',
    description:
      '使用 OpenAI Chat Completions 格式发起多轮对话，支持流式输出、工具调用和多模态消息。',
    method: 'POST',
    baseUrl: providerBaseUrls.OpenAI,
    path: '/v1/chat/completions',
    authHeader: providerAuthHeaders.OpenAI,
    parameters: [
      {
        name: 'model',
        type: 'string',
        required: true,
        description: '要调用的模型名称，使用模型广场或控制台中配置的模型 ID。',
      },
      {
        name: 'messages',
        type: 'array',
        required: true,
        description:
          '对话消息数组，按 OpenAI 规范传入 system、user、assistant 等角色。',
      },
      {
        name: 'stream',
        type: 'boolean',
        description: '设置为 true 时按 SSE 流式返回。',
      },
    ],
    curl: `curl https://tokenfun.ai/openai/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer sk-pat-您的AccessToken" \\
  -d '{
    "model": "gpt-4o-mini",
    "messages": [
      {
        "role": "user",
        "content": "你好，请用一句话介绍 TokenFun"
      }
    ]
  }'`,
    response: `{
  "id": "chatcmpl-example",
  "object": "chat.completion",
  "model": "gpt-4o-mini",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "TokenFun 提供统一的 AI 模型接口与访问管理。"
      },
      "finish_reason": "stop"
    }
  ]
}`,
  },
  {
    id: 'openai-responses',
    provider: 'OpenAI',
    title: 'OpenAI Responses',
    description:
      '使用 Responses 格式统一处理文本、结构化输入、工具和多模态场景。',
    method: 'POST',
    baseUrl: providerBaseUrls.OpenAI,
    path: '/v1/responses',
    authHeader: providerAuthHeaders.OpenAI,
    parameters: [
      {
        name: 'model',
        type: 'string',
        required: true,
        description: '要调用的模型名称。',
      },
      {
        name: 'input',
        type: 'string | array',
        required: true,
        description: '输入内容，可以是简单文本，也可以是结构化消息数组。',
      },
      {
        name: 'stream',
        type: 'boolean',
        description: '设置为 true 时按流式事件返回。',
      },
    ],
    curl: `curl https://tokenfun.ai/openai/v1/responses \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer sk-pat-您的AccessToken" \\
  -d '{
    "model": "gpt-4.1-mini",
    "input": "用一句话说明统一网关的作用"
  }'`,
    response: `{
  "id": "resp_example",
  "object": "response",
  "model": "gpt-4.1-mini",
  "output_text": "统一网关可以用同一套鉴权与计费逻辑访问多个模型。"
}`,
  },
  {
    id: 'openai-image-generation',
    provider: 'OpenAI',
    title: 'OpenAI Image Generation',
    description: '根据提示词生成图片，接口格式与 OpenAI Images API 保持一致。',
    method: 'POST',
    baseUrl: providerBaseUrls.OpenAI,
    path: '/v1/images/generations',
    authHeader: providerAuthHeaders.OpenAI,
    parameters: [
      {
        name: 'model',
        type: 'string',
        required: true,
        description: '图像生成模型名称。',
      },
      {
        name: 'prompt',
        type: 'string',
        required: true,
        description: '图片生成提示词。',
      },
      {
        name: 'size',
        type: 'string',
        description: '图片尺寸，例如 1024x1024。',
      },
    ],
    curl: `curl https://tokenfun.ai/openai/v1/images/generations \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer sk-pat-您的AccessToken" \\
  -d '{
    "model": "gpt-image-1",
    "prompt": "一张极简风格的 AI API 网关插画",
    "size": "1024x1024"
  }'`,
    response: `{
  "created": 1700000000,
  "data": [
    {
      "url": "https://example.com/generated-image.png"
    }
  ]
}`,
  },
  {
    id: 'openai-image-edit',
    provider: 'OpenAI',
    title: 'OpenAI Image Edit',
    description:
      '上传图片并按提示词进行编辑，适合改背景、补全、风格调整等场景。',
    method: 'POST',
    baseUrl: providerBaseUrls.OpenAI,
    path: '/v1/images/edits',
    authHeader: providerAuthHeaders.OpenAI,
    parameters: [
      {
        name: 'image',
        type: 'file',
        required: true,
        description: '要编辑的原图文件。',
      },
      {
        name: 'prompt',
        type: 'string',
        required: true,
        description: '编辑指令。',
      },
      {
        name: 'model',
        type: 'string',
        description: '图像编辑模型名称。',
      },
    ],
    curl: `curl https://tokenfun.ai/openai/v1/images/edits \\
  -H "Authorization: Bearer sk-pat-您的AccessToken" \\
  -F "model=gpt-image-1" \\
  -F "image=@input.png" \\
  -F "prompt=把背景改成纯白色，保留主体"`,
    response: `{
  "created": 1700000000,
  "data": [
    {
      "url": "https://example.com/edited-image.png"
    }
  ]
}`,
  },
  {
    id: 'anthropic-messages',
    provider: 'Anthropic',
    title: 'Anthropic Messages',
    description: '使用 Anthropic Messages 格式调用 Claude 系列模型。',
    method: 'POST',
    baseUrl: providerBaseUrls.Anthropic,
    path: '/v1/messages',
    authHeader: providerAuthHeaders.Anthropic,
    parameters: [
      {
        name: 'model',
        type: 'string',
        required: true,
        description: 'Claude 模型名称。',
      },
      {
        name: 'max_tokens',
        type: 'number',
        required: true,
        description: '最多生成 token 数。',
      },
      {
        name: 'messages',
        type: 'array',
        required: true,
        description: 'Anthropic Messages 消息数组。',
      },
    ],
    curl: `curl https://tokenfun.ai/anthropic/v1/messages \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: sk-pat-您的AccessToken" \\
  -H "anthropic-version: 2023-06-01" \\
  -d '{
    "model": "claude-3-5-sonnet-latest",
    "max_tokens": 1024,
    "messages": [
      {
        "role": "user",
        "content": "你好，请用一句话介绍 Claude"
      }
    ]
  }'`,
    response: `{
  "id": "msg_example",
  "type": "message",
  "role": "assistant",
  "model": "claude-3-5-sonnet-latest",
  "content": [
    {
      "type": "text",
      "text": "Claude 是 Anthropic 开发的对话式 AI 模型系列。"
    }
  ],
  "stop_reason": "end_turn"
}`,
    notes: ['Anthropic 通道使用 x-api-key 传递本站访问令牌。'],
  },
  {
    id: 'google-generate-content',
    provider: 'Google',
    title: 'Google Gemini Generate Content',
    description: '使用 Gemini generateContent 格式发起内容生成请求。',
    method: 'POST',
    baseUrl: providerBaseUrls.Google,
    path: '/v1beta/models/{model}:generateContent',
    authHeader: providerAuthHeaders.Google,
    parameters: [
      {
        name: 'model',
        type: 'path string',
        required: true,
        description: '路径中的 Gemini 模型名称。',
      },
      {
        name: 'contents',
        type: 'array',
        required: true,
        description: 'Gemini content 数组，parts 中放文本或多模态内容。',
      },
      {
        name: 'generationConfig',
        type: 'object',
        description: '温度、最大输出等生成参数。',
      },
    ],
    curl: `curl https://tokenfun.ai/google/v1beta/models/gemini-2.0-flash:generateContent \\
  -H "Content-Type: application/json" \\
  -H "x-goog-api-key: sk-pat-您的AccessToken" \\
  -d '{
    "contents": [
      {
        "parts": [
          {
            "text": "你好，请用一句话介绍 Gemini"
          }
        ]
      }
    ]
  }'`,
    response: `{
  "candidates": [
    {
      "content": {
        "parts": [
          {
            "text": "Gemini 是 Google 推出的多模态 AI 模型系列。"
          }
        ],
        "role": "model"
      },
      "finishReason": "STOP"
    }
  ]
}`,
    notes: ['Google 通道使用 x-goog-api-key 传递本站访问令牌。'],
  },
]

const providers: Provider[] = ['OpenAI', 'Anthropic', 'Google']

type CodeBlockProps = {
  value: string
  label: string
}

function CodeBlock(props: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await copyToClipboard(props.value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <div className='border-border bg-card overflow-hidden rounded-lg border shadow-sm'>
      <div className='border-border bg-muted/40 flex items-center justify-between border-b px-4 py-2.5'>
        <span className='text-muted-foreground text-xs font-semibold tracking-wide uppercase'>
          {props.label}
        </span>
        <Button
          type='button'
          variant='ghost'
          size='icon-sm'
          onClick={copy}
          aria-label='复制代码'
        >
          {copied ? <Check className='size-4' /> : <Copy className='size-4' />}
        </Button>
      </div>
      <pre className='max-h-[28rem] overflow-auto p-4 text-[13px] leading-6'>
        <code>{props.value}</code>
      </pre>
    </div>
  )
}

function CopyValue(props: { value: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await copyToClipboard(props.value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <div className='flex min-w-0 items-center gap-2'>
      <code className='bg-muted min-w-0 rounded-md px-2 py-1 font-mono text-sm break-all'>
        {props.value}
      </code>
      <Button
        type='button'
        variant='ghost'
        size='icon-sm'
        onClick={copy}
        aria-label='复制'
      >
        {copied ? <Check className='size-4' /> : <Copy className='size-4' />}
      </Button>
    </div>
  )
}

function MethodBadge(props: { method: EndpointDoc['method'] }) {
  return (
    <Badge className='h-6 rounded-md bg-blue-600 px-2 font-mono text-[11px] text-white hover:bg-blue-600'>
      {props.method}
    </Badge>
  )
}

function GuideSection() {
  return (
    <section id='getting-started' className='scroll-mt-24'>
      <div className='border-border bg-card rounded-lg border p-6 shadow-sm md:p-8'>
        <div className='max-w-3xl'>
          <p className='text-primary text-sm font-semibold'>入门</p>
          <h1 className='mt-2 text-3xl font-semibold tracking-tight md:text-4xl'>
            TokenFun API Doc
          </h1>
          <p className='text-muted-foreground mt-4 leading-7'>
            这里整理了 OpenAI、Anthropic、Google 三类原生 Relay Mode
            API。你只需要使用本站创建的 Access
            Token，就能按各供应商官方请求格式调用模型。
          </p>
        </div>

        <div className='border-border mt-8 overflow-hidden rounded-lg border'>
          {providers.map((provider) => (
            <div
              key={provider}
              className='border-border grid gap-3 border-b p-4 last:border-b-0 md:grid-cols-[10rem_1fr]'
            >
              <div className='font-semibold'>{provider}</div>
              <CopyValue value={providerBaseUrls[provider]} />
            </div>
          ))}
        </div>

        <div className='border-primary/30 bg-primary/5 mt-6 rounded-lg border px-4 py-3'>
          <p className='text-sm leading-6'>
            Relay Mode API 保留 OpenAI、Anthropic、Google 的原生请求路径和
            Header 命名。迁移现有 SDK 时，通常只需要替换 base URL 与密钥即可。
          </p>
        </div>
      </div>
    </section>
  )
}

function AuthSection() {
  return (
    <section id='authentication' className='scroll-mt-24'>
      <div className='border-border bg-card rounded-lg border p-6 shadow-sm md:p-8'>
        <div className='max-w-3xl'>
          <p className='text-primary text-sm font-semibold'>入门</p>
          <h2 className='mt-2 text-2xl font-semibold tracking-tight md:text-3xl'>
            认证方式
          </h2>
          <p className='text-muted-foreground mt-3 leading-7'>
            不同供应商的鉴权 Header 名称不同，但 Header 的值都使用本站生成的
            Access Token。
          </p>
        </div>

        <div className='border-border mt-6 overflow-hidden rounded-lg border'>
          {providers.map((provider) => (
            <div
              key={provider}
              className='border-border grid gap-3 border-b p-4 last:border-b-0 md:grid-cols-[10rem_1fr]'
            >
              <div className='font-semibold'>{provider}</div>
              <CopyValue value={providerAuthHeaders[provider]} />
            </div>
          ))}
        </div>

        <div className='mt-6 rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-amber-950 dark:bg-amber-950/20 dark:text-amber-200'>
          <p className='text-sm leading-6'>
            最容易踩坑的是 Header 名称：OpenAI 用 Authorization，Anthropic 用
            x-api-key，Google 用 x-goog-api-key。
          </p>
        </div>
      </div>
    </section>
  )
}

function EndpointSection(props: { doc: EndpointDoc }) {
  return (
    <section id={props.doc.id} className='scroll-mt-24'>
      <div className='border-border bg-card rounded-lg border p-6 shadow-sm md:p-8'>
        <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
          <div className='min-w-0'>
            <p className='text-primary text-sm font-semibold'>
              {props.doc.provider}
            </p>
            <h2 className='mt-2 text-2xl font-semibold tracking-tight'>
              {props.doc.title}
            </h2>
            <p className='text-muted-foreground mt-3 max-w-3xl leading-7'>
              {props.doc.description}
            </p>
          </div>
          <div className='flex shrink-0 flex-wrap items-center gap-2'>
            <MethodBadge method={props.doc.method} />
            <code className='bg-muted rounded-md px-2 py-1 font-mono text-sm break-all'>
              {props.doc.path}
            </code>
          </div>
        </div>

        <div className='mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(24rem,0.95fr)]'>
          <div className='space-y-6'>
            <div className='grid gap-4 md:grid-cols-2'>
              <div>
                <h3 className='text-sm font-semibold'>Base URL</h3>
                <div className='border-border mt-2 rounded-lg border px-3 py-2.5'>
                  <CopyValue value={props.doc.baseUrl} />
                </div>
              </div>
              <div>
                <h3 className='text-sm font-semibold'>鉴权 Header</h3>
                <div className='border-border mt-2 rounded-lg border px-3 py-2.5'>
                  <CopyValue value={props.doc.authHeader} />
                </div>
              </div>
            </div>

            <div>
              <h3 className='text-sm font-semibold'>参数</h3>
              <div className='border-border mt-2 overflow-hidden rounded-lg border'>
                {props.doc.parameters.map((parameter) => (
                  <div
                    key={parameter.name}
                    className='border-border grid gap-3 border-b p-4 last:border-b-0 md:grid-cols-[12rem_1fr]'
                  >
                    <div>
                      <div className='font-mono text-sm font-semibold'>
                        {parameter.name}
                      </div>
                      <div className='text-muted-foreground mt-1 text-xs'>
                        {parameter.type}
                        {parameter.required ? ' required' : ''}
                      </div>
                    </div>
                    <p className='text-muted-foreground text-sm leading-6'>
                      {parameter.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {props.doc.notes?.map((note) => (
              <div
                key={note}
                className='border-primary/30 bg-primary/5 rounded-lg border px-4 py-3'
              >
                <p className='text-sm leading-6'>{note}</p>
              </div>
            ))}
          </div>

          <div className='space-y-4 xl:sticky xl:top-24 xl:self-start'>
            <CodeBlock value={props.doc.curl} label='cURL' />
            <CodeBlock value={props.doc.response} label='响应示例' />
          </div>
        </div>
      </div>
    </section>
  )
}

export function Docs() {
  const groupedEndpoints = useMemo(() => {
    return providers.map((provider) => ({
      provider,
      items: endpoints.filter((endpoint) => endpoint.provider === provider),
    }))
  }, [])

  return (
    <PublicLayout showMainContainer={false}>
      <main className='mx-auto min-h-screen w-full max-w-7xl px-4 pt-24 pb-16 md:px-6'>
        <div className='grid gap-8 lg:grid-cols-[15rem_1fr]'>
          <aside className='hidden lg:block'>
            <nav className='sticky top-24 space-y-7'>
              <div>
                <div className='text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase'>
                  入门
                </div>
                <div className='space-y-1'>
                  <a
                    href='#authentication'
                    className='text-muted-foreground hover:bg-muted hover:text-foreground block rounded-md px-2 py-1.5 text-sm transition-colors'
                  >
                    认证方式
                  </a>
                </div>
              </div>

              {groupedEndpoints.map((group) => (
                <div key={group.provider}>
                  <div className='text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase'>
                    {group.provider}
                  </div>
                  <div className='space-y-1'>
                    {group.items.map((doc) => (
                      <a
                        key={doc.id}
                        href={`#${doc.id}`}
                        className='text-muted-foreground hover:bg-muted hover:text-foreground block rounded-md px-2 py-1.5 text-sm transition-colors'
                      >
                        <span className='mr-2 rounded bg-blue-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300'>
                          {doc.method}
                        </span>
                        {doc.title.replace(`${doc.provider} `, '')}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </aside>

          <div className='min-w-0 space-y-6'>
            <GuideSection />
            <AuthSection />
            {endpoints.map((doc) => (
              <EndpointSection key={doc.id} doc={doc} />
            ))}
          </div>
        </div>
      </main>
    </PublicLayout>
  )
}
