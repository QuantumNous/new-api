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
import { useEffect, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Loader2,
  Send,
  Sparkles,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getUserModels, sendChatCompletion } from '@/features/playground/api'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

/**
 * Key self-check tool (PRD §7.6).
 *
 * One-shot connectivity test for non-technical users right after they top
 * up + create a key — proves "my money really turns into AI replies"
 * before they leave the site for whatever AI tool they actually use.
 *
 * Hard rules from PRD §10:
 *   - NOT a chat product. No history, no multi-turn, no model picker.
 *   - One input → one output. Refresh wipes everything.
 *   - 10 calls / user / day soft cap (localStorage; server-side TODO).
 *   - Top-of-page tells the user explicitly: long conversations belong
 *     in their own AI tool.
 *
 * Cheap default model so a stuck user can't burn through credit:
 *   preference order: deepseek-chat → gpt-4o-mini → first available.
 */

const DAILY_LIMIT = 10
const CHEAP_MODELS = ['deepseek-chat', 'gpt-4o-mini'] as const
const PLACEHOLDER_PROMPT = '你好，请用一句话介绍自己。'

function todayKey(userId: number | string | undefined): string {
  const ymd = new Date().toISOString().slice(0, 10)
  return `dr:keys-test-count:${userId ?? 'anon'}:${ymd}`
}

function readCount(userId: number | string | undefined): number {
  try {
    const raw = localStorage.getItem(todayKey(userId))
    return raw ? Math.max(0, Math.min(DAILY_LIMIT, parseInt(raw, 10) || 0)) : 0
  } catch {
    return 0
  }
}

function bumpCount(userId: number | string | undefined): number {
  try {
    const next = readCount(userId) + 1
    localStorage.setItem(todayKey(userId), String(next))
    return next
  } catch {
    return DAILY_LIMIT
  }
}

// Rough Chinese-character estimate from token count. Tokens are
// language-dependent so we hedge with ~1.4× for mixed input/output.
function tokensToChars(tokens: number): number {
  return Math.round(tokens * 1.4)
}

type TestResult = {
  ok: boolean
  model: string
  reply: string
  inputTokens: number
  outputTokens: number
  errorMessage?: string
}

export function KeySelfCheckPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.auth.user)
  const userId = user?.id

  const [model, setModel] = useState<string>('deepseek-chat')
  const [input, setInput] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TestResult | null>(null)
  const [usedToday, setUsedToday] = useState<number>(0)

  // Pick a sensible cheap model on mount based on what the user has access
  // to. Falls back silently — if the picker can't decide we just stick
  // with deepseek-chat and the test call will surface a clear error.
  useEffect(() => {
    setUsedToday(readCount(userId))
    let cancelled = false
    ;(async () => {
      try {
        const models = await getUserModels()
        if (cancelled || models.length === 0) return
        const pref = CHEAP_MODELS.find((c) =>
          models.some((m) => m.value === c)
        )
        if (pref) {
          setModel(pref)
        } else {
          setModel(models[0].value)
        }
      } catch {
        // Keep default; failure here is non-fatal.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  const atLimit = usedToday >= DAILY_LIMIT
  const remaining = Math.max(0, DAILY_LIMIT - usedToday)

  const handleTest = async () => {
    if (loading) return
    const prompt = input.trim() || PLACEHOLDER_PROMPT
    if (atLimit) {
      toast.error(
        t("You've reached today's test limit. Try again tomorrow.")
      )
      return
    }

    setLoading(true)
    setResult(null)
    try {
      const res = await sendChatCompletion({
        model,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
      })
      const reply = res.choices?.[0]?.message?.content ?? ''
      const usage = res.usage
      setResult({
        ok: true,
        model: res.model || model,
        reply,
        inputTokens: usage?.prompt_tokens ?? 0,
        outputTokens: usage?.completion_tokens ?? 0,
      })
      setUsedToday(bumpCount(userId))
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('Unknown error')
      setResult({
        ok: false,
        model,
        reply: '',
        inputTokens: 0,
        outputTokens: 0,
        errorMessage: message,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='mx-auto max-w-2xl px-4 py-6 sm:py-10'>
      {/* Header */}
      <div className='mb-4 flex items-center gap-2 text-sm'>
        <Button
          variant='ghost'
          size='sm'
          render={
            <Link to='/keys'>
              <ArrowLeft className='mr-1 h-4 w-4' />
              {t('Back to keys')}
            </Link>
          }
        />
      </div>

      <h1 className='text-2xl font-semibold'>{t('Test your API key')}</h1>
      <p className='text-muted-foreground mt-2 text-sm leading-relaxed'>
        {t(
          "One-shot tool to verify your key can call AI. For ongoing chats use the AI tool you already have — this isn't a chat product."
        )}
      </p>

      {/* Meta row: model + today's quota */}
      <div className='bg-muted/30 mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs'>
        <span className='text-muted-foreground inline-flex items-center gap-1.5'>
          <Sparkles className='h-3.5 w-3.5' />
          {t('Model')}:{' '}
          <code className='bg-background rounded px-1.5 py-0.5 font-mono'>
            {model}
          </code>
        </span>
        <span className='text-muted-foreground'>
          {t('Tests left today')}: {remaining} / {DAILY_LIMIT}
        </span>
      </div>

      {/* Input */}
      <div className='mt-4'>
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('Type a short sentence, e.g.') + ' ' + PLACEHOLDER_PROMPT}
          rows={3}
          disabled={loading || atLimit}
          className='resize-none'
        />
      </div>

      <div className='mt-3 flex justify-end'>
        <Button
          type='button'
          onClick={handleTest}
          disabled={loading || atLimit}
        >
          {loading ? (
            <>
              <Loader2 className='mr-1.5 h-4 w-4 animate-spin' />
              {t('Testing...')}
            </>
          ) : (
            <>
              <Send className='mr-1.5 h-4 w-4' />
              {t('Test')}
            </>
          )}
        </Button>
      </div>

      {/* Result */}
      {result && (
        <div className='mt-6 space-y-3'>
          <div className='border-t pt-4'>
            {result.ok ? (
              <>
                <p className='text-foreground inline-flex items-center gap-1.5 text-sm font-medium'>
                  <Check className='text-emerald-600 dark:text-emerald-400 h-4 w-4' />
                  {t('Your key works.')}
                </p>
                <p className='text-muted-foreground mt-1 text-xs'>
                  {t('Model')}: {result.model}
                  {' · '}
                  {t('Input')}: {result.inputTokens} tokens (≈
                  {tokensToChars(result.inputTokens)} {t('chars')})
                  {' · '}
                  {t('Output')}: {result.outputTokens} tokens (≈
                  {tokensToChars(result.outputTokens)} {t('chars')})
                </p>
                <div className='bg-muted/30 mt-3 rounded-md border p-3'>
                  <p className='text-foreground whitespace-pre-wrap text-sm leading-relaxed'>
                    {result.reply || t('(empty reply)')}
                  </p>
                </div>
                <p className='text-muted-foreground mt-3 text-xs'>
                  {t(
                    'Looks good — copy your key from the keys page and paste it into the AI tool you use.'
                  )}
                </p>
              </>
            ) : (
              <>
                <p className='text-foreground inline-flex items-center gap-1.5 text-sm font-medium'>
                  <AlertCircle className='text-amber-600 dark:text-amber-400 h-4 w-4' />
                  {t("Test didn't go through.")}
                </p>
                <p className='text-muted-foreground mt-2 text-xs leading-relaxed'>
                  {result.errorMessage}
                </p>
                <div className='mt-3 flex flex-wrap gap-2'>
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={() => navigate({ to: '/wallet' })}
                  >
                    {t('Top up')}
                  </Button>
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={() => navigate({ to: '/keys' })}
                  >
                    {t('Regenerate key')}
                  </Button>
                  <Button
                    size='sm'
                    variant='ghost'
                    render={
                      <Link to='/help/pricing'>{t('Contact support')}</Link>
                    }
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
