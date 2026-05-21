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
import { Copy, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  usageLogsContentDialogCopyButtonClassName,
  usageLogsContentDialogDangerPanelClassName,
  usageLogsContentDialogDangerTextClassName,
  usageLogsContentDialogDescClassName,
  usageLogsContentDialogLabelClassName,
  usageLogsContentDialogSurfaceClassName,
  usageLogsContentDialogTitleClassName,
} from '../../lib/ops-ui-styles'

interface FailReasonDialogProps {
  failReason: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FailReasonDialog({
  failReason,
  open,
  onOpenChange,
}: FailReasonDialogProps) {
  const { t } = useTranslation()
  const { copiedText, copyToClipboard } = useCopyToClipboard({ notify: false })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={usageLogsContentDialogSurfaceClassName}>
        <DialogHeader>
          <DialogTitle className={usageLogsContentDialogTitleClassName}>
            {t('usageLogs.dialog.fail_reason.title')}
          </DialogTitle>
          <DialogDescription className={usageLogsContentDialogDescClassName}>
            {t('usageLogs.dialog.fail_reason.description')}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className='max-h-[500px] pr-4'>
          <div className='space-y-4 py-4'>
            <div className='space-y-2'>
              <Label className={usageLogsContentDialogLabelClassName}>
                {t('usageLogs.dialog.fail_reason.error_message')}
              </Label>
              <div className={usageLogsContentDialogDangerPanelClassName}>
                <Button
                  variant='ghost'
                  size='sm'
                  className={usageLogsContentDialogCopyButtonClassName}
                  onClick={() => copyToClipboard(failReason)}
                  title={t('usageLogs.action.copy_content')}
                >
                  {copiedText === failReason ? (
                    <Check className='text-emerald-400' />
                  ) : (
                    <Copy />
                  )}
                </Button>
                <p className={usageLogsContentDialogDangerTextClassName}>
                  {failReason || '-'}
                </p>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
