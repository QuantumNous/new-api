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
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'

import { deleteUsedInvitationCodes } from './api'
import { CreateInvitationCodesDialog } from './components/create-invitation-codes-dialog'
import { GeneratedInvitationCodesDialog } from './components/generated-invitation-codes-dialog'
import { InvitationCodesTable } from './components/invitation-codes-table'

export function InvitationCodes() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteUsedOpen, setDeleteUsedOpen] = useState(false)
  const [generatedOpen, setGeneratedOpen] = useState(false)
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([])

  const deleteUsedMutation = useMutation({
    mutationFn: deleteUsedInvitationCodes,
    onSuccess: (result) => {
      if (!result.success) {
        toast.error(result.message || t('Failed to delete used codes'))
        return
      }
      toast.success(
        t('Deleted {{count}} used invitation codes', {
          count: result.data ?? 0,
        })
      )
      setDeleteUsedOpen(false)
      queryClient.invalidateQueries({ queryKey: ['invitation-codes'] })
    },
  })

  const handleCreated = (codes: string[]) => {
    setCreateOpen(false)
    setGeneratedCodes(codes)
    setGeneratedOpen(true)
    queryClient.invalidateQueries({ queryKey: ['invitation-codes'] })
  }

  const handleGeneratedOpenChange = (open: boolean) => {
    setGeneratedOpen(open)
    if (!open) setGeneratedCodes([])
  }

  return (
    <>
      <SectionPageLayout fixedContent>
        <SectionPageLayout.Title>
          {t('Invitation codes')}
        </SectionPageLayout.Title>
        <SectionPageLayout.Actions>
          <Button
            size='sm'
            variant='outline'
            className='gap-2'
            onClick={() => setDeleteUsedOpen(true)}
          >
            <Trash2 className='text-destructive size-4' />
            {t('Delete used')}
          </Button>
          <Button
            size='sm'
            className='gap-2'
            onClick={() => setCreateOpen(true)}
          >
            <Plus className='size-4' />
            {t('Generate codes')}
          </Button>
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          <InvitationCodesTable />
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <CreateInvitationCodesDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleCreated}
      />
      <GeneratedInvitationCodesDialog
        codes={generatedCodes}
        open={generatedOpen}
        onOpenChange={handleGeneratedOpenChange}
      />
      <ConfirmDialog
        destructive
        open={deleteUsedOpen}
        onOpenChange={setDeleteUsedOpen}
        title={t('Delete all used invitation codes?')}
        desc={t('All used invitation codes will be permanently deleted.')}
        confirmText={t('Delete used')}
        isLoading={deleteUsedMutation.isPending}
        handleConfirm={() => deleteUsedMutation.mutate()}
      />
    </>
  )
}
