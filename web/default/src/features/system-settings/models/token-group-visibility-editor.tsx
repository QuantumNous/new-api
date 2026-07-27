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
  usernames?: string[]
}

export function TokenGroupVisibilityEditor() {
  const { t } = useTranslation()
  const [value, setValue] = useState('[]')
  const [saving, setSaving] = useState(false)
  const [existingGroups, setExistingGroups] = useState<string[]>([])

  useEffect(() => {
    api.get('/api/group/token-visibility').then((res) => {
      if (res.data.success) {
        const policies = res.data.data.policies as TokenGroupVisibilityPolicy[]
        setValue(JSON.stringify(policies, null, 2))
        setExistingGroups(policies.map((policy) => policy.group))
      }
    })
  }, [])

  const save = async () => {
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
      for (const policy of policies) await api.put('/api/group/token-visibility', policy)
      const remaining = new Set(policies.map((policy) => policy.group))
      for (const group of existingGroups) {
        if (!remaining.has(group)) await api.delete(`/api/group/token-visibility/${encodeURIComponent(group)}`)
      }
      setExistingGroups([...remaining])
      toast.success(t('Token group visibility policies saved.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className='flex flex-col gap-3 rounded-lg border p-4'>
      <div>
        <h3 className='text-base font-medium'>{t('Token group visibility')}</h3>
        <p className='text-muted-foreground text-sm'>
          {t('Optional policies: public, targeted (with usernames), or hidden. They apply only when TOKEN_GROUP_VISIBILITY_ENABLED is enabled.')}
        </p>
      </div>
      <Textarea value={value} onChange={(event) => setValue(event.target.value)} rows={10} />
      <div>
        <Button type='button' onClick={save} disabled={saving}>
          {saving ? t('Saving...') : t('Save visibility policies')}
        </Button>
      </div>
    </section>
  )
}
