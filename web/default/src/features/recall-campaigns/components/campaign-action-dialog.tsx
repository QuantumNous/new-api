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
import { RecallApiError, useRecallCampaignMutations } from '../api'
import { getRecallApiErrorCodeCopyKey } from '../copy'
import type {
  RecallCampaignAction,
  RecallEmailLocalizationBlocker,
} from '../types'

type DialogAction = RecallCampaignAction | 'retry'

interface CampaignActionDialogProps {
  campaignId: number
  action: DialogAction
  open: boolean
  onOpenChange: (open: boolean) => void
  recipientId?: number
  uncertain?: boolean
  onLocalizationBlocked?: (blocker: RecallEmailLocalizationBlocker) => void
}

// eslint-disable-next-line react-refresh/only-export-components
export function getRecallLocalizationBlockers(
  error: unknown
): RecallEmailLocalizationBlocker[] {
  if (!(error instanceof RecallApiError)) return []
  const data = error.data
  if (!data || typeof data !== 'object' || !('blockers' in data)) return []
  const blockers = (data as { blockers?: unknown }).blockers
  if (!Array.isArray(blockers)) return []
  return blockers.filter(
    (blocker): blocker is RecallEmailLocalizationBlocker =>
      Boolean(blocker) &&
      typeof blocker === 'object' &&
      Number.isInteger((blocker as RecallEmailLocalizationBlocker).stage_no) &&
      (blocker as RecallEmailLocalizationBlocker).stage_no > 0 &&
      typeof (blocker as RecallEmailLocalizationBlocker).locale === 'string' &&
      ['missing', 'stale', 'invalid'].includes(
        (blocker as RecallEmailLocalizationBlocker).reason
      )
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function handleRecallCampaignActionError(
  action: DialogAction,
  error: unknown,
  handlers: {
    onLocalizationBlocked?: (blocker: RecallEmailLocalizationBlocker) => void
    onClose: () => void
    onError: (message: string) => void
  }
): void {
  const blocker =
    action === 'activate' ? getRecallLocalizationBlockers(error)[0] : undefined
  if (blocker && handlers.onLocalizationBlocked) {
    handlers.onLocalizationBlocked(blocker)
    handlers.onClose()
    return
  }
  const codeCopy = getRecallApiErrorCodeCopyKey(error)
  handlers.onError(
    codeCopy ||
      (error instanceof Error && error.message.trim()
        ? error.message
        : 'Recall campaign request failed')
  )
}

export function CampaignActionDialog(props: CampaignActionDialogProps) {
  const { t } = useTranslation()
  const [acknowledged, setAcknowledged] = useState(false)
  const mutations = useRecallCampaignMutations(props.campaignId)
  const pending = mutations.action.isPending || mutations.retry.isPending

  const setOpen = (open: boolean) => {
    if (!open) setAcknowledged(false)
    props.onOpenChange(open)
  }

  const confirm = async () => {
    try {
      const response =
        props.action === 'retry'
          ? await mutations.retry.mutateAsync({
              recipientId: props.recipientId ?? 0,
              acknowledgeUncertain: acknowledged,
            })
          : await mutations.action.mutateAsync(props.action)
      if (!response.success) return
      toast.success(t('Campaign action completed'))
      setOpen(false)
    } catch (error) {
      handleRecallCampaignActionError(props.action, error, {
        onLocalizationBlocked: props.onLocalizationBlocked,
        onClose: () => setOpen(false),
        onError: (message) => toast.error(t(message)),
      })
    }
  }

  const getDescription = () => {
    if (props.action === 'cancel') {
      return t(
        'Cancelling stops future enrollment and messages. Stripe Promotion Codes already issued remain usable until their expiry.'
      )
    }
    if (props.action === 'retry' && props.uncertain) {
      return t(
        'This message has an uncertain delivery result. Retrying can send a duplicate email and requires explicit acknowledgment.'
      )
    }
    return t(
      'Confirm this campaign action. The audit timeline will record the operator action.'
    )
  }

  const description = getDescription()

  return (
    <Dialog open={props.open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t('Confirm {{action}}', { action: t(props.action) })}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {props.action === 'retry' && props.uncertain ? (
          <label className='flex items-start gap-2'>
            <input
              type='checkbox'
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
            />
            <span>
              {t(
                'I acknowledge that retrying an uncertain message may send a duplicate email.'
              )}
            </span>
          </label>
        ) : null}
        <DialogFooter showCloseButton>
          <Button
            variant={props.action === 'cancel' ? 'destructive' : 'default'}
            disabled={
              pending ||
              (props.action === 'retry' && props.uncertain && !acknowledged)
            }
            onClick={confirm}
          >
            {pending ? t('Processing') : t('Confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
