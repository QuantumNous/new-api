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
import { useTranslation } from 'react-i18next'
import { Camera, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'
import {
  ImageAwareRoutingRuleDrawer,
  type ImageAwareRouteRuleForm,
} from './image-aware-routing-rule-drawer'

type ImageAwareRoutingSectionProps = {
  defaultValues: { ImageAwareModelRouting: string }
}

type RouteRule = ImageAwareRouteRuleForm

function parseRules(json: string): RouteRule[] {
  try {
    const parsed = JSON.parse(json)
    if (parsed && typeof parsed === 'object') {
      return Object.entries(parsed).map(([entryModel, value]) => {
        const rule = (value ?? {}) as Record<string, unknown>
        return {
          entryModel,
          visionModel: String(rule.vision_model ?? ''),
          codingModel: String(rule.coding_model ?? ''),
        }
      })
    }
  } catch {
    // ignore parse errors, fall back to empty list
  }

  return []
}

function serializeRules(rules: RouteRule[]): string {
  const map: Record<string, { vision_model: string; coding_model: string }> = {}
  for (const rule of rules) {
    if (!rule.entryModel) continue
    map[rule.entryModel] = {
      vision_model: rule.visionModel,
      coding_model: rule.codingModel,
    }
  }
  return JSON.stringify(map)
}

export function ImageAwareRoutingSection({
  defaultValues,
}: ImageAwareRoutingSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const rules = useMemo(
    () => parseRules(defaultValues.ImageAwareModelRouting),
    [defaultValues.ImageAwareModelRouting]
  )

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<'add' | 'edit'>('add')
  const [editingRule, setEditingRule] = useState<RouteRule | null>(null)

  const persist = async (nextRules: RouteRule[]) => {
    await updateOption.mutateAsync({
      key: 'ImageAwareModelRouting',
      value: serializeRules(nextRules),
    })
  }

  const handleAdd = () => {
    setEditingRule(null)
    setDrawerMode('add')
    setDrawerOpen(true)
  }

  const handleEdit = (rule: RouteRule) => {
    setEditingRule(rule)
    setDrawerMode('edit')
    setDrawerOpen(true)
  }

  const handleDelete = async (entryModel: string) => {
    if (updateOption.isPending) return
    await persist(rules.filter((rule) => rule.entryModel !== entryModel))
  }

  const handleSave = async (rule: RouteRule) => {
    if (updateOption.isPending) return
    if (drawerMode === 'edit' && editingRule) {
      const nextRules = rules.map((existing) =>
        existing.entryModel === editingRule.entryModel ? rule : existing
      )
      await persist(nextRules)
    } else {
      // add：替换同名入口，否则追加
      const exists = rules.some(
        (existing) => existing.entryModel === rule.entryModel
      )
      const nextRules = exists
        ? rules.map((existing) =>
            existing.entryModel === rule.entryModel ? rule : existing
          )
        : [...rules, rule]
      await persist(nextRules)
    }
  }

  return (
    <SettingsSection title={t('Image-Aware Model Routing')}>
      <div className='flex flex-col gap-4'>
        <p className='text-muted-foreground text-sm'>
          {t(
            'Define virtual entry models that auto-switch between a vision model (when the request contains an image) and a coding model (when it does not). Subsequent text-only turns return to the coding model with prior context.'
          )}
        </p>

        {rules.length === 0 ? (
          <div className='text-muted-foreground rounded-md border border-dashed p-8 text-center text-sm'>
            {t('No routing rules yet. Click "Add Routing Rule" to create one.')}
          </div>
        ) : (
          <div className='rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('Entry Model')}</TableHead>
                  <TableHead>{t('Vision Model')}</TableHead>
                  <TableHead>{t('Coding Model')}</TableHead>
                  <TableHead className='w-[100px] text-right'>
                    {t('Actions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.entryModel}>
                    <TableCell className='font-mono font-medium'>
                      {rule.entryModel}
                    </TableCell>
                    <TableCell className='text-muted-foreground'>
                      <span className='inline-flex items-center gap-1'>
                        <Camera className='size-3' />
                        {rule.visionModel || '-'}
                      </span>
                    </TableCell>
                    <TableCell className='text-muted-foreground'>
                      {rule.codingModel || '-'}
                    </TableCell>
                    <TableCell className='text-right'>
                      <div className='flex justify-end gap-1'>
                        <Button
                          variant='ghost'
                          size='icon'
                          onClick={() => handleEdit(rule)}
                          title={t('Edit')}
                          disabled={updateOption.isPending}
                        >
                          <Pencil className='size-4' />
                        </Button>
                        <Button
                          variant='ghost'
                          size='icon'
                          onClick={() => handleDelete(rule.entryModel)}
                          title={t('Delete')}
                          disabled={updateOption.isPending}
                        >
                          <Trash2 className='size-4' />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div>
          <Button onClick={handleAdd} disabled={updateOption.isPending}>
            <Plus className='mr-2 size-4' />
            {t('Add Routing Rule')}
          </Button>
        </div>
      </div>

      <ImageAwareRoutingRuleDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        mode={drawerMode}
        initialValues={editingRule}
        onSave={handleSave}
      />
    </SettingsSection>
  )
}
