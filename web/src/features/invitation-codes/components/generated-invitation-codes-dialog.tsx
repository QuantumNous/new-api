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
import { Copy, Download } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'

type GeneratedInvitationCodesDialogProps = {
  codes: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GeneratedInvitationCodesDialog(
  props: GeneratedInvitationCodesDialogProps
) {
  const { t } = useTranslation()
  const { copyToClipboard } = useCopyToClipboard()
  const codeText = props.codes.join('\n')

  const downloadCodes = () => {
    const blob = new Blob([codeText], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `invitation-codes-${new Date().toISOString().slice(0, 10)}.txt`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    toast.success(t('Invitation codes downloaded'))
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('Invitation codes generated')}
      description={t('Store these codes now. They will not be shown again.')}
      contentClassName='max-w-lg'
      footer={
        <>
          <Button
            variant='outline'
            className='gap-2'
            onClick={() => copyToClipboard(codeText)}
          >
            <Copy className='size-4' />
            {t('Copy all')}
          </Button>
          <Button className='gap-2' onClick={downloadCodes}>
            <Download className='size-4' />
            {t('Download')}
          </Button>
        </>
      }
    >
      <Textarea
        readOnly
        value={codeText}
        className='min-h-56 resize-none font-mono text-sm'
        aria-label={t('Generated invitation codes')}
      />
    </Dialog>
  )
}
