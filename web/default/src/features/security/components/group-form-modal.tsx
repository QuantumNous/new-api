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
import type { SecurityGroup } from '../api/security'

interface GroupFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialData: SecurityGroup | null
  groups: SecurityGroup[]
  onSubmit: (data: Partial<SecurityGroup>) => Promise<void>
}

export function GroupFormModal({
  open,
  onOpenChange,
  initialData,
  groups,
  onSubmit,
}: GroupFormModalProps) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<Partial<SecurityGroup>>({
    name: '',
    description: '',
    parent_id: 0,
    sort_order: 0,
    status: 1,
  })

  useEffect(() => {
    if (open) {
      setForm(
        initialData
          ? {
              name: initialData.name,
              description: initialData.description,
              parent_id: initialData.parent_id ?? 0,
              sort_order: initialData.sort_order ?? 0,
              status: initialData.status ?? 1,
            }
          : {
              name: '',
              description: '',
              parent_id: 0,
              sort_order: 0,
              status: 1,
            }
      )
    }
  }, [open, initialData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name?.trim()) return
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
      <DialogContent className='sm:max-w-md'>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {initialData ? t('Edit Group') : t('Create Group')}
            </DialogTitle>
          </DialogHeader>

          <div className='space-y-4 py-4'>
            <div className='space-y-2'>
              <Label htmlFor='group-name'>{t('Name')}</Label>
              <Input
                id='group-name'
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t('Group name')}
                required
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='group-description'>{t('Description')}</Label>
              <Input
                id='group-description'
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder={t('Description')}
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='group-parent'>{t('Parent Group')}</Label>
              <Select
                value={String(form.parent_id ?? 0)}
                onValueChange={(v) =>
                  setForm({ ...form, parent_id: Number(v) })
                }
              >
                <SelectTrigger id='group-parent' className='w-full'>
                  <SelectValue placeholder={t('Select parent group')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='0'>{t('None')}</SelectItem>
                  {groups
                    .filter((g) => g.id !== initialData?.id)
                    .map((g) => (
                      <SelectItem key={g.id} value={String(g.id)}>
                        {g.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='group-sort'>{t('Sort Order')}</Label>
              <Input
                id='group-sort'
                type='number'
                value={form.sort_order}
                onChange={(e) =>
                  setForm({ ...form, sort_order: Number(e.target.value) })
                }
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='group-status'>{t('Status')}</Label>
              <Select
                value={String(form.status ?? 1)}
                onValueChange={(v) =>
                  setForm({ ...form, status: Number(v) })
                }
              >
                <SelectTrigger id='group-status' className='w-full'>
                  <SelectValue placeholder={t('Select status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='1'>{t('Enabled')}</SelectItem>
                  <SelectItem value='0'>{t('Disabled')}</SelectItem>
                </SelectContent>
              </Select>
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
            <Button type='submit' disabled={loading || !form.name?.trim()}>
              {loading ? t('Saving...') : t('Save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
