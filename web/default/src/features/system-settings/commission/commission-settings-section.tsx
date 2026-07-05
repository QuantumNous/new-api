import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Loader2, ShieldCheck } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { updateSystemOption } from '../../api'
import type { CommissionSettings } from '../../types'

interface CommissionSettingsSectionProps {
  defaultValues: CommissionSettings
}

export function CommissionSettingsSection({ defaultValues }: CommissionSettingsSectionProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<CommissionSettings>(defaultValues)

  const updateField = <K extends keyof CommissionSettings>(key: K, value: CommissionSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      for (const [key, value] of Object.entries(settings)) {
        const res = await updateSystemOption({ key, value })
        if (!res.success) { toast.error(res.message || t('保存失败')); setSaving(false); return }
      }
      toast.success(t('保存成功'))
      queryClient.invalidateQueries({ queryKey: ['system-options'] })
    } catch { toast.error(t('保存失败')) }
    finally { setSaving(false) }
  }

  return (
    <div className='space-y-4'>
      <Card className='bg-muted/20 py-0'>
        <CardHeader className='p-4 sm:p-5'>
          <CardTitle className='flex items-center gap-2 text-sm font-semibold'>
            <ShieldCheck className='size-4' />{t('基础设置')}
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-5 p-4 pt-0 sm:p-5 sm:pt-0'>
          <div className='flex items-start justify-between gap-4'>
            <div className='space-y-0.5'>
              <Label className='text-sm font-medium'>{t('启用消费返佣')}</Label>
              <p className='text-muted-foreground text-xs'>{t('关闭后用户端隐藏返佣中心并停止计算消费返佣;原版邀请链接与注册奖励不受影响')}</p>
            </div>
            <Switch checked={settings.CommissionEnabled} onCheckedChange={(v) => updateField('CommissionEnabled', v)} />
          </div>
          <div className='space-y-2'>
            <Label className='text-sm font-medium'>{t('返佣层级')}</Label>
            <p className='text-muted-foreground text-xs'>{t('1级=仅直接邀请返佣;2/3级=开启对应层级。各级比例在返佣规则中配置')}</p>
            <div className='flex gap-2'>
              {[1, 2, 3].map((lv) => (
                <Button key={lv} variant={settings.CommissionMaxLevel === lv ? 'default' : 'outline'} size='sm' className='h-8 px-4' onClick={() => updateField('CommissionMaxLevel', lv)}>
                  {lv}{t('级')}
                </Button>
              ))}
            </div>
          </div>
          <div className='flex items-start justify-between gap-4'>
            <div className='space-y-0.5'>
              <Label className='text-sm font-medium'>{t('实时结算')}</Label>
              <p className='text-muted-foreground text-xs'>{t('关闭后返佣先记为待结算,由管理员手动结算')}</p>
            </div>
            <Switch checked={settings.CommissionRealTimeSettleEnabled} onCheckedChange={(v) => updateField('CommissionRealTimeSettleEnabled', v)} />
          </div>
        </CardContent>
      </Card>

      <Card className='bg-muted/20 py-0'>
        <CardHeader className='p-4 sm:p-5'>
          <CardTitle className='text-sm font-semibold'>{t('防刷设置')}</CardTitle>
        </CardHeader>
        <CardContent className='space-y-5 p-4 pt-0 sm:p-5 sm:pt-0'>
          <div className='flex items-start justify-between gap-4'>
            <div className='space-y-0.5'>
              <Label className='text-sm font-medium'>{t('启用防刷检测')}</Label>
              <p className='text-muted-foreground text-xs'>{t('开启后对异常邀请行为进行限制')}</p>
            </div>
            <Switch checked={settings.CommissionAntiSpamEnabled} onCheckedChange={(v) => updateField('CommissionAntiSpamEnabled', v)} />
          </div>
          <div className='grid gap-4 sm:grid-cols-3'>
            <div className='space-y-1.5'>
              <Label className='text-xs'>{t('每日邀请上限')}</Label>
              <Input type='number' value={settings.CommissionMaxDailyInvites} onChange={(e) => updateField('CommissionMaxDailyInvites', Math.max(0, Number(e.target.value)))} min={0} className='font-mono' />
              <p className='text-muted-foreground text-[10px]'>{t('0 = 不限')}</p>
            </div>
            <div className='space-y-1.5'>
              <Label className='text-xs'>{t('同IP同邀请人上限')}</Label>
              <Input type='number' value={settings.CommissionSameIPLimit} onChange={(e) => updateField('CommissionSameIPLimit', Math.max(0, Number(e.target.value)))} min={0} className='font-mono' />
            </div>
            <div className='space-y-1.5'>
              <Label className='text-xs'>{t('同IP全局上限')}</Label>
              <Input type='number' value={settings.CommissionGlobalIPLimit} onChange={(e) => updateField('CommissionGlobalIPLimit', Math.max(0, Number(e.target.value)))} min={0} className='font-mono' />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className='flex justify-end'>
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}{t('保存设置')}
        </Button>
      </div>
    </div>
  )
}
