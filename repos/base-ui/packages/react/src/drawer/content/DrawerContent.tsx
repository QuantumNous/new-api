'use client';
import * as React from 'react';
import { useDialogRootContext } from '../../dialog/root/DialogRootContext';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { DRAWER_CONTENT_ATTRIBUTE } from './DrawerContentDataAttributes';

/**
 * A container for the drawer contents.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Drawer](https://base-ui.com/react/components/drawer)
 */
export const DrawerContent = React.forwardRef(function DrawerContent(
  componentProps: DrawerContent.Props,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  const { render, className, style, ...elementProps } = componentProps;

  useDialogRootContext();

  return useRenderElement('div', componentProps, {
    ref: forwardedRef,
    props: [{ [DRAWER_CONTENT_ATTRIBUTE as string]: '' }, elementProps],
  });
});

export interface DrawerContentProps extends BaseUIComponentProps<'div', DrawerContentState> {}

export interface DrawerContentState {}

export namespace DrawerContent {
  export type Props = DrawerContentProps;
  export type State = DrawerContentState;
}
