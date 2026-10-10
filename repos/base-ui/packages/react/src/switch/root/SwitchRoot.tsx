'use client';
import * as React from 'react';
import { useControlled } from '@base-ui/utils/useControlled';
import { useMergedRefs } from '@base-ui/utils/useMergedRefs';
import { useIsoLayoutEffect } from '@base-ui/utils/useIsoLayoutEffect';
import { visuallyHidden, visuallyHiddenInput } from '@base-ui/utils/visuallyHidden';
import { EMPTY_OBJECT } from '@base-ui/utils/empty';
import { ownerWindow } from '@base-ui/utils/owner';
import { useRenderElement } from '../../internals/useRenderElement';
import type { BaseUIComponentProps, NonNativeButtonProps } from '../../internals/types';
import { mergeProps } from '../../merge-props';
import { useBaseUiId } from '../../internals/useBaseUiId';
import { useButton } from '../../internals/use-button';
import { SwitchRootContext } from './SwitchRootContext';
import { stateAttributesMapping } from '../stateAttributesMapping';
import type { FieldRootState } from '../../field/root/FieldRoot';
import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import { useRegisterFieldControl } from '../../internals/field-register-control/useRegisterFieldControl';
import { useFormContext } from '../../internals/form-context/FormContext';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { useAriaLabelledBy } from '../../internals/labelable-provider/useAriaLabelledBy';
import { useLabelableId } from '../../internals/labelable-provider/useLabelableId';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type { BaseUIChangeEventDetails } from '../../types';
import { useValueChanged } from '../../internals/useValueChanged';

/**
 * Represents the switch itself.
 * Renders a `<span>` element and a hidden `<input>` beside.
 *
 * Documentation: [Base UI Switch](https://base-ui.com/react/components/switch)
 */
export const SwitchRoot = React.forwardRef(function SwitchRoot(
  componentProps: SwitchRoot.Props,
  forwardedRef: React.ForwardedRef<HTMLElement>,
) {
  const {
    checked: checkedProp,
    className,
    defaultChecked,
    'aria-labelledby': ariaLabelledByProp,
    form,
    id: idProp,
    inputRef: externalInputRef,
    name: nameProp,
    nativeButton = false,
    onCheckedChange,
    readOnly = false,
    required = false,
    disabled: disabledProp = false,
    render,
    uncheckedValue,
    value,
    style,
    ...elementProps
  } = componentProps;

  const { clearErrors } = useFormContext();
  const {
    state: fieldState,
    setTouched,
    setDirty,
    validityData,
    setFilled,
    setFocused,
    validationMode,
    disabled: fieldDisabled,
    name: fieldName,
    validation,
  } = useFieldRootContext();
  const { labelId } = useLabelableContext();

  const disabled = fieldDisabled || disabledProp;
  const name = fieldName ?? nameProp;

  const inputRef = React.useRef<HTMLInputElement>(null);
  const handleInputRef = useMergedRefs(inputRef, externalInputRef, validation.inputRef);

  const switchRef = React.useRef<HTMLButtonElement | null>(null);

  const id = useBaseUiId();

  const controlId = useLabelableId({
    id: idProp,
    implicit: false,
    controlRef: switchRef,
  });
  const hiddenInputId = nativeButton ? undefined : controlId;

  const [checked, setCheckedState] = useControlled({
    controlled: checkedProp,
    default: Boolean(defaultChecked),
    name: 'Switch',
    state: 'checked',
  });

  useRegisterFieldControl(switchRef, id, checked, undefined, !disabled, nameProp);

  useIsoLayoutEffect(() => {
    if (inputRef.current) {
      setFilled(inputRef.current.checked);
    }
  }, [inputRef, setFilled]);

  useValueChanged(checked, () => {
    clearErrors(name);
    setDirty(checked !== validityData.initialValue);
    setFilled(checked);

    validation.change(checked);
  });

  const { getButtonProps, buttonRef } = useButton({
    disabled,
    native: nativeButton,
  });
  const ariaLabelledBy = useAriaLabelledBy(
    ariaLabelledByProp,
    labelId,
    inputRef,
    !nativeButton,
    hiddenInputId,
  );

  const rootProps: React.ComponentPropsWithRef<'span'> = {
    id: nativeButton ? controlId : id,
    role: 'switch',
    'aria-checked': checked,
    'aria-readonly': readOnly || undefined,
    'aria-required': required || undefined,
    'aria-labelledby': ariaLabelledBy,
    onFocus() {
      if (!disabled) {
        setFocused(true);
      }
    },
    onBlur() {
      const element = inputRef.current;
      if (!element || disabled) {
        return;
      }

      setTouched(true);
      setFocused(false);

      if (validationMode === 'onBlur') {
        validation.commit(element.checked);
      }
    },
    onClick(event) {
      if (readOnly || disabled) {
        return;
      }

      event.preventDefault();

      const input = inputRef.current;
      if (!input) {
        return;
      }

      input.dispatchEvent(
        new (ownerWindow(input).PointerEvent)('click', {
          bubbles: true,
          shiftKey: event.shiftKey,
          ctrlKey: event.ctrlKey,
          altKey: event.altKey,
          metaKey: event.metaKey,
        }),
      );
    },
  };

  const inputProps: React.ComponentPropsWithRef<'input'> = mergeProps<'input'>(
    {
      checked,
      disabled,
      form,
      id: hiddenInputId,
      name,
      required,
      style: name ? visuallyHiddenInput : visuallyHidden,
      tabIndex: -1,
      type: 'checkbox',
      'aria-hidden': true,
      ref: handleInputRef,
      onChange(event) {
        // Workaround for https://github.com/facebook/react/issues/9023
        if (event.nativeEvent.defaultPrevented) {
          return;
        }

        if (readOnly) {
          event.preventDefault();
          return;
        }

        const nextChecked = event.currentTarget.checked;
        const eventDetails = createChangeEventDetails(REASONS.none, event.nativeEvent);

        onCheckedChange?.(nextChecked, eventDetails);

        if (eventDetails.isCanceled) {
          return;
        }

        setCheckedState(nextChecked);
      },
      onFocus() {
        switchRef.current?.focus();
      },
    },
    (props) => validation.getValidationProps(disabled, props),
    // React <19 sets an empty value if `undefined` is passed explicitly
    // To avoid this, we only set the value if it's defined
    value !== undefined ? { value } : EMPTY_OBJECT,
  );

  const state: SwitchRootState = React.useMemo(
    () => ({
      ...fieldState,
      checked,
      disabled,
      readOnly,
      required,
    }),
    [fieldState, checked, disabled, readOnly, required],
  );

  const element = useRenderElement('span', componentProps, {
    state,
    ref: [forwardedRef, switchRef, buttonRef],
    props: [
      rootProps,
      elementProps,
      getButtonProps,
      (props) => validation.getValidationProps(disabled, props),
    ],
    stateAttributesMapping,
  });

  return (
    <SwitchRootContext.Provider value={state}>
      {element}
      {!checked && name && uncheckedValue !== undefined && (
        <input type="hidden" form={form} name={name} value={uncheckedValue} disabled={disabled} />
      )}
      <input {...inputProps} suppressHydrationWarning />
    </SwitchRootContext.Provider>
  );
});

export interface SwitchRootState extends FieldRootState {
  /**
   * Whether the switch is currently active.
   */
  checked: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the user should be unable to activate or deactivate the switch.
   */
  readOnly: boolean;
  /**
   * Whether the user must activate the switch before submitting a form.
   */
  required: boolean;
}

export interface SwitchRootProps
  extends NonNativeButtonProps, Omit<BaseUIComponentProps<'span', SwitchRootState>, 'onChange'> {
  /**
   * The id of the hidden input element.
   *
   * When `nativeButton` is `true`, the id is applied to the root element.
   */
  id?: string | undefined;
  /**
   * Whether the switch is currently active.
   *
   * To render an uncontrolled switch, use the `defaultChecked` prop instead.
   */
  checked?: boolean | undefined;
  /**
   * Whether the switch is initially active.
   *
   * To render a controlled switch, use the `checked` prop instead.
   * @default false
   */
  defaultChecked?: boolean | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * A ref to access the hidden `<input>` element.
   */
  inputRef?: React.Ref<HTMLInputElement> | undefined;
  /**
   * Identifies the field when a form is submitted.
   */
  name?: string | undefined;
  /**
   * Identifies the form that owns the hidden input.
   * Useful when the switch is rendered outside the form.
   */
  form?: string | undefined;
  /**
   * Event handler called when the switch is activated or deactivated.
   */
  onCheckedChange?:
    | ((checked: boolean, eventDetails: SwitchRoot.ChangeEventDetails) => void)
    | undefined;
  /**
   * Whether the user should be unable to activate or deactivate the switch.
   * @default false
   */
  readOnly?: boolean | undefined;
  /**
   * Whether the user must activate the switch before submitting a form.
   * @default false
   */
  required?: boolean | undefined;
  /**
   * The value submitted with the form when the switch is on.
   * By default, switch submits the "on" value, matching native checkbox behavior.
   */
  value?: string | undefined;
  /**
   * The value submitted with the form when the switch is off.
   * By default, unchecked switches do not submit any value, matching native checkbox behavior.
   */
  uncheckedValue?: string | undefined;
}

export type SwitchRootChangeEventReason = typeof REASONS.none;
export type SwitchRootChangeEventDetails = BaseUIChangeEventDetails<SwitchRoot.ChangeEventReason>;

export namespace SwitchRoot {
  export type State = SwitchRootState;
  export type Props = SwitchRootProps;
  export type ChangeEventReason = SwitchRootChangeEventReason;
  export type ChangeEventDetails = SwitchRootChangeEventDetails;
}
