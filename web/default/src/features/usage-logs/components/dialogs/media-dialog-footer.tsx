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
import { Download, Link2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { CopyButton } from '@/components/copy-button'
import { Button } from '@/components/ui/button'

interface MediaDialogFooterProps {
  mediaUrl: string
  disabled?: boolean
  isDownloading?: boolean
  onDownload: () => void
}

export function MediaDialogFooter({
  mediaUrl,
  disabled,
  isDownloading,
  onDownload,
}: MediaDialogFooterProps) {
  const { t } = useTranslation()

  return (
    <div className='flex flex-col gap-2 sm:flex-row sm:items-stretch'>
      <div className='bg-muted/60 flex min-w-0 flex-1 items-center gap-2 rounded-lg border px-3 py-2'>
        <Link2 className='text-muted-foreground size-4 shrink-0' />
        <p
          className='text-muted-foreground min-w-0 flex-1 truncate font-mono text-xs'
          title={mediaUrl}
        >
          {mediaUrl}
        </p>
        <CopyButton
          value={mediaUrl}
          variant='ghost'
          size='icon-sm'
          tooltip={t('Copy to clipboard')}
        />
      </div>
      <Button
        type='button'
        className='shrink-0 sm:min-w-28'
        disabled={disabled || isDownloading}
        onClick={onDownload}
      >
        <Download className='size-4' />
        {t('Download')}
      </Button>
    </div>
  )
}
