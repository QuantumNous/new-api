import * as React from 'react';
import clsx from 'clsx';
import { Slider } from '@base-ui/react/slider';

export function Root({ className, ...props }: Slider.Root.Props<any>) {
  return <Slider.Root className={clsx('grid grid-cols-2', className)} {...props} />;
}

export function Value({ className, ...props }: Slider.Value.Props) {
  return (
    <Slider.Value
      className={clsx('text-sm font-normal text-neutral-950 dark:text-white', className)}
      {...props}
    />
  );
}

export function Control({ className, ...props }: Slider.Control.Props) {
  return (
    <Slider.Control
      className={clsx('flex col-span-2 touch-none items-center py-3 select-none', className)}
      {...props}
    />
  );
}

export function Track({ className, ...props }: Slider.Track.Props) {
  return (
    <Slider.Track
      className={clsx('h-1 w-full bg-neutral-200 select-none dark:bg-neutral-800', className)}
      {...props}
    />
  );
}

export function Indicator({ className, ...props }: Slider.Indicator.Props) {
  return (
    <Slider.Indicator
      className={clsx('bg-neutral-950 select-none dark:bg-white', className)}
      {...props}
    />
  );
}

export function Thumb({ className, ...props }: Slider.Thumb.Props) {
  return (
    <Slider.Thumb
      className={clsx(
        'size-4 border border-neutral-950 bg-white select-none has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-neutral-950 dark:has-[:focus-visible]:outline-white dark:border-white dark:bg-neutral-950',
        className,
      )}
      {...props}
    />
  );
}
