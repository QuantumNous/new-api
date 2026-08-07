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
import { ChevronDown, Loader2, Search } from 'lucide-react'
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

import {
  categorizeModelsByVendor,
  getSortedVendorCategoryEntries,
  normalizeModelName,
} from '../../lib'

type SingleModelSelectDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  fetcher: () => Promise<string[]>
  selected?: string
  onConfirm: (model: string) => void
}

export function SingleModelSelectDialog(props: SingleModelSelectDialogProps) {
  const { t } = useTranslation()
  const radioIdPrefix = useId()
  const [isFetching, setIsFetching] = useState(false)
  const [models, setModels] = useState<string[]>([])
  const [searchKeyword, setSearchKeyword] = useState('')
  const [selectedModel, setSelectedModel] = useState('')

  const handleFetch = async () => {
    setIsFetching(true)
    try {
      const list = await props.fetcher()
      const normalized = [
        ...new Set(list.map((m) => normalizeModelName(m)).filter(Boolean)),
      ]
      setModels(normalized)
      const currentValue = normalizeModelName(props.selected ?? '')
      setSelectedModel(normalized.includes(currentValue) ? currentValue : '')
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : t('Failed to fetch models')
      )
      setModels([])
    } finally {
      setIsFetching(false)
    }
  }

  useEffect(() => {
    if (props.open) {
      handleFetch()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open])

  const handleClose = () => {
    setModels([])
    setSearchKeyword('')
    setSelectedModel('')
    props.onOpenChange(false)
  }

  const handleConfirmClick = () => {
    props.onConfirm(selectedModel)
    handleClose()
  }

  const filteredModels = useMemo(() => {
    if (!searchKeyword) return models
    return models.filter((model) =>
      model.toLowerCase().includes(searchKeyword.toLowerCase())
    )
  }, [models, searchKeyword])

  const categoryEntries = useMemo(
    () =>
      getSortedVendorCategoryEntries(categorizeModelsByVendor(filteredModels)),
    [filteredModels]
  )

  let body: ReactNode
  if (isFetching) {
    body = (
      <div className='flex items-center justify-center py-12'>
        <Loader2 className='text-muted-foreground h-8 w-8 animate-spin' />
      </div>
    )
  } else if (models.length === 0) {
    body = (
      <div className='text-muted-foreground py-8 text-center'>
        <p>{t('No models available')}</p>
        <Button className='mt-4' onClick={handleFetch} disabled={isFetching}>
          {t('Retry')}
        </Button>
      </div>
    )
  } else {
    body = (
      <div className='space-y-4'>
        <div className='relative'>
          <Search className='text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
          <Input
            placeholder={t('Search models...')}
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className='pl-9'
          />
        </div>

        {filteredModels.length === 0 ? (
          <div className='text-muted-foreground py-8 text-center text-sm'>
            {t('No matching results')}
          </div>
        ) : (
          <RadioGroup
            value={selectedModel}
            onValueChange={(value) => setSelectedModel(String(value))}
            className='max-h-96 space-y-2 overflow-y-auto'
          >
            {categoryEntries.map(([category, categoryModels]) => (
              <Collapsible key={category} defaultOpen>
                <CollapsibleTrigger className='hover:bg-muted/50 flex w-full items-center justify-between rounded-lg border p-3'>
                  <div className='flex items-center gap-2'>
                    <ChevronDown className='h-4 w-4' aria-hidden='true' />
                    <span className='font-medium'>
                      {category} ({categoryModels.length})
                    </span>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className='px-4 py-2'>
                  <div className='grid grid-cols-2 gap-2'>
                    {categoryModels.map((model) => (
                      <div key={model} className='flex items-center space-x-2'>
                        <RadioGroupItem
                          id={`${radioIdPrefix}-${model}`}
                          value={model}
                        />
                        <Label
                          htmlFor={`${radioIdPrefix}-${model}`}
                          className='cursor-pointer text-sm font-normal'
                        >
                          {model}
                        </Label>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </RadioGroup>
        )}
      </div>
    )
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={handleClose}
      title={t('Select Model')}
      description={t('Fetch available models from upstream')}
      contentHeight='auto'
      bodyClassName='space-y-4'
      footer={
        !isFetching && models.length > 0 ? (
          <>
            <Button variant='outline' onClick={handleClose}>
              {t('Cancel')}
            </Button>
            <Button onClick={handleConfirmClick} disabled={!selectedModel}>
              {t('Confirm')}
            </Button>
          </>
        ) : null
      }
    >
      {body}
    </Dialog>
  )
}
