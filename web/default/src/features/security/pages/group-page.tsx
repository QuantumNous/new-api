import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { securityApi, type SecurityGroup } from '../api/security'

export function SecurityGroupPage() {
  const { t } = useTranslation()
  const [groups, setGroups] = useState<SecurityGroup[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadGroups()
  }, [])

  const loadGroups = () => {
    securityApi.getGroups({ page: 1, page_size: 100 }).then((res: any) => {
      if (res.success) {
        setGroups(res.data.items)
      }
      setLoading(false)
    })
  }

  const handleDelete = (id: number) => {
    if (!confirm(t('Are you sure?'))) return
    securityApi.deleteGroup(id).then(() => loadGroups())
  }

  if (loading) return <div className="p-6">{t('Loading...')}</div>

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('Sensitive Word Groups')}</h1>
        <Button>{t('Create Group')}</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('Name')}</TableHead>
                <TableHead>{t('Description')}</TableHead>
                <TableHead>{t('Status')}</TableHead>
                <TableHead className="text-right">{t('Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group) => (
                <TableRow key={group.id}>
                  <TableCell className="font-medium">{group.name}</TableCell>
                  <TableCell>{group.description}</TableCell>
                  <TableCell>{group.status === 1 ? t('Enabled') : t('Disabled')}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="outline" size="sm">{t('Edit')}</Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(group.id)}>
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
