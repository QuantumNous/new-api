import type { Rspack } from '../types';

type Deferred = {
  promise: Promise<Rspack.Stats>;
  resolve: (stats: Rspack.Stats) => void;
};

const createDeferred = (): Deferred => {
  const deferred = {} as Deferred;

  deferred.promise = new Promise<Rspack.Stats>((resolve) => {
    deferred.resolve = resolve;
  });

  return deferred;
};

export const createCompileState = (environmentCount: number) => {
  const stats: Array<Rspack.Stats | undefined> = new Array(environmentCount);
  const waiters = Array.from({ length: environmentCount }, createDeferred);

  return {
    reset(index: number): void {
      if (!stats[index]) {
        return;
      }

      stats[index] = undefined;
      waiters[index] = createDeferred();
    },

    done(index: number, nextStats: Rspack.Stats): void {
      stats[index] = nextStats;
      waiters[index].resolve(nextStats);
    },

    async wait(index: number): Promise<Rspack.Stats> {
      const currentStats = stats[index];
      if (currentStats) {
        return currentStats;
      }

      return waiters[index].promise;
    },
  };
};
