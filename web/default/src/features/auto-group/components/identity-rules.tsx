import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { getAutoGroupIdentityRules } from '../api'
import { QUERY_KEYS } from '../constants'

export function IdentityRules() {
  const { t } = useTranslation()
  const { data } = useQuery({
    queryKey: QUERY_KEYS.IDENTITY_RULES,
    queryFn: getAutoGroupIdentityRules,
  })
  const rules = data?.data?.items ?? []

  return (
    <Card size='sm'>
      <CardHeader>
        <CardTitle>{t('Identity rules')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className='grid gap-3 md:grid-cols-2'>
          {rules.map((rule) => (
            <div key={rule.name} className='rounded-lg border p-3'>
              <div className='flex items-center justify-between gap-2'>
                <div className='font-medium'>{rule.name}</div>
                <Badge variant={rule.manual_only ? 'outline' : 'default'}>
                  {rule.manual_only ? t('Manual only') : t('Auto')}
                </Badge>
              </div>
              <div className='mt-2 text-sm text-muted-foreground'>{rule.description}</div>
              <div className='mt-2 text-xs text-muted-foreground'>{t('Target group')}: {rule.target_group}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
