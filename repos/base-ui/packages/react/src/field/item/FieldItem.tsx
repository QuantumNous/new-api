'use client';
import * as React from 'react';
import { type FieldRootState } from '../root/FieldRoot';
import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import { fieldValidityMapping } from '../../internals/field-constants/constants';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { FieldItemContext } from './FieldItemContext';
import { LabelableProvider } from '../../internals/labelable-provider';
import { useCheckboxGroupContext } from '../../checkbox-group/CheckboxGroupContext';

/**
 * Groups individual items in a checkbox group or radio group with a label and description.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Field](https://base-ui.com/react/components/field)
 */
export const FieldItem = React.forwardRef(function FieldItem(
  componentProps: FieldItem.Props,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  const {
    render,
    className,
    style,
    disabled: disabledProp = false,
    ...elementProps
  } = componentProps;

  const { state: fieldState, disabled: rootDisabled } = useFieldRootContext(false);

  const disabled = rootDisabled || disabledProp;
  const state: FieldItemState = { ...fieldState, disabled };

  const checkboxGroupContext = useCheckboxGroupContext();
  const hasParentCheckbox = checkboxGroupContext?.allValues !== undefined;
  const controlId = hasParentCheckbox ? checkboxGroupContext?.parent.id : undefined;

  const fieldItemContext: FieldItemContext = React.useMemo(() => ({ disabled }), [disabled]);

  const element = useRenderElement('div', componentProps, {
    ref: forwardedRef,
    state,
    props: elementProps,
    stateAttributesMapping: fieldValidityMapping,
  });

  return (
    <LabelableProvider controlId={controlId}>
      <FieldItemContext.Provider value={fieldItemContext}>{element}</FieldItemContext.Provider>
    </LabelableProvider>
  );
});

export interface FieldItemState extends FieldRootState {}

export interface FieldItemProps extends BaseUIComponentProps<'div', FieldItemState> {
  /**
   * Whether the wrapped control should ignore user interaction.
   * The `disabled` prop on `<Field.Root>` takes precedence over this.
   * @default false
   */
  disabled?: boolean | undefined;
}

export namespace FieldItem {
  export type State = FieldItemState;
  export type Props = FieldItemProps;
}
