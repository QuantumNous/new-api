import React, { forwardRef } from 'react';
import { FormApiContext } from '../context';
import type { BaseFormApi as FormApi } from '@douyinfe/semi-foundation/form/interface';

function withFormApi<
    C extends React.ElementType,
    T extends React.ComponentProps<C> & React.RefAttributes<any>,
    R extends React.ComponentType<T>
>(Component: C) {
    let WithApiCom = (props: any, ref: React.MutableRefObject<any> | ((instance: any) => void)) => {
        return (
            <FormApiContext.Consumer>
                { (formApi: FormApi) => (<Component formApi={formApi} ref={ref} {...props} />) }
            </FormApiContext.Consumer>
        );
    };
    WithApiCom = forwardRef(WithApiCom);
    return WithApiCom as R;
}

export default withFormApi;
