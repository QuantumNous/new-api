import React from 'react';
import cls from 'classnames';
import PropTypes from 'prop-types';
import InputFoundation from '@douyinfe/semi-foundation/input/foundation';
import { cssClasses, strings } from '@douyinfe/semi-foundation/input/constants';
import { isSemiIcon } from '../_utils';
import BaseComponent from '../_base/baseComponent';
import '@douyinfe/semi-foundation/input/input.scss';
import { isString, noop, isFunction, isUndefined } from 'lodash';
import { IconClear, IconEyeOpened, IconEyeClosedSolid } from '@douyinfe/semi-icons';

const prefixCls = cssClasses.PREFIX;

const sizeSet = strings.SIZE;
const statusSet = strings.STATUS;
const modeSet = strings.MODE;

export type { InputGroupProps } from './inputGroup';
export type { TextAreaProps } from './textarea';
export type InputSize = 'small' | 'large' | 'default';
export type InputMode = 'password';
// still keep success as ValidateStatus optional value because form will pass success as props.validateStatus in sometime
// Although we do not consume success in the input to configure special styles, we should allow it as a legal props value, otherwise a warning will be thrown
export type ValidateStatus = "default" | "error" | "warning" | "success";

export interface InputProps extends
    Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'prefix' | 'size' | 'placeholder' | 'onFocus' | 'onBlur'> {
    'aria-label'?: React.AriaAttributes['aria-label'];
    'aria-describedby'?: React.AriaAttributes['aria-describedby'];
    'aria-errormessage'?: React.AriaAttributes['aria-errormessage'];
    'aria-invalid'?: React.AriaAttributes['aria-invalid'];
    'aria-labelledby'?: React.AriaAttributes['aria-labelledby'];
    'aria-required'?: React.AriaAttributes['aria-required'];
    addonBefore?: React.ReactNode;
    addonAfter?: React.ReactNode;
    borderless?: boolean;
    prefix?: React.ReactNode;
    suffix?: React.ReactNode;
    mode?: InputMode;
    value?: React.ReactText;
    defaultValue?: React.ReactText;
    disabled?: boolean;
    readonly?: boolean;
    type?: string;
    showClear?: boolean;
    hideSuffix?: boolean;
    placeholder?: React.ReactText;
    insetLabel?: React.ReactNode;
    insetLabelId?: string;
    size?: InputSize;
    className?: string;
    clearIcon?: React.ReactNode;
    style?: React.CSSProperties;
    validateStatus?: ValidateStatus;
    onClear?: (e: React.MouseEvent<HTMLDivElement>) => void;
    onChange?: (value: string, e: React.ChangeEvent<HTMLInputElement>) => void;
    onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
    onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
    onInput?: (e: React.MouseEvent<HTMLInputElement>) => void;
    onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    onKeyUp?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    onKeyPress?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    onEnterPress?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    inputStyle?: React.CSSProperties;
    getValueLength?: (value: string) => number;
    forwardRef?: ((instance: any) => void) | React.MutableRefObject<any> | null;
    preventScroll?: boolean;
    /** internal prop, DatePicker use it */
    showClearIgnoreDisabled?: boolean;
    onlyBorder?: number
}

export interface InputState {
    value: React.ReactText;
    cachedValue: React.ReactText;
    disabled: boolean;
    props: Record<string, any>;
    isFocus: boolean;
    isHovering: boolean;
    eyeClosed: boolean;
    minLength: number
}

class Input extends BaseComponent<InputProps, InputState> {
    static propTypes = {
        'aria-label': PropTypes.string,
        'aria-labelledby': PropTypes.string,
        'aria-invalid': PropTypes.bool,
        'aria-errormessage': PropTypes.string,
        'aria-describedby': PropTypes.string,
        'aria-required': PropTypes.bool,
        addonBefore: PropTypes.node,
        addonAfter: PropTypes.node,
        clearIcon: PropTypes.node,
        prefix: PropTypes.node,
        suffix: PropTypes.node,
        mode: PropTypes.oneOf(modeSet),
        value: PropTypes.any,
        defaultValue: PropTypes.any,
        disabled: PropTypes.bool,
        readonly: PropTypes.bool,
        autoFocus: PropTypes.bool,
        type: PropTypes.string,
        showClear: PropTypes.bool,
        hideSuffix: PropTypes.bool,
        placeholder: PropTypes.any,
        size: PropTypes.oneOf(sizeSet),
        className: PropTypes.string,
        style: PropTypes.object,
        validateStatus: PropTypes.oneOf(statusSet),
        onClear: PropTypes.func,
        onChange: PropTypes.func,
        onBlur: PropTypes.func,
        onFocus: PropTypes.func,
        onInput: PropTypes.func,
        onKeyDown: PropTypes.func,
        onKeyUp: PropTypes.func,
        onKeyPress: PropTypes.func,
        onEnterPress: PropTypes.func,
        onCompositionStart: PropTypes.func,
        onCompositionEnd: PropTypes.func,
        onCompositionUpdate: PropTypes.func,
        insetLabel: PropTypes.node,
        insetLabelId: PropTypes.string,
        inputStyle: PropTypes.object,
        getValueLength: PropTypes.func,
        preventScroll: PropTypes.bool,
        borderless: PropTypes.bool,
    };

    static defaultProps = {
        addonBefore: '',
        addonAfter: '',
        prefix: '',
        suffix: '',
        readonly: false,
        type: 'text',
        showClear: false,
        hideSuffix: false,
        placeholder: '',
        size: 'default',
        className: '',
        onClear: noop,
        onChange: noop,
        onBlur: noop,
        onFocus: noop,
        onInput: noop,
        onKeyDown: noop,
        onKeyUp: noop,
        onKeyPress: noop,
        onEnterPress: noop,
        onCompositionStart: noop,
        onCompositionEnd: noop,
        onCompositionUpdate: noop,
        validateStatus: 'default',
        borderless: false,
    };

    inputRef!: React.RefObject<HTMLInputElement>;
    prefixRef!: React.RefObject<React.ReactNode>;
    suffixRef!: React.RefObject<React.ReactNode>;
    foundation!: InputFoundation;

    constructor(props: InputProps) {
        super(props);
        const initValue = 'value' in props ? props.value : props.defaultValue;
        this.state = {
            value: initValue,
            cachedValue: props.value, // Cache current props.value value
            disabled: false,
            props: {},
            isFocus: false,
            isHovering: false,
            eyeClosed: props.mode === 'password',
            minLength: props.minLength,
        };
        this.inputRef = React.createRef();
        this.prefixRef = React.createRef();
        this.suffixRef = React.createRef();
        this.foundation = new InputFoundation(this.adapter);
    }

    get adapter() {
        return {
            ...super.adapter,
            setValue: (value: string) => this.setState({ value }),
            setEyeClosed: (value: boolean) => this.setState({ eyeClosed: value }),
            toggleFocusing: (isFocus: boolean) => {
                this.setState({ isFocus });
            },
            focusInput: () => {
                const { preventScroll } = this.props;
                const input = this.inputRef && this.inputRef.current;
                input && input.focus({ preventScroll });
            },
            toggleHovering: (isHovering: boolean) => this.setState({ isHovering }),
            getIfFocusing: () => this.state.isFocus,
            notifyChange: (cbValue: string, e: React.ChangeEvent<HTMLInputElement>) => this.props.onChange(cbValue, e),
            notifyBlur: (val: string, e: React.FocusEvent<HTMLInputElement>) => this.props.onBlur(e),
            notifyFocus: (val: string, e: React.FocusEvent<HTMLInputElement>) => this.props.onFocus(e),
            notifyInput: (e: React.MouseEvent<HTMLInputElement>) => this.props.onInput(e),
            notifyKeyPress: (e: React.KeyboardEvent<HTMLInputElement>) => this.props.onKeyPress(e),
            notifyKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => this.props.onKeyDown(e),
            notifyKeyUp: (e: React.KeyboardEvent<HTMLInputElement>) => this.props.onKeyUp(e),
            notifyEnterPress: (e: React.KeyboardEvent<HTMLInputElement>) => this.props.onEnterPress(e),
            notifyClear: (e: React.MouseEvent<HTMLDivElement>) => this.props.onClear(e),
            notifyCompositionStart: (e: React.CompositionEvent<HTMLInputElement>) => this.props.onCompositionStart(e),
            notifyCompositionEnd: (e: React.CompositionEvent<HTMLInputElement>) => this.props.onCompositionEnd(e),
            notifyCompositionUpdate: (e: React.CompositionEvent<HTMLInputElement>) => this.props.onCompositionUpdate(e),
            setMinLength: (minLength: number) => this.setState({ minLength }),
            isEventTarget: (e: React.MouseEvent) => e && e.target === e.currentTarget,
        };
    }

    static getDerivedStateFromProps(props: InputProps, state: InputState) {
        const willUpdateStates: Partial<InputState> = {};

        if (props.value !== state.cachedValue) {
            willUpdateStates.value = props.value;
            willUpdateStates.cachedValue = props.value;
        }

        return willUpdateStates;
    }

    componentDidUpdate(prevProps: InputProps) {
        const { mode } = this.props;
        if (prevProps.mode !== mode) {
            this.handleModeChange(mode);
        }
    }

    componentDidMount(): void {
        // autofocus is changed from the original support of input to the support of manually calling the focus method,
        // so that preventScroll can still take effect under the setting of autofocus
        const { disabled, autoFocus, preventScroll } = this.props;
        if (!disabled && (autoFocus || this.props['autofocus'])) {
            this.inputRef.current.focus({ preventScroll });
        }
    }

    handleClear = (e: React.MouseEvent<HTMLInputElement>) => {
        this.foundation.handleClear(e);
    };

    handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        this.foundation.handleClick(e);
    };

    handleMouseOver = (e: React.MouseEvent<HTMLDivElement>) => {
        this.setState({ isHovering: true });
    };

    handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
        this.setState({ isHovering: false });
    };

    handleModeChange = (mode: string) => {
        this.foundation.handleModeChange(mode);
    };

    handleClickEye = (e: React.MouseEvent<HTMLInputElement>) => {
        this.foundation.handleClickEye(e);
    };

    handleMouseDown = (e: React.MouseEvent<HTMLInputElement>) => {
        this.foundation.handleMouseDown(e);
    };

    handleMouseUp = (e: React.MouseEvent<HTMLInputElement>) => {
        this.foundation.handleMouseUp(e);
    };

    handleModeEnterPress = (e: React.KeyboardEvent<HTMLDivElement>) => {
        this.foundation.handleModeEnterPress(e);
    };

    handleClickPrefixOrSuffix = (e: React.MouseEvent<HTMLInputElement>) => {
        this.foundation.handleClickPrefixOrSuffix(e);
    };

    handlePreventMouseDown = (e: React.MouseEvent<HTMLInputElement>) => {
        this.foundation.handlePreventMouseDown(e);
    };

    renderPrepend() {
        const { addonBefore } = this.props;
        if (addonBefore) {
            const prefixWrapperCls = cls({
                [`${prefixCls}-prepend`]: true,
                [`${prefixCls}-prepend-text`]: addonBefore && isString(addonBefore),
                [`${prefixCls}-prepend-icon`]: isSemiIcon(addonBefore),
            });
            return (
                <div className={prefixWrapperCls} x-semi-prop="addonBefore">
                    {addonBefore}
                </div>
            );
        }
        return null;
    }

    renderAppend() {
        const { addonAfter } = this.props;
        if (addonAfter) {
            const prefixWrapperCls = cls({
                [`${prefixCls}-append`]: true,
                [`${prefixCls}-append-text`]: addonAfter && isString(addonAfter),
                [`${prefixCls}-append-icon`]: isSemiIcon(addonAfter),
            });
            return (
                <div className={prefixWrapperCls} x-semi-prop="addonAfter">
                    {addonAfter}
                </div>
            );
        }
        return null;
    }

    renderClearBtn() {
        const clearCls = cls(`${prefixCls}-clearbtn`);
        const { clearIcon } = this.props;
        const allowClear = this.foundation.isAllowClear();
        // use onMouseDown to fix issue 1203
        if (allowClear) {
            return (
                // eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions
                <div
                    className={clearCls}
                    onMouseDown={this.handleClear}
                >
                    {clearIcon ? clearIcon : <IconClear />}
                </div>
            );
        }
        return null;
    }

    renderModeBtn() {
        const { eyeClosed } = this.state;
        const { mode, disabled } = this.props;
        const modeCls = cls(`${prefixCls}-modebtn`);
        const modeIcon = eyeClosed ? <IconEyeClosedSolid /> : <IconEyeOpened />;
        // alway show password button for a11y
        const showModeBtn = mode === 'password' && !disabled;
        const ariaLabel = eyeClosed ? 'Show password' : 'Hidden password';
        if (showModeBtn) {
            return (
                <div
                    role="button"
                    tabIndex={0}
                    aria-label={ariaLabel}
                    className={modeCls}
                    onClick={this.handleClickEye}
                    onMouseDown={this.handleMouseDown}
                    onMouseUp={this.handleMouseUp}
                    onKeyPress={this.handleModeEnterPress}
                >
                    {modeIcon}
                </div>
            );
        }
        return null;
    }

    renderPrefix() {
        const { prefix, insetLabel, insetLabelId } = this.props;
        const labelNode = prefix || insetLabel;
        if (!labelNode) {
            return null;
        }
        const prefixWrapperCls = cls({
            [`${prefixCls}-prefix`]: true,
            [`${prefixCls}-inset-label`]: insetLabel,
            [`${prefixCls}-prefix-text`]: labelNode && isString(labelNode),
            [`${prefixCls}-prefix-icon`]: isSemiIcon(labelNode),
        });

        return (
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions
            <div
                className={prefixWrapperCls}
                onMouseDown={this.handlePreventMouseDown}
                onClick={this.handleClickPrefixOrSuffix}
                id={insetLabelId}
                x-semi-prop="prefix,insetLabel"
            >
                {labelNode}
            </div>
        );
    }

    renderSuffix(suffixAllowClear: boolean) {
        const { suffix, hideSuffix } = this.props;
        if (!suffix) {
            return null;
        }
        const suffixWrapperCls = cls({
            [`${prefixCls}-suffix`]: true,
            [`${prefixCls}-suffix-text`]: suffix && isString(suffix),
            [`${prefixCls}-suffix-icon`]: isSemiIcon(suffix),
            [`${prefixCls}-suffix-hidden`]: suffixAllowClear && Boolean(hideSuffix),
        });
        return (
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions
            <div
                className={suffixWrapperCls}
                onMouseDown={this.handlePreventMouseDown}
                onClick={this.handleClickPrefixOrSuffix}
                x-semi-prop="suffix"
            >
                {suffix}
            </div>
        );
    }

    getInputRef() {
        const { forwardRef } = this.props;
        if (!isUndefined(forwardRef)) {
            if (typeof forwardRef === 'function') {
                return (node: HTMLInputElement) => {
                    forwardRef(node);
                    this.inputRef = { current: node };
                };
            } else if (Object.prototype.toString.call(forwardRef) === '[object Object]') {
                this.inputRef = forwardRef;
                return forwardRef;
            }
        }
        return this.inputRef;
    }

    render() {
        const {
            addonAfter,
            addonBefore,
            autoFocus,
            clearIcon,
            className,
            disabled,
            defaultValue,
            placeholder,
            prefix,
            mode,
            insetLabel,
            insetLabelId,
            validateStatus,
            type,
            readonly,
            size,
            suffix,
            style,
            showClear,
            onEnterPress,
            onClear,
            hideSuffix,
            inputStyle,
            forwardRef,
            maxLength,
            getValueLength,
            preventScroll,
            borderless,
            showClearIgnoreDisabled,
            onlyBorder,
            ...rest
        } = this.props;
        const { value, isFocus, minLength: stateMinLength } = this.state;
        const suffixAllowClear = this.foundation.isAllowClear();
        const suffixIsIcon = isSemiIcon(suffix);
        const ref = this.getInputRef();
        const wrapperPrefix = `${prefixCls}-wrapper`;
        const wrapperCls = cls(wrapperPrefix, className, {
            [`${prefixCls}-wrapper__with-prefix`]: prefix || insetLabel,
            [`${prefixCls}-wrapper__with-suffix`]: suffix,
            [`${prefixCls}-wrapper__with-suffix-hidden`]: suffixAllowClear && Boolean(hideSuffix),
            [`${prefixCls}-wrapper__with-suffix-icon`]: suffixIsIcon,
            [`${prefixCls}-wrapper__with-append`]: addonBefore,
            [`${prefixCls}-wrapper__with-prepend`]: addonAfter,
            [`${prefixCls}-wrapper__with-append-only`]: addonBefore && !addonAfter,
            [`${prefixCls}-wrapper__with-prepend-only`]: !addonBefore && addonAfter,
            [`${wrapperPrefix}-readonly`]: readonly,
            [`${wrapperPrefix}-disabled`]: disabled,
            [`${wrapperPrefix}-warning`]: validateStatus === 'warning',
            [`${wrapperPrefix}-error`]: validateStatus === 'error',
            [`${wrapperPrefix}-focus`]: isFocus,
            [`${wrapperPrefix}-clearable`]: showClear,
            [`${wrapperPrefix}-modebtn`]: mode === 'password',
            [`${wrapperPrefix}-hidden`]: type === 'hidden',
            [`${wrapperPrefix}-${size}`]: size,
            [`${prefixCls}-borderless`]: borderless,
            [`${prefixCls}-only_border`]: onlyBorder !== undefined && onlyBorder !== null,
        });
        const inputCls = cls(prefixCls, {
            [`${prefixCls}-${size}`]: size,
            [`${prefixCls}-disabled`]: disabled,
            [`${prefixCls}-sibling-clearbtn`]: this.foundation.isAllowClear(),
            [`${prefixCls}-sibling-modebtn`]: mode === 'password',
        });
        const inputValue = value === null || value === undefined ? '' : value;
        const inputProps: React.InputHTMLAttributes<HTMLInputElement> = {
            ...rest,
            style: inputStyle,
            className: inputCls,
            disabled,
            readOnly: readonly,
            type: this.foundation.handleInputType(type),
            placeholder: placeholder as string,
            onInput: e => this.foundation.handleInput(e),
            onChange: e => this.foundation.handleChange(e.target.value, e),
            onFocus: e => this.foundation.handleFocus(e),
            onBlur: e => this.foundation.handleBlur(e),
            onKeyUp: e => this.foundation.handleKeyUp(e),
            onKeyDown: e => this.foundation.handleKeyDown(e),
            onKeyPress: e => this.foundation.handleKeyPress(e),
            onCompositionStart: this.foundation.handleCompositionStart,
            onCompositionEnd: this.foundation.handleCompositionEnd,
            onCompositionUpdate: this.foundation.handleCompositionUpdate,
            value: inputValue,
        };
        if (!isFunction(getValueLength)) {
            inputProps.maxLength = maxLength;
        }
        if (stateMinLength) {
            inputProps.minLength = stateMinLength;
        }
        if (validateStatus === 'error') {
            inputProps['aria-invalid'] = 'true';
        }

        let wrapperStyle = { ...style };
        if (onlyBorder !== undefined) {
            wrapperStyle = {
                borderWidth: onlyBorder,
                ...style
            };
        }

        return (
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions
            <div
                className={wrapperCls}
                style={wrapperStyle}
                onMouseEnter={e => this.handleMouseOver(e)}
                onMouseLeave={e => this.handleMouseLeave(e)}
                onClick={e => this.handleClick(e)}
            >
                {this.renderPrepend()}
                {this.renderPrefix()}
                <input {...inputProps} ref={ref} />
                {this.renderClearBtn()}
                {this.renderSuffix(suffixAllowClear)}
                {this.renderModeBtn()}
                {this.renderAppend()}
            </div>
        );
    }
}

const ForwardInput = React.forwardRef<HTMLInputElement, Omit<InputProps, 'forwardRef'>>((props, ref) => <Input {...props} forwardRef={ref} />);

export default ForwardInput;

export { Input };
