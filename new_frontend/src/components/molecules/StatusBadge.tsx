import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: 'enabled' | 'disabled' | 'pending' | 'error';
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const config = {
    enabled: {
      icon: CheckCircle,
      label: label || '启用',
      variant: 'default' as const,
      className: 'bg-green-500 hover:bg-green-600',
    },
    disabled: {
      icon: XCircle,
      label: label || '禁用',
      variant: 'destructive' as const,
      className: '',
    },
    pending: {
      icon: Clock,
      label: label || '待审核',
      variant: 'secondary' as const,
      className: '',
    },
    error: {
      icon: AlertCircle,
      label: label || '错误',
      variant: 'destructive' as const,
      className: '',
    },
  };

  const { icon: Icon, label: displayLabel, variant, className: variantClass } = config[status];

  return (
    <Badge variant={variant} className={cn('gap-1', variantClass, className)}>
      <Icon className="h-3 w-3" />
      {displayLabel}
    </Badge>
  );
}
