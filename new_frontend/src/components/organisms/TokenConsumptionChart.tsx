import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface TokenConsumptionChartProps {
  data: ReadonlyArray<{ date: string; tokens: number }>;
}

export function TokenConsumptionChart({ data }: TokenConsumptionChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Token 消耗</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={data as any}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="tokens"
              stroke="#3b82f6"
              strokeWidth={2}
              name="Tokens"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
