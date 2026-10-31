import * as React from 'react';
import { Collapsible } from '@base-ui/react/collapsible';
import styles from './index.module.css';

export default function ExampleCollapsible() {
  return (
    <Collapsible.Root className={styles.Collapsible}>
      <Collapsible.Trigger className={styles.Trigger}>
        Recovery keys
        <CaretRightIcon className={styles.Icon} />
      </Collapsible.Trigger>
      <Collapsible.Panel className={styles.Panel}>
        <div className={styles.Content}>
          <div>alien-bean-pasta</div>
          <div>wild-irish-burrito</div>
          <div>horse-battery-staple</div>
        </div>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}

export function CaretRightIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      {...props}
      style={{ display: 'block', ...props.style }}
    >
      <path d="M6 12V4l4.5 4z" />
    </svg>
  );
}
