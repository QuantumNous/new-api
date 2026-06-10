import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart'
import { PieChart, Pie, Cell } from 'recharts'

interface RiskDistributionChartProps {
  data: {
    low: number
    medium: number
    high: number
    critical: number
  }
}

export function RiskDistributionChart({ data }: RiskDistributionChartProps) {
  const { t } = useTranslation()

  const chartData = [
    { key: 'low', label: t('Low'), value: data.low, color: 'hsl(var(--chart-1))' },
    { key: 'medium', label: t('Medium'), value: data.medium, color: 'hsl(var(--chart-2))' },
    { key: 'high', label: t('High'), value: data.high, color: 'hsl(var(--chart-3))' },
    { key: 'critical', label: t('Critical'), value: data.critical, color: 'hsl(var(--chart-4))' },
  ].filter((d) => d.value > 0)

  const config = {
    low: { label: t('Low'), color: 'hsl(var(--chart-1))' },
    medium: { label: t('Medium'), color: 'hsl(var(--chart-2))' },
    high: { label: t('High'), color: 'hsl(var(--chart-3))' },
    critical: { label: t('Critical'), color: 'hsl(var(--chart-4))' },
  }

  const total = data.low + data.medium + data.high + data.critical

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('Risk Distribution')}</CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="text-muted-foreground text-sm py-8 text-center">
            {t('No data')}
          </div>
        ) : (
          <ChartContainer config={config} className="min-h-[240px]">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="key"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={2}
              >
                {chartData.map((entry) => (
                  <Cell key={entry.key} fill={entry.color} />
                ))}
              </Pie>
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value: any, name: any) => (
                      <span>
                        {config[name as keyof typeof config]?.label ?? name}: {value}
                      </span>
                    )}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
            </PieChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
