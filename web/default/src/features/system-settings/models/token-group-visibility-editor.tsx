import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type TargetUser = { id: number; username: string }
type TokenGroupVisibilityPolicy = {
  group: string
  visibility: 'public' | 'targeted' | 'hidden'
  start_time?: number
  end_time?: number
  user_ids?: number[]
  target_users?: TargetUser[]
}

type VisibilityState = {
  enabled: boolean
  mode: 'legacy' | 'shadow' | 'enforce' | 'invalid'
  policies: TokenGroupVisibilityPolicy[]
  digest: string
  read_source?: string
  degraded?: boolean
}

const emptyPolicy = (): TokenGroupVisibilityPolicy => ({
  group: '',
  visibility: 'targeted',
  start_time: 0,
  end_time: 0,
  user_ids: [],
})

export function TokenGroupVisibilityEditor() {
  const { t } = useTranslation()
  const [state, setState] = useState<VisibilityState>({
    enabled: false,
    mode: 'legacy',
    policies: [],
    digest: '',
  })
  const [policies, setPolicies] = useState<TokenGroupVisibilityPolicy[]>([])
  const [saving, setSaving] = useState(false)

  const loadPolicies = async () => {
    const res = await api.get('/api/group/token-visibility')
    const next = res.data.data as VisibilityState | undefined
    if (next) {
      // A degraded read is still a real state snapshot. Keep it visible and
      // never replace the editor with a fabricated empty list.
      setState(next)
      if (!next.degraded) setPolicies(next.policies || [])
    }
    if (!res.data.success) throw new Error(res.data.message)
  }

  useEffect(() => {
    void loadPolicies().catch((error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : t('Failed to load visibility policies.')
      )
    })
  }, [])

  const updatePolicy = (
    index: number,
    update: Partial<TokenGroupVisibilityPolicy>
  ) => {
    setPolicies((current) =>
      current.map((policy, itemIndex) =>
        itemIndex === index ? { ...policy, ...update } : policy
      )
    )
  }

  const updateTargets = (index: number, value: string) => {
    const ids = value
      .split(',')
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isInteger(item) && item > 0)
    updatePolicy(index, { user_ids: ids })
  }

  const save = async () => {
    if (!state.enabled) {
      toast.warning(
        t(
          'Enable TOKEN_GROUP_VISIBILITY_ENABLED after the schema-first migration.'
        )
      )
      return
    }
    if (state.degraded) {
      toast.error(
        t(
          'Visibility state is degraded; repair the configuration before saving.'
        )
      )
      return
    }
    if (policies.some((policy) => !policy.group.trim())) {
      toast.error(t('Every visibility policy needs a group.'))
      return
    }
    if (
      policies.some(
        (policy) =>
          policy.visibility === 'targeted' && !(policy.user_ids || []).length
      )
    ) {
      toast.error(t('Targeted policies require at least one user ID.'))
      return
    }
    setSaving(true)
    try {
      const response = await api.put('/api/group/token-visibility/batch', {
        policies: policies.map(
          ({ target_users: _targetUsers, ...policy }) => policy
        ),
        expected_digest: state.digest,
        allow_empty: policies.length === 0,
      })
      if (!response.data.success)
        throw new Error(
          response.data.message || t('Failed to save visibility policies.')
        )
      const next = response.data.data as VisibilityState
      setState(next)
      setPolicies(next.policies || [])
      toast.success(t('Token group visibility policies saved.'))
    } catch (error) {
      await loadPolicies().catch(() => undefined)
      toast.error(
        error instanceof Error
          ? error.message
          : t('Failed to save visibility policies.')
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className='flex flex-col gap-4 rounded-lg border p-4'>
      <div>
        <h3 className='text-base font-medium'>{t('Token group visibility')}</h3>
        <p className='text-muted-foreground text-sm'>
          {t(
            'Targeted policies directly grant the listed user IDs even when the group is not globally selectable. Expired targeted and hidden policies stay closed until changed to public.'
          )}
        </p>
        {!state.enabled && (
          <p className='text-sm text-amber-600'>
            {state.degraded
              ? t(
                  'Database policy tables are not available; the read is degraded.'
                )
              : t(
                  'Visibility enforcement is currently disabled; policies are read-only.'
                )}
          </p>
        )}
        {state.enabled && state.mode !== 'enforce' && (
          <p className='text-sm text-amber-600'>
            {t(
              'Policies are in {{mode}} mode and are not enforcing customer access yet.',
              { mode: state.mode }
            )}
          </p>
        )}
        {state.degraded && state.enabled && (
          <p className='text-sm text-red-600'>
            {t(
              'Visibility state is degraded; authorization is fail-closed until the configuration is repaired.'
            )}
          </p>
        )}
      </div>

      <div className='space-y-3'>
        {policies.map((policy, index) => (
          <div
            key={`${policy.group}-${index}`}
            className='grid gap-2 rounded border p-3 md:grid-cols-6'
          >
            <Input
              value={policy.group}
              placeholder={t('Group name')}
              onChange={(event) =>
                updatePolicy(index, { group: event.target.value })
              }
              disabled={!state.enabled || saving || state.degraded}
            />
            <select
              className='bg-background h-10 rounded-md border px-3 text-sm'
              value={policy.visibility}
              onChange={(event) =>
                updatePolicy(index, {
                  visibility: event.target
                    .value as TokenGroupVisibilityPolicy['visibility'],
                })
              }
              disabled={!state.enabled || saving || state.degraded}
            >
              <option value='targeted'>{t('Targeted')}</option>
              <option value='hidden'>{t('Hidden')}</option>
              <option value='public'>{t('Public')}</option>
            </select>
            <Input
              value={(policy.user_ids || []).join(',')}
              placeholder={t('User IDs, comma separated')}
              onChange={(event) => updateTargets(index, event.target.value)}
              disabled={
                !state.enabled ||
                saving ||
                state.degraded ||
                policy.visibility !== 'targeted'
              }
            />
            <Input
              type='number'
              min={0}
              value={policy.start_time || 0}
              title={t('Start Unix timestamp')}
              onChange={(event) =>
                updatePolicy(index, {
                  start_time: Number(event.target.value) || 0,
                })
              }
              disabled={!state.enabled || saving || state.degraded}
            />
            <Input
              type='number'
              min={0}
              value={policy.end_time || 0}
              title={t('End Unix timestamp; 0 means no end')}
              onChange={(event) =>
                updatePolicy(index, {
                  end_time: Number(event.target.value) || 0,
                })
              }
              disabled={!state.enabled || saving || state.degraded}
            />
            <Button
              type='button'
              variant='outline'
              onClick={() =>
                setPolicies((current) =>
                  current.filter((_, itemIndex) => itemIndex !== index)
                )
              }
              disabled={!state.enabled || saving || state.degraded}
            >
              {t('Remove')}
            </Button>
            {policy.target_users && policy.target_users.length > 0 && (
              <p className='text-muted-foreground text-xs md:col-span-6'>
                {t('Resolved users')}:{' '}
                {policy.target_users
                  .map((user) => `${user.username} (#${user.id})`)
                  .join(', ')}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className='flex flex-wrap gap-2'>
        <Button
          type='button'
          variant='outline'
          onClick={() => setPolicies((current) => [...current, emptyPolicy()])}
          disabled={!state.enabled || saving || state.degraded}
        >
          {t('Add policy')}
        </Button>
        <Button
          type='button'
          onClick={save}
          disabled={!state.enabled || saving || state.degraded}
        >
          {saving ? t('Saving...') : t('Save visibility policies')}
        </Button>
      </div>
      <p className='text-muted-foreground text-xs'>
        {t('Mode')}: {state.mode} · {t('Read source')}:{' '}
        {state.read_source || 'database'} · {t('Snapshot')}:{' '}
        {state.digest || 'empty'}
      </p>
    </section>
  )
}
