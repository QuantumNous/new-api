/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  ArrowRight,
  CheckCircle2,
  Gem,
  LockKeyhole,
  Sparkles,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { purchaseSkill, recordMarketplaceSkillEvent } from '../api'
import type { MarketplaceSkill } from '../types'

interface SkillPaywallDialogProps {
  skill: MarketplaceSkill | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onContinue?: (skill: MarketplaceSkill) => void
}

function paywallIdempotencyKey(skill: MarketplaceSkill): string {
  const suffix =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `paywall-${skill.id}-${suffix}`
}

export function SkillPaywallDialog(props: SkillPaywallDialogProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [purchaseSucceeded, setPurchaseSucceeded] = useState(false)
  const skill = props.skill
  const skillKey = skill?.slug || skill?.id || ''

  useEffect(() => {
    if (!props.open || skill == null) return
    setPurchaseSucceeded(false)
    void recordMarketplaceSkillEvent(skillKey, {
      event_type: 'skill_impression',
      entry_point: 'paywall',
    }).catch(() => undefined)
  }, [props.open, skill, skillKey])

  const purchaseMutation = useMutation({
    mutationFn: async () => {
      if (skill == null) throw new Error('Missing Skill')
      await recordMarketplaceSkillEvent(skillKey, {
        event_type: 'skill_detail_view',
        entry_point: 'paywall',
      }).catch(() => undefined)
      return purchaseSkill(skillKey, {
        idempotency_key: paywallIdempotencyKey(skill),
        entry_point: 'paywall',
      })
    },
    onSuccess: async (response) => {
      if (response.entitled !== true) {
        toast.error(t('Purchase did not complete. Please try again.'))
        return
      }
      setPurchaseSucceeded(true)
      toast.success(t('Unlocked. You can continue with this Skill.'))
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['marketplace-skills'] }),
        queryClient.invalidateQueries({ queryKey: ['marketplace-skill'] }),
        queryClient.invalidateQueries({ queryKey: ['marketplace-my-skills'] }),
      ])
    },
    onError: () => {
      toast.error(t('Unlock failed. Check your wallet balance and try again.'))
    },
  })

  const compareRows = useMemo(
    () => [
      t('永久拥有这 1 个 Skill'),
      t('$2 几乎免费试，一次用顺就回本'),
      t('后续下载和运行权限跟随账号保留'),
    ],
    [t]
  )

  function handlePlus() {
    if (skill != null) {
      void recordMarketplaceSkillEvent(skillKey, {
        event_type: 'skill_detail_view',
        entry_point: 'paywall',
      }).catch(() => undefined)
    }
    void navigate({ to: '/pricing' })
  }

  function handleContinue() {
    if (skill == null) return
    props.onContinue?.(skill)
    props.onOpenChange(false)
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className='max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl'>
        <DialogHeader>
          <div className='bg-primary/8 text-primary inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold'>
            <LockKeyhole className='size-3.5' aria-hidden='true' />
            {t('Paywall')}
          </div>
          <DialogTitle className='text-xl font-semibold'>
            {purchaseSucceeded
              ? t('Skill unlocked')
              : t('Unlock {{name}}', { name: skill?.name ?? t('this Skill') })}
          </DialogTitle>
          <DialogDescription>
            {t(
              '$2 USD 单买永久解锁，或升级 PLUS $19.9/mo 一次解锁全部 6 个 Skills。'
            )}
          </DialogDescription>
        </DialogHeader>

        {purchaseSucceeded ? (
          <div className='border-border bg-background/70 flex flex-col gap-4 rounded-xl border p-4'>
            <div className='flex items-start gap-3'>
              <CheckCircle2
                className='mt-0.5 size-5 text-green-600'
                aria-hidden='true'
              />
              <div>
                <div className='font-semibold'>{t('Purchase complete')}</div>
                <p className='text-muted-foreground mt-1 text-sm'>
                  {t('Your permanent Skill unlock is active on this account.')}
                </p>
              </div>
            </div>
            <Button
              type='button'
              className='self-start'
              onClick={handleContinue}
            >
              {t('Continue')}
              <ArrowRight data-icon='inline-end' />
            </Button>
          </div>
        ) : (
          <div className='grid gap-3 md:grid-cols-2'>
            <PaywallOption
              selected
              icon={<Sparkles className='size-5' aria-hidden='true' />}
              title={t('$2 解锁本个')}
              price={t('永久')}
              description={t('几乎免费试，一辈子 ROI。适合只需要当前 Skill。')}
              bullets={compareRows}
              action={
                <Button
                  type='button'
                  className='w-full'
                  disabled={purchaseMutation.isPending}
                  onClick={() => purchaseMutation.mutate()}
                >
                  <Sparkles data-icon='inline-start' />
                  {purchaseMutation.isPending
                    ? t('Unlocking...')
                    : t('$2 解锁本个 (永久)')}
                </Button>
              }
            />
            <PaywallOption
              icon={<Gem className='size-5' aria-hidden='true' />}
              title={t('PLUS')}
              price={t('$19.9/mo')}
              description={t('升级 PLUS，一次解锁全部 6 个 Skills。')}
              bullets={[
                t('全 6 Skill 可用'),
                t('持续获得新增和升级体验'),
                t('更适合每周都会使用多个工作流'),
              ]}
              action={
                <Button
                  type='button'
                  variant='outline'
                  className='w-full'
                  onClick={handlePlus}
                >
                  {t('升级 PLUS')}
                  <ArrowRight data-icon='inline-end' />
                </Button>
              }
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function PaywallOption(props: {
  selected?: boolean
  icon: ReactNode
  title: string
  price: string
  description: string
  bullets: string[]
  action: ReactNode
}) {
  return (
    <section
      className={cn(
        'border-border bg-background/70 flex min-h-[290px] flex-col gap-4 rounded-xl border p-4',
        props.selected && 'border-primary/50 bg-primary/5'
      )}
    >
      <div className='flex items-start justify-between gap-3'>
        <div className='flex items-center gap-2'>
          <span className='bg-card text-primary flex size-9 items-center justify-center rounded-lg border'>
            {props.icon}
          </span>
          <div>
            <h3 className='font-semibold'>{props.title}</h3>
            <p className='text-muted-foreground text-xs'>{props.price}</p>
          </div>
        </div>
      </div>
      <p className='text-muted-foreground text-sm leading-6'>
        {props.description}
      </p>
      <ul className='text-muted-foreground flex flex-1 flex-col gap-2 text-sm'>
        {props.bullets.map((bullet) => (
          <li key={bullet} className='flex gap-2'>
            <CheckCircle2
              className='mt-0.5 size-4 shrink-0 text-green-600'
              aria-hidden='true'
            />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
      {props.action}
    </section>
  )
}
