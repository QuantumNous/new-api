'use client';
import * as React from 'react';
import { Menu } from '@base-ui/react/menu';
import menuDemoStyles from 'docs/src/app/(docs)/react/components/menu/demos/submenu/css-modules/index.module.css';
import * as ReactDOM from 'react-dom';
import { useStableCallback } from '@base-ui/utils/useStableCallback';
import styles from './perf.module.css';
import { logResults, removeOutliers } from './utils/benchmark';
import { waitSingleFrame } from './utils/wait';

const menuItemCount = 50;

const menuItems = Array.from({ length: menuItemCount }).map((_, i) => ({
  label: `Menu Item ${i + 1}`,
  index: i + 1,
}));

const WARMUP_ITERATIONS = 5;

const Controls = React.memo(function Controls(props: {
  setIsMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const { setIsMenuOpen } = props;
  const [isRunning, setIsRunning] = React.useState(false);
  const [shouldRemoveOutliers, setShouldRemoveOutliers] = React.useState(true);

  const runBenchmark = useStableCallback(async (iterations: number, warmupIterations: number) => {
    if (isRunning) {
      return;
    }

    setIsRunning(true);
    console.log(`Running benchmark: ${iterations} iterations (+${warmupIterations} warmup)...`);

    const results: number[] = [];
    const totalIterations = warmupIterations + iterations;

    for (let i = 0; i < totalIterations; i += 1) {
      const isWarmup = i < warmupIterations;
      const startTime = performance.now();

      ReactDOM.flushSync(() => {
        setIsMenuOpen(true);
      });

      // eslint-disable-next-line no-await-in-loop
      await waitSingleFrame();

      if (!isWarmup) {
        const spendTime = performance.now() - startTime;
        results.push(Math.round(spendTime * 10) / 10);
      }

      ReactDOM.flushSync(() => {
        setIsMenuOpen(false);
      });
      // eslint-disable-next-line no-await-in-loop
      await waitSingleFrame();
    }

    logResults(shouldRemoveOutliers ? removeOutliers(results) : results);
    setIsRunning(false);
  });

  return (
    <div className={styles.controls}>
      <button
        type="button"
        onClick={() => setIsMenuOpen((prev) => !prev)}
        className={styles.button}
        disabled={isRunning}
      >
        Toggle
      </button>
      <button
        type="button"
        onClick={() => runBenchmark(10, WARMUP_ITERATIONS)}
        className={styles.button}
        disabled={isRunning}
      >
        Run 10
      </button>
      <button
        type="button"
        onClick={() => runBenchmark(20, WARMUP_ITERATIONS)}
        className={styles.button}
        disabled={isRunning}
      >
        Run 20
      </button>
      <button
        type="button"
        onClick={() => runBenchmark(50, WARMUP_ITERATIONS)}
        className={styles.button}
        disabled={isRunning}
      >
        Run 50
      </button>
      <label style={{ marginLeft: 8 }}>
        <input
          type="checkbox"
          style={{ marginRight: 4 }}
          checked={shouldRemoveOutliers}
          onChange={(ev) => setShouldRemoveOutliers(ev.target.checked)}
        />
        Remove outliers
      </label>
    </div>
  );
});

export default function MenuOpenTestComponent() {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  return (
    <div className={styles.preview}>
      <Controls setIsMenuOpen={setIsMenuOpen} />

      <Menu.Root open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <Menu.Trigger className={styles.button} id="menu-open-benchmark-trigger">
          Menu
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner
            sideOffset={8}
            positionMethod="fixed"
            className={menuDemoStyles.Positioner}
          >
            <Menu.Popup className={`${menuDemoStyles.Popup} ${styles.noAnimationPopup}`}>
              <Menu.Arrow className={menuDemoStyles.Arrow}>
                <ArrowSvg />
              </Menu.Arrow>
              {menuItems.map((item) => (
                <Menu.Item
                  key={item.index}
                  onClick={() => console.log(`Clicked ${item.label}`)}
                  className={menuDemoStyles.Item}
                >
                  {item.label}
                </Menu.Item>
              ))}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </div>
  );
}

function ArrowSvg(props: React.ComponentProps<'svg'>) {
  return (
    <svg width="20" height="10" viewBox="0 0 20 10" fill="none" {...props}>
      <path
        d="M9.66437 2.60207L4.80758 6.97318C4.07308 7.63423 3.11989 8 2.13172 8H0V10H20V8H18.5349C17.5468 8 16.5936 7.63423 15.8591 6.97318L11.0023 2.60207C10.622 2.2598 10.0447 2.25979 9.66437 2.60207Z"
        className={menuDemoStyles.ArrowFill}
      />
      <path
        d="M8.99542 1.85876C9.75604 1.17425 10.9106 1.17422 11.6713 1.85878L16.5281 6.22989C17.0789 6.72568 17.7938 7.00001 18.5349 7.00001L15.89 7L11.0023 2.60207C10.622 2.2598 10.0447 2.2598 9.66436 2.60207L4.77734 7L2.13171 7.00001C2.87284 7.00001 3.58774 6.72568 4.13861 6.22989L8.99542 1.85876Z"
        className={menuDemoStyles.ArrowOuterStroke}
      />
      <path
        d="M10.3333 3.34539L5.47654 7.71648C4.55842 8.54279 3.36693 9 2.13172 9H0V8H2.13172C3.11989 8 4.07308 7.63423 4.80758 6.97318L9.66437 2.60207C10.0447 2.25979 10.622 2.2598 11.0023 2.60207L15.8591 6.97318C16.5936 7.63423 17.5468 8 18.5349 8H20V9H18.5349C17.2998 9 16.1083 8.54278 15.1901 7.71648L10.3333 3.34539Z"
        className={menuDemoStyles.ArrowInnerStroke}
      />
    </svg>
  );
}
