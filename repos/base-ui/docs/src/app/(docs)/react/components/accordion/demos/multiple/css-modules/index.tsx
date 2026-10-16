import * as React from 'react';
import { Accordion } from '@base-ui/react/accordion';
import styles from '../../_index.module.css';

export default function ExampleAccordion() {
  return (
    <Accordion.Root className={styles.Accordion} multiple>
      <Accordion.Item className={styles.Item}>
        <Accordion.Header className={styles.Header}>
          <Accordion.Trigger className={styles.Trigger}>
            What is Base UI?
            <PlusIcon className={styles.Icon} />
          </Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Panel className={styles.Panel}>
          <div className={styles.Content}>
            Base UI is a library of high-quality unstyled React components for design systems and
            web apps.
          </div>
        </Accordion.Panel>
      </Accordion.Item>

      <Accordion.Item className={styles.Item}>
        <Accordion.Header className={styles.Header}>
          <Accordion.Trigger className={styles.Trigger}>
            How do I get started?
            <PlusIcon className={styles.Icon} />
          </Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Panel className={styles.Panel}>
          <div className={styles.Content}>
            Head to the “Quick start” guide in the docs. If you’ve used unstyled libraries before,
            you’ll feel at home.
          </div>
        </Accordion.Panel>
      </Accordion.Item>

      <Accordion.Item className={styles.Item}>
        <Accordion.Header className={styles.Header}>
          <Accordion.Trigger className={styles.Trigger}>
            Can I use it for my project?
            <PlusIcon className={styles.Icon} />
          </Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Panel className={styles.Panel}>
          <div className={styles.Content}>Of course! Base UI is free and open source.</div>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion.Root>
  );
}

function PlusIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="round"
      {...props}
      style={{ display: 'block', ...props.style }}
    >
      <path d="M1.5 8h13M8 14.5v-13" />
    </svg>
  );
}
