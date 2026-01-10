import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface RequestTrendChartProps {
  data: ReadonlyArray<{ date: string; requests: number; tokens: number }>;
  timeRange: string;
  onTimeRangeChange: (value: string) => void;
}

export function RequestTrendChart({ data, timeRange, onTimeRangeChange }: RequestTrendChartProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>请求趋势</CardTitle>
          <Tabs value={timeRange} onValueChange={onTimeRangeChange}>
            <TabsList>
              <TabsTrigger value="7d">7天</TabsTrigger>
              <TabsTrigger value="30d">30天</TabsTrigger>
              <TabsTrigger value="90d">90天</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data as any}>
            <defs>
              <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Area
              type="monotone"
              dataKey="requests"
              stroke="#8b5cf6"
              fillOpacity={1}
              fill="url(#colorRequests)"
              name="请求数"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
