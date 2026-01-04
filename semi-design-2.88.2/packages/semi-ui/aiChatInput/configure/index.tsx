import React from 'react';
import { Context } from './context';
import ConfigureButton from './button';
import ConfigureSelect from './select';
import ConfigureMcp from './mcp';
import ConfigureRadioButton from './radioButton';

class Configure extends React.Component<any, any> {
    static contextType = Context;

    static Button = ConfigureButton;
    static Select = ConfigureSelect;
    static Mcp = ConfigureMcp;
    static RadioButton = ConfigureRadioButton;

    constructor(props: any) {
        super(props);
        this.state = {
            value: props.value || props.defaultValue,
        };
        this._contextValue = {
            value: this.state.value,
            onChange: this.onChange,
            onRemove: this.onRemove,
        };
    }

    _contextValue: any;

    onChange = (obj: any, init = false) => {
        this.setState((s: any) => {
            const { value } = s;
            const newValue = { ...value, ...obj };
            const { onChange } = this.props;
            !init && onChange?.(newValue, obj);
            return { value: newValue };
        });
    }

    onRemove = (field: string) => {
        this.setState((s: any) => {
            const { value = {} } = s;
            const newValue = {};
            Object.keys(value).forEach((key: string) => {
                if (key !== field) {
                    newValue[key] = value[key];
                }
            });
            const { onChange } = this.props;
            onChange?.(newValue);
            return { value: newValue };
        });
    }

    getConfigureValue = () => {
        return this.state.value;
    }

    getContextValue = () => {
        if (!this._contextValue || 
            this._contextValue.value !== this.state.value || 
            this._contextValue.onChange !== this.onChange ||
            this._contextValue.onRemove !== this.onRemove
        ) {
            this._contextValue = {
                value: this.state.value,
                onChange: this.onChange,
                onRemove: this.onRemove,
            };
        }
        return this._contextValue;
    }

    render() {
        const { children } = this.props;
        return (
            <Context.Provider value={this.getContextValue()} >
                {children}
            </Context.Provider>
        );
    }
}

export default Configure;
