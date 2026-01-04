import React, { Component } from 'react';
import { getUuidv4 } from '@douyinfe/semi-foundation/utils/uuid';
import { isUndefined } from 'lodash';
import { FormUpdaterContext, ArrayFieldContext } from './context';
import warning from '@douyinfe/semi-foundation/utils/warning';
import type { ArrayFieldStaff, FormUpdaterContextType } from '@douyinfe/semi-foundation/form/interface';
import copy from 'fast-copy';

export interface ArrayFieldProps {
    initValue?: any[];
    field?: string;
    children?: (props: ArrayFieldChildrenProps) => React.ReactNode
}

export interface ArrayFieldChildrenProps {
    arrayFields: {
        key: string;
        field: string;
        remove: () => void
    }[];
    add: () => void;
    addWithInitValue: (lineObject: Record<string, any>) => void
}

export interface ArrayFieldState {
    keys: string[]
}

const filterArrayByIndex = (array: any[], index: number) => array.filter((item, i) => i !== index);

const getUuidByArray = (array: any[]) => array.map(() => getUuidv4());

const getUpdateKey = (arrayField: ArrayFieldStaff): string | undefined => {
    if (!arrayField) {
        return undefined;
    }
    if (arrayField && arrayField.updateKey) {
        return arrayField.updateKey;
    }
    return undefined;
};

const initValueAdapter = (initValue: any) => {
    const iv: any[] = [];
    if (Array.isArray(initValue)) {
        return initValue;
    } else {
        warning(
            !isUndefined(initValue),
            '[Semi Form ArrayField] initValue of ArrayField must be an array. Please check the type of your props'
        );
        return iv;
    }
};

/**
 *
 * @param {any[]} value
 * @param {string[]} oldKeys
 * @returns string[]
 */
const generateKeys = (value: any[], oldKeys?: string[]) => {
    const val = initValueAdapter(value);
    const newKeys = getUuidByArray(val);
    // return newKeys;
    const keys = newKeys.map((key, i) => (oldKeys && oldKeys[i] ? oldKeys[i] : key));
    return keys;
};

class ArrayFieldComponent extends Component<ArrayFieldProps, ArrayFieldState> {
    static contextType = FormUpdaterContext;

    cacheFieldValues: any[];
    shouldUseInitValue: boolean;
    cacheUpdateKey: string | number;
    context: FormUpdaterContextType;

    constructor(props: ArrayFieldProps, context: FormUpdaterContextType) {
        super(props, context);
        const initValueInProps = this.props.initValue;
        const { field } = this.props;
        const initValueInForm = context.getValue(field);
        const initValue = initValueInProps || initValueInForm;
        this.state = {
            keys: generateKeys(initValue),
        };
        this.add = this.add.bind(this);
        this.addWithInitValue = this.addWithInitValue.bind(this);
        this.remove = this.remove.bind(this);
        this.cacheFieldValues = null;
        this.cacheUpdateKey = null;

        /*
            If updateKey exists, it means that the arrayField (usually a nested ArrayField not at the first level) is only re-mounted due to setValues,
            and the fields it contains do not need to consume initValue
        */
        // whether the fields inside arrayField should use props.initValue in current render process
        this.shouldUseInitValue = !context.getArrayField(field);

        // Separate the arrays that reset and the usual add and remove modify, otherwise they will affect each other
        const initValueCopyForFormState = copy(initValue);
        const initValueCopyForReset = copy(initValue);
        context.registerArrayField(field, initValueCopyForReset);
        // register ArrayField will update state.updateKey to render, So there is no need to execute forceUpdate here
        context.updateStateValue(field, initValueCopyForFormState, { notNotify: true, notUpdate: true });

    }

    componentWillUnmount() {
        const updater = this.context;
        const { field } = this.props;
        updater.unRegisterArrayField(field);
    }

    componentDidUpdate() {
        const updater = this.context;
        const { field } = this.props;
        const { keys } = this.state;
        const fieldValues = updater.getValue(field);
        const updateKey = getUpdateKey(updater.getArrayField(field));
        // when update form outside, like use formApi.setValue('field', [{newItem1, newItem2}]),  formApi.setValues
        // re generate keys to update arrayField;
        if (updateKey !== this.cacheUpdateKey) {
            const newKeys = generateKeys(fieldValues, keys);
            // eslint-disable-next-line
            this.setState({ keys: newKeys });
            this.cacheUpdateKey = updateKey;
            if (this.cacheUpdateKey !== null) {
                this.shouldUseInitValue = false;
            }
        }
    }

    add() {
        const { keys } = this.state;
        const { field } = this.props;
        const updater = this.context;
        keys.push(getUuidv4());
        this.shouldUseInitValue = true;
        this.setState({ keys });
        let updateKey = new Date().valueOf();
        updater.updateArrayField(field, { updateKey });
        this.cacheUpdateKey = updateKey;
    }

    addWithInitValue(rowVal: Record<string, any> | string) {
        const updater = this.context;
        const { field } = this.props;
        const newArrayFieldVal = updater.getValue(field) ? updater.getValue(field).slice() : [];
        const cloneRowVal = copy(rowVal);
        newArrayFieldVal.push(cloneRowVal);
        updater.updateStateValue(field, newArrayFieldVal, {});
        updater.updateArrayField(field, { updateKey: new Date().valueOf() });
    }

    remove(i: number) {
        const updater = this.context;
        const { keys } = this.state;
        const { field } = this.props;
        const newKeys = filterArrayByIndex(keys, i);
        // Make sure that all the keys in the line are removed, because some keys are not taken over by the field, only set in the initValue
        let newArrayFieldError = updater.getError(field);
        const opts = { notNotify: true, notUpdate: true };
        if (Array.isArray(newArrayFieldError)) {
            newArrayFieldError = newArrayFieldError.slice();
            newArrayFieldError.splice(i, 1);
            updater.updateStateError(field, newArrayFieldError, opts);
        }
        // if (Array.isArray(newArrayFieldTouched)) {
        //     newArrayFieldTouched = newArrayFieldTouched.slice();
        //     newArrayFieldTouched.splice(i, 1);
        //     updater.updateStateTouched(field, newArrayFieldTouched, opts);
        // }
        let newArrayFieldValue = updater.getValue(field);
        if (Array.isArray(newArrayFieldValue)) {
            newArrayFieldValue = newArrayFieldValue.slice();
            newArrayFieldValue.splice(i, 1);
            updater.updateStateValue(field, newArrayFieldValue);
        }

        this.setState({ keys: newKeys });
    }

    render() {
        const { children, field } = this.props;
        const { keys } = this.state;
        const arrayFields = keys.map((key, i) => ({
            // key: i,
            key,
            field: `${field}[${i}]`,
            remove: () => this.remove(i),
        }));
        const { add } = this;
        const { addWithInitValue } = this;
        const contextVal = {
            shouldUseInitValue: this.shouldUseInitValue,
        };
        return (
            <ArrayFieldContext.Provider value={contextVal}>
                {children({ arrayFields, add, addWithInitValue })}
            </ArrayFieldContext.Provider>
        );
    }
}

export default ArrayFieldComponent;
