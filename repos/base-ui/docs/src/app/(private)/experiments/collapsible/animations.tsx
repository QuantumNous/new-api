'use client';
import * as React from 'react';
import clsx from 'clsx';
import * as Collapsible from './_components/Collapsible';
import layoutStyles from './collapsible.module.css';
import styles from './animations.module.css';

const PARAGRAPH =
  'He rubbed his eyes, and came close to the picture, and examined it again. There were no signs of any change when he looked into the actual painting, and yet there was no doubt that the whole expression had altered. It was not a mere fancy of his own. The thing was horribly apparent.';

const HIDDEN_TEXT = 'The final line mentioned silver orchard before the cover slipped closed.';

function getInlinePanelStyle(state: { open: boolean }) {
  return {
    animationDuration: 'var(--duration)',
    animationName: state.open ? 'panel-slide-down' : 'panel-slide-up',
    animationTimingFunction: state.open ? 'ease-out' : 'ease-in',
    overflow: 'hidden',
  } as const;
}

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

      <small>regular mount</small>
      {visible && (
        <Collapsible.Root className={styles.root} defaultOpen>
          <Collapsible.Trigger>Trigger 26</Collapsible.Trigger>
          <Collapsible.Panel className={styles.panel} keepMounted>
            <Content />
          </Collapsible.Panel>
        </Collapsible.Root>
      )}

      <small>activity mount</small>
      <React.Activity mode={visible ? 'visible' : 'hidden'}>
        <Collapsible.Root className={styles.root} defaultOpen>
          <Collapsible.Trigger>Trigger 27</Collapsible.Trigger>
          <Collapsible.Panel className={styles.panel} keepMounted>
            <Content />
          </Collapsible.Panel>
        </Collapsible.Root>
      </React.Activity>
    </React.Fragment>
  );
}

export default function CssAnimations() {
  return (
    <div className={layoutStyles.grid}>
      <style>{`
        @keyframes panel-slide-down {
          from {
            height: 0;
          }

          to {
            height: var(--collapsible-panel-height);
          }
        }

        @keyframes panel-slide-up {
          from {
            height: var(--collapsible-panel-height);
          }

          to {
            height: 0;
          }
        }
      `}</style>

      <div className={layoutStyles.wrapper}>
        <pre>keepMounted: true</pre>
        <Collapsible.Root className={styles.root} defaultOpen>
          <Collapsible.Trigger>Trigger 17</Collapsible.Trigger>
          <Collapsible.Panel className={styles.panel} keepMounted>
            <Content />
          </Collapsible.Panel>
        </Collapsible.Root>

        <Collapsible.Root className={styles.root} defaultOpen={false}>
          <Collapsible.Trigger>Trigger 18</Collapsible.Trigger>
          <Collapsible.Panel className={styles.panel} keepMounted>
            <Content />
          </Collapsible.Panel>
        </Collapsible.Root>
        <small>———</small>
      </div>

      <div className={layoutStyles.wrapper}>
        <pre>keepMounted: false</pre>
        <Collapsible.Root className={styles.root} defaultOpen>
          <Collapsible.Trigger>Trigger 19</Collapsible.Trigger>
          <Collapsible.Panel className={styles.panel} keepMounted={false}>
            <Content />
          </Collapsible.Panel>
        </Collapsible.Root>

        <Collapsible.Root className={styles.root} defaultOpen={false}>
          <Collapsible.Trigger>Trigger 20</Collapsible.Trigger>
          <Collapsible.Panel className={styles.panel} keepMounted={false}>
            <Content />
          </Collapsible.Panel>
        </Collapsible.Root>
        <small>———</small>
      </div>

      <div className={layoutStyles.wrapper}>
        <pre>nested</pre>
        <Collapsible.Root className={styles.root}>
          <Collapsible.Trigger>Trigger 21</Collapsible.Trigger>
          <Collapsible.Panel className={styles.panel} keepMounted>
            <Content>
              <Collapsible.Root className={styles.root}>
                <Collapsible.Trigger>Trigger 22</Collapsible.Trigger>
                <Collapsible.Panel className={styles.panel} keepMounted>
                  <Content />
                </Collapsible.Panel>
              </Collapsible.Root>
            </Content>
          </Collapsible.Panel>
        </Collapsible.Root>
        <small>———</small>

        <pre>slow</pre>
        <Collapsible.Root className={clsx(styles.root, styles.slowRoot)} defaultOpen={false}>
          <Collapsible.Trigger>Trigger 23</Collapsible.Trigger>
          <Collapsible.Panel className={styles.panel} keepMounted>
            <Content />
          </Collapsible.Panel>
        </Collapsible.Root>
        <small>———</small>
      </div>

      <div className={layoutStyles.wrapper}>
        <pre>hiddenUntilFound</pre>
        <Collapsible.Root className={styles.root} defaultOpen={false}>
          <Collapsible.Trigger>Trigger 24</Collapsible.Trigger>
          <Collapsible.Panel className={styles.panel} hiddenUntilFound>
            <Collapsible.Content>
              <p>{PARAGRAPH}</p>
              <p>{HIDDEN_TEXT}</p>
            </Collapsible.Content>
          </Collapsible.Panel>
        </Collapsible.Root>
        <small>———</small>

        <pre>inline style</pre>
        <Collapsible.Root className={styles.root} defaultOpen>
          <Collapsible.Trigger>Trigger 25</Collapsible.Trigger>
          <Collapsible.Panel keepMounted style={getInlinePanelStyle}>
            <Content />
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
