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
import { useTranslation } from 'react-i18next'

import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { Markdown } from '@/components/ui/markdown'

import { findMarketplaceVersion } from '../lib/marketplace'
import {
  documentLocale,
  PluginDocumentFormatError,
} from '../lib/plugin-document'
import { describePluginDocumentProblem } from '../lib/plugin-document-problem'
import { fetchPluginReadme } from '../lib/plugin-readme'
import type { MarketplacePlugin } from '../types'

type PluginReadmeSectionProps = {
  indexUrl: string
  plugin: MarketplacePlugin
  version: string
}

/** The selected version's usage guide, loaded when the details tab shows. */
export function PluginReadmeSection(props: PluginReadmeSectionProps) {
  const { t, i18n } = useTranslation()
  const locale = documentLocale(i18n.language)
  const readme = findMarketplaceVersion(props.plugin, props.version)?.readme
  const query = useQuery({
    queryKey: [
      'task-plugin-marketplace-readme',
      props.indexUrl,
      props.plugin.key,
      props.version,
      readme?.path,
      readme?.sha256,
      locale,
    ],
    queryFn: ({ signal }) =>
      fetchPluginReadme({ ...props, language: locale, signal }),
    enabled: Boolean(readme),
    staleTime: 15 * 60 * 1000,
    retry: false,
    meta: { errorToast: false },
  })

  if (readme && query.data) {
    return (
      <section
        aria-label={t('Usage guide')}
        className='min-w-0 space-y-2 rounded-lg border p-4'
      >
        {locale !== 'en' && query.data.locale === 'en' && (
          <p role='status' className='text-muted-foreground text-xs'>
            {t(
              'This usage guide is not available in your language. Showing English.'
            )}
          </p>
        )}
        {/* Headings stay below the dialog title. Narrow tables scroll: cells
            align to the top and keep words and inline code whole. */}
        <div lang={query.data.locale}>
          <Markdown
            baseUrl={query.data.sourceUrl}
            className='[&_h1]:mb-2 [&_h1]:text-base [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-sm [&_h3]:mt-4 [&_h3]:text-sm [&_td]:align-top [&_td]:[overflow-wrap:normal] [&_td_code]:whitespace-nowrap [&_th]:align-top [&_th]:[overflow-wrap:normal]'
          >
            {query.data.markdown}
          </Markdown>
        </div>
      </section>
    )
  }
  if (readme && query.isPending) {
    return <LoadingState inline size='sm' message={t('Loading...')} />
  }
  if (query.error instanceof PluginDocumentFormatError) {
    return (
      <p className='text-muted-foreground text-xs leading-relaxed'>
        {t('Could not show the usage guide. {{problem}}', {
          problem: describePluginDocumentProblem(t, query.error),
        })}{' '}
        <a
          href={query.error.sourceUrl}
          target='_blank'
          rel='noopener noreferrer'
          className='hover:text-foreground underline underline-offset-2'
        >
          {t('View source file')}
        </a>
      </p>
    )
  }
  if (query.isError) {
    return (
      <ErrorState
        className='min-h-0 border p-3'
        title={t('Could not load the usage guide')}
        onRetry={() => void query.refetch()}
      />
    )
  }
  return (
    <p className='text-muted-foreground text-xs'>
      {t('No usage guide for this version.')}
    </p>
  )
}
