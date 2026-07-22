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
import { useQuery } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { BundledLanguage } from 'shiki/bundle/web'
import { useStatus } from '@/hooks/use-status'
import { getUserModels } from '@/lib/api'
import { CodeBlock } from '@/components/ai-elements/code-block'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CopyButton } from '@/components/copy-button'
import { fetchTokenKey, getApiKeys } from '@/features/keys/api'
import {
  buildCodeSample,
  formatDisplayKey,
  normalizeChatCompletionsEndpoint,
  type CodeSampleLanguage,
} from '../../lib/code-samples'

const LANGUAGES: {
  value: CodeSampleLanguage
  label: string
  shiki: BundledLanguage
}[] = [
  { value: 'curl', label: 'cURL', shiki: 'bash' },
  { value: 'python', label: 'Python', shiki: 'python' },
  { value: 'javascript', label: 'JavaScript', shiki: 'javascript' },
  // shiki/bundle/web doesn't ship a Go grammar; Java has the closest visual
  // tokenization for Go and keeps keywords/strings highlighted readably.
  { value: 'go', label: 'Go', shiki: 'java' },
]

/**
 * Quick code-sample card with language tabs (cURL/Python/JS/Go).
 * Uses the user's first active API key + first available model when ready.
 */
export function CodeSamplesCard() {
  const { t } = useTranslation()
  const { status } = useStatus()
  const [language, setLanguage] = useState<CodeSampleLanguage>('curl')

  const keysQuery = useQuery({
    queryKey: ['dashboard', 'overview', 'first-key'],
    queryFn: async () => {
      const result = await getApiKeys({ p: 1, size: 5 })
      return result.success ? (result.data?.items ?? []) : []
    },
    staleTime: 60 * 1000,
  })

  const modelsQuery = useQuery({
    queryKey: ['dashboard', 'overview', 'user-models'],
    queryFn: async () => {
      const result = await getUserModels()
      return result.success ? (result.data ?? []) : []
    },
    staleTime: 5 * 60 * 1000,
  })

  const preferredKey =
    keysQuery.data?.find((k) => k.status === 1) ?? keysQuery.data?.[0]

  const keyValueQuery = useQuery({
    queryKey: ['dashboard', 'overview', 'token-key', preferredKey?.id],
    queryFn: async () => {
      if (!preferredKey?.id) return ''
      const result = await fetchTokenKey(preferredKey.id)
      return result.success && result.data?.key ? `sk-${result.data.key}` : ''
    },
    enabled: Boolean(preferredKey?.id),
    staleTime: 5 * 60 * 1000,
  })

  const endpoint = normalizeChatCompletionsEndpoint(
    typeof status?.server_address === 'string'
      ? status.server_address
      : undefined
  )

  const model = modelsQuery.data?.[0] ?? 'gpt-4o-mini'
  const apiKey = keyValueQuery.data ?? ''
  const displayKey = formatDisplayKey(apiKey)

  const realCode = useMemo(
    () =>
      buildCodeSample(language, {
        endpoint,
        apiKey: apiKey || 'sk-xxxxxxxxxxxxxxxxxxxxxxxx',
        model,
      }),
    [language, endpoint, apiKey, model]
  )

  const previewCode = useMemo(
    () =>
      buildCodeSample(language, {
        endpoint,
        apiKey: displayKey,
        model,
      }),
    [language, endpoint, displayKey, model]
  )

  const shikiLang = useMemo(
    () => LANGUAGES.find((l) => l.value === language)?.shiki ?? 'bash',
    [language]
  )

  const docsLink = (status?.docs_link as string | undefined) ?? '/docs'

  return (
    <Card>
      <CardHeader className='flex flex-row items-start justify-between gap-2'>
        <CardTitle className='text-base sm:text-lg'>
          {t('Code Samples')}
        </CardTitle>
        <CopyButton
          value={realCode}
          variant='outline'
          size='sm'
          tooltip={t('Copy code')}
          successTooltip={t('Copied!')}
          aria-label={t('Copy code')}
          className='h-7 gap-1.5 px-2 text-xs'
        >
          {t('Copy')}
        </CopyButton>
      </CardHeader>
      <CardContent className='flex flex-col gap-3'>
        <Tabs
          value={language}
          onValueChange={(v) => setLanguage(v as CodeSampleLanguage)}
        >
          <TabsList className='h-9 w-full justify-start gap-1 bg-transparent p-0'>
            {LANGUAGES.map((lang) => (
              <TabsTrigger
                key={lang.value}
                value={lang.value}
                className='h-7 rounded-full border-transparent px-3 text-xs data-[state=active]:border-[var(--accent-blue)]/30 data-[state=active]:bg-[color-mix(in_oklch,var(--accent-blue)_12%,transparent)] data-[state=active]:text-[var(--accent-blue)]'
              >
                {lang.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <CodeBlock
          code={previewCode}
          language={shikiLang}
          className='max-h-[15rem] overflow-auto text-[11px] [&>div>div]:m-0'
        />

        <a
          href={docsLink}
          target='_blank'
          rel='noreferrer'
          className='inline-flex items-center gap-1 text-xs font-medium text-[var(--accent-blue)] hover:underline'
        >
          {t('View API Docs')}
          <ArrowRight className='size-3' aria-hidden />
        </a>
      </CardContent>
    </Card>
  )
}
