import React from 'react';
import { get } from 'lodash';

import {
    InsetInputValue,
    Type,
    InsetInputChangeFoundationProps,
} from '@douyinfe/semi-foundation/datePicker/inputFoundation';
import Input, { InputProps } from '../input';

export interface InsetDateInputProps {
    forwardRef: InputProps['forwardRef'];
    insetInputValue: InsetInputValue;
    placeholder: string;
    valuePath: string;
    onChange: (options: InsetInputChangeFoundationProps) => void;
    onFocus: InputProps['onFocus']
}

export interface InsetTimeInputProps {
    disabled: boolean;
    insetInputValue: InsetInputValue;
    placeholder: string;
    valuePath: string;
    type: Type;
    onChange: (options: InsetInputChangeFoundationProps) => void;
    onFocus: InputProps['onFocus']
}

export function InsetDateInput(props: InsetDateInputProps) {
    const { insetInputValue, valuePath, onFocus, onChange, placeholder, forwardRef } = props;
    const value = get(insetInputValue, valuePath);

    return (
        <Input
            value={value}
            onChange={(value, event) => {
                onChange({
                    value,
                    event,
                    insetInputValue,
                    valuePath,
                });
            }}
            onFocus={onFocus}
            placeholder={placeholder}
            ref={forwardRef}
        />
    );
}

export function InsetTimeInput(props: InsetTimeInputProps) {
    const { insetInputValue, valuePath, type, onFocus, onChange, placeholder, disabled } = props;
    const _isTimeType = type.includes('Time');
    if (!_isTimeType) {
        return null;
    }
    const value = get(insetInputValue, valuePath);

    return (
        <Input
            value={value}
            onChange={(value, event) => {
                onChange({
                    value,
                    event,
                    insetInputValue,
                    valuePath,
                });
            }}
            onFocus={onFocus}
            placeholder={placeholder}
            disabled={disabled}
        />
    );
}
