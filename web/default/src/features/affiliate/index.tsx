import { useState, useEffect, useCallback } from 'react'
import { Copy, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api, getSelf } from '@/lib/api'
import { formatQuota } from '@/lib/format'
import { useStatus } from '@/hooks/use-status'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getAffiliateCode, transferAffiliateQuota } from '@/features/wallet/api'
import { TransferDialog } from '@/features/wallet/components/dialogs/transfer-dialog'
import { generateAffiliateLink } from '@/features/wallet/lib'

interface AffLog {
  id: number
  inviter_id: number
  invitee_id: number
  topup_amount: number
  commission: number
  created_at: number
}

interface InviteItem {
  username: string
  display_name: string
  created_at: number
}

interface PagedResult<T> {
  records: T[]
  total: number
  page: number
  page_size: number
}

async function getAffLogs(page = 1): Promise<PagedResult<AffLog>> {
  const res = await api.get(`/api/user/aff_logs?page=${page}&page_size=20`)
  return res.data.data
}

async function getInviteList(page = 1): Promise<PagedResult<InviteItem>> {
  const res = await api.get(`/api/user/invite_list?page=${page}&page_size=20`)
  return res.data.data
}

function formatTime(ts: number): string {
  return new Date(ts * 1000).toLocaleString()
}

function maskEmail(email: string): string {
  if (!email) return '***'
  const at = email.indexOf('@')
  if (at <= 0) return email.substring(0, 3) + '***'
  const local = email.substring(0, at)
  const domain = email.substring(at)
  return local.substring(0, Math.min(3, local.length)) + '***' + domain
}

interface UserAffData {
  aff_quota?: number
  aff_history_quota?: number
  aff_count?: number
}

const cardCls =
  'rounded-2xl border border-white/70 bg-white/80 shadow-sm backdrop-blur dark:border-zinc-700/50 dark:bg-zinc-800/60'

export function AffiliatePage() {
  const { t } = useTranslation()
  const { status } = useStatus()
  const statusData = status as {
    aff_ratio?: number
    effective_aff_ratio?: number
  } | null
  const affRatio = statusData?.effective_aff_ratio ?? statusData?.aff_ratio ?? 0
  const [userData, setUserData] = useState<UserAffData>({})

  const [affiliateCode, setAffiliateCode] = useState('')
  const [affiliateLink, setAffiliateLink] = useState('')
  const [copied, setCopied] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [transferring, setTransferring] = useState(false)

  const [affLogs, setAffLogs] = useState<AffLog[]>([])
  const [inviteList, setInviteList] = useState<InviteItem[]>([])
  const [logsLoading, setLogsLoading] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const [code, self] = await Promise.all([getAffiliateCode(), getSelf()])
      if (code.success && code.data) {
        setAffiliateCode(code.data)
        setAffiliateLink(generateAffiliateLink(code.data))
      }
      if (self?.data) {
        setUserData(self.data as UserAffData)
      }
    } catch {
      // ignore
    }
    setLogsLoading(true)
    try {
      const [logs, invites] = await Promise.all([getAffLogs(), getInviteList()])
      setAffLogs(logs?.records ?? [])
      setInviteList(invites?.records ?? [])
    } finally {
      setLogsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function handleCopy() {
    await navigator.clipboard.writeText(affiliateLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success(t('Copied'))
  }

  async function handleTransfer(amount: number): Promise<boolean> {
    setTransferring(true)
    try {
      const res = await transferAffiliateQuota({ quota: amount })
      if (res.success) {
        toast.success(res.message || t('Transfer successful'))
        const self = await getSelf()
        if (self?.data) setUserData(self.data as UserAffData)
        return true
      }
      toast.error(res.message || t('Transfer failed'))
      return false
    } finally {
      setTransferring(false)
    }
  }

  const affQuota = userData?.aff_quota ?? 0
  const affHistory = userData?.aff_history_quota ?? 0
  const affCount = userData?.aff_count ?? 0
  const hasRewards = affQuota > 0

  return (
    <div className='min-h-full overflow-x-hidden bg-gradient-to-br from-violet-50 via-rose-50 to-sky-50 dark:from-zinc-900 dark:via-zinc-950 dark:to-zinc-900'>
      <div className='space-y-5 p-6'>
        <div>
          <div className='inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-violet-500 to-pink-500 px-5 py-2.5 shadow-lg shadow-pink-200/50 dark:shadow-none'>
            <span className='text-lg font-bold text-white'>
              {t('Affiliate')}
            </span>
            <span className='h-4 w-px bg-white/40' />
            <span className='text-sm text-white/85'>
              {t('Invite friends, referrer earns commission')}: {affRatio}%
            </span>
          </div>
        </div>

        {/* 返佣规则 + 邀请码/链接 */}
        <div className={`${cardCls} space-y-4 rounded-3xl p-6`}>
          <p className='text-muted-foreground text-sm'>
            {affRatio > 0
              ? t(
                  'When your friend tops up, you earn {{ratio}}% of their amount',
                  { ratio: affRatio }
                )
              : t(
                  'Invite friends to register and earn rewards when they top up'
                )}
          </p>
          <div className='border-border/50 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center'>
            <div className='flex shrink-0 items-center gap-2.5'>
              <span className='text-muted-foreground shrink-0 text-sm'>
                {t('My Referral Code')}
              </span>
              <span className='rounded-md bg-emerald-100 px-2.5 py-1 font-mono text-sm font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'>
                {affiliateCode || '----'}
              </span>
            </div>
            <div className='flex items-center gap-2'>
              <span className='text-muted-foreground shrink-0 text-sm'>
                {t('Referral Link')}
              </span>
              <Input
                value={affiliateLink}
                readOnly
                className='bg-background/60 h-9 w-96 font-mono text-xs'
              />
              <Button
                size='sm'
                variant='outline'
                onClick={handleCopy}
                className='shrink-0 gap-1'
              >
                {copied ? (
                  <Check className='size-3.5' />
                ) : (
                  <Copy className='size-3.5' />
                )}
                {copied ? t('Copied') : t('Copy')}
              </Button>
            </div>
          </div>
        </div>

        {/* 统计卡片 */}
        <div className='grid grid-cols-2 gap-4'>
          <div className={`${cardCls} p-5`}>
            <div className='mb-2 flex items-center gap-2'>
              <span className='size-2 rounded-full bg-orange-400' />
              <span className='text-muted-foreground text-xs'>
                {t('Invited Count')}
              </span>
            </div>
            <div className='text-4xl font-bold text-orange-500 tabular-nums'>
              {affCount}
            </div>
          </div>
          <div className={`${cardCls} p-5`}>
            <div className='mb-2 flex items-center gap-2'>
              <span className='size-2 rounded-full bg-emerald-400' />
              <span className='text-muted-foreground text-xs'>
                {t('Total Commission Earned')}
              </span>
            </div>
            <div className='text-4xl font-bold text-emerald-500 tabular-nums'>
              {formatQuota(affHistory)}
            </div>
            {hasRewards && (
              <Button
                size='sm'
                variant='outline'
                className='mt-3'
                onClick={() => setTransferOpen(true)}
                disabled={transferring}
              >
                {t('Transfer to Balance')}（{formatQuota(affQuota)}）
              </Button>
            )}
          </div>
        </div>

        {/* 记录 */}
        <div className={`${cardCls} overflow-hidden`}>
          <div className='border-border/50 border-b px-5 py-3.5'>
            <h2 className='text-base font-semibold'>{t('Invite Records')}</h2>
          </div>
          <Tabs defaultValue='commission' className='p-4'>
            <TabsList variant='line' className='mb-2'>
              <TabsTrigger
                value='invite'
                className='data-active:text-orange-500 data-active:after:bg-orange-500'
              >
                {t('Invite Records')}
              </TabsTrigger>
              <TabsTrigger
                value='commission'
                className='data-active:text-orange-500 data-active:after:bg-orange-500'
              >
                {t('Commission Records')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value='invite' className='px-1 pb-1'>
              {logsLoading ? (
                <p className='text-muted-foreground py-6 text-center text-sm'>
                  {t('Loading...')}
                </p>
              ) : inviteList.length === 0 ? (
                <p className='text-muted-foreground py-6 text-center text-sm'>
                  {t('No invite records yet')}
                </p>
              ) : (
                <table className='w-full text-sm'>
                  <thead>
                    <tr className='text-muted-foreground border-b text-xs'>
                      <th className='py-2 text-left'>{t('User')}</th>
                      <th className='py-2 text-right'>
                        {t('Registration Time')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {inviteList.map((u, i) => (
                      <tr key={i} className='border-b last:border-0'>
                        <td className='py-2'>
                          {maskEmail(u.display_name || u.username)}
                        </td>
                        <td className='text-muted-foreground py-2 text-right'>
                          {formatTime(u.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </TabsContent>

            <TabsContent value='commission' className='px-1 pb-1'>
              {logsLoading ? (
                <p className='text-muted-foreground py-6 text-center text-sm'>
                  {t('Loading...')}
                </p>
              ) : affLogs.length === 0 ? (
                <p className='text-muted-foreground py-6 text-center text-sm'>
                  {t('No commission records yet')}
                </p>
              ) : (
                <table className='w-full text-sm'>
                  <thead>
                    <tr className='text-muted-foreground border-b text-xs'>
                      <th className='py-2 text-left'>{t('Amount Paid')}</th>
                      <th className='py-2 text-right'>
                        {t('Commission Amount')}
                      </th>
                      <th className='py-2 text-right'>{t('Time')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {affLogs.map((log) => (
                      <tr key={log.id} className='border-b last:border-0'>
                        <td className='py-2'>
                          {formatQuota(log.topup_amount)}
                        </td>
                        <td className='py-2 text-right text-emerald-500'>
                          +{formatQuota(log.commission)}
                        </td>
                        <td className='text-muted-foreground py-2 text-right'>
                          {formatTime(log.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <TransferDialog
          open={transferOpen}
          onOpenChange={setTransferOpen}
          onConfirm={handleTransfer}
          availableQuota={affQuota}
          transferring={transferring}
        />
      </div>
    </div>
  )
}
