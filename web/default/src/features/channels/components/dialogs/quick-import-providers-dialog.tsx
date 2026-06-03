/*
"Quick Import Providers" dialog: shortcut for the operator to spin up
disabled channel skeletons for the common LLM providers in one click,
then fill keys per-channel afterwards. Faster than typing the form 10
times for an empty install.

Each created channel:
  - status = 2 (disabled) so the router won't try to dispatch traffic
    to a keyless channel
  - key = "REPLACE_WITH_YOUR_KEY" placeholder (Channel.Key must be
    non-empty per backend validateChannel; the operator edits it later)
  - group = "default"; models taken from the preset

See ./lib/provider-presets.ts for the data shape and the curated list.
*/
import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { createChannel } from '../../api'
import {
  PROVIDER_PRESETS,
  type ProviderModality,
  type ProviderPreset,
} from '../../lib/provider-presets'

const PLACEHOLDER_KEY = 'REPLACE_WITH_YOUR_KEY'

// Section order + labels (i18n keys) for the modality-grouped preset list.
const MODALITY_GROUPS: Array<{ modality: ProviderModality; label: string }> = [
  { modality: 'chat', label: 'Chat / 对话' },
  { modality: 'image', label: 'Image / 画图' },
  { modality: 'embedding', label: 'Embeddings & Audio / 向量·语音' },
]

export interface QuickImportProvidersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function QuickImportProvidersDialog({
  open,
  onOpenChange,
}: QuickImportProvidersDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [submitting, setSubmitting] = useState(false)

  const selectedCount = useMemo(
    () => Object.values(selected).filter(Boolean).length,
    [selected]
  )

  const toggle = (id: string) => {
    setSelected((s) => ({ ...s, [id]: !s[id] }))
  }

  const toggleAll = (next: boolean) => {
    setSelected(
      Object.fromEntries(PROVIDER_PRESETS.map((p) => [p.id, next]))
    )
  }

  const reset = () => {
    setSelected({})
    setSubmitting(false)
  }

  const createOne = async (preset: ProviderPreset) => {
    const result = await createChannel({
      mode: 'single',
      channel: {
        name: preset.name,
        type: preset.type,
        key: PLACEHOLDER_KEY,
        base_url: preset.baseUrl ?? '',
        models: preset.models,
        // Pre-set a cheap, right-modality test model so the channel "Test"
        // button works without the operator picking one (chat models can't
        // test image channels and vice versa).
        test_model: preset.testModel ?? '',
        group: 'default',
        status: 2, // disabled until operator fills real key
      },
    })
    if (!result?.success) {
      throw new Error(result?.message || `Failed to add ${preset.name}`)
    }
  }

  const handleSubmit = async () => {
    const picks = PROVIDER_PRESETS.filter((p) => selected[p.id])
    if (picks.length === 0) {
      toast.error(t('Pick at least one provider'))
      return
    }
    setSubmitting(true)
    let ok = 0
    const failures: string[] = []
    for (const p of picks) {
      try {
        await createOne(p)
        ok += 1
      } catch (e) {
        failures.push(`${p.name}: ${(e as Error).message}`)
      }
    }
    setSubmitting(false)
    if (failures.length === 0) {
      toast.success(
        t(
          'Imported {{n}} provider(s) as disabled channels. Edit each to add the API key.',
          { n: ok }
        )
      )
      queryClient.invalidateQueries({ queryKey: ['channels'] })
      onOpenChange(false)
      reset()
    } else {
      toast.error(
        t('Imported {{ok}}/{{total}}. Failures:\n{{msgs}}', {
          ok,
          total: picks.length,
          msgs: failures.join('\n'),
        })
      )
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!submitting) {
          if (!v) reset()
          onOpenChange(v)
        }
      }}
    >
      <DialogContent className='max-h-[90vh] overflow-hidden sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>{t('Quick Import Providers')}</DialogTitle>
          <DialogDescription>
            {t(
              'Create disabled channel skeletons for common providers in one click. Each channel needs you to fill the real API key + enable it afterwards.'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className='flex items-center justify-between border-b pb-2'>
          <span className='text-muted-foreground text-sm'>
            {t('{{n}} of {{total}} selected', {
              n: selectedCount,
              total: PROVIDER_PRESETS.length,
            })}
          </span>
          <div className='flex gap-2'>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              onClick={() => toggleAll(true)}
              disabled={submitting}
            >
              {t('Select all')}
            </Button>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              onClick={() => toggleAll(false)}
              disabled={submitting}
            >
              {t('Clear')}
            </Button>
          </div>
        </div>

        <div className='max-h-[55vh] space-y-3 overflow-y-auto pr-1'>
          {MODALITY_GROUPS.map((group) => {
            const items = PROVIDER_PRESETS.filter(
              (p) => p.modality === group.modality
            )
            if (items.length === 0) return null
            return (
              <div key={group.modality} className='space-y-2'>
                <p className='text-muted-foreground px-1 text-xs font-semibold'>
                  {t(group.label)}
                </p>
                {items.map((p) => {
                  const checked = !!selected[p.id]
                  return (
                    <Label
                      key={p.id}
                      htmlFor={`qip-${p.id}`}
                      className='hover:bg-accent/40 flex cursor-pointer items-start gap-3 rounded-md border p-3'
                    >
                      <Checkbox
                        id={`qip-${p.id}`}
                        checked={checked}
                        onCheckedChange={() => toggle(p.id)}
                        disabled={submitting}
                        className='mt-0.5'
                      />
                      <div className='flex-1 space-y-1'>
                        <div className='flex items-center gap-2'>
                          <span className='font-medium'>{p.name}</span>
                          <span className='text-muted-foreground text-xs'>
                            type={p.type}
                          </span>
                          {p.docsUrl && (
                            <a
                              href={p.docsUrl}
                              target='_blank'
                              rel='noopener noreferrer'
                              onClick={(e) => e.stopPropagation()}
                              className='text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5 text-xs underline'
                            >
                              {t('Get key')}
                              <ExternalLink className='size-3' />
                            </a>
                          )}
                        </div>
                        <p className='text-muted-foreground text-xs'>
                          {p.description}
                        </p>
                        <p className='text-muted-foreground/80 font-mono text-[11px] break-all'>
                          {p.models}
                        </p>
                      </div>
                    </Label>
                  )
                })}
              </div>
            )
          })}
        </div>

        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {t('Cancel')}
          </Button>
          <Button
            type='button'
            onClick={handleSubmit}
            disabled={submitting || selectedCount === 0}
          >
            {submitting && <Loader2 className='mr-1 size-4 animate-spin' />}
            {t('Import {{n}} channel(s)', { n: selectedCount })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
