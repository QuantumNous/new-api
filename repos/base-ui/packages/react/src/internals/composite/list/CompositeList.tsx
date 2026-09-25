/* eslint-disable no-bitwise */
'use client';
import * as React from 'react';
import { useRefWithInit } from '@base-ui/utils/useRefWithInit';
import { useStableCallback } from '@base-ui/utils/useStableCallback';
import { useIsoLayoutEffect } from '@base-ui/utils/useIsoLayoutEffect';
import { CompositeListContext } from './CompositeListContext';

export type CompositeMetadata<CustomMetadata> = {
  index?: number | null | undefined;
} & CustomMetadata;

/**
 * Provides context for a list of items in a composite component.
 * @internal
 */
export function CompositeList<Metadata>(props: CompositeList.Props<Metadata>) {
  const { children, elementsRef, labelsRef, onMapChange: onMapChangeProp } = props;

  const onMapChange = useStableCallback(onMapChangeProp);

  const nextIndexRef = React.useRef(0);
  const listeners = useRefWithInit(createListeners).current;

  // We use a stable `map` to avoid O(n^2) re-allocation costs for large lists.
  // `mapTick` is our re-render trigger mechanism. We also need to update the
  // elements and label refs, but there's a lot of async work going on and sometimes
  // the effect that handles `onMapChange` gets called after those refs have been
  // filled, and we don't want to lose those values by setting their lengths to `0`.
  // We also need to have them at the proper length because floating-ui uses that
  // information for list navigation.

  const map = useRefWithInit(createMap<Metadata>).current;
  // `mapTick` uses a counter rather than objects for low precision-loss risk and better memory efficiency
  const [mapTick, setMapTick] = React.useState(0);
  const lastTickRef = React.useRef(mapTick);

  const register = useStableCallback((node: Element, metadata: Metadata) => {
    map.set(node, metadata ?? null);
    lastTickRef.current += 1;
    setMapTick(lastTickRef.current);
  });

  const unregister = useStableCallback((node: Element) => {
    map.delete(node);
    lastTickRef.current += 1;
    setMapTick(lastTickRef.current);
  });

  const sortedMap = React.useMemo(() => {
    // `mapTick` is the `useMemo` trigger as `map` is stable.
    disableEslintWarning(mapTick);

    const newMap = new Map<Element, CompositeMetadata<Metadata>>();
    // Filter out disconnected elements before sorting to avoid inconsistent
    // compareDocumentPosition results when elements are detached from the DOM.
    const sortedNodes = Array.from(map.keys())
      .filter((node) => node.isConnected)
      .sort(sortByDocumentPosition);

    sortedNodes.forEach((node, index) => {
      const metadata = map.get(node) ?? ({} as CompositeMetadata<Metadata>);
      newMap.set(node, { ...metadata, index });
    });

    return newMap;
  }, [map, mapTick]);

  useIsoLayoutEffect(() => {
    if (typeof MutationObserver !== 'function' || sortedMap.size === 0) {
      return undefined;
    }

    const mutationObserver = new MutationObserver((entries) => {
      const diff = new Set<Node>();
      const updateDiff = (node: Node) => (diff.has(node) ? diff.delete(node) : diff.add(node));
      entries.forEach((entry) => {
        entry.removedNodes.forEach(updateDiff);
        entry.addedNodes.forEach(updateDiff);
      });
      if (diff.size === 0) {
        lastTickRef.current += 1;
        setMapTick(lastTickRef.current);
      }
    });

    sortedMap.forEach((_, node) => {
      if (node.parentElement) {
        mutationObserver.observe(node.parentElement, { childList: true });
      }
    });

    return () => {
      mutationObserver.disconnect();
    };
  }, [sortedMap]);

  useIsoLayoutEffect(() => {
    const shouldUpdateLengths = lastTickRef.current === mapTick;
    if (shouldUpdateLengths) {
      if (elementsRef.current.length !== sortedMap.size) {
        elementsRef.current.length = sortedMap.size;
      }
      if (labelsRef && labelsRef.current.length !== sortedMap.size) {
        labelsRef.current.length = sortedMap.size;
      }
      nextIndexRef.current = sortedMap.size;
    }

    onMapChange(sortedMap);
  }, [onMapChange, sortedMap, elementsRef, labelsRef, mapTick]);

  useIsoLayoutEffect(() => {
    return () => {
      elementsRef.current = [];
    };
  }, [elementsRef]);

  useIsoLayoutEffect(() => {
    return () => {
      if (labelsRef) {
        labelsRef.current = [];
      }
    };
  }, [labelsRef]);

  const subscribeMapChange = useStableCallback((fn) => {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  });

  useIsoLayoutEffect(() => {
    listeners.forEach((l) => l(sortedMap));
  }, [listeners, sortedMap]);

  const contextValue = React.useMemo(
    () => ({ register, unregister, subscribeMapChange, elementsRef, labelsRef, nextIndexRef }),
    [register, unregister, subscribeMapChange, elementsRef, labelsRef, nextIndexRef],
  );

  return (
    <CompositeListContext.Provider value={contextValue}>{children}</CompositeListContext.Provider>
  );
}

function createMap<Metadata>() {
  return new Map<Element, CompositeMetadata<Metadata> | null>();
}

function createListeners() {
  return new Set<Function>();
}

function sortByDocumentPosition(a: Element, b: Element) {
  const position = a.compareDocumentPosition(b);

  if (
    position & Node.DOCUMENT_POSITION_FOLLOWING ||
    position & Node.DOCUMENT_POSITION_CONTAINED_BY
  ) {
    return -1;
  }

  if (position & Node.DOCUMENT_POSITION_PRECEDING || position & Node.DOCUMENT_POSITION_CONTAINS) {
    return 1;
  }

  return 0;
}

function disableEslintWarning(_: any) {}

export interface CompositeListState {}

export interface CompositeListProps<Metadata> {
  children: React.ReactNode;
  /**
   * A ref to the list of HTML elements, ordered by their index.
   * `useListNavigation`'s `listRef` prop.
   */
  elementsRef: React.RefObject<Array<HTMLElement | null>>;
  /**
   * A ref to the list of element labels, ordered by their index.
   * `useTypeahead`'s `listRef` prop.
   */
  labelsRef?: React.RefObject<Array<string | null>> | undefined;
  onMapChange?: ((newMap: Map<Element, CompositeMetadata<Metadata> | null>) => void) | undefined;
}

export namespace CompositeList {
  export type State = CompositeListState;
  export type Props<Metadata> = CompositeListProps<Metadata>;
}
