import { cn } from '@/lib/utils';

interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  children: React.ReactNode;
}

export function Heading({ level = 1, className, children, ...props }: HeadingProps) {
  const Tag = `h${level}` as keyof JSX.IntrinsicElements;
  
  const styles = {
    1: 'text-4xl font-bold tracking-tight',
    2: 'text-3xl font-semibold tracking-tight',
    3: 'text-2xl font-semibold tracking-tight',
    4: 'text-xl font-semibold tracking-tight',
    5: 'text-lg font-semibold',
    6: 'text-base font-semibold',
  };

  return (
    <Tag className={cn(styles[level], className)} {...props}>
      {children}
    </Tag>
  );
}

interface TextProps extends React.HTMLAttributes<HTMLParagraphElement> {
  variant?: 'default' | 'muted' | 'small' | 'large';
  children: React.ReactNode;
}

export function Text({ variant = 'default', className, children, ...props }: TextProps) {
  const styles = {
    default: 'text-base',
    muted: 'text-sm text-muted-foreground',
    small: 'text-sm',
    large: 'text-lg',
  };

  return (
    <p className={cn(styles[variant], className)} {...props}>
      {children}
    </p>
  );
}

interface CodeProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
}

export function Code({ className, children, ...props }: CodeProps) {
  return (
    <code
      className={cn(
        'relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold',
        className
      )}
      {...props}
    >
      {children}
    </code>
  );
}
