import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { securityApi, type SecurityHitLog } from '../api/security'

const actionMap: Record<number, string> = {
  1: 'Pass',
  2: 'Alert',
  3: 'Mask',
  4: 'Block',
  5: 'Review',
}

const riskLevelMap: Record<number, { label: string; color: string }> = {
  1: { label: 'Low', color: 'bg-green-100 text-green-800' },
  2: { label: 'Medium', color: 'bg-yellow-100 text-yellow-800' },
  3: { label: 'High', color: 'bg-orange-100 text-orange-800' },
  4: { label: 'Critical', color: 'bg-red-100 text-red-800' },
}

export function SecurityLogPage() {
  const { t } = useTranslation()
  const [logs, setLogs] = useState<SecurityHitLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadLogs()
  }, [])

  const loadLogs = () => {
    securityApi.getLogs({ page: 1, page_size: 100 }).then((res: any) => {
      if (res.success) {
        setLogs(res.data.items)
      }
      setLoading(false)
    })
  }

  if (loading) return <div className="p-6">{t('Loading...')}</div>

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">{t('Audit Logs')}</h1>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('Time')}</TableHead>
                <TableHead>{t('User')}</TableHead>
                <TableHead>{t('Model')}</TableHead>
                <TableHead>{t('Action')}</TableHead>
                <TableHead>{t('Risk')}</TableHead>
                <TableHead>{t('Score')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{new Date(log.created_at * 1000).toLocaleString()}</TableCell>
                  <TableCell>{log.user_name}</TableCell>
                  <TableCell>{log.model_name}</TableCell>
                  <TableCell><Badge>{actionMap[log.action] ?? log.action}</Badge></TableCell>
                  <TableCell>
                    {(() => {
                      const risk = riskLevelMap[log.risk_level]
                      return risk ? <span className={`px-2 py-1 rounded text-xs font-medium ${risk.color}`}>{risk.label}</span> : log.risk_level
                    })()}
                  </TableCell>
                  <TableCell>{log.risk_score}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
