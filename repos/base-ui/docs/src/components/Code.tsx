import clsx from 'clsx';
import * as React from 'react';

export function Code(props: React.ComponentProps<'code'>) {
  return <code {...props} className={clsx('Code', props.className)} />;
}
