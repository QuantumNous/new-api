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
import type { SecurityGroup, SecurityPolicy } from '../api/security'

interface PolicyFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialData: SecurityPolicy | null
  groups: SecurityGroup[]
  onSubmit: (data: Partial<SecurityPolicy>) => Promise<void>
}

const scopeOptions = [
  { value: 1, label: 'Request Only' },
  { value: 2, label: 'Response Only' },
  { value: 3, label: 'Both' },
]

const actionOptions = [
  { value: 1, label: 'Pass' },
  { value: 2, label: 'Alert' },
  { value: 3, label: 'Mask' },
  { value: 4, label: 'Block' },
  { value: 5, label: 'Review' },
]

export function PolicyFormModal({
  open,
  onOpenChange,
  initialData,
  groups,
  onSubmit,
}: PolicyFormModalProps) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<Partial<SecurityPolicy>>({
    user_id: 0,
    group_id: 0,
    scope: 1,
    default_action: 1,
    custom_response: '',
    whitelist_ips: '',
  })

  useEffect(() => {
    if (open) {
      setForm(
        initialData
          ? {
              user_id: initialData.user_id,
              group_id: initialData.group_id,
              scope: initialData.scope,
              default_action: initialData.default_action,
              custom_response: initialData.custom_response,
              whitelist_ips: initialData.whitelist_ips,
            }
          : {
              user_id: 0,
              group_id: groups[0]?.id ?? 0,
              scope: 3,
              default_action: 4,
              custom_response: '',
              whitelist_ips: '',
            }
      )
    }
  }, [open, initialData, groups])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.user_id || !form.group_id) return
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
              {initialData ? t('Edit Policy') : t('Create Policy')}
            </DialogTitle>
          </DialogHeader>

          <div className='grid grid-cols-1 gap-4 py-4 sm:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='policy-user'>{t('User ID')}</Label>
              <Input
                id='policy-user'
                type='number'
                value={form.user_id}
                onChange={(e) =>
                  setForm({ ...form, user_id: Number(e.target.value) })
                }
                placeholder={t('Enter user ID')}
                required
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='policy-group'>{t('Group')}</Label>
              <Select
                value={String(form.group_id ?? 0)}
                onValueChange={(v) =>
                  setForm({ ...form, group_id: Number(v) })
                }
              >
                <SelectTrigger id='policy-group' className='w-full'>
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
              <Label htmlFor='policy-scope'>{t('Scope')}</Label>
              <Select
                value={String(form.scope ?? 1)}
                onValueChange={(v) =>
                  setForm({ ...form, scope: Number(v) })
                }
              >
                <SelectTrigger id='policy-scope' className='w-full'>
                  <SelectValue placeholder={t('Select scope')} />
                </SelectTrigger>
                <SelectContent>
                  {scopeOptions.map((opt) => (
                    <SelectItem key={opt.value} value={String(opt.value)}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='policy-action'>{t('Default Action')}</Label>
              <Select
                value={String(form.default_action ?? 1)}
                onValueChange={(v) =>
                  setForm({ ...form, default_action: Number(v) })
                }
              >
                <SelectTrigger id='policy-action' className='w-full'>
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
              <Label htmlFor='policy-custom'>{t('Custom Response')}</Label>
              <textarea
                id='policy-custom'
                value={form.custom_response}
                onChange={(e) =>
                  setForm({ ...form, custom_response: e.target.value })
                }
                placeholder={t('Custom response when blocked or alerted')}
                rows={3}
                className='border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 w-full rounded-lg border bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:ring-3 md:text-sm'
              />
            </div>

            <div className='space-y-2 sm:col-span-2'>
              <Label htmlFor='policy-whitelist'>{t('Whitelist IPs')}</Label>
              <Input
                id='policy-whitelist'
                value={form.whitelist_ips}
                onChange={(e) =>
                  setForm({ ...form, whitelist_ips: e.target.value })
                }
                placeholder={t('Comma separated IPs')}
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
              disabled={loading || !form.user_id || !form.group_id}
            >
              {loading ? t('Saving...') : t('Save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
