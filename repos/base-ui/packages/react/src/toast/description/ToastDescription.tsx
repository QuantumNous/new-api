'use client';
import * as React from 'react';
import { useId } from '@base-ui/utils/useId';
import { useIsoLayoutEffect } from '@base-ui/utils/useIsoLayoutEffect';
import type { BaseUIComponentProps } from '../../internals/types';
import { useToastRootContext } from '../root/ToastRootContext';
import { useRenderElement } from '../../internals/useRenderElement';

/**
 * A description that describes the toast.
 * Can be used as the default message for the toast when no title is provided.
 * Renders a `<p>` element.
 *
 * Documentation: [Base UI Toast](https://base-ui.com/react/components/toast)
 */
export const ToastDescription = React.forwardRef(function ToastDescription(
  componentProps: ToastDescription.Props,
  forwardedRef: React.ForwardedRef<HTMLParagraphElement>,
) {
  const {
    render,
    className,
    style,
    id: idProp,
    children: childrenProp,
    ...elementProps
  } = componentProps;

  const { toast, setDescriptionId } = useToastRootContext();

  const children = childrenProp ?? toast.description;

  const shouldRender = Boolean(children);

  const id = useId(idProp);

  useIsoLayoutEffect(() => {
    if (!shouldRender) {
      return undefined;
    }

    setDescriptionId(id);

    return () => {
      setDescriptionId(undefined);
    };
  }, [shouldRender, id, setDescriptionId]);

  const state: ToastDescriptionState = {
    type: toast.type,
  };

  const element = useRenderElement('p', componentProps, {
    ref: forwardedRef,
    state,
    props: {
      ...elementProps,
      id,
      children,
    },
  });

  if (!shouldRender) {
    return null;
  }

  return element;
});

export interface ToastDescriptionState {
  /**
   * The type of the toast.
   */
  type: string | undefined;
}

export interface ToastDescriptionProps extends BaseUIComponentProps<'p', ToastDescriptionState> {}

export namespace ToastDescription {
  export type State = ToastDescriptionState;
  export type Props = ToastDescriptionProps;
}
