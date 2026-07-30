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
import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  BookOpen,
  Braces,
  Check,
  ChevronRight,
  Copy,
  KeyRound,
  Menu,
  Server,
  ShieldCheck,
  X,
} from 'lucide-react'
import { useState } from 'react'

import { PublicLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'

const sections = [
  { id: 'quick-start', title: '快速开始', icon: ArrowRight },
  { id: 'authentication', title: '身份认证', icon: KeyRound },
  { id: 'chat-completions', title: '对话补全', icon: Braces },
  { id: 'streaming', title: '流式输出', icon: Server },
  { id: 'models-and-channels', title: '模型与渠道', icon: ShieldCheck },
  { id: 'errors-and-limits', title: '错误与限额', icon: Check },
] as const

function CodeBlock(props: { children: string; language?: string }) {
  const [copied, setCopied] = useState(false)

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(props.children)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className='border-border/60 bg-muted/30 relative overflow-hidden rounded-xl border'>
      <div className='border-border/50 text-muted-foreground flex items-center justify-between border-b px-4 py-2 text-[11px] uppercase tracking-wider'>
        <span>{props.language ?? 'bash'}</span>
        <button
          type='button'
          onClick={copyCode}
          className='hover:text-foreground inline-flex items-center gap-1.5 transition-colors'
          aria-label={copied ? '已复制' : '复制代码'}
        >
          {copied ? <Check className='size-3.5' /> : <Copy className='size-3.5' />}
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      <pre className='overflow-x-auto p-4 text-[13px] leading-6'><code>{props.children}</code></pre>
    </div>
  )
}

function SectionHeading(props: { eyebrow: string; title: string; id: string }) {
  return (
    <div id={props.id} className='scroll-mt-24'>
      <p className='text-primary mb-2 text-xs font-semibold tracking-[0.18em] uppercase'>
        {props.eyebrow}
      </p>
      <h2 className='text-2xl font-semibold tracking-tight md:text-3xl'>{props.title}</h2>
    </div>
  )
}

export function DocsPage() {
  const [mobileOpen, setMobileOpen] = useState(false)

  const navigation = (
    <nav aria-label='文档导航' className='space-y-1'>
      {sections.map((section) => {
        const Icon = section.icon
        return (
          <a
            key={section.id}
            href={`#${section.id}`}
            onClick={() => setMobileOpen(false)}
            className='text-muted-foreground hover:text-foreground hover:bg-muted/60 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors'
          >
            <Icon className='size-4 shrink-0' />
            {section.title}
            <ChevronRight className='ml-auto size-3.5 opacity-40' />
          </a>
        )
      })}
    </nav>
  )

  return (
    <PublicLayout showMainContainer={false}>
      <div className='border-border/50 bg-background/95 min-h-svh border-b pt-16'>
        <div className='mx-auto flex max-w-7xl gap-8 px-4 py-8 md:px-6 lg:py-12'>
          <aside className='hidden w-56 shrink-0 lg:block'>
            <div className='sticky top-24'>
              <div className='mb-4 flex items-center gap-2 px-3 text-sm font-semibold'>
                <BookOpen className='text-primary size-4' />
                ReX API 文档
              </div>
              {navigation}
            </div>
          </aside>

          <div className='min-w-0 flex-1'>
            <div className='mb-8 flex items-start justify-between gap-4 lg:hidden'>
              <div>
                <p className='text-primary text-xs font-semibold tracking-[0.18em] uppercase'>ReX API</p>
                <h1 className='mt-2 text-3xl font-bold tracking-tight'>文档</h1>
              </div>
              <Button
                variant='outline'
                size='icon'
                aria-label='打开文档导航'
                onClick={() => setMobileOpen((open) => !open)}
              >
                {mobileOpen ? <X className='size-4' /> : <Menu className='size-4' />}
              </Button>
            </div>

            {mobileOpen && (
              <div className='border-border/60 bg-muted/20 mb-8 rounded-xl border p-3 lg:hidden'>
                {navigation}
              </div>
            )}

            <header className='border-border/60 from-primary/10 mb-12 rounded-2xl border bg-gradient-to-br via-transparent to-violet-500/10 p-6 md:p-10'>
              <p className='text-primary text-xs font-semibold tracking-[0.2em] uppercase'>ReX API</p>
              <h1 className='mt-3 max-w-3xl text-3xl font-bold tracking-tight md:text-5xl'>
                统一 AI 网关，兼容 OpenAI 接口协议
              </h1>
              <p className='text-muted-foreground mt-4 max-w-2xl text-base leading-7'>
                通过 ReX API 统一路由模型请求，管理 API 密钥和上游渠道，并在一个自托管控制台中监控所有使用情况。
              </p>
              <div className='mt-6 flex flex-wrap gap-3'>
                <Button render={<a href='#quick-start' />}>
                  开始使用
                  <ArrowRight className='ml-1.5 size-4' />
                </Button>
                <Button variant='outline' render={<Link to='/dashboard' />}>
                  进入控制台
                </Button>
              </div>
            </header>

            <main className='space-y-16'>
              <section className='space-y-5'>
                <SectionHeading id='quick-start' eyebrow='01' title='快速开始' />
                <p className='text-muted-foreground leading-7'>
                  只需将 OpenAI SDK 的 <code className='bg-muted rounded px-1.5 py-0.5 text-sm font-mono'>base_url</code> 指向你的 ReX API 网关地址，并使用在控制台创建的 API 密钥，即可立刻开始调用。
                </p>
                <CodeBlock language='bash'>{`export REX_API_KEY="sk-your-key"

curl https://your-rex-api.example.com/v1/chat/completions \\
  -H "Authorization: Bearer $REX_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "your-model",
    "messages": [{"role": "user", "content": "你好"}]
  }'`}</CodeBlock>
                <CodeBlock language='python'>{`from openai import OpenAI

client = OpenAI(
    api_key="sk-your-key",
    base_url="https://your-rex-api.example.com/v1",
)

response = client.chat.completions.create(
    model="your-model",
    messages=[{"role": "user", "content": "你好"}],
)
print(response.choices[0].message.content)`}</CodeBlock>
              </section>

              <section className='space-y-5'>
                <SectionHeading id='authentication' eyebrow='02' title='身份认证' />
                <p className='text-muted-foreground leading-7'>
                  所有请求均需在 <code className='bg-muted rounded px-1.5 py-0.5 text-sm font-mono'>Authorization</code> 请求头中携带 Bearer Token。前往
                  <Link to='/keys' className='text-primary mx-1 hover:underline'>API 密钥</Link>
                  页面创建和管理你的密钥。
                </p>
                <CodeBlock language='bash'>{`# 在所有请求中添加以下请求头
Authorization: Bearer sk-your-key`}</CodeBlock>
                <div className='rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm'>
                  <strong>注意：</strong>请妥善保管你的 API 密钥，不要将其提交到代码仓库或暴露在客户端代码中。如需轮换密钥，在控制台删除旧密钥并重新创建即可。
                </div>
              </section>

              <section className='space-y-5'>
                <SectionHeading id='chat-completions' eyebrow='03' title='对话补全' />
                <p className='text-muted-foreground leading-7'>
                  ReX API 完全兼容 OpenAI Chat Completions 接口格式。将 <code className='bg-muted rounded px-1.5 py-0.5 text-sm font-mono'>model</code> 参数设置为你在渠道中配置的模型名称即可。
                </p>
                <CodeBlock language='json'>{`{
  "model": "gpt-4o",
  "messages": [
    {"role": "system", "content": "你是一个有帮助的助手。"},
    {"role": "user", "content": "解释一下量子计算"}
  ],
  "temperature": 0.7,
  "max_tokens": 1024
}`}</CodeBlock>
              </section>

              <section className='space-y-5'>
                <SectionHeading id='streaming' eyebrow='04' title='流式输出' />
                <p className='text-muted-foreground leading-7'>
                  在请求体中添加 <code className='bg-muted rounded px-1.5 py-0.5 text-sm font-mono'>"stream": true</code> 即可开启流式输出。ReX API 会以 Server-Sent Events（SSE）格式逐块返回内容，适用于实时对话场景。
                </p>
                <CodeBlock language='python'>{`stream = client.chat.completions.create(
    model="your-model",
    messages=[{"role": "user", "content": "写一首关于春天的诗"}],
    stream=True,
)

for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="", flush=True)`}</CodeBlock>
              </section>

              <section className='space-y-5'>
                <SectionHeading id='models-and-channels' eyebrow='05' title='模型与渠道' />
                <p className='text-muted-foreground leading-7'>
                  管理员在控制台中配置上游渠道和模型元数据。在向客户端下发模型名称之前，请在以下页面确认路由、定价、可用性与访问权限配置。
                </p>
                <div className='grid gap-3 sm:grid-cols-2'>
                  {[
                    ['渠道', '连接并管理上游 AI 服务提供商。'],
                    ['模型', '定义模型名称、定价和路由规则。'],
                    ['API 密钥', '为应用程序签发范围限定的凭据。'],
                    ['使用日志', '查看请求记录、配额和用量统计。'],
                  ].map(([title, description]) => (
                    <div key={title} className='border-border/60 bg-card rounded-xl border p-4'>
                      <h3 className='font-medium'>{title}</h3>
                      <p className='text-muted-foreground mt-1 text-sm leading-6'>{description}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className='space-y-5'>
                <SectionHeading id='errors-and-limits' eyebrow='06' title='错误与限额' />
                <p className='text-muted-foreground leading-7'>
                  请求失败时，优先检查 HTTP 状态码和 JSON 错误体。认证错误、权限不足、配额超限、上游故障和参数校验失败需要不同的处理方式；ReX API 的请求日志和使用日志页面提供完整的诊断上下文。
                </p>
                <CodeBlock language='json'>{`{
  "error": {
    "message": "可读的错误描述信息",
    "type": "错误类型",
    "code": "错误代码"
  }
}`}</CodeBlock>
                <div className='grid gap-3 sm:grid-cols-3'>
                  {[
                    ['401', '认证失败', 'API 密钥无效或已过期'],
                    ['403', '权限不足', '密钥无权访问该模型'],
                    ['429', '请求过频', '已触发速率限制，请稍后重试'],
                  ].map(([code, title, desc]) => (
                    <div key={code} className='border-border/60 bg-card rounded-xl border p-4'>
                      <code className='text-primary text-sm font-mono font-bold'>{code}</code>
                      <p className='mt-1 text-sm font-medium'>{title}</p>
                      <p className='text-muted-foreground mt-0.5 text-xs leading-5'>{desc}</p>
                    </div>
                  ))}
                </div>
              </section>
            </main>
          </div>
        </div>
      </div>
    </PublicLayout>
  )
}
