import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
import { Textarea } from '@/components/ui/textarea'
import { batchCreateFeishuUsers, type FeishuBatchInitUserItem } from '../api'
import { useUsers } from './users-provider'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const DEFAULT_JSON = `[
  {
    "feishu_open_id": "ou_xxx",
    "group": "default"
  },
  {
    "feishu_user_id": "u_xxx",
    "display_name": "张三",
    "group": "vip"
  }
]`

export function FeishuBatchInitDialog(props: Props) {
  const { t } = useTranslation()
  const { triggerRefresh } = useUsers()
  const [value, setValue] = useState(DEFAULT_JSON)
  const [submitting, setSubmitting] = useState(false)

  const helperText = useMemo(
    () =>
      t(
        'At least one of feishu_open_id / feishu_union_id / feishu_user_id is required for each user item.'
      ),
    [t]
  )

  const handleSubmit = async () => {
    let users: FeishuBatchInitUserItem[] = []
    try {
      const parsed = JSON.parse(value)
      if (!Array.isArray(parsed)) {
        throw new Error('JSON must be an array')
      }
      users = parsed
    } catch (err) {
      toast.error((err as Error).message || 'Invalid JSON')
      return
    }

    if (users.length === 0) {
      toast.error(t('Please provide at least one user'))
      return
    }

    setSubmitting(true)
    try {
      const res = await batchCreateFeishuUsers(users)
      if (!res.success) {
        toast.error(res.message || t('Batch init failed'))
        return
      }
      const data = res.data
      toast.success(
        t('Batch init done: success {{s}}, skipped {{k}}, failed {{f}}', {
          s: data?.success || 0,
          k: data?.skipped || 0,
          f: data?.failed || 0,
        })
      )
      triggerRefresh()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className='sm:max-w-3xl'>
        <DialogHeader>
          <DialogTitle>{t('Feishu Batch Init')}</DialogTitle>
          <DialogDescription>{helperText}</DialogDescription>
        </DialogHeader>
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className='min-h-[360px] font-mono text-xs'
        />
        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => props.onOpenChange(false)}
            disabled={submitting}
          >
            {t('Cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? t('Submitting...') : t('Submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

