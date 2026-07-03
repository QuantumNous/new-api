import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Loader2, UserCog } from 'lucide-react'
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
  bindAgentOwner,
  unbindAgentOwner,
  getAgentOwner,
} from '../api'
import type { User } from '../types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: User | null
  onSuccess?: () => void
}

/**
 * 组织类智能体账号负责人绑定对话框
 * 支持通过手机号/工号/邮箱查询飞书人员并绑定
 */
export function AgentOwnerDialog({ open, onOpenChange, user, onSuccess }: Props) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [mobile, setMobile] = useState('')
  const [employeeNo, setEmployeeNo] = useState('')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [boundOpenId, setBoundOpenId] = useState('')
  const [boundName, setBoundName] = useState('')

  useEffect(() => {
    if (open && user) {
      setMobile('')
      setEmployeeNo('')
      setEmail('')
      setName('')
      setBoundOpenId('')
      setBoundName('')
      void fetchOwnerInfo(user.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user?.id])

  async function fetchOwnerInfo(userId: number) {
    setFetching(true)
    try {
      const res = await getAgentOwner(userId)
      if (res.success && res.data) {
        setMobile(res.data.agent_owner_mobile || '')
        setEmployeeNo(res.data.agent_owner_employee_no || '')
        setName(res.data.agent_owner_name || '')
        setBoundOpenId(res.data.agent_owner_feishu_open_id || '')
        setBoundName(res.data.agent_owner_name || '')
      }
    } catch {
      // ignore
    } finally {
      setFetching(false)
    }
  }

  async function handleBind() {
    if (!user) return
    if (!name.trim() && !mobile.trim() && !employeeNo.trim() && !email.trim()) {
      toast.error(t('请至少填写姓名、手机号、工号或邮箱之一'))
      return
    }
    setLoading(true)
    try {
      const res = await bindAgentOwner(user.id, {
        mobile: mobile.trim(),
        employee_no: employeeNo.trim(),
        email: email.trim(),
        name: name.trim(),
      })
      if (res.success) {
        toast.success(t('负责人绑定成功'))
        await fetchOwnerInfo(user.id)
        onSuccess?.()
      } else {
        toast.error(res.message || t('绑定失败'))
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || t('绑定失败'))
    } finally {
      setLoading(false)
    }
  }

  async function handleUnbind() {
    if (!user) return
    setLoading(true)
    try {
      const res = await unbindAgentOwner(user.id)
      if (res.success) {
        toast.success(t('已解绑负责人'))
        setMobile('')
        setEmployeeNo('')
        setEmail('')
        setName('')
        setBoundOpenId('')
        setBoundName('')
        onSuccess?.()
      } else {
        toast.error(res.message || t('解绑失败'))
      }
    } catch {
      toast.error(t('解绑失败'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="size-5" />
            {t('管理负责人')}
          </DialogTitle>
          <DialogDescription>
            {t('为组织类智能体账号绑定飞书负责人，用于用量报告推送')}
          </DialogDescription>
        </DialogHeader>

        {fetching ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {boundOpenId && (
              <div className="rounded-md border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950/50">
                <p className="text-sm font-medium text-green-700 dark:text-green-400">
                  {t('当前已绑定')}: {boundName || t('未知名')}
                </p>
                <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                  {boundOpenId}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="owner-name">{t('负责人姓名')}</Label>
              <Input
                id="owner-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('可按姓名查找；同名时需填写手机号、工号或邮箱')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="owner-mobile">{t('手机号')}</Label>
              <Input
                id="owner-mobile"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="13800138000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="owner-employee-no">{t('工号')}</Label>
              <Input
                id="owner-employee-no"
                value={employeeNo}
                onChange={(e) => setEmployeeNo(e.target.value)}
                placeholder={t('员工工号')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="owner-email">{t('邮箱')}</Label>
              <Input
                id="owner-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
              />
            </div>

            <p className="text-xs text-muted-foreground">
              {t('填写姓名/手机号/工号/邮箱后点击绑定，系统会通过飞书通讯录自动查询并回填飞书信息；姓名同名时请改用手机号、工号或邮箱。')}
            </p>
          </div>
        )}

        <DialogFooter className="gap-2">
          {boundOpenId && (
            <Button
              variant="destructive"
              onClick={handleUnbind}
              disabled={loading || fetching}
            >
              {t('解绑')}
            </Button>
          )}
          <Button
            onClick={handleBind}
            disabled={loading || fetching}
          >
            {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
            {t('绑定')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
