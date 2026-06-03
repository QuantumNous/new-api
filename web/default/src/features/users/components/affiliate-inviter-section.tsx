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
import { useEffect, useState } from 'react'
import { Link2, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SideDrawerSection } from '@/components/drawer-layout'
import {
  previewAffiliateInviterChange,
  searchAffiliateInviterCandidates,
  updateAffiliateInviter,
} from '../api'
import {
  buildAffiliateInviterUpdatePayload,
  formatAffiliateInviterCandidateLabel,
  formatAffiliateInviterPath,
  validateAffiliateInviterChange,
} from '../lib'
import type { AffiliateInviterChangePreview, User } from '../types'

type AffiliateInviterSectionProps = {
  user: User
  onSuccess: () => void
}

export function AffiliateInviterSection({
  user,
  onSuccess,
}: AffiliateInviterSectionProps) {
  const { t } = useTranslation()
  const [keyword, setKeyword] = useState('')
  const [candidates, setCandidates] = useState<User[]>([])
  const [candidateLoading, setCandidateLoading] = useState(false)
  const [newInviterUserId, setNewInviterUserId] = useState(user.inviter_id || 0)
  const [reason, setReason] = useState('')
  const [preview, setPreview] = useState<AffiliateInviterChangePreview | null>(
    null
  )
  const [previewLoading, setPreviewLoading] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)

  useEffect(() => {
    setKeyword('')
    setCandidates([])
    setReason('')
    setPreview(null)
    setNewInviterUserId(user.inviter_id || 0)
  }, [user.id, user.inviter_id])

  const validateChange = () => {
    const message = validateAffiliateInviterChange(user.id, newInviterUserId, t)
    if (message) {
      toast.error(message)
      return false
    }
    return true
  }

  const handleSearch = async () => {
    setCandidateLoading(true)
    try {
      const result = await searchAffiliateInviterCandidates({
        keyword,
        page: 1,
        pageSize: 10,
      })
      if (!result.success) {
        toast.error(result.message || t('Failed to load inviter candidates'))
        return
      }
      const items = result.data?.items || []
      setCandidates(items.filter((candidate) => candidate.id !== user.id))
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('Failed to load inviter candidates')
      )
    } finally {
      setCandidateLoading(false)
    }
  }

  const handlePreview = async () => {
    if (!validateChange()) return
    setPreviewLoading(true)
    try {
      const result = await previewAffiliateInviterChange(
        user.id,
        newInviterUserId
      )
      if (!result.success || !result.data) {
        toast.error(result.message || t('Failed to preview inviter change'))
        return
      }
      setPreview(result.data)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('Failed to preview inviter change')
      )
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleSave = async () => {
    if (!validateChange()) return
    setSaveLoading(true)
    try {
      const result = await updateAffiliateInviter(
        user.id,
        buildAffiliateInviterUpdatePayload({
          newInviterUserId,
          reason,
        })
      )
      if (!result.success) {
        toast.error(result.message || t('Failed to save inviter'))
        return
      }
      toast.success(t('Inviter updated'))
      if (result.data) setPreview(result.data)
      onSuccess()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('Failed to save inviter')
      )
    } finally {
      setSaveLoading(false)
    }
  }

  return (
    <SideDrawerSection>
      <div className='flex items-start justify-between gap-3'>
        <div>
          <h3 className='text-sm font-medium'>{t('Affiliate Inviter')}</h3>
          <p className='text-muted-foreground text-xs'>
            {t('Search candidates, preview the relationship path, then save.')}
          </p>
        </div>
        <Badge variant={user.inviter_id ? 'default' : 'secondary'}>
          {user.inviter_id
            ? `${t('Current inviter')}: ${user.inviter_id}`
            : t('No inviter')}
        </Badge>
      </div>

      <div className='grid gap-2 sm:grid-cols-[1fr_auto]'>
        <Input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder={t('Search by user ID, username, display name, or email')}
        />
        <Button
          type='button'
          variant='outline'
          onClick={handleSearch}
          disabled={candidateLoading}
        >
          <Search className='mr-1 h-4 w-4' />
          {candidateLoading ? t('Searching...') : t('Search')}
        </Button>
      </div>

      {candidates.length > 0 && (
        <div className='bg-muted/20 flex max-h-40 flex-wrap gap-2 overflow-y-auto rounded-xl border p-2'>
          {candidates.map((candidate) => (
            <Button
              key={candidate.id}
              type='button'
              variant={
                Number(newInviterUserId) === Number(candidate.id)
                  ? 'default'
                  : 'outline'
              }
              size='sm'
              onClick={() => {
                setNewInviterUserId(candidate.id)
                setPreview(null)
              }}
            >
              {formatAffiliateInviterCandidateLabel(candidate)}
            </Button>
          ))}
        </div>
      )}

      <div className='grid gap-3 sm:grid-cols-[1fr_minmax(140px,auto)]'>
        <div className='space-y-2'>
          <Label>{t('New inviter user ID')}</Label>
          <Input
            type='number'
            min={0}
            step={1}
            value={newInviterUserId}
            placeholder={t('0 clears inviter')}
            onChange={(event) => {
              setNewInviterUserId(Number(event.target.value || 0))
              setPreview(null)
            }}
          />
        </div>
        <Button
          type='button'
          variant='secondary'
          className='self-end'
          onClick={() => {
            setNewInviterUserId(0)
            setPreview(null)
          }}
        >
          {t('Clear inviter')}
        </Button>
      </div>

      <div className='space-y-2'>
        <Label>{t('Reason')}</Label>
        <Input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder={t('Optional reason for audit log')}
        />
      </div>

      <div className='flex flex-wrap gap-2'>
        <Button
          type='button'
          variant='outline'
          onClick={handlePreview}
          disabled={previewLoading}
        >
          <Link2 className='mr-1 h-4 w-4' />
          {previewLoading ? t('Previewing...') : t('Preview impact')}
        </Button>
        <Button type='button' onClick={handleSave} disabled={saveLoading}>
          {saveLoading ? t('Saving...') : t('Save inviter')}
        </Button>
      </div>

      {preview && (
        <Alert>
          <AlertTitle>{t('Inviter change preview')}</AlertTitle>
          <AlertDescription>
            <div className='mt-2 grid gap-2 text-xs sm:grid-cols-2'>
              <div className='bg-background/70 rounded-lg p-2'>
                <span className='font-medium'>{t('Target user')}:</span>{' '}
                {`#${preview.target_user_id} ${preview.target_username || ''}`}
              </div>
              <div className='bg-background/70 rounded-lg p-2'>
                <span className='font-medium'>{t('Current inviter')}:</span>{' '}
                {preview.current_inviter_user_id
                  ? `#${preview.current_inviter_user_id} ${
                      preview.current_inviter_username || ''
                    }`
                  : t('None')}
              </div>
              <div className='bg-background/70 rounded-lg p-2'>
                <span className='font-medium'>{t('New inviter')}:</span>{' '}
                {preview.new_inviter_user_id
                  ? `#${preview.new_inviter_user_id} ${
                      preview.new_inviter_username || ''
                    }`
                  : t('None')}
              </div>
              <div className='bg-background/70 rounded-lg p-2'>
                <span className='font-medium'>{t('Current path')}:</span>{' '}
                {formatAffiliateInviterPath(preview.current_path_user_ids, t)}
              </div>
              <div className='bg-background/70 rounded-lg p-2'>
                <span className='font-medium'>{t('New path')}:</span>{' '}
                {formatAffiliateInviterPath(preview.new_path_user_ids, t)}
              </div>
              <div className='bg-background/70 rounded-lg p-2'>
                <span className='font-medium'>{t('Affected users')}:</span>{' '}
                {formatAffiliateInviterPath(
                  preview.affected_descendant_user_ids,
                  t
                )}
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}
    </SideDrawerSection>
  )
}
