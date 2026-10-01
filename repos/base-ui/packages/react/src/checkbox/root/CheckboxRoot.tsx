'use client';
import * as React from 'react';
import { EMPTY_OBJECT } from '@base-ui/utils/empty';
import { useControlled } from '@base-ui/utils/useControlled';
import { useIsoLayoutEffect } from '@base-ui/utils/useIsoLayoutEffect';
import { useMergedRefs } from '@base-ui/utils/useMergedRefs';
import { useRefWithInit } from '@base-ui/utils/useRefWithInit';
import { visuallyHidden, visuallyHiddenInput } from '@base-ui/utils/visuallyHidden';
import { ownerWindow } from '@base-ui/utils/owner';
import { getDefaultFormSubmitter } from '@base-ui/utils/getDefaultFormSubmitter';
import { NOOP } from '../../internals/noop';
import { useStateAttributesMapping } from '../utils/useStateAttributesMapping';
import { useRenderElement } from '../../internals/useRenderElement';
import { useBaseUiId } from '../../internals/useBaseUiId';
import type {
  BaseUIComponentProps,
  BaseUIEvent,
  NonNativeButtonProps,
} from '../../internals/types';
import { mergeProps } from '../../merge-props';
import { useButton } from '../../internals/use-button/useButton';
import type { FieldRootState } from '../../field/root/FieldRoot';
import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import { useRegisterFieldControl } from '../../internals/field-register-control/useRegisterFieldControl';
import { useFieldItemContext } from '../../field/item/FieldItemContext';
import { useFormContext } from '../../internals/form-context/FormContext';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { useAriaLabelledBy } from '../../internals/labelable-provider/useAriaLabelledBy';
import { useCheckboxGroupContext } from '../../checkbox-group/CheckboxGroupContext';
import { CheckboxRootContext } from './CheckboxRootContext';
import {
  BaseUIChangeEventDetails,
  createChangeEventDetails,
} from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { useValueChanged } from '../../internals/useValueChanged';

export const PARENT_CHECKBOX = 'data-parent';

/**
 * Represents the checkbox itself.
 * Renders a `<span>` element and a hidden `<input>` beside.
 *
 * Documentation: [Base UI Checkbox](https://base-ui.com/react/components/checkbox)
 */
export const CheckboxRoot = React.forwardRef(function CheckboxRoot(
  componentProps: CheckboxRoot.Props,
  forwardedRef: React.ForwardedRef<HTMLElement>,
) {
  const {
    checked: checkedProp,
    className,
    defaultChecked = false,
    'aria-labelledby': ariaLabelledByProp,
    disabled: disabledProp = false,
    form,
    id: idProp,
    indeterminate = false,
    inputRef: inputRefProp,
    name: nameProp,
    onCheckedChange,
    parent = false,
    readOnly = false,
    render,
    required = false,
    uncheckedValue,
    value: valueProp,
    nativeButton = false,
    style,
    ...elementProps
  } = componentProps;

  const { clearErrors } = useFormContext();
  const {
    disabled: rootDisabled,
    name: fieldName,
    setDirty,
    setFilled,
    setFocused,
    setTouched,
    state: fieldState,
    validationMode,
    validityData,
    validation: localValidation,
  } = useFieldRootContext();
  const fieldItemContext = useFieldItemContext();
  const { labelId, controlId, registerControlId, getDescriptionProps } = useLabelableContext();

  const groupContext = useCheckboxGroupContext();
  const parentContext = groupContext?.parent;
  const isGroupedWithParent = parentContext && groupContext.allValues;

  const disabled =
    rootDisabled || fieldItemContext.disabled || groupContext?.disabled || disabledProp;
  const name = fieldName ?? nameProp;
  const value = valueProp ?? name;

  const id = useBaseUiId();

  const parentId = useBaseUiId();
  let inputId = controlId;
  if (isGroupedWithParent) {
    inputId = parent ? parentId : `${parentContext.id}-${value}`;
  } else if (idProp) {
    inputId = idProp;
  }

  let groupProps: Partial<Omit<CheckboxRoot.Props, 'className'>> = {};
  if (isGroupedWithParent) {
    if (parent) {
      groupProps = groupContext.parent.getParentProps();
    } else if (value) {
      groupProps = groupContext.parent.getChildProps(value);
    }
  }

  const {
    checked: groupChecked = checkedProp,
    indeterminate: groupIndeterminate = indeterminate,
    onCheckedChange: groupOnChange,
    ...otherGroupProps
  } = groupProps;

  const groupValue = groupContext?.value;
  const setGroupValue = groupContext?.setValue;
  const defaultGroupValue = groupContext?.defaultValue;

  const controlRef = React.useRef<HTMLButtonElement>(null);
  const controlSourceRef = useRefWithInit(() => Symbol('checkbox-control'));
  const hasRegisteredRef = React.useRef(false);

  const { getButtonProps, buttonRef } = useButton({
    disabled,
    native: nativeButton,
  });

  const validation = groupContext?.validation ?? localValidation;

  const [checked, setCheckedState] = useControlled({
    controlled: value && groupValue && !parent ? groupValue.includes(value) : groupChecked,
    default:
      value && defaultGroupValue && !parent ? defaultGroupValue.includes(value) : defaultChecked,
    name: 'Checkbox',
    state: 'checked',
  });

  const computedChecked = isGroupedWithParent ? Boolean(groupChecked) : checked;
  const computedIndeterminate = isGroupedWithParent
    ? groupIndeterminate || indeterminate
    : indeterminate;

  // can't use useLabelableId because of optional groupContext and/or parent
  useIsoLayoutEffect(() => {
    if (registerControlId === NOOP) {
      return undefined;
    }

    hasRegisteredRef.current = true;
    registerControlId(controlSourceRef.current, inputId);

    return undefined;
  }, [inputId, registerControlId, controlSourceRef]);

  React.useEffect(() => {
    const controlSource = controlSourceRef.current;

    return () => {
      if (!hasRegisteredRef.current || registerControlId === NOOP) {
        return;
      }

      hasRegisteredRef.current = false;
      registerControlId(controlSource, undefined);
    };
  }, [registerControlId, controlSourceRef]);

  useRegisterFieldControl(controlRef, id, checked, undefined, !groupContext && !disabled, nameProp);

  const inputRef = React.useRef<HTMLInputElement>(null);
  const mergedInputRef = useMergedRefs(
    inputRefProp,
    inputRef,
    validation.inputRef,
    validation.registerInput,
  );
  const ariaLabelledBy = useAriaLabelledBy(
    ariaLabelledByProp,
    labelId,
    inputRef,
    !nativeButton,
    inputId ?? undefined,
  );

  useIsoLayoutEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = computedIndeterminate;
      if (checked) {
        setFilled(true);
      }
    }
  }, [checked, computedIndeterminate, setFilled]);

  useValueChanged(checked, () => {
    if (groupContext) {
      return;
    }

    clearErrors(name);
    setFilled(checked);
    setDirty(checked !== validityData.initialValue);

    validation.change(checked);
  });

  const inputProps = mergeProps<'input'>(
    {
      checked,
      disabled,
      form,
      // parent checkboxes unset `name` to be excluded from form submission
      name: parent ? undefined : name,
      // Set `id` to stop Chrome warning about an unassociated input.
      // When using a native button, the `id` is applied to the button instead.
      id: nativeButton ? undefined : (inputId ?? undefined),
      required,
      ref: mergedInputRef,
      style: name ? visuallyHiddenInput : visuallyHidden,
      tabIndex: -1,
      type: 'checkbox',
      'aria-hidden': true,
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
        const details = createChangeEventDetails(REASONS.none, event.nativeEvent);

        onCheckedChange?.(nextChecked, details);

        if (details.isCanceled) {
          return;
        }

        groupOnChange?.(nextChecked, details);

        if (details.isCanceled) {
          return;
        }

        setCheckedState(nextChecked);

        if (value && groupValue && setGroupValue && !parent && !isGroupedWithParent) {
          const nextGroupValue = nextChecked
            ? [...groupValue, value]
            : groupValue.filter((item) => item !== value);

          setGroupValue(nextGroupValue, details);
        }
      },
      onFocus() {
        controlRef.current?.focus();
      },
    },
    // React <19 sets an empty value if `undefined` is passed explicitly
    // To avoid this, we only set the value if it's defined
    valueProp !== undefined
      ? { value: (groupContext ? checked && valueProp : valueProp) || '' }
      : EMPTY_OBJECT,
    getDescriptionProps,
    (props) => validation.getValidationProps(disabled, props),
  );

  React.useEffect(() => {
    if (!parentContext || !value) {
      return undefined;
    }

    const disabledStates = parentContext.disabledStatesRef.current;
    disabledStates.set(value, disabled);

    return () => {
      disabledStates.delete(value);
    };
  }, [parentContext, disabled, value]);

  const state: CheckboxRootState = React.useMemo(
    () => ({
      ...fieldState,
      checked: computedChecked,
      disabled,
      readOnly,
      required,
      indeterminate: computedIndeterminate,
    }),
    [fieldState, computedChecked, disabled, readOnly, required, computedIndeterminate],
  );

  const stateAttributesMapping = useStateAttributesMapping(state);

  const element = useRenderElement('span', componentProps, {
    state,
    ref: [buttonRef, controlRef, forwardedRef, groupContext?.registerControlRef],
    props: [
      {
        id: nativeButton ? (inputId ?? undefined) : id,
        role: 'checkbox',
        'aria-checked': computedIndeterminate ? 'mixed' : computedChecked,
        'aria-readonly': readOnly || undefined,
        'aria-required': required || undefined,
        'aria-labelledby': ariaLabelledBy,
        [PARENT_CHECKBOX as string]: parent ? '' : undefined,
        onFocus() {
          if (!disabled) {
            setFocused(true);
          }
        },
        onBlur() {
          const inputEl = inputRef.current;
          if (!inputEl) {
            return;
          }

          setTouched(true);
          setFocused(false);

          if (validationMode === 'onBlur') {
            validation.commit(groupContext ? groupValue : inputEl.checked);
          }
        },
        onKeyDown(event: BaseUIEvent<React.KeyboardEvent>) {
          if (event.key !== 'Enter') {
            return;
          }

          // Let consumer `preventDefault()` handlers opt out while defensively stopping
          // any remaining Base UI Enter handling from treating the checkbox as a button.
          event.preventBaseUIHandler();

          if (event.defaultPrevented) {
            return;
          }

          const formToSubmit = inputRef.current?.form ?? null;
          const currentTarget = event.currentTarget;
          const nativeEvent = event.nativeEvent;
          const originalPreventDefault = event.preventDefault;
          const originalNativePreventDefault = nativeEvent.preventDefault;
          let preventDefaultCalledAfterPropagation = false;

          event.preventDefault = () => {
            preventDefaultCalledAfterPropagation = true;
            originalPreventDefault.call(event);
          };
          nativeEvent.preventDefault = () => {
            preventDefaultCalledAfterPropagation = true;
            originalNativePreventDefault.call(nativeEvent);
          };

          // Enter should not activate/toggle the checkbox. Cancel the native button behavior
          // without setting React's synthetic `defaultPrevented`, so ancestor React handlers
          // can still opt out by calling `preventDefault()` during propagation.
          originalNativePreventDefault.call(nativeEvent);

          ownerWindow(currentTarget).queueMicrotask(() => {
            event.preventDefault = originalPreventDefault;
            nativeEvent.preventDefault = originalNativePreventDefault;

            if (!preventDefaultCalledAfterPropagation) {
              getDefaultFormSubmitter(formToSubmit)?.click();
            }
          });
        },
        onClick(event: React.MouseEvent) {
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
      },
      elementProps,
      otherGroupProps,
      getButtonProps,
      getDescriptionProps,
      (props) => validation.getValidationProps(disabled, props),
    ],
    stateAttributesMapping,
  });

  return (
    <CheckboxRootContext.Provider value={state}>
      {element}
      {!checked && !groupContext && name && !parent && uncheckedValue !== undefined && (
        <input type="hidden" form={form} name={name} value={uncheckedValue} disabled={disabled} />
      )}
      <input {...inputProps} suppressHydrationWarning />
    </CheckboxRootContext.Provider>
  );
});

export interface CheckboxRootState extends FieldRootState {
  /**
   * Whether the checkbox is currently ticked.
   */
  checked: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the user should be unable to tick or untick the checkbox.
   */
  readOnly: boolean;
  /**
   * Whether the user must tick the checkbox before submitting a form.
   */
  required: boolean;
  /**
   * Whether the checkbox is in a mixed state: neither ticked, nor unticked.
   */
  indeterminate: boolean;
}

export interface CheckboxRootProps
  extends
    NonNativeButtonProps,
    Omit<BaseUIComponentProps<'span', CheckboxRootState>, 'onChange' | 'value'> {
  /**
   * The id of the input element.
   */
  id?: string | undefined;
  /**
   * Identifies the field when a form is submitted.
   * @default undefined
   */
  name?: string | undefined;
  /**
   * Identifies the form that owns the hidden input.
   * Useful when the checkbox is rendered outside the form.
   */
  form?: string | undefined;
  /**
   * Whether the checkbox is currently ticked.
   *
   * To render an uncontrolled checkbox, use the `defaultChecked` prop instead.
   * @default undefined
   */
  checked?: boolean | undefined;
  /**
   * Whether the checkbox is initially ticked.
   *
   * To render a controlled checkbox, use the `checked` prop instead.
   * @default false
   */
  defaultChecked?: boolean | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Event handler called when the checkbox is ticked or unticked.
   */
  onCheckedChange?:
    | ((checked: boolean, eventDetails: CheckboxRootChangeEventDetails) => void)
    | undefined;
  /**
   * Whether the user should be unable to tick or untick the checkbox.
   * @default false
   */
  readOnly?: boolean | undefined;
  /**
   * Whether the user must tick the checkbox before submitting a form.
   * @default false
   */
  required?: boolean | undefined;
  /**
   * Whether the checkbox is in a mixed state: neither ticked, nor unticked.
   * @default false
   */
  indeterminate?: boolean | undefined;
  /**
   * A ref to access the hidden `<input>` element.
   */
  inputRef?: React.Ref<HTMLInputElement> | undefined;
  /**
   * Whether the checkbox controls a group of child checkboxes.
   *
   * Must be used in a [Checkbox Group](https://base-ui.com/react/components/checkbox-group).
   * @default false
   */
  parent?: boolean | undefined;
  /**
   * The value submitted with the form when the checkbox is unchecked.
   * By default, unchecked checkboxes do not submit any value, matching native checkbox behavior.
   */
  uncheckedValue?: string | undefined;
  /**
   * The value of the selected checkbox.
   */
  value?: string | undefined;
}

export type CheckboxRootChangeEventReason = typeof REASONS.none;
export type CheckboxRootChangeEventDetails =
  BaseUIChangeEventDetails<CheckboxRoot.ChangeEventReason>;

export namespace CheckboxRoot {
  export type State = CheckboxRootState;
  export type Props = CheckboxRootProps;
  export type ChangeEventReason = CheckboxRootChangeEventReason;
  export type ChangeEventDetails = CheckboxRootChangeEventDetails;
}
