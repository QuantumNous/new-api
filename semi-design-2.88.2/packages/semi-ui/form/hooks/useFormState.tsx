import { FormState } from '@douyinfe/semi-foundation/form/interface';
import React, { useContext } from 'react';
import { FormStateContext } from '../context';

function useFormState<T extends Record<string, any> = any>() {
    const formState = useContext<FormState<T>>(FormStateContext);
    return formState;
}

export default useFormState;