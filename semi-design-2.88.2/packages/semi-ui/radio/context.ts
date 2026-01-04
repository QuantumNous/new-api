import React from 'react';
import { RadioChangeEvent } from '@douyinfe/semi-foundation/radio/radioInnerFoundation';
import { strings } from '@douyinfe/semi-foundation/radio/constants';
import { ArrayElement } from '../_base/base';

export type RadioGroupButtonSize = ArrayElement<typeof strings.BUTTON_SIZE>;
export type RadioMode = ArrayElement<typeof strings.MODE>;
export interface RadioContextValue {
    mode?: RadioMode;
    radioGroup?: {
        value?: string | number;
        isButtonRadio?: any;
        disabled?: boolean;
        prefixCls?: string;
        name?: string;
        onChange?: (e: RadioChangeEvent) => void;
        buttonSize?: RadioGroupButtonSize;
        isCardRadio?: boolean;
        isPureCardRadio?: boolean
    }
}

const Context = React.createContext<RadioContextValue>(null);

export default Context;