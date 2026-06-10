import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { securityApi, type DashboardData } from '../api/security'

export function SecurityDashboardPage() {
  const { t } = useTranslation()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    securityApi.getDashboard().then((res: any) => {
      if (res.success) {
        setData(res.data)
      }
      setLoading(false)
    })
  }, [])

  if (loading) {
    return <div className="p-6">{t('Loading...')}</div>
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">{t('Security Dashboard')}</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('Total Detections')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.summary?.total_detections ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('Interceptions')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{data?.summary?.total_interceptions ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('Alerts')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{data?.summary?.total_alerts ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("Today's Detections")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.summary?.today_detections ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('Top Categories')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data?.top_categories?.map((item: any, idx: number) => (
                <li key={idx} className="flex justify-between">
                  <span>{item.category}</span>
                  <span className="font-medium">{item.count}</span>
                </li>
              )) ?? <li className="text-muted-foreground">{t('No data')}</li>}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('Top Users')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data?.top_users?.map((item: any, idx: number) => (
                <li key={idx} className="flex justify-between">
                  <span>{item.user_name}</span>
                  <span className="font-medium">{item.count}</span>
                </li>
              )) ?? <li className="text-muted-foreground">{t('No data')}</li>}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
