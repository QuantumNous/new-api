'use client';
import * as React from 'react';
import clsx from 'clsx';
import * as Collapsible from './_components/Collapsible';
import layoutStyles from './collapsible.module.css';
import styles from './transitions.module.css';

const PARAGRAPH =
  'He rubbed his eyes, and came close to the picture, and examined it again. There were no signs of any change when he looked into the actual painting, and yet there was no doubt that the whole expression had altered. It was not a mere fancy of his own. The thing was horribly apparent.';

const HIDDEN_TEXT = 'The margin note mentioned amber inlet before the page was folded shut.';

function Content({ className, children }: React.ComponentProps<typeof Collapsible.Content>) {
  return (
    <Collapsible.Content className={className}>
      <p>{PARAGRAPH}</p>
      {children}
    </Collapsible.Content>
  );
}

function ActivityComparison() {
  const [visible, setVisible] = React.useState(true);

  return (
    <React.Fragment>
      <button
        type="button"
        className={layoutStyles.nativeButton}
        onClick={() => setVisible((prev) => !prev)}
      >
        {visible ? 'Hide sections' : 'Show sections'}
      </button>

      <small>regular mount (does not preserve closed state)</small>
      {visible && (
        <Collapsible.Root className={styles.root} defaultOpen>
          <Collapsible.Trigger>Trigger 14</Collapsible.Trigger>
          <Collapsible.Panel className={styles.panel}>
            <Content />
          </Collapsible.Panel>
        </Collapsible.Root>
      )}

      <small>activity mount</small>
      <React.Activity mode={visible ? 'visible' : 'hidden'}>
        <Collapsible.Root className={styles.root} defaultOpen>
          <Collapsible.Trigger>Trigger 15</Collapsible.Trigger>
          <Collapsible.Panel className={styles.panel}>
            <Content />
          </Collapsible.Panel>
        </Collapsible.Root>
      </React.Activity>
    </React.Fragment>
  );
}

export default function CssTransitions() {
  const [open, setOpen] = React.useState(false);

  return (
    <div className={layoutStyles.grid}>
      <div className={layoutStyles.wrapper}>
        <pre>keepMounted: true</pre>
        <Collapsible.Root className={styles.root} defaultOpen>
          <Collapsible.Trigger>Trigger 5</Collapsible.Trigger>
          <Collapsible.Panel className={styles.panel} keepMounted>
            <Content />
          </Collapsible.Panel>
        </Collapsible.Root>

        <Collapsible.Root className={styles.root} defaultOpen={false}>
          <Collapsible.Trigger>Trigger 6</Collapsible.Trigger>
          <Collapsible.Panel className={styles.panel} keepMounted>
            <Content />
          </Collapsible.Panel>
        </Collapsible.Root>
        <small>———</small>
      </div>

      <div className={layoutStyles.wrapper}>
        <pre>keepMounted: false</pre>
        <Collapsible.Root className={styles.root} defaultOpen>
          <Collapsible.Trigger>Trigger 7</Collapsible.Trigger>
          <Collapsible.Panel className={styles.panel} keepMounted={false}>
            <Content />
          </Collapsible.Panel>
        </Collapsible.Root>

        <Collapsible.Root className={styles.root} defaultOpen={false}>
          <Collapsible.Trigger>Trigger 8</Collapsible.Trigger>
          <Collapsible.Panel className={styles.panel} keepMounted={false}>
            <Content />
          </Collapsible.Panel>
        </Collapsible.Root>
        <small>———</small>
      </div>

      <div className={layoutStyles.wrapper}>
        <pre>controlled</pre>
        <Collapsible.Root className={styles.root} open={open} onOpenChange={setOpen}>
          <Collapsible.Trigger>Trigger 9</Collapsible.Trigger>
          <Collapsible.Panel className={styles.panel} keepMounted>
            <Content />
          </Collapsible.Panel>
        </Collapsible.Root>
        <small>———</small>

        <pre>nested</pre>
        <Collapsible.Root className={styles.root}>
          <Collapsible.Trigger>Trigger 10</Collapsible.Trigger>
          <Collapsible.Panel className={styles.panel} keepMounted>
            <Content>
              <Collapsible.Root className={styles.root}>
                <Collapsible.Trigger>Trigger 11</Collapsible.Trigger>
                <Collapsible.Panel className={styles.panel} keepMounted>
                  <Content />
                </Collapsible.Panel>
              </Collapsible.Root>
            </Content>
          </Collapsible.Panel>
        </Collapsible.Root>
        <small>———</small>
      </div>

      <div className={layoutStyles.wrapper}>
        <pre>slow</pre>
        <Collapsible.Root className={clsx(styles.root, styles.slowRoot)} defaultOpen={false}>
          <Collapsible.Trigger>Trigger 12</Collapsible.Trigger>
          <Collapsible.Panel className={styles.panel} keepMounted>
            <Content />
          </Collapsible.Panel>
        </Collapsible.Root>
        <small>———</small>

        <pre>hiddenUntilFound</pre>
        <Collapsible.Root className={styles.root} defaultOpen={false}>
          <Collapsible.Trigger>Trigger 13</Collapsible.Trigger>
          <Collapsible.Panel className={styles.panel} hiddenUntilFound>
            <Collapsible.Content>
              <p>{PARAGRAPH}</p>
              <p>{HIDDEN_TEXT}</p>
            </Collapsible.Content>
          </Collapsible.Panel>
        </Collapsible.Root>
        <small>———</small>

        <pre>React.Activity</pre>
        <ActivityComparison />
        <small>———</small>
      </div>
    </div>
  );
}
