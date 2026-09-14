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
import { ChevronDown, Info } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

import {
  categorizeModels,
  categorizeModelsWithRedirect,
  normalizeModelName,
} from '../lib'

function sortedModelCategories(models: string[]): [string, string[]][] {
  return Object.entries(categorizeModels(models)).sort(([a], [b]) => {
    if (a === 'Other') return 1
    if (b === 'Other') return -1
    return a.localeCompare(b, undefined, { sensitivity: 'base' })
  })
}

type ModelCategoryProps = {
  name: string
  models: string[]
  selected: string[]
  redirectOnly: Set<string>
  onChange: (models: string[]) => void
}

function ModelCategory(props: ModelCategoryProps) {
  const { t } = useTranslation()
  const categoryName = props.name === 'Other' ? t('Other') : props.name
  const id = useId()
  const selected = new Set(props.selected)
  const selectedCount = props.models.filter((model) =>
    selected.has(model)
  ).length
  const allSelected = selectedCount === props.models.length

  return (
    <Collapsible defaultOpen className='rounded-lg border'>
      <div className='flex items-center gap-3 px-3'>
        <Checkbox
          aria-label={t('Select all models in {{category}}', {
            category: categoryName,
          })}
          checked={allSelected}
          indeterminate={selectedCount > 0 && !allSelected}
          onCheckedChange={(checked) => {
            if (checked) {
              props.onChange([...new Set([...props.selected, ...props.models])])
            } else {
              props.onChange(
                props.selected.filter((model) => !props.models.includes(model))
              )
            }
          }}
        />
        <CollapsibleTrigger
          render={
            <Button
              type='button'
              variant='ghost'
              className='min-w-0 flex-1 justify-between px-0 hover:bg-transparent aria-expanded:bg-transparent dark:hover:bg-transparent'
            />
          }
        >
          <span className='truncate'>
            {categoryName} ({props.models.length})
          </span>
          <span className='text-muted-foreground ml-auto text-xs'>
            {selectedCount} / {props.models.length}
          </span>
          <ChevronDown className='size-4' aria-hidden='true' />
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className='border-t px-3 py-2'>
        <div className='grid gap-2 sm:grid-cols-2'>
          {props.models.map((model) => (
            <div key={model} className='flex min-w-0 items-start gap-2'>
              <Checkbox
                id={`${id}-${model}`}
                className='mt-0.5 shrink-0'
                checked={selected.has(model)}
                onCheckedChange={(checked) =>
                  props.onChange(
                    checked
                      ? [...props.selected, model]
                      : props.selected.filter((item) => item !== model)
                  )
                }
              />
              <Label
                htmlFor={`${id}-${model}`}
                className='min-w-0 cursor-pointer text-sm font-normal break-all'
              >
                {model}
              </Label>
              {props.redirectOnly.has(normalizeModelName(model)) && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Info className='size-3.5 shrink-0 text-amber-500' />
                    }
                  />
                  <TooltipContent>
                    {t('From model redirect, not yet added to models list')}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

type UpstreamModelSelectionProps = {
  models: string[]
  selected: string[]
  onChange: (models: string[]) => void
  existingModels: string[]
  redirectModels?: string[]
  redirectSourceModels?: string[]
  showChanges?: boolean
  summaryText?: string
}

export function UpstreamModelSelection(props: UpstreamModelSelectionProps) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  // Keep models seen in this picker session available even after deselection.
  const [candidateModels, setCandidateModels] = useState(props.selected)
  const candidateSet = new Set(candidateModels)
  if (props.selected.some((model) => !candidateSet.has(model))) {
    setCandidateModels([...new Set([...candidateModels, ...props.selected])])
  }
  const categorized = useMemo(() => {
    const classification = categorizeModelsWithRedirect(
      props.existingModels,
      props.redirectModels ?? []
    )
    const models = [
      ...new Set(props.models.map(normalizeModelName).filter(Boolean)),
    ]
    const modelSet = new Set(models)
    const sourceSet = new Set(
      (props.redirectSourceModels ?? []).map(normalizeModelName)
    )
    const keyword = search.toLowerCase().trim()
    const filtered = models.filter((model) =>
      model.toLowerCase().includes(keyword)
    )
    const existing = filtered.filter((model) =>
      classification.classificationSet.has(model)
    )
    const added = filtered.filter(
      (model) => !classification.classificationSet.has(model)
    )
    const removed = [
      ...new Set(candidateModels.map(normalizeModelName).filter(Boolean)),
    ].filter(
      (model) =>
        !modelSet.has(model) &&
        !sourceSet.has(model) &&
        model.toLowerCase().includes(keyword)
    )
    return {
      filtered,
      existing,
      added,
      removed,
      redirectOnly: classification.redirectOnlySet,
    }
  }, [
    props.existingModels,
    props.models,
    props.redirectModels,
    props.redirectSourceModels,
    candidateModels,
    search,
  ])

  const showChanges = props.showChanges ?? true
  let defaultTab = 'existing'
  if (categorized.added.length) defaultTab = 'new'
  else if (categorized.removed.length) defaultTab = 'removed'

  return (
    <div className='space-y-3'>
      <Input
        aria-label={t('Search models...')}
        placeholder={t('Search models...')}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {!showChanges && (
        <div className='flex items-center justify-between gap-2'>
          <span className='text-muted-foreground text-xs'>
            {props.summaryText ??
              t('Fetched {{count}} models', { count: props.models.length })}
          </span>
          {search.trim().length > 0 && (
            <Button
              type='button'
              variant='outline'
              size='sm'
              disabled={!categorized.filtered.length}
              onClick={() =>
                props.onChange([
                  ...new Set([...props.selected, ...categorized.filtered]),
                ])
              }
            >
              {t('Select all matching models')}
            </Button>
          )}
        </div>
      )}
      {showChanges ? (
        <Tabs
          key={`${props.models.length}-${categorized.removed.length}-${defaultTab}`}
          defaultValue={defaultTab}
        >
          <TabsList className='flex h-auto w-full flex-wrap'>
            <TabsTrigger value='new' disabled={!categorized.added.length}>
              {t('New Models ({{count}})', { count: categorized.added.length })}
            </TabsTrigger>
            <TabsTrigger
              value='existing'
              disabled={!categorized.existing.length}
            >
              {t('Existing Models ({{count}})', {
                count: categorized.existing.length,
              })}
            </TabsTrigger>
            {categorized.removed.length > 0 && (
              <TabsTrigger value='removed'>
                {t('Removed Models ({{count}})', {
                  count: categorized.removed.length,
                })}
              </TabsTrigger>
            )}
          </TabsList>
          <TabsContent
            value='new'
            className='max-h-96 space-y-2 overflow-y-auto'
          >
            {sortedModelCategories(categorized.added).map(([name, models]) => (
              <ModelCategory
                key={name}
                name={name}
                models={models}
                selected={props.selected}
                redirectOnly={categorized.redirectOnly}
                onChange={props.onChange}
              />
            ))}
          </TabsContent>
          <TabsContent
            value='existing'
            className='max-h-96 space-y-2 overflow-y-auto'
          >
            {sortedModelCategories(categorized.existing).map(
              ([name, models]) => (
                <ModelCategory
                  key={name}
                  name={name}
                  models={models}
                  selected={props.selected}
                  redirectOnly={categorized.redirectOnly}
                  onChange={props.onChange}
                />
              )
            )}
          </TabsContent>
          {categorized.removed.length > 0 && (
            <TabsContent
              value='removed'
              className='max-h-96 space-y-2 overflow-y-auto'
            >
              <p className='text-muted-foreground text-xs'>
                {t(
                  'These models were not returned by the upstream. Uncheck to remove them, or select them again before saving. Model mapping source aliases are excluded.'
                )}
              </p>
              <ModelCategory
                name={t('Removed')}
                models={categorized.removed}
                selected={props.selected}
                redirectOnly={categorized.redirectOnly}
                onChange={props.onChange}
              />
            </TabsContent>
          )}
        </Tabs>
      ) : (
        <div className='max-h-96 space-y-2 overflow-y-auto'>
          {sortedModelCategories(categorized.filtered).map(([name, models]) => (
            <ModelCategory
              key={name}
              name={name}
              models={models}
              selected={props.selected}
              redirectOnly={categorized.redirectOnly}
              onChange={props.onChange}
            />
          ))}
          {!categorized.filtered.length && (
            <p className='text-muted-foreground py-3 text-sm'>
              {t('No matching items')}
            </p>
          )}
        </div>
      )}
      <p className='text-muted-foreground text-sm'>
        {t('{{n}} model(s) selected', { n: props.selected.length })}
      </p>
    </div>
  )
}
