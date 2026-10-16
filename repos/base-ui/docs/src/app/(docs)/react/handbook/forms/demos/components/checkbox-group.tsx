import * as React from 'react';
import clsx from 'clsx';
import { CheckboxGroup as BaseCheckboxGroup } from '@base-ui/react/checkbox-group';

export function CheckboxGroup({ className, ...props }: BaseCheckboxGroup.Props) {
  return (
    <BaseCheckboxGroup
      className={clsx(
        'flex flex-col items-start gap-1 text-neutral-950 dark:text-white',
        className,
      )}
      {...props}
    />
  );
}
