import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { securityApi, type SecurityPolicy } from '../api/security'

const scopeMap: Record<number, string> = {
  1: 'Request Only',
  2: 'Response Only',
  3: 'Both',
}

const actionMap: Record<number, string> = {
  1: 'Pass',
  2: 'Alert',
  3: 'Mask',
  4: 'Block',
  5: 'Review',
}

export function SecurityPolicyPage() {
  const { t } = useTranslation()
  const [policies, setPolicies] = useState<SecurityPolicy[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPolicies()
  }, [])

  const loadPolicies = () => {
    securityApi.getPolicies({ page: 1, page_size: 100 }).then((res: any) => {
      if (res.success) {
        setPolicies(res.data.items)
      }
      setLoading(false)
    })
  }

  const handleDelete = (id: number) => {
    if (!confirm(t('Are you sure?'))) return
    securityApi.deletePolicy(id).then(() => loadPolicies())
  }

  if (loading) return <div className="p-6">{t('Loading...')}</div>

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('Security Policies')}</h1>
        <Button>{t('Create Policy')}</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('User')}</TableHead>
                <TableHead>{t('Group')}</TableHead>
                <TableHead>{t('Scope')}</TableHead>
                <TableHead>{t('Default Action')}</TableHead>
                <TableHead className="text-right">{t('Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {policies.map((policy) => (
                <TableRow key={policy.id}>
                  <TableCell className="font-medium">{policy.user_name}</TableCell>
                  <TableCell>{policy.group_name}</TableCell>
                  <TableCell><Badge variant="outline">{scopeMap[policy.scope] ?? policy.scope}</Badge></TableCell>
                  <TableCell><Badge>{actionMap[policy.default_action] ?? policy.default_action}</Badge></TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="outline" size="sm">{t('Edit')}</Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(policy.id)}>
                      {t('Delete')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
