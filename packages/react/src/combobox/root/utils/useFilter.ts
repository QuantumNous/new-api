'use client';
import * as React from 'react';
import { createCollatorItemFilter, createSingleSelectionCollatorFilter } from './index';
import {
  type Filter,
  type GetFilterParameters as UseFilterOptions,
  getFilter,
} from '../../../internals/filter';

export type { Filter, UseFilterOptions };

/**
 * Matches items against a query using `Intl.Collator` for robust string matching.
 */
export const useCoreFilter = getFilter;

export interface UseComboboxFilterOptions extends UseFilterOptions {
  /**
   * Whether the combobox is in multiple selection mode.
   * @default false
   */
  multiple?: boolean | undefined;
  /**
   * The current value of the combobox.
   */
  value?: any;
}

/**
 * Matches items against a query using `Intl.Collator` for robust string matching.
 */
export function useComboboxFilter(options: UseComboboxFilterOptions = {}): Filter {
  const { multiple = false, value, ...collatorOptions } = options;

  const coreFilter = getFilter(collatorOptions);

  const contains: Filter['contains'] = React.useCallback(
    (item: any, query: string, itemToString?: (item: any) => string) => {
      if (multiple) {
        return createCollatorItemFilter(coreFilter, itemToString)(item, query);
      }
      return createSingleSelectionCollatorFilter(coreFilter, itemToString, value)(item, query);
    },
    [coreFilter, value, multiple],
  );

  return React.useMemo(
    () => ({
      contains,
      startsWith: coreFilter.startsWith,
      endsWith: coreFilter.endsWith,
    }),
    [contains, coreFilter],
  );
}
