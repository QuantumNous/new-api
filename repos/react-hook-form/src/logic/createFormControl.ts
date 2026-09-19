import {
  EVENTS,
  INPUT_VALIDATION_RULES,
  ROOT_ERROR_TYPE,
  VALIDATION_MODE,
} from '../constants';
import type {
  BatchFieldArrayUpdate,
  ChangeHandler,
  Control,
  DeepPartial,
  DelayCallback,
  EventType,
  Field,
  FieldError,
  FieldErrors,
  FieldNamesMarkedBoolean,
  FieldPath,
  FieldPathValue,
  FieldRefs,
  FieldValues,
  FormState,
  FromSubscribe,
  GetIsDirty,
  GetValuesConfig,
  InternalFieldName,
  Names,
  Path,
  ReadFormState,
  Ref,
  SetFieldValue,
  SetValueConfig,
  Subjects,
  TriggerConfig,
  UseFormClearErrors,
  UseFormGetFieldState,
  UseFormGetValues,
  UseFormHandleSubmit,
  UseFormProps,
  UseFormRegister,
  UseFormReset,
  UseFormResetDefaultValues,
  UseFormResetField,
  UseFormReturn,
  UseFormSetError,
  UseFormSetFocus,
  UseFormSetValue,
  UseFormSetValues,
  UseFormSubscribe,
  UseFormTrigger,
  UseFormUnregister,
  UseFormWatch,
  ValidateFormEventType,
  WatchInternal,
  WatchObserver,
} from '../types';
import cloneObject from '../utils/cloneObject';
import compact from '../utils/compact';
import convertToArrayPayload from '../utils/convertToArrayPayload';
import createSubject from '../utils/createSubject';
import deepEqual from '../utils/deepEqual';
import extractFormValues from '../utils/extractFormValues';
import { flatten } from '../utils/flatten';
import get from '../utils/get';
import isBoolean from '../utils/isBoolean';
import isCheckBoxInput from '../utils/isCheckBoxInput';
import isDateObject from '../utils/isDateObject';
import isEmptyObject from '../utils/isEmptyObject';
import isFileInput from '../utils/isFileInput';
import isFunction from '../utils/isFunction';
import isHTMLElement from '../utils/isHTMLElement';
import isKey from '../utils/isKey';
import isMultipleSelect from '../utils/isMultipleSelect';
import isNullOrUndefined from '../utils/isNullOrUndefined';
import isObject from '../utils/isObject';
import isRadioOrCheckbox from '../utils/isRadioOrCheckbox';
import isString from '../utils/isString';
import isUndefined from '../utils/isUndefined';
import isWeb from '../utils/isWeb';
import live from '../utils/live';
import set from '../utils/set';
import stringToPath from '../utils/stringToPath';
import unset from '../utils/unset';

import generateWatchOutput from './generateWatchOutput';
import getDirtyFields from './getDirtyFields';
import getEventValue from './getEventValue';
import getFieldValue from './getFieldValue';
import getFieldValueAs from './getFieldValueAs';
import getResolverOptions from './getResolverOptions';
import getRuleValue from './getRuleValue';
import getValidationModes from './getValidationModes';
import hasPromiseValidation from './hasPromiseValidation';
import hasValidation from './hasValidation';
import isNameInFieldArray from './isNameInFieldArray';
import isWatched from './isWatched';
import iterateFieldsByAction from './iterateFieldsByAction';
import schemaErrorLookup from './schemaErrorLookup';
import shouldRenderFormState from './shouldRenderFormState';
import shouldSubscribeByName from './shouldSubscribeByName';
import skipValidation from './skipValidation';
import unsetEmptyArray from './unsetEmptyArray';
import updateFieldArrayRootError from './updateFieldArrayRootError';
import validateField from './validateField';

const defaultOptions = {
  mode: VALIDATION_MODE.onSubmit,
  reValidateMode: VALIDATION_MODE.onChange,
  shouldFocusError: true,
} as const;

const FORM_ERROR_TYPE = 'form';

export const DEFAULT_FORM_STATE = {
  submitCount: 0,
  isDirty: false,
  isReady: false,
  isValidating: false,
  isSubmitted: false,
  isSubmitting: false,
  isSubmitSuccessful: false,
  isValid: false,
  touchedFields: {},
  dirtyFields: {},
  validatingFields: {},
};

export function createFormControl<
  TFieldValues extends FieldValues = FieldValues,
  TContext = any,
  TTransformedValues = TFieldValues,
>(
  props: UseFormProps<TFieldValues, TContext, TTransformedValues> = {},
): Omit<
  UseFormReturn<TFieldValues, TContext, TTransformedValues>,
  'formState'
> & {
  formControl: Omit<
    UseFormReturn<TFieldValues, TContext, TTransformedValues>,
    'formState'
  >;
} {
  let _options = {
    ...defaultOptions,
    ...props,
  };
  let _formState: FormState<TFieldValues> & {
    values?: TFieldValues;
    name?: string;
    type?: EventType;
  } = {
    ...cloneObject(DEFAULT_FORM_STATE),
    isLoading: isFunction(_options.defaultValues),
    errors: _options.errors || {},
    disabled: _options.disabled || false,
  };
  let _fields: FieldRefs = {};
  let _defaultValues =
    isObject(_options.defaultValues) || isObject(_options.values)
      ? cloneObject(_options.defaultValues || _options.values) || {}
      : {};
  let _formValues = _options.shouldUnregister
    ? ({} as TFieldValues)
    : (cloneObject(_defaultValues) as TFieldValues);
  let _state = {
    action: false,
    mount: false,
    watch: false,
    keepIsValid: false,
  };
  let _names: Names = {
    mount: new Set(),
    disabled: new Set(),
    unMount: new Set(),
    array: new Set(),
    watch: new Set(),
    registerName: new Set(),
  };
  const delayErrorCallbacks: Partial<Record<InternalFieldName, DelayCallback>> =
    {};
  const timers: Partial<Record<InternalFieldName, number>> = {};
  let _valuesSubscriberCount = 0;
  let _validationModeBeforeSubmit = getValidationModes(_options.mode);
  let _validationModeAfterSubmit = getValidationModes(_options.reValidateMode);
  const defaultProxyFormState: ReadFormState = {
    isDirty: false,
    dirtyFields: false,
    validatingFields: false,
    touchedFields: false,
    isValidating: false,
    isValid: false,
    errors: false,
  };
  const _proxyFormState: ReadFormState = {
    ...defaultProxyFormState,
  };
  let _proxySubscribeFormState = {
    ..._proxyFormState,
  };
  const _subjects: Subjects<TFieldValues> = {
    array: createSubject(),
    state: createSubject(),
  };

  let _setValidCallId = 0;

  const shouldDisplayAllAssociatedErrors =
    _options.criteriaMode === VALIDATION_MODE.all;

  const debounce =
    <T extends Function>(name: InternalFieldName, callback: T) =>
    (wait: number) => {
      clearTimeout(timers[name]);
      timers[name] = setTimeout(callback, wait);
    };

  const _setValid = async (shouldUpdateValid?: boolean) => {
    if (_state.keepIsValid) {
      return;
    }
    if (
      !_options.disabled &&
      (_proxyFormState.isValid ||
        _proxySubscribeFormState.isValid ||
        shouldUpdateValid)
    ) {
      const callId = ++_setValidCallId;
      let isValid: boolean;
      if (_options.resolver) {
        isValid = isEmptyObject((await _runSchema()).errors);
        callId === _setValidCallId && _updateIsValidating();
      } else {
        isValid = await executeBuiltInValidation({
          fields: _fields,
          onlyCheckValid: true,
          eventType: EVENTS.VALID,
        });
      }
      if (callId === _setValidCallId && isValid !== _formState.isValid) {
        _subjects.state.next({
          isValid,
        });
      }
    }
  };

  const _updateIsValidating = (names?: string[], isValidating?: boolean) => {
    if (
      !_options.disabled &&
      (_proxyFormState.isValidating ||
        _proxyFormState.validatingFields ||
        _proxySubscribeFormState.isValidating ||
        _proxySubscribeFormState.validatingFields)
    ) {
      (names || Array.from(_names.mount)).forEach((name) => {
        if (name) {
          isValidating
            ? set(_formState.validatingFields, name, isValidating)
            : unset(_formState.validatingFields, name);
        }
      });

      _subjects.state.next({
        validatingFields: _formState.validatingFields,
        isValidating: !isEmptyObject(_formState.validatingFields),
      });
    }
  };

  const _updateDirtyFields = () => {
    _formState.dirtyFields = getDirtyFields(
      _defaultValues,
      _formValues,
      undefined,
      _fields,
    );
  };

  const _setFieldArray: BatchFieldArrayUpdate = (
    name,
    values = [],
    method,
    args,
    shouldSetValues = true,
    shouldUpdateFieldsAndState = true,
  ) => {
    if (args && method && !_options.disabled) {
      _state.action = true;
      if (shouldUpdateFieldsAndState && Array.isArray(get(_fields, name))) {
        const fieldValues = method(get(_fields, name), args.argA, args.argB);
        shouldSetValues && set(_fields, name, fieldValues);
      }

      if (
        shouldUpdateFieldsAndState &&
        Array.isArray(get(_formState.errors, name))
      ) {
        const errors = method(
          get(_formState.errors, name),
          args.argA,
          args.argB,
        );
        shouldSetValues && set(_formState.errors, name, errors);
        unsetEmptyArray(_formState.errors, name);
      }

      if (
        (_proxyFormState.touchedFields ||
          _proxySubscribeFormState.touchedFields) &&
        shouldUpdateFieldsAndState &&
        Array.isArray(get(_formState.touchedFields, name))
      ) {
        const touchedFields = method(
          get(_formState.touchedFields, name),
          args.argA,
          args.argB,
        );
        shouldSetValues && set(_formState.touchedFields, name, touchedFields);
      }

      if (_proxyFormState.dirtyFields || _proxySubscribeFormState.dirtyFields) {
        _updateDirtyFields();
      }

      _subjects.state.next({
        name,
        isDirty: _getDirty(name, values),
        dirtyFields: _formState.dirtyFields,
        errors: _formState.errors,
        isValid: _formState.isValid,
      });
    } else {
      set(_formValues, name, values);
    }
  };

  const updateErrors = (name: InternalFieldName, error: FieldError) => {
    set(_formState.errors, name, error);
    _formState.errors = { ..._formState.errors };
    _subjects.state.next({
      errors: _formState.errors,
    });
  };

  const _setErrors = (errors: FieldErrors<TFieldValues>) => {
    _formState.errors = errors;
    _subjects.state.next({
      errors: _formState.errors,
      isValid: false,
    });
  };

  const hasExplicitNullIntermediate = (name: InternalFieldName) => {
    const segments = isKey(name) ? [name] : stringToPath(name);
    let formValues = _formValues;
    let defaultValues = _defaultValues;

    for (let i = 0; i < segments.length - 1; i++) {
      const key = segments[i];

      formValues = isNullOrUndefined(formValues) ? formValues : formValues[key];

      defaultValues = isNullOrUndefined(defaultValues)
        ? defaultValues
        : defaultValues[key as keyof typeof defaultValues];

      if (formValues === null && defaultValues !== null) {
        return true;
      }
    }

    return false;
  };

  const updateValidAndValue = (
    name: InternalFieldName,
    shouldSkipSetValueAs: boolean,
    value?: unknown,
    ref?: Ref,
  ) => {
    const field: Field = get(_fields, name);

    if (field) {
      if (hasExplicitNullIntermediate(name)) {
        return;
      }

      const wasUnsetInFormValues = isUndefined(get(_formValues, name));
      const defaultValue = get(
        _formValues,
        name,
        isUndefined(value) ? get(_defaultValues, name) : value,
      );

      isUndefined(defaultValue) ||
      (ref && (ref as HTMLInputElement).defaultChecked) ||
      shouldSkipSetValueAs
        ? set(
            _formValues,
            name,
            shouldSkipSetValueAs ? defaultValue : getFieldValue(field._f),
          )
        : setFieldValue(name, defaultValue);

      if (_state.mount && !_state.action) {
        _setValid();

        if (
          wasUnsetInFormValues &&
          _formState.isDirty &&
          (_proxyFormState.isDirty || _proxySubscribeFormState.isDirty)
        ) {
          const isDirty = _getDirty();
          if (!isDirty) {
            _formState.isDirty = false;
            _subjects.state.next({ ..._formState });
          }
        }

        if (
          props.shouldUnregister &&
          wasUnsetInFormValues &&
          !isUndefined(get(_formValues, name)) &&
          isWatched(name, _names)
        ) {
          _state.watch = true;
        }
      }
    }
  };

  const updateTouchAndDirty = (
    name: InternalFieldName,
    fieldValue: unknown,
    isBlurEvent?: boolean,
    shouldDirty?: boolean,
    shouldRender?: boolean,
  ): Partial<
    Pick<FormState<TFieldValues>, 'dirtyFields' | 'isDirty' | 'touchedFields'>
  > => {
    let shouldUpdateField = false;
    let isPreviousDirty = false;
    const output: Partial<FormState<TFieldValues>> & { name: string } = {
      name,
    };

    // an explicit programmatic update (e.g. setValue with shouldDirty: true)
    // opts into dirty tracking even when the form is disabled
    if (!_options.disabled || shouldDirty === true) {
      if (!isBlurEvent || shouldDirty) {
        const isCurrentFieldPristine = deepEqual(
          get(_defaultValues, name),
          fieldValue,
        );

        if (_proxyFormState.isDirty || _proxySubscribeFormState.isDirty) {
          isPreviousDirty = _formState.isDirty;

          _formState.isDirty = output.isDirty =
            !isCurrentFieldPristine || _getDirty();
          shouldUpdateField = isPreviousDirty !== output.isDirty;
        }

        isPreviousDirty = !!get(_formState.dirtyFields, name);

        if (isCurrentFieldPristine !== _formState.isDirty) {
          _formState.dirtyFields = getDirtyFields(
            _defaultValues,
            _formValues,
            undefined,
            _fields,
          );
        } else {
          isCurrentFieldPristine
            ? unset(_formState.dirtyFields, name)
            : set(_formState.dirtyFields, name, true);
        }

        output.dirtyFields = _formState.dirtyFields;
        shouldUpdateField =
          shouldUpdateField ||
          ((_proxyFormState.dirtyFields ||
            _proxySubscribeFormState.dirtyFields) &&
            isPreviousDirty !== !isCurrentFieldPristine);
      }

      if (isBlurEvent) {
        const isPreviousFieldTouched = get(_formState.touchedFields, name);

        if (!isPreviousFieldTouched) {
          set(_formState.touchedFields, name, isBlurEvent);
          output.touchedFields = _formState.touchedFields;
          shouldUpdateField =
            shouldUpdateField ||
            ((_proxyFormState.touchedFields ||
              _proxySubscribeFormState.touchedFields) &&
              isPreviousFieldTouched !== isBlurEvent);
        }
      }

      shouldUpdateField && shouldRender && _subjects.state.next(output);
    }

    return shouldUpdateField ? output : {};
  };

  const shouldRenderByError = (
    name: InternalFieldName,
    isValid?: boolean,
    error?: FieldError,
    fieldState?: {
      dirty?: FieldNamesMarkedBoolean<TFieldValues>;
      isDirty?: boolean;
      touched?: FieldNamesMarkedBoolean<TFieldValues>;
    },
  ) => {
    const previousFieldError = get(_formState.errors, name);
    const shouldUpdateValid =
      (_proxyFormState.isValid || _proxySubscribeFormState.isValid) &&
      isBoolean(isValid) &&
      _formState.isValid !== isValid;

    if (_options.delayError && error) {
      delayErrorCallbacks[name] = debounce(name, () =>
        updateErrors(name, error),
      );
      delayErrorCallbacks[name](_options.delayError);
    } else {
      clearTimeout(timers[name]);
      delete delayErrorCallbacks[name];
      error
        ? set(_formState.errors, name, error)
        : unset(_formState.errors, name);
      _formState.errors = { ..._formState.errors };
    }

    if (
      (error ? !deepEqual(previousFieldError, error) : previousFieldError) ||
      !isEmptyObject(fieldState) ||
      shouldUpdateValid
    ) {
      const updatedFormState = {
        ...fieldState,
        ...(shouldUpdateValid && isBoolean(isValid) ? { isValid } : {}),
        errors: _formState.errors,
        name,
      };

      _formState = {
        ..._formState,
        ...updatedFormState,
      };

      _subjects.state.next(updatedFormState);
    }
  };

  const _runSchema = async (name?: InternalFieldName[]) => {
    _updateIsValidating(name, true);
    return await _options.resolver!(
      _formValues as TFieldValues,
      _options.context,
      getResolverOptions(
        name || _names.mount,
        _fields,
        _options.criteriaMode,
        _options.shouldUseNativeValidation,
      ),
    );
  };

  const executeSchemaAndUpdateState = async (names?: InternalFieldName[]) => {
    const { errors } = await _runSchema(names);
    _updateIsValidating(names);

    if (names) {
      for (const name of names) {
        const error = get(errors, name);
        error
          ? _names.array.has(name) &&
            isObject(error) &&
            !Object.keys(error).some((key) => !Number.isNaN(Number(key)))
            ? updateFieldArrayRootError(
                _formState.errors,
                { [name]: error } as Partial<Record<string, FieldError>>,
                name,
              )
            : set(_formState.errors, name, error)
          : unset(_formState.errors, name);
      }
      _formState.errors = { ..._formState.errors };
    } else {
      _formState.errors = errors;
    }

    return errors;
  };

  const validateForm = async ({
    name,
    eventType,
  }: {
    name: FieldPath<TFieldValues> | FieldPath<TFieldValues>[] | undefined;
    eventType: ValidateFormEventType;
  }) => {
    if (props.validate) {
      const result = await props.validate({
        formValues: _formValues,
        formState: _formState,
        name,
        eventType,
      });

      if (isObject(result)) {
        for (const key in result) {
          const error = result[key];

          if (error) {
            setError(`${FORM_ERROR_TYPE}.${key}`, {
              message: isString(error.message) ? error.message : '',
              type: error.type || INPUT_VALIDATION_RULES.validate,
            });
          }
        }
      } else if (isString(result) || !result) {
        setError(FORM_ERROR_TYPE, {
          message: result || '',
          type: INPUT_VALIDATION_RULES.validate,
        });
      } else {
        clearErrors(FORM_ERROR_TYPE);
      }

      return result;
    }

    return true;
  };

  const executeBuiltInValidation = async ({
    fields,
    onlyCheckValid,
    name,
    eventType,
    context = {
      valid: true,
      runRootValidation: false,
    },
  }: {
    fields: FieldRefs;
    onlyCheckValid?: boolean;
    name?: FieldPath<TFieldValues> | FieldPath<TFieldValues>[];
    eventType: ValidateFormEventType;
    context?: {
      valid: boolean;
      runRootValidation?: boolean;
    };
  }) => {
    if (props.validate) {
      context.runRootValidation = true;
      const result = await validateForm({
        name,
        eventType,
      });

      if (!result) {
        context.valid = false;

        if (onlyCheckValid) {
          return context.valid;
        }
      }
    }

    for (const name in fields) {
      const field = fields[name];

      if (field) {
        const { _f, ...fieldValue } = field as Field;

        if (_f) {
          const isFieldArrayRoot = _names.array.has(_f.name);
          const isPromiseFunction =
            field._f && hasPromiseValidation((field as Field)._f);
          const shouldTrackIsValidatingState =
            _proxyFormState.validatingFields ||
            _proxyFormState.isValidating ||
            _proxySubscribeFormState.validatingFields ||
            _proxySubscribeFormState.isValidating;

          if (isPromiseFunction && shouldTrackIsValidatingState) {
            _updateIsValidating([_f.name], true);
          }

          const fieldError = await validateField(
            field as Field,
            _names.disabled,
            _formValues,
            shouldDisplayAllAssociatedErrors,
            _options.shouldUseNativeValidation && !onlyCheckValid,
            isFieldArrayRoot,
          );

          if (isPromiseFunction && shouldTrackIsValidatingState) {
            _updateIsValidating([_f.name]);
          }

          if (fieldError[_f.name]) {
            context.valid = false;

            if (onlyCheckValid) {
              break;
            }
          }

          !onlyCheckValid &&
            (get(fieldError, _f.name)
              ? isFieldArrayRoot
                ? updateFieldArrayRootError(
                    _formState.errors,
                    fieldError,
                    _f.name,
                  )
                : set(_formState.errors, _f.name, fieldError[_f.name])
              : unset(_formState.errors, _f.name));

          if (props.shouldUseNativeValidation && fieldError[_f.name]) {
            break;
          }
        }

        !isEmptyObject(fieldValue) &&
          (await executeBuiltInValidation({
            context,
            onlyCheckValid,
            fields: fieldValue,
            name: name as FieldPath<TFieldValues>,
            eventType,
          }));
      }
    }

    return context.valid;
  };

  const _removeUnmounted = () => {
    for (const name of _names.unMount) {
      const field: Field = get(_fields, name);

      field &&
        (field._f.refs
          ? field._f.refs.every((ref) => !live(ref))
          : !live(field._f.ref)) &&
        unregister(name as FieldPath<TFieldValues>);
    }

    _names.unMount = new Set();
  };

  const _getDirty: GetIsDirty = (name, data) => (
    name && data && set(_formValues, name, data),
    !deepEqual(_state.mount ? _formValues : _defaultValues, _defaultValues)
  );

  const _getWatch: WatchInternal<TFieldValues> = (
    names,
    defaultValue,
    isGlobal,
  ) =>
    generateWatchOutput(
      names,
      _names,
      {
        ...(_state.mount
          ? _formValues
          : isUndefined(defaultValue)
            ? _defaultValues
            : isString(names)
              ? { [names]: defaultValue }
              : defaultValue),
      },
      isGlobal,
      defaultValue,
    );

  const _getFieldArray = <TFieldArrayValues>(
    name: InternalFieldName,
  ): Partial<TFieldArrayValues>[] =>
    compact(
      get(
        _state.mount ? _formValues : _defaultValues,
        name,
        _options.shouldUnregister ? get(_defaultValues, name, []) : [],
      ),
    );

  const setFieldValue = (
    name: InternalFieldName,
    value: SetFieldValue<TFieldValues>,
    options: SetValueConfig = {},
    skipClone = false,
    skipRender = false,
  ) => {
    const field: Field = get(_fields, name);
    let fieldValue: unknown = value;

    if (field) {
      const fieldReference = field._f;

      if (fieldReference) {
        !fieldReference.disabled &&
          set(_formValues, name, getFieldValueAs(value, fieldReference));

        fieldValue =
          isHTMLElement(fieldReference.ref) && isNullOrUndefined(value)
            ? ''
            : value;

        if (isMultipleSelect(fieldReference.ref)) {
          [...fieldReference.ref.options].forEach(
            (optionRef) =>
              (optionRef.selected = (
                fieldValue as InternalFieldName[]
              ).includes(optionRef.value)),
          );
        } else if (fieldReference.refs) {
          if (isCheckBoxInput(fieldReference.ref)) {
            fieldReference.refs.forEach((checkboxRef) => {
              if (!checkboxRef.defaultChecked || !checkboxRef.disabled) {
                if (Array.isArray(fieldValue)) {
                  checkboxRef.checked = !!fieldValue.find(
                    (data: string) => data === checkboxRef.value,
                  );
                } else {
                  checkboxRef.checked =
                    fieldValue === checkboxRef.value || !!fieldValue;
                }
              }
            });
          } else {
            fieldReference.refs.forEach(
              (radioRef: HTMLInputElement) =>
                (radioRef.checked = radioRef.value === fieldValue),
            );
          }
        } else if (isFileInput(fieldReference.ref)) {
          fieldReference.ref.value = '';
        } else {
          fieldReference.ref.value = fieldValue;

          if (!fieldReference.ref.type && !skipRender) {
            _subjects.state.next({
              name,
              values: skipClone ? _formValues : cloneObject(_formValues),
            });
          }
        }
      }
    }

    (options.shouldDirty || options.shouldTouch) &&
      updateTouchAndDirty(
        name,
        fieldValue,
        options.shouldTouch,
        options.shouldDirty,
        !skipRender,
      );

    options.shouldValidate &&
      trigger(
        name as Path<TFieldValues>,
        {
          delayError: options.delayError,
        } as TriggerConfig & { delayError?: boolean },
      );
  };

  const setFieldValues = <
    T extends InternalFieldName,
    K extends SetFieldValue<TFieldValues>,
    U extends SetValueConfig,
  >(
    name: T,
    value: K,
    options: U,
    skipClone = false,
    skipRender = false,
  ) => {
    for (const fieldKey in value) {
      if (!value.hasOwnProperty(fieldKey)) {
        return;
      }
      const fieldValue = value[fieldKey];
      const fieldName = name + '.' + fieldKey;
      const field = get(_fields, fieldName);

      (_names.array.has(name) ||
        isObject(fieldValue) ||
        (field && !field._f)) &&
      !isDateObject(fieldValue)
        ? setFieldValues(fieldName, fieldValue, options, skipClone, skipRender)
        : setFieldValue(fieldName, fieldValue, options, skipClone, skipRender);
    }
  };

  const _setValue = <
    TFieldName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
  >(
    name: TFieldName,
    value: FieldPathValue<TFieldValues, TFieldName>,
    options: SetValueConfig,
    skipClone: boolean,
    skipStateEmit = false,
  ) => {
    const field = get(_fields, name);
    const isFieldArray = _names.array.has(name);
    const cloneValue = skipClone ? value : cloneObject(value);
    const previousValue = get(_formValues, name);
    const isValueUnchanged = deepEqual(previousValue, cloneValue);

    if (!isValueUnchanged) {
      set(_formValues, name, cloneValue);
    }

    if (isFieldArray) {
      _subjects.array.next({
        name,
        values: skipClone ? _formValues : cloneObject(_formValues),
      });

      if (
        (_proxyFormState.isDirty ||
          _proxyFormState.dirtyFields ||
          _proxySubscribeFormState.isDirty ||
          _proxySubscribeFormState.dirtyFields) &&
        options.shouldDirty
      ) {
        _updateDirtyFields();

        if (!skipStateEmit) {
          _subjects.state.next({
            name,
            dirtyFields: _formState.dirtyFields,
            isDirty: _getDirty(name, cloneValue),
          });
        }
      }
    } else {
      const isEmpty =
        (Array.isArray(cloneValue) && !cloneValue.length) ||
        isEmptyObject(cloneValue);

      if (!field || field._f || isNullOrUndefined(cloneValue) || isEmpty) {
        setFieldValue(name, cloneValue, options, skipClone, skipStateEmit);
      } else {
        setFieldValues(name, cloneValue, options, skipClone, skipStateEmit);
      }
    }

    if (!isValueUnchanged && !skipStateEmit) {
      const watched = isWatched(name, _names);
      const values = skipClone ? _formValues : cloneObject(_formValues);

      _subjects.state.next({
        ...(watched && _formState),
        name: _state.mount || watched ? name : undefined,
        values,
      });
    }
  };

  const setValue: UseFormSetValue<TFieldValues> = (name, value, options = {}) =>
    _setValue(name, value, options, false);

  const setValues: UseFormSetValues<TFieldValues> = (
    formValues,
    options = {},
  ) => {
    const updatedFormValues = isFunction(formValues)
      ? (formValues as Function)(_formValues as TFieldValues)
      : formValues;

    if (!deepEqual(_formValues, updatedFormValues)) {
      _formValues = {
        ..._formValues,
        ...updatedFormValues,
      };

      const flattenedUpdates = flatten(updatedFormValues as FieldValues);

      for (const fieldName of _names.mount) {
        if (fieldName in flattenedUpdates) {
          _setValue(
            fieldName as FieldPath<TFieldValues>,
            flattenedUpdates[fieldName],
            options,
            true,
            true,
          );
        }
      }

      _subjects.state.next({
        ..._formState,
        name: undefined,
        type: undefined,
        ...(_valuesSubscriberCount ? { values: _formValues } : {}),
      });

      if (options.shouldValidate) {
        _setValid();
      }
    }
  };

  const onChange: ChangeHandler = async (event) => {
    _state.mount = true;
    const target = event.target;
    let name: string = target.name;
    let isFieldValueUpdated = true;
    const field: Field = get(_fields, name);
    const _updateIsFieldValueUpdated = (fieldValue: unknown) => {
      isFieldValueUpdated =
        Number.isNaN(fieldValue) ||
        (isDateObject(fieldValue) && isNaN(fieldValue.getTime())) ||
        deepEqual(fieldValue, get(_formValues, name, fieldValue));
    };

    if (field) {
      let error;
      let isValid;
      const fieldValue = target.type
        ? getFieldValue(field._f)
        : getEventValue(event);
      const isBlurEvent =
        event.type === EVENTS.BLUR || event.type === EVENTS.FOCUS_OUT;
      const hasNoValidationEffect =
        !hasValidation(field._f) &&
        !props.validate &&
        !_options.resolver &&
        !get(_formState.errors, name) &&
        !field._f.deps;
      const shouldSkipValidation =
        hasNoValidationEffect ||
        skipValidation(
          isBlurEvent,
          get(_formState.touchedFields, name),
          _formState.isSubmitted,
          _validationModeAfterSubmit,
          _validationModeBeforeSubmit,
        );
      const watched = isWatched(name, _names, isBlurEvent);

      set(_formValues, name, fieldValue);

      if (isBlurEvent) {
        if (!target || !target.readOnly) {
          field._f.onBlur && field._f.onBlur(event);
          const pendingDelayError = delayErrorCallbacks[name];
          pendingDelayError && pendingDelayError(0);
        }
      } else if (field._f.onChange) {
        field._f.onChange(event);
      }

      const fieldState = updateTouchAndDirty(name, fieldValue, isBlurEvent);

      const shouldRender = !isEmptyObject(fieldState) || watched;

      !isBlurEvent &&
        _subjects.state.next({
          name,
          type: event.type,
          ...(_valuesSubscriberCount
            ? { values: cloneObject(_formValues) }
            : {}),
        });

      if (shouldSkipValidation) {
        if (
          (!hasNoValidationEffect || !_formState.isValid) &&
          (_proxyFormState.isValid || _proxySubscribeFormState.isValid)
        ) {
          if (_options.mode === 'onBlur') {
            if (isBlurEvent) {
              _setValid();
            }
          } else if (!isBlurEvent) {
            _setValid();
          }
        }

        return (
          shouldRender &&
          _subjects.state.next({ name, ...(watched ? {} : fieldState) })
        );
      }

      if (!_options.resolver && props.validate) {
        await validateForm({
          name: name as FieldPath<TFieldValues>,
          eventType: event.type,
        });
      }

      !isBlurEvent && watched && _subjects.state.next({ ..._formState });

      if (_options.resolver) {
        const { errors } = await _runSchema([name]);
        _updateIsValidating([name]);

        _updateIsFieldValueUpdated(fieldValue);

        if (!isFieldValueUpdated) {
          !isEmptyObject(fieldState) && _subjects.state.next(fieldState);
          return;
        }

        const previousErrorLookupResult = schemaErrorLookup(
          _formState.errors,
          _fields,
          name,
        );
        const errorLookupResult = schemaErrorLookup(
          errors,
          _fields,
          previousErrorLookupResult.name || name,
        );

        error = errorLookupResult.error;
        name = errorLookupResult.name;

        isValid = isEmptyObject(errors);
      } else {
        _updateIsValidating([name], true);
        error = (
          await validateField(
            field,
            _names.disabled,
            _formValues,
            shouldDisplayAllAssociatedErrors,
            _options.shouldUseNativeValidation,
          )
        )[name];
        _updateIsValidating([name]);

        _updateIsFieldValueUpdated(fieldValue);

        if (isFieldValueUpdated) {
          if (error) {
            isValid = false;
          } else if (
            _proxyFormState.isValid ||
            _proxySubscribeFormState.isValid
          ) {
            isValid = await executeBuiltInValidation({
              fields: _fields,
              onlyCheckValid: true,
              name: name as FieldPath<TFieldValues>,
              eventType: event.type,
            });
          }
        }
      }

      if (isFieldValueUpdated) {
        field._f.deps &&
          (!Array.isArray(field._f.deps) || field._f.deps.length > 0) &&
          trigger(
            field._f.deps as
              | FieldPath<TFieldValues>
              | FieldPath<TFieldValues>[],
          );
        shouldRenderByError(name, isValid, error, fieldState);
      }
    }
  };

  const _focusInput = (ref: Ref, key: string) => {
    if (get(_formState.errors, key) && ref.focus) {
      ref.focus();
      return 1;
    }
    return;
  };

  const trigger: UseFormTrigger<TFieldValues> = async (
    name,
    options: TriggerConfig & { delayError?: boolean } = {},
  ) => {
    let isValid;
    let validationResult;
    const fieldNames = convertToArrayPayload(name) as InternalFieldName[];

    if (_options.resolver) {
      const errors = await executeSchemaAndUpdateState(
        isUndefined(name) ? name : fieldNames,
      );

      isValid = isEmptyObject(errors);
      validationResult = name
        ? !fieldNames.some((name) => get(errors, name))
        : isValid;
    } else if (name) {
      validationResult = (
        await Promise.all(
          fieldNames.map(async (fieldName) => {
            const field = get(_fields, fieldName);
            return await executeBuiltInValidation({
              fields: field && field._f ? { [fieldName]: field } : field,
              eventType: EVENTS.TRIGGER,
            });
          }),
        )
      ).every(Boolean);
      !(!validationResult && !_formState.isValid) && _setValid();
    } else {
      validationResult = isValid = await executeBuiltInValidation({
        fields: _fields,
        name,
        eventType: EVENTS.TRIGGER,
      });
    }

    if (options.delayError && _options.delayError && isString(name)) {
      const error = get(_formState.errors, name);
      if (error) {
        unset(_formState.errors, name);
        delayErrorCallbacks[name] = debounce(name, () =>
          updateErrors(name, error),
        );
        delayErrorCallbacks[name](_options.delayError);
      } else {
        clearTimeout(timers[name]);
        delete delayErrorCallbacks[name];
      }
    }

    _subjects.state.next({
      ...(!isString(name) ||
      ((_proxyFormState.isValid || _proxySubscribeFormState.isValid) &&
        isValid !== _formState.isValid)
        ? {}
        : { name }),
      ...(_options.resolver || !name ? { isValid } : {}),
      errors: _formState.errors,
    });

    options.shouldFocus &&
      !validationResult &&
      iterateFieldsByAction(
        _fields,
        _focusInput,
        name ? fieldNames : _names.mount,
      );

    return validationResult;
  };

  const getValues: UseFormGetValues<TFieldValues> = (
    fieldNames?:
      | FieldPath<TFieldValues>
      | ReadonlyArray<FieldPath<TFieldValues>>,
    config?: GetValuesConfig,
  ) => {
    let values = {
      ...(_state.mount ? _formValues : _defaultValues),
    };

    if (config) {
      values = extractFormValues(
        config.dirtyFields ? _formState.dirtyFields : _formState.touchedFields,
        values,
      );
    }

    return isUndefined(fieldNames)
      ? values
      : isString(fieldNames)
        ? get(values, fieldNames)
        : fieldNames.map((name) => get(values, name));
  };

  const getFieldState: UseFormGetFieldState<TFieldValues> = (
    name,
    formState,
  ) => ({
    invalid: !!get((formState || _formState).errors, name),
    isDirty: !!get((formState || _formState).dirtyFields, name),
    error: get((formState || _formState).errors, name),
    isValidating: !!get(_formState.validatingFields, name),
    isTouched: !!get((formState || _formState).touchedFields, name),
  });

  const clearErrors: UseFormClearErrors<TFieldValues> = (name) => {
    const names = name ? convertToArrayPayload(name) : undefined;

    names?.forEach((inputName) => unset(_formState.errors, inputName));

    if (names) {
      names.forEach((inputName) => {
        _subjects.state.next({
          name: inputName,
          errors: _formState.errors,
        });
      });
    } else {
      _subjects.state.next({
        errors: {},
      });
    }
  };

  const setError: UseFormSetError<TFieldValues> = (name, error, options) => {
    const ref = (get(_fields, name, { _f: {} })._f || {}).ref;
    const currentError = get(_formState.errors, name) || {};

    const { ref: currentRef, message, type, ...restOfErrorTree } = currentError;

    set(_formState.errors, name, {
      ...restOfErrorTree,
      ...error,
      ref,
    });

    _subjects.state.next({
      name,
      errors: _formState.errors,
      isValid: false,
    });

    options && options.shouldFocus && ref && ref.focus && ref.focus();
  };

  const watch: UseFormWatch<TFieldValues> = (
    name?:
      | FieldPath<TFieldValues>
      | ReadonlyArray<FieldPath<TFieldValues>>
      | WatchObserver<TFieldValues>,
    defaultValue?: DeepPartial<TFieldValues>,
  ) => {
    if (isFunction(name)) {
      _valuesSubscriberCount++;
      const { unsubscribe } = _subjects.state.subscribe({
        next: (payload) =>
          'values' in payload &&
          name(
            payload.values || _getWatch(undefined, defaultValue),
            payload as {
              name?: FieldPath<TFieldValues>;
              type?: EventType;
              value?: unknown;
            },
          ),
      });
      let called = false;

      return {
        unsubscribe: () => {
          if (called) {
            return;
          }

          called = true;
          _valuesSubscriberCount--;
          unsubscribe();
        },
      };
    }
    return _getWatch(
      name as InternalFieldName | InternalFieldName[],
      defaultValue,
      true,
    );
  };

  const _subscribe: FromSubscribe<TFieldValues> = (props) => {
    const needsValues = !!(props.formState as Record<string, unknown>)?.values;
    if (needsValues) {
      _valuesSubscriberCount++;
    }
    const { unsubscribe } = _subjects.state.subscribe({
      next: (
        formState: Partial<FormState<TFieldValues>> & {
          name?: InternalFieldName;
          values?: TFieldValues | undefined;
          type?: EventType;
        },
      ) => {
        if (
          shouldSubscribeByName(props.name, formState.name, props.exact) &&
          shouldRenderFormState(
            formState,
            (props.formState as ReadFormState) || _proxyFormState,
            _setFormState,
            props.reRenderRoot,
          )
        ) {
          const snapshot = { ..._formValues } as TFieldValues;

          props.callback({
            values: snapshot,
            ..._formState,
            ...formState,
            defaultValues:
              _defaultValues as FormState<TFieldValues>['defaultValues'],
          });
        }
      },
    });
    if (!needsValues) {
      return unsubscribe;
    }
    let called = false;
    return () => {
      if (called) {
        return;
      }

      called = true;
      _valuesSubscriberCount--;
      unsubscribe();
    };
  };

  const subscribe: UseFormSubscribe<TFieldValues> = (props) => {
    _state.mount = true;
    _proxySubscribeFormState = {
      ..._proxySubscribeFormState,
      ...props.formState,
    };
    return _subscribe({
      ...props,
      formState: {
        ...defaultProxyFormState,
        ...props.formState,
      },
    });
  };

  const unregister: UseFormUnregister<TFieldValues> = (name, options = {}) => {
    for (const fieldName of name ? convertToArrayPayload(name) : _names.mount) {
      _names.mount.delete(fieldName);
      _names.array.delete(fieldName);

      if (!options.keepValue) {
        unset(_fields, fieldName);
        unset(_formValues, fieldName);
      }

      !options.keepError && unset(_formState.errors, fieldName);
      !options.keepDirty && unset(_formState.dirtyFields, fieldName);
      !options.keepTouched && unset(_formState.touchedFields, fieldName);
      !options.keepIsValidating &&
        unset(_formState.validatingFields, fieldName);
      !_options.shouldUnregister &&
        !options.keepDefaultValue &&
        unset(_defaultValues, fieldName);
    }

    _subjects.state.next({
      values: cloneObject(_formValues),
    });

    _subjects.state.next({
      ..._formState,
      ...(!options.keepDirty ? {} : { isDirty: _getDirty() }),
    });

    !options.keepIsValid && _setValid();
  };

  const _setDisabledField: Control<TFieldValues>['_setDisabledField'] = ({
    disabled,
    name,
  }) => {
    if (
      (isBoolean(disabled) && _state.mount) ||
      !!disabled ||
      _names.disabled.has(name)
    ) {
      const wasDisabled = _names.disabled.has(name);
      const isDisabled = !!disabled;
      const disabledStateChanged = wasDisabled !== isDisabled;

      disabled ? _names.disabled.add(name) : _names.disabled.delete(name);
      disabledStateChanged && _state.mount && !_state.action && _setValid();
    }
  };

  const register: UseFormRegister<TFieldValues> = (name, options = {}) => {
    let field = get(_fields, name);
    const disabledIsDefined =
      isBoolean(options.disabled) || isBoolean(_options.disabled);
    const shouldRevalidateRemount =
      !_names.registerName.has(name) && field && field._f && !field._f.mount;

    set(_fields, name, {
      ...(field || {}),
      _f: {
        ...(field && field._f ? field._f : { ref: { name } }),
        name,
        mount: true,
        ...options,
      },
    });
    _names.mount.add(name);

    if (field && !shouldRevalidateRemount) {
      _setDisabledField({
        disabled: isBoolean(options.disabled)
          ? options.disabled
          : _options.disabled,
        name,
      });
    } else {
      updateValidAndValue(name, true, options.value);
    }

    return {
      ...(disabledIsDefined
        ? { disabled: options.disabled || _options.disabled }
        : {}),
      ...(_options.progressive
        ? {
            required: !!options.required,
            min: getRuleValue(options.min),
            max: getRuleValue(options.max),
            minLength: getRuleValue<number>(options.minLength) as number,
            maxLength: getRuleValue(options.maxLength) as number,
            pattern: getRuleValue(options.pattern) as string,
          }
        : {}),
      name,
      onChange,
      onBlur: onChange,
      ref: (ref: HTMLInputElement | null): void => {
        if (ref) {
          _names.registerName.add(name);
          register(name, options);
          _names.registerName.delete(name);
          field = get(_fields, name);

          const fieldRef = isUndefined(ref.value)
            ? ref.querySelectorAll
              ? (ref.querySelectorAll('input,select,textarea')[0] as Ref) || ref
              : ref
            : ref;
          const radioOrCheckbox = isRadioOrCheckbox(fieldRef);
          const refs = field._f.refs || [];

          if (
            radioOrCheckbox
              ? refs.find((option: Ref) => option === fieldRef)
              : fieldRef === field._f.ref
          ) {
            return;
          }

          set(_fields, name, {
            _f: {
              ...field._f,
              ...(radioOrCheckbox
                ? {
                    refs: [
                      ...refs.filter(live),
                      fieldRef,
                      ...(Array.isArray(get(_defaultValues, name)) ? [{}] : []),
                    ],
                    ref: { type: fieldRef.type, name },
                  }
                : { ref: fieldRef }),
            },
          });

          updateValidAndValue(name, false, undefined, fieldRef);
        } else {
          field = get(_fields, name, {});

          if (field._f) {
            field._f.mount = false;
          }

          (_options.shouldUnregister || options.shouldUnregister) &&
            !(isNameInFieldArray(_names.array, name) && _state.action) &&
            _names.unMount.add(name);
        }
      },
    };
  };

  const _focusError = () =>
    _options.shouldFocusError &&
    !_options.shouldUseNativeValidation &&
    iterateFieldsByAction(_fields, _focusInput, _names.mount);

  const _disableForm = (disabled?: boolean) => {
    if (isBoolean(disabled)) {
      _subjects.state.next({ disabled });
      iterateFieldsByAction(
        _fields,
        (ref, name) => {
          const currentField: Field = get(_fields, name);
          if (currentField) {
            ref.disabled = currentField._f.disabled || disabled;

            if (Array.isArray(currentField._f.refs)) {
              currentField._f.refs.forEach((inputRef) => {
                inputRef.disabled = currentField._f.disabled || disabled;
              });
            }
          }
        },
        0,
        false,
      );
    }
  };

  const handleSubmit: UseFormHandleSubmit<TFieldValues, TTransformedValues> =
    (onValid, onInvalid) => async (e) => {
      let onValidError = undefined;
      if (e) {
        e.preventDefault && e.preventDefault();
        (e as React.BaseSyntheticEvent).persist &&
          (e as React.BaseSyntheticEvent).persist();
      }
      let fieldValues:
        | TFieldValues
        | TTransformedValues
        | Record<string, never> = cloneObject(_formValues);

      _subjects.state.next({
        isSubmitting: true,
      });

      if (_options.resolver) {
        const { errors, values } = await _runSchema();
        _updateIsValidating();
        _formState.errors = errors;
        fieldValues = cloneObject(values);
      } else {
        await executeBuiltInValidation({
          fields: _fields,
          eventType: EVENTS.SUBMIT,
        });
      }

      if (_names.disabled.size) {
        for (const name of _names.disabled) {
          unset(fieldValues, name);
        }
      }

      unset(_formState.errors, ROOT_ERROR_TYPE);

      if (isEmptyObject(_formState.errors)) {
        _subjects.state.next({
          errors: {},
        });
        try {
          await onValid(fieldValues as TTransformedValues, e);
        } catch (error) {
          onValidError = error;
        }
      } else {
        if (onInvalid) {
          await onInvalid({ ..._formState.errors }, e);
        }

        _focusError();
        setTimeout(_focusError);
      }

      _subjects.state.next({
        isSubmitted: true,
        isSubmitting: false,
        isSubmitSuccessful: isEmptyObject(_formState.errors) && !onValidError,
        submitCount: _formState.submitCount + 1,
        errors: _formState.errors,
      });
      if (onValidError) {
        throw onValidError;
      }
    };

  const resetField: UseFormResetField<TFieldValues> = (name, options = {}) => {
    if (get(_fields, name)) {
      if (isUndefined(options.defaultValue)) {
        setValue(name, cloneObject(get(_defaultValues, name)));
      } else {
        setValue(
          name,
          options.defaultValue as Parameters<typeof setValue<typeof name>>[1],
        );
        set(_defaultValues, name, cloneObject(options.defaultValue));
      }

      if (!options.keepTouched) {
        unset(_formState.touchedFields, name);
      }

      if (!options.keepDirty) {
        unset(_formState.dirtyFields, name);
        _formState.isDirty = options.defaultValue
          ? _getDirty(name, cloneObject(get(_defaultValues, name)))
          : _getDirty();
      }

      if (!options.keepError) {
        unset(_formState.errors, name);
        _proxyFormState.isValid && _setValid();
      }

      _subjects.state.next({ ..._formState });
    }
  };

  const _reset: UseFormReset<TFieldValues> = (
    formValues,
    keepStateOptions = {},
  ) => {
    const updatedValues = formValues ? cloneObject(formValues) : _defaultValues;
    const cloneUpdatedValues = cloneObject(updatedValues);
    const isEmptyResetValues = isEmptyObject(formValues);
    const values = cloneUpdatedValues;
    const fieldRefs = _fields;

    if (!keepStateOptions.keepDefaultValues) {
      _defaultValues = updatedValues;
    }

    if (!keepStateOptions.keepValues) {
      if (keepStateOptions.keepDirtyValues) {
        const fieldsToCheck = new Set([
          ..._names.mount,
          ...Object.keys(
            getDirtyFields(_defaultValues, _formValues, undefined, fieldRefs),
          ),
        ]);
        for (const fieldName of Array.from(fieldsToCheck)) {
          const isDirty = get(_formState.dirtyFields, fieldName);
          const existingValue = get(_formValues, fieldName);
          const newValue = get(values, fieldName);

          if (isDirty && !isUndefined(existingValue)) {
            set(values, fieldName, existingValue);
          } else if (!isDirty && !isUndefined(newValue)) {
            setValue(fieldName as FieldPath<TFieldValues>, newValue);
          }
        }
      } else {
        if (isWeb && isUndefined(formValues)) {
          for (const name of _names.mount) {
            const field = get(_fields, name);
            if (field && field._f) {
              const fieldReference = Array.isArray(field._f.refs)
                ? field._f.refs[0]
                : field._f.ref;

              if (isHTMLElement(fieldReference)) {
                const form = fieldReference.closest('form');
                if (form) {
                  form.reset();
                  break;
                }
              }
            }
          }
        }

        if (keepStateOptions.keepFieldsRef) {
          for (const fieldName of _names.mount) {
            setValue(
              fieldName as FieldPath<TFieldValues>,
              get(values, fieldName),
            );
          }
        } else {
          _fields = {};
        }
      }

      if (_options.shouldUnregister) {
        _formValues = keepStateOptions.keepDefaultValues
          ? (cloneObject(_defaultValues) as TFieldValues)
          : ({} as TFieldValues);

        if (keepStateOptions.keepFieldsRef) {
          for (const fieldName of _names.mount) {
            set(_formValues, fieldName, get(values, fieldName));
          }
        }
      } else {
        _formValues = cloneObject(values) as TFieldValues;
      }

      _subjects.array.next({
        values: { ...values },
      });

      _subjects.state.next({
        name: undefined,
        type: undefined,
        values: { ...values } as TFieldValues,
      });
    }

    _names = {
      mount: keepStateOptions.keepDirtyValues ? _names.mount : new Set(),
      unMount: new Set(),
      array: new Set(),
      registerName: new Set(),
      disabled: new Set(),
      watch: new Set(),
      watchAll: false,
      focus: '',
    };

    _state.mount =
      !_proxyFormState.isValid ||
      !!keepStateOptions.keepIsValid ||
      !!keepStateOptions.keepDirtyValues ||
      (!_options.shouldUnregister && !isEmptyObject(values));

    _state.watch = !!_options.shouldUnregister;
    _state.keepIsValid = !!keepStateOptions.keepIsValid;
    _state.action = false;

    if (!keepStateOptions.keepErrors) {
      _formState.errors = {};
    }

    _subjects.state.next({
      submitCount: keepStateOptions.keepSubmitCount
        ? _formState.submitCount
        : 0,
      isDirty: isEmptyResetValues
        ? false
        : keepStateOptions.keepDirty
          ? _formState.isDirty
          : keepStateOptions.keepValues
            ? _getDirty()
            : !!(
                keepStateOptions.keepDefaultValues &&
                !deepEqual(formValues, _defaultValues)
              ),
      isSubmitted: keepStateOptions.keepIsSubmitted
        ? _formState.isSubmitted
        : false,
      dirtyFields: isEmptyResetValues
        ? {}
        : keepStateOptions.keepDirtyValues
          ? keepStateOptions.keepDefaultValues && _formValues
            ? getDirtyFields(_defaultValues, _formValues, undefined, fieldRefs)
            : _formState.dirtyFields
          : keepStateOptions.keepDefaultValues && formValues
            ? getDirtyFields(_defaultValues, formValues, undefined, fieldRefs)
            : keepStateOptions.keepDirty
              ? _formState.dirtyFields
              : {},
      touchedFields: keepStateOptions.keepTouched
        ? _formState.touchedFields
        : {},
      errors: keepStateOptions.keepErrors ? _formState.errors : {},
      isSubmitSuccessful: keepStateOptions.keepIsSubmitSuccessful
        ? _formState.isSubmitSuccessful
        : false,
      isSubmitting: false,
      defaultValues: _defaultValues as FormState<TFieldValues>['defaultValues'],
    });
  };

  const reset: UseFormReset<TFieldValues> = (formValues, keepStateOptions) =>
    _reset(
      isFunction(formValues)
        ? (formValues as Function)(_formValues as TFieldValues)
        : formValues,
      { ..._options.resetOptions, ...keepStateOptions },
    );

  const setFocus: UseFormSetFocus<TFieldValues> = (name, options = {}) => {
    const field = get(_fields, name);
    const fieldReference = field && field._f;

    if (fieldReference) {
      const fieldRef = fieldReference.refs
        ? fieldReference.refs[0]
        : fieldReference.ref;

      if (fieldRef.focus) {
        setTimeout(() => {
          fieldRef.focus();
          options.shouldSelect &&
            isFunction(fieldRef.select) &&
            fieldRef.select();
        });
      }
    }
  };

  const _setFormState = (
    updatedFormState: Partial<FormState<TFieldValues>> & {
      name?: InternalFieldName;
      type?: EventType;
      values?: TFieldValues;
    },
  ) => {
    // `name`, `type`, and `values` describe the event that produced this
    // update, not the form's persisted state (they aren't part of
    // `FormState`). Merging them in would leak a stale `name`/`type` from
    // one event into a later, unrelated notification that doesn't specify
    // its own.
    const { name, type, values, ...formState } = updatedFormState;

    _formState = {
      ..._formState,
      ...formState,
    };
  };

  const _resetDefaultValues = () =>
    isFunction(_options.defaultValues) &&
    (_options.defaultValues as Function)().then((values: TFieldValues) => {
      reset(values, _options.resetOptions);
      _subjects.state.next({
        isLoading: false,
      });
    });

  const resetDefaultValues: UseFormResetDefaultValues<TFieldValues> = (
    values,
    options = {},
  ) => {
    _defaultValues = cloneObject(values) as Partial<typeof _defaultValues>;

    if (!options.keepDirty) {
      const newDirtyFields = getDirtyFields(
        _defaultValues,
        _formValues,
        undefined,
        _fields,
      );
      _formState.dirtyFields = newDirtyFields as typeof _formState.dirtyFields;
      _formState.isDirty = !isEmptyObject(newDirtyFields);
    }

    if (!options.keepIsValid) {
      _setValid();
    }

    _subjects.state.next({
      ..._formState,
      defaultValues: _defaultValues as FormState<TFieldValues>['defaultValues'],
    });
  };

  const methods = {
    control: {
      register,
      unregister,
      getFieldState,
      handleSubmit,
      setError,
      _subscribe,
      _runSchema,
      _updateIsValidating,
      _focusError,
      _getWatch,
      _getDirty,
      _setValid,
      _setFieldArray,
      _setDisabledField,
      _setErrors,
      _getFieldArray,
      _reset,
      _resetDefaultValues,
      _removeUnmounted,
      _disableForm,
      _subjects,
      _proxyFormState,
      get _fields() {
        return _fields;
      },
      get _formValues() {
        return _formValues;
      },
      get _state() {
        return _state;
      },
      set _state(value) {
        _state = value;
      },
      get _defaultValues() {
        return _defaultValues;
      },
      get _names() {
        return _names;
      },
      set _names(value) {
        _names = value;
      },
      get _formState() {
        return _formState;
      },
      get _options() {
        return _options;
      },
      set _options(value) {
        _options = {
          ..._options,
          ...value,
        };
        _validationModeBeforeSubmit = getValidationModes(_options.mode);
        _validationModeAfterSubmit = getValidationModes(
          _options.reValidateMode,
        );
      },
    },
    subscribe,
    trigger,
    register,
    handleSubmit,
    watch,
    setValue,
    setValues,
    getValues,
    reset,
    resetField,
    resetDefaultValues,
    clearErrors,
    unregister,
    setError,
    setFocus,
    getFieldState,
  };

  return {
    ...methods,
    formControl: methods,
  };
}
