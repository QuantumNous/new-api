'use client';
import * as React from 'react';
import { useDialogRootContext } from '../root/DialogRootContext';
import { useRenderElement } from '../../internals/useRenderElement';
import { useBaseUiId } from '../../internals/useBaseUiId';
import type { BaseUIComponentProps } from '../../internals/types';

/**
 * A paragraph with additional information about the dialog.
 * Renders a `<p>` element.
 *
 * Documentation: [Base UI Dialog](https://base-ui.com/react/components/dialog)
 */
export const DialogDescription = React.forwardRef(function DialogDescription(
  componentProps: DialogDescription.Props,
  forwardedRef: React.ForwardedRef<HTMLParagraphElement>,
) {
  const { render, className, style, id: idProp, ...elementProps } = componentProps;

  const { store } = useDialogRootContext();

  const id = useBaseUiId(idProp);

  store.useSyncedValueWithCleanup('descriptionElementId', id);

  return useRenderElement('p', componentProps, {
    ref: forwardedRef,
    props: [{ id }, elementProps],
  });
});

export interface DialogDescriptionProps extends BaseUIComponentProps<'p', DialogDescriptionState> {}

export interface DialogDescriptionState {}

export namespace DialogDescription {
  export type Props = DialogDescriptionProps;
  export type State = DialogDescriptionState;
}
