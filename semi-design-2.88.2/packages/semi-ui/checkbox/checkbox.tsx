import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { checkboxClasses as css, strings } from '@douyinfe/semi-foundation/checkbox/constants';
import CheckboxFoundation, { CheckboxAdapter, BasicCheckboxEvent, BasicTargetObject, BaseCheckboxProps } from '@douyinfe/semi-foundation/checkbox/checkboxFoundation';
import CheckboxInner from './checkboxInner';
import BaseComponent from '../_base/baseComponent';
import '@douyinfe/semi-foundation/checkbox/checkbox.scss';
import { Context, CheckboxContextType } from './context';
import { isUndefined, isBoolean, noop } from 'lodash';
import { getUuidShort } from '@douyinfe/semi-foundation/utils/uuid';
import { CheckboxType } from './checkboxGroup';


export interface CheckboxEvent extends BasicCheckboxEvent {
    nativeEvent: {
        stopImmediatePropagation: () => void
    }
}
export type TargetObject = BasicTargetObject;

export interface CheckboxProps extends BaseCheckboxProps {
    'aria-describedby'?: React.AriaAttributes['aria-describedby'];
    'aria-errormessage'?: React.AriaAttributes['aria-errormessage'];
    'aria-invalid'?: React.AriaAttributes['aria-invalid'];
    'aria-labelledby'?: React.AriaAttributes['aria-labelledby'];
    'aria-required'?: React.AriaAttributes['aria-required'];
    children?: React.ReactNode;
    onChange?: (e: CheckboxEvent) => any;
    // TODO, docs
    style?: React.CSSProperties;
    onMouseEnter?: React.MouseEventHandler<HTMLSpanElement>;
    onMouseLeave?: React.MouseEventHandler<HTMLSpanElement>;
    extra?: React.ReactNode;
    'aria-label'?: React.AriaAttributes['aria-label'];
    role?: React.HTMLAttributes<HTMLSpanElement>['role']; // a11y: wrapper role
    tabIndex?: number; // a11y: wrapper tabIndex
    addonId?: string;
    extraId?: string;
    type?: CheckboxType
}
interface CheckboxState {
    checked: boolean;
    addonId?: string;
    extraId?: string;
    focusVisible?: boolean
}
class Checkbox extends BaseComponent<CheckboxProps, CheckboxState> {
    static contextType = Context;

    static propTypes = {
        'aria-describedby': PropTypes.string,
        'aria-errormessage': PropTypes.string,
        'aria-invalid': PropTypes.bool,
        'aria-labelledby': PropTypes.string,
        'aria-required': PropTypes.bool,
        // Specifies whether it is currently selected
        checked: PropTypes.bool,
        // Initial check
        defaultChecked: PropTypes.bool,
        // Failure state
        disabled: PropTypes.bool,
        // Set indeterminate state, only responsible for style control
        indeterminate: PropTypes.bool,
        // Callback function when changing
        onChange: PropTypes.func,
        value: PropTypes.any,
        style: PropTypes.object,
        className: PropTypes.string,
        prefixCls: PropTypes.string,
        onMouseEnter: PropTypes.func,
        onMouseLeave: PropTypes.func,
        extra: PropTypes.node,
        index: PropTypes.number,
        'aria-label': PropTypes.string,
        tabIndex: PropTypes.number,
        preventScroll: PropTypes.bool,
        type: PropTypes.string,
    };

    static defaultProps = {
        defaultChecked: false,
        indeterminate: false,
        onChange: noop,
        onMouseEnter: noop,
        onMouseLeave: noop,
        type: 'default',
    };
    static elementType: string;

    checkboxEntity: CheckboxInner;
    context: CheckboxContextType;

    get adapter(): CheckboxAdapter<CheckboxProps, CheckboxState> {
        return {
            ...super.adapter,
            setNativeControlChecked: checked => {
                this.setState({ checked });
            },
            notifyChange: cbContent => {
                const { onChange } = this.props;
                onChange && onChange(cbContent);
            },
            generateEvent: (checked, e) => {
                const { props } = this;
                const cbValue = {
                    target: {
                        ...props,
                        checked,
                    },
                    stopPropagation: () => {
                        e.stopPropagation();
                    },
                    preventDefault: () => {
                        e.preventDefault();
                    },
                    nativeEvent: {
                        stopImmediatePropagation: () => {
                            if (e.nativeEvent && typeof e.nativeEvent.stopImmediatePropagation === 'function') {
                                e.nativeEvent.stopImmediatePropagation();
                            }
                        }
                    },
                };
                return cbValue;
            },
            getIsInGroup: () => this.isInGroup(),
            getGroupValue: () => (this.context && this.context.checkboxGroup.value) || [],
            notifyGroupChange: cbContent => {
                this.context.checkboxGroup.onChange(cbContent);
            },
            getGroupDisabled: () => (this.context && this.context.checkboxGroup.disabled),
            setAddonId: () => {
                this.setState({ addonId: getUuidShort({ prefix: 'addon' }) });
            },
            setExtraId: () => {
                this.setState({ extraId: getUuidShort({ prefix: 'extra' }) });
            },
            setFocusVisible: (focusVisible: boolean): void => {
                this.setState({ focusVisible });
            },
            focusCheckboxEntity: () => {
                this.focus();
            },
        };
    }

    foundation: CheckboxFoundation;
    constructor(props: CheckboxProps) {
        super(props);

        const checked = false;

        this.state = {
            checked: props.checked || props.defaultChecked || checked,
            addonId: props.addonId,
            extraId: props.extraId,
            focusVisible: false
        };

        this.checkboxEntity = null;
        this.foundation = new CheckboxFoundation(this.adapter);
    }

    componentDidUpdate(prevProps: CheckboxProps) {
        if (this.props.checked !== prevProps.checked) {
            if (isUndefined(this.props.checked)) {
                this.foundation.setChecked(false);
            } else if (isBoolean(this.props.checked)) {
                this.foundation.setChecked(this.props.checked);
            }
        }
    }

    isInGroup() {
        // Why do we need to determine whether there is a value in props?
        // If there is no value in the props of the checkbox in the context of the checkboxGroup, 
        // it will be considered not to belong to the checkboxGroup。
        return Boolean(this.context && this.context.checkboxGroup && ('value' in this.props));
    }

    focus() {
        this.checkboxEntity && this.checkboxEntity.focus();
    }

    blur() {
        this.checkboxEntity && this.checkboxEntity.blur();
    }

    handleChange: React.MouseEventHandler<HTMLSpanElement> = e => this.foundation.handleChange(e);

    handleEnterPress = (e: React.KeyboardEvent<HTMLSpanElement>) => this.foundation.handleEnterPress(e);

    handleFocusVisible = (event: React.FocusEvent) => {
        this.foundation.handleFocusVisible(event);
    }

    handleBlur = (event: React.FocusEvent) => {
        this.foundation.handleBlur();
    }

    render() {
        const {
            disabled,
            style,
            prefixCls,
            className,
            indeterminate,
            children,
            onMouseEnter,
            onMouseLeave,
            extra,
            value,
            role,
            tabIndex,
            id,
            type,
        } = this.props;
        const { checked, addonId, extraId, focusVisible } = this.state;
        const props: Record<string, any> = {
            checked,
            disabled,
        };

        const inGroup = this.isInGroup();
        if (inGroup) {
            if (this.context.checkboxGroup.value) {
                const realChecked = (this.context.checkboxGroup.value || []).includes(value);
                props.checked = realChecked;
            }
            if (this.context.checkboxGroup.disabled) {
                props.disabled = this.context.checkboxGroup.disabled || this.props.disabled;
            }
            const { isCardType, isPureCardType } = this.context.checkboxGroup;
            props.isCardType = isCardType;
            props.isPureCardType = isPureCardType;
            props['name'] = this.context.checkboxGroup.name;
        } else {
            props.isPureCardType = type === strings.TYPE_PURECARD;
            props.isCardType = type === strings.TYPE_CARD || props.isPureCardType;
        }

        const prefix = prefixCls || css.PREFIX;

        const focusOuter = props.isCardType || props.isPureCardType;

        const wrapper = classnames(prefix, {
            [`${prefix}-disabled`]: props.disabled,
            [`${prefix}-indeterminate`]: indeterminate,
            [`${prefix}-checked`]: props.checked,
            [`${prefix}-unChecked`]: !props.checked,
            [`${prefix}-cardType`]: props.isCardType,
            [`${prefix}-cardType_disabled`]: props.disabled && props.isCardType,
            [`${prefix}-cardType_enable`]: !(props.disabled && props.isCardType),
            [`${prefix}-cardType_checked`]: props.isCardType && props.checked && !props.disabled,
            [`${prefix}-cardType_checked_disabled`]: props.isCardType && props.checked && props.disabled,
            [className]: Boolean(className),
            [`${prefix}-focus`]: focusVisible && focusOuter,
        });

        const extraCls = classnames(`${prefix}-extra`, {
            [`${prefix}-cardType_extra_noChildren`]: props.isCardType && !children,
        });

        const name = inGroup && this.context.checkboxGroup.name;
        const xSemiPropChildren = this.props['x-semi-children-alias'] || 'children';

        const renderContent = () => {
            if (!children && !extra) {
                return null;
            }

            return (
                <div className={`${prefix}-content`}>
                    {children ? (
                        <span id={addonId} className={`${prefix}-addon`} x-semi-prop={xSemiPropChildren}>
                            {children}
                        </span>
                    ) : null}
                    {extra ? (
                        <div id={extraId} className={extraCls} x-semi-prop="extra">
                            {extra}
                        </div>
                    ) : null}
                </div>
            );
        };

        return (
            // label is better than span, however span is here which is to solve gitlab issue #364
            <span
                role={role}
                tabIndex={tabIndex}
                style={style}
                className={wrapper}
                id={id}
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
                onClick={this.handleChange}
                onKeyPress={this.handleEnterPress}
                aria-labelledby={this.props['aria-labelledby']}
                {...this.getDataAttr(this.props)}
            >
                <CheckboxInner
                    {...this.props}
                    {...props}
                    addonId={children && addonId}
                    extraId={extra && extraId}
                    isPureCardType={props.isPureCardType}
                    ref={ref => {
                        this.checkboxEntity = ref;
                    }}
                    focusInner={focusVisible && !focusOuter}
                    onInputFocus={this.handleFocusVisible}
                    onInputBlur={this.handleBlur}
                />
                {renderContent()}
            </span>
        );
    }
}
Checkbox.elementType = 'Checkbox';

export default Checkbox;