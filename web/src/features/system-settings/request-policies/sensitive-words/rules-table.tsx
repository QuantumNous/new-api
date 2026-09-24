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
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { formatDateTimeStr } from '@/lib/format'

import { deleteSensitiveWordRule, setSensitiveWordRuleMode } from './api'
import { SensitiveWordRuleDialog } from './rule-dialog'
import type {
  SensitiveWordMode,
  SensitiveWordRuleDetail,
  SensitiveWordRuleSummary,
} from './types'

type RulesTableProps = {
  rules: SensitiveWordRuleSummary[]
  groups: string[]
  onReload: () => Promise<void>
  loadRule: (id: number) => Promise<SensitiveWordRuleDetail>
}

export function SensitiveWordRulesTable({
  rules,
  groups,
  onReload,
  loadRule,
}: RulesTableProps) {
  const { t } = useTranslation()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<SensitiveWordRuleDetail | null>(null)
  const [deleting, setDeleting] = useState<SensitiveWordRuleSummary | null>(
    null
  )
  const [changingModeID, setChangingModeID] = useState<number | null>(null)

  async function edit(rule: SensitiveWordRuleSummary) {
    try {
      setEditing(await loadRule(rule.id))
      setDialogOpen(true)
    } catch {
      // loadRule already presents the specific request error.
    }
  }

  async function changeMode(id: number, mode: SensitiveWordMode) {
    setChangingModeID(id)
    try {
      await setSensitiveWordRuleMode(id, mode)
      await onReload()
    } catch {
      toast.error(t('Unable to update rule mode'))
    } finally {
      setChangingModeID(null)
    }
  }

  async function remove() {
    if (!deleting) return
    try {
      await deleteSensitiveWordRule(deleting.id)
      setDeleting(null)
      await onReload()
    } catch {
      toast.error(t('Unable to delete sensitive-word rule'))
    }
  }

  return (
    <div className='space-y-3'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div>
          <h4 className='text-sm font-semibold'>{t('Rules')}</h4>
          <p className='text-muted-foreground text-xs'>
            {t('Global and group rules are evaluated once per request.')}
          </p>
        </div>
        <Button
          type='button'
          size='sm'
          onClick={() => {
            setEditing(null)
            setDialogOpen(true)
          }}
        >
          <Plus data-icon='inline-start' />
          {t('Add rule')}
        </Button>
      </div>
      <div className='overflow-x-auto rounded-lg border'>
        <Table className='min-w-[680px]'>
          <TableHeader>
            <TableRow>
              <TableHead>{t('Name')}</TableHead>
              <TableHead>{t('Scope')}</TableHead>
              <TableHead>{t('Mode')}</TableHead>
              <TableHead>{t('Words')}</TableHead>
              <TableHead>{t('Updated')}</TableHead>
              <TableHead className='text-right'>{t('Actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className='text-muted-foreground py-8 text-center'
                >
                  {t('No sensitive-word rules')}
                </TableCell>
              </TableRow>
            ) : (
              rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell>
                    <div className='font-medium'>{rule.name}</div>
                    <div className='text-muted-foreground text-xs'>
                      {rule.groups.length
                        ? rule.groups.join(', ')
                        : t('All groups')}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant='outline'>
                      {rule.scope === 'global'
                        ? t('Global')
                        : t('Selected groups')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={rule.mode}
                      disabled={changingModeID === rule.id}
                      onValueChange={(value) => {
                        if (value) {
                          void changeMode(rule.id, value as SensitiveWordMode)
                        }
                      }}
                    >
                      <SelectTrigger className='w-28'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='observe'>{t('Observe')}</SelectItem>
                        <SelectItem value='block'>{t('Block')}</SelectItem>
                        <SelectItem value='off'>{t('Off')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>{rule.word_count}</TableCell>
                  <TableCell className='text-xs whitespace-nowrap'>
                    {formatSensitiveWordRuleTime(rule.updated_at)}
                  </TableCell>
                  <TableCell>
                    <div className='flex justify-end gap-1'>
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              type='button'
                              variant='ghost'
                              size='icon'
                              aria-label={t('Edit rule')}
                              onClick={() => void edit(rule)}
                            />
                          }
                        >
                          <Pencil />
                        </TooltipTrigger>
                        <TooltipContent>{t('Edit rule')}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              type='button'
                              variant='ghost'
                              size='icon'
                              aria-label={t('Delete rule')}
                              onClick={() => setDeleting(rule)}
                            />
                          }
                        >
                          <Trash2 />
                        </TooltipTrigger>
                        <TooltipContent>{t('Delete rule')}</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <SensitiveWordRuleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        groups={groups}
        rule={editing}
        onSaved={onReload}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title={t('Delete sensitive-word rule')}
        desc={t(
          'This removes the rule and its words. Existing audit records remain unchanged.'
        )}
        destructive
        handleConfirm={() => void remove()}
      />
    </div>
  )
}

function formatSensitiveWordRuleTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : formatDateTimeStr(date)
}
