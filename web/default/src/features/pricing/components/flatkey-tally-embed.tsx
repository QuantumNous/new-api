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
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

const TALLY_EMBED_SCRIPT_SRC = 'https://tally.so/widgets/embed.js'
const UTM_PARAM_NAMES = ['utm_source', 'utm_medium', 'utm_campaign'] as const
const DEFAULT_TALLY_FORM_ID = '1A6gM4'
const TALLY_FORM_IDS = {
  en: DEFAULT_TALLY_FORM_ID,
  zh: '9qMPGE',
  ja: 'RGk1Rl',
  ru: 'EkMebL',
  fr: '5BMo8v',
  vi: 'VLDXb6',
} as const

let tallyEmbedScriptPromise: Promise<void> | null = null

declare global {
  interface Window {
    Tally?: {
      loadEmbeds: () => void
    }
  }
}

type SupportedTallyLanguage = keyof typeof TALLY_FORM_IDS

export type FlatkeyTallyEmbedProps = {
  className?: string
}

const getSupportedTallyLanguage = (language: string): SupportedTallyLanguage => {
  const normalized = language.toLowerCase()

  if (normalized.startsWith('zh')) return 'zh'
  if (normalized.startsWith('ja')) return 'ja'
  if (normalized.startsWith('ru')) return 'ru'
  if (normalized.startsWith('fr')) return 'fr'
  if (normalized.startsWith('vi')) return 'vi'

  return 'en'
}

const getTallyFormId = (language: SupportedTallyLanguage): string =>
  TALLY_FORM_IDS[language]

const getTallyEmbedSrc = (language: SupportedTallyLanguage): string => {
  const formId = getTallyFormId(language)
  const params = new URLSearchParams({
    dynamicHeight: '1',
    transparentBackground: '1',
    hideTitle: '1',
    hideBranding: '1',
    alignLeft: '1',
    brand: 'flatkey',
    plan: 'enterprise',
    source: 'pricing',
    originPage: 'pricing',
    language,
  })

  if (typeof window !== 'undefined') {
    const currentParams = new URLSearchParams(window.location.search)

    UTM_PARAM_NAMES.forEach((paramName) => {
      const value = currentParams.get(paramName)

      if (value) {
        params.set(paramName, value)
      }
    })
  }

  return `https://tally.so/embed/${formId}?${params.toString()}`
}

const loadTallyEmbedScript = (): Promise<void> => {
  if (typeof document === 'undefined') {
    return Promise.resolve()
  }

  if (window.Tally) {
    return Promise.resolve()
  }

  if (tallyEmbedScriptPromise) {
    return tallyEmbedScriptPromise
  }

  tallyEmbedScriptPromise = new Promise((resolve, reject) => {
    const handleScriptError = () => {
      tallyEmbedScriptPromise = null
      reject(new Error('Failed to load Tally embed script'))
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${TALLY_EMBED_SCRIPT_SRC}"]`
    )

    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true })
      existingScript.addEventListener('error', handleScriptError, {
        once: true,
      })
      return
    }

    const script = document.createElement('script')
    script.src = TALLY_EMBED_SCRIPT_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = handleScriptError
    document.body.appendChild(script)
  })

  return tallyEmbedScriptPromise
}

export function FlatkeyTallyEmbed(props: FlatkeyTallyEmbedProps) {
  const { i18n, t } = useTranslation()
  const [loadFailed, setLoadFailed] = useState(false)
  const language = getSupportedTallyLanguage(
    i18n.resolvedLanguage || i18n.language || 'en'
  )
  const tallyFormId = getTallyFormId(language)
  const tallyEmbedSrc = useMemo(() => getTallyEmbedSrc(language), [language])

  useEffect(() => {
    let mounted = true
    setLoadFailed(false)

    void loadTallyEmbedScript()
      .then(() => {
        if (mounted) {
          window.Tally?.loadEmbeds()
        }
      })
      .catch(() => {
        if (mounted) {
          tallyEmbedScriptPromise = null
          setLoadFailed(true)
        }
      })

    return () => {
      mounted = false
    }
  }, [tallyEmbedSrc])

  return (
    <div className={cn('w-full overflow-hidden', props.className)}>
      <iframe
        key={tallyEmbedSrc}
        className='block h-[760px] w-full border-0 bg-transparent sm:h-[560px] lg:h-[520px]'
        data-tally-src={tallyEmbedSrc}
        loading='lazy'
        width='100%'
        height='520'
        frameBorder='0'
        marginHeight={0}
        marginWidth={0}
        allow='clipboard-write'
        title={t('Enterprise sales inquiry form')}
      />
      {loadFailed && (
        <div className='border-border/70 bg-background/92 text-muted-foreground mt-3 rounded-lg border px-3 py-2 text-sm'>
          {t('Sales inquiry form could not be loaded.')}{' '}
          <a
            className='font-medium text-violet-700 underline-offset-4 hover:underline dark:text-violet-100'
            href={`https://tally.so/r/${tallyFormId}`}
            rel='noreferrer'
            target='_blank'
          >
            {t('Open sales inquiry form')}
          </a>
        </div>
      )}
    </div>
  )
}
