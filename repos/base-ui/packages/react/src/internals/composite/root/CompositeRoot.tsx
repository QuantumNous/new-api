'use client';
import * as React from 'react';
import { EMPTY_ARRAY, EMPTY_OBJECT } from '@base-ui/utils/empty';
import { CompositeList, type CompositeMetadata } from '../list/CompositeList';
import { useCompositeRoot } from './useCompositeRoot';
import { CompositeRootContext } from './CompositeRootContext';
import { useRenderElement } from '../../useRenderElement';
import type { BaseUIComponentProps, BaseUIEvent } from '../../types';
import type { ModifierKey } from '../composite';
import type { CompositeGridNavigator } from './gridNavigation';
import { useDirection } from '../../direction-context/DirectionContext';
import { StateAttributesMapping } from '../../getStateAttributesProps';

/**
 * @internal
 */
export function CompositeRoot<Metadata extends {}, State extends Record<string, any>>(
  componentProps: CompositeRoot.Props<Metadata, State>,
) {
  const {
    render,
    className,
    style,
    refs = EMPTY_ARRAY as React.Ref<Element>[],
    props = EMPTY_ARRAY,
    state = EMPTY_OBJECT as State,
    stateAttributesMapping,
    highlightedIndex: highlightedIndexProp,
    onHighlightedIndexChange: onHighlightedIndexChangeProp,
    orientation,
    grid,
    loopFocus,
    onLoop,
    enableHomeAndEndKeys,
    onMapChange: onMapChangeProp,
    stopEventPropagation = true,
    rootRef,
    disabledIndices,
    modifierKeys,
    highlightItemOnHover = false,
    tag = 'div',
    ...elementProps
  } = componentProps;

  const direction = useDirection();

  const {
    props: defaultProps,
    highlightedIndex,
    onHighlightedIndexChange,
    elementsRef,
    onMapChange: onMapChangeUnwrapped,
    relayKeyboardEvent,
  } = useCompositeRoot({
    grid,
    loopFocus,
    onLoop,
    orientation,
    highlightedIndex: highlightedIndexProp,
    onHighlightedIndexChange: onHighlightedIndexChangeProp,
    rootRef,
    stopEventPropagation,
    enableHomeAndEndKeys,
    direction,
    disabledIndices,
    modifierKeys,
  });

  const element = useRenderElement(tag, componentProps, {
    state,
    ref: refs,
    props: [defaultProps, ...props, elementProps],
    stateAttributesMapping,
  });

  const contextValue: CompositeRootContext = React.useMemo(
    () => ({
      highlightedIndex,
      onHighlightedIndexChange,
      highlightItemOnHover,
      relayKeyboardEvent,
    }),
    [highlightedIndex, onHighlightedIndexChange, highlightItemOnHover, relayKeyboardEvent],
  );

  return (
    <CompositeRootContext.Provider value={contextValue}>
      <CompositeList<Metadata>
        elementsRef={elementsRef}
        onMapChange={(newMap) => {
          onMapChangeProp?.(newMap);
          onMapChangeUnwrapped(newMap);
        }}
      >
        {element}
      </CompositeList>
    </CompositeRootContext.Provider>
  );
}

export interface CompositeRootState {}

export interface CompositeRootProps<Metadata, State extends Record<string, any>> extends Pick<
  BaseUIComponentProps<'div', State>,
  'render' | 'className' | 'children' | 'style'
> {
  props?: Array<Record<string, any> | (() => Record<string, any>)> | undefined;
  state?: State | undefined;
  stateAttributesMapping?: StateAttributesMapping<State> | undefined;
  refs?: React.Ref<HTMLElement | null>[] | undefined;
  tag?: keyof React.JSX.IntrinsicElements | undefined;
  orientation?: 'horizontal' | 'vertical' | 'both' | undefined;
  grid?: CompositeGridNavigator | undefined;
  loopFocus?: boolean | undefined;
  onLoop?:
    | ((
        event: React.KeyboardEvent,
        prevIndex: number,
        nextIndex: number,
        elementsRef: React.RefObject<Array<HTMLElement | null>>,
      ) => number)
    | undefined;
  highlightedIndex?: number | undefined;
  onHighlightedIndexChange?: ((index: number) => void) | undefined;
  enableHomeAndEndKeys?: boolean | undefined;
  onMapChange?: ((newMap: Map<Node, CompositeMetadata<Metadata> | null>) => void) | undefined;
  onKeyDown?: ((event: BaseUIEvent<React.KeyboardEvent>) => void) | undefined;
  stopEventPropagation?: boolean | undefined;
  rootRef?: React.RefObject<HTMLElement | null> | undefined;
  disabledIndices?: number[] | undefined;
  modifierKeys?: ModifierKey[] | undefined;
  highlightItemOnHover?: boolean | undefined;
}

export namespace CompositeRoot {
  export type State = CompositeRootState;
  export type Props<Metadata, TState extends Record<string, any>> = CompositeRootProps<
    Metadata,
    TState
  >;
}
