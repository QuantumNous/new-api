import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  getSystemOptions,
  updateSystemOption,
} from '@/features/system-settings/api'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface EditPricingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  modelName: string
  onSaved: () => void
}

type Mode = 'per-token' | 'per-request'

// Read one ratio/price map (JSON-string option) by key from the option list.
function readMap(
  arr: { key: string; value: string }[],
  key: string
): Record<string, number> {
  const raw = arr.find((o) => o.key === key)?.value
  try {
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function EditPricingDialog({
  open,
  onOpenChange,
  modelName,
  onSaved,
}: EditPricingDialogProps) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<Mode>('per-token')
  const [ratio, setRatio] = useState('')
  const [completionRatio, setCompletionRatio] = useState('')
  const [price, setPrice] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !modelName) return
    let alive = true
    ;(async () => {
      try {
        const res = await getSystemOptions()
        if (!alive) return
        const arr = res.data ?? []
        const mr = readMap(arr, 'ModelRatio')
        const cr = readMap(arr, 'CompletionRatio')
        const mp = readMap(arr, 'ModelPrice')
        const hasPrice = mp[modelName] !== undefined && mp[modelName] !== ''
        setMode(hasPrice ? 'per-request' : 'per-token')
        setRatio(mr[modelName] != null ? String(mr[modelName]) : '')
        setCompletionRatio(cr[modelName] != null ? String(cr[modelName]) : '')
        setPrice(hasPrice ? String(mp[modelName]) : '')
      } catch {
        // ignore load errors
      }
    })()
    return () => {
      alive = false
    }
  }, [open, modelName])

  const toNum = (s: string): number | null => {
    if (s === '') return null
    const n = Number(s)
    return Number.isFinite(n) ? n : null
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Re-read latest maps to avoid clobbering other models' entries.
      const res = await getSystemOptions()
      const arr = res.data ?? []
      const mr = readMap(arr, 'ModelRatio')
      const cr = readMap(arr, 'CompletionRatio')
      const mp = readMap(arr, 'ModelPrice')

      if (mode === 'per-token') {
        const r = toNum(ratio)
        if (r == null || r <= 0) {
          throw new Error(t('Please enter a valid input ratio'))
        }
        mr[modelName] = r
        const c = toNum(completionRatio)
        if (c != null) cr[modelName] = c
        else delete cr[modelName]
        delete mp[modelName]
      } else {
        const p = toNum(price)
        if (p == null || p < 0) {
          throw new Error(t('Please enter a valid fixed price'))
        }
        mp[modelName] = p
        delete mr[modelName]
        delete cr[modelName]
      }

      // UpdateOptionRequest is a single {key, value}; one call per map.
      // Backend (model/option.go) refreshes in-memory ratio maps immediately
      // on each PUT, so the change takes effect for the next request.
      await updateSystemOption({
        key: 'ModelRatio',
        value: JSON.stringify(mr),
      })
      await updateSystemOption({
        key: 'CompletionRatio',
        value: JSON.stringify(cr),
      })
      await updateSystemOption({
        key: 'ModelPrice',
        value: JSON.stringify(mp),
      })

      toast.success(t('Pricing saved — takes effect immediately'))
      onSaved()
      onOpenChange(false)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('Save failed')
      toast.error(msg || t('Save failed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t('Edit Pricing')} — {modelName}
          </DialogTitle>
        </DialogHeader>
        <div className='space-y-4'>
          <div className='flex gap-2'>
            <Button
              variant={mode === 'per-token' ? 'default' : 'outline'}
              size='sm'
              onClick={() => setMode('per-token')}
            >
              {t('Per-token')}
            </Button>
            <Button
              variant={mode === 'per-request' ? 'default' : 'outline'}
              size='sm'
              onClick={() => setMode('per-request')}
            >
              {t('Per-request')}
            </Button>
          </div>
          {mode === 'per-token' ? (
            <>
              <div className='space-y-1.5'>
                <label className='text-sm font-medium'>
                  {t('Input ratio (ModelRatio)')}
                </label>
                <Input
                  value={ratio}
                  onChange={(e) => setRatio(e.target.value)}
                  placeholder='1'
                />
              </div>
              <div className='space-y-1.5'>
                <label className='text-sm font-medium'>
                  {t('Completion ratio')}
                </label>
                <Input
                  value={completionRatio}
                  onChange={(e) => setCompletionRatio(e.target.value)}
                  placeholder='2'
                />
              </div>
            </>
          ) : (
            <div className='space-y-1.5'>
              <label className='text-sm font-medium'>
                {t('Fixed price ($) per call')}
              </label>
              <Input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder='0.01'
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            {t('Cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t('Saving...') : t('Save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
