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
import { useNavigate } from '@tanstack/react-router'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { api } from '@/lib/api'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { deleteUserAccount } from '../../api'

// ============================================================================
// Delete Account Dialog Component
// ============================================================================

interface DeleteAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  username: string
}

export function DeleteAccountDialog({
  open,
  onOpenChange,
  username,
}: DeleteAccountDialogProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { reset } = useAuthStore((state) => state.auth)
  const [loading, setLoading] = useState(false)
  const [confirmation, setConfirmation] = useState('')

  const handleDelete = async () => {
    if (confirmation !== username) {
      toast.error(t('Username confirmation does not match'))
      return
    }

    try {
      setLoading(true)
      const response = await deleteUserAccount()

      if (response.success) {
        toast.success(t('Account deleted successfully'))

        // Logout and redirect
        try {
          await api.get('/api/user/logout')
        } catch {
          // Ignore logout errors
        }

        reset()
        localStorage.removeItem('user')
        navigate({ to: '/sign-in' })
      } else {
        toast.error(response.message || t('Failed to delete account'))
      }
    } catch (_error) {
      toast.error(t('Failed to delete account'))
    } finally {
      setLoading(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!loading) {
      onOpenChange(open)
      if (!open) {
        setConfirmation('')
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='text-destructive flex items-center gap-2'>
            <AlertTriangle className='h-5 w-5' />
            {t('Delete Account')}
          </DialogTitle>
          <DialogDescription>
            {t(
              'This action cannot be undone. This will permanently delete your account and remove all your data from our servers.'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className='my-6 space-y-4'>
          <Alert variant='destructive'>
            <AlertTriangle className='h-4 w-4' />
            <AlertDescription>
              {t('Warning: This action is permanent and irreversible!')}
            </AlertDescription>
          </Alert>

          <div className='space-y-2'>
            <Label htmlFor='confirmation'>
              {t('Type')} <strong>{username}</strong> {t('to confirm')}
            </Label>
            <Input
              id='confirmation'
              type='text'
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              disabled={loading}
              placeholder={username}
              autoComplete='off'
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            onClick={() => handleOpenChange(false)}
            disabled={loading}
          >
            {t('Cancel')}
          </Button>
          <Button
            type='button'
            variant='destructive'
            onClick={handleDelete}
            disabled={loading || confirmation !== username}
          >
            {loading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            {loading ? t('Deleting...') : t('Delete Account')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
