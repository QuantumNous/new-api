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
import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Check, Copy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { copyToClipboard } from '@/lib/copy-to-clipboard'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type ApiKeyRevealDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The RAW key string (without the `sk-` prefix). */
  apiKey: string
}

export function ApiKeyRevealDialog({
  open,
  onOpenChange,
  apiKey,
}: ApiKeyRevealDialogProps) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  if (!apiKey) return null

  const fullKey = `sk-${apiKey}`

  const handleCopy = async () => {
    const ok = await copyToClipboard(fullKey)
    if (ok) {
      setCopied(true)
      toast.success(t('Copied to clipboard'))
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v)
        if (!v) setCopied(false)
      }}
    >
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{t('Your new key')}</DialogTitle>
        </DialogHeader>

        <div className='flex flex-col gap-3'>
          <div className='flex items-center gap-2'>
            <input
              readOnly
              value={fullKey}
              autoFocus
              onFocus={(e) => e.target.select()}
              className='bg-muted/50 w-full min-w-0 rounded-md border px-3 py-2 font-mono text-xs outline-none'
            />
            <Button
              type='button'
              variant='outline'
              size='icon'
              className='size-9 shrink-0'
              onClick={handleCopy}
            >
              {copied ? (
                <Check className='size-4 text-green-600' />
              ) : (
                <Copy className='size-4' />
              )}
              <span className='sr-only'>{t('Copy API key')}</span>
            </Button>
          </div>

          <p className='text-muted-foreground text-sm'>
            {t('Please copy it now and save it somewhere safe.')}
          </p>

          <p className='text-muted-foreground text-sm'>
            {t('You can use it with OpenAI-compatible apps, or')}{' '}
            <Link
              to='/quickstart'
              className='text-foreground font-medium underline underline-offset-3'
              onClick={() => onOpenChange(false)}
            >
              {t('your own code')}
            </Link>
            .
          </p>
        </div>

        <DialogFooter>
          <DialogClose render={<Button className='w-full sm:w-auto' />}>
            {t('Done')}
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
