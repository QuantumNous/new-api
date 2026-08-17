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
import { Download, FileText, Loader2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { SectionPageLayout } from '@/components/layout'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { TitledCard } from '@/components/ui/titled-card'

import { downloadMezonTopupReport, getMezonTopupReport } from './api'
import { ReportTable } from './components/report-table'
import { getCurrentReportMonth, parseReportMonth } from './lib'

export function TopupReports() {
  const { t } = useTranslation()
  const [selectedMonth, setSelectedMonth] = useState(getCurrentReportMonth)
  const [downloading, setDownloading] = useState(false)
  const { year, month } = parseReportMonth(selectedMonth)
  const validMonth =
    Number.isInteger(year) &&
    Number.isInteger(month) &&
    year >= 2020 &&
    year <= 2100 &&
    month >= 1 &&
    month <= 12
  const reportQuery = useQuery({
    queryKey: ['mezon-topup-report', year, month],
    queryFn: () => getMezonTopupReport(year, month),
    enabled: validMonth,
  })

  const handleDownload = async () => {
    try {
      setDownloading(true)
      await downloadMezonTopupReport(year, month)
    } catch {
      toast.error(t('Failed to download PDF report'))
    } finally {
      setDownloading(false)
    }
  }

  let reportContent: ReactNode = null
  if (reportQuery.isLoading) {
    reportContent = (
      <div className='space-y-2'>
        <Skeleton className='h-10 w-full' />
        <Skeleton className='h-52 w-full' />
      </div>
    )
  } else if (reportQuery.isError) {
    reportContent = (
      <Alert variant='destructive'>
        <AlertDescription>
          {t('Failed to load Mezon top-up report')}
        </AlertDescription>
      </Alert>
    )
  } else if (reportQuery.data) {
    reportContent = <ReportTable report={reportQuery.data} />
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        {t('Mezon Top-up Reports')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <TitledCard
          title={t('Monthly transaction report')}
          description={t(
            'Review Mezon đồng top-ups and export a PDF for reconciliation.'
          )}
          icon={<FileText className='h-4 w-4' />}
          iconTone='primary'
          disableHoverEffect
          action={
            <Button
              onClick={handleDownload}
              disabled={downloading || reportQuery.isLoading || !validMonth}
              className='w-full gap-2 sm:w-auto'
            >
              {downloading ? (
                <Loader2 className='h-4 w-4 animate-spin' />
              ) : (
                <Download className='h-4 w-4' />
              )}
              {t('Export PDF')}
            </Button>
          }
          contentClassName='space-y-4'
        >
          <div className='max-w-xs space-y-2'>
            <Label htmlFor='report-month'>{t('Report month')}</Label>
            <Input
              id='report-month'
              type='month'
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              min='2020-01'
              max='2100-12'
            />
          </div>

          {reportContent}
        </TitledCard>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
