import classnames from 'classnames';
import { noop } from 'lodash';
import PropTypes from 'prop-types';
import React from 'react';

import { radioGroupClasses as css, strings } from '@douyinfe/semi-foundation/radio/constants';
import RadioGroupFoundation, { RadioGroupAdapter } from '@douyinfe/semi-foundation/radio/radioGroupFoundation';
import { RadioChangeEvent } from '@douyinfe/semi-foundation/radio/radioInnerFoundation';

import { ArrayElement } from '../_base/base';
import BaseComponent from '../_base/baseComponent';
import Context, { RadioGroupButtonSize, RadioMode } from './context';
import Radio, { RadioType } from './radio';

export interface OptionItem {
    label?: React.ReactNode;
    value?: string | number;
    disabled?: boolean;
    extra?: React.ReactNode;
    style?: React.CSSProperties;
    className?: string;
    addonId?: string;
    addonStyle?: React.CSSProperties;
    addonClassName?: string;
    extraId?: string
}
export type Options = string[] | Array<OptionItem>;

export type RadioGroupProps = {
    defaultValue?: string | number | boolean;
    disabled?: boolean;
    name?: string;
    options?: Options;
    value?: string | number | boolean;
    onChange?: (event: RadioChangeEvent) => void;
    className?: string;
    children?: React.ReactNode;
    style?: React.CSSProperties;
    direction?: ArrayElement<typeof strings.DIRECTION_SET>;
    mode?: RadioMode;
    type?: RadioType;
    buttonSize?: RadioGroupButtonSize;
    prefixCls?: string;
    'aria-label'?: React.AriaAttributes['aria-label'];
    'aria-describedby'?: React.AriaAttributes['aria-describedby'];
    'aria-errormessage'?: React.AriaAttributes['aria-errormessage'];
    'aria-invalid'?: React.AriaAttributes['aria-invalid'];
    'aria-labelledby'?: React.AriaAttributes['aria-labelledby'];
    'aria-required'?: React.AriaAttributes['aria-required'];
    id?: string
};

export interface RadioGroupState {
    value?: any
}

class RadioGroup extends BaseComponent<RadioGroupProps, RadioGroupState> {
    static propTypes = {
        defaultValue: PropTypes.any,
        disabled: PropTypes.bool,
        name: PropTypes.string,
        options: PropTypes.array,
        buttonSize: PropTypes.oneOf(strings.BUTTON_SIZE),
        type: PropTypes.oneOf([strings.TYPE_DEFAULT, strings.TYPE_BUTTON, strings.TYPE_CARD, strings.TYPE_PURECARD]),
        value: PropTypes.any,
        onChange: PropTypes.func,
        children: PropTypes.node,
        prefixCls: PropTypes.string,
        className: PropTypes.string,
        style: PropTypes.object,
        direction: PropTypes.oneOf(strings.DIRECTION_SET),
        mode: PropTypes.oneOf(strings.MODE),
        'aria-label': PropTypes.string,
        'aria-describedby': PropTypes.string,
        'aria-errormessage': PropTypes.string,
        'aria-invalid': PropTypes.bool,
        'aria-labelledby': PropTypes.string,
        'aria-required': PropTypes.bool,
        id: PropTypes.string,
    };

    static defaultProps: Partial<RadioGroupProps> = {
        disabled: false,
        onChange: noop,
        direction: strings.DEFAULT_DIRECTION,
        mode: '',
        type: strings.TYPE_DEFAULT,
        buttonSize: 'middle'
    };

    foundation: RadioGroupFoundation;
    constructor(props: RadioGroupProps) {
        super(props);
        this.state = {
            value: props.value || props.defaultValue,
        };
        this.foundation = new RadioGroupFoundation(this.adapter);
    }

    componentDidMount() {
        this.foundation.init();
    }

    componentDidUpdate(prevProps: RadioGroupProps) {
        if (typeof prevProps.value === 'number'
            && isNaN(prevProps.value)
            && typeof this.props.value === 'number'
            && isNaN(this.props.value)
        ) {
            // `NaN === NaN` returns false, and this will fail the next if check
            // therefore triggering an infinite loop
            return;
        }
        if (prevProps.value !== this.props.value) {
            this.foundation.handlePropValueChange(this.props.value);
        }
    }

    componentWillUnmount() {
        this.foundation.destroy();
    }

    get adapter(): RadioGroupAdapter {
        return {
            ...super.adapter,
            setValue: (value: any) => {
                this.setState({ value });
            },
            getProps: () => this.props,
            isInProps: (name: string) => Boolean(name in this.props),
            notifyChange: (evt: RadioChangeEvent) => {
                this.props.onChange && this.props.onChange(evt);
            },
        };
    }

    onChange = (evt: RadioChangeEvent) => {
        this.foundation.handleChange(evt);
    };

    getFormatName = () => this.props.name || 'default';

    render() {
        const {
            children,
            options,
            mode,
            prefixCls,
            className,
            style,
            direction,
            type,
            buttonSize,
            id,
            ...rest
        } = this.props;

        const isButtonRadio = type === strings.TYPE_BUTTON;
        const isPureCardRadio = type === strings.TYPE_PURECARD;
        const isCardRadio = type === strings.TYPE_CARD || isPureCardRadio;
        const isDefaultRadio = type === strings.TYPE_DEFAULT;

        const prefix = prefixCls || css.PREFIX;
        const prefixClsDisplay = classnames(className, {
            [prefix]: true,
            [`${prefix}-wrapper`]: true,
            [`${prefix}-${direction}`]: direction && !isButtonRadio,
            [`${prefix}-${direction}-default`]: direction && isDefaultRadio,
            [`${prefix}-${direction}-card`]: direction && isCardRadio,
            [`${prefix}-buttonRadio`]: isButtonRadio,
        });

        const realValue = this.state.value;

        let inner;

        if (options) {
            inner = (options || []).map((option, index) => {
                if (typeof option === 'string') {
                    return (
                        <Radio
                            key={index}
                            disabled={this.props.disabled}
                            value={option}
                        >
                            {option}
                        </Radio>
                    );
                } else {
                    return (
                        <Radio
                            key={index}
                            disabled={option.disabled || this.props.disabled}
                            value={option.value}
                            extra={option.extra}
                            className={option.className}
                            style={option.style}
                            addonId={option.addonId}
                            addonStyle={option.addonStyle}
                            addonClassName={option.addonClassName}
                            extraId={option.extraId}
                        >
                            {option.label}
                        </Radio>
                    );
                }
            });
        } else if (children) {
            inner = React.Children.map(children, (itm, index) => (React.isValidElement(itm) ?
                React.cloneElement(itm, { key: index }) :
                null));
        }

        return (
            <div
                className={prefixClsDisplay}
                style={style}
                id={id}
                aria-label={this.props['aria-label']}
                aria-invalid={this.props['aria-invalid']}
                aria-errormessage={this.props['aria-errormessage']}
                aria-labelledby={this.props['aria-labelledby']}
                aria-describedby={this.props['aria-describedby']}
                aria-required={this.props['aria-required']}
                {...this.getDataAttr(rest)}
            >
                <Context.Provider
                    value={{
                        radioGroup: {
                            onChange: this.onChange,
                            value: realValue,
                            disabled: this.props.disabled,
                            name: this.getFormatName(),
                            isButtonRadio,
                            isCardRadio,
                            isPureCardRadio,
                            buttonSize,
                            prefixCls
                        },
                        mode
                    }}
                >
                    {inner}
                </Context.Provider>
            </div>
        );
    }
}

export default RadioGroup;
