'use client';
import * as React from 'react';
import { EMPTY_OBJECT, EMPTY_ARRAY } from '@base-ui/utils/empty';
import { useRenderElement } from '../../useRenderElement';
import { useCompositeItem } from './useCompositeItem';
import type { BaseUIComponentProps } from '../../types';
import { StateAttributesMapping } from '../../getStateAttributesProps';

/**
 * @internal
 */
export function CompositeItem<Metadata, State extends Record<string, any>>(
  componentProps: CompositeItem.Props<Metadata, State>,
) {
  const {
    render,
    className,
    style,
    state = EMPTY_OBJECT as State,
    props = EMPTY_ARRAY,
    refs = EMPTY_ARRAY,
    metadata,
    stateAttributesMapping,
    tag = 'div',
    ...elementProps
  } = componentProps;

  const { compositeProps, compositeRef } = useCompositeItem({ metadata });

  return useRenderElement(tag, componentProps, {
    state,
    ref: [...refs, compositeRef],
    props: [compositeProps, ...props, elementProps],
    stateAttributesMapping,
  });
}

export interface CompositeItemState {}

export interface CompositeItemProps<Metadata, State extends Record<string, any>> extends Pick<
  BaseUIComponentProps<any, State>,
  'render' | 'className' | 'style'
> {
  children?: React.ReactNode;
  metadata?: Metadata | undefined;
  refs?: React.Ref<HTMLElement | null>[] | undefined;
  props?: Array<Record<string, any> | (() => Record<string, any>)> | undefined;
  state?: State | undefined;
  stateAttributesMapping?: StateAttributesMapping<State> | undefined;
  tag?: keyof React.JSX.IntrinsicElements | undefined;
}

export namespace CompositeItem {
  export type State = CompositeItemState;
  export type Props<Metadata, TState extends Record<string, any>> = CompositeItemProps<
    Metadata,
    TState
  >;
}
