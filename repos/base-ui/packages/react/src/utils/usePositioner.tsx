'use client';
import { popupStateMapping } from './popupStateMapping';
import {
  useRenderElement,
  type UseRenderElementComponentProps,
} from '../internals/useRenderElement';
import { getDisabledMountTransitionStyles } from './getDisabledMountTransitionStyles';
import type { TransitionStatus } from '../internals/useTransitionStatus';

interface UsePositionerOptions {
  styles: React.CSSProperties;
  transitionStatus: TransitionStatus;
  props?: React.ComponentProps<'div'> | undefined;
  refs?: React.Ref<HTMLDivElement> | (React.Ref<HTMLDivElement> | undefined)[] | undefined;
  hidden?: boolean | undefined;
  inert?: boolean | undefined;
}

/**
 * Renders the shared outer Positioner element used by popup components.
 * Applies the common role, hidden state, transition styles, state attributes, and optional inert styling.
 */
export function usePositioner<State extends Record<string, any>>(
  componentProps: UseRenderElementComponentProps<State>,
  state: State,
  { styles, transitionStatus, props, refs, hidden, inert = false }: UsePositionerOptions,
) {
  const style: React.CSSProperties = { ...styles };

  if (inert) {
    style.pointerEvents = 'none';
  }

  return useRenderElement('div', componentProps, {
    state,
    ref: refs,
    props: [
      { role: 'presentation', hidden, style },
      getDisabledMountTransitionStyles(transitionStatus),
      props,
    ],
    stateAttributesMapping: popupStateMapping,
  });
}
