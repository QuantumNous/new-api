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
  usageLogsContentDialogDescClassName,
  usageLogsContentDialogLabelClassName,
  usageLogsContentDialogPanelClassName,
  usageLogsContentDialogSurfaceClassName,
  usageLogsContentDialogTextClassName,
  usageLogsContentDialogTitleClassName,
} from '../../lib/ops-ui-styles'

interface PromptDialogProps {
  prompt: string
  promptEn?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PromptDialog({
  prompt,
  promptEn,
  open,
  onOpenChange,
}: PromptDialogProps) {
  const { t } = useTranslation()
  const { copiedText, copyToClipboard } = useCopyToClipboard({ notify: false })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={usageLogsContentDialogSurfaceClassName}>
        <DialogHeader>
          <DialogTitle className={usageLogsContentDialogTitleClassName}>
            {t('usageLogs.dialog.prompt.title')}
          </DialogTitle>
          <DialogDescription className={usageLogsContentDialogDescClassName}>
            {t('usageLogs.dialog.prompt.description')}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className='max-h-[500px] pr-4'>
          <div className='space-y-4 py-4'>
            <div className='space-y-2'>
              <Label className={usageLogsContentDialogLabelClassName}>
                {t('usageLogs.dialog.prompt.original')}
              </Label>
              <div className={usageLogsContentDialogPanelClassName}>
                <Button
                  variant='ghost'
                  size='sm'
                  className={usageLogsContentDialogCopyButtonClassName}
                  onClick={() => copyToClipboard(prompt)}
                  title={t('usageLogs.action.copy_content')}
                >
                  {copiedText === prompt ? (
                    <Check className='text-emerald-400' />
                  ) : (
                    <Copy />
                  )}
                </Button>
                <p className={usageLogsContentDialogTextClassName}>
                  {prompt || '-'}
                </p>
              </div>
            </div>

            {promptEn && (
              <div className='space-y-2'>
                <Label className={usageLogsContentDialogLabelClassName}>
                  {t('usageLogs.dialog.prompt.english')}
                </Label>
                <div className={usageLogsContentDialogPanelClassName}>
                  <Button
                    variant='ghost'
                    size='sm'
                    className={usageLogsContentDialogCopyButtonClassName}
                    onClick={() => copyToClipboard(promptEn)}
                    title={t('usageLogs.action.copy_content')}
                  >
                    {copiedText === promptEn ? (
                      <Check className='text-emerald-400' />
                    ) : (
                      <Copy />
                    )}
                  </Button>
                  <p className={usageLogsContentDialogTextClassName}>{promptEn}</p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
