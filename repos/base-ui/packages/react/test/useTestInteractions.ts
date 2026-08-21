import * as React from 'react';
import type { ElementProps } from '../src/floating-ui-react/types';
import {
  ACTIVE_KEY,
  FOCUSABLE_ATTRIBUTE,
  SELECTED_KEY,
} from '../src/floating-ui-react/utils/constants';

export type ExtendedUserProps = {
  [ACTIVE_KEY]?: boolean | undefined;
  [SELECTED_KEY]?: boolean | undefined;
};

export type TestElementProps = Omit<ElementProps, 'item'> & {
  item?:
    | React.HTMLProps<HTMLElement>
    | ((props: ExtendedUserProps) => React.HTMLProps<HTMLElement>)
    | undefined;
};

export interface UseTestInteractionsReturn {
  getReferenceProps: (userProps?: React.HTMLProps<Element>) => Record<string, unknown>;
  getFloatingProps: (userProps?: React.HTMLProps<HTMLElement>) => Record<string, unknown>;
  getItemProps: (
    userProps?: Omit<React.HTMLProps<HTMLElement>, 'selected' | 'active'> & ExtendedUserProps,
  ) => Record<string, unknown>;
  getTriggerProps: (userProps?: React.HTMLProps<Element>) => Record<string, unknown>;
}

export function useTestInteractions(
  propsList: Array<TestElementProps | void> = [],
): UseTestInteractionsReturn {
  const referenceDeps = propsList.map((interactionProps) => interactionProps?.reference);
  const floatingDeps = propsList.map((interactionProps) => interactionProps?.floating);
  const itemDeps = propsList.map((interactionProps) => interactionProps?.item);
  const triggerDeps = propsList.map((interactionProps) => interactionProps?.trigger);

  const getReferenceProps = React.useCallback(
    (userProps?: React.HTMLProps<Element>) => mergeProps(userProps, propsList, 'reference'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    referenceDeps,
  );

  const getFloatingProps = React.useCallback(
    (userProps?: React.HTMLProps<HTMLElement>) => mergeProps(userProps, propsList, 'floating'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    floatingDeps,
  );

  const getItemProps = React.useCallback(
    (userProps?: Omit<React.HTMLProps<HTMLElement>, 'selected' | 'active'> & ExtendedUserProps) =>
      mergeProps(userProps, propsList, 'item'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    itemDeps,
  );

  const getTriggerProps = React.useCallback(
    (userProps?: React.HTMLProps<Element>) => mergeProps(userProps, propsList, 'trigger'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    triggerDeps,
  );

  return React.useMemo(
    () => ({ getReferenceProps, getFloatingProps, getItemProps, getTriggerProps }),
    [getReferenceProps, getFloatingProps, getItemProps, getTriggerProps],
  );
}

/* eslint-disable guard-for-in */

function mergeProps<Key extends keyof TestElementProps>(
  userProps: (React.HTMLProps<Element> & ExtendedUserProps) | undefined,
  propsList: Array<TestElementProps | void>,
  elementKey: Key,
): Record<string, unknown> {
  const eventHandlers = new Map<string, Array<(...args: unknown[]) => void>>();
  const isItem = elementKey === 'item';

  const outputProps = {} as Record<string, unknown>;

  if (elementKey === 'floating') {
    outputProps.tabIndex = -1;
    outputProps[FOCUSABLE_ATTRIBUTE] = '';
  }

  for (let i = 0; i < propsList.length; i += 1) {
    let props;

    const propsOrGetProps = propsList[i]?.[elementKey];
    if (typeof propsOrGetProps === 'function') {
      props = userProps ? propsOrGetProps(userProps) : null;
    } else {
      props = propsOrGetProps;
    }
    if (!props) {
      continue;
    }

    mutablyMergeProps(outputProps, props, isItem, eventHandlers);
  }

  mutablyMergeProps(outputProps, userProps, isItem, eventHandlers);

  return outputProps;
}

function mutablyMergeProps(
  outputProps: Record<string, unknown>,
  props: any,
  isItem: boolean,
  eventHandlers: Map<string, Array<(...args: unknown[]) => void>>,
) {
  for (const key in props) {
    const value = (props as any)[key];

    if (isItem && (key === ACTIVE_KEY || key === SELECTED_KEY)) {
      continue;
    }

    if (!isEventHandlerKey(key)) {
      outputProps[key] = value;
      continue;
    }

    if (typeof value !== 'function') {
      continue;
    }

    let handlers = eventHandlers.get(key);
    if (!handlers) {
      const newHandlers: Array<(...args: unknown[]) => void> = [];
      handlers = newHandlers;
      eventHandlers.set(key, handlers);

      outputProps[key] = (...args: unknown[]) => {
        let returnValue: unknown;

        for (const fn of newHandlers) {
          const result = fn(...args);
          if (returnValue === undefined && result !== undefined) {
            returnValue = result;
          }
        }

        return returnValue;
      };
    }

    handlers.push(value);
  }
}

function isEventHandlerKey(key: string) {
  const thirdCharCode = key.charCodeAt(2);
  return (
    key.charCodeAt(0) === 111 &&
    key.charCodeAt(1) === 110 &&
    thirdCharCode >= 65 &&
    thirdCharCode <= 90
  );
}
