import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  description?: string;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  actionLabel?: string;
  onActionClick?: () => void;
}

export function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  description, 
  change, 
  trend = 'neutral',
  actionLabel,
  onActionClick 
}: StatCardProps) {
  const getTrendColor = () => {
    switch (trend) {
      case 'up': return 'text-green-600';
      case 'down': return 'text-red-600';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer h-full" onClick={onActionClick}>
      <CardContent className="p-6 h-full flex flex-col">
        <div className="flex items-start justify-between flex-1">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">{title}</p>
              <p className="text-lg font-bold">{value}</p>
            </div>
          </div>
          {actionLabel && (
            <Button variant="outline" size="sm" className="text-xs shrink-0">
              {actionLabel}
            </Button>
          )}
        </div>
        {description && (
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        )}
        {change && (
          <div className={`mt-2 text-xs ${getTrendColor()}`}>
            {change}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
