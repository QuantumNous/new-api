import { BaseFormApi } from '@douyinfe/semi-foundation/form/interface';
import React, { useContext } from 'react';
import { FormApiContext } from '../context';
 
export default function useFormApi<T extends Record<string, any> = any>() {
    return useContext<BaseFormApi<T>>(FormApiContext);
}