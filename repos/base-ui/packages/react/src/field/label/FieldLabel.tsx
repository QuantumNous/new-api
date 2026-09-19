'use client';
import * as React from 'react';
import { error } from '@base-ui/utils/error';
import { SafeReact } from '@base-ui/utils/safeReact';
import type { FieldRootState } from '../root/FieldRoot';
import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import { fieldValidityMapping } from '../../internals/field-constants/constants';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { useLabel } from '../../internals/labelable-provider/useLabel';
import { useFieldItemContext } from '../item/FieldItemContext';

/**
 * An accessible label that is automatically associated with the field control.
 * Renders a `<label>` element.
 *
 * Documentation: [Base UI Field](https://base-ui.com/react/components/field)
 */
export const FieldLabel = React.forwardRef(function FieldLabel(
  componentProps: FieldLabel.Props,
  forwardedRef: React.ForwardedRef<HTMLElement>,
) {
  const {
    render,
    className,
    style,
    id: idProp,
    nativeLabel = true,
    ...elementProps
  } = componentProps;

  const fieldRootContext = useFieldRootContext(false);
  const fieldItemContext = useFieldItemContext();
  const { labelId } = useLabelableContext();

  const state: FieldLabelState = {
    ...fieldRootContext.state,
    disabled: fieldRootContext.disabled || fieldItemContext.disabled,
  };

  const labelRef = React.useRef<HTMLElement | null>(null);
  const labelProps = useLabel({
    id: labelId ?? idProp,
    native: nativeLabel,
  });

  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    React.useEffect(() => {
      if (!labelRef.current) {
        return;
      }

      const isLabelTag = labelRef.current.tagName === 'LABEL';

      if (nativeLabel) {
        if (!isLabelTag) {
          const ownerStackMessage = SafeReact.captureOwnerStack?.() || '';
          const message =
            '<Field.Label> expected a <label> element because the `nativeLabel` prop is true. ' +
            'Rendering a non-<label> disables native label association, so `htmlFor` will not ' +
            'work. Use a real <label> in the `render` prop, or set `nativeLabel` to `false`.';
          error(`${message}${ownerStackMessage}`);
        }
      } else if (isLabelTag) {
        const ownerStackMessage = SafeReact.captureOwnerStack?.() || '';
        const message =
          '<Field.Label> expected a non-<label> element because the `nativeLabel` prop is false. ' +
          'Rendering a <label> assumes native label behavior while Base UI treats it as ' +
          'non-native, which can cause unexpected pointer behavior. Use a non-<label> in the ' +
          '`render` prop, or set `nativeLabel` to `true`.';
        error(`${message}${ownerStackMessage}`);
      }
    }, [nativeLabel]);
  }

  const element = useRenderElement('label', componentProps, {
    ref: [forwardedRef, labelRef],
    state,
    props: [labelProps, elementProps],
    stateAttributesMapping: fieldValidityMapping,
  });

  return element;
});

export interface FieldLabelState extends FieldRootState {}

export interface FieldLabelProps extends BaseUIComponentProps<'label', FieldLabelState> {
  /**
   * Whether the component renders a native `<label>` element when replacing it via the `render` prop.
   * Set to `false` if the rendered element is not a label (for example, `<div>`).
   *
   * This is useful to avoid inheriting label behaviors on `<button>` controls (such as `<Select.Trigger>` and `<Combobox.Trigger>`), including avoiding `:hover` on the button when hovering the label, and preventing clicks on the label from firing on the button.
   * @default true
   */
  nativeLabel?: boolean | undefined;
}

export namespace FieldLabel {
  export type State = FieldLabelState;
  export type Props = FieldLabelProps;
}
