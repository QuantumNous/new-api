import { lruMemoize, createSelectorCreator } from 'reselect';
import type { Selector } from 'reselect';
import type { CreateSelectorFunction } from './createSelector';

/* eslint-disable no-underscore-dangle */ // __cacheKey__

const reselectCreateSelector = createSelectorCreator({
  memoize: lruMemoize,
  memoizeOptions: {
    maxSize: 1,
    equalityCheck: Object.is,
  },
});

type SelectorWithArgs = ReturnType<typeof reselectCreateSelector> & { selectorArgs: any[3] };

export const createSelectorMemoized: CreateSelectorFunction = (...selectors: any[]) => {
  type CacheKey = { id: number };

  const cache = new WeakMap<CacheKey, SelectorWithArgs>();
  let nextCacheId = 1;

  const combiner = selectors[selectors.length - 1];
  const nSelectors = selectors.length - 1 || 1;
  // (s1, s2, ..., sN, a1, a2, a3) => { ... }
  const argsLength = combiner.length - nSelectors;

  if (argsLength > 3) {
    throw new Error('Unsupported number of arguments');
  }

  const selector = (state: any, a1: any, a2: any, a3: any) => {
    let cacheKey = state.__cacheKey__;
    if (!cacheKey) {
      cacheKey = { id: nextCacheId };
      state.__cacheKey__ = cacheKey;
      nextCacheId += 1;
    }

    let fn = cache.get(cacheKey);
    if (!fn) {
      let reselectArgs: Array<Selector<any> | (() => unknown) | typeof combiner> = selectors;
      const selectorArgs = [undefined, undefined, undefined];
      switch (argsLength) {
        case 0:
          break;
        case 1: {
          reselectArgs = [...selectors.slice(0, -1), () => selectorArgs[0], combiner];
          break;
        }
        case 2: {
          reselectArgs = [
            ...selectors.slice(0, -1),
            () => selectorArgs[0],
            () => selectorArgs[1],
            combiner,
          ];
          break;
        }
        case 3: {
          reselectArgs = [
            ...selectors.slice(0, -1),
            () => selectorArgs[0],
            () => selectorArgs[1],
            () => selectorArgs[2],
            combiner,
          ];
          break;
        }
        default:
          throw new Error('Unsupported number of arguments');
      }

      fn = reselectCreateSelector(...(reselectArgs as any)) as unknown as SelectorWithArgs;
      fn.selectorArgs = selectorArgs;

      cache.set(cacheKey, fn);
    }

    fn.selectorArgs[0] = a1;
    fn.selectorArgs[1] = a2;
    fn.selectorArgs[2] = a3;

    switch (argsLength) {
      case 0:
        return fn(state);
      case 1:
        return fn(state, a1);
      case 2:
        return fn(state, a1, a2);
      case 3:
        return fn(state, a1, a2, a3);
      default:
        throw /* minify-error-disabled */ new Error('unreachable');
    }
  };

  return selector as any;
};
