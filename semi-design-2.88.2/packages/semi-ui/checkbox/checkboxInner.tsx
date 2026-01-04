import React, { PureComponent } from 'react';
import classnames from 'classnames';
import PropTypes from 'prop-types';
import { noop } from 'lodash';
import { checkboxClasses as css } from '@douyinfe/semi-foundation/checkbox/constants';
import { Context } from './context';
import { IconCheckboxTick, IconCheckboxIndeterminate } from '@douyinfe/semi-icons';

export interface CheckboxInnerProps {
    'aria-describedby'?: React.AriaAttributes['aria-describedby'];
    'aria-errormessage'?: React.AriaAttributes['aria-errormessage'];
    'aria-invalid'?: React.AriaAttributes['aria-invalid'];
    'aria-labelledby'?: React.AriaAttributes['aria-labelledby'];
    'aria-required'?: React.AriaAttributes['aria-required'];
    indeterminate?: boolean;
    checked?: boolean;
    disabled?: boolean;
    prefixCls?: string;
    name?: string;
    isPureCardType?: boolean;
    ref?: React.MutableRefObject<CheckboxInner> | ((ref: CheckboxInner) => void);
    addonId?: string;
    extraId?: string;
    'aria-label'?: React.AriaAttributes['aria-label'];
    focusInner?: boolean;
    onInputFocus?: (e: any) => void;
    onInputBlur?: (e: any) => void;
    preventScroll?: boolean
}

class CheckboxInner extends PureComponent<CheckboxInnerProps> {
    static contextType = Context;

    static propTypes = {
        'aria-describedby': PropTypes.string,
        'aria-errormessage': PropTypes.string,
        'aria-invalid': PropTypes.bool,
        'aria-labelledby': PropTypes.string,
        'aria-required': PropTypes.bool,
        checked: PropTypes.bool,
        disabled: PropTypes.bool,
        onChange: PropTypes.func,
        children: PropTypes.node,
        grouped: PropTypes.bool,
        value: PropTypes.any,
        isPureCardType: PropTypes.bool,
        addonId: PropTypes.string,
        extraId: PropTypes.string,
        focusInner: PropTypes.bool,
        onInputFocus: PropTypes.func,
        onInputBlur: PropTypes.func,
        preventScroll: PropTypes.bool,
    };

    static defaultProps = {
        onChange: noop,
    };
    inputEntity: HTMLInputElement;

    blur() {
        this.inputEntity.blur();
    }

    focus() {
        const { preventScroll } = this.props;
        this.inputEntity.focus({ preventScroll });
    }

    render() {
        const { indeterminate, checked, disabled, prefixCls, name, isPureCardType, addonId, extraId, focusInner, onInputFocus, onInputBlur } = this.props;
        const prefix = prefixCls || css.PREFIX;

        const wrapper = classnames(
            {
                [`${prefix}-inner`]: true,
                [`${prefix}-inner-checked`]: Boolean(checked),
                [`${prefix}-inner-pureCardType`]: isPureCardType,
            },
            css.WRAPPER
        );

        const inner = classnames({
            [`${prefix}-inner-display`]: true,
            [`${prefix}-focus`]: focusInner,
            [`${prefix}-focus-border`]: focusInner && !checked,
        });

        const icon = checked ? (
            <IconCheckboxTick />
        ) : indeterminate ? (
            <IconCheckboxIndeterminate />
        ) : null;

        const inputProps: React.InputHTMLAttributes<HTMLInputElement> = {
            type: "checkbox",
            'aria-label': this.props['aria-label'],
            'aria-disabled': disabled,
            'aria-checked': checked,
            'aria-labelledby': addonId,
            'aria-describedby': extraId || this.props['aria-describedby'],
            'aria-invalid': this.props['aria-invalid'],
            'aria-errormessage': this.props['aria-errormessage'],
            'aria-required': this.props['aria-required'],
            className: css.INPUT,
            onChange: noop,
            checked: checked,
            disabled: disabled,
            onFocus: onInputFocus,
            onBlur: onInputBlur,
        };
        
        name && (inputProps['name'] = name);

        return (
            <span className={wrapper}>
                <input
                    {...inputProps}
                    ref={ref => {
                        this.inputEntity = ref;
                    }}
                />
                <span className={inner}>{icon}</span>
            </span>
        );
    }
}

export default CheckboxInner;
