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
import { Check, Copy, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { usePersona } from '@/hooks/use-persona'

const DISMISS_STORAGE_KEY = 'dr-keys-tutorial-dismissed'

function defaultBaseUrl(): string {
  if (typeof window === 'undefined') return 'https://deeprouter.ai/v1'
  const { protocol, host } = window.location
  return `${protocol}//${host}/v1`
}

/**
 * Persistent tutorial card for casual users on /keys. Existing UX only
 * surfaces "Base URL + Model name + paste into client" inside the one-shot
 * success dialog at create time — close it and a non-technical user has no
 * way to recover the instructions. This card stays at the top of /keys
 * until dismissed (localStorage), so the casual flow is end-to-end:
 *   1. Create key
 *   2. Copy Base URL (visible right here)
 *   3. Paste into Cherry Studio / Chatbox / Claude Code
 *
 * Only renders for persona === 'casual'. Dev / team personas don't need
 * this scaffolding.
 */
export function ApiKeysTutorialCard() {
  const { t } = useTranslation()
  const persona = usePersona()
  const baseUrl = defaultBaseUrl()
  const [dismissed, setDismissed] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setDismissed(window.localStorage.getItem(DISMISS_STORAGE_KEY) === 'true')
  }, [])

  if (persona !== 'casual' || dismissed) return null

  const handleDismiss = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(DISMISS_STORAGE_KEY, 'true')
    }
    setDismissed(true)
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(baseUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error(t('Copy failed'))
    }
  }

  return (
    <div className='bg-muted/30 relative mb-4 rounded-lg border p-4 sm:p-5'>
      <button
        type='button'
        onClick={handleDismiss}
        aria-label={t('Dismiss tutorial')}
        className='text-muted-foreground hover:text-foreground absolute top-3 right-3'
      >
        <X className='h-4 w-4' />
      </button>
      <h3 className='pr-8 text-sm font-semibold'>
        {t('How to use your DeepRouter key')}
      </h3>
      <p className='text-muted-foreground mt-1 pr-8 text-xs'>
        {t(
          'One key, any AI client. Paste it into Cherry Studio, Chatbox, or Claude Code to chat with Claude / GPT / Gemini / DeepSeek.'
        )}
      </p>
      <ol className='mt-3 space-y-3 text-xs'>
        <li className='flex gap-3'>
          <span className='bg-foreground/10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold'>
            1
          </span>
          <div className='flex-1'>
            <p className='font-medium'>{t('Create an API key')}</p>
            <p className='text-muted-foreground'>
              {t(
                'Click "Create API Key" above. Simple mode is recommended — pick a task and we route to the right model.'
              )}
            </p>
          </div>
        </li>
        <li className='flex gap-3'>
          <span className='bg-foreground/10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold'>
            2
          </span>
          <div className='flex-1'>
            <p className='font-medium'>{t('Copy your Base URL')}</p>
            <div className='border-border bg-background mt-1 flex items-center gap-2 rounded-md border px-2 py-1'>
              <code
                className='flex-1 truncate font-mono text-[11px]'
                title={baseUrl}
              >
                {baseUrl}
              </code>
              <Button
                type='button'
                size='sm'
                variant='ghost'
                className='h-6 px-1.5'
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className='h-3 w-3' />
                ) : (
                  <Copy className='h-3 w-3' />
                )}
              </Button>
            </div>
          </div>
        </li>
        <li className='flex gap-3'>
          <span className='bg-foreground/10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold'>
            3
          </span>
          <div className='flex-1'>
            <p className='font-medium'>{t('Paste into an AI client')}</p>
            <p className='text-muted-foreground'>
              {t(
                'Find the "API key" and "Base URL" (sometimes called "Endpoint") fields in your client\'s settings, paste both, and save.'
              )}
            </p>
          </div>
        </li>
      </ol>
    </div>
  )
}
