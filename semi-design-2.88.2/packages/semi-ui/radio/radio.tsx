import React from 'react';
import PropTypes from 'prop-types';
import cls from 'classnames';
import { noop, isUndefined, isBoolean } from 'lodash';

import RadioFoundation, { RadioAdapter } from '@douyinfe/semi-foundation/radio/radioFoundation';
import { RadioChangeEvent } from '@douyinfe/semi-foundation/radio/radioInnerFoundation';
import { strings, radioClasses as css } from '@douyinfe/semi-foundation/radio/constants';
import { getUuidShort } from '@douyinfe/semi-foundation/utils/uuid';
import '@douyinfe/semi-foundation/radio/radio.scss';

import BaseComponent from '../_base/baseComponent';
import RadioInner from './radioInner';
import Context, { RadioContextValue, RadioMode } from './context';

export type RadioDisplayMode = 'vertical' | '';
export type RadioType =
    typeof strings.TYPE_DEFAULT |
    typeof strings.TYPE_BUTTON |
    typeof strings.TYPE_CARD |
    typeof strings.TYPE_PURECARD;

export type RadioProps = {
    autoFocus?: boolean;
    checked?: boolean;
    children?: React.ReactNode;
    defaultChecked?: boolean;
    value?: string | number | boolean;
    disabled?: boolean;
    prefixCls?: string;
    displayMode?: RadioDisplayMode;
    onChange?: (e: RadioChangeEvent) => void;
    onMouseEnter?: (e: React.MouseEvent<HTMLLabelElement>) => void;
    onMouseLeave?: (e: React.MouseEvent<HTMLLabelElement>) => void;
    mode?: RadioMode;
    extra?: React.ReactNode;
    style?: React.CSSProperties;
    className?: string;
    addonStyle?: React.CSSProperties;
    addonClassName?: string;
    type?: RadioType;
    'aria-label'?: React.AriaAttributes['aria-label'];
    addonId?: string;
    extraId?: string;
    name?: string;
    preventScroll?: boolean
};

export interface RadioState {
    hover?: boolean;
    addonId?: string;
    extraId?: string;
    focusVisible?: boolean;
    checked?: boolean
}

export type { RadioChangeEvent };

class Radio extends BaseComponent<RadioProps, RadioState> {
    static contextType = Context;

    static propTypes = {
        autoFocus: PropTypes.bool,
        checked: PropTypes.bool,
        defaultChecked: PropTypes.bool,
        value: PropTypes.any, // Compare according to value to determine whether to select
        style: PropTypes.object,
        className: PropTypes.string,
        disabled: PropTypes.bool,
        prefixCls: PropTypes.string,
        displayMode: PropTypes.oneOf<RadioDisplayMode>(['vertical', '']),
        onChange: PropTypes.func,
        onMouseEnter: PropTypes.func,
        onMouseLeave: PropTypes.func,
        mode: PropTypes.oneOf(strings.MODE),
        extra: PropTypes.node, // extra info
        addonStyle: PropTypes.object,
        addonClassName: PropTypes.string,
        type: PropTypes.oneOf([strings.TYPE_DEFAULT, strings.TYPE_BUTTON, strings.TYPE_CARD, strings.TYPE_PURECARD]), // Button style type
        'aria-label': PropTypes.string,
        preventScroll: PropTypes.bool,
    };

    static defaultProps: Partial<RadioProps> = {
        autoFocus: false,
        defaultChecked: false,
        value: undefined as undefined,
        style: undefined as undefined,
        onMouseEnter: noop,
        onMouseLeave: noop,
        mode: '',
        type: 'default'
    };
    static elementType: string;

    radioEntity: RadioInner;
    context!: RadioContextValue;
    foundation: RadioFoundation;
    addonId: string;
    extraId: string;

    constructor(props: RadioProps) {
        super(props);
        this.state = {
            hover: false,
            addonId: props.addonId,
            extraId: props.extraId,
            checked: props.checked || props.defaultChecked || false,
        };
        this.foundation = new RadioFoundation(this.adapter);
        this.radioEntity = null;
    }

    componentDidUpdate(prevProps: RadioProps) {
        if (this.props.checked !== prevProps.checked) {
            if (isUndefined(this.props.checked)) {
                this.foundation.setChecked(false);
            } else if (isBoolean(this.props.checked)) {
                this.foundation.setChecked(this.props.checked);
            }
        }
    }

    get adapter(): RadioAdapter {
        return {
            ...super.adapter,
            setHover: (hover: boolean) => {
                this.setState({ hover });
            },
            setAddonId: () => {
                this.setState({ addonId: getUuidShort({ prefix: 'addon' }) });
            },
            setChecked: (checked: boolean) => {
                this.setState({ checked });
            },
            setExtraId: () => {
                this.setState({ extraId: getUuidShort({ prefix: 'extra' }) });
            },
            setFocusVisible: (focusVisible: boolean): void => {
                this.setState({ focusVisible });
            },
        };
    }

    isInGroup() {
        // eslint-disable-next-line react/destructuring-assignment
        return this.context && this.context.radioGroup;
    }

    focus() {
        this.radioEntity.focus();
    }

    blur() {
        this.radioEntity.blur();
    }

    onChange = (e: RadioChangeEvent) => {
        const { onChange } = this.props;
        if (this.isInGroup()) {
            const { radioGroup } = this.context;
            radioGroup.onChange && radioGroup.onChange(e);
        }
        !('checked' in this.props) && this.foundation.setChecked(e.target.checked);
        onChange && onChange(e);
    };

    handleMouseEnter = (e: React.MouseEvent<HTMLLabelElement>) => {
        this.props.onMouseEnter(e);
        this.foundation.setHover(true);
    };

    handleMouseLeave = (e: React.MouseEvent<HTMLLabelElement>) => {
        this.props.onMouseLeave(e);
        this.foundation.setHover(false);
    };

    handleFocusVisible = (event: React.FocusEvent) => {
        this.foundation.handleFocusVisible(event);
    }

    handleBlur = (event: React.FocusEvent) => {
        this.foundation.handleBlur();
    }

    render() {
        const {
            addonClassName,
            addonStyle,
            disabled,
            style,
            className,
            prefixCls,
            displayMode,
            children,
            extra,
            mode,
            type,
            value: propValue,
            name,
            ...rest
        } = this.props;

        let realChecked,
            isDisabled,
            realMode,
            isButtonRadioGroup,
            isCardRadioGroup,
            isPureCardRadioGroup,
            isButtonRadioComponent,
            buttonSize,
            realPrefixCls;
        const { hover: isHover, addonId, extraId, focusVisible, checked, } = this.state;
        const props: Record<string, any> = {
            checked,
            disabled,
        };

        if (this.isInGroup()) {
            realChecked = this.context.radioGroup.value === propValue;
            isDisabled = disabled || this.context.radioGroup.disabled;
            realMode = this.context.mode;
            isButtonRadioGroup = this.context.radioGroup.isButtonRadio;
            isCardRadioGroup = this.context.radioGroup.isCardRadio;
            isPureCardRadioGroup = this.context.radioGroup.isPureCardRadio;
            buttonSize = this.context.radioGroup.buttonSize;
            realPrefixCls = prefixCls || this.context.radioGroup.prefixCls;
            props.checked = realChecked;
            props.disabled = isDisabled;
        } else {
            realChecked = checked;
            isDisabled = disabled;
            realMode = mode;
            isButtonRadioComponent = type === 'button';
            realPrefixCls = prefixCls;
            isButtonRadioGroup = type === strings.TYPE_BUTTON;
            isPureCardRadioGroup = type === strings.TYPE_PURECARD;
            isCardRadioGroup = type === strings.TYPE_CARD || isPureCardRadioGroup;
        }
        const isButtonRadio = typeof isButtonRadioGroup === 'undefined' ? isButtonRadioComponent : isButtonRadioGroup;

        const prefix = realPrefixCls || css.PREFIX;

        const focusOuter = isCardRadioGroup || isPureCardRadioGroup || isButtonRadio;

        const wrapper = cls(prefix, {
            [`${prefix}-disabled`]: isDisabled,
            [`${prefix}-checked`]: realChecked,
            [`${prefix}-${displayMode}`]: Boolean(displayMode),
            [`${prefix}-buttonRadioComponent`]: isButtonRadioComponent,
            [`${prefix}-buttonRadioGroup`]: isButtonRadioGroup,
            [`${prefix}-buttonRadioGroup-${buttonSize}`]: isButtonRadioGroup && buttonSize,
            [`${prefix}-cardRadioGroup`]: isCardRadioGroup,
            [`${prefix}-cardRadioGroup_disabled`]: isDisabled && isCardRadioGroup,
            [`${prefix}-cardRadioGroup_checked`]: isCardRadioGroup && realChecked && !isDisabled,
            [`${prefix}-cardRadioGroup_checked_disabled`]: isCardRadioGroup && realChecked && isDisabled,
            [`${prefix}-cardRadioGroup_hover`]: isCardRadioGroup && !realChecked && isHover && !isDisabled,
            [className]: Boolean(className),
            [`${prefix}-focus`]: focusVisible && (isCardRadioGroup || isPureCardRadioGroup),
        });

        const groupName = this.isInGroup() && this.context.radioGroup.name;
        const addonCls = cls({
            [`${prefix}-addon`]: !isButtonRadio,
            [`${prefix}-addon-buttonRadio`]: isButtonRadio,
            [`${prefix}-addon-buttonRadio-checked`]: isButtonRadio && realChecked,
            [`${prefix}-addon-buttonRadio-disabled`]: isButtonRadio && isDisabled,
            [`${prefix}-addon-buttonRadio-hover`]: isButtonRadio && !realChecked && !isDisabled && isHover,
            [`${prefix}-addon-buttonRadio-${buttonSize}`]: isButtonRadio && buttonSize,
            [`${prefix}-focus`]: focusVisible && isButtonRadio,
        }, addonClassName);
        const renderContent = () => {
            if (!children && !extra) {
                return null;
            }
            return (
                <div className={cls([`${prefix}-content`, { [`${prefix}-isCardRadioGroup_content`]: isCardRadioGroup }])}>
                    {children ? (
                        <span className={addonCls} style={addonStyle} id={addonId} x-semi-prop="children">
                            {children}
                        </span>
                    ) : null}
                    {extra && !isButtonRadio ? (
                        <div className={`${prefix}-extra`} id={extraId} x-semi-prop="extra">
                            {extra}
                        </div>
                    ) : null}
                </div>
            );
        };

        return (
            <label
                style={style}
                className={wrapper}
                onMouseEnter={this.handleMouseEnter}
                onMouseLeave={this.handleMouseLeave}
                {...this.getDataAttr(rest)}
            >
                <RadioInner
                    {...this.props}
                    {...props}
                    mode={realMode}
                    name={name ?? groupName}
                    isButtonRadio={isButtonRadio}
                    isPureCardRadioGroup={isPureCardRadioGroup}
                    onChange={this.onChange}
                    ref={(ref: RadioInner) => {
                        this.radioEntity = ref;
                    }}
                    addonId={children && addonId}
                    extraId={extra && extraId}
                    focusInner={focusVisible && !focusOuter}
                    onInputFocus={this.handleFocusVisible}
                    onInputBlur={this.handleBlur}
                />
                {renderContent()}
            </label>
        );
    }
}
Radio.elementType = 'Radio';

export default Radio;