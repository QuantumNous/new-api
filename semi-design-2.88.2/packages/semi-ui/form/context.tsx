import React from 'react';
import { BaseFormApi, FormUpdaterContextType, FormState } from '@douyinfe/semi-foundation/form/interface';

const FormStateContext = React.createContext<FormState>({});
FormStateContext.displayName = 'FormState';

const FormApiContext = React.createContext<BaseFormApi>({} as BaseFormApi);
FormApiContext.displayName = 'FormApi';

const FormUpdaterContext = React.createContext<FormUpdaterContextType>({} as FormUpdaterContextType);
FormUpdaterContext.displayName = 'FormUpdater';

const ArrayFieldContext = React.createContext({
    shouldUseInitValue: true,
});

export { FormStateContext, FormApiContext, FormUpdaterContext, ArrayFieldContext };
