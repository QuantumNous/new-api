/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) a later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.
*/

import { Link } from '@tanstack/react-router'

import { PublicLayout } from '@/components/layout/components/public-layout'
import { FooterCta } from '@/features/marketing/components/MarketingSections'
import { useMarketingNavLinks } from '@/features/marketing/hooks/useSiteContent'

import { DOC_TOPICS } from '../lib/docs-data'

function Section(props: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={props.id} className='mt-14'>
      <h2 className='text-2xl font-bold'>{props.title}</h2>
      <div className='mt-5'>{props.children}</div>
    </section>
  )
}

function Card(props: { title: string; desc?: string; children?: React.ReactNode }) {
  return (
    <div className='rounded-2xl border border-border/60 p-5'>
      <div className='font-semibold'>{props.title}</div>
      {props.desc && (
        <p className='text-muted-foreground mt-1 text-sm leading-relaxed'>
          {props.desc}
        </p>
      )}
      {props.children}
    </div>
  )
}

const MODEL_MATRIX: { vendor: string; models: string }[] = [
  { vendor: 'Anthropic Claude', models: 'Claude Opus 4.7 ⭐ / Opus 4.6 / Sonnet 4.6 / Sonnet 4.5 / Haiku 4.5' },
  { vendor: 'OpenAI', models: 'GPT-5.5 ⭐ / GPT-5.4 系列（5.4 / Pro / Mini / Nano）/ GPT-Image-2' },
  { vendor: 'Google Gemini', models: 'Gemini 3.5 Flash ⭐ / 3.1 Pro Preview / Flash Lite / Flash Image / 3 Pro Image' },
  { vendor: '阿里 Qwen', models: 'Qwen3.5 Plus ⭐ / Qwen3.5 Flash / Qwen3 Max / Qwen3 Coder Plus / Qwen Image Plus' },
  { vendor: '字节豆包 Seed', models: '豆包 Seed 2.0 Pro ⭐ / Code Preview / Lite / Mini' },
  { vendor: 'DeepSeek', models: 'DeepSeek V3.2 ⭐ / V3 / R1（推理）' },
  { vendor: '智谱 GLM', models: 'glm-5 ⭐ / glm-4.7（200K，编程 & 长程任务）' },
  { vendor: 'MiniMax', models: 'MiniMax M2 ⭐ / Text-01 / abab6.5s' },
  { vendor: 'Moonshot Kimi', models: 'kimi-k2.5 ⭐（原生多模态）/ Kimi K2 250905' },
]

const QUICK_LINKS: {
  title: string
  desc: string
  href?: string
  topic?: string
  external?: boolean
}[] = [
  {
    title: '联系运维团队开通',
    desc: '联系运维团队，开通账号并获取测试额度',
    topic: 'quick-start',
  },
  {
    title: '管理控制台',
    desc: '管理 API Key，查看使用统计（账单分析仅管理员可见）',
    href: 'https://myai.yoozoo.com',
    external: true,
  },
  { title: '快速开始', desc: '三步完成接入，立即开始使用 AI 模型', topic: 'quick-start' },
]

export function DocHome() {
  const navLinks = useMarketingNavLinks()
  return (
    <PublicLayout navLinks={navLinks} showAuthButtons showThemeSwitch>
      <div className='mx-auto max-w-4xl px-4 pb-10 pt-6'>
        {/* Hero */}
        <section className='pt-10 text-center'>
          <div className='mb-4 inline-flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/5 px-3 py-1.5 text-[11px] font-medium text-blue-600 dark:border-blue-400/20 dark:bg-blue-400/5 dark:text-blue-400'>
            企业级专业稳定的 AI 大模型 API 中转站，支持 60+ 热门 AI 模型
          </div>
          <h1 className='text-4xl font-bold tracking-tight'>
            欢迎使用 游族AI网关
          </h1>
          <p className='text-muted-foreground mx-auto mt-4 max-w-2xl leading-relaxed'>
            游族AI网关
            是企业级专业稳定的 AI 大模型 API 中转站，基于统一的 OpenAI API 标准，支持
            60+ 热门 AI 模型。一个令牌，即可轻松调用 OpenAI、Claude、Gemini、DeepSeek、Qwen、Kimi、GLM
            等所有主流大模型。
          </p>
          <div className='mt-7 flex flex-wrap justify-center gap-3'>
            <Link
              to='/docs/$topic'
              params={{ topic: 'quick-start' }}
              className='inline-flex h-11 items-center rounded-lg bg-foreground px-5 text-sm font-medium text-background'
            >
              快速开始
            </Link>
            <Link
              to='/docs/$topic'
              params={{ topic: 'api' }}
              className='inline-flex h-11 items-center rounded-lg border border-border/50 px-5 text-sm font-medium hover:bg-muted/50'
            >
              API 文档
            </Link>
          </div>
        </section>

        {/* 产品基础 */}
        <Section title='📖 产品基础'>
          <div className='grid gap-4 sm:grid-cols-2'>
            <Link to='/docs/$topic' params={{ topic: 'quick-start' }} className='block'>
              <Card title='快速开始' desc='三步完成接入，立即开始使用 AI 模型' />
            </Link>
            <Link to='/docs/$topic' params={{ topic: 'api' }} className='block'>
              <Card title='API 手册' desc='完整的接口文档和开发者指南' />
            </Link>
          </div>
        </Section>

        {/* 核心接口 */}
        <Section title='🔧 核心接口'>
          <div className='grid gap-4 sm:grid-cols-3'>
            <Card title='对话补全 API' desc='Chat Completions - 创建多轮对话和文本生成' />
            <Card title='图像生成 API' desc='支持文生图、图生图、上下文图文生图' />
            <Card title='模型列表 API' desc='获取所有可用模型信息' />
          </div>
        </Section>

        {/* 支持的模型 */}
        <Section title='💡 支持的模型'>
          <p className='text-muted-foreground leading-relaxed'>
            游族AI网关 已对接 <span className='font-semibold text-foreground'>60+</span>{' '}
            主流模型，一个 API Key 即可调用 Anthropic · OpenAI · Google · Qwen · 豆包 ·
            DeepSeek · GLM · MiniMax · Moonshot Kimi 等 9 大顶级厂商。
          </p>
        </Section>

        {/* 本周精选 */}
        <Section title='⭐ 本周精选'>
          <div className='grid gap-4 sm:grid-cols-3'>
            <Card title='Claude Opus 4.7' desc='Anthropic 最新旗舰，复杂代理与生产级代码首选' />
            <Card title='GPT-5.5' desc='OpenAI 最新主力，推理、文案与综合编程' />
            <Card title='Gemini 3.5 Flash' desc='高吞吐低延迟，工具调用与高并发对话' />
          </div>
        </Section>

        {/* 模型矩阵 */}
        <Section title='模型矩阵'>
          <div className='overflow-x-auto rounded-2xl border border-border/60'>
            <table className='w-full text-left text-sm'>
              <thead className='bg-muted/40 text-muted-foreground'>
                <tr>
                  <th className='px-4 py-3 font-medium'>厂商</th>
                  <th className='px-4 py-3 font-medium'>代表模型</th>
                </tr>
              </thead>
              <tbody>
                {MODEL_MATRIX.map((row) => (
                  <tr key={row.vendor} className='border-t border-border/50'>
                    <td className='px-4 py-3 font-medium'>{row.vendor}</td>
                    <td className='text-muted-foreground px-4 py-3'>{row.models}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className='text-muted-foreground mt-3 text-sm'>
            完整模型 ID、上下文长度与实时定价请访问{' '}
            <a
              href='https://myai.yoozoo.com'
              target='_blank'
              rel='noopener noreferrer'
              className='text-primary hover:underline'
            >
              游族AI网关 模型广场
            </a>
            ，详细介绍参见「支持的模型」页面。
          </p>
        </Section>

        {/* 使用场景 */}
        <Section title='🎯 使用场景'>
          <div className='grid gap-4 sm:grid-cols-3'>
            <Card title='对话型 AI' desc='Cherry Studio、Chatbox 等 AI 对话客户端' />
            <Card title='编程开发' desc='Cursor、Claude Code、Cline 等 AI 编程工具' />
            <Card title='开发框架' desc='LangChain、Dify 等 AI 应用开发框架' />
          </div>
        </Section>

        {/* 为什么选择 */}
        <Section title='🚀 为什么选择 游族AI网关？'>
          <div className='space-y-6'>
            <div>
              <h3 className='font-semibold'>一个接口，多种模型</h3>
              <p className='text-muted-foreground mt-1 text-sm leading-relaxed'>
                无需为每个 AI 服务单独申请账号和管理 API 密钥：一个账号管理所有 AI
                服务；一个 API 密钥访问所有模型；一套接口标准兼容 OpenAI API 格式。
              </p>
            </div>
            <div>
              <h3 className='font-semibold'>🔧 简单易用</h3>
              <p className='text-muted-foreground mt-1 text-sm leading-relaxed'>
                切换模型就像修改一个参数一样简单：
              </p>
              <pre className='bg-muted/40 mt-2 overflow-x-auto rounded-xl p-4 text-xs leading-relaxed'>
                <code>{`from openai import OpenAI

client = OpenAI(
    api_key="sk-xxxxxxxxxx",
    base_url="https://ai-gw-cn.uuzu.com/v1",
)

# 使用 GPT-5.5
response = client.chat.completions.create(
    model="gpt-5.5",
    messages=[{"role": "user", "content": "Hello!"}],
)

# 切换到 Claude - 只需修改模型名称
response = client.chat.completions.create(
    model="claude-sonnet-4-6",
    messages=[{"role": "user", "content": "Hello!"}],
)`}</code>
              </pre>
            </div>
            <div>
              <h3 className='font-semibold'>🛡️ 稳定可靠</h3>
              <p className='text-muted-foreground mt-1 text-sm leading-relaxed'>
                高可用性：多节点部署，智能路由；自动降级：模型不可用时自动切换；负载均衡：智能分配请求，避免限流；实时监控：24/7
                服务状态监控。
              </p>
            </div>
            <div>
              <h3 className='font-semibold'>💰 成本优化</h3>
              <p className='text-muted-foreground mt-1 text-sm leading-relaxed'>
                统一计费：所有模型使用统一余额；透明定价：清晰的价格体系；用量统计：详细的使用报告；灵活充值：支持多种支付方式。
              </p>
            </div>
          </div>
        </Section>

        {/* 开始使用 */}
        <Section title='🚀 开始使用'>
          <ol className='space-y-3'>
            {[
              '申请统一 Token：按照「快速开始」中的流程申请统一 Token。',
              '获取密钥：联系运维团队获取 API Key，或访问 https://myai.yoozoo.com 在左下角个人信息中查看。',
              '接入使用：查看「API 文档」开始集成。',
            ].map((step, i) => (
              <li
                key={i}
                className='rounded-xl border border-border/50 p-4 text-sm leading-relaxed'
              >
                <span className='mr-2 font-semibold'>{i + 1}.</span>
                {step}
              </li>
            ))}
          </ol>
        </Section>

        {/* 快速链接 */}
        <Section title='🔗 快速链接'>
          <div className='grid gap-4 sm:grid-cols-3'>
            {QUICK_LINKS.map((link) =>
              link.external ? (
                <a
                  key={link.title}
                  href={link.href}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='block'
                >
                  <Card title={link.title} desc={link.desc} />
                </a>
              ) : link.topic ? (
                <Link
                  key={link.title}
                  to='/docs/$topic'
                  params={{ topic: link.topic }}
                  className='block'
                >
                  <Card title={link.title} desc={link.desc} />
                </Link>
              ) : (
                <Link key={link.title} to={link.href ?? '/docs'} className='block'>
                  <Card title={link.title} desc={link.desc} />
                </Link>
              )
            )}
          </div>
        </Section>

        {/* 更多文档 */}
        <Section title='更多文档'>
          <div className='grid gap-4 sm:grid-cols-2 md:grid-cols-3'>
            {DOC_TOPICS.map((topic) => (
              <Link
                key={topic.slug}
                to='/docs/$topic'
                params={{ topic: topic.slug }}
                className='block rounded-2xl border border-border/60 p-5 transition-colors hover:border-border hover:bg-muted/50'
              >
                <div className='font-semibold'>{topic.title}</div>
                <p className='text-muted-foreground mt-1 text-sm'>{topic.summary}</p>
              </Link>
            ))}
          </div>
        </Section>
      </div>
      <FooterCta />
    </PublicLayout>
  )
}
