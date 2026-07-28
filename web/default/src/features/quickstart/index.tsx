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
import { CheckCircle2, KeyRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSystemConfig } from '@/hooks/use-system-config'
import { CopyButton } from '@/components/copy-button'
import { Main } from '@/components/layout'
import { dataToolQueryKeys, getDataTools } from '@/features/data-tools/api'
import { getApiKeys } from '@/features/keys/api'

const DEFAULT_API_ORIGIN = 'https://router.flatkey.ai'

function buildDataToolsUrl(serverAddress?: string): string {
  const browserOrigin =
    typeof window !== 'undefined' &&
    /^(localhost|127\.0\.0\.1|192\.168\.)/.test(window.location.hostname)
      ? window.location.origin
      : ''
  const origin = (browserOrigin || serverAddress || DEFAULT_API_ORIGIN).replace(
    /\/+$/,
    ''
  )
  return `${origin}/api/data-tools`
}

export function Quickstart() {
  const { t } = useTranslation()
  const { serverAddress } = useSystemConfig()
  const dataToolsUrl = buildDataToolsUrl(serverAddress)
  const catalogQuery = useQuery({
    queryKey: dataToolQueryKeys.list({ page: 1, page_size: 1 }),
    queryFn: () => getDataTools({ page: 1, page_size: 1 }),
  })
  const apiKeysQuery = useQuery({
    queryKey: ['api-keys', 'get-started'],
    queryFn: () => getApiKeys({ p: 1, size: 1 }),
  })
  const apiKeyCount = apiKeysQuery.data?.data?.total ?? 0
  const toolCount = catalogQuery.data?.total.toLocaleString() ?? '—'
  const setupPrompt = t(
    'Use Flatkey data tools from {{url}} with my existing API key, then',
    { url: dataToolsUrl }
  )
  const promptExamples = [
    t(
      'Find the TikTok videos trending for #skincare this week, and tell me which three have the strongest engagement.'
    ),
    t(
      'Pull an Instagram creator profile and their recent posts, then report follower growth and top themes.'
    ),
    t(
      'Fetch the latest Amazon reviews for ASIN B08N5WRWNW, then summarize sentiment and repeated complaints.'
    ),
  ]

  let keyStatus
  if (apiKeysQuery.isPending) {
    keyStatus = t('Checking your API key...')
  } else if (apiKeyCount > 0) {
    keyStatus = t('Your key is ready')
  } else {
    keyStatus = (
      <Link
        to='/keys'
        className='hover:text-foreground underline underline-offset-4'
      >
        {t('Create an API key to get started')}
      </Link>
    )
  }

  return (
    <Main className='overflow-auto'>
      <div className='mx-auto flex min-h-full w-full max-w-6xl items-center px-5 py-12 sm:px-8 lg:py-16'>
        <section className='grid w-full gap-9 font-sans'>
          <div>
            <div className='text-muted-foreground flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-sm'>
              {apiKeyCount > 0 ? (
                <CheckCircle2 className='size-5 text-emerald-500' />
              ) : (
                <KeyRound className='text-primary size-5' />
              )}
              {keyStatus}
            </div>

            <h1 className='mt-6 max-w-4xl text-4xl leading-[1.04] font-semibold tracking-[-0.035em] sm:text-5xl lg:text-6xl'>
              {t('Put {{count}} APIs to work in one prompt.', {
                count: toolCount,
              })}
            </h1>
            <p className='text-muted-foreground mt-5 max-w-3xl text-base leading-7 sm:text-lg'>
              {t(
                'Copy one into Claude, ChatGPT, or your coding agent. It connects Flatkey with the key you already have, then runs your first call.'
              )}
            </p>
          </div>

          <div className='animate-in fade-in slide-in-from-bottom-3 relative overflow-hidden rounded-[28px] border border-violet-300/10 bg-[#170b2b] text-[#f4effc] shadow-[0_28px_70px_-34px_rgba(40,18,68,0.75)] duration-500'>
            <div
              aria-hidden='true'
              className='pointer-events-none absolute -top-32 left-1/2 h-64 w-3/4 -translate-x-1/2 rounded-full bg-violet-400/10 blur-3xl'
            />
            <div className='relative px-6 pt-7 pb-5 font-mono text-base text-[#9e93ad] sm:px-9 sm:text-lg'>
              <span className='mr-3 text-[#756987]'>&gt;</span>
              /flatkey-tools
            </div>
            <div className='relative mx-3 mb-3 overflow-hidden rounded-2xl border border-white/[0.04] bg-[#241636] sm:mx-4 sm:mb-4'>
              {promptExamples.map((prompt) => (
                <div
                  key={prompt}
                  className='group flex min-h-20 items-center gap-3 border-b border-white/10 px-5 py-5 transition-colors duration-200 last:border-b-0 hover:bg-[#2d1d41] sm:px-8'
                >
                  <p className='min-w-0 flex-1 truncate font-mono text-base leading-7 text-[#eee9f4] sm:text-lg'>
                    {prompt}
                  </p>
                  <CopyButton
                    value={`${setupPrompt}\n\n${prompt}`}
                    tooltip={t('Copy prompt')}
                    successTooltip={t('Copied!')}
                    aria-label={t('Copy prompt')}
                    className='group/copy size-10 rounded-xl text-[#a69daf] opacity-75 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/10 hover:text-white hover:opacity-100 active:translate-y-0 active:scale-95'
                    iconClassName='animate-in zoom-in-75 size-[19px] duration-200 group-hover/copy:scale-110'
                  />
                </div>
              ))}
            </div>
          </div>

          <Link
            to='/api-marketplace'
            className='text-muted-foreground hover:border-foreground/30 hover:bg-muted hover:text-foreground w-fit rounded-full border px-4 py-2 text-sm transition-colors'
          >
            {t('Or browse all endpoints')}
          </Link>
        </section>
      </div>
    </Main>
  )
}
