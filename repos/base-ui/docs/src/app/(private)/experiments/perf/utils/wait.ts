// Copied from packages/react/test/wait.ts
import { AnimationFrame } from '@base-ui/utils/useAnimationFrame';
import { Timeout } from '@base-ui/utils/useTimeout';

/**
 * Waits for a single animation frame.
 */
export function waitSingleFrame(): Promise<void> {
  return new Promise((resolve) => {
    AnimationFrame.request(() => {
      resolve();
    });
  });
}

/**
 * Waits for the specified number of milliseconds.
 */
export function wait(ms: number): Promise<void> {
  const timeout = Timeout.create();

  return new Promise((resolve) => {
    timeout.start(ms, () => {
      resolve();
    });
  });
}
