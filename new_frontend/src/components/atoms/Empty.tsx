import { FileQuestion } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function Empty({
  title = '暂无数据',
  description,
  icon,
  action,
  className,
}: EmptyProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12', className)}>
      <div className="mb-4 text-muted-foreground">
        {icon || <FileQuestion className="h-16 w-16" />}
      </div>
      <h3 className="mb-2 text-lg font-semibold">{title}</h3>
      {description && (
        <p className="mb-4 text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
}
