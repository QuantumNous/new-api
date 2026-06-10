import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { securityApi, type SecurityGroup, type SecurityRule } from '../api/security'
import { RuleFormModal } from '../components/rule-form-modal'

const ruleTypeMap: Record<number, string> = {
  1: 'Keyword',
  2: 'Regex',
  3: 'NER',
  4: 'AI',
}

const actionMap: Record<number, string> = {
  1: 'Pass',
  2: 'Alert',
  3: 'Mask',
  4: 'Block',
  5: 'Review',
}

export function SecurityRulePage() {
  const { t } = useTranslation()
  const [rules, setRules] = useState<SecurityRule[]>([])
  const [groups, setGroups] = useState<SecurityGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<SecurityRule | null>(null)

  useEffect(() => {
    loadRules()
    securityApi.getGroups({ page: 1, page_size: 100 }).then((res: any) => {
      if (res.success) setGroups(res.data.items)
    })
  }, [])

  const loadRules = () => {
    setLoading(true)
    securityApi.getRules({ page: 1, page_size: 100 }).then((res: any) => {
      if (res.success) {
        setRules(res.data.items)
      }
      setLoading(false)
    })
  }

  const handleDelete = (id: number) => {
    if (!confirm(t('Are you sure?'))) return
    securityApi.deleteRule(id).then(() => loadRules())
  }

  const handleCreate = () => {
    setEditingRule(null)
    setModalOpen(true)
  }

  const handleEdit = (rule: SecurityRule) => {
    setEditingRule(rule)
    setModalOpen(true)
  }

  const handleSubmit = async (data: Partial<SecurityRule>) => {
    if (editingRule) {
      await securityApi.updateRule(editingRule.id, data)
    } else {
      await securityApi.createRule(data)
    }
    loadRules()
  }

  if (loading) return <div className="p-6">{t('Loading...')}</div>

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('Detection Rules')}</h1>
        <Button onClick={handleCreate}>{t('Create Rule')}</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('Name')}</TableHead>
                <TableHead>{t('Group')}</TableHead>
                <TableHead>{t('Type')}</TableHead>
                <TableHead>{t('Action')}</TableHead>
                <TableHead>{t('Risk Score')}</TableHead>
                <TableHead className="text-right">{t('Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">{rule.name}</TableCell>
                  <TableCell>{rule.group_name}</TableCell>
                  <TableCell><Badge variant="outline">{ruleTypeMap[rule.type] ?? rule.type}</Badge></TableCell>
                  <TableCell><Badge>{actionMap[rule.action] ?? rule.action}</Badge></TableCell>
                  <TableCell>{rule.risk_score}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(rule)}>{t('Edit')}</Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(rule.id)}>
                      {t('Delete')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <RuleFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        initialData={editingRule}
        groups={groups}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
