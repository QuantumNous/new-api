import { useEffect, useState } from 'react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { createFeishuToken, getFeishuTokens, type FeishuTokenItem } from '../api'
import type { User } from '../types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  user?: Pick<User, 'id' | 'username'>
}

const ensureSkPrefix = (value?: string) => {
  const v = (value || '').trim()
  if (!v) return ''
  return v.startsWith('sk-') ? v : `sk-${v}`
}

export function FeishuTokenManagerDialog({ open, onOpenChange, user }: Props) {
  const { t } = useTranslation()
  const [tokenName, setTokenName] = useState('admin-created')
  const [tokens, setTokens] = useState<FeishuTokenItem[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newKey, setNewKey] = useState('')

  const loadTokens = async () => {
    if (!user?.id && !user?.username) {
      setTokens([])
      return
    }
    setLoading(true)
    try {
      const res = await getFeishuTokens({
        user_id: user?.id,
        username: user?.username,
        p: 1,
        page_size: 100,
      })
      if (!res.success) {
        toast.error(res.message || t('Failed to load tokens'))
        return
      }
      setTokens(res.data?.items || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return
    setNewKey('')
    setTokens([])
    void loadTokens()
  }, [open, user?.id, user?.username])

  const handleCreate = async () => {
    if (!user?.id && !user?.username) {
      toast.error(t('Missing user information'))
      return
    }
    setCreating(true)
    try {
      const res = await createFeishuToken({
        user_id: user?.id,
        username: user?.username,
        name: tokenName.trim() || 'admin-created',
      })
      if (!res.success) {
        toast.error(res.message || t('Failed to create token'))
        return
      }
      setNewKey(ensureSkPrefix(res.data?.key))
      toast.success(t('Token created successfully'))
      await loadTokens()
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-5xl'>
        <DialogHeader>
          <DialogTitle>{t('User Token Management')}</DialogTitle>
          <DialogDescription>
            {t('Current User')}: {user?.username || '-'} (ID: {user?.id || '-'})
          </DialogDescription>
        </DialogHeader>

        <div className='flex flex-wrap items-end gap-3'>
          <div className='w-64 space-y-2'>
            <Label>{t('Token Name')}</Label>
            <Input
              value={tokenName}
              onChange={(e) => setTokenName(e.target.value)}
              placeholder='admin-created'
            />
          </div>
        </div>

        {newKey && (
          <div className='rounded-md border border-amber-300 bg-amber-50 p-3 text-xs'>
            <div className='mb-1 font-medium text-amber-800'>{t('New plaintext token')}</div>
            <div className='break-all font-mono text-amber-900'>{newKey}</div>
          </div>
        )}

        <div className='rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>{t('Name')}</TableHead>
                <TableHead>{t('Plaintext Token')}</TableHead>
                <TableHead>{t('Group')}</TableHead>
                <TableHead>{t('Status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tokens.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.id}</TableCell>
                  <TableCell>{item.name}</TableCell>
                  <TableCell className='max-w-[460px] break-all font-mono text-xs'>
                    {ensureSkPrefix(item.key)}
                  </TableCell>
                  <TableCell>{item.group || '-'}</TableCell>
                  <TableCell>{item.status}</TableCell>
                </TableRow>
              ))}
              {tokens.length === 0 && (
                <TableRow>
                  <TableCell className='text-muted-foreground text-center' colSpan={5}>
                    {loading ? t('Loading...') : t('No token data')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={loadTokens} disabled={loading || creating}>
            {loading ? t('Loading...') : t('Refresh List')}
          </Button>
          <Button onClick={handleCreate} disabled={loading || creating}>
            {creating ? t('Creating...') : t('Create Token')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
