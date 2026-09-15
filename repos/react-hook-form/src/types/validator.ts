import type { EVENTS, INPUT_VALIDATION_RULES } from '../constants';

import type { Message } from './errors';
import type { FieldValues } from './fields';
import type { FormState } from './form';
import type { FieldPath, FieldPathValue } from './path';

export type ValidationValue = boolean | number | string | RegExp;

export type ValidationRule<
  TValidationValue extends ValidationValue = ValidationValue,
> = TValidationValue | ValidationValueMessage<TValidationValue>;

export type ValidationValueMessage<
  TValidationValue extends ValidationValue = ValidationValue,
> = {
  value: TValidationValue;
  message: Message;
};

export type ValidateResult = Message | Message[] | boolean | undefined;

export type FormValidateResult<T> =
  | Partial<
      Record<
        keyof T,
        {
          message: Message | Message[] | boolean | undefined;
          type: string;
        }
      >
    >
  | string
  | boolean;

export type Validate<TFieldValue, TFormValues> = (
  value: TFieldValue,
  formValues: TFormValues,
) => ValidateResult | Promise<ValidateResult>;

export type ValidateFormEventType = (typeof EVENTS)[keyof typeof EVENTS];

export type ValidateForm<
  TFormValues extends FieldValues,
  TFieldName extends FieldPath<TFormValues> = FieldPath<TFormValues>,
> = (props: {
  formValues: TFormValues;
  formState: FormState<TFormValues>;
  eventType?: ValidateFormEventType;
  name?: TFieldName | TFieldName[];
}) =>
  | FormValidateResult<TFormValues>
  | Promise<FormValidateResult<TFormValues>>;

export type RegisterOptions<
  TFieldValues extends FieldValues = FieldValues,
  TFieldName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = Partial<{
  required: Message | ValidationRule<boolean>;
  min: ValidationRule<number | string>;
  max: ValidationRule<number | string>;
  maxLength: ValidationRule<number>;
  minLength: ValidationRule<number>;
  validate:
    | Validate<FieldPathValue<TFieldValues, TFieldName>, TFieldValues>
    | Record<
        string,
        Validate<FieldPathValue<TFieldValues, TFieldName>, TFieldValues>
      >;
  value: FieldPathValue<TFieldValues, TFieldName>;
  setValueAs: (value: any) => any;
  shouldUnregister?: boolean;
  onChange?: (event: any) => void;
  onBlur?: (event: any) => void;
  disabled: boolean;
  deps: FieldPath<TFieldValues> | FieldPath<TFieldValues>[];
}> &
  (
    | {
        pattern?: ValidationRule<RegExp>;
        valueAsNumber?: false;
        valueAsDate?: false;
      }
    | {
        pattern?: undefined;
        valueAsNumber?: false;
        valueAsDate?: true;
      }
    | {
        pattern?: undefined;
        valueAsNumber?: true;
        valueAsDate?: false;
      }
  );

export type InputValidationRules = typeof INPUT_VALIDATION_RULES;

export type MaxType =
  | InputValidationRules['max']
  | InputValidationRules['maxLength'];

export type MinType =
  | InputValidationRules['min']
  | InputValidationRules['minLength'];
