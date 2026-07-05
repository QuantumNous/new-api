import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getSelf } from '@/lib/api'
import { SectionPageLayout } from '@/components/layout'
import { useSystemConfigStore } from '@/stores/system-config-store'
import { CommissionOverviewCard } from './components/commission-overview-card'
import { CommissionLogsTable } from './components/commission-logs-table'
import { CommissionStatsPanel } from './components/commission-stats-panel'
import { CommissionTransferDialog } from './components/commission-transfer-dialog'
import { getCommissionInfo, transferCommission } from './api'
import { generateAffiliateLink } from '../wallet/lib'
import type { CommissionInfo } from './types'

export function Commission() {
  const { t } = useTranslation()
  const maxLevel = useSystemConfigStore((state) => state.config.commissionMaxLevel ?? 3)
  const [info, setInfo] = useState<CommissionInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [transferOpen, setTransferOpen] = useState(false)
  const [transferring, setTransferring] = useState(false)
  const [affiliateLink, setAffiliateLink] = useState('')

  const fetchInfo = useCallback(async () => {
    try {
      setLoading(true)
      const res = await getCommissionInfo()
      if (res.success && res.data) {
        setInfo(res.data)
        if (res.data.aff_code) setAffiliateLink(generateAffiliateLink(res.data.aff_code))
      }
    } catch { /* handled */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchInfo() }, [fetchInfo])

  const handleTransfer = async (amount: number): Promise<boolean> => {
    try {
      setTransferring(true)
      const res = await transferCommission({ quota: amount })
      if (res.success) {
        toast.success(res.message || t('转入成功'))
        await getSelf()
        await fetchInfo()
        return true
      }
      toast.error(res.message || t('转入失败'))
      return false
    } catch { toast.error(t('转入失败')); return false }
    finally { setTransferring(false) }
  }

  return (
    <>
      <SectionPageLayout>
        <SectionPageLayout.Title>{t('返佣中心')}</SectionPageLayout.Title>
        <SectionPageLayout.Description>{t('查看返佣收益、邀请明细与统计数据')}</SectionPageLayout.Description>
        <SectionPageLayout.Content>
          <div className='mx-auto flex w-full max-w-7xl flex-col gap-4 sm:gap-5'>
            <CommissionOverviewCard info={info} affiliateLink={affiliateLink} loading={loading} />
            <div className='grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)] xl:items-start'>
              <CommissionLogsTable />
              <CommissionStatsPanel maxLevel={maxLevel} />
            </div>
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>
      <CommissionTransferDialog open={transferOpen} onOpenChange={setTransferOpen} onConfirm={handleTransfer} availableQuota={info?.aff_quota ?? 0} transferring={transferring} />
    </>
  )
}
