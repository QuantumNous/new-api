import { useEffect, useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  batchCreateFeishuUsers,
  getGroups,
  type FeishuBatchInitResponse,
  type FeishuBatchInitUserItem,
} from '../api'
import { useUsers } from './users-provider'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type InputRow = Required<
  Pick<
    FeishuBatchInitUserItem,
    'employee_id' | 'mobile' | 'email' | 'display_name' | 'group'
  >
>

type PreviewResult = NonNullable<FeishuBatchInitResponse['results']>[number]

const defaultRow = (): InputRow => ({
  employee_id: '',
  mobile: '',
  email: '',
  display_name: '',
  group: 'default',
})

function normalizeRows(rows: InputRow[]): FeishuBatchInitUserItem[] | null {
  const users = rows
    .map((row) => ({
      employee_id: row.employee_id.trim(),
      mobile: row.mobile.trim(),
      email: row.email.trim(),
      display_name: row.display_name.trim(),
      group: row.group.trim() || 'default',
    }))
    .filter(
      (row) => row.employee_id || row.mobile || row.email || row.display_name
    )

  if (users.length === 0) return null
  const invalid = users.some(
    (row) => !row.employee_id && !row.mobile && !row.email
  )
  if (invalid) return null
  return users
}

export function FeishuBatchInitDialog(props: Props) {
  const { t } = useTranslation()
  const { triggerRefresh } = useUsers()
  const [rows, setRows] = useState<InputRow[]>([defaultRow()])
  const [groups, setGroups] = useState<string[]>(['default'])
  const [submitting, setSubmitting] = useState(false)
  const [previewedUsers, setPreviewedUsers] = useState<
    FeishuBatchInitUserItem[]
  >([])
  const [previewResults, setPreviewResults] = useState<PreviewResult[]>([])
  const [selectedMap, setSelectedMap] = useState<Record<number, boolean>>({})

  useEffect(() => {
    if (!props.open) return
    getGroups().then((res) => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setGroups(res.data)
      }
    })
  }, [props.open])

  const helperText = useMemo(
    () =>
      t(
        'Fill employee ID, mobile or email in rows, preview matching results, then confirm selected users.'
      ),
    [t]
  )

  const resetPreview = () => {
    setPreviewedUsers([])
    setPreviewResults([])
    setSelectedMap({})
  }

  const updateRow = (index: number, field: keyof InputRow, value: string) => {
    setRows((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
    resetPreview()
  }

  const addRow = () => {
    setRows((prev) => [...prev, defaultRow()])
    resetPreview()
  }

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index))
    resetPreview()
  }

  const validateUsers = () => {
    const users = normalizeRows(rows)
    if (!users) {
      toast.error(
        t('Please provide employee ID, mobile or email for each user')
      )
      return null
    }
    return users
  }

  const handlePreview = async () => {
    const users = validateUsers()
    if (!users) return
    setSubmitting(true)
    try {
      const res = await batchCreateFeishuUsers(
        users.map((user) => ({ ...user, confirmed: false })),
        true
      )
      if (!res.success) {
        toast.error(res.message || t('Preview failed'))
        return
      }
      const results = res.data?.results ?? []
      const nextSelected: Record<number, boolean> = {}
      results.forEach((item, index) => {
        nextSelected[index] = item.action === 'preview_only'
      })
      setPreviewedUsers(users)
      setPreviewResults(results)
      setSelectedMap(nextSelected)
      toast.success(t('Preview completed, select users to initialize'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = async () => {
    let users = previewedUsers.filter((_, index) => selectedMap[index])
    if (previewResults.length === 0) {
      const validated = validateUsers()
      if (!validated) return
      users = validated
    }
    if (users.length === 0) {
      toast.error(t('Please select at least one user'))
      return
    }

    setSubmitting(true)
    try {
      const res = await batchCreateFeishuUsers(
        users.map((user) => ({ ...user, confirmed: true })),
        false
      )
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
      setRows([defaultRow()])
      resetPreview()
      props.onOpenChange(false)
      triggerRefresh()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className='max-h-[calc(100dvh-2rem)] overflow-hidden sm:max-w-6xl'>
        <DialogHeader>
          <DialogTitle>{t('Feishu Batch Init')}</DialogTitle>
          <DialogDescription>{helperText}</DialogDescription>
        </DialogHeader>

        <div className='max-h-[70vh] space-y-4 overflow-y-auto pr-1'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('Employee ID')}</TableHead>
                <TableHead>{t('Mobile')}</TableHead>
                <TableHead>{t('Email')}</TableHead>
                <TableHead>{t('Display Name')}</TableHead>
                <TableHead>{t('Group')}</TableHead>
                <TableHead>{t('Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Input
                      value={row.employee_id}
                      onChange={(event) =>
                        updateRow(index, 'employee_id', event.target.value)
                      }
                      placeholder='074234'
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={row.mobile}
                      onChange={(event) =>
                        updateRow(index, 'mobile', event.target.value)
                      }
                      placeholder='13800138000'
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={row.email}
                      onChange={(event) =>
                        updateRow(index, 'email', event.target.value)
                      }
                      placeholder='name@company.com'
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={row.display_name}
                      onChange={(event) =>
                        updateRow(index, 'display_name', event.target.value)
                      }
                      placeholder={t('Optional')}
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={row.group}
                      onValueChange={(value) =>
                        value && updateRow(index, 'group', value)
                      }
                    >
                      <SelectTrigger className='w-32'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {groups.map((group) => (
                            <SelectItem key={group} value={group}>
                              {group}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Button
                      type='button'
                      size='sm'
                      variant='ghost'
                      disabled={rows.length === 1}
                      onClick={() => removeRow(index)}
                    >
                      <Trash2 className='h-4 w-4' />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Button type='button' size='sm' variant='outline' onClick={addRow}>
            {t('Add Row')}
          </Button>

          {previewResults.length > 0 ? (
            <div className='space-y-2'>
              <div className='flex justify-end gap-2'>
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => {
                    const next: Record<number, boolean> = {}
                    previewResults.forEach((item, index) => {
                      next[index] = item.action === 'preview_only'
                    })
                    setSelectedMap(next)
                  }}
                >
                  {t('Select all initializable users')}
                </Button>
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => setSelectedMap({})}
                >
                  {t('Clear Selection')}
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('Select')}</TableHead>
                    <TableHead>{t('Display Name')}</TableHead>
                    <TableHead>OpenID</TableHead>
                    <TableHead>UnionID</TableHead>
                    <TableHead>UserID</TableHead>
                    <TableHead>{t('Organization')}</TableHead>
                    <TableHead>{t('Job Title')}</TableHead>
                    <TableHead>{t('Status')}</TableHead>
                    <TableHead>{t('Message')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewResults.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Checkbox
                          checked={!!selectedMap[index]}
                          disabled={item.action !== 'preview_only'}
                          onCheckedChange={(checked) =>
                            setSelectedMap((prev) => ({
                              ...prev,
                              [index]: !!checked,
                            }))
                          }
                        />
                      </TableCell>
                      <TableCell>{item.display_name || '-'}</TableCell>
                      <TableCell>{item.feishu_open_id || '-'}</TableCell>
                      <TableCell>{item.feishu_union_id || '-'}</TableCell>
                      <TableCell>{item.feishu_user_id || '-'}</TableCell>
                      <TableCell>{item.org_name || '-'}</TableCell>
                      <TableCell>{item.job_title || '-'}</TableCell>
                      <TableCell>{item.action || '-'}</TableCell>
                      <TableCell>{item.error || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => props.onOpenChange(false)}
            disabled={submitting}
          >
            {t('Cancel')}
          </Button>
          <Button
            variant='outline'
            onClick={handlePreview}
            disabled={submitting}
          >
            {submitting ? t('Submitting...') : t('Preview Users')}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? t('Submitting...') : t('Confirm Init')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
