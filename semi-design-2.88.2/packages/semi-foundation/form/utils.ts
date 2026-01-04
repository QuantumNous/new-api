import AsyncValidator from 'async-validator';
import { toPath, isUndefined } from 'lodash';
import { FieldValidateTriggerType, BasicTriggerType, ComponentProps, WithFieldOption } from './interface';
import { strings } from './constants';
import copy from 'fast-copy';

/**
 * 
 * @param WrappedComponent React.ComponentType | any
 */
export function getDisplayName(WrappedComponent: any) {
    const originName = WrappedComponent.displayName || WrappedComponent.name;
    return originName ? `SemiField${originName}` : 'SemiField';
}

export function generateValidatesFromRules(field: string, rules: any[] = []) {
    const descriptor = {};
    descriptor[field] = rules;
    const validator = new AsyncValidator(descriptor);
    return validator;
}

export function isRequired(rules: any[] | Record<string, any> = []): boolean {
    let required = false;
    if (typeof rules === 'object' && 'required' in rules) {
        required = rules.required;
    } else if (Array.isArray(rules) && rules.length) {
        rules.forEach(rule => {
            rule.required ? (required = true) : null;
        });
    }
    return required;
}

export function isValid(errors: any): boolean {
    let valid = true;
    if (typeof errors === 'string' && errors.length) {
        valid = false;
    } else if (Array.isArray(errors) && errors.length) {
        valid = errors.every(error => isValid(error));
    } else if (typeof errors === 'boolean') {
        valid = errors;
    } else if (
        errors &&
        typeof errors.$$typeof === 'symbol' &&
        errors.$$typeof.toString() === 'Symbol(react.element)'
    ) {
        // when error message is reactNode
        // only work with React Adapter
        valid = false;
    }
    return valid;
}

/**
 * trigger transform rule
    1. If the user has set fieldProps, follow the user's fieldProps
    2. If the user does not set fieldProps, follow formProps
    3. If there is no formProps, follow the change
    4. If it is an array, follow the array, if it is not an array (pure string), convert it to a string array
 */

export function transformTrigger(fieldTrigger: FieldValidateTriggerType, formTrigger: FieldValidateTriggerType): Array<BasicTriggerType> {
    let result: BasicTriggerType[] | FieldValidateTriggerType = [];
    let finalResult = [];
    if (!isUndefined(fieldTrigger)) {
        result = fieldTrigger;
    } else if (!isUndefined(formTrigger)) {
        result = formTrigger;
    } else {
        result = strings.DEFAULT_TRIGGER as BasicTriggerType;
    }

    if (Array.isArray(result)) {
        finalResult = result;
    }

    if (typeof result === 'string') {
        finalResult[0] = result;
    }
    return finalResult;
}

export function transformDefaultBooleanAPI(fieldProp: boolean, formProp: boolean, defaultVal = false) {
    if (!isUndefined(fieldProp)) {
        return fieldProp;
    } else if (!isUndefined(formProp)) {
        return formProp;
    } else {
        return defaultVal;
    }
}

export function mergeOptions(opts: WithFieldOption, props: ComponentProps) {
    // Opts: different types of component identification value, value change callback function may be inconsistent, used to adapt 1, input, select 2, radio, checkbox 3, switch
    // valueKey: input, select class component control value props are value, and checkbox, switch is checked
    // eg：checkbox、radio   { valueKey: 'checked', onKeyChangeFnName: 'onChange', valuePath: 'target.value' }
    const defaultOpts = {
        valueKey: 'value',
        onKeyChangeFnName: 'onChange',
        valuePath: '',
        maintainCursor: false,
        shouldInject: true,
        shouldMemo: true,
    };
    const options = { ...defaultOpts, ...opts };

    // If the field attribute is declared, then the injection is carried out (mainly used to deal with the case where Checkbox and Radio are used separately from the Group); other cases are subject to options
    const shouldInject = 'field' in props ? true : options.shouldInject;

    return { options, shouldInject };
}

export function mergeProps(props: any) {
    const defaultProps = {
        // validateStatus: 'default',
        allowEmptyString: false,
        allowEmpty: false,
        emptyValue: '',
        noLabel: false,
        noErrorMessage: false,
        isInInputGroup: false,
    };
    let {
        field,
        label,
        labelPosition,
        labelWidth,
        labelAlign,
        labelCol,
        wrapperCol,
        initValue,
        validate,
        /**
         * error、warning、default、success
         */
        validateStatus,
        /**
         * change、blur、custom、mount
         */

        trigger,
        allowEmptyString,
        allowEmpty,
        emptyValue,
        rules,
        onChange,
        keepState,
        // Conversion before validation
        transform,
        name,
        fieldClassName,
        fieldStyle,
        noLabel,
        noErrorMessage,
        isInInputGroup,
        stopValidateWithError,
        convert,
        showValidateIcon,
        helpText,
        extraText,
        extraTextPosition,
        pure,
        id,
        ...rest
    }: any = { ...defaultProps, ...props };
    // Form中的任何类型组件，初始值都统一通过initValue字段来传入，同时将可能会导致组件行为错误的props抽取出来，防止透传到组件中
    // For any type of field component in Form, the initial value is uniformly passed in through the initValue field.
    // At the same time, the props that may cause component behavior errors are extracted to prevent transparent transmission to the component.

    delete rest.defaultChecked;
    delete rest.defaultValue;
    delete rest.checked;

    if (typeof initValue !== 'undefined') {
        initValue = copy(initValue);
    }

    const required = isRequired(rules);

    emptyValue = typeof emptyValue !== 'undefined' ? emptyValue : '';
    return {
        field,
        label,
        labelPosition,
        labelWidth,
        labelAlign,
        labelCol,
        wrapperCol,
        noLabel,
        noErrorMessage,
        isInInputGroup,
        initValue,
        validate,
        validateStatus,
        trigger,
        allowEmptyString,
        allowEmpty,
        emptyValue,
        rules,
        required,
        keepState,
        transform,
        name,
        fieldClassName,
        fieldStyle,
        convert,
        stopValidateWithError,
        showValidateIcon,
        helpText,
        extraText,
        extraTextPosition,
        pure,
        rest,
        id
    };
}

function bothEmptyArray(val: any, otherVal: any) {
    return Array.isArray(val) && Array.isArray(otherVal) && !val.length && !otherVal.length;
}