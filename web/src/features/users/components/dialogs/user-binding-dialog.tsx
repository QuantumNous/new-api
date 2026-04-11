import { useState, useEffect, useCallback } from 'react'
import {
  Mail,
  Globe,
  MessageCircle,
  Send,
  Link2,
  Unlink,
  Loader2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SiGithub } from 'react-icons/si'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  getUser,
  getUserOAuthBindings,
  adminClearUserBinding,
  adminUnbindCustomOAuth,
  type OAuthBinding,
} from '../../api'
import type { User } from '../../types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: number | null
  onUnbindSuccess?: () => void
}

interface BindingItem {
  key: string
  label: string
  icon: React.ReactNode
  value: string
  type: 'builtin' | 'custom'
  providerId?: string
}

const BUILTIN_BINDINGS = [
  { key: 'email', label: 'Email', icon: <Mail className='h-4 w-4' /> },
  { key: 'github_id', label: 'GitHub', icon: <SiGithub className='h-4 w-4' /> },
  {
    key: 'wechat_id',
    label: 'WeChat',
    icon: <MessageCircle className='h-4 w-4' />,
  },
  { key: 'oidc_id', label: 'OIDC', icon: <Globe className='h-4 w-4' /> },
  {
    key: 'telegram_id',
    label: 'Telegram',
    icon: <Send className='h-4 w-4' />,
  },
  {
    key: 'linux_do_id',
    label: 'LinuxDO',
    icon: <Globe className='h-4 w-4' />,
  },
] as const

export function UserBindingDialog(props: Props) {
  const { t } = useTranslation()
  const [user, setUser] = useState<User | null>(null)
  const [oauthBindings, setOauthBindings] = useState<OAuthBinding[]>([])
  const [loading, setLoading] = useState(false)
  const [unbindTarget, setUnbindTarget] = useState<BindingItem | null>(null)
  const [unbinding, setUnbinding] = useState(false)

  const fetchData = useCallback(async () => {
    if (!props.userId) return
    setLoading(true)
    try {
      const [userRes, oauthRes] = await Promise.all([
        getUser(props.userId),
        getUserOAuthBindings(props.userId).catch(() => ({
          success: false,
          data: [],
        })),
      ])
      if (userRes.success && userRes.data) {
        setUser(userRes.data)
      }
      if (oauthRes.success && oauthRes.data) {
        setOauthBindings(oauthRes.data as OAuthBinding[])
      }
    } catch {
      toast.error(t('Failed to load'))
    } finally {
      setLoading(false)
    }
  }, [props.userId, t])

  useEffect(() => {
    if (props.open && props.userId) {
      fetchData()
    } else {
      setUser(null)
      setOauthBindings([])
    }
  }, [props.open, props.userId, fetchData])

  const allBindings: BindingItem[] = []

  if (user) {
    for (const field of BUILTIN_BINDINGS) {
      const value = (user as Record<string, unknown>)[field.key]
      if (value) {
        allBindings.push({
          key: field.key,
          label: field.label,
          icon: field.icon,
          value: String(value),
          type: 'builtin',
        })
      }
    }
  }

  for (const binding of oauthBindings) {
    allBindings.push({
      key: `oauth_${binding.provider_id}`,
      label: binding.provider_name || binding.provider_id,
      icon: <Link2 className='h-4 w-4' />,
      value: binding.external_id || '-',
      type: 'custom',
      providerId: binding.provider_id,
    })
  }

  const handleUnbind = async () => {
    if (!unbindTarget || !props.userId) return
    setUnbinding(true)
    try {
      let res
      if (unbindTarget.type === 'builtin') {
        res = await adminClearUserBinding(props.userId, unbindTarget.key)
      } else if (unbindTarget.providerId) {
        res = await adminUnbindCustomOAuth(
          props.userId,
          unbindTarget.providerId
        )
      }
      if (res?.success) {
        toast.success(
          t('Unbound {{provider}}', { provider: unbindTarget.label })
        )
        await fetchData()
        props.onUnbindSuccess?.()
      } else {
        toast.error(res?.message || t('Unbind failed'))
      }
    } catch {
      toast.error(t('Unbind failed'))
    } finally {
      setUnbinding(false)
      setUnbindTarget(null)
    }
  }

  return (
    <>
      <Dialog open={props.open} onOpenChange={props.onOpenChange}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <Link2 className='h-5 w-5' />
              {t('Account Binding Management')}
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className='flex items-center justify-center py-8'>
              <Loader2 className='text-muted-foreground h-6 w-6 animate-spin' />
            </div>
          ) : (
            <div className='space-y-3'>
              {user && (
                <p className='text-muted-foreground text-sm'>
                  {t('User')}: {user.username} (ID: {user.id})
                </p>
              )}

              <Separator />

              {allBindings.length === 0 ? (
                <p className='text-muted-foreground py-4 text-center text-sm'>
                  {t('This user has no bindings')}
                </p>
              ) : (
                <div className='space-y-2'>
                  {allBindings.map((binding) => (
                    <div
                      key={binding.key}
                      className='flex items-center justify-between rounded-md border px-3 py-2.5'
                    >
                      <div className='flex min-w-0 items-center gap-3'>
                        <div className='text-muted-foreground'>
                          {binding.icon}
                        </div>
                        <div className='min-w-0'>
                          <div className='flex items-center gap-2'>
                            <span className='text-sm font-medium'>
                              {binding.label}
                            </span>
                            <Badge
                              variant={
                                binding.type === 'builtin'
                                  ? 'secondary'
                                  : 'outline'
                              }
                              className='h-5 text-[10px]'
                            >
                              {binding.type === 'builtin'
                                ? t('Built-in')
                                : t('Custom')}
                            </Badge>
                          </div>
                          <p className='text-muted-foreground max-w-[200px] truncate text-xs'>
                            {binding.value}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant='ghost'
                        size='sm'
                        className='text-destructive hover:text-destructive'
                        onClick={() => setUnbindTarget(binding)}
                      >
                        <Unlink className='h-3.5 w-3.5' />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <p className='text-muted-foreground text-xs'>
                {t('Bound')}: {allBindings.length}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!unbindTarget}
        onOpenChange={(open) => !open && setUnbindTarget(null)}
        title={t('Confirm Unbind')}
        desc={t(
          'Are you sure you want to unbind {{provider}} for this user? The user will no longer be able to log in via this method.',
          {
            provider: unbindTarget?.label || '',
          }
        )}
        confirmText={t('Confirm Unbind')}
        destructive
        handleConfirm={handleUnbind}
        isLoading={unbinding}
      />
    </>
  )
}
