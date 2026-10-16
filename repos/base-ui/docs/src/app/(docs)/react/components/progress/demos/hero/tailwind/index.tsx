'use client';
import * as React from 'react';
import { Progress } from '@base-ui/react/progress';

export default function ExampleProgress() {
  const [value, setValue] = React.useState(20);

  // Simulate changes
  React.useEffect(() => {
    const interval = setInterval(() => {
      setValue((current) => Math.min(100, Math.round(current + Math.random() * 25)));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Progress.Root className="grid max-w-full w-60 grid-cols-2 gap-y-2" value={value}>
      <Progress.Label className="text-sm font-normal text-neutral-950 dark:text-white">
        Export data
      </Progress.Label>
      <Progress.Value className="text-right text-sm text-neutral-950 dark:text-white" />
      <Progress.Track className="col-span-2 h-1 overflow-hidden bg-neutral-200 dark:bg-neutral-800">
        <Progress.Indicator className="bg-neutral-950 transition-[width] duration-500 dark:bg-white" />
      </Progress.Track>
    </Progress.Root>
  );
}
