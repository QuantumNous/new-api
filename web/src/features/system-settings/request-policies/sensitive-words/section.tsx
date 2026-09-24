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
import { Loader2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

import { SettingsSection } from '../../components/settings-section'
import {
  getSensitiveWordGroups,
  getSensitiveWordPolicy,
  getSensitiveWordRule,
  getSensitiveWordRules,
} from './api'
import { SensitiveWordPolicyForm } from './policy-form'
import { SensitiveWordRulesTable } from './rules-table'
import {
  DEFAULT_SENSITIVE_WORD_POLICY,
  type SensitiveWordPolicy,
  type SensitiveWordRuleDetail,
  type SensitiveWordRuleSummary,
} from './types'

export function SensitiveWordsSection() {
  const { t } = useTranslation()
  const [policy, setPolicy] = useState<SensitiveWordPolicy>(
    DEFAULT_SENSITIVE_WORD_POLICY
  )
  const [rules, setRules] = useState<SensitiveWordRuleSummary[]>([])
  const [groups, setGroups] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [nextPolicy, nextRules, nextGroups] = await Promise.all([
        getSensitiveWordPolicy(),
        getSensitiveWordRules(),
        getSensitiveWordGroups(),
      ])
      setPolicy(nextPolicy)
      setRules(nextRules)
      setGroups(nextGroups)
    } catch {
      setError(t('Unable to load sensitive-word settings'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void reload()
  }, [reload])

  async function loadRule(id: number): Promise<SensitiveWordRuleDetail> {
    try {
      return await getSensitiveWordRule(id)
    } catch {
      toast.error(t('Unable to load rule details'))
      throw new Error('rule load failed')
    }
  }

  if (loading) {
    return (
      <div className='text-muted-foreground flex min-h-32 items-center justify-center gap-2'>
        <Loader2 className='size-4 animate-spin' />
        {t('Loading...')}
      </div>
    )
  }
  if (error) {
    return (
      <Alert variant='destructive'>
        <AlertTitle>{t('Sensitive-word settings unavailable')}</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <SettingsSection title={t('Sensitive words')} className='gap-6'>
      <SensitiveWordPolicyForm policy={policy} onSaved={setPolicy} />
      <SensitiveWordRulesTable
        rules={rules}
        groups={groups}
        onReload={reload}
        loadRule={loadRule}
      />
    </SettingsSection>
  )
}
