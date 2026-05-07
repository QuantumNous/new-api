import { useState } from 'react'
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { createFeishuToken, getFeishuTokens, type FeishuTokenItem } from '../api'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FeishuTokenManagerDialog(props: Props) {
  const { t } = useTranslation()
  const [feishuOpenId, setFeishuOpenId] = useState('')
  const [feishuUserId, setFeishuUserId] = useState('')
  const [tokenName, setTokenName] = useState('admin-created')
  const [tokens, setTokens] = useState<FeishuTokenItem[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newKey, setNewKey] = useState('')

  const loadTokens = async () => {
    if (!feishuOpenId.trim() && !feishuUserId.trim()) {
      toast.error(t('Please provide feishu_open_id or feishu_user_id'))
      return
    }
    setLoading(true)
    try {
      const res = await getFeishuTokens({
        feishu_open_id: feishuOpenId.trim() || undefined,
        feishu_user_id: feishuUserId.trim() || undefined,
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

  const handleCreate = async () => {
    if (!feishuOpenId.trim() && !feishuUserId.trim()) {
      toast.error(t('Please provide feishu_open_id or feishu_user_id'))
      return
    }
    setCreating(true)
    try {
      const res = await createFeishuToken({
        feishu_open_id: feishuOpenId.trim() || undefined,
        feishu_user_id: feishuUserId.trim() || undefined,
        name: tokenName.trim() || 'admin-created',
      })
      if (!res.success) {
        toast.error(res.message || t('Failed to create token'))
        return
      }
      setNewKey(res.data?.key || '')
      toast.success(t('Token created successfully'))
      await loadTokens()
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className='sm:max-w-5xl'>
        <DialogHeader>
          <DialogTitle>{t('Feishu Token Manager')}</DialogTitle>
          <DialogDescription>
            {t('Query all plaintext keys for a Feishu user and create new key (permission-limited).')}
          </DialogDescription>
        </DialogHeader>

        <div className='grid grid-cols-1 gap-3 sm:grid-cols-3'>
          <div className='space-y-2'>
            <Label>{t('Feishu Open ID')}</Label>
            <Input
              value={feishuOpenId}
              onChange={(e) => setFeishuOpenId(e.target.value)}
              placeholder='ou_xxx'
            />
          </div>
          <div className='space-y-2'>
            <Label>{t('Feishu User ID')}</Label>
            <Input
              value={feishuUserId}
              onChange={(e) => setFeishuUserId(e.target.value)}
              placeholder='u_xxx'
            />
          </div>
          <div className='space-y-2'>
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
            <div className='mb-1 font-medium text-amber-800'>{t('New plaintext key')}</div>
            <div className='break-all font-mono text-amber-900'>{newKey}</div>
          </div>
        )}

        <div className='rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>{t('Name')}</TableHead>
                <TableHead>{t('Plaintext Key')}</TableHead>
                <TableHead>{t('Group')}</TableHead>
                <TableHead>{t('Status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tokens.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.id}</TableCell>
                  <TableCell>{item.name}</TableCell>
                  <TableCell className='max-w-[460px] break-all font-mono text-xs'>{item.key}</TableCell>
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
            {loading ? t('Loading...') : t('Query Keys')}
          </Button>
          <Button onClick={handleCreate} disabled={loading || creating}>
            {creating ? t('Creating...') : t('Create Key')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

