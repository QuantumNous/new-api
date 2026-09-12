'use client';
import * as React from 'react';
import { useIsoLayoutEffect } from '@base-ui/utils/useIsoLayoutEffect';
import { type FieldRootState } from '../root/FieldRoot';
import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { fieldValidityMapping } from '../../internals/field-constants/constants';
import type { BaseUIComponentProps } from '../../internals/types';
import { useBaseUiId } from '../../internals/useBaseUiId';
import { useRenderElement } from '../../internals/useRenderElement';
import { useFieldItemContext } from '../item/FieldItemContext';

/**
 * A paragraph with additional information about the field.
 * Renders a `<p>` element.
 *
 * Documentation: [Base UI Field](https://base-ui.com/react/components/field)
 */
export const FieldDescription = React.forwardRef(function FieldDescription(
  componentProps: FieldDescription.Props,
  forwardedRef: React.ForwardedRef<HTMLParagraphElement>,
) {
  const { render, id: idProp, className, style, ...elementProps } = componentProps;

  const id = useBaseUiId(idProp);

  const fieldRootContext = useFieldRootContext(false);
  const fieldItemContext = useFieldItemContext();
  const { setMessageIds } = useLabelableContext();

  const state: FieldDescriptionState = {
    ...fieldRootContext.state,
    disabled: fieldRootContext.disabled || fieldItemContext.disabled,
  };

  useIsoLayoutEffect(() => {
    if (!id) {
      return undefined;
    }

    setMessageIds((v) => v.concat(id));

    return () => {
      setMessageIds((v) => v.filter((item) => item !== id));
    };
  }, [id, setMessageIds]);

  const element = useRenderElement('p', componentProps, {
    ref: forwardedRef,
    state,
    props: [{ id }, elementProps],
    stateAttributesMapping: fieldValidityMapping,
  });

  return element;
});

export interface FieldDescriptionState extends FieldRootState {}

export interface FieldDescriptionProps extends BaseUIComponentProps<'p', FieldDescriptionState> {}

export namespace FieldDescription {
  export type State = FieldDescriptionState;
  export type Props = FieldDescriptionProps;
}
