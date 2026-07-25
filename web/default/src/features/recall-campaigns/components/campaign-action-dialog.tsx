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
import { useRecallCampaignMutations } from '../api'
import type { RecallCampaignAction } from '../types'

type DialogAction = RecallCampaignAction | 'retry'

interface CampaignActionDialogProps {
  campaignId: number
  action: DialogAction
  open: boolean
  onOpenChange: (open: boolean) => void
  recipientId?: number
  uncertain?: boolean
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
