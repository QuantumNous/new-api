import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, TrendingUp, PieChart, ListOrdered } from 'lucide-react';

interface ModelAnalysisProps {
  data?: any;
}

export function ModelAnalysis({ data }: ModelAnalysisProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          模型数据分析
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="distribution" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="distribution" className="flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              消耗分布
            </TabsTrigger>
            <TabsTrigger value="trend" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              消耗趋势
            </TabsTrigger>
            <TabsTrigger value="call-distribution" className="flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              调用次数分布
            </TabsTrigger>
            <TabsTrigger value="call-ranking" className="flex items-center gap-2">
              <ListOrdered className="h-4 w-4" />
              调用次数排行
            </TabsTrigger>
          </TabsList>
          <TabsContent value="distribution" className="mt-4">
            <div className="flex h-64 items-center justify-center text-muted-foreground">
              <p>消耗分布图表</p>
            </div>
          </TabsContent>
          <TabsContent value="trend" className="mt-4">
            <div className="flex h-64 items-center justify-center text-muted-foreground">
              <p>消耗趋势图表</p>
            </div>
          </TabsContent>
          <TabsContent value="call-distribution" className="mt-4">
            <div className="flex h-64 items-center justify-center text-muted-foreground">
              <p>调用次数分布图表</p>
            </div>
          </TabsContent>
          <TabsContent value="call-ranking" className="mt-4">
            <div className="flex h-64 items-center justify-center text-muted-foreground">
              <p>调用次数排行</p>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
