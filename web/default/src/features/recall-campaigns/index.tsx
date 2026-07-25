import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SectionPageLayout } from '@/components/layout'
import { CampaignEditor } from './components/campaign-editor'
import { CampaignTable } from './components/campaign-table'

export function RecallCampaigns() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        {t('Activity Configuration')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <Button onClick={() => setCreating(true)}>
          {t('Create activity configuration')}
        </Button>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <CampaignTable />
        <Dialog open={creating} onOpenChange={setCreating}>
          <DialogContent className='max-h-[92vh] overflow-y-auto sm:max-w-5xl'>
            <DialogHeader>
              <DialogTitle>{t('Create activity configuration')}</DialogTitle>
              <DialogDescription>
                {t(
                  'Configure a reviewed audience template, Stripe discount, schedule, and email sequence.'
                )}
              </DialogDescription>
            </DialogHeader>
            <CampaignEditor
              onSaved={(campaignId) => {
                setCreating(false)
                void navigate({
                  to: '/recall-campaigns/$campaignId',
                  params: { campaignId: String(campaignId) },
                })
              }}
            />
          </DialogContent>
        </Dialog>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
