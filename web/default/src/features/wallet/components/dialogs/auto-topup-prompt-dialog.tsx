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
import { Loader2 } from 'lucide-react'
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
import { updateAutoTopup } from '../../api'

const DEFAULT_USD = 10
const QUOTA_PER_USD = 100000

interface AutoTopupPromptDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onEnabled?: () => void
}

// One-time prompt shown right after a user's first card top-up (card now saved
// but auto-recharge not yet on). One click turns it on at the default amount.
export function AutoTopupPromptDialog({
  open,
  onOpenChange,
  onEnabled,
}: AutoTopupPromptDialogProps) {
  const { t } = useTranslation()
  const [saving, setSaving] = useState(false)

  const enable = async () => {
    setSaving(true)
    const quota = DEFAULT_USD * QUOTA_PER_USD
    try {
      const res = await updateAutoTopup({
        auto_topup_enabled: true,
        auto_topup_amount: quota,
        auto_topup_threshold: quota,
      })
      if (res.success) {
        toast.success(t('Auto-recharge is on'))
        onEnabled?.()
        onOpenChange(false)
      } else {
        toast.error(res.message || t('Update failed'))
      }
    } catch {
      toast.error(t('Update failed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('Your card is saved 🎉')}</DialogTitle>
          <DialogDescription>
            {t(
              'Turn on auto-recharge so you never run out — we top up $10 to your balance automatically when it gets low. Change or cancel it anytime in your wallet.'
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            {t('Not now')}
          </Button>
          <Button onClick={enable} disabled={saving}>
            {saving ? (
              <Loader2 className='size-4 animate-spin' />
            ) : (
              t('Enable auto-recharge')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
