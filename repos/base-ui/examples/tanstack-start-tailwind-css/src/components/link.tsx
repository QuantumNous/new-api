import clsx from 'clsx';

export function Link({ className, ...props }: React.ComponentPropsWithoutRef<'a'>) {
  const external = props.href && !props.href.includes('base-ui') && props.href.startsWith('http');
  return (
    <a
      className={clsx(styles, className)}
      rel={external ? 'noreferrer noopener' : undefined}
      target={external ? '_blank' : undefined}
      {...props}
    />
  );
}

export const styles = [
  'text-blue-600 underline underline-offset-2 dark:text-blue-400',
  'decoration-1 decoration-blue-600/40 hover:decoration-blue-600 dark:decoration-blue-400/50 dark:hover:decoration-blue-400',
  'focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-blue-600 dark:focus-visible:outline-blue-400',
];
