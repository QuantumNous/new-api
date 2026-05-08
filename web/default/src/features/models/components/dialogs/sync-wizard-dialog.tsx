import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { StatusBadge } from '@/components/status-badge'
import { syncUpstream, previewUpstreamDiff } from '../../api'
import { getSyncLocaleOptions, getSyncSourceOptions } from '../../constants'
import { modelsQueryKeys, vendorsQueryKeys } from '../../lib'
import type { SyncLocale, SyncSource } from '../../types'
import { useModels } from '../models-provider'

type SyncWizardDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SyncWizardDialog({
  open,
  onOpenChange,
}: SyncWizardDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const {
    setOpen,
    setUpstreamConflicts,
    setSyncWizardOptions,
    syncWizardOptions,
  } = useModels()
  const isMobile = useIsMobile()
  const [locale, setLocale] = useState<SyncLocale>('zh')
  const [source, setSource] = useState<SyncSource>('official')
  const [isSyncing, setIsSyncing] = useState(false)

  // Get translated options
  const SYNC_SOURCE_OPTIONS = getSyncSourceOptions(t)
  const SYNC_LOCALE_OPTIONS = getSyncLocaleOptions(t)

  useEffect(() => {
    if (open) {
      setLocale(syncWizardOptions.locale || 'zh')
      const preferredSource = SYNC_SOURCE_OPTIONS.find(
        (option) => option.value === syncWizardOptions.source
      )
      setSource(
        preferredSource && !preferredSource.disabled
          ? (preferredSource.value as SyncSource)
          : 'official'
      )
    }
  }, [open, syncWizardOptions, SYNC_SOURCE_OPTIONS])

  const handleSync = async () => {
    setIsSyncing(true)
    try {
      setSyncWizardOptions({ locale, source })
      const previewRes = await previewUpstreamDiff({ locale, source })

      if (!previewRes.success) {
        throw new Error(previewRes.message || 'Failed to preview upstream diff')
      }

      const conflicts = previewRes.data?.conflicts || []

      if (conflicts.length > 0) {
        toast.warning(
          `Found ${conflicts.length} conflict${conflicts.length > 1 ? 's' : ''}. Please resolve them first.`
        )
        setUpstreamConflicts(conflicts)
        setOpen('upstream-conflict')
        return
      }

      // No conflicts, proceed with sync
      const response = await syncUpstream({ locale, source })

      if (response.success) {
        const { created_models, created_vendors, updated_models } =
          response.data || {}
        toast.success(
          `Sync completed! Created ${created_models || 0} models, updated ${updated_models || 0}, and added ${created_vendors || 0} vendors.`
        )
        queryClient.invalidateQueries({ queryKey: modelsQueryKeys.lists() })
        queryClient.invalidateQueries({ queryKey: vendorsQueryKeys.lists() })
        onOpenChange(false)
      } else {
        toast.error(response.message || 'Sync failed')
      }
    } catch (error: unknown) {
      toast.error((error as Error)?.message || 'Sync failed')
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className='flex max-h-[90vh] w-full flex-col gap-4 p-4 sm:max-w-2xl sm:p-6'
        initialFocus={!isMobile}
      >
        <DialogHeader className='flex-shrink-0 text-start'>
          <DialogTitle>{t('Sync Upstream Models')}</DialogTitle>
          <DialogDescription>
            {t('Synchronize models and vendors from an upstream source')}
          </DialogDescription>
        </DialogHeader>

        <div className='flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto'>
          <div className='space-y-3'>
            <div>
              <Label className='text-base'>{t('Select Sync Source')}</Label>
              <p className='text-muted-foreground text-sm'>
                {t('Choose where to fetch upstream metadata.')}
              </p>
            </div>
            <RadioGroup
              value={source}
              onValueChange={(value) => {
                const selected = SYNC_SOURCE_OPTIONS.find(
                  (option) => option.value === value
                )
                if (!selected || selected.disabled) return
                setSource(selected.value)
              }}
              className='grid gap-3 md:grid-cols-2'
            >
              {SYNC_SOURCE_OPTIONS.map((option) => {
                const isActive = source === option.value
                const isDisabled = option.disabled
                return (
                  <Label
                    key={option.value}
                    htmlFor={`sync-source-${option.value}`}
                    className={cn(
                      'flex-col items-start gap-0 rounded-lg border p-4 font-normal transition-all',
                      isActive && 'border-primary ring-primary ring-1',
                      isDisabled
                        ? 'cursor-not-allowed opacity-60'
                        : 'hover:border-primary/60 cursor-pointer'
                    )}
                  >
                    <div className='flex items-start gap-3'>
                      <RadioGroupItem
                        value={option.value}
                        id={`sync-source-${option.value}`}
                        disabled={isDisabled}
                      />
                      <div className='space-y-1'>
                        <div className='flex items-center gap-2'>
                          <span className='font-medium'>{option.label}</span>
                          {option.value === 'official' && (
                            <StatusBadge
                              label='Default'
                              variant='neutral'
                              copyable={false}
                            />
                          )}
                        </div>
                        <p className='text-muted-foreground text-sm'>
                          {option.description}
                        </p>
                      </div>
                    </div>
                  </Label>
                )
              })}
            </RadioGroup>
          </div>

          <div className='space-y-2'>
            <Label className='text-base'>{t('Select Language')}</Label>
            <RadioGroup
              value={locale}
              onValueChange={(v) => setLocale(v as SyncLocale)}
              className='grid gap-3 sm:grid-cols-3'
            >
              {SYNC_LOCALE_OPTIONS.map((option) => (
                <div
                  key={option.value}
                  className='flex items-center space-x-2 rounded-lg border p-3'
                >
                  <RadioGroupItem
                    value={option.value}
                    id={`locale-${option.value}`}
                  />
                  <Label
                    htmlFor={`locale-${option.value}`}
                    className='cursor-pointer font-normal'
                  >
                    {option.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className='bg-muted/50 rounded-lg border p-4'>
            <p className='text-muted-foreground text-sm'>
              {t(
                'The sync will fetch missing models and vendors from the selected source. Existing records are updated only when you approve conflicts.'
              )}
            </p>
          </div>
        </div>

        <DialogFooter className='flex-shrink-0 gap-2 sm:justify-end'>
          <Button
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={isSyncing}
          >
            {t('Cancel')}
          </Button>
          <Button onClick={handleSync} disabled={isSyncing}>
            {isSyncing && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            <RefreshCw className='mr-2 h-4 w-4' />
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
