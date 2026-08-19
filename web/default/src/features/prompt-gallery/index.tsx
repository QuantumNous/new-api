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
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { SectionPageLayout } from '@/components/layout'
import { PromptGalleryMutateDialog } from './components/prompt-gallery-mutate-dialog'
import { PromptGalleryTable } from './components/prompt-gallery-table'
import type { PromptLibraryAdminItem } from './types'

export function PromptGallery() {
  const { t } = useTranslation()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [currentRow, setCurrentRow] = useState<PromptLibraryAdminItem | null>(
    null
  )

  const openCreate = () => {
    setCurrentRow(null)
    setDialogOpen(true)
  }

  const openEdit = (item: PromptLibraryAdminItem) => {
    setCurrentRow(item)
    setDialogOpen(true)
  }

  return (
    <>
      <SectionPageLayout>
        <SectionPageLayout.Title>{t('Prompt Gallery')}</SectionPageLayout.Title>
        <SectionPageLayout.Actions>
          <Button size='sm' onClick={openCreate}>
            <Plus className='h-4 w-4' />
            {t('Create Prompt')}
          </Button>
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          <PromptGalleryTable onEdit={openEdit} />
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <PromptGalleryMutateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        currentRow={currentRow}
      />
    </>
  )
}
