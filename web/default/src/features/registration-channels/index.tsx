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
import { RefreshCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SectionPageLayout } from '@/components/layout'

type ChannelStat = {
  channel: string
  registered_count: number
  paying_count: number
  topup_amount: number
  uv: number
  pv: number
}

const RANGES = [1, 7, 14, 29]

export function RegistrationChannels() {
  const { t } = useTranslation()
  const [stats, setStats] = useState<ChannelStat[]>([])
  const [loading, setLoading] = useState(false)
  const [days, setDays] = useState(1)
  const [search, setSearch] = useState('')

  const fetchStats = async (d: number) => {
    setLoading(true)
    try {
      const res = await api.get('/api/admin/registration-channels', {
        params: { days: d },
      })
      if (res.data?.success) {
        setStats(res.data.data?.items ?? [])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats(days)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days])

  // direct is rendered as 自然流量; everything else (ch name / inviter email) as-is.
  const channelLabel = (channel: string) =>
    channel === 'direct' ? t('Organic traffic') : channel

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return stats
    return stats.filter((s) => channelLabel(s.channel).toLowerCase().includes(q))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats, search])

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        {t('Registration Channels')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Description>
        {t('Registrations and topups by acquisition source.')}
      </SectionPageLayout.Description>
      <SectionPageLayout.Actions>
        <Button
          variant='outline'
          onClick={() => fetchStats(days)}
          disabled={loading}
        >
          <RefreshCcw className={cn(loading && 'animate-spin')} />
          {t('Refresh')}
        </Button>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='mb-3 flex flex-wrap items-center justify-between gap-3'>
          <div className='inline-flex items-center gap-1 rounded-lg border p-1'>
            {RANGES.map((d) => (
              <Button
                key={d}
                size='sm'
                variant={d === days ? 'default' : 'ghost'}
                onClick={() => setDays(d)}
              >
                {d} {t('days')}
              </Button>
            ))}
          </div>
          <Input
            className='max-w-[240px]'
            placeholder={t('Search channel')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className='rounded-lg border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('Channel')}</TableHead>
                <TableHead className='text-right'>UV</TableHead>
                <TableHead className='text-right'>PV</TableHead>
                <TableHead className='text-right'>
                  {t('Registered Users')}
                </TableHead>
                <TableHead className='text-right'>
                  {t('Paying Users')}
                </TableHead>
                <TableHead className='text-right'>
                  {t('Topup Amount (USD)')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className='text-muted-foreground h-24 text-center'
                  >
                    {loading ? t('Loading...') : t('No data')}
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((s) => (
                <TableRow key={s.channel}>
                  <TableCell className='font-medium'>
                    {channelLabel(s.channel)}
                  </TableCell>
                  <TableCell className='text-right'>
                    {s.uv > 0 ? s.uv : '—'}
                  </TableCell>
                  <TableCell className='text-right'>
                    {s.pv > 0 ? s.pv : '—'}
                  </TableCell>
                  <TableCell className='text-right'>
                    {s.registered_count}
                  </TableCell>
                  <TableCell className='text-right'>{s.paying_count}</TableCell>
                  <TableCell className='text-right'>
                    {s.topup_amount > 0 ? `$${s.topup_amount}` : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
