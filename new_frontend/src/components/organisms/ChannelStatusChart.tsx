import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface ChannelStatusChartProps {
  data: ReadonlyArray<{ name: string; value: number }>;
}

export function ChannelStatusChart({ data }: ChannelStatusChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>渠道状态</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data as any} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="name" type="category" />
            <Tooltip />
            <Bar dataKey="value" fill="#8b5cf6" name="数量" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
