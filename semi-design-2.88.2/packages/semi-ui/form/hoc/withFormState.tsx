import React, { forwardRef } from 'react';
import { FormStateContext } from '../context';
import type { FormState } from '@douyinfe/semi-foundation/form/interface';

function withFormState<
    C extends React.ElementType,
    T extends React.ComponentProps<C> & React.RefAttributes<any>,
    R extends React.ComponentType<T>
>(Component: C) {
    let WithStateCom = (props: any, ref: React.MutableRefObject<any> | ((instance: any) => void)) => {
        return (
            <FormStateContext.Consumer>
                {(formState: FormState) => <Component formState={formState} ref={ref} {...props} />}
            </FormStateContext.Consumer>
        );
    };
    WithStateCom = forwardRef(WithStateCom);
    return WithStateCom as R;
}

export default withFormState;
