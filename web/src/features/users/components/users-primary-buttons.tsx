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
import { Loader2, Mail, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useStatus } from '@/hooks/use-status'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import { sendUserInvite } from '../api'
import { useUsers } from './users-provider'

export function UsersPrimaryButtons() {
  const { t } = useTranslation()
  const { setOpen, setCurrentRow } = useUsers()
  const currentUser = useAuthStore((state) => state.auth.user)
  const { status } = useStatus()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [role, setRole] = useState<number>(ROLE.USER)
  const [isSending, setIsSending] = useState(false)

  const singlePrimaryEnabled = Boolean(
    status?.single_primary_api_key_enabled ??
    status?.data?.single_primary_api_key_enabled
  )

  const handleCreate = () => {
    setCurrentRow(null)
    setOpen('create')
  }

  const handleInvite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedEmail = email.trim()
    const normalizedUsername = username.trim()
    if (!normalizedEmail || !normalizedUsername) return

    setIsSending(true)
    try {
      const result = await sendUserInvite({
        email: normalizedEmail,
        username: normalizedUsername,
        role,
      })
      if (result.success) {
        toast.success(t('Invitation email sent'))
        setEmail('')
        setUsername('')
        setRole(ROLE.USER)
        setInviteOpen(false)
      } else {
        toast.error(result.message || t('Failed to send invitation email'))
      }
    } catch {
      toast.error(t('Failed to send invitation email'))
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className='flex gap-2'>
      {singlePrimaryEnabled && (
        <Dialog
          open={inviteOpen}
          onOpenChange={(open) => {
            setInviteOpen(open)
            if (!open) {
              setEmail('')
              setUsername('')
              setRole(ROLE.USER)
            }
          }}
          title={t('Invite User')}
          description={t(
            'Send a one-time registration link. The user will create their account and receive a single API Key after confirmation.'
          )}
          trigger={
            <Button size='sm' variant='outline'>
              <Mail className='h-4 w-4' />
              {t('Invite User')}
            </Button>
          }
          footer={
            <>
              <Button
                type='button'
                variant='outline'
                onClick={() => setInviteOpen(false)}
                disabled={isSending}
              >
                {t('Cancel')}
              </Button>
              <Button
                type='submit'
                form='user-invite-form'
                disabled={isSending || !email.trim() || !username.trim()}
              >
                {isSending && <Loader2 className='animate-spin' />}
                {t('Send Invitation')}
              </Button>
            </>
          }
        >
          <form
            id='user-invite-form'
            onSubmit={handleInvite}
            className='grid gap-2'
          >
            <Label htmlFor='user-invite-email'>{t('Email')}</Label>
            <Input
              id='user-invite-email'
              type='email'
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder='name@example.com'
              autoComplete='email'
              required
              disabled={isSending}
            />
            <Label htmlFor='user-invite-username'>{t('Username')}</Label>
            <Input
              id='user-invite-username'
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder={t('Enter username')}
              autoComplete='username'
              maxLength={20}
              required
              disabled={isSending}
            />
            <Label htmlFor='user-invite-role'>{t('Role')}</Label>
            <select
              id='user-invite-role'
              value={role}
              onChange={(event) => setRole(Number(event.target.value))}
              disabled={isSending}
              className='border-input bg-background h-9 rounded-md border px-3 text-sm'
            >
              <option value={ROLE.USER}>{t('Common User')}</option>
              {currentUser?.role === ROLE.SUPER_ADMIN && (
                <option value={ROLE.ADMIN}>{t('Admin')}</option>
              )}
            </select>
          </form>
        </Dialog>
      )}
      <Button size='sm' onClick={handleCreate}>
        <Plus className='h-4 w-4' />
        {t('Add User')}
      </Button>
    </div>
  )
}
