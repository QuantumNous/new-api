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
import { Link, useParams } from '@tanstack/react-router'
import {
  ArrowLeft,
  Check,
  Code,
  Copy,
  MessageCircle,
  Sparkles,
  Terminal,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import i18next from 'i18next'
import { toast } from 'sonner'
import { useStatus } from '@/hooks/use-status'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { FieldHint } from '@/components/ui/field-hint'
import { Markdown } from '@/components/ui/markdown'
import { getTutorial } from './tutorials/registry'

type IconKey = 'cherry' | 'chat' | 'lobe' | 'cursor' | 'terminal' | 'code'

const ICONS: Record<IconKey, LucideIcon> = {
  cherry: Sparkles,
  chat: MessageCircle,
  lobe: MessageCircle,
  cursor: Code,
  terminal: Terminal,
  code: Code,
}

function defaultBaseUrl(): string {
  if (typeof window === 'undefined') return 'https://deeprouter.ai/v1'
  const { protocol, host } = window.location
  return `${protocol}//${host}/v1`
}

export function OnboardingTutorial() {
  const { t } = useTranslation()
  const params = useParams({ strict: false }) as { slug?: string }
  const slug = params?.slug ?? ''
  const tutorial = getTutorial(slug)
  const { status: _status } = useStatus()

  const baseUrl = defaultBaseUrl()
  const modelName = 'deeprouter'

  const content = useMemo(() => {
    if (!tutorial) return null
    const body = tutorial.content({ baseUrl, modelName })
    const lang = i18next.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en'
    return body[lang] ?? body.en
  }, [tutorial, baseUrl])

  if (!tutorial || !content) {
    return (
      <div className='mx-auto max-w-3xl px-4 py-16 text-center'>
        <h1 className='text-2xl font-semibold'>{t('Tutorial not found')}</h1>
        <p className='text-muted-foreground mt-2'>
          {t("We don't have a guide for this client yet.")}
        </p>
        <Button className='mt-6' render={<Link to='/keys' />}>
          <ArrowLeft className='mr-1.5 h-4 w-4' />
          {t('Back to API Keys')}
        </Button>
      </div>
    )
  }

  const Icon = ICONS[tutorial.icon]

  return (
    <div className='mx-auto max-w-3xl px-4 py-6 sm:py-10'>
      {/* Breadcrumb back to /keys */}
      <div className='mb-4 flex items-center gap-2 text-sm'>
        <Button
          variant='ghost'
          size='sm'
          render={<Link to='/keys' />}
          className='text-muted-foreground hover:text-foreground -ml-2'
        >
          <ArrowLeft className='mr-1.5 h-4 w-4' />
          {t('Back to API Keys')}
        </Button>
      </div>

      {/* Header card */}
      <div className='bg-card mb-6 flex items-start gap-4 rounded-xl border p-5'>
        <div className='bg-muted text-muted-foreground flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border'>
          <Icon className='h-6 w-6' />
        </div>
        <div className='min-w-0 flex-1'>
          <div className='flex items-center gap-2'>
            <h1 className='text-xl font-semibold sm:text-2xl'>
              {tutorial.label}
            </h1>
            {tutorial.recommended && (
              <span className='bg-foreground/10 text-foreground rounded-full px-2 py-0.5 text-[10px] font-medium'>
                {t('Recommended')}
              </span>
            )}
          </div>
          <p className='text-muted-foreground mt-1 text-sm'>
            {t(tutorial.descriptionKey)}
          </p>
        </div>
      </div>

      {/* Connection values — top-of-page copy-block for the most common need */}
      <div className='bg-muted/30 mb-6 grid gap-3 rounded-xl border p-4 sm:grid-cols-3'>
        <CopyField
          label={t('Base URL')}
          value={baseUrl}
          hint={t('Paste into the client\'s "API URL" or "Base URL" field. Do not add a trailing slash.')}
        />
        <CopyField
          label={t('Model')}
          value={modelName}
          hint={t('Type exactly this. We route to the right AI based on your signup choices.')}
        />
        <div className='text-muted-foreground flex flex-col justify-center text-xs leading-snug'>
          {t(
            'Use these values in the steps below. Your API Key was shown when you created it on the Keys page.'
          )}
        </div>
      </div>

      {/* Markdown body */}
      <Markdown>{content}</Markdown>
    </div>
  )
}

function CopyField({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error(t('Copy failed'))
    }
  }
  return (
    <div className='min-w-0 space-y-1'>
      <p className='text-muted-foreground text-[11px] font-medium'>{label}</p>
      <div className='bg-background flex items-center gap-2 rounded-md border px-2.5 py-1.5'>
        <code className='flex-1 truncate font-mono text-xs' title={value}>
          {value}
        </code>
        <Button
          type='button'
          size='sm'
          variant='ghost'
          className={cn('h-6 px-1.5')}
          onClick={handleCopy}
        >
          {copied ? (
            <Check className='h-3 w-3' />
          ) : (
            <Copy className='h-3 w-3' />
          )}
        </Button>
      </div>
      {hint && <FieldHint>{hint}</FieldHint>}
    </div>
  )
}
