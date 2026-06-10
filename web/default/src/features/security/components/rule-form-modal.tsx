import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { SecurityGroup, SecurityRule } from '../api/security'

interface RuleFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialData: SecurityRule | null
  groups: SecurityGroup[]
  onSubmit: (data: Partial<SecurityRule>) => Promise<void>
}

const ruleTypeOptions = [
  { value: 1, label: 'Keyword' },
  { value: 2, label: 'Regex' },
  { value: 3, label: 'NER' },
  { value: 4, label: 'AI' },
]

const actionOptions = [
  { value: 1, label: 'Pass' },
  { value: 2, label: 'Alert' },
  { value: 3, label: 'Mask' },
  { value: 4, label: 'Block' },
  { value: 5, label: 'Review' },
]

export function RuleFormModal({
  open,
  onOpenChange,
  initialData,
  groups,
  onSubmit,
}: RuleFormModalProps) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<Partial<SecurityRule>>({
    group_id: 0,
    name: '',
    type: 1,
    content: '',
    extra_config: '',
    action: 1,
    priority: 0,
    risk_score: 50,
  })

  useEffect(() => {
    if (open) {
      setForm(
        initialData
          ? {
              group_id: initialData.group_id,
              name: initialData.name,
              type: initialData.type,
              content: initialData.content,
              extra_config: initialData.extra_config,
              action: initialData.action,
              priority: initialData.priority,
              risk_score: initialData.risk_score,
            }
          : {
              group_id: groups[0]?.id ?? 0,
              name: '',
              type: 1,
              content: '',
              extra_config: '',
              action: 1,
              priority: 0,
              risk_score: 50,
            }
      )
    }
  }, [open, initialData, groups])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name?.trim() || !form.content?.trim() || !form.group_id) return
    setLoading(true)
    try {
      await onSubmit(form)
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {initialData ? t('Edit Rule') : t('Create Rule')}
            </DialogTitle>
          </DialogHeader>

          <div className='grid grid-cols-1 gap-4 py-4 sm:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='rule-group'>{t('Group')}</Label>
              <Select
                value={String(form.group_id ?? 0)}
                onValueChange={(v) =>
                  setForm({ ...form, group_id: Number(v) })
                }
              >
                <SelectTrigger id='rule-group' className='w-full'>
                  <SelectValue placeholder={t('Select group')} />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={String(g.id)}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='rule-name'>{t('Name')}</Label>
              <Input
                id='rule-name'
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t('Rule name')}
                required
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='rule-type'>{t('Type')}</Label>
              <Select
                value={String(form.type ?? 1)}
                onValueChange={(v) =>
                  setForm({ ...form, type: Number(v) })
                }
              >
                <SelectTrigger id='rule-type' className='w-full'>
                  <SelectValue placeholder={t('Select type')} />
                </SelectTrigger>
                <SelectContent>
                  {ruleTypeOptions.map((opt) => (
                    <SelectItem key={opt.value} value={String(opt.value)}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='rule-action'>{t('Action')}</Label>
              <Select
                value={String(form.action ?? 1)}
                onValueChange={(v) =>
                  setForm({ ...form, action: Number(v) })
                }
              >
                <SelectTrigger id='rule-action' className='w-full'>
                  <SelectValue placeholder={t('Select action')} />
                </SelectTrigger>
                <SelectContent>
                  {actionOptions.map((opt) => (
                    <SelectItem key={opt.value} value={String(opt.value)}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-2 sm:col-span-2'>
              <Label htmlFor='rule-content'>{t('Content')}</Label>
              <textarea
                id='rule-content'
                value={form.content}
                onChange={(e) =>
                  setForm({ ...form, content: e.target.value })
                }
                placeholder={t('Enter match content')}
                required
                rows={4}
                className='border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 w-full rounded-lg border bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:ring-3 md:text-sm'
              />
            </div>

            <div className='space-y-2 sm:col-span-2'>
              <Label htmlFor='rule-extra'>{t('Extra Config')}</Label>
              <textarea
                id='rule-extra'
                value={form.extra_config}
                onChange={(e) =>
                  setForm({ ...form, extra_config: e.target.value })
                }
                placeholder={t('JSON config or description')}
                rows={2}
                className='border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 w-full rounded-lg border bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:ring-3 md:text-sm'
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='rule-priority'>{t('Priority')}</Label>
              <Input
                id='rule-priority'
                type='number'
                value={form.priority}
                onChange={(e) =>
                  setForm({ ...form, priority: Number(e.target.value) })
                }
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='rule-risk'>{t('Risk Score')}</Label>
              <Input
                id='rule-risk'
                type='number'
                min={0}
                max={100}
                value={form.risk_score}
                onChange={(e) =>
                  setForm({ ...form, risk_score: Number(e.target.value) })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
            >
              {t('Cancel')}
            </Button>
            <Button
              type='submit'
              disabled={
                loading ||
                !form.name?.trim() ||
                !form.content?.trim() ||
                !form.group_id
              }
            >
              {loading ? t('Saving...') : t('Save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
