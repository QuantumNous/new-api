'use client';
import * as React from 'react';
import { useStableCallback } from '@base-ui/utils/useStableCallback';
import { EMPTY_OBJECT } from '@base-ui/utils/empty';
import {
  createGenericEventDetails,
  type BaseUIGenericEventDetails,
} from '../internals/createBaseUIEventDetails';
import { REASONS } from '../internals/reasons';
import type { BaseUIComponentProps } from '../internals/types';
import { FormContext } from '../internals/form-context/FormContext';
import { useRenderElement } from '../internals/useRenderElement';
import { useValueChanged } from '../internals/useValueChanged';

/**
 * A native form element with consolidated error handling.
 * Renders a `<form>` element.
 *
 * Documentation: [Base UI Form](https://base-ui.com/react/components/form)
 */
export const Form = React.forwardRef(function Form<
  FormValues extends Record<string, any> = Record<string, any>,
>(componentProps: Form.Props<FormValues>, forwardedRef: React.ForwardedRef<HTMLFormElement>) {
  const {
    render,
    className,
    validationMode = 'onSubmit',
    errors: externalErrors,
    onSubmit,
    onFormSubmit,
    actionsRef,
    style,
    ...elementProps
  } = componentProps;

  const formRef = React.useRef<FormContext['formRef']['current']>({
    fields: new Map(),
  });
  const submittedRef = React.useRef(false);
  const submitAttemptedRef = React.useRef(false);

  const focusControl = useStableCallback((control: HTMLElement | null) => {
    if (!control) {
      return;
    }
    control.focus();
    if (control.tagName === 'INPUT') {
      (control as HTMLInputElement).select();
    }
  });

  const [errors, setErrors] = React.useState(externalErrors);

  useValueChanged(externalErrors, () => {
    setErrors(externalErrors);
  });

  React.useEffect(() => {
    if (!submittedRef.current) {
      return;
    }

    submittedRef.current = false;

    const invalidFields = Array.from(formRef.current.fields.values()).filter(
      (field) => field.validityData.state.valid === false,
    );

    if (invalidFields.length) {
      focusControl(invalidFields[0].controlRef.current);
    }
  }, [errors, focusControl]);

  const handleImperativeValidate = React.useCallback((fieldName?: string | undefined) => {
    const values = Array.from(formRef.current.fields.values());

    if (fieldName) {
      const namedField = values.find((field) => field.name === fieldName);
      if (namedField) {
        namedField.validate();
      }
    } else {
      values.forEach((field) => {
        field.validate();
      });
    }
  }, []);

  React.useImperativeHandle(actionsRef, () => ({ validate: handleImperativeValidate }), [
    handleImperativeValidate,
  ]);

  const element = useRenderElement('form', componentProps, {
    ref: forwardedRef,
    props: [
      {
        noValidate: true,
        onSubmit(event) {
          submitAttemptedRef.current = true;

          let values = Array.from(formRef.current.fields.values());

          // Async validation isn't supported to stop the submit event.
          values.forEach((field) => {
            field.validate();
          });

          values = Array.from(formRef.current.fields.values());

          const invalidField = values.find((field) => field.validityData.state.valid === false);

          if (invalidField) {
            event.preventDefault();
            focusControl(invalidField.controlRef.current);
          } else {
            submittedRef.current = true;
            onSubmit?.(event as any);

            if (onFormSubmit) {
              event.preventDefault();

              const formValues = values.reduce((acc, field) => {
                if (field.name) {
                  (acc as Record<string, any>)[field.name] = field.getValue();
                }
                return acc;
              }, {} as FormValues);

              onFormSubmit(formValues, createGenericEventDetails(REASONS.none, event.nativeEvent));
            }
          }
        },
      },
      elementProps,
    ],
  });

  const clearErrors = useStableCallback((name: string | undefined) => {
    if (name && errors && EMPTY_OBJECT.hasOwnProperty.call(errors, name)) {
      const nextErrors = { ...errors };
      delete nextErrors[name];
      setErrors(nextErrors);
    }
  });

  const contextValue: FormContext = React.useMemo(
    () => ({
      formRef,
      validationMode,
      errors: errors ?? EMPTY_OBJECT,
      clearErrors,
      submitAttemptedRef,
    }),
    [formRef, validationMode, errors, clearErrors],
  );

  return <FormContext.Provider value={contextValue}>{element}</FormContext.Provider>;
}) as {
  <FormValues extends Record<string, any> = Record<string, any>>(
    props: Form.Props<FormValues> & {
      ref?: React.Ref<HTMLFormElement> | undefined;
    },
  ): React.JSX.Element;
};

export type FormSubmitEventReason = typeof REASONS.none;
export type FormSubmitEventDetails = BaseUIGenericEventDetails<Form.SubmitEventReason>;

export type FormValidationMode = 'onSubmit' | 'onBlur' | 'onChange';

export interface FormActions {
  validate: (fieldName?: string | undefined) => void;
}

export interface FormState {}

export interface FormProps<
  FormValues extends Record<string, any> = Record<string, any>,
> extends BaseUIComponentProps<'form', FormState> {
  /**
   * Determines when the form should be validated.
   * The `validationMode` prop on `<Field.Root>` takes precedence over this.
   *
   * - `onSubmit` (default): validates the field when the form is submitted, afterwards fields will re-validate on change.
   * - `onBlur`: validates a field when it loses focus.
   * - `onChange`: validates the field on every change to its value.
   *
   * @default 'onSubmit'
   */
  validationMode?: FormValidationMode | undefined;
  /**
   * Validation errors returned externally, typically after submission by a server or a form action.
   * This should be an object where keys correspond to the `name` attribute on `<Field.Root>`,
   * and values correspond to error(s) related to that field.
   */
  errors?: FormContext['errors'] | undefined;
  /**
   * Event handler called when the form is submitted.
   * `preventDefault()` is called on the native submit event when used.
   */
  onFormSubmit?:
    | ((formValues: FormValues, eventDetails: Form.SubmitEventDetails) => void)
    | undefined;
  /**
   * A ref to imperative actions.
   * - `validate`: Validates all fields when called. Optionally pass a field name to validate a single field.
   * @example
   * ```tsx
   * // validate all fields
   * actionsRef.current?.validate();
   *
   * // validate one field
   * actionsRef.current?.validate('email');
   * ```
   */
  actionsRef?: React.RefObject<Form.Actions | null> | undefined;
}

export namespace Form {
  export type Props<FormValues extends Record<string, any> = Record<string, any>> =
    FormProps<FormValues>;
  export type State = FormState;
  export type Actions = FormActions;
  export type ValidationMode = FormValidationMode;
  export type SubmitEventReason = FormSubmitEventReason;
  export type SubmitEventDetails = FormSubmitEventDetails;

  export type Values<FormValues extends Record<string, any> = Record<string, any>> = FormValues;
}
