import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

type TokenGroupVisibilityPolicy = {
  group: string
  visibility: 'public' | 'targeted' | 'hidden'
  start_time?: number
  end_time?: number
  user_ids?: number[]
  // Accepted by the API only for legacy clients; new editors use user_ids.
  usernames?: string[]
}

export function TokenGroupVisibilityEditor() {
  const { t } = useTranslation()
  const [value, setValue] = useState('[]')
  const [visibilityEnabled, setVisibilityEnabled] = useState(false)
  const [saving, setSaving] = useState(false)

  const loadPolicies = async () => {
    await api.get('/api/group/token-visibility').then((res) => {
      if (res.data.success) {
        setVisibilityEnabled(Boolean(res.data.data.enabled))
        const policies = (res.data.data.policies ||
          []) as TokenGroupVisibilityPolicy[]
        setValue(JSON.stringify(policies, null, 2))
      }
    })
  }

  useEffect(() => {
    void loadPolicies()
  }, [])

  const save = async () => {
    if (!visibilityEnabled) {
      toast.warning(
        t(
          'Enable TOKEN_GROUP_VISIBILITY_ENABLED after the schema-first migration.'
        )
      )
      return
    }
    let policies: TokenGroupVisibilityPolicy[]
    try {
      policies = JSON.parse(value) as TokenGroupVisibilityPolicy[]
      if (!Array.isArray(policies)) throw new Error('not an array')
    } catch {
      toast.error(t('Visibility policies must be a JSON array.'))
      return
    }
    setSaving(true)
    try {
      const response = await api.put('/api/group/token-visibility/batch', {
        policies,
      })
      if (!response.data.success)
        throw new Error(
          response.data.message || t('Failed to save visibility policies.')
        )
      await loadPolicies()
      toast.success(t('Token group visibility policies saved.'))
    } catch (error) {
      await loadPolicies()
      const message =
        error instanceof Error
          ? error.message
          : t('Failed to save visibility policies.')
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className='flex flex-col gap-3 rounded-lg border p-4'>
      <div>
        <h3 className='text-base font-medium'>{t('Token group visibility')}</h3>
        <p className='text-muted-foreground text-sm'>
          {t(
            'Optional policies: public, targeted (with user_ids), or hidden. They apply only when TOKEN_GROUP_VISIBILITY_ENABLED is enabled.'
          )}
        </p>
        {!visibilityEnabled && (
          <p className='text-sm text-amber-600'>
            {t(
              'Visibility is disabled until the schema-first migration is complete.'
            )}
          </p>
        )}
      </div>
      <Textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        rows={10}
        disabled={!visibilityEnabled || saving}
      />
      <div>
        <Button
          type='button'
          onClick={save}
          disabled={!visibilityEnabled || saving}
        >
          {saving ? t('Saving...') : t('Save visibility policies')}
        </Button>
      </div>
    </section>
  )
}
