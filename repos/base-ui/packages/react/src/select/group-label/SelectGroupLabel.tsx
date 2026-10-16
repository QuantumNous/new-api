'use client';
import * as React from 'react';
import { useIsoLayoutEffect } from '@base-ui/utils/useIsoLayoutEffect';
import type { BaseUIComponentProps } from '../../internals/types';
import { useBaseUiId } from '../../internals/useBaseUiId';
import { useSelectGroupContext } from '../group/SelectGroupContext';
import { useRenderElement } from '../../internals/useRenderElement';

/**
 * An accessible label that is automatically associated with its parent group.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export const SelectGroupLabel = React.forwardRef(function SelectGroupLabel(
  componentProps: SelectGroupLabel.Props,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  const { render, className, style, id: idProp, ...elementProps } = componentProps;

  const { setLabelId } = useSelectGroupContext();

  const id = useBaseUiId(idProp);

  useIsoLayoutEffect(() => {
    setLabelId(id);
  }, [id, setLabelId]);

  const element = useRenderElement('div', componentProps, {
    ref: forwardedRef,
    props: [{ id }, elementProps],
  });

  return element;
});

export interface SelectGroupLabelState {}

export interface SelectGroupLabelProps extends BaseUIComponentProps<'div', SelectGroupLabelState> {}

export namespace SelectGroupLabel {
  export type State = SelectGroupLabelState;
  export type Props = SelectGroupLabelProps;
}
