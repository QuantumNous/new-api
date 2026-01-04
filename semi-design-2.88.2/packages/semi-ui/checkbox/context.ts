import React from 'react';
// import { BasicCheckboxEvent } from '@douyinfe/semi-foundation/checkbox/checkboxFoundation';
type CheckboxContextType = {
    checkboxGroup?: {
        // onChange: (evt: BasicCheckboxEvent) => void;
        onChange: (evt: any) => void;
        value: any[];
        disabled: boolean;
        name: any;
        isCardType: boolean;
        isPureCardType: boolean
    }
};
const Context = React.createContext<CheckboxContextType>({});
export { Context, CheckboxContextType };