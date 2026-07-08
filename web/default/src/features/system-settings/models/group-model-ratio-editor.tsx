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
import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { safeJsonParse } from '../utils/json-parser'

type GroupModelRatioEditorProps = {
  value: string
  groupRatio: string
  onChange: (value: string) => void
}

type GroupModelRatioMap = Record<string, Record<string, number>>

function parseGroupModelRatio(value: string): GroupModelRatioMap {
  return safeJsonParse<GroupModelRatioMap>(value, {
    fallback: {},
    context: 'group model ratios',
  })
}

function cloneGroupModelRatio(source: GroupModelRatioMap): GroupModelRatioMap {
  const result: GroupModelRatioMap = {}
  for (const [group, modelRatios] of Object.entries(source)) {
    result[group] = { ...modelRatios }
  }
  return result
}

function serializeGroupModelRatio(source: GroupModelRatioMap): string {
  const result: GroupModelRatioMap = {}
  for (const [group, modelRatios] of Object.entries(source)) {
    const groupName = group.trim()
    if (!groupName) continue
    const cleaned: Record<string, number> = {}
    for (const [modelName, ratio] of Object.entries(modelRatios ?? {})) {
      const normalizedModelName = modelName.trim()
      const normalizedRatio = Number(ratio)
      if (!normalizedModelName || !Number.isFinite(normalizedRatio)) continue
      cleaned[normalizedModelName] = normalizedRatio
    }
    if (Object.keys(cleaned).length > 0) {
      result[groupName] = cleaned
    }
  }
  return Object.keys(result).length === 0
    ? '{}'
    : JSON.stringify(result, null, 2)
}

function parseGroupNames(groupRatio: string, groupModelRatio: GroupModelRatioMap) {
  const ratioMap = safeJsonParse<Record<string, number>>(groupRatio, {
    fallback: {},
    context: 'group ratios',
  })
  return Array.from(
    new Set([...Object.keys(ratioMap), ...Object.keys(groupModelRatio)])
  ).filter(Boolean)
}

export function GroupModelRatioEditor(props: GroupModelRatioEditorProps) {
  const { t } = useTranslation()
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const [newGroupName, setNewGroupName] = useState('')

  const ratioMap = useMemo(
    () => parseGroupModelRatio(props.value),
    [props.value]
  )
  const groupNames = useMemo(
    () => parseGroupNames(props.groupRatio, ratioMap),
    [props.groupRatio, ratioMap]
  )

  const emit = (next: GroupModelRatioMap) => {
    props.onChange(serializeGroupModelRatio(next))
  }

  const updateModelName = (
    groupName: string,
    oldModelName: string,
    newModelName: string
  ) => {
    const normalizedModelName = newModelName.trim()
    if (!normalizedModelName || normalizedModelName === oldModelName) return
    const next = cloneGroupModelRatio(ratioMap)
    const group = { ...(next[groupName] ?? {}) }
    if (Object.prototype.hasOwnProperty.call(group, normalizedModelName)) {
      return
    }
    const ratio = group[oldModelName] ?? 1
    delete group[oldModelName]
    group[normalizedModelName] = ratio
    next[groupName] = group
    emit(next)
  }

  const updateRatio = (groupName: string, modelName: string, ratio: string) => {
    const next = cloneGroupModelRatio(ratioMap)
    next[groupName] = { ...(next[groupName] ?? {}), [modelName]: Number(ratio) }
    emit(next)
  }

  const addModel = (groupName: string) => {
    const next = cloneGroupModelRatio(ratioMap)
    const group = { ...(next[groupName] ?? {}) }
    let index = Object.keys(group).length + 1
    let modelName = `model-${index}`
    while (Object.prototype.hasOwnProperty.call(group, modelName)) {
      index += 1
      modelName = `model-${index}`
    }
    group[modelName] = 1
    next[groupName] = group
    setOpenGroups((current) => ({ ...current, [groupName]: true }))
    emit(next)
  }

  const removeModel = (groupName: string, modelName: string) => {
    const next = cloneGroupModelRatio(ratioMap)
    const group = { ...(next[groupName] ?? {}) }
    delete group[modelName]
    if (Object.keys(group).length > 0) {
      next[groupName] = group
    } else {
      delete next[groupName]
    }
    emit(next)
  }

  const addGroup = () => {
    const groupName = newGroupName.trim()
    if (!groupName) return
    addModel(groupName)
    setNewGroupName('')
  }

  return (
    <Card className='relative shadow-sm ring-0 before:pointer-events-none before:absolute before:inset-0 before:rounded-xl before:border before:border-border/90'>
      <CardHeader className='border-b bg-muted/20'>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div className='space-y-1'>
            <CardTitle>{t('Model Specific Ratio')}</CardTitle>
            <CardDescription>
              {t(
                'Nested JSON map of group → model → ratio. This overrides inter-group and group ratios for matching models.'
              )}
            </CardDescription>
          </div>
          <div className='flex min-w-64 gap-2'>
            <Input
              value={newGroupName}
              placeholder={t('Group name')}
              onChange={(event) => setNewGroupName(event.target.value)}
            />
            <Button type='button' variant='outline' onClick={addGroup}>
              <Plus className='mr-2 h-4 w-4' />
              {t('Add')}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className='space-y-3 pt-4'>
        {groupNames.length === 0 ? (
          <div className='text-muted-foreground rounded-lg border border-dashed p-4 text-sm'>
            {t('No data')}
          </div>
        ) : (
          groupNames.map((groupName) => {
            const entries = Object.entries(ratioMap[groupName] ?? {})
            const open = openGroups[groupName] ?? entries.length > 0
            return (
              <Collapsible
                key={groupName}
                open={open}
                onOpenChange={(nextOpen) =>
                  setOpenGroups((current) => ({
                    ...current,
                    [groupName]: nextOpen,
                  }))
                }
              >
                <div className='rounded-lg border'>
                  <div className='flex items-center justify-between gap-2 p-3'>
                    <div className='flex min-w-0 items-center gap-2'>
                      <CollapsibleTrigger
                        render={
                          <Button
                            type='button'
                            variant='ghost'
                            size='sm'
                            className='h-6 w-6 p-0'
                          />
                        }
                      >
                        {open ? (
                          <ChevronUp className='h-4 w-4' />
                        ) : (
                          <ChevronDown className='h-4 w-4' />
                        )}
                      </CollapsibleTrigger>
                      <span className='truncate font-semibold'>{groupName}</span>
                      <span className='text-muted-foreground text-xs'>
                        {entries.length} {t('model')}
                      </span>
                    </div>
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      onClick={() => addModel(groupName)}
                    >
                      <Plus className='mr-2 h-4 w-4' />
                      {t('Add')}
                    </Button>
                  </div>
                  <CollapsibleContent>
                    <div className='space-y-2 border-t p-3'>
                      {entries.length === 0 ? (
                        <div className='text-muted-foreground text-sm'>
                          {t('No data')}
                        </div>
                      ) : (
                        entries.map(([modelName, ratio]) => (
                          <div
                            key={`${groupName}:${modelName}`}
                            className='grid gap-2 md:grid-cols-[minmax(0,1fr)_140px_36px]'
                          >
                            <Input
                              defaultValue={modelName}
                              placeholder={t('Model')}
                              onBlur={(event) =>
                                updateModelName(
                                  groupName,
                                  modelName,
                                  event.target.value
                                )
                              }
                            />
                            <Input
                              type='number'
                              min={0}
                              step='0.000001'
                              value={String(ratio)}
                              placeholder={t('Ratio')}
                              onChange={(event) =>
                                updateRatio(
                                  groupName,
                                  modelName,
                                  event.target.value
                                )
                              }
                            />
                            <Button
                              type='button'
                              variant='ghost'
                              size='sm'
                              className='text-destructive h-9 w-9 p-0'
                              aria-label={t('Delete')}
                              onClick={() => removeModel(groupName, modelName)}
                            >
                              <Trash2 className='h-4 w-4' />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
