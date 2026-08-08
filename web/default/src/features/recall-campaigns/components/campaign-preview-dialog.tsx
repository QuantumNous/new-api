import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { previewRecallCampaign } from '../api'
import { CampaignPreviewDialogContent } from './campaign-preview-dialog-content'

interface CampaignPreviewDialogProps {
  campaignId: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const RECALL_CAMPAIGN_PREVIEW_DIALOG_DESCRIPTION =
  'Review eligibility, exclusions, and delivery validation before activation.'

export function CampaignPreviewDialog(props: CampaignPreviewDialogProps) {
  const { t } = useTranslation()
  const preview = useQuery({
    queryKey: ['recall-campaigns', 'preview', props.campaignId],
    queryFn: () => previewRecallCampaign(props.campaignId),
    enabled: props.open && props.campaignId > 0,
  })
  const data = preview.data?.data

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className='max-h-[85vh] overflow-y-auto sm:max-w-3xl'>
        <DialogHeader>
          <DialogTitle>{t('Campaign preview')}</DialogTitle>
          <DialogDescription>
            {t(RECALL_CAMPAIGN_PREVIEW_DIALOG_DESCRIPTION)}
          </DialogDescription>
        </DialogHeader>
        <CampaignPreviewDialogContent
          data={data}
          isError={preview.isError}
          isLoading={preview.isLoading}
        />
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  )
}
