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
import { AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

import { buildPricingScenarios, type PricingResult } from '../lib/calculation'

type CalculatorResultsProps = {
  result: PricingResult
  manualRatio: number
}

const formatMoney = (value: number) =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)

const formatNumber = (value: number, digits = 2) =>
  new Intl.NumberFormat(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)

const formatRatio = (value: number) => `${value.toFixed(4)}x`

const formatMargin = (value: number | null) =>
  value === null ? '—' : `${(value * 100).toFixed(1)}%`

function ResultValue(props: {
  label: string
  value: string
  description: string
  positive?: boolean
}) {
  return (
    <div className='bg-card space-y-1 p-4'>
      <div className='text-muted-foreground text-xs'>{props.label}</div>
      <div
        className={cn(
          'text-lg font-semibold tabular-nums',
          props.positive === true && 'text-emerald-600 dark:text-emerald-400',
          props.positive === false && 'text-destructive'
        )}
      >
        {props.value}
      </div>
      <div className='text-muted-foreground text-xs'>{props.description}</div>
    </div>
  )
}

export function CalculatorResults(props: CalculatorResultsProps) {
  const { t } = useTranslation()
  const scenarios = buildPricingScenarios(props.result, props.manualRatio)
  const coversCost = props.manualRatio >= props.result.breakEvenRatio

  return (
    <Card>
      <CardHeader className='border-b'>
        <CardTitle>{t('Pricing result')}</CardTitle>
        <CardDescription>
          {t('All results are estimates for internal pricing decisions.')}
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-5'>
        <div className='bg-primary/5 ring-primary/15 flex flex-wrap items-center justify-between gap-4 rounded-xl p-4 ring-1'>
          <div>
            <div className='text-muted-foreground text-xs'>
              {t('Suggested ratio at target margin')}
            </div>
            <div className='mt-1 text-3xl font-bold tracking-tight tabular-nums'>
              {formatRatio(props.result.targetMarginRatio)}
            </div>
          </div>
          <Badge variant={coversCost ? 'secondary' : 'destructive'}>
            {coversCost ? t('Cost covered') : t('Below break-even')}
          </Badge>
        </div>

        <div className='bg-border grid gap-px overflow-hidden rounded-xl border sm:grid-cols-2'>
          <ResultValue
            label={t('Full account-period A')}
            value={formatNumber(props.result.fullPeriodStandardUsage)}
            description={t('Observed A divided by consumed percentage')}
          />
          <ResultValue
            label={t('Accounting-period A')}
            value={formatNumber(props.result.billingPeriodStandardUsage)}
            description={t('{{count}} account equivalents', {
              count: formatNumber(props.result.accountEquivalents),
            })}
          />
          <ResultValue
            label={t('Revenue at manual ratio')}
            value={formatMoney(props.result.revenue)}
            description={t('A multiplied by the manual ratio')}
          />
          <ResultValue
            label={t('Gross profit at manual ratio')}
            value={formatMoney(props.result.grossProfit)}
            description={t('Gross margin: {{margin}}', {
              margin: formatMargin(props.result.grossMargin),
            })}
            positive={props.result.grossProfit >= 0}
          />
        </div>

        <div>
          <div className='mb-2 flex items-center justify-between gap-3'>
            <h3 className='text-sm font-medium'>{t('Ratio scenarios')}</h3>
            <span className='text-muted-foreground text-xs'>
              {t('Same usage pool, different ratios')}
            </span>
          </div>
          <div className='overflow-hidden rounded-xl border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('Ratio')}</TableHead>
                  <TableHead className='text-right'>{t('Revenue')}</TableHead>
                  <TableHead className='text-right'>
                    {t('Gross profit')}
                  </TableHead>
                  <TableHead className='text-right'>
                    {t('Gross margin')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scenarios.map((scenario) => (
                  <TableRow key={scenario.ratio}>
                    <TableCell className='font-medium'>
                      {formatRatio(scenario.ratio)}
                    </TableCell>
                    <TableCell className='text-right'>
                      {formatMoney(scenario.revenue)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right font-medium',
                        scenario.grossProfit >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-destructive'
                      )}
                    >
                      {formatMoney(scenario.grossProfit)}
                    </TableCell>
                    <TableCell className='text-right'>
                      {formatMargin(scenario.grossMargin)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className='bg-muted/40 space-y-1 rounded-xl border p-4 font-mono text-xs leading-6'>
          <div>
            {t('Full account-period A = observed A / consumed percentage')}
          </div>
          <div>
            {t('Break-even ratio = account cost / full account-period A')}
          </div>
          <div>{t('U = A × group ratio')}</div>
        </div>

        <Alert>
          <AlertTriangle aria-hidden='true' />
          <AlertTitle>{t('Estimation notice')}</AlertTitle>
          <AlertDescription>
            {t(
              'Quota percentages may be rounded. Add failure, server, payment, and support costs before publishing a ratio.'
            )}
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}
