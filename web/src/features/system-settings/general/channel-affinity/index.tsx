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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Braces,
  Database,
  Eraser,
  FileText,
  ListFilter,
  Plus,
  RefreshCw,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { JsonCodeEditor } from '@/components/json-code-editor'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'
import { requireServerSuccess } from '@/lib/server-error-message'
import { cn } from '@/lib/utils'

import { getCacheStats, clearAllCache, clearRuleCache } from './api'
import { RULE_TEMPLATES, cloneTemplate, makeUniqueName } from './constants'
import { RuleEditorDialog } from './rule-editor-dialog'
import { SessionRulesTable } from './session-rules-table'
import type { AffinityRule, SessionMode } from './types'

const cacheStatsQueryKey = ['channel-affinity-cache'] as const

function parseRules(jsonStr: string): AffinityRule[] {
  try {
    const arr = JSON.parse(jsonStr || '[]')
    if (!Array.isArray(arr)) return []
    return arr.map(
      (r: Record<string, unknown>, i: number) =>
        ({ id: i, ...r }) as AffinityRule
    )
  } catch {
    return []
  }
}

function serializeRules(rules: AffinityRule[]): string {
  return JSON.stringify(rules.map(({ id: _, ...rest }) => rest))
}

interface Props {
  rulesJson: string
  onRulesChange: (rules: string) => void
  enabled?: boolean
  globalSessionMode?: SessionMode | ''
}

export function ChannelAffinitySection(props: Props) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const rules = useMemo(() => parseRules(props.rulesJson), [props.rulesJson])
  const [editMode, setEditMode] = useState<'visual' | 'json'>('visual')
  const queryClient = useQueryClient()
  const cacheQuery = useQuery({
    queryKey: cacheStatsQueryKey,
    queryFn: async () =>
      requireServerSuccess(await getCacheStats()).data ?? null,
  })
  const cacheStats = cacheQuery.data ?? null
  const cacheLoading = cacheQuery.isFetching

  const [ruleEditorOpen, setRuleEditorOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<AffinityRule | null>(null)
  const [ruleTemplateKey, setRuleTemplateKey] = useState<string | null>(null)
  const [deletingRule, setDeletingRule] = useState<AffinityRule | null>(null)
  const [clearAllDialogOpen, setClearAllDialogOpen] = useState(false)
  const [clearRuleName, setClearRuleName] = useState<string | null>(null)
  const [fillTemplateDialogOpen, setFillTemplateDialogOpen] = useState(false)

  const clearCacheMutation = useMutation({
    mutationFn: async (ruleName: string | null) =>
      requireServerSuccess(
        ruleName === null
          ? await clearAllCache()
          : await clearRuleCache(ruleName)
      ),
    onSuccess: async () => {
      toast.success(t('Cleared channel affinity cache'))
      setClearAllDialogOpen(false)
      setClearRuleName(null)
      await queryClient.invalidateQueries({ queryKey: cacheStatsQueryKey })
    },
  })

  const appendCliTemplates = () => {
    const existingNames = new Set(
      rules.map((r) => (r.name || '').trim()).filter((x) => x.length > 0)
    )

    const templates = Object.values(RULE_TEMPLATES).map((tpl) => {
      const base = cloneTemplate(tpl)
      const name = makeUniqueName(existingNames, tpl.name)
      existingNames.add(name)
      return { ...base, name }
    })

    props.onRulesChange(serializeRules([...rules, ...templates]))
    toast.success(t('Templates appended'))
    setFillTemplateDialogOpen(false)
  }

  const handleFillTemplates = () => {
    if (rules.length === 0) {
      appendCliTemplates()
    } else {
      setFillTemplateDialogOpen(true)
    }
  }

  const handleRuleSave = (rule: AffinityRule) => {
    const index = rules.findIndex((item) => item.id === editingRule?.id)
    const next = [...rules]
    if (index >= 0) next[index] = rule
    else next.push(rule)
    props.onRulesChange(serializeRules(next))
    setEditingRule(null)
  }

  const switchToJsonMode = () => {
    props.onRulesChange(
      JSON.stringify(
        rules.map(({ id: _, ...r }) => r),
        null,
        2
      )
    )
    setEditMode('json')
  }

  const switchToVisualMode = () => {
    try {
      const parsed: unknown = JSON.parse(props.rulesJson)
      if (!Array.isArray(parsed)) {
        toast.error(t('Rules JSON must be an array'))
        return
      }
      setEditMode('visual')
    } catch {
      toast.error(t('Invalid rules JSON format'))
    }
  }

  return (
    <>
      <section
        aria-label={t('Session rules')}
        className='bg-card min-w-0 overflow-hidden rounded-xl border'
      >
        <div className='flex flex-col gap-1.5 px-4 pt-5 sm:px-5'>
          <div className='flex items-center gap-2'>
            <h3 className='text-base font-semibold'>{t('Session rules')}</h3>
            <Badge variant='secondary' className='tabular-nums'>
              {rules.length}
            </Badge>
          </div>
          <p className='text-muted-foreground text-sm'>
            {t('How a session is identified and which channel it keeps.')}
          </p>
        </div>
        <Tabs
          value={editMode}
          onValueChange={(value) => {
            if (value === 'json') switchToJsonMode()
            else switchToVisualMode()
          }}
          className='gap-0'
        >
          <div className='flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5'>
            <TabsList aria-label={t('Rule editor mode')}>
              <TabsTrigger value='visual' className='px-3'>
                <ListFilter aria-hidden='true' />
                {t('Visual')}
              </TabsTrigger>
              <TabsTrigger value='json' className='px-3'>
                <Braces aria-hidden='true' />
                JSON
              </TabsTrigger>
            </TabsList>
            <div className='flex flex-wrap items-center gap-2'>
              <Button
                variant='outline'
                onClick={handleFillTemplates}
                disabled={editMode === 'json'}
              >
                <FileText aria-hidden='true' data-icon='inline-start' />
                {t('Fill Templates')}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button disabled={editMode === 'json'} />}
                >
                  <Plus aria-hidden='true' data-icon='inline-start' />
                  {t('Add Rule')}
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end'>
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      onClick={() => {
                        setEditingRule(null)
                        setRuleTemplateKey(null)
                        setRuleEditorOpen(true)
                      }}
                    >
                      {t('Blank Rule')}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setEditingRule(null)
                        setRuleTemplateKey('codexCli')
                        setRuleEditorOpen(true)
                      }}
                    >
                      Codex CLI
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setEditingRule(null)
                        setRuleTemplateKey('claudeCli')
                        setRuleEditorOpen(true)
                      }}
                    >
                      Claude CLI
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <Separator />
          <TabsContent value='visual' className='min-w-0'>
            <SessionRulesTable
              rules={rules}
              cacheStats={cacheStats}
              cacheBusy={cacheLoading || clearCacheMutation.isPending}
              enabled={props.enabled}
              globalSessionMode={props.globalSessionMode}
              onEdit={(rule) => {
                setEditingRule(rule)
                setRuleTemplateKey(null)
                setRuleEditorOpen(true)
              }}
              onDelete={setDeletingRule}
              onClearCache={setClearRuleName}
              onFillTemplates={handleFillTemplates}
            />
          </TabsContent>
          <TabsContent value='json' className='min-w-0'>
            <div className='grid gap-2 p-4 sm:p-5'>
              <Label htmlFor='channel-affinity-rules-json'>
                {t('Rules JSON')}
              </Label>
              <p className='text-muted-foreground text-xs'>
                {t('Switch to visual mode to add rules or apply templates.')}
              </p>
              <JsonCodeEditor
                id='channel-affinity-rules-json'
                value={props.rulesJson}
                onChange={props.onRulesChange}
                heightClassName='h-[300px] min-h-[300px] max-h-[300px]'
              />
            </div>
          </TabsContent>
        </Tabs>
        <Separator />
        <div className='bg-muted/25 flex flex-col gap-2 px-4 py-3 sm:px-5'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <div
              role='status'
              className='flex min-w-0 items-center gap-2 text-sm'
            >
              <Database
                aria-hidden='true'
                className='text-muted-foreground size-4 shrink-0'
              />
              <span className='text-muted-foreground'>
                {t('Cache Entries')}
              </span>
              {cacheStats ? (
                <span className='flex flex-wrap items-baseline gap-1 font-medium tabular-nums'>
                  {formatNumber(cacheStats.total, locale)}
                  <span className='text-muted-foreground font-normal'>
                    / {formatNumber(cacheStats.cache_capacity, locale)}
                  </span>
                </span>
              ) : (
                <span className='text-muted-foreground'>
                  {cacheLoading ? t('Loading...') : t('Unavailable')}
                </span>
              )}
            </div>
            <div className='flex flex-wrap items-center gap-2'>
              <Button
                variant='outline'
                size='sm'
                onClick={() => void cacheQuery.refetch()}
                disabled={cacheLoading || clearCacheMutation.isPending}
                aria-busy={cacheLoading}
              >
                <RefreshCw
                  aria-hidden='true'
                  className={cn(
                    cacheLoading && 'animate-spin motion-reduce:animate-none'
                  )}
                />
                {t('Refresh cache statistics')}
              </Button>
              <Button
                variant='destructive'
                size='sm'
                onClick={() => setClearAllDialogOpen(true)}
                disabled={clearCacheMutation.isPending}
              >
                <Eraser aria-hidden='true' />
                {t('Clear All Cache')}
              </Button>
            </div>
          </div>
          <p className='text-muted-foreground text-xs'>
            {t(
              'Refreshing updates the counts. Clearing cache makes subsequent requests select channels again.'
            )}
          </p>
        </div>
      </section>

      {deletingRule !== null && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setDeletingRule(null)}
          title={t('Delete Rule')}
          desc={t(
            'Delete session rule “{{name}}”? Save your changes to apply the removal.',
            { name: deletingRule.name }
          )}
          confirmText={t('Delete Rule')}
          handleConfirm={() => {
            props.onRulesChange(
              serializeRules(
                rules.filter((rule) => rule.id !== deletingRule.id)
              )
            )
            setDeletingRule(null)
          }}
          destructive
        />
      )}

      <RuleEditorDialog
        open={ruleEditorOpen}
        onOpenChange={setRuleEditorOpen}
        rule={editingRule}
        onSave={handleRuleSave}
        templateKey={ruleTemplateKey}
        globalSessionMode={props.globalSessionMode}
      />

      <ConfirmDialog
        open={clearAllDialogOpen}
        onOpenChange={(open) => {
          if (!clearCacheMutation.isPending) setClearAllDialogOpen(open)
        }}
        title={t('Confirm clearing all channel affinity cache')}
        desc={t(
          'Clear all cached session bindings? Subsequent requests will select channels again.'
        )}
        confirmText={t('Clear All Cache')}
        isLoading={clearCacheMutation.isPending}
        handleConfirm={() => clearCacheMutation.mutate(null)}
        destructive
      />

      {clearRuleName !== null && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open && !clearCacheMutation.isPending) setClearRuleName(null)
          }}
          title={t('Confirm clearing cache for this rule')}
          desc={t(
            'Clear cached session bindings for "{{name}}"? Subsequent requests will select channels again.',
            { name: clearRuleName }
          )}
          confirmText={t('Clear cache')}
          isLoading={clearCacheMutation.isPending}
          handleConfirm={() => clearCacheMutation.mutate(clearRuleName)}
          destructive
        />
      )}

      <ConfirmDialog
        open={fillTemplateDialogOpen}
        onOpenChange={setFillTemplateDialogOpen}
        title={t('Fill Codex CLI / Claude CLI Templates')}
        desc={t(
          'This will append 2 template rules (Codex CLI and Claude CLI) to the existing rule list.'
        )}
        handleConfirm={appendCliTemplates}
      />
    </>
  )
}
