import { ExternalLink, Rocket } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { formatTokens } from '../lib/format'
import type { AppListing } from '../types'
import { GrowthText } from './growth-text'

type AppsSectionProps = {
  rows: AppListing[]
}

/**
 * "Top Apps" card — clean two-column listing of the apps consuming the
 * most tokens through new-api in the active period. Apps don't get a
 * dedicated chart (each app has too much variance to plot meaningfully);
 * instead we keep the focus on the leaderboard itself.
 */
export function AppsSection(props: AppsSectionProps) {
  const { t } = useTranslation()

  const half = Math.ceil(props.rows.length / 2)
  const left = props.rows.slice(0, half)
  const right = props.rows.slice(half)

  return (
    <section className='bg-card overflow-hidden rounded-lg border'>
      <header className='px-5 py-4'>
        <h2 className='text-foreground inline-flex items-center gap-2 text-base font-semibold'>
          <Rocket className='text-primary size-4' />
          {t('Top Apps')}
        </h2>
        <p className='text-muted-foreground mt-1 text-sm'>
          {t('Apps using the most tokens through new-api')}
        </p>
      </header>
      {props.rows.length === 0 ? (
        <div className='text-muted-foreground/80 border-t px-5 py-8 text-center text-sm'>
          {t('No apps match the selected filters')}
        </div>
      ) : (
        <div className='grid grid-cols-1 gap-x-8 border-t px-5 pt-3 pb-4 md:grid-cols-2'>
          <AppList rows={left} />
          {right.length > 0 && <AppList rows={right} />}
        </div>
      )}
    </section>
  )
}

function AppList(props: { rows: AppListing[] }) {
  return (
    <ul>
      {props.rows.map((row) => (
        <li key={row.name} className='flex items-center gap-3 py-2.5'>
          <span className='text-muted-foreground/80 w-6 shrink-0 text-right font-mono text-xs tabular-nums'>
            {row.rank}.
          </span>
          <span className='bg-muted text-muted-foreground inline-flex size-9 shrink-0 items-center justify-center rounded-md text-sm font-bold uppercase'>
            {row.initial}
          </span>
          <div className='min-w-0 flex-1'>
            <div className='flex items-center gap-2 text-sm font-semibold'>
              {row.url ? (
                <a
                  href={row.url}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-foreground hover:text-primary inline-flex items-center gap-1 truncate transition-colors'
                >
                  <span className='truncate'>{row.name}</span>
                  <ExternalLink className='text-muted-foreground/60 size-3 shrink-0' />
                </a>
              ) : (
                <span className='text-foreground truncate'>{row.name}</span>
              )}
              <Badge
                variant='outline'
                className='h-4 shrink-0 rounded-sm px-1 text-[10px] font-normal'
              >
                {row.category}
              </Badge>
            </div>
            <p className='text-muted-foreground/80 truncate text-xs'>
              {row.description}
            </p>
          </div>
          <div className='shrink-0 text-right'>
            <div className='text-foreground font-mono text-sm font-semibold tabular-nums'>
              {formatTokens(row.total_tokens)}
            </div>
            <GrowthText value={row.growth_pct} className='text-[11px]' />
          </div>
        </li>
      ))}
    </ul>
  )
}
