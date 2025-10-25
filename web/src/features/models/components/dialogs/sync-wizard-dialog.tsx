import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, RefreshCw } from 'lucide-react'
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
import { syncUpstream, previewUpstreamDiff } from '../../api'
import { SYNC_LOCALE_OPTIONS } from '../../constants'
import { modelsQueryKeys, vendorsQueryKeys } from '../../lib'
import type { SyncLocale } from '../../types'

type SyncWizardDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SyncWizardDialog({
  open,
  onOpenChange,
}: SyncWizardDialogProps) {
  const queryClient = useQueryClient()
  const [locale, setLocale] = useState<SyncLocale>('zh')
  const [isSyncing, setIsSyncing] = useState(false)

  const handleSync = async () => {
    setIsSyncing(true)
    try {
      // First preview to check for conflicts
      const previewRes = await previewUpstreamDiff({ locale })

      if (previewRes.data?.conflicts && previewRes.data.conflicts.length > 0) {
        toast.warning(
          `Found ${previewRes.data.conflicts.length} conflicts. Please resolve them first.`
        )
        // TODO: Open conflict dialog
        return
      }

      // No conflicts, proceed with sync
      const response = await syncUpstream({ locale })

      if (response.success) {
        const { created_models, created_vendors } = response.data || {}
        toast.success(
          `Sync completed! Created ${created_models || 0} models and ${created_vendors || 0} vendors.`
        )
        queryClient.invalidateQueries({ queryKey: modelsQueryKeys.lists() })
        queryClient.invalidateQueries({ queryKey: vendorsQueryKeys.lists() })
        onOpenChange(false)
      } else {
        toast.error(response.message || 'Sync failed')
      }
    } catch (error: any) {
      toast.error(error?.message || 'Sync failed')
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sync Upstream Models</DialogTitle>
          <DialogDescription>
            Synchronize models from the official upstream repository
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-4'>
          <div className='space-y-2'>
            <Label>Select Language</Label>
            <RadioGroup
              value={locale}
              onValueChange={(v) => setLocale(v as SyncLocale)}
            >
              {SYNC_LOCALE_OPTIONS.map((option) => (
                <div key={option.value} className='flex items-center space-x-2'>
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
              This will fetch missing models and vendors from the official
              repository. Existing models will not be modified.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={isSyncing}
          >
            Cancel
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
