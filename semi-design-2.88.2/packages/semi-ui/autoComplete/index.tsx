import React, { ReactNode } from 'react';
import PropTypes from 'prop-types';
import cls from 'classnames';
import { isEqual, noop } from 'lodash';

import { strings, cssClasses } from '@douyinfe/semi-foundation/autoComplete/constants';
import AutoCompleteFoundation, { AutoCompleteAdapter, StateOptionItem, DataItem } from '@douyinfe/semi-foundation/autoComplete/foundation';
import { numbers as popoverNumbers } from '@douyinfe/semi-foundation/popover/constants';
import { getUuidShort } from '@douyinfe/semi-foundation/utils/uuid';
import BaseComponent, { ValidateStatus } from '../_base/baseComponent';
import { Position } from '../tooltip';
import Spin from '../spin';
import Popover from '../popover';
import Input from '../input';
import Trigger from '../trigger';

import Option from './option';
import warning from '@douyinfe/semi-foundation/utils/warning';
import '@douyinfe/semi-foundation/autoComplete/autoComplete.scss';
import ReactDOM from 'react-dom';
import { getDefaultPropsFromGlobalConfig } from "../_utils";

const prefixCls = cssClasses.PREFIX;
const sizeSet = strings.SIZE;
const positionSet = strings.POSITION;
const statusSet = strings.STATUS;

/**
 * AutoComplete is an enhanced Input (candidates suggest that users can choose or not),
 * and the Select positioning that supports Search is still a selector.
 * 1. When you click to expand, Select will clear all input values, but AutoComplete will not
 * 2. AutoComplete's renderSelectedItem only supports simple string returns, while Select's renderSelectedItem can return ReactNode
 * 3. Select props.value supports incoming object, but autoComplete only supports string (because the value needs to be displayed in Input)
 */

export interface BaseDataItem extends DataItem {
    label?: React.ReactNode
}

export type AutoCompleteItems = BaseDataItem | string | number;

export interface AutoCompleteProps<T extends AutoCompleteItems> {
    'aria-describedby'?: React.AriaAttributes['aria-describedby'];
    'aria-errormessage'?: React.AriaAttributes['aria-errormessage'];
    'aria-invalid'?: React.AriaAttributes['aria-invalid'];
    'aria-label'?: React.AriaAttributes['aria-label'];
    'aria-labelledby'?: React.AriaAttributes['aria-labelledby'];
    'aria-required'?: React.AriaAttributes['aria-required'];
    autoAdjustOverflow?: boolean;
    autoFocus?: boolean;
    className?: string;
    clearIcon?: ReactNode;
    children?: ReactNode;
    data?: T[];
    disabled?: boolean;
    defaultOpen?: boolean;
    defaultValue?: T;
    defaultActiveFirstOption?: boolean;
    dropdownMatchSelectWidth?: boolean;
    dropdownClassName?: string;
    dropdownStyle?: React.CSSProperties;
    emptyContent?: React.ReactNode;
    getPopupContainer?: () => HTMLElement;
    insetLabel?: React.ReactNode;
    insetLabelId?: string;
    id?: string;
    loading?: boolean;
    motion?: boolean;
    maxHeight?: string | number;
    mouseEnterDelay?: number;
    mouseLeaveDelay?: number;
    onFocus?: (e: React.FocusEvent) => void;
    onBlur?: (e: React.FocusEvent) => void;
    onChange?: (value: string | number) => void;
    onSearch?: (inputValue: string) => void;
    onSelect?: (value: T) => void;
    onClear?: () => void;
    onChangeWithObject?: boolean;
    onSelectWithObject?: boolean;
    onDropdownVisibleChange?: (visible: boolean) => void;
    onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    prefix?: React.ReactNode;
    placeholder?: string;
    position?: Position;
    renderItem?: (option: T) => React.ReactNode;
    renderSelectedItem?: (option: T) => string;
    size?: 'small' | 'default' | 'large';
    style?: React.CSSProperties;
    suffix?: React.ReactNode;
    showClear?: boolean;
    triggerRender?: (props?: any) => React.ReactNode;
    stopPropagation?: boolean | string;
    value?: string | number;
    validateStatus?: ValidateStatus;
    zIndex?: number
}

interface KeyboardEventType {
    onKeyDown?: React.KeyboardEventHandler
}

interface AutoCompleteState {
    dropdownMinWidth: null | number;
    inputValue: string | undefined | number;
    options: StateOptionItem[];
    visible: boolean;
    focusIndex: number;
    selection: Map<any, any>;
    rePosKey: number;
    keyboardEventSet?: KeyboardEventType
}

class AutoComplete<T extends AutoCompleteItems> extends BaseComponent<AutoCompleteProps<T>, AutoCompleteState> {
    static propTypes = {
        'aria-label': PropTypes.string,
        'aria-labelledby': PropTypes.string,
        'aria-invalid': PropTypes.bool,
        'aria-errormessage': PropTypes.string,
        'aria-describedby': PropTypes.string,
        'aria-required': PropTypes.bool,
        autoFocus: PropTypes.bool,
        autoAdjustOverflow: PropTypes.bool,
        className: PropTypes.string,
        clearIcon: PropTypes.node,
        children: PropTypes.node,
        data: PropTypes.array,
        defaultOpen: PropTypes.bool,
        defaultValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        defaultActiveFirstOption: PropTypes.bool,
        disabled: PropTypes.bool,
        dropdownMatchSelectWidth: PropTypes.bool,
        dropdownClassName: PropTypes.string,
        dropdownStyle: PropTypes.object,
        emptyContent: PropTypes.node,
        id: PropTypes.string,
        insetLabel: PropTypes.node,
        insetLabelId: PropTypes.string,
        onSearch: PropTypes.func,
        onSelect: PropTypes.func,
        onClear: PropTypes.func,
        onBlur: PropTypes.func,
        onFocus: PropTypes.func,
        onChange: PropTypes.func,
        onKeyDown: PropTypes.func,
        position: PropTypes.oneOf(positionSet),
        placeholder: PropTypes.string,
        prefix: PropTypes.node,
        onChangeWithObject: PropTypes.bool,
        onSelectWithObject: PropTypes.bool,
        renderItem: PropTypes.func,
        renderSelectedItem: PropTypes.func,
        suffix: PropTypes.node,
        showClear: PropTypes.bool,
        size: PropTypes.oneOf(sizeSet),
        style: PropTypes.object,
        stopPropagation: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
        maxHeight: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        mouseEnterDelay: PropTypes.number,
        mouseLeaveDelay: PropTypes.number,
        motion: PropTypes.oneOfType([PropTypes.bool, PropTypes.func, PropTypes.object]),
        getPopupContainer: PropTypes.func,
        triggerRender: PropTypes.func,
        value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        validateStatus: PropTypes.oneOf(statusSet),
        zIndex: PropTypes.number,
    };

    static Option = Option;

    static __SemiComponentName__ = "AutoComplete";

    static defaultProps = getDefaultPropsFromGlobalConfig(AutoComplete.__SemiComponentName__, {
        stopPropagation: true,
        motion: true,
        zIndex: popoverNumbers.DEFAULT_Z_INDEX,
        position: 'bottomLeft' as const,
        data: [] as [],
        showClear: false,
        size: 'default' as const,
        onFocus: noop,
        onSearch: noop,
        onClear: noop,
        onBlur: noop,
        onSelect: noop,
        onChange: noop,
        onSelectWithObject: false,
        onDropdownVisibleChange: noop,
        defaultActiveFirstOption: false,
        dropdownMatchSelectWidth: true,
        loading: false,
        maxHeight: 300,
        validateStatus: 'default' as const,
        autoFocus: false,
        emptyContent: null as null,
        onKeyDown: noop,
        // onPressEnter: () => undefined,
        // defaultOpen: false,
    });

    triggerRef: React.RefObject<HTMLDivElement> | null;
    optionsRef: React.RefObject<HTMLDivElement> | null;
    optionContainerEl: React.RefObject<HTMLDivElement> | null;
    optionListId: string;

    private clickOutsideHandler: (e: Event) => void | null;

    constructor(props: AutoCompleteProps<T>) {
        super(props);
        this.foundation = new AutoCompleteFoundation(this.adapter);
        const initRePosKey = 1;
        this.state = {
            dropdownMinWidth: null,
            inputValue: '',
            // option list
            options: [],
            // popover visible
            visible: false,
            // current focus option index
            focusIndex: props.defaultActiveFirstOption ? 0 : -1,
            // current selected options
            selection: new Map(),
            rePosKey: initRePosKey,
        };
        this.triggerRef = React.createRef();
        this.optionsRef = React.createRef();
        this.optionContainerEl = React.createRef();
        this.clickOutsideHandler = null;
        this.optionListId = '';

        warning(
            'triggerRender' in this.props && typeof this.props.triggerRender === 'function',
            `[Semi AutoComplete]
            - If you are using the following props: 'suffix', 'prefix', 'showClear', 'validateStatus', and 'size',
            please notice that they will be removed in the next major version.
            Please use 'componentProps' to retrieve these props instead.
            - If you are using 'onBlur', 'onFocus', please try to avoid using them and look for changes in the future.`
        );
    }

    get adapter(): AutoCompleteAdapter<AutoCompleteProps<T>, AutoCompleteState> {
        const keyboardAdapter = {
            registerKeyDown: (cb: any): void => {
                const keyboardEventSet = {
                    onKeyDown: cb,
                };
                this.setState({ keyboardEventSet });
            },
            unregisterKeyDown: (cb: any): void => {
                this.setState({ keyboardEventSet: {} });
            },
            updateFocusIndex: (focusIndex: number): void => {
                this.setState({ focusIndex });
            },
            updateScrollTop: (index?: number) => {
                let optionClassName;
                /**
                 * Unlike Select which needs to process renderOptionItem separately, when renderItem is enabled in autocomplete
                 *  the content passed by the user is still wrapped in the selector of .semi-autocomplete-option
                 * so the selector does not need to be judged separately.
                 */
                optionClassName = `.${prefixCls}-option-selected`;
                if (index !== undefined) {
                    optionClassName = `.${prefixCls}-option:nth-child(${index + 1})`;
                }

                let destNode = document.querySelector(`#${prefixCls}-${this.optionListId} ${optionClassName}`) as HTMLDivElement;
                if (Array.isArray(destNode)) {
                    destNode = destNode[0];
                }
                if (destNode) {
                    const destParent = destNode.parentNode as HTMLDivElement;
                    destParent.scrollTop = destNode.offsetTop -
                        destParent.offsetTop -
                        (destParent.clientHeight / 2) +
                        (destNode.clientHeight / 2);
                }
            },
        };
        return {
            ...super.adapter,
            ...keyboardAdapter,
            getTriggerWidth: () => {
                const el = this.triggerRef.current;
                return el && el.getBoundingClientRect().width;
            },
            setOptionWrapperWidth: width => {
                this.setState({ dropdownMinWidth: width });
            },
            updateInputValue: inputValue => {
                this.setState({ inputValue });
            },
            toggleListVisible: isShow => {
                this.setState({ visible: isShow });
            },
            updateOptionList: optionList => {
                this.setState({ options: optionList });
            },
            updateSelection: selection => {
                this.setState({ selection });
            },
            notifySearch: inputValue => {
                this.props.onSearch(inputValue);
            },
            notifyChange: value => {
                this.props.onChange(value);
            },
            notifySelect: (option: StateOptionItem | string | number): void => {
                this.props.onSelect(option as T);
            },
            notifyDropdownVisibleChange: (isVisible: boolean): void => {
                this.props.onDropdownVisibleChange(isVisible);
            },
            notifyClear: () => {
                this.props.onClear();
            },
            notifyFocus: (event: React.FocusEvent) => {
                this.props.onFocus(event);
            },
            notifyBlur: (event: React.FocusEvent) => {
                this.props.onBlur(event);
            },
            notifyKeyDown: e => {
                this.props.onKeyDown(e);
            },
            rePositionDropdown: () => {
                let { rePosKey } = this.state;
                rePosKey = rePosKey + 1;
                this.setState({ rePosKey });
            },
            registerClickOutsideHandler: cb => {
                const clickOutsideHandler = (e: Event) => {
                    const triggerDom = this.triggerRef && this.triggerRef.current;
                    const optionsDom = this.optionContainerEl && this.optionContainerEl.current;
                    const target = e.target as Element;
                    const path = e.composedPath && e.composedPath() || [target];
                    if (
                        optionsDom &&
                        (!optionsDom.contains(target) || !optionsDom.contains(target.parentNode)) &&
                        triggerDom &&
                        !triggerDom.contains(target) &&
                        !(path.includes(triggerDom) || path.includes(optionsDom))
                    ) {
                        cb(e);
                    }
                };
                this.clickOutsideHandler = clickOutsideHandler;
                document.addEventListener('mousedown', clickOutsideHandler, false);
            },
            unregisterClickOutsideHandler: () => {
                if (this.clickOutsideHandler) {
                    document.removeEventListener('mousedown', this.clickOutsideHandler, false);
                }
            },
        };
    }

    componentDidMount() {
        this.foundation.init();
        this.optionListId = getUuidShort();
    }

    componentWillUnmount() {
        this.foundation.destroy();
    }

    componentDidUpdate(prevProps: AutoCompleteProps<T>, prevState: AutoCompleteState) {
        if (!isEqual(this.props.data, prevProps.data)) {
            this.foundation.handleDataChange(this.props.data);
        }
        if (this.props.value !== prevProps.value) {
            this.foundation.handleValueChange(this.props.value);
        }
    }

    onSelect = (option: StateOptionItem, optionIndex: number, e: React.MouseEvent | React.KeyboardEvent): void => {
        this.foundation.handleSelect(option, optionIndex);
    };

    onSearch = (value: string): void => {
        this.foundation.handleSearch(value);
    };

    onBlur = (e: React.FocusEvent): void => this.foundation.handleBlur(e);

    onFocus = (e: React.FocusEvent): void => this.foundation.handleFocus(e);

    onInputClear = (): void => this.foundation.handleClear();

    handleInputClick = (e: React.MouseEvent): void => this.foundation.handleInputClick(e);

    renderInput(): React.ReactNode {
        const {
            size,
            prefix,
            insetLabel,
            insetLabelId,
            suffix,
            placeholder,
            style,
            className,
            showClear,
            disabled,
            triggerRender,
            validateStatus,
            autoFocus,
            value,
            id,
            clearIcon
        } = this.props;
        const { inputValue, keyboardEventSet, selection } = this.state;

        const useCustomTrigger = typeof triggerRender === 'function';

        const outerProps = {
            style,
            className: useCustomTrigger
                ? cls(className)
                : cls(
                    {
                        [prefixCls]: true,
                        [`${prefixCls}-disabled`]: disabled,
                    },
                    className
                ),
            onClick: this.handleInputClick,
            ref: this.triggerRef,
            id,
            ...keyboardEventSet,
            // tooltip give tabindex 0 to children by default, autoComplete just need the input get focus, so outer div's tabindex set to -1
            tabIndex: -1,
            ...this.getDataAttr(this.props)
        };

        const innerProps = {
            disabled,
            placeholder,
            autoFocus: autoFocus,
            onChange: this.onSearch,
            onClear: this.onInputClear,
            'aria-label': this.props['aria-label'],
            'aria-labelledby': this.props['aria-labelledby'],
            'aria-invalid': this.props['aria-invalid'],
            'aria-errormessage': this.props['aria-errormessage'],
            'aria-describedby': this.props['aria-describedby'],
            'aria-required': this.props['aria-required'],
            // TODO: remove in next major version
            suffix,
            prefix: prefix || insetLabel,
            insetLabelId,
            showClear,
            validateStatus,
            size,
            onBlur: this.onBlur,
            onFocus: this.onFocus,
            clearIcon,
        };

        return (
            <div {...outerProps}>
                {typeof triggerRender === 'function' ? (
                    <Trigger
                        {...innerProps}
                        inputValue={(typeof value !== 'undefined' ? value : inputValue) as string}
                        value={Array.from(selection.values())}
                        triggerRender={triggerRender}
                        componentName="AutoComplete"
                        componentProps={{ ...this.props }}
                    />
                ) : (
                    <Input {...innerProps} value={typeof value !== 'undefined' ? value : inputValue} />
                )}
            </div>
        );
    }

    renderLoading() {
        const loadingWrapperCls = `${prefixCls}-loading-wrapper`;
        return (
            <div className={loadingWrapperCls}>
                <Spin />
            </div>
        );
    }

    renderOption(option: StateOptionItem, optionIndex: number): React.ReactNode {
        const { focusIndex } = this.state;
        const isFocused = optionIndex === focusIndex;

        return (
            <Option
                showTick={false}
                onSelect={(v: StateOptionItem, e: React.MouseEvent | React.KeyboardEvent) => this.onSelect(v, optionIndex, e)}
                // selected={selection.has(option.label)}
                focused={isFocused}
                onMouseEnter={() => this.foundation.handleOptionMouseEnter(optionIndex)}
                key={option.key || option.label + option.value + optionIndex}
                {...option}
            >
                {option.label}
            </Option>
        );
    }

    renderOptionList(): React.ReactNode {
        const { maxHeight, dropdownStyle, dropdownClassName, loading, emptyContent } = this.props;
        const { options, dropdownMinWidth } = this.state;
        const listCls = cls(
            {
                [`${prefixCls}-option-list`]: true,
            },
            dropdownClassName
        );

        let optionsNode;

        if (options.length === 0) {
            optionsNode = emptyContent;
        } else {
            optionsNode = options.filter(option => option.show).map((option, i) => this.renderOption(option, i));
        }

        const style = {
            maxHeight: maxHeight,
            minWidth: dropdownMinWidth,
            ...dropdownStyle,
        };
        return (
            <div
                ref={this.optionContainerEl}
                className={listCls}
                role="listbox"
                style={style}
                id={`${prefixCls}-${this.optionListId}`}
            >
                {!loading ? optionsNode : this.renderLoading()}
            </div>
        );
    }

    render(): React.ReactNode {
        const {
            position,
            motion,
            zIndex,
            mouseEnterDelay,
            mouseLeaveDelay,
            autoAdjustOverflow,
            stopPropagation,
            getPopupContainer,
        } = this.props;
        const { visible, rePosKey } = this.state;
        const input = this.renderInput();
        const optionList = this.renderOptionList();
        return (
            <Popover
                mouseEnterDelay={mouseEnterDelay}
                mouseLeaveDelay={mouseLeaveDelay}
                autoAdjustOverflow={autoAdjustOverflow}
                trigger="custom"
                motion={motion}
                visible={visible}
                content={optionList}
                position={position}
                ref={this.optionsRef as any}
                // TransformFromCenter TODO: need to confirm
                zIndex={zIndex}
                stopPropagation={stopPropagation}
                getPopupContainer={getPopupContainer}
                rePosKey={rePosKey}
            >
                {input}
            </Popover>
        );
    }
}

export default AutoComplete;
