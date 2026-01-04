import React from 'react';
import useFormApi from './useFormApi';
import { FormApi } from '../interface';
import { ReactFieldError as FieldError } from '../errorMessage';

const buildFieldApi = (formApi: FormApi, field: string) => ({
    getError: () => formApi.getError(field),
    setError: (error: FieldError) => formApi.setError(field, error),
    getTouched: () => formApi.getTouched(field),
    setTouched: (isTouched: boolean) => formApi.setTouched(field, isTouched),
    getValue: () => formApi.getValue(field),
    setValue: (value: any) => formApi.setValue(field, value),
});

function useFieldApi(field: string) {
    const formApi = useFormApi();
    const fieldApi = buildFieldApi(formApi, field);
    return fieldApi;
}

export default useFieldApi;