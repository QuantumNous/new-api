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
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Copy,
  ExternalLink,
  KeyRound,
  MonitorCheck,
  PackageCheck,
  Rocket,
  ServerCog,
  Settings2,
  Terminal,
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { copyToClipboard } from '@/lib/copy-to-clipboard'
import { cn } from '@/lib/utils'

const apiBaseUrl = 'https://api.kabuai.cn/v1'
const defaultModel = 'gpt-5.6-sol'

const openClawCommands = {
  prerequisites: `node --version\nnpm --version`,
  install: `npm install -g openclaw@latest\nopenclaw --version`,
  interactiveOnboarding: `openclaw onboard --install-daemon`,
  automatedOnboarding: `export KABUAI_API_KEY="YOUR_API_KEY"\n\nopenclaw onboard \\\n  --non-interactive \\\n  --accept-risk \\\n  --mode local \\\n  --auth-choice custom-api-key \\\n  --custom-provider-id kabuai \\\n  --custom-base-url https://api.kabuai.cn/v1 \\\n  --custom-model-id gpt-5.6-sol \\\n  --custom-api-key "$KABUAI_API_KEY" \\\n  --custom-compatibility openai \\\n  --custom-text-input \\\n  --gateway-bind loopback \\\n  --gateway-auth token \\\n  --gateway-token CHANGE_ME \\\n  --install-daemon`,
  validate: `openclaw config validate\nopenclaw config get models.providers.kabuai\nopenclaw config get agents.defaults.model.primary`,
  gateway: `openclaw gateway start\nopenclaw gateway status\nopenclaw gateway call health`,
  foregroundGateway: `openclaw gateway run --port 18789 --bind loopback`,
  dashboard: `openclaw dashboard`,
}

const guideLinks = [
  ['openclaw', 'OpenClaw'],
  ['cc-switch', 'CC Switch'],
  ['other-clients', '其他客户端'],
  ['troubleshooting', '故障排查'],
] as const

function CommandBlock({ command, label }: { command: string; label: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const success = await copyToClipboard(command)
    if (!success) return
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  return (
    <div className='overflow-hidden rounded-xl border border-slate-800 bg-slate-950 text-slate-100 shadow-sm'>
      <div className='flex items-center justify-between border-b border-slate-800 px-4 py-2.5'>
        <div className='flex items-center gap-2 text-xs text-slate-400'>
          <Terminal className='size-3.5' />
          <span>{label}</span>
        </div>
        <Button
          type='button'
          variant='ghost'
          size='sm'
          className='h-7 text-slate-300 hover:bg-slate-800 hover:text-white'
          onClick={handleCopy}
        >
          {copied ? (
            <Check className='size-3.5' />
          ) : (
            <Copy className='size-3.5' />
          )}
          {copied ? t('Copied') : t('Copy')}
        </Button>
      </div>
      <pre className='overflow-x-auto p-4 text-[13px] leading-6'>
        <code>{command}</code>
      </pre>
    </div>
  )
}

function StepCard({
  number,
  title,
  description,
  icon,
  children,
}: {
  number: number
  title: string
  description: string
  icon: ReactNode
  children?: ReactNode
}) {
  const elementRef = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        setVisible(true)
        observer.disconnect()
      },
      { threshold: 0.08 }
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <article
      ref={elementRef}
      className={cn(
        'border-border/80 bg-card rounded-2xl border p-4 shadow-sm transition-all duration-500 md:p-6',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      )}
    >
      <div className='flex gap-4'>
        <div className='bg-primary text-primary-foreground flex size-11 shrink-0 items-center justify-center rounded-xl text-base font-bold'>
          {number}
        </div>
        <div className='min-w-0 flex-1'>
          <div className='flex items-center gap-2'>
            <span className='text-muted-foreground'>{icon}</span>
            <h3 className='text-lg font-semibold'>{title}</h3>
          </div>
          <p className='text-muted-foreground mt-1 text-sm leading-6'>
            {description}
          </p>
          {children && <div className='mt-4 space-y-4'>{children}</div>}
        </div>
      </div>
    </article>
  )
}

function Screenshot({ src, alt }: { src: string; alt: string }) {
  return (
    <div className='bg-muted/30 overflow-hidden rounded-xl border p-1.5'>
      <img
        src={src}
        alt={alt}
        loading='lazy'
        className='h-auto w-full rounded-lg'
      />
    </div>
  )
}

function ApiParameters() {
  const { t } = useTranslation()
  const parameters = [
    ['API Base URL', apiBaseUrl],
    ['API Key', 'YOUR_API_KEY'],
    ['默认模型', defaultModel],
  ]

  return (
    <Card className='gap-0 py-0'>
      <CardContent className='grid gap-0 p-0 md:grid-cols-3'>
        {parameters.map(([label, value], index) => (
          <div
            key={label}
            className={cn(
              'p-4 md:p-5',
              index > 0 && 'border-t md:border-t-0 md:border-l'
            )}
          >
            <span className='text-muted-foreground text-xs font-semibold tracking-wide uppercase'>
              {label}
            </span>
            <div className='mt-2 flex items-center justify-between gap-2'>
              <code className='text-primary truncate text-sm'>{value}</code>
              <Button
                type='button'
                variant='outline'
                size='icon-sm'
                aria-label={`${t('Copy')} ${label}`}
                onClick={() => void copyToClipboard(value)}
              >
                <Copy />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function OpenClawGuide() {
  return (
    <section id='openclaw' className='scroll-mt-24 space-y-5'>
      <div>
        <div className='flex items-center gap-3'>
          <div className='grid size-11 place-items-center rounded-xl bg-red-500/10 font-bold text-red-500'>
            OC
          </div>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>
              OpenClaw 完整接入流程
            </h2>
            <p className='text-muted-foreground mt-1'>
              以下流程已在隔离环境中真实安装、配置、启动和验证。
            </p>
          </div>
        </div>
        <div className='mt-4 flex flex-wrap gap-2'>
          <Badge variant='secondary'>OpenClaw 2026.7.1-2</Badge>
          <Badge variant='secondary'>Node.js 24.15.0</Badge>
          <Badge variant='secondary'>Gateway health: ok</Badge>
          <Badge variant='secondary'>模型：{defaultModel}</Badge>
        </div>
      </div>

      <div className='space-y-4'>
        <StepCard
          number={1}
          title='确认 Node.js 版本'
          description='OpenClaw 当前版本要求 Node.js 22.22.3+、24.15+ 或 25.9+。推荐使用 Node.js 24，先确认版本再安装。'
          icon={<PackageCheck className='size-4' />}
        >
          <CommandBlock
            command={openClawCommands.prerequisites}
            label='检查运行环境'
          />
        </StepCard>

        <StepCard
          number={2}
          title='全局安装 OpenClaw'
          description='执行官方 npm 安装命令，然后输出版本号确认 CLI 已可用。'
          icon={<Terminal className='size-4' />}
        >
          <CommandBlock
            command={openClawCommands.install}
            label='安装与版本验证'
          />
          <Screenshot
            src='/agent-docs/openclaw-install.png'
            alt='真实执行 npm install -g openclaw@latest 的终端截图'
          />
        </StepCard>

        <StepCard
          number={3}
          title='运行首次引导'
          description='普通用户推荐使用交互式向导，它会依次配置模型供应商、API Key、Gateway、工作区、渠道和技能。'
          icon={<Settings2 className='size-4' />}
        >
          <CommandBlock
            command={openClawCommands.interactiveOnboarding}
            label='推荐：交互式完整向导'
          />
          <p className='text-muted-foreground text-sm'>
            在模型供应商步骤选择 Custom API Key，Base URL 填写{' '}
            <code>{apiBaseUrl}</code>，模型填写 <code>{defaultModel}</code>
            ，兼容协议选择 OpenAI。
          </p>
        </StepCard>

        <StepCard
          number={4}
          title='自动化配置 KabuAI Provider'
          description='服务器或批量部署可使用非交互模式。命令会建立 kabuai Provider、写入统一接口并将默认模型设置为 gpt-5.6-sol。'
          icon={<ServerCog className='size-4' />}
        >
          <CommandBlock
            command={openClawCommands.automatedOnboarding}
            label='完整非交互 onboarding'
          />
          <Screenshot
            src='/agent-docs/openclaw-onboard.png'
            alt='OpenClaw 非交互 onboarding 真实终端输出'
          />
        </StepCard>

        <StepCard
          number={5}
          title='校验 Provider 与默认模型'
          description='配置必须通过 schema 校验，并确认 Provider 使用 OpenAI Chat Completions，默认模型为 kabuai/gpt-5.6-sol。'
          icon={<ClipboardCheck className='size-4' />}
        >
          <CommandBlock command={openClawCommands.validate} label='配置校验' />
          <Screenshot
            src='/agent-docs/openclaw-config.png'
            alt='OpenClaw 配置校验与默认模型真实终端输出'
          />
        </StepCard>

        <StepCard
          number={6}
          title='启动并检查 Gateway'
          description='安装 daemon 后使用 gateway start。临时调试可以用 gateway run 前台运行；健康结果应显示 ok: true。'
          icon={<Rocket className='size-4' />}
        >
          <CommandBlock
            command={openClawCommands.gateway}
            label='Daemon 启动和健康检查'
          />
          <CommandBlock
            command={openClawCommands.foregroundGateway}
            label='可选：前台调试'
          />
          <Screenshot
            src='/agent-docs/openclaw-gateway.png'
            alt='OpenClaw Gateway 启动和健康检查真实输出'
          />
        </StepCard>

        <StepCard
          number={7}
          title='打开 OpenClaw Control UI'
          description='运行 dashboard 后浏览器会打开 Control UI。界面底部应显示 gpt-5.6-sol · kabuai。'
          icon={<MonitorCheck className='size-4' />}
        >
          <CommandBlock
            command={openClawCommands.dashboard}
            label='打开控制面板'
          />
          <Screenshot
            src='/agent-docs/openclaw-dashboard.png'
            alt='真实运行的 OpenClaw Control UI，默认模型为 gpt-5.6-sol'
          />
        </StepCard>

        <StepCard
          number={8}
          title='发送首条消息并排查响应'
          description='在 Control UI 输入一条测试消息。若返回 401，重新复制 API Key；若提示模型不存在，确认令牌拥有 gpt-5.6-sol 权限。'
          icon={<CheckCircle2 className='size-4' />}
        >
          <div className='bg-muted/50 rounded-xl border p-4 text-sm'>
            <p className='font-medium'>建议测试内容</p>
            <p className='text-muted-foreground mt-1'>
              请回复“连接成功”，并告诉我当前使用的模型名称。
            </p>
          </div>
        </StepCard>
      </div>
    </section>
  )
}

function CCSwitchGuide() {
  return (
    <section id='cc-switch' className='scroll-mt-24 space-y-5'>
      <div className='flex items-center gap-3'>
        <div className='grid size-11 place-items-center rounded-xl bg-blue-500/10 font-bold text-blue-500'>
          CC
        </div>
        <div>
          <h2 className='text-2xl font-bold tracking-tight'>
            CC Switch 一键导入
          </h2>
          <p className='text-muted-foreground mt-1'>
            无需手动复制接口和密钥，直接从 API 密钥页面调用 CC Switch Deep
            Link。
          </p>
        </div>
      </div>

      <div className='space-y-4'>
        <StepCard
          number={1}
          title='安装 CC Switch'
          description='macOS 可通过 Homebrew 安装；Windows 和 Linux 请使用 CC Switch Releases 安装包。'
          icon={<PackageCheck className='size-4' />}
        >
          <CommandBlock
            command={
              'brew tap farion1231/ccswitch\nbrew install --cask cc-switch'
            }
            label='macOS 安装'
          />
          <Button
            variant='outline'
            render={
              <a
                href='https://github.com/farion1231/cc-switch/releases'
                target='_blank'
                rel='noreferrer'
              />
            }
          >
            下载 Windows / Linux 版本
            <ExternalLink />
          </Button>
        </StepCard>

        <StepCard
          number={2}
          title='从 API 密钥页面选择 CC Switch'
          description='进入 API 密钥页面，打开目标密钥右侧的更多操作菜单，然后点击 CC Switch。系统会自动携带当前站点地址和该密钥。'
          icon={<KeyRound className='size-4' />}
        >
          <Button render={<Link to='/keys' />}>
            前往 API 密钥页面一键导入
            <ChevronRight />
          </Button>
          <Screenshot
            src='/agent-docs/cc-switch-token-menu.png'
            alt='KabuAI API 密钥页面中的 CC Switch 一键导入入口'
          />
        </StepCard>

        <StepCard
          number={3}
          title='选择客户端和 gpt-5.6-sol'
          description='选择 Claude、Codex 或 Gemini，名称可自定义；主模型选择 gpt-5.6-sol，其他模型字段可按需填写。'
          icon={<Settings2 className='size-4' />}
        >
          <Screenshot
            src='/agent-docs/cc-switch-import-dialog.png'
            alt='CC Switch 导入弹窗，选择客户端和模型'
          />
        </StepCard>

        <StepCard
          number={4}
          title='确认打开 CC Switch'
          description='点击“打开 CC Switch”后，浏览器会调用 ccswitch://v1/import Deep Link，应用确认后即可启用 Provider。'
          icon={<CheckCircle2 className='size-4' />}
        >
          <div className='bg-muted/50 rounded-xl border p-4 text-sm'>
            <p className='font-medium'>自动导入内容</p>
            <ul className='text-muted-foreground mt-2 grid gap-1.5 md:grid-cols-2'>
              <li>• Endpoint：{apiBaseUrl}</li>
              <li>• API Key：当前选中的密钥</li>
              <li>• Model：{defaultModel}</li>
              <li>• Enabled：true</li>
            </ul>
          </div>
        </StepCard>
      </div>
    </section>
  )
}

function OtherClientsGuide() {
  const clients = [
    ['Claude CLI', '优先通过 CC Switch 一键导入 Claude Provider。'],
    ['Claude Desktop', '使用兼容 OpenAI 接口的路由工具填写统一参数。'],
    ['HermesAgents', '新增 Custom Provider，并选择 gpt-5.6-sol。'],
    ['WorkBuddy', '在模型提供商页面添加 OpenAI Compatible。'],
    ['Cherry Studio', '新增 OpenAI 提供商，填写接口、密钥和模型。'],
    ['OpenCode', '使用 @ai-sdk/openai-compatible 配置 kabuai Provider。'],
    ['Codex++', 'Access Mode 选择 API Only，协议选择 Chat Completions。'],
  ]

  return (
    <section id='other-clients' className='scroll-mt-24 space-y-5'>
      <div>
        <h2 className='text-2xl font-bold tracking-tight'>
          其他客户端统一参数
        </h2>
        <p className='text-muted-foreground mt-1'>
          客户端支持 OpenAI Compatible 或 Custom Provider
          时，统一使用页面顶部三项参数。
        </p>
      </div>
      <div className='grid gap-3 md:grid-cols-2'>
        {clients.map(([name, description]) => (
          <Card key={name} size='sm'>
            <CardHeader>
              <CardTitle>{name}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className='grid gap-1.5 text-xs'>
              <code>Base URL: {apiBaseUrl}</code>
              <code>Model: {defaultModel}</code>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}

function TroubleshootingGuide() {
  return (
    <section id='troubleshooting' className='scroll-mt-24 space-y-4'>
      <div>
        <h2 className='text-2xl font-bold tracking-tight'>故障排查</h2>
        <p className='text-muted-foreground mt-1'>按返回错误类型检查配置。</p>
      </div>
      <div className='grid gap-3 md:grid-cols-3'>
        {[
          [
            '401 / 认证失败',
            '重新复制 API Key，确认没有空格，并检查密钥状态。',
          ],
          [
            '模型不存在',
            `确认密钥拥有 ${defaultModel} 权限，模型名称不要添加空格。`,
          ],
          [
            '连接失败',
            `Base URL 必须完整填写为 ${apiBaseUrl}，不要重复添加 /v1。`,
          ],
        ].map(([title, description]) => (
          <Card key={title} size='sm'>
            <CardHeader>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </section>
  )
}

export function AgentDocs() {
  return (
    <PublicLayout showMainContainer={false}>
      <div className='bg-muted/20 min-h-svh pt-16'>
        <div className='mx-auto grid max-w-[1500px] lg:grid-cols-[250px_minmax(0,1fr)]'>
          <aside className='border-border/70 bg-background/90 top-16 hidden h-[calc(100svh-4rem)] border-r px-5 py-7 backdrop-blur lg:sticky lg:block'>
            <p className='mb-3 text-sm font-semibold'>接入教程</p>
            <nav className='grid gap-1'>
              {guideLinks.map(([id, label], index) => (
                <a
                  key={id}
                  href={`#${id}`}
                  className={cn(
                    'hover:bg-muted rounded-lg px-3 py-2 text-sm transition-colors',
                    index === 0 && 'bg-muted font-medium'
                  )}
                >
                  {label}
                </a>
              ))}
            </nav>
          </aside>

          <main className='min-w-0 px-4 py-8 md:px-8 lg:px-12 lg:py-12'>
            <div className='mx-auto max-w-5xl space-y-14'>
              <header className='space-y-5'>
                <div>
                  <Badge variant='outline'>api.kabuai.cn</Badge>
                  <h1 className='mt-4 text-3xl font-bold tracking-tight md:text-5xl'>
                    Agent 接入教程
                  </h1>
                  <p className='text-muted-foreground mt-3 max-w-3xl text-base leading-7 md:text-lg'>
                    在 KabuAI 系统内完成 OpenClaw、CC Switch 和常用 AI
                    客户端接入。OpenClaw 流程来自真实安装、配置、Gateway 启动与
                    Control UI 验证。
                  </p>
                </div>
                <ApiParameters />
              </header>

              <OpenClawGuide />
              <CCSwitchGuide />
              <OtherClientsGuide />
              <TroubleshootingGuide />
            </div>
          </main>
        </div>
      </div>
    </PublicLayout>
  )
}
