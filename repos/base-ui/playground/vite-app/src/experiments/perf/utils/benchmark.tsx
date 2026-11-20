import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useStableCallback } from '@base-ui/utils/useStableCallback';
import { useTimeout } from '@base-ui/utils/useTimeout';
import styles from '../perf.module.css';

const DOM_SETTLE_QUIET_WINDOW_MS = 32;

const Controls = React.memo(function Controls(props: {
  setShowBenchmark: React.Dispatch<React.SetStateAction<boolean>>;
  benchmarkRootRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { setShowBenchmark, benchmarkRootRef } = props;
  const settleTimeout = useTimeout();
  const [isRunning, setIsRunning] = React.useState(false);
  const [shouldRemoveOutliers, setShouldRemoveOutliers] = React.useState(true);

  const measureDomSettled = useStableCallback(() => {
    const start = performance.now();
    let lastMutationAt = start;
    let observer: MutationObserver | null = null;
    let resolved = false;

    return new Promise<number>((resolve) => {
      const finish = () => {
        if (resolved) {
          return;
        }
        resolved = true;
        observer?.disconnect();
        settleTimeout.clear();
        resolve(Math.max(0, lastMutationAt - start));
      };

      const root = benchmarkRootRef.current;

      if (root) {
        observer = new MutationObserver(() => {
          lastMutationAt = performance.now();
          settleTimeout.start(DOM_SETTLE_QUIET_WINDOW_MS, finish);
        });

        observer.observe(root, {
          attributes: true,
          childList: true,
          characterData: true,
          subtree: true,
        });

        // Resolve once the DOM stays quiet for a small window after the last mutation.
        settleTimeout.start(DOM_SETTLE_QUIET_WINDOW_MS, finish);
      } else {
        finish();
      }

      ReactDOM.flushSync(() => {
        setShowBenchmark(true);
      });
    });
  });

  const runBenchmark = useStableCallback(async (iterations: number, warmupIterations: number) => {
    if (isRunning) {
      console.warn('Benchmark is already running.');
      return;
    }

    setIsRunning(true);
    console.log(`Running benchmark: ${iterations} iterations (+${warmupIterations} warmup)...`);
    try {
      const results = [] as number[];

      for (let i = 0; i < warmupIterations + iterations; i += 1) {
        ReactDOM.flushSync(() => {
          setShowBenchmark(false);
        });

        // eslint-disable-next-line no-await-in-loop
        const domSettleDuration = await measureDomSettled();

        if (i < warmupIterations) {
          continue;
        }

        results.push(Math.round(domSettleDuration * 10) / 10);
      }

      logResults(shouldRemoveOutliers ? removeOutliers(results) : results);
    } finally {
      setIsRunning(false);
    }
  });

  return (
    <div className="flex gap-2 items-baseline">
      <button
        type="button"
        onClick={() => setShowBenchmark((prev: boolean) => !prev)}
        className={styles.button}
        disabled={isRunning}
      >
        Toggle
      </button>
      <button
        type="button"
        onClick={() => runBenchmark(10, 5)}
        className={styles.button}
        disabled={isRunning}
      >
        Run 10
      </button>
      <button
        type="button"
        onClick={() => runBenchmark(20, 5)}
        className={styles.button}
        disabled={isRunning}
      >
        Run 20
      </button>
      <button
        type="button"
        onClick={() => runBenchmark(50, 5)}
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

export default function PerformanceBenchmark(props: React.PropsWithChildren<{}>) {
  const [showBenchmark, setShowBenchmark] = React.useState(false);
  const benchmarkRootRef = React.useRef<HTMLDivElement>(null);

  return (
    <div>
      <Controls setShowBenchmark={setShowBenchmark} benchmarkRootRef={benchmarkRootRef} />
      <div ref={benchmarkRootRef}>{showBenchmark && props.children}</div>
    </div>
  );
}

function logResults(results: number[]) {
  console.log(results);
  console.log(
    'Average:',
    Math.round((results.reduce((a, b) => a + b, 0) / results.length) * 10) / 10,
  );
  console.log(
    'Std Dev:',
    (() => {
      const avg = results.reduce((a, b) => a + b, 0) / results.length;
      const squareDiffs = results.map((value) => {
        const diff = value - avg;
        return diff * diff;
      });
      const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
      return +Math.sqrt(avgSquareDiff).toFixed(2);
    })(),
  );
}

function removeOutliers(data: number[]) {
  const sortedData = data.slice().sort((a, b) => a - b);
  const q1Index = Math.floor(sortedData.length / 4);
  const q3Index = Math.floor((sortedData.length * 3) / 4);
  const q1 = sortedData[q1Index];
  const q3 = sortedData[q3Index];
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  return data.filter((value) => value >= lowerBound && value <= upperBound);
}
