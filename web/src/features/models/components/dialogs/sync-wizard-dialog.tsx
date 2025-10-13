import { useState, useEffect } from 'react'
import { toast } from 'sonner'
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
import { previewUpstreamDiff, syncUpstream } from '../../api'
import { ERROR_MESSAGES, SYNC_LOCALES } from '../../constants'
import { formatSyncResultMessage } from '../../lib'
import { useModels } from '../models-provider'

type SyncWizardDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SyncWizardDialog({
  open,
  onOpenChange,
}: SyncWizardDialogProps) {
  const { setOpen, setCurrentRow, triggerRefresh } = useModels()
  const [step, setStep] = useState(0)
  const [syncMode, setSyncMode] = useState<'official' | 'config'>('official')
  const [locale, setLocale] = useState('zh')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setStep(0)
      setSyncMode('official')
      setLocale('zh')
    }
  }, [open])

  const handleNext = () => {
    if (step === 0 && syncMode !== 'official') {
      toast.info('Config file sync is not available yet')
      return
    }
    setStep(1)
  }

  const handleBack = () => {
    setStep(0)
  }

  const handleConfirm = async () => {
    setIsLoading(true)

    try {
      // First preview to check for conflicts
      const diffResult = await previewUpstreamDiff(locale)

      if (!diffResult.success) {
        toast.error(diffResult.message || ERROR_MESSAGES.PREVIEW_FAILED)
        setIsLoading(false)
        return
      }

      const conflicts = diffResult.data?.conflicts || []

      if (conflicts.length > 0) {
        // Has conflicts, open conflict dialog
        setCurrentRow({ conflicts, locale } as any)
        setOpen('upstream-conflict')
        onOpenChange(false)
        setIsLoading(false)
        return
      }

      // No conflicts, proceed with sync
      const syncResult = await syncUpstream({ locale })

      if (syncResult.success) {
        const message = formatSyncResultMessage(syncResult.data || {})
        toast.success(message)
        triggerRefresh()
        onOpenChange(false)
      } else {
        toast.error(syncResult.message || ERROR_MESSAGES.SYNC_FAILED)
      }
    } catch (error) {
      toast.error(ERROR_MESSAGES.SYNC_FAILED)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sync Wizard</DialogTitle>
          <DialogDescription>
            Synchronize models and vendors from official metadata
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-6 py-4'>
          {/* Steps indicator */}
          <div className='flex items-center gap-2'>
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                step >= 0
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-muted'
              }`}
            >
              1
            </div>
            <div className='bg-muted h-0.5 flex-1' />
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                step >= 1
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-muted'
              }`}
            >
              2
            </div>
          </div>

          {/* Step 0: Select sync mode */}
          {step === 0 && (
            <div className='space-y-4'>
              <div>
                <h4 className='mb-2 font-medium'>Select Sync Source</h4>
                <RadioGroup
                  value={syncMode}
                  onValueChange={(v: any) => setSyncMode(v)}
                >
                  <div className='flex items-start space-x-3 rounded-lg border p-4'>
                    <RadioGroupItem value='official' id='official' />
                    <Label htmlFor='official' className='flex-1 cursor-pointer'>
                      <div className='font-medium'>Official Metadata</div>
                      <div className='text-muted-foreground text-sm'>
                        Sync from community-maintained metadata repository
                      </div>
                    </Label>
                  </div>
                  <div className='flex items-start space-x-3 rounded-lg border p-4 opacity-50'>
                    <RadioGroupItem value='config' id='config' disabled />
                    <Label htmlFor='config' className='flex-1'>
                      <div className='font-medium'>Configuration File</div>
                      <div className='text-muted-foreground text-sm'>
                        Sync from local configuration file (Coming soon)
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          )}

          {/* Step 1: Select language */}
          {step === 1 && (
            <div className='space-y-4'>
              <div>
                <h4 className='mb-2 font-medium'>Select Language</h4>
                <p className='text-muted-foreground mb-4 text-sm'>
                  Choose the language for model descriptions and metadata
                </p>
                <RadioGroup value={locale} onValueChange={setLocale}>
                  {SYNC_LOCALES.map((loc) => (
                    <div
                      key={loc.value}
                      className='flex items-start space-x-3 rounded-lg border p-4'
                    >
                      <RadioGroupItem value={loc.value} id={loc.value} />
                      <Label
                        htmlFor={loc.value}
                        className='flex-1 cursor-pointer'
                      >
                        <div className='font-medium'>{loc.label}</div>
                        <div className='text-muted-foreground text-sm'>
                          {loc.extra}
                        </div>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {step === 1 && (
            <Button variant='outline' onClick={handleBack} disabled={isLoading}>
              Back
            </Button>
          )}
          <Button
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          {step === 0 ? (
            <Button onClick={handleNext} disabled={syncMode !== 'official'}>
              Next
            </Button>
          ) : (
            <Button onClick={handleConfirm} disabled={isLoading}>
              {isLoading ? 'Syncing...' : 'Start Sync'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
