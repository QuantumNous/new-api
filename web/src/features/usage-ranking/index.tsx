import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { SectionPageLayout } from '@/components/layout'
import { api } from '@/lib/api'

type RankingRow = { rank?: number; username?: string; request_count?: number; quota?: number; prompt_tokens?: number; completion_tokens?: number }
export function UsageRanking() {
  const { t } = useTranslation()
  const query = useQuery({ queryKey: ['usage-ranking'], queryFn: async () => (await api.get<{ data?: RankingRow[] }>('/api/log/ranking')).data.data ?? [] })
  return <SectionPageLayout><SectionPageLayout.Title>{t('Usage ranking')}</SectionPageLayout.Title><SectionPageLayout.Content><div className='overflow-auto rounded-lg border'><table className='w-full text-sm'><thead><tr className='border-b text-left'><th className='p-3'>{t('Rank')}</th><th className='p-3'>{t('User')}</th><th className='p-3'>{t('Quota')}</th><th className='p-3'>{t('Prompt tokens')}</th><th className='p-3'>{t('Requests')}</th></tr></thead><tbody>{query.data?.map((row, i) => <tr className='border-b' key={`${row.rank ?? i}-${row.username ?? ''}`}><td className='p-3'>{row.rank ?? i + 1}</td><td className='p-3'>{row.username ?? '-'}</td><td className='p-3'>{row.quota ?? '-'}</td><td className='p-3'>{row.prompt_tokens ?? '-'}</td><td className='p-3'>{row.request_count ?? '-'}</td></tr>)}</tbody></table>{query.isLoading && <p className='p-4'>{t('Loading')}</p>}{query.isError && <p className='p-4 text-destructive'>{t('Unable to load rankings')}</p>}</div></SectionPageLayout.Content></SectionPageLayout>
}
