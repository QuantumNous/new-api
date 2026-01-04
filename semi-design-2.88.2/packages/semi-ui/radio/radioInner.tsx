import React from 'react';
import PropTypes from 'prop-types';
import RadioInnerFoundation, { RadioChangeEvent, RadioInnerAdapter } from '@douyinfe/semi-foundation/radio/radioInnerFoundation';
import BaseComponent, { BaseProps } from '../_base/baseComponent';
import { radioClasses as css } from '@douyinfe/semi-foundation/radio/constants';
import Context from './context';
import classnames from 'classnames';
import { IconRadio } from '@douyinfe/semi-icons';
import { noop } from 'lodash';

export type RadioInnerMode = 'advanced' | '';
export interface RadioInnerProps extends BaseProps {
    checked?: boolean;
    disabled?: boolean;
    isButtonRadio?: boolean;
    onChange?: (e: RadioChangeEvent) => void;
    mode?: RadioInnerMode;
    autoFocus?: boolean;
    name?: string;
    prefixCls?: string;
    ref?: React.MutableRefObject<RadioInner> | ((instance: RadioInner) => void);
    isPureCardRadioGroup?: boolean;
    addonId?: string;
    extraId?: string;
    'aria-label'?: React.AriaAttributes['aria-label'];
    focusInner?: boolean;
    onInputFocus?: (e: any) => void;
    onInputBlur?: (e: any) => void;
    preventScroll?: boolean
}

interface RadioInnerState {
    checked?: boolean
}

class RadioInner extends BaseComponent<RadioInnerProps, RadioInnerState> {
    static contextType = Context;

    static propTypes = {
        checked: PropTypes.bool,
        disabled: PropTypes.bool,
        isButtonRadio: PropTypes.bool,
        onChange: PropTypes.func,
        mode: PropTypes.oneOf(['advanced', '']),
        'aria-label': PropTypes.string,
        focusInner: PropTypes.bool,
        onInputFocus: PropTypes.func,
        onInputBlur: PropTypes.func,
        preventScroll: PropTypes.bool,
    };

    static defaultProps = {
        onChange: noop,
        isButtonRadio: false
    };


    inputEntity!: HTMLInputElement;
    foundation: RadioInnerFoundation;
    constructor(props: RadioInnerProps) {
        super(props);
        this.state = {
            checked: false
        };
        this.foundation = new RadioInnerFoundation(this.adapter);
        this.onChange = this.onChange.bind(this);
    }

    get adapter(): RadioInnerAdapter {
        return {
            ...super.adapter,
            setNativeControlChecked: (checked: boolean) => {
                this.setState({ checked });
            },
            notifyChange: (e: RadioChangeEvent) => {
                this.props.onChange(e);
            }
        };
    }

    componentDidMount() {
        this.foundation.init();
    }

    componentDidUpdate(prevProps: RadioInnerProps) {
        if (prevProps.checked !== this.props.checked) {
            this.foundation.setChecked(this.props.checked);
        }
    }

    componentWillUnmount() {
        this.foundation.destroy();
    }

    blur() {
        this.inputEntity.blur();
    }

    focus() {
        const { preventScroll } = this.props;
        this.inputEntity.focus({ preventScroll });
    }

    onChange(e: React.ChangeEvent<HTMLInputElement>) {
        this.foundation.handleChange(e);
    }

    render() {
        const { disabled, mode, autoFocus, name, isButtonRadio, isPureCardRadioGroup, addonId, extraId, 'aria-label': ariaLabel, focusInner, onInputFocus, onInputBlur } = this.props;
        const { checked } = this.state;

        const prefix = this.props.prefixCls || css.PREFIX;

        const wrapper = classnames({
            [`${prefix}-inner`]: true,
            [`${prefix}-inner-checked`]: Boolean(checked),
            [`${prefix}-inner-buttonRadio`]: isButtonRadio,
            [`${prefix}-inner-pureCardRadio`]: isPureCardRadioGroup,
        });

        const inner = classnames({
            [`${prefix}-focus`]: focusInner,
            [`${prefix}-focus-border`]: focusInner && !checked,
            [`${prefix}-inner-display`]: !isButtonRadio,
        });

        return (
            <span className={wrapper}>
                <input
                    ref={ref => {
                        this.inputEntity = ref;
                    }}
                    autoFocus={autoFocus}
                    type={mode === 'advanced' ? 'checkbox' : 'radio'}
                    checked={Boolean(checked)}
                    disabled={disabled}
                    onChange={this.onChange}
                    name={name}
                    aria-label={ariaLabel}
                    aria-labelledby={addonId}
                    aria-describedby={extraId}
                    onFocus={onInputFocus}
                    onBlur={onInputBlur}
                />
                <span className={inner}>{checked ? <IconRadio /> : null}</span>
            </span>
        );
    }
}

export default RadioInner;
