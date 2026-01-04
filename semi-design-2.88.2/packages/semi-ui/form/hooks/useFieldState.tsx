import React from 'react';
import useFormState from './useFormState';
import * as ObjectUtil from '@douyinfe/semi-foundation/utils/object';
import { FormState } from '../interface';

const buildFieldState = (formState: FormState, field: string) => ({
    value: ObjectUtil.get(formState.values, field),
    error: ObjectUtil.get(formState.errors, field),
    touched: ObjectUtil.get(formState.touched, field),
});

function useFieldState(field: string) {
    const formState = useFormState();
    const fieldState = buildFieldState(formState, field);
    return fieldState;
}

export default useFieldState;
