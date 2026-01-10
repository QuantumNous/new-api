import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/molecules/StatCard';
import { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { 
  DollarSign, 
  TrendingUp, 
  Send, 
  Activity, 
  Coins, 
  FileText, 
  Clock, 
  Zap 
} from 'lucide-react';

interface StatGroupProps {
  title: string;
  icon: LucideIcon;
  stats: Array<{
    title: string;
    value: string;
    icon: LucideIcon;
    description?: string;
    change?: string;
    trend?: 'up' | 'down' | 'neutral';
    actionLabel?: string;
    onActionClick?: () => void;
  }>;
}

export function StatGroup({ title, icon: Icon, stats }: StatGroupProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <Card className="hover:shadow-lg transition-all duration-300 border-border/50 h-full flex flex-col">
        <CardHeader className="flex flex-row items-center gap-2 pb-4">
          <motion.div
            whileHover={{ scale: 1.1, rotate: 5 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/5">
              <Icon className="h-4 w-4 text-primary" />
            </div>
          </motion.div>
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1, ease: "easeOut" }}
            >
              <StatCard {...stat} />
            </motion.div>
          ))}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function AccountStats() {
  return (
    <StatGroup
      title="账户数据"
      icon={DollarSign}
      stats={[
        {
          title: '当前余额',
          value: '¥ 128.50',
          icon: DollarSign,
          actionLabel: '充值',
          onActionClick: () => console.log('充值'),
        },
        {
          title: '历史消耗',
          value: '¥ 2,450.00',
          icon: TrendingUp,
        },
      ]}
    />
  );
}

export function UsageStats() {
  return (
    <StatGroup
      title="使用统计"
      icon={Send}
      stats={[
        {
          title: '请求次数',
          value: '12,345',
          icon: Send,
          change: '+12% 较昨日',
          trend: 'up',
        },
        {
          title: '统计次数',
          value: '8,765',
          icon: Activity,
          change: '+8% 较昨日',
          trend: 'up',
        },
      ]}
    />
  );
}

export function ResourceStats() {
  return (
    <StatGroup
      title="资源消耗"
      icon={Coins}
      stats={[
        {
          title: '统计额度',
          value: '1.2M',
          icon: Coins,
        },
        {
          title: '统计Tokens',
          value: '45.6M',
          icon: FileText,
        },
      ]}
    />
  );
}

export function PerformanceStats() {
  return (
    <StatGroup
      title="性能指标"
      icon={Zap}
      stats={[
        {
          title: '平均RPM',
          value: '156',
          icon: Clock,
        },
        {
          title: '平均TPM',
          value: '8,432',
          icon: Zap,
        },
      ]}
    />
  );
}
