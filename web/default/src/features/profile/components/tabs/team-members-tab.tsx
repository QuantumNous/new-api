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
import { UserPlus, UserMinus, Users, UserCheck, Unlink } from 'lucide-react'
import { useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'

import {
  getChildAccounts,
  addChildAccount,
  removeChildAccount,
  getSelfParent,
  removeSelfParent,
  type ChildAccount,
  type ParentAccount,
} from '../../api'
import type { UserProfile } from '../../types'

// ============================================================================
// Team Members Tab Component
// ============================================================================

interface TeamMembersTabProps {
  profile: UserProfile | null
  onUpdate: () => void
}

export function TeamMembersTab({ profile, onUpdate }: TeamMembersTabProps) {
  const { t } = useTranslation()

  // ── child view state ──────────────────────────────────────────────────────
  const [parent, setParent] = useState<ParentAccount | null>(null)
  const [parentLoading, setParentLoading] = useState(false)
  const [confirmUnbindParent, setConfirmUnbindParent] = useState(false)
  const [unbindingParent, setUnbindingParent] = useState(false)

  // ── parent view state ─────────────────────────────────────────────────────
  const [children, setChildren] = useState<ChildAccount[]>([])
  const [childrenLoading, setChildrenLoading] = useState(false)
  const [emailInput, setEmailInput] = useState('')
  const [adding, setAdding] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<ChildAccount | null>(null)
  const [removing, setRemoving] = useState(false)

  const isChild = (profile?.parent_id ?? 0) > 0

  // ── fetch parent info (child mode) ────────────────────────────────────────
  const fetchParent = useCallback(async () => {
    setParentLoading(true)
    try {
      const res = await getSelfParent()
      if (res.success) {
        setParent(res.data ?? null)
      }
    } catch {
      // ignore
    } finally {
      setParentLoading(false)
    }
  }, [])

  // ── fetch children (parent mode) ──────────────────────────────────────────
  const fetchChildren = useCallback(async () => {
    setChildrenLoading(true)
    try {
      const res = await getChildAccounts()
      if (res.success && res.data) {
        setChildren(res.data)
      }
    } catch {
      // ignore
    } finally {
      setChildrenLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!profile) return
    if (isChild) {
      fetchParent()
    } else {
      fetchChildren()
    }
  }, [profile, isChild, fetchParent, fetchChildren])

  // ── child: unbind from parent ─────────────────────────────────────────────
  const handleUnbindParent = async () => {
    setUnbindingParent(true)
    try {
      const res = await removeSelfParent()
      if (res.success) {
        toast.success(t('Unbound from parent account'))
        setConfirmUnbindParent(false)
        onUpdate()
      } else {
        toast.error(res.message || t('Unbind failed'))
      }
    } catch {
      toast.error(t('Unbind failed'))
    } finally {
      setUnbindingParent(false)
    }
  }

  // ── parent: add child ─────────────────────────────────────────────────────
  const handleAdd = async () => {
    const input = emailInput.trim()
    if (!input) return
    setAdding(true)
    try {
      const payload = input.includes('@')
        ? { email: input }
        : { user_id: parseInt(input, 10) }
      const res = await addChildAccount(payload)
      if (res.success) {
        toast.success(t('Member added successfully'))
        setEmailInput('')
        await fetchChildren()
      } else {
        toast.error(res.message || t('Failed to add member'))
      }
    } catch {
      toast.error(t('Failed to add member'))
    } finally {
      setAdding(false)
    }
  }

  // ── parent: remove child ──────────────────────────────────────────────────
  const handleRemove = async () => {
    if (!removeTarget) return
    setRemoving(true)
    try {
      const res = await removeChildAccount(removeTarget.id)
      if (res.success) {
        toast.success(t('Member removed'))
        setRemoveTarget(null)
        await fetchChildren()
      } else {
        toast.error(res.message || t('Failed to remove member'))
      }
    } catch {
      toast.error(t('Failed to remove member'))
    } finally {
      setRemoving(false)
    }
  }

  if (!profile) return null

  // ── Child view ────────────────────────────────────────────────────────────
  if (isChild) {
    return (
      <>
        <div className='space-y-3'>
          <p className='text-muted-foreground text-xs'>
            {t(
              'Your account is managed under a parent account. API costs are billed to the parent.'
            )}
          </p>

          {parentLoading ? (
            <div className='bg-muted h-16 animate-pulse rounded-lg' />
          ) : parent ? (
            <div className='flex items-center justify-between gap-3 rounded-lg border p-3'>
              <div className='flex min-w-0 items-center gap-3'>
                <div className='bg-muted shrink-0 rounded-md p-2'>
                  <UserCheck className='h-4 w-4' />
                </div>
                <div className='min-w-0'>
                  <p className='text-sm font-medium'>
                    {parent.display_name || parent.username}
                  </p>
                  <p className='text-muted-foreground truncate text-xs'>
                    {parent.email || parent.username}
                  </p>
                </div>
              </div>
              <Button
                variant='ghost'
                size='sm'
                className='text-destructive h-7 shrink-0 gap-1 px-2 text-xs'
                onClick={() => setConfirmUnbindParent(true)}
              >
                <Unlink className='h-3.5 w-3.5' />
                {t('Unbind')}
              </Button>
            </div>
          ) : (
            <div className='text-muted-foreground py-4 text-center text-sm'>
              {t('Parent account not found')}
            </div>
          )}
        </div>

        <ConfirmDialog
          open={confirmUnbindParent}
          onOpenChange={(open) => !open && setConfirmUnbindParent(false)}
          title={t('Unbind from parent account')}
          desc={t(
            'After unbinding, your API costs will be billed to your own account independently.'
          )}
          confirmText={t('Unbind')}
          destructive
          handleConfirm={handleUnbindParent}
          isLoading={unbindingParent}
        />
      </>
    )
  }

  // ── Parent view ───────────────────────────────────────────────────────────
  return (
    <>
      <div className='space-y-4'>
        {/* Add member */}
        <div className='flex gap-2'>
          <Input
            placeholder={t('Email or user ID')}
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            className='h-8 text-sm'
          />
          <Button
            size='sm'
            className='h-8 shrink-0 gap-1.5 px-3 text-xs'
            onClick={handleAdd}
            disabled={adding || !emailInput.trim()}
          >
            <UserPlus className='h-3.5 w-3.5' />
            {t('Add member')}
          </Button>
        </div>

        <Separator />

        {/* Members list */}
        {childrenLoading ? (
          <div className='space-y-2'>
            {[1, 2].map((i) => (
              <div key={i} className='bg-muted h-14 animate-pulse rounded-lg' />
            ))}
          </div>
        ) : children.length === 0 ? (
          <div className='text-muted-foreground flex flex-col items-center gap-2 py-6 text-sm'>
            <Users className='h-8 w-8 opacity-40' />
            <span>{t('No team members yet')}</span>
            <span className='text-xs opacity-70'>
              {t(
                'Add members by email or user ID. Their API costs will be charged to your account.'
              )}
            </span>
          </div>
        ) : (
          <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
            {children.map((child) => (
              <div
                key={child.id}
                className='flex items-center justify-between gap-2 rounded-lg border p-2.5 sm:p-3'
              >
                <div className='flex min-w-0 items-center gap-2.5'>
                  <div className='bg-muted shrink-0 rounded-md p-1.5'>
                    <UserCheck className='h-3.5 w-3.5' />
                  </div>
                  <div className='min-w-0'>
                    <p className='truncate text-sm font-medium'>
                      {child.display_name || child.username}
                    </p>
                    <p className='text-muted-foreground truncate text-xs'>
                      {child.email || child.username}
                    </p>
                  </div>
                </div>
                <Button
                  variant='ghost'
                  size='sm'
                  className='text-destructive h-7 shrink-0 gap-1 px-2 text-xs'
                  onClick={() => setRemoveTarget(child)}
                >
                  <UserMinus className='h-3.5 w-3.5' />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title={t('Remove member')}
        desc={t(
          'Remove {{name}} from your team? They will be billed independently.',
          {
            name:
              removeTarget?.display_name ||
              removeTarget?.username ||
              String(removeTarget?.id),
          }
        )}
        confirmText={t('Remove')}
        destructive
        handleConfirm={handleRemove}
        isLoading={removing}
      />
    </>
  )
}
