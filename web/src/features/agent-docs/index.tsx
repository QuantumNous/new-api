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
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  KeyRound,
  Settings2,
  ShieldCheck,
  Sparkles,
  Terminal,
} from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { fetchTokenKey, getApiKeys } from '@/features/keys/api'
import { getUserModels } from '@/lib/api'
import { copyToClipboard } from '@/lib/copy-to-clipboard'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

const apiBaseUrl = 'https://api.kabuai.cn/v1'
const defaultModel = 'gpt-5.6-sol'
const defaultContextWindow = 1_000_000
const minContextWindow = 4_096
const maxContextWindow = 10_000_000

const guideLinks = [
  ['openclaw', 'OpenClaw'],
  ['cc-switch', 'CC Switch'],
  ['other-clients', '其他客户端'],
  ['troubleshooting', '故障排查'],
] as const

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`
}

function resolveContextWindow(value: string): number | null {
  if (!value.trim()) return defaultContextWindow
  const contextWindow = Number.parseInt(value, 10)
  if (
    !Number.isFinite(contextWindow) ||
    contextWindow < minContextWindow ||
    contextWindow > maxContextWindow
  ) {
    return null
  }
  return contextWindow
}

function buildOpenClawCommand(
  apiKey: string,
  model: string,
  contextWindow: number
): string {
  const providerConfig = JSON.stringify({
    baseUrl: apiBaseUrl,
    apiKey,
    api: 'openai-completions',
    models: [
      {
        id: model,
        name: model,
        contextWindow,
        maxTokens: 32_768,
      },
    ],
  })
  return `openclaw config set models.providers.kabuai ${shellQuote(providerConfig)} --strict-json --merge && openclaw config set agents.defaults.model.primary ${shellQuote(JSON.stringify(`kabuai/${model}`))} --strict-json`
}

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
          {copied ? <Check /> : <Copy />}
          {copied ? t('Copied') : t('Copy')}
        </Button>
      </div>
      <pre className='overflow-x-auto p-4 text-[13px] leading-6 break-all whitespace-pre-wrap'>
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
  return (
    <article className='border-border/80 bg-card rounded-2xl border p-4 shadow-sm md:p-6'>
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
    ['API Key', '从当前账号密钥中选择'],
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
              {index !== 1 && (
                <Button
                  type='button'
                  variant='outline'
                  size='icon-sm'
                  aria-label={`${t('Copy')} ${label}`}
                  onClick={() => void copyToClipboard(value)}
                >
                  <Copy />
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function OpenClawConfigurator() {
  const { auth } = useAuthStore()
  const isAuthenticated = Boolean(auth.user)
  const [selectedKeyId, setSelectedKeyId] = useState<number | null>(null)
  const [selectedModel, setSelectedModel] = useState('')
  const [contextInput, setContextInput] = useState('')
  const [copied, setCopied] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const keysQuery = useQuery({
    queryKey: ['agent-docs-api-keys'],
    queryFn: () => getApiKeys({ p: 1, size: 100 }),
    enabled: isAuthenticated,
    staleTime: 60_000,
  })
  const modelsQuery = useQuery({
    queryKey: ['agent-docs-user-models'],
    queryFn: getUserModels,
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
  })

  const apiKeys = useMemo(
    () => (keysQuery.data?.data?.items ?? []).filter((key) => key.status === 1),
    [keysQuery.data?.data?.items]
  )
  const availableModels = modelsQuery.data?.data ?? []
  const effectiveKeyId = selectedKeyId ?? apiKeys[0]?.id ?? null
  const effectiveModel =
    selectedModel ||
    (availableModels.includes(defaultModel)
      ? defaultModel
      : availableModels[0] || defaultModel)
  const contextWindow = resolveContextWindow(contextInput)
  const previewCommand = buildOpenClawCommand(
    'SELECTED_API_KEY',
    effectiveModel,
    contextWindow ?? defaultContextWindow
  )

  const handleCopyGeneratedCommand = async () => {
    setErrorMessage('')
    if (!effectiveKeyId) {
      setErrorMessage('请先选择一个已启用的 API 密钥。')
      return
    }
    if (!contextWindow) {
      setErrorMessage(
        `上下文长度必须在 ${minContextWindow.toLocaleString()} 到 ${maxContextWindow.toLocaleString()} 之间。`
      )
      return
    }

    try {
      const response = await fetchTokenKey(effectiveKeyId)
      const rawKey = response.data?.key
      if (!response.success || !rawKey) {
        setErrorMessage(response.message || '无法读取所选 API 密钥。')
        return
      }
      const apiKey = rawKey.startsWith('sk-') ? rawKey : `sk-${rawKey}`
      const command = buildOpenClawCommand(
        apiKey,
        effectiveModel,
        contextWindow
      )
      const success = await copyToClipboard(command)
      if (!success) {
        setErrorMessage('复制失败，请检查浏览器剪贴板权限。')
        return
      }
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setErrorMessage('生成命令失败，请重新登录后再试。')
    }
  }

  if (!isAuthenticated) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>登录后生成一键接入命令</CardTitle>
          <CardDescription>
            登录后可直接选择当前账号的 API
            密钥和可用模型，密钥不会显示在页面上。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button render={<a href='/sign-in?redirect=/docs/agent' />}>
            登录并继续
            <ChevronRight />
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className='overflow-visible'>
      <CardHeader>
        <CardTitle>生成 OpenClaw 一键接入命令</CardTitle>
        <CardDescription>
          选择密钥和模型；上下文不填写时默认 1M。命令会保留客户原有模型，追加
          KabuAI 模型并将它设为默认模型。
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-5'>
        <div className='grid gap-4 md:grid-cols-3'>
          <div className='space-y-2'>
            <Label htmlFor='openclaw-api-key'>API 密钥</Label>
            <NativeSelect
              id='openclaw-api-key'
              className='w-full'
              value={effectiveKeyId ? String(effectiveKeyId) : ''}
              disabled={keysQuery.isLoading || apiKeys.length === 0}
              onChange={(event) =>
                setSelectedKeyId(Number.parseInt(event.target.value, 10))
              }
            >
              {apiKeys.length === 0 && (
                <NativeSelectOption value=''>没有可用密钥</NativeSelectOption>
              )}
              {apiKeys.map((apiKey) => (
                <NativeSelectOption key={apiKey.id} value={String(apiKey.id)}>
                  {apiKey.name} · {apiKey.key}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='openclaw-model'>模型</Label>
            <NativeSelect
              id='openclaw-model'
              className='w-full'
              value={effectiveModel}
              disabled={modelsQuery.isLoading}
              onChange={(event) => setSelectedModel(event.target.value)}
            >
              {!availableModels.includes(defaultModel) && (
                <NativeSelectOption value={defaultModel}>
                  {defaultModel}
                </NativeSelectOption>
              )}
              {availableModels.map((model) => (
                <NativeSelectOption key={model} value={model}>
                  {model}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='openclaw-context'>上下文长度</Label>
            <Input
              id='openclaw-context'
              type='number'
              min={minContextWindow}
              max={maxContextWindow}
              step={1024}
              value={contextInput}
              placeholder='留空默认 1000000（1M）'
              aria-invalid={contextWindow === null}
              onChange={(event) => setContextInput(event.target.value)}
            />
          </div>
        </div>

        <div className='bg-muted/40 rounded-xl border p-4 text-sm'>
          <div className='grid gap-2 md:grid-cols-3'>
            <p>
              <span className='text-muted-foreground'>接口：</span>
              {apiBaseUrl}
            </p>
            <p>
              <span className='text-muted-foreground'>模型：</span>
              {effectiveModel}
            </p>
            <p>
              <span className='text-muted-foreground'>上下文：</span>
              {(contextWindow ?? defaultContextWindow).toLocaleString()}
            </p>
          </div>
        </div>

        <CommandBlock command={previewCommand} label='命令预览（密钥已隐藏）' />

        <div className='bg-muted/40 rounded-xl border p-4 text-sm'>
          <p className='font-medium'>主动切换到当前选择的模型</p>
          <code className='mt-2 block break-all select-all'>
            /model kabuai/{effectiveModel}
          </code>
        </div>

        <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
          <Button
            type='button'
            disabled={!effectiveKeyId || keysQuery.isLoading}
            onClick={() => void handleCopyGeneratedCommand()}
          >
            {copied ? <Check /> : <Copy />}
            {copied ? '已复制，可直接粘贴' : '复制一键接入命令'}
          </Button>
          {apiKeys.length === 0 && !keysQuery.isLoading && (
            <Button variant='outline' render={<Link to='/keys' />}>
              创建 API 密钥
              <ChevronRight />
            </Button>
          )}
          <p className='text-muted-foreground text-xs'>
            点击复制时才读取完整密钥，页面不会展示密钥明文。
          </p>
        </div>

        {errorMessage && (
          <p className='text-destructive text-sm' role='alert'>
            {errorMessage}
          </p>
        )}
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
              OpenClaw 模型接入
            </h2>
            <p className='text-muted-foreground mt-1'>
              保留原有其他 Provider 和模型，首次添加 KabuAI 模型并设为默认模型。
            </p>
          </div>
        </div>
        <div className='mt-4 flex flex-wrap gap-2'>
          <Badge variant='secondary'>OpenAI Compatible</Badge>
          <Badge variant='secondary'>默认上下文：1M</Badge>
          <Badge variant='secondary'>无需重启：支持热应用</Badge>
        </div>
      </div>

      <OpenClawConfigurator />

      <div className='space-y-4'>
        <StepCard
          number={1}
          title='选择密钥、模型和上下文'
          description='密钥与模型来自当前登录账号；上下文留空时自动使用 1,000,000。'
          icon={<KeyRound className='size-4' />}
        />
        <StepCard
          number={2}
          title='复制并直接粘贴一键命令'
          description='适用于首次添加 KabuAI：不会修改客户已有的其他 Provider、模型、技能、渠道或工作区，并将新增模型设为默认模型。'
          icon={<Terminal className='size-4' />}
        />
        <StepCard
          number={3}
          title='确认配置热应用'
          description='OpenClaw 会在写入时校验配置并支持热应用，正常情况下不需要重启 Gateway。'
          icon={<ShieldCheck className='size-4' />}
        >
          <Screenshot
            src='/agent-docs/openclaw-config.png'
            alt='OpenClaw Provider 配置与默认模型校验结果'
          />
        </StepCard>
        <StepCard
          number={4}
          title='测试默认模型或主动切换'
          description='新增模型已设为默认模型。如果当前对话没有刷新，可以在聊天窗口发送 /model kabuai/模型名 来切换。'
          icon={<Sparkles className='size-4' />}
        >
          <Screenshot
            src='/agent-docs/openclaw-dashboard.png'
            alt='OpenClaw Control UI 中的 KabuAI 模型'
          />
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
            从 API 密钥页面自动导入接口、密钥和模型。
          </p>
        </div>
      </div>
      <div className='space-y-4'>
        <StepCard
          number={1}
          title='从 API 密钥页面选择 CC Switch'
          description='打开目标密钥右侧菜单，点击 CC Switch，系统会自动携带当前站点地址和所选密钥。'
          icon={<KeyRound className='size-4' />}
        >
          <Button render={<Link to='/keys' />}>
            前往 API 密钥页面
            <ChevronRight />
          </Button>
          <Screenshot
            src='/agent-docs/cc-switch-token-menu.png'
            alt='KabuAI API 密钥页面中的 CC Switch 一键导入入口'
          />
        </StepCard>
        <StepCard
          number={2}
          title='选择客户端和模型'
          description='选择 Claude、Codex 或 Gemini，并选择需要导入的模型。'
          icon={<Settings2 className='size-4' />}
        >
          <Screenshot
            src='/agent-docs/cc-switch-import-dialog.png'
            alt='CC Switch 导入弹窗'
          />
        </StepCard>
        <StepCard
          number={3}
          title='打开 CC Switch 完成导入'
          description='确认后浏览器调用 ccswitch://v1/import，应用接受配置即可使用。'
          icon={<CheckCircle2 className='size-4' />}
        />
      </div>
    </section>
  )
}

function OtherClientsGuide() {
  const clients = [
    ['Claude CLI', '优先通过 CC Switch 一键导入 Claude Provider。'],
    ['Claude Desktop', '使用兼容 OpenAI 接口的路由工具填写统一参数。'],
    ['HermesAgents', '新增 Custom Provider，并选择账号可用模型。'],
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
          客户端支持 OpenAI Compatible 或 Custom Provider 时，使用页面顶部参数。
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
              <code>Default model: {defaultModel}</code>
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
          ['401 / 认证失败', '重新选择 API 密钥，确认密钥处于启用状态。'],
          ['模型不存在', '确认所选密钥拥有对应模型权限。'],
          ['连接失败', `Base URL 必须为 ${apiBaseUrl}，不要重复添加 /v1。`],
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
                    Agent 模型接入教程
                  </h1>
                  <p className='text-muted-foreground mt-3 max-w-3xl text-base leading-7 md:text-lg'>
                    直接选择当前账号的 API
                    密钥、模型和上下文长度，生成可粘贴的一键配置命令。
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
