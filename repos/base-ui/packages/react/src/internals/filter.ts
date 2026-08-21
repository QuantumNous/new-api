import { stringifyAsLabel } from './resolveValueLabel';
import { stringifyLocale } from '../utils/stringifyLocale';

const filterCache = new Map<string, Filter>();

export function getFilter(options: GetFilterParameters = {}): Filter {
  const mergedOptions: Intl.CollatorOptions = {
    usage: 'search',
    sensitivity: 'base',
    ignorePunctuation: true,
    ...options,
  };

  const cacheKey = `${stringifyLocale(options.locale)}|${JSON.stringify(mergedOptions)}`;
  const cachedFilter = filterCache.get(cacheKey);

  if (cachedFilter) {
    return cachedFilter;
  }

  const collator = new Intl.Collator(options.locale, mergedOptions);

  const filter: Filter = {
    contains<Item>(item: Item, query: string, itemToString?: (item: Item) => string) {
      if (!query) {
        return true;
      }

      const itemString = stringifyAsLabel(item, itemToString);

      for (let i = 0; i <= itemString.length - query.length; i += 1) {
        if (collator.compare(itemString.slice(i, i + query.length), query) === 0) {
          return true;
        }
      }

      return false;
    },
    startsWith<Item>(item: Item, query: string, itemToString?: (item: Item) => string) {
      if (!query) {
        return true;
      }

      const itemString = stringifyAsLabel(item, itemToString);

      return collator.compare(itemString.slice(0, query.length), query) === 0;
    },
    endsWith<Item>(item: Item, query: string, itemToString?: (item: Item) => string) {
      if (!query) {
        return true;
      }

      const itemString = stringifyAsLabel(item, itemToString);
      const queryLength = query.length;

      return (
        itemString.length >= queryLength &&
        collator.compare(itemString.slice(itemString.length - queryLength), query) === 0
      );
    },
  };

  filterCache.set(cacheKey, filter);
  return filter;
}

export interface GetFilterParameters extends Intl.CollatorOptions {
  /**
   * The locale to use for string comparison.
   * Defaults to the user's runtime locale.
   */
  locale?: Intl.LocalesArgument | undefined;
}

export interface Filter {
  /** Returns whether the item matches the query anywhere. */
  contains: <Item>(item: Item, query: string, itemToString?: (item: Item) => string) => boolean;
  /** Returns whether the item starts with the query. */
  startsWith: <Item>(item: Item, query: string, itemToString?: (item: Item) => string) => boolean;
  /** Returns whether the item ends with the query. */
  endsWith: <Item>(item: Item, query: string, itemToString?: (item: Item) => string) => boolean;
}
