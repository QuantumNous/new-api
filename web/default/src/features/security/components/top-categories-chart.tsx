import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'

interface TopCategoriesChartProps {
  data: Array<{ category: string; count: number }>
}

export function TopCategoriesChart({ data }: TopCategoriesChartProps) {
  const { t } = useTranslation()

  const config = {
    count: { label: t('Detections'), color: 'hsl(var(--chart-1))' },
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('Top Categories')}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-muted-foreground text-sm py-8 text-center">
            {t('No data')}
          </div>
        ) : (
          <ChartContainer config={config} className="min-h-[240px]">
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 24, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="category"
                angle={-30}
                textAnchor="end"
                height={60}
                tick={{ fontSize: 11 }}
                interval={0}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value: any) => (
                      <span>
                        {t('Detections')}: {value}
                      </span>
                    )}
                  />
                }
              />
              <Bar dataKey="count" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
