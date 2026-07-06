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
import { Plus, Sparkles, Wrench } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import { useRulesDialog } from './rules-provider'
import { InitializeDialog } from './initialize-dialog'
import { ResolveTestDialog } from './resolve-test'

export function RulesPrimaryButtons() {
  const { t } = useTranslation()
  const { setOpen } = useRulesDialog()
  const [initializeOpen, setInitializeOpen] = useState(false)
  const [testOpen, setTestOpen] = useState(false)

  return (
    <>
      <div className='flex flex-wrap justify-end gap-2'>
        <Button
          variant='outline'
          size='sm'
          onClick={() => setTestOpen(true)}
        >
          <Wrench className='h-4 w-4' />
          {t('Test Matcher')}
        </Button>
        <Button
          variant='outline'
          size='sm'
          onClick={() => setInitializeOpen(true)}
        >
          <Sparkles className='h-4 w-4' />
          {t('Initialize from Existing')}
        </Button>
        <Button size='sm' onClick={() => setOpen('create')}>
          <Plus className='h-4 w-4' />
          {t('Create Rule')}
        </Button>
      </div>

      <InitializeDialog
        open={initializeOpen}
        onOpenChange={setInitializeOpen}
      />
      <ResolveTestDialog open={testOpen} onOpenChange={setTestOpen} />
    </>
  )
}
