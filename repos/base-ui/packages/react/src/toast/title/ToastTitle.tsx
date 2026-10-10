'use client';
import * as React from 'react';
import { useIsoLayoutEffect } from '@base-ui/utils/useIsoLayoutEffect';
import { useId } from '@base-ui/utils/useId';
import type { BaseUIComponentProps } from '../../internals/types';
import { useToastRootContext } from '../root/ToastRootContext';
import { useRenderElement } from '../../internals/useRenderElement';

/**
 * A title that labels the toast.
 * Renders an `<h2>` element.
 *
 * Documentation: [Base UI Toast](https://base-ui.com/react/components/toast)
 */
export const ToastTitle = React.forwardRef(function ToastTitle(
  componentProps: ToastTitle.Props,
  forwardedRef: React.ForwardedRef<HTMLHeadingElement>,
) {
  const {
    render,
    className,
    style,
    id: idProp,
    children: childrenProp,
    ...elementProps
  } = componentProps;

  const { toast, setTitleId } = useToastRootContext();

  const children = childrenProp ?? toast.title;

  const shouldRender = Boolean(children);

  const id = useId(idProp);

  useIsoLayoutEffect(() => {
    if (!shouldRender) {
      return undefined;
    }

    setTitleId(id);

    return () => {
      setTitleId(undefined);
    };
  }, [shouldRender, id, setTitleId]);

  const state: ToastTitleState = {
    type: toast.type,
  };

  const element = useRenderElement('h2', componentProps, {
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

export interface ToastTitleState {
  /**
   * The type of the toast.
   */
  type: string | undefined;
}

export interface ToastTitleProps extends BaseUIComponentProps<'h2', ToastTitleState> {}

export namespace ToastTitle {
  export type State = ToastTitleState;
  export type Props = ToastTitleProps;
}
