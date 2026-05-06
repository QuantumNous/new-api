import { useEffect, useState } from 'react'
import { Save, Settings2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  CONSUMPTION_DISTRIBUTION_CHART_OPTIONS,
  MODEL_ANALYTICS_CHART_OPTIONS,
  TIME_GRANULARITY_OPTIONS,
  TIME_RANGE_PRESETS,
} from '@/features/dashboard/constants'
import type {
  ConsumptionDistributionChartType,
  DashboardChartPreferences,
  ModelAnalyticsChartTab,
} from '@/features/dashboard/types'
import type { TimeGranularity } from '@/lib/time'

interface ModelsChartPreferencesProps {
  preferences: DashboardChartPreferences
  onPreferencesChange: (preferences: DashboardChartPreferences) => void
}

export function ModelsChartPreferences(props: ModelsChartPreferencesProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<DashboardChartPreferences>(
    props.preferences
  )

  useEffect(() => {
    if (open) setDraft(props.preferences)
  }, [open, props.preferences])

  const handleSave = () => {
    props.onPreferencesChange(draft)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant='outline' size='sm'>
          <Settings2 className='mr-2 h-4 w-4' />
          {t('Preferences')}
        </Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{t('Dashboard Preferences')}</DialogTitle>
          <DialogDescription>
            {t(
              'Choose the default charts, range, and time granularity for model analytics.'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className='grid gap-4 py-2'>
          <div className='grid gap-2'>
            <Label htmlFor='default-time-range'>{t('Default range')}</Label>
            <Select
              value={String(draft.defaultTimeRangeDays)}
              onValueChange={(value) =>
                setDraft((prev) => ({
                  ...prev,
                  defaultTimeRangeDays: Number(value),
                }))
              }
            >
              <SelectTrigger id='default-time-range'>
                <SelectValue placeholder={t('Select default range')} />
              </SelectTrigger>
              <SelectContent>
                {TIME_RANGE_PRESETS.map((option) => (
                  <SelectItem key={option.days} value={String(option.days)}>
                    {t(option.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className='grid gap-2'>
            <Label htmlFor='default-time-granularity'>
              {t('Default time granularity')}
            </Label>
            <Select
              value={draft.defaultTimeGranularity}
              onValueChange={(value) =>
                setDraft((prev) => ({
                  ...prev,
                  defaultTimeGranularity: value as TimeGranularity,
                }))
              }
            >
              <SelectTrigger id='default-time-granularity'>
                <SelectValue placeholder={t('Select time granularity')} />
              </SelectTrigger>
              <SelectContent>
                {TIME_GRANULARITY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {t(option.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className='grid gap-2'>
            <Label htmlFor='consumption-distribution-chart'>
              {t('Default consumption chart')}
            </Label>
            <Select
              value={draft.consumptionDistributionChart}
              onValueChange={(value) =>
                setDraft((prev) => ({
                  ...prev,
                  consumptionDistributionChart:
                    value as ConsumptionDistributionChartType,
                }))
              }
            >
              <SelectTrigger id='consumption-distribution-chart'>
                <SelectValue placeholder={t('Select default chart')} />
              </SelectTrigger>
              <SelectContent>
                {CONSUMPTION_DISTRIBUTION_CHART_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className='grid gap-2'>
            <Label htmlFor='model-analytics-chart'>
              {t('Default model call chart')}
            </Label>
            <Select
              value={draft.modelAnalyticsChart}
              onValueChange={(value) =>
                setDraft((prev) => ({
                  ...prev,
                  modelAnalyticsChart: value as ModelAnalyticsChartTab,
                }))
              }
            >
              <SelectTrigger id='model-analytics-chart'>
                <SelectValue placeholder={t('Select default chart')} />
              </SelectTrigger>
              <SelectContent>
                {MODEL_ANALYTICS_CHART_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSave} type='button'>
            <Save className='mr-2 h-4 w-4' />
            {t('Save Preferences')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
