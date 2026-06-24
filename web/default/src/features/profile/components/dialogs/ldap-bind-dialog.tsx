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
import { KeyRound, Loader2 } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/password-input'
import { bindLDAP } from '../../api'

type LDAPBindDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function LDAPBindDialog({
  open,
  onOpenChange,
  onSuccess,
}: LDAPBindDialogProps) {
  const { t } = useTranslation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const reset = () => {
    setUsername('')
    setPassword('')
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (loading) return
    onOpenChange(nextOpen)
    if (!nextOpen) reset()
  }

  const handleBind = async () => {
    if (!username.trim() || !password) {
      toast.error(t('Please enter your LDAP username and password'))
      return
    }

    setLoading(true)
    try {
      const response = await bindLDAP({
        username: username.trim(),
        password,
      })
      if (response.success) {
        toast.success(t('LDAP account bound successfully'))
        onSuccess()
        onOpenChange(false)
        reset()
      } else {
        toast.error(response.message || t('Failed to bind LDAP account'))
      }
    } catch {
      toast.error(t('Failed to bind LDAP account'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <KeyRound className='h-5 w-5' />
            {t('Bind LDAP Account')}
          </DialogTitle>
          <DialogDescription>
            {t('Enter your LDAP username and password to bind your account.')}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-4'>
          <div className='space-y-2'>
            <Label htmlFor='ldap-bind-username'>{t('LDAP username')}</Label>
            <Input
              id='ldap-bind-username'
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder={t('Enter your LDAP username')}
              autoComplete='username'
              disabled={loading}
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='ldap-bind-password'>{t('LDAP password')}</Label>
            <PasswordInput
              id='ldap-bind-password'
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete='current-password'
              disabled={loading}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void handleBind()
                }
              }}
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
          <Button type='button' onClick={handleBind} disabled={loading}>
            {loading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            {t('Bind')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
