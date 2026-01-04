import React, { Fragment, MouseEvent, ReactInstance, ReactNode } from 'react';
import ReactDOM from 'react-dom';
import cls from 'classnames';
import PropTypes from 'prop-types';
import ConfigContext, { ContextValue } from '../configProvider/context';
import SelectFoundation, { SelectAdapter } from '@douyinfe/semi-foundation/select/foundation';
import { cssClasses, strings, numbers } from '@douyinfe/semi-foundation/select/constants';
import BaseComponent, { ValidateStatus } from '../_base/baseComponent';
import { isEqual, isString, noop, get, isNumber, isFunction } from 'lodash';
import Tag from '../tag/index';
import TagGroup from '../tag/group';
import OverflowList from '../overflowList/index';
import Space from '../space/index';
import Text from '../typography/text';
import LocaleConsumer from '../locale/localeConsumer';
import Popover, { PopoverProps } from '../popover/index';
import { numbers as popoverNumbers } from '@douyinfe/semi-foundation/popover/constants';
import Event from '@douyinfe/semi-foundation/utils/Event';
import { FixedSizeList as List } from 'react-window';
import { getOptionsFromGroup } from './utils';
import VirtualRow from './virtualRow';

import Input, { InputProps } from '../input/index';
import Option, { OptionProps } from './option';
import OptionGroup from './optionGroup';
import Spin from '../spin';
import Trigger from '../trigger';
import { IconChevronDown, IconClear, IconSearch } from '@douyinfe/semi-icons';
import { isSemiIcon, getFocusableElements, getActiveElement, getDefaultPropsFromGlobalConfig } from '../_utils';
import { getUuidShort } from '@douyinfe/semi-foundation/utils/uuid';

import '@douyinfe/semi-foundation/select/select.scss';
import type { Locale } from '../locale/interface';
import type { Position, TooltipProps } from '../tooltip';
import type { Subtract } from 'utility-types';

export type { OptionProps } from './option';
export type { OptionGroupProps } from './optionGroup';
export type { VirtualRowProps } from './virtualRow';

const prefixcls = cssClasses.PREFIX;

const key = 0;

type ExcludeInputType = {
    value?: InputProps['value'];
    onFocus?: InputProps['onFocus'];
    onChange?: InputProps['onChange']
}

type OnChangeValueType = string | number | Record<string, any>;
export interface optionRenderProps {
    key?: any;
    label?: React.ReactNode;
    value?: string | number;
    style?: React.CSSProperties;
    className?: string;
    selected?: boolean;
    focused?: boolean;
    show?: boolean;
    disabled?: boolean;
    onMouseEnter?: (e: React.MouseEvent) => any;
    onClick?: (e: React.MouseEvent) => any;
    [x: string]: any
}

export interface SelectedItemProps {
    value: OptionProps['value'];
    label: OptionProps['label'];
    _show?: boolean;
    _selected: boolean;
    _scrollIndex?: number
}

export interface TriggerRenderProps {
    value: SelectedItemProps[];
    inputValue: string;
    onSearch: (inputValue: string) => void;
    onClear: () => void;
    onRemove: (option: OptionProps) => void;
    disabled: boolean;
    placeholder: string;
    componentProps: Record<string, any>
}

export interface selectMethod {
    clearInput?: () => void;
    selectAll?: () => void;
    deselectAll?: () => void;
    focus?: () => void;
    close?: () => void;
    open?: () => void
}
export type SelectSize = 'small' | 'large' | 'default';

export interface virtualListProps {
    itemSize?: number;
    height?: number;
    width?: string | number
}

export type RenderSingleSelectedItemFn = (optionNode: Record<string, any>) => React.ReactNode;
export type RenderMultipleSelectedItemFn = (optionNode: Record<string, any>, multipleProps: { index: number; disabled: boolean; onClose: (tagContent: React.ReactNode, e: MouseEvent) => void }) => { isRenderInTag: boolean; content: React.ReactNode };

export type RenderSelectedItemFn = RenderSingleSelectedItemFn | RenderMultipleSelectedItemFn;

export type SelectProps = {
    'aria-describedby'?: React.AriaAttributes['aria-describedby'];
    'aria-errormessage'?: React.AriaAttributes['aria-errormessage'];
    'aria-invalid'?: React.AriaAttributes['aria-invalid'];
    'aria-labelledby'?: React.AriaAttributes['aria-labelledby'];
    'aria-required'?: React.AriaAttributes['aria-required'];
    id?: string;
    autoFocus?: boolean;
    autoClearSearchValue?: boolean;
    arrowIcon?: React.ReactNode;
    borderless?: boolean;
    clearIcon?: React.ReactNode;
    defaultValue?: string | number | any[] | Record<string, any>;
    value?: string | number | any[] | Record<string, any>;
    placeholder?: React.ReactNode;
    onChange?: (value: SelectProps['value']) => void;
    multiple?: boolean;
    filter?: boolean | ((inpueValue: string, option: OptionProps) => boolean);
    max?: number;
    maxTagCount?: number;
    maxHeight?: string | number;
    style?: React.CSSProperties;
    className?: string;
    size?: SelectSize;
    disabled?: boolean;
    emptyContent?: React.ReactNode;
    expandRestTagsOnClick?: boolean;
    onDropdownVisibleChange?: (visible: boolean) => void;
    zIndex?: number;
    position?: Position;
    onSearch?: (value: string, event: React.KeyboardEvent | React.MouseEvent) => void;
    dropdownClassName?: string;
    dropdownStyle?: React.CSSProperties;
    dropdownMargin?: PopoverProps['margin'];
    ellipsisTrigger?: boolean;
    outerTopSlot?: React.ReactNode;
    innerTopSlot?: React.ReactNode;
    outerBottomSlot?: React.ReactNode;
    innerBottomSlot?: React.ReactNode;
    optionList?: OptionProps[];
    dropdownMatchSelectWidth?: boolean;
    loading?: boolean;
    defaultOpen?: boolean;
    validateStatus?: ValidateStatus;
    defaultActiveFirstOption?: boolean;
    onChangeWithObject?: boolean;
    suffix?: React.ReactNode;
    searchPosition?: string;
    searchPlaceholder?: string;
    prefix?: React.ReactNode;
    insetLabel?: React.ReactNode;
    insetLabelId?: string;
    inputProps?: Subtract<InputProps, ExcludeInputType>;
    showClear?: boolean;
    showArrow?: boolean;
    renderSelectedItem?: RenderSelectedItemFn;
    renderCreateItem?: (inputValue: OptionProps['value'], focus: boolean, style?: React.CSSProperties) => React.ReactNode;
    renderOptionItem?: (props: optionRenderProps) => React.ReactNode;
    onMouseEnter?: (e: React.MouseEvent) => any;
    onMouseLeave?: (e: React.MouseEvent) => any;
    clickToHide?: boolean;
    onExceed?: (option: OptionProps) => void;
    onCreate?: (option: OptionProps) => void;
    remote?: boolean;
    onDeselect?: (value: SelectProps['value'], option: Record<string, any>) => void;
    onSelect?: (value: SelectProps['value'], option: Record<string, any>) => void;
    allowCreate?: boolean;
    triggerRender?: (props: TriggerRenderProps) => React.ReactNode;
    onClear?: () => void;
    virtualize?: virtualListProps;
    onFocus?: (e: React.FocusEvent) => void;
    onBlur?: (e: React.FocusEvent) => void;
    onListScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
    children?: React.ReactNode;
    preventScroll?: boolean;
    showRestTagsPopover?: boolean;
    restTagsPopoverProps?: PopoverProps
} & Pick<
TooltipProps,
| 'spacing'
| 'getPopupContainer'
| 'motion'
| 'autoAdjustOverflow'
| 'mouseLeaveDelay'
| 'mouseEnterDelay'
| 'stopPropagation'
> & React.RefAttributes<any>;

export interface SelectState {
    isOpen: boolean;
    isFocus: boolean;
    options: Array<OptionProps>;
    selections: Map<OptionProps['label'], any>; // A collection of all currently selected items, k: label, v: {value,... otherProps}
    dropdownMinWidth: number;
    optionKey: number;
    inputValue: string;
    showInput: boolean;
    focusIndex: number;
    keyboardEventSet: any; // {}
    optionGroups: Array<any>;
    isHovering: boolean;
    isFocusInContainer: boolean;
    isFullTags: boolean;
    // The number of really-hidden items when maxTagCount is set
    overflowItemCount: number
}

// Notes: Use the label of the option as the identifier, that is, the option in Select, the value is allowed to be the same, but the label must be unique

class Select extends BaseComponent<SelectProps, SelectState> {
    static contextType = ConfigContext;

    static Option = Option;

    static OptGroup = OptionGroup;

    static propTypes = {
        'aria-describedby': PropTypes.string,
        'aria-errormessage': PropTypes.string,
        'aria-invalid': PropTypes.bool,
        'aria-labelledby': PropTypes.string,
        'aria-required': PropTypes.bool,
        autoFocus: PropTypes.bool,
        autoClearSearchValue: PropTypes.bool,
        borderless: PropTypes.bool,
        children: PropTypes.node,
        clearIcon: PropTypes.node,
        defaultValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.array, PropTypes.object]),
        ellipsisTrigger: PropTypes.bool,
        value: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.array, PropTypes.object]),
        placeholder: PropTypes.node,
        onChange: PropTypes.func,
        multiple: PropTypes.bool,
        // Whether to turn on the input box filtering function, when it is a function, it represents a custom filtering function
        filter: PropTypes.oneOfType([PropTypes.func, PropTypes.bool]),
        // How many tags can you choose?
        max: PropTypes.number,
        // How many tabs are displayed at most, and the rest are displayed in + N
        maxTagCount: PropTypes.number,
        maxHeight: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        style: PropTypes.object,
        className: PropTypes.string,
        size: PropTypes.oneOf<SelectProps['size']>(strings.SIZE_SET),
        disabled: PropTypes.bool,
        emptyContent: PropTypes.node,
        expandRestTagsOnClick: PropTypes.bool,
        onDropdownVisibleChange: PropTypes.func,
        zIndex: PropTypes.number,
        position: PropTypes.oneOf(strings.POSITION_SET),
        onSearch: PropTypes.func,
        getPopupContainer: PropTypes.func,
        dropdownClassName: PropTypes.string,
        dropdownStyle: PropTypes.object,
        dropdownMargin: PropTypes.oneOfType([PropTypes.number, PropTypes.object]),
        outerTopSlot: PropTypes.node,
        innerTopSlot: PropTypes.node,
        inputProps: PropTypes.object,
        outerBottomSlot: PropTypes.node,
        innerBottomSlot: PropTypes.node, // Options slot
        optionList: PropTypes.array,
        dropdownMatchSelectWidth: PropTypes.bool,
        loading: PropTypes.bool,
        defaultOpen: PropTypes.bool,
        validateStatus: PropTypes.oneOf(strings.STATUS),
        defaultActiveFirstOption: PropTypes.bool,
        triggerRender: PropTypes.func,
        stopPropagation: PropTypes.bool,
        searchPosition: PropTypes.string,
        // motion doesn't need to be exposed
        motion: PropTypes.bool,

        onChangeWithObject: PropTypes.bool,

        suffix: PropTypes.node,
        prefix: PropTypes.node,
        insetLabel: PropTypes.node,
        insetLabelId: PropTypes.string,
        showClear: PropTypes.bool,
        showArrow: PropTypes.bool,

        renderSelectedItem: PropTypes.func,

        allowCreate: PropTypes.bool,
        renderCreateItem: PropTypes.func,

        onMouseEnter: PropTypes.func,
        onMouseLeave: PropTypes.func,
        clickToHide: PropTypes.bool,
        onExceed: PropTypes.func,
        onCreate: PropTypes.func,
        remote: PropTypes.bool,
        onDeselect: PropTypes.func,
        // The main difference between onSelect and onChange is that when multiple selections are selected, onChange contains all options, while onSelect only contains items for the current operation
        onSelect: PropTypes.func,
        autoAdjustOverflow: PropTypes.bool,
        mouseEnterDelay: PropTypes.number,
        mouseLeaveDelay: PropTypes.number,
        spacing: PropTypes.oneOfType([PropTypes.number, PropTypes.object]),
        onBlur: PropTypes.func,
        onFocus: PropTypes.func,
        onClear: PropTypes.func,

        virtualize: PropTypes.object,
        renderOptionItem: PropTypes.func,
        onListScroll: PropTypes.func,
        arrowIcon: PropTypes.node,
        preventScroll: PropTypes.bool,
        // open: PropTypes.bool,
        // tagClosable: PropTypes.bool,
    };

    static __SemiComponentName__ = "Select";
    
    static defaultProps: Partial<SelectProps> = getDefaultPropsFromGlobalConfig(Select.__SemiComponentName__, {
        stopPropagation: true,
        motion: true,
        borderless: false,
        zIndex: popoverNumbers.DEFAULT_Z_INDEX,
        // position: 'bottomLeft',
        filter: false,
        multiple: false,
        disabled: false,
        defaultOpen: false,
        allowCreate: false,
        placeholder: '',
        onDropdownVisibleChange: noop,
        onChangeWithObject: false,
        onChange: noop,
        onSearch: noop,
        onMouseEnter: noop,
        onMouseLeave: noop,
        onDeselect: noop,
        onSelect: noop,
        onCreate: noop,
        onExceed: noop,
        onFocus: noop,
        onBlur: noop,
        onClear: noop,
        onListScroll: noop,
        maxHeight: numbers.LIST_HEIGHT,
        dropdownMatchSelectWidth: true,
        defaultActiveFirstOption: true, // In order to meet the needs of A11y, change to true
        showArrow: true,
        showClear: false,
        searchPosition: strings.SEARCH_POSITION_TRIGGER,
        remote: false,
        autoAdjustOverflow: true,
        autoClearSearchValue: true,
        arrowIcon: <IconChevronDown aria-label='' />,
        showRestTagsPopover: false,
        restTagsPopoverProps: {},
        expandRestTagsOnClick: false,
        ellipsisTrigger: false,
        // Radio selection is different from the default renderSelectedItem for multiple selection, so it is not declared here
        // renderSelectedItem: (optionNode) => optionNode.label,
        // The default creator rendering is related to i18, so it is not declared here
        // renderCreateItem: (input) => input
    })

    inputRef: React.RefObject<HTMLInputElement>;
    dropdownInputRef: React.RefObject<HTMLInputElement>;
    triggerRef: React.RefObject<HTMLDivElement>;
    optionContainerEl: React.RefObject<HTMLDivElement>;
    optionsRef: React.RefObject<any>;
    virtualizeListRef: React.RefObject<any>;
    selectOptionListID: string;
    selectID: string;
    clickOutsideHandler: (e: MouseEvent) => void;
    foundation: SelectFoundation;
    context: ContextValue;
    eventManager: Event;

    constructor(props: SelectProps) {
        super(props);
        this.state = {
            isOpen: false,
            isFocus: false,
            options: [], // All options
            selections: new Map(), // A collection of all currently selected items, k: label, v: {value,... otherProps}
            dropdownMinWidth: null,
            optionKey: key,
            inputValue: '',
            showInput: false,
            focusIndex: props.defaultActiveFirstOption ? 0 : -1,
            keyboardEventSet: {},
            optionGroups: [],
            isHovering: false,
            isFocusInContainer: false,
            isFullTags: false,
            overflowItemCount: 0
        };
        /* Generate random string */
        this.selectOptionListID = '';
        this.selectID = '';
        this.virtualizeListRef = React.createRef();
        this.inputRef = React.createRef();
        this.dropdownInputRef = React.createRef(); // only work when searchPosition = 'dropdown'
        this.triggerRef = React.createRef();
        this.optionsRef = React.createRef();
        this.optionContainerEl = React.createRef();
        this.clickOutsideHandler = null;
        this.onSelect = this.onSelect.bind(this);
        this.onClear = this.onClear.bind(this);
        this.onMouseEnter = this.onMouseEnter.bind(this);
        this.onMouseLeave = this.onMouseLeave.bind(this);
        this.renderOption = this.renderOption.bind(this);
        this.onKeyPress = this.onKeyPress.bind(this);
        this.eventManager = new Event();

        this.foundation = new SelectFoundation(this.adapter);
    }

    setOptionContainerEl = (node: HTMLDivElement) => (this.optionContainerEl = { current: node });

    get adapter(): SelectAdapter<SelectProps, SelectState> {
        const keyboardAdapter = {
            registerKeyDown: (cb: () => void) => {
                const keyboardEventSet = {
                    onKeyDown: cb,
                };
                this.setState({ keyboardEventSet });
            },
            unregisterKeyDown: () => {
                this.setState({ keyboardEventSet: {} });
            },
            updateFocusIndex: (focusIndex: number) => {
                this.setState({ focusIndex });
            },
            scrollToFocusOption: () => { },
        };

        const filterAdapter = {
            updateInputValue: (value: string) => {
                this.setState({ inputValue: value });
            },
            toggleInputShow: (showInput: boolean, cb: (...args: any) => void) => {
                this.setState({ showInput }, () => {
                    cb();
                });
            },
            focusInput: () => {
                const { preventScroll } = this.props;
                if (this.inputRef && this.inputRef.current) {
                    this.inputRef.current.focus({ preventScroll });
                }
            },
            focusDropdownInput: () => {
                const { preventScroll } = this.props;
                if (this.dropdownInputRef && this.dropdownInputRef.current) {
                    this.dropdownInputRef.current.focus({ preventScroll });
                }
            }
        };
        const multipleAdapter = {
            notifyMaxLimit: (option: OptionProps) => this.props.onExceed(option),
            getMaxLimit: () => this.props.max,
            registerClickOutsideHandler: (cb: (e: MouseEvent) => void) => {
                const clickOutsideHandler: (e: MouseEvent) => void = e => {
                    const triggerDom = (this.triggerRef && this.triggerRef.current) as Element;
                    const optionsDom = (this.optionContainerEl && this.optionContainerEl.current) as Element;

                    const target = e.target as Element;
                    const path = (e as any).composedPath && (e as any).composedPath() || [target];

                    if (!(optionsDom && optionsDom.contains(target)) &&
                        !(triggerDom && triggerDom.contains(target)) &&
                        !(path.includes(triggerDom) || path.includes(optionsDom))
                    ) {
                        cb(e);
                    }
                };
                this.clickOutsideHandler = clickOutsideHandler;
                document.addEventListener('mousedown', clickOutsideHandler as any, false);
            },
            unregisterClickOutsideHandler: () => {
                if (this.clickOutsideHandler) {
                    document.removeEventListener('mousedown', this.clickOutsideHandler as any, false);
                    this.clickOutsideHandler = null;
                }
            },
            rePositionDropdown: () => {
                let { optionKey } = this.state;
                optionKey = optionKey + 1;
                this.setState({ optionKey });
            },
            notifyDeselect: (value: OptionProps['value'], option: OptionProps) => {
                delete option._parentGroup;
                this.props.onDeselect(value, option);
            },
        };
        return {
            ...super.adapter,
            ...keyboardAdapter,
            ...filterAdapter,
            ...multipleAdapter,
            on: (eventName, eventCallback) => this.eventManager.on(eventName, eventCallback),
            off: (eventName) => this.eventManager.off(eventName),
            once: (eventName, eventCallback) => this.eventManager.once(eventName, eventCallback),
            emit: (eventName) => this.eventManager.emit(eventName),
            // Collect all subitems, each item is visible by default when collected, and is not selected
            getOptionsFromChildren: (children = this.props.children) => {
                let optionGroups = [];
                let options = [];
                const { optionList } = this.props;
                if (optionList && optionList.length) {
                    options = optionList.map((itemOpt, index) => ({
                        _show: true,
                        _selected: false,
                        _scrollIndex: index,
                        ...itemOpt
                    }));
                    optionGroups[0] = { children: options, label: '' };
                } else {
                    const result = getOptionsFromGroup(children);
                    optionGroups = result.optionGroups;
                    options = result.options;
                }
                this.setState({ optionGroups });
                return options;
            },
            updateOptions: (options: OptionProps[]) => {
                this.setState({ options });
            },
            openMenu: (cb?: () => void) => {
                this.setState({ isOpen: true }, () => {
                    cb?.();
                });
            },
            closeMenu: () => {
                this.setState({ isOpen: false });
            },
            getTriggerWidth: () => {
                const el = this.triggerRef.current;
                return el && el.getBoundingClientRect().width;
            },
            setOptionWrapperWidth: (width: number) => {
                this.setState({ dropdownMinWidth: width });
            },
            updateSelection: (selections: Map<OptionProps['label'], any>) => {
                this.setState({ selections });
            },
            // clone Map, important!!!, prevent unexpected modify on state
            getSelections: () => new Map(this.state.selections),

            notifyChange: (value: OnChangeValueType | OnChangeValueType[]) => {
                this.props.onChange(value);
            },
            notifySelect: (value: OptionProps['value'], option: OptionProps) => {
                delete option._parentGroup;
                this.props.onSelect(value, option);
            },
            notifyDropdownVisibleChange: (visible: boolean) => {
                this.props.onDropdownVisibleChange(visible);
            },
            notifySearch: (input: string, event: React.MouseEvent | React.KeyboardEvent) => {
                this.props.onSearch(input, event);
            },
            notifyCreate: (input: OptionProps) => {
                this.props.onCreate(input);
            },
            notifyMouseEnter: (e: React.MouseEvent<HTMLDivElement>) => {
                this.props.onMouseEnter(e);
            },
            notifyMouseLeave: (e: React.MouseEvent<HTMLDivElement>) => {
                this.props.onMouseLeave(e);
            },
            notifyFocus: (event: React.FocusEvent) => {
                this.props.onFocus(event);
            },
            notifyBlur: (event: React.FocusEvent) => {
                this.props.onBlur(event);
            },
            notifyClear: () => {
                this.props.onClear();
            },
            notifyListScroll: (e: React.UIEvent<HTMLDivElement>) => {
                this.props.onListScroll(e);
            },
            updateHovering: (isHovering: boolean) => {
                this.setState({ isHovering });
            },
            updateFocusState: (isFocus: boolean) => {
                this.setState({ isFocus });
            },
            updateOverflowItemCount: (overflowItemCount: number) => {
                this.setState({ overflowItemCount });
            },
            focusTrigger: () => {
                try {
                    const { preventScroll } = this.props;
                    const el = (this.triggerRef.current) as any;
                    el.focus({ preventScroll });
                } catch (error) {

                }
            },
            getContainer: () => {
                return this.optionContainerEl && this.optionContainerEl.current;
            },
            getFocusableElements: (node: HTMLDivElement) => {
                return getFocusableElements(node);
            },
            getActiveElement: () => {
                return getActiveElement();
            },
            setIsFocusInContainer: (isFocusInContainer: boolean) => {
                this.setState({ isFocusInContainer });
            },
            getIsFocusInContainer: () => {
                return this.state.isFocusInContainer;
            },
            updateScrollTop: (index?: number) => {
                let optionClassName;
                if ('renderOptionItem' in this.props) {
                    optionClassName = `.${prefixcls}-option-custom-selected`;
                    if (index !== undefined) {
                        optionClassName = `.${prefixcls}-option-custom:nth-child(${index + 1})`;
                    }
                } else {
                    optionClassName = `.${prefixcls}-option-selected`;
                    if (index !== undefined) {
                        optionClassName = `.${prefixcls}-option:nth-child(${index + 1})`;
                    }
                }

                let destNode = document.querySelector(`#${prefixcls}-${this.selectOptionListID} ${optionClassName}`) as HTMLDivElement;
                if (Array.isArray(destNode)) {
                    destNode = destNode[0];
                }
                if (destNode) {
                    /**
                     * Scroll the first selected item into view.
                     * The reason why ScrollIntoView is not used here is that it may cause page to move.
                     */
                    const destParent = destNode.parentNode as HTMLDivElement;
                    destParent.scrollTop = destNode.offsetTop -
                        destParent.offsetTop -
                        (destParent.clientHeight / 2) +
                        (destNode.clientHeight / 2);
                }
            },
        };
    }

    componentDidMount() {
        this.foundation.init();
        this.selectOptionListID = getUuidShort();
        this.selectID = this.props.id || getUuidShort();
    }

    componentWillUnmount() {
        this.foundation.destroy();
    }

    componentDidUpdate(prevProps: SelectProps, prevState: SelectState) {
        const prevChildrenKeys = React.Children.toArray(prevProps.children).map((child: any) => child.key);
        const nowChildrenKeys = React.Children.toArray(this.props.children).map((child: any) => child.key);

        let isOptionsChanged = false;

        if (!isEqual(prevChildrenKeys, nowChildrenKeys) || !isEqual(prevProps.optionList, this.props.optionList)) {
            isOptionsChanged = true;
            this.foundation.handleOptionListChange();
        }

        // Add isOptionChanged: There may be cases where the value is unchanged, but the optionList is updated. At this time, the label corresponding to the value may change, and the selected item needs to be updated
        if (!isEqual(this.props.value, prevProps.value) || isOptionsChanged) {
            if ('value' in this.props) {
                this.foundation.handleValueChange(this.props.value as any);
            } else {
                this.foundation.handleOptionListChangeHadDefaultValue();
            }
        }
    }

    handleInputChange = (value: string, event: React.ChangeEvent<HTMLInputElement>) => this.foundation.handleInputChange(value, event);

    renderTriggerInput() {
        const { size, multiple, disabled, inputProps, filter } = this.props;
        const inputPropsCls = get(inputProps, 'className');
        const inputcls = cls(`${prefixcls}-input`, {
            [`${prefixcls}-input-single`]: !multiple,
            [`${prefixcls}-input-multiple`]: multiple,
        }, inputPropsCls);
        const { inputValue, focusIndex } = this.state;

        const selectInputProps: Record<string, any> = {
            value: inputValue,
            disabled,
            className: inputcls,
            onChange: this.handleInputChange,
            ...inputProps,
        };

        let style = {};
        // Multiple choice mode
        if (multiple) {
            style = {
                width: inputValue ? `${inputValue.length * 16}px` : '2px',
            };
            selectInputProps.style = style;
        }
        return (
            <Input
                ref={this.inputRef as any}
                size={size}
                aria-activedescendant={focusIndex !== -1 ? `${this.selectID}-option-${focusIndex}` : ''}
                onFocus={(e: React.FocusEvent<HTMLInputElement>) => {
                    // if multiple and filter, when use tab key to let select get focus
                    // need to manual update state isFocus to let the focus style take effect
                    if (multiple && Boolean(filter)) {
                        this.setState({ isFocus: true });
                    }
                    // prevent event bubbling which will fire trigger onFocus event
                    e.stopPropagation();
                    // e.nativeEvent.stopImmediatePropagation();
                }}
                onBlur={e => this.foundation.handleInputBlur(e)}
                {...selectInputProps}
            />
        );
    }

    renderDropdownInput() {
        const { size, multiple, disabled, inputProps, filter, searchPosition, searchPlaceholder } = this.props;
        const { inputValue, focusIndex } = this.state;
        const wrapperCls = cls(`${prefixcls}-dropdown-search-wrapper`, {

        });
        const inputPropsCls = get(inputProps, 'className');
        const inputCls = cls(`${prefixcls}-dropdown-input`, {
            [`${prefixcls}-dropdown-input-single`]: !multiple,
            [`${prefixcls}-dropdown-input-multiple`]: multiple,
        }, inputPropsCls);

        const selectInputProps: Record<string, any> = {
            value: inputValue,
            disabled,
            className: inputCls,
            onChange: this.handleInputChange,
            placeholder: searchPlaceholder,
            showClear: true,
            ...inputProps,
            /**
             * When searchPosition is trigger, the keyboard events are bound to the outer trigger div, so there is no need to listen in input.
             * When searchPosition is dropdown, the popup and the outer trigger div are not parent- child relationships,
             * and bubbles cannot occur, so onKeydown needs to be listened in input.
             *  */ 
            onKeyDown: (e) => this.foundation._handleKeyDown(e)
        };

        return (
            <div className={wrapperCls}>
                <Input
                    ref={this.dropdownInputRef}
                    prefix={<IconSearch></IconSearch>}
                    aria-activedescendant={focusIndex !== -1 ? `${this.selectID}-option-${focusIndex}` : ''}
                    {...selectInputProps}
                />
            </div>
        );
    }

    close() {
        this.foundation.close();
    }

    open() {
        this.foundation.open();
    }

    clearInput() {
        this.foundation.clearInput();
    }

    selectAll() {
        this.foundation.selectAll();
    }

    deselectAll() {
        this.foundation.clearSelected();
    }

    focus() {
        this.foundation.focus();
    }

    onSelect(option: OptionProps, optionIndex: number, e: any) {
        this.foundation.onSelect(option, optionIndex, e);
    }

    onClear(e: React.MouseEvent) {
        e.nativeEvent.stopImmediatePropagation();
        this.foundation.handleClearClick(e as any);
    }

    search(value: string, event: React.ChangeEvent<HTMLInputElement>) {
        this.handleInputChange(value, event);
    }

    renderEmpty() {
        return <Option empty={true} emptyContent={this.props.emptyContent} />;
    }

    renderLoading() {
        const loadingWrapperCls = `${prefixcls}-loading-wrapper`;
        return (
            <div className={loadingWrapperCls}>
                <Spin />
            </div>
        );
    }

    renderOption(option: OptionProps, optionIndex: number, style?: React.CSSProperties) {
        const { focusIndex, inputValue } = this.state;
        const { renderOptionItem } = this.props;
        let optionContent;
        const isFocused = optionIndex === focusIndex;
        let optionStyle = style || {};
        if (option.style) {
            optionStyle = { ...optionStyle, ...option.style };
        }
        if (option._inputCreateOnly) {
            optionContent = this.renderCreateOption(option, isFocused, optionIndex, style);
        } else {
            // use another name to make sure that 'key' in optionList still exist when we call onChange
            if ('key' in option) {
                option._keyInOptionList = option.key;
            }
            optionContent = (
                <Option
                    showTick
                    {...option}
                    selected={option._selected}
                    onSelect={(v: OptionProps, e: MouseEvent) => this.onSelect(v, optionIndex, e)}
                    focused={isFocused}
                    onMouseEnter={() => this.onOptionHover(optionIndex)}
                    style={optionStyle}
                    key={option._keyInOptionList || option._keyInJsx || option.label as string + option.value as string + optionIndex}
                    renderOptionItem={renderOptionItem}
                    inputValue={inputValue}
                    semiOptionId={`${this.selectID}-option-${optionIndex}`}
                >
                    {option.label}
                </Option>
            );
        }
        return optionContent;
    }

    renderCreateOption(option: OptionProps, isFocused: boolean, optionIndex: number, style: React.CSSProperties) {
        const { renderCreateItem } = this.props;
        // default render method
        if (typeof renderCreateItem === 'undefined') {
            const defaultCreateItem = (
                <Option
                    key={option.key || option.label as string + option.value as string}
                    onSelect={(v: OptionProps, e: MouseEvent) => this.onSelect(v, optionIndex, e)}
                    onMouseEnter={() => this.onOptionHover(optionIndex)}
                    showTick
                    {...option}
                    focused={isFocused}
                    style={style}
                >
                    <LocaleConsumer<Locale['Select']> componentName="Select" >
                        {(locale: Locale['Select']) => (
                            <>
                                <span className={`${prefixcls}-create-tips`}>{locale.createText}</span>
                                {option.value}
                            </>
                        )}
                    </LocaleConsumer>
                </Option>
            );
            return defaultCreateItem;
        }

        const customCreateItem = renderCreateItem(option.value, isFocused, style);

        return (
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/interactive-supports-focus
            <div
                role="button"
                aria-label="Use the input box to create an optional item"
                onClick={e => this.onSelect(option, optionIndex, e)}
                key={option.key || option.label}
            >
                {customCreateItem}
            </div>
        );
    }

    onOptionHover(optionIndex: number) {
        this.foundation.handleOptionMouseEnter(optionIndex);
    }

    renderWithGroup(visibleOptions: OptionProps[]) {
        const content: JSX.Element[] = [];
        const groupStatus = new Map();

        visibleOptions.forEach((option, optionIndex) => {
            const parentGroup = option._parentGroup;
            const optionContent = this.renderOption(option, optionIndex);
            if (parentGroup && !groupStatus.has(parentGroup.label)) {
                const groupKey = typeof parentGroup.label === 'string' || typeof parentGroup.label === 'number'
                    ? parentGroup.label
                    : parentGroup.key;
                // when use with OptionGroup and group content not already insert
                const groupContent = <OptionGroup {...parentGroup} key={groupKey}/>;
                groupStatus.set(parentGroup.label, true);
                content.push(groupContent);
            }
            content.push(optionContent);
        });

        return content;
    }

    renderVirtualizeList(visibleOptions: OptionProps[]) {
        const { virtualize } = this.props;
        const { direction } = this.context;
        const { height, width, itemSize } = virtualize;

        return (
            <List
                ref={this.virtualizeListRef}
                height={height || numbers.LIST_HEIGHT}
                itemCount={visibleOptions.length}
                itemSize={itemSize}
                itemData={{ visibleOptions, renderOption: this.renderOption }}
                width={width || '100%'}
                style={{ direction }}
            >
                {VirtualRow}
            </List>
        );
    }

    renderOptions(children?: React.ReactNode) {
        const { dropdownMinWidth, options, selections } = this.state;
        const {
            maxHeight,
            dropdownClassName,
            dropdownStyle,
            outerTopSlot,
            innerTopSlot,
            outerBottomSlot,
            innerBottomSlot,
            loading,
            virtualize,
            multiple,
            emptyContent,
            searchPosition,
            filter,
        } = this.props;

        // Do a filter first, instead of directly judging in forEach, so that the focusIndex can correspond to
        const visibleOptions = options.filter(item => item._show);

        let listContent: JSX.Element | JSX.Element[] = this.renderWithGroup(visibleOptions);
        if (virtualize) {
            listContent = this.renderVirtualizeList(visibleOptions);
        }

        const style = { minWidth: dropdownMinWidth, ...dropdownStyle };

        const optionListCls = cls({
            [`${prefixcls}-option-list`]: true,
            [`${prefixcls}-option-list-chosen`]: selections.size,
        });

        const isEmpty = !options.length || !options.some(item => item._show);
        return (
            // eslint-disable-next-line jsx-a11y/no-static-element-interactions
            <div
                id={`${prefixcls}-${this.selectOptionListID}`}
                className={cls({
                    // When emptyContent is null and the option is empty, there is no need for the drop-down option for the user,
                    // so there is no need to set padding through this className
                    [`${prefixcls}-option-list-wrapper`]: !(isEmpty && emptyContent === null),
                }, dropdownClassName)}
                style={style}
                ref={this.setOptionContainerEl}
                onKeyDown={e => this.foundation.handleContainerKeyDown(e)}
            >
                {outerTopSlot ? <div className={`${prefixcls}-option-list-outer-top-slot`} onMouseEnter={() => this.foundation.handleSlotMouseEnter()}>{outerTopSlot}</div> : null}
                {searchPosition === strings.SEARCH_POSITION_DROPDOWN && filter ? this.renderDropdownInput() : null}
                <div
                    style={{ maxHeight: `${maxHeight}px` }}
                    className={optionListCls}
                    role="listbox"
                    aria-multiselectable={multiple}
                    onScroll={e => this.foundation.handleListScroll(e)}
                >
                    {innerTopSlot ? <div className={`${prefixcls}-option-list-inner-top-slot`} onMouseEnter={() => this.foundation.handleSlotMouseEnter()}>{innerTopSlot}</div> : null}
                    {loading ? this.renderLoading() : isEmpty ? this.renderEmpty() : listContent}
                    {innerBottomSlot ? <div className={`${prefixcls}-option-list-inner-bottom-slot`} onMouseEnter={() => this.foundation.handleSlotMouseEnter()}>{innerBottomSlot}</div> : null}
                </div>
                {outerBottomSlot ? <div className={`${prefixcls}-option-list-outer-bottom-slot`} onMouseEnter={() => this.foundation.handleSlotMouseEnter()}>{outerBottomSlot}</div> : null}
            </div>
        );
    }

    renderSingleSelection(selections: Map<OptionProps['label'], any>, filterable: boolean) {
        let { renderSelectedItem, searchPosition } = this.props;
        const { placeholder } = this.props;
        const { showInput, inputValue } = this.state;
        let renderText: React.ReactNode = '';

        const selectedItems = [...selections];

        if (typeof renderSelectedItem === 'undefined') {
            renderSelectedItem = ((optionNode: OptionProps) => optionNode.label) as RenderSelectedItemFn;
        }

        if (selectedItems.length) {
            const selectedItem = selectedItems[0][1];
            renderText = (renderSelectedItem as RenderSingleSelectedItemFn)(selectedItem);
        }

        const showInputInTrigger = searchPosition === strings.SEARCH_POSITION_TRIGGER;

        const spanCls = cls({
            [`${prefixcls}-selection-text`]: true,
            [`${prefixcls}-selection-placeholder`]: !renderText && renderText !== 0,
            [`${prefixcls}-selection-text-hide`]: inputValue && showInput && showInputInTrigger, // show Input
            [`${prefixcls}-selection-text-inactive`]: !inputValue && showInput && showInputInTrigger, // Stack Input & RenderText(opacity 0.4)
        });

        const contentWrapperCls = `${prefixcls}-content-wrapper`;
        return (
            <>
                <div className={contentWrapperCls}>
                    {
                        <span className={spanCls} x-semi-prop="placeholder">
                            {renderText || renderText === 0 ? renderText : placeholder}
                        </span>
                    }
                    {filterable && showInput && showInputInTrigger ? this.renderTriggerInput() : null}
                </div>
            </>
        );
    }

    getTagItem = (item: any, i: number, renderSelectedItem: RenderSelectedItemFn) => {
        const { size, disabled: selectDisabled } = this.props;
        const label = item[0];
        const { value } = item[1];
        const disabled = item[1].disabled || selectDisabled;
        const onClose = (tagContent: React.ReactNode, e: MouseEvent) => {
            if (e && typeof e.preventDefault === 'function') {
                e.preventDefault(); // make sure that tag will not hidden immediately in controlled mode
            }
            this.foundation.removeTag({ label, value });
        };

        const { content, isRenderInTag } = (renderSelectedItem as RenderMultipleSelectedItemFn)(item[1], { index: i, disabled, onClose });
        const basic = {
            disabled,
            closable: !disabled,
            onClose,
        };
        if (isRenderInTag) {
            return (
                <Tag {...basic} color="white" size={size || 'large'} key={value} tabIndex={-1}>
                    {content}
                </Tag>
            );
        } else {
            return <Fragment key={value}>{content}</Fragment>;
        }
    }

    renderTag(item: [React.ReactNode, any], i: number, isCollapseItem?: boolean) {
        const { size, disabled: selectDisabled } = this.props;
        let { renderSelectedItem } = this.props;
        const label = item[0];
        const { value } = item[1];
        const disabled = item[1].disabled || selectDisabled;
        const onClose = (tagContent: React.ReactNode, e: MouseEvent) => {
            if (e && typeof e.preventDefault === 'function') {
                e.preventDefault(); // make sure that tag will not hidden immediately in controlled mode
            }
            this.foundation.removeTag({ label, value });
        };

        if (typeof renderSelectedItem === 'undefined') {
            renderSelectedItem = (optionNode: OptionProps) => ({
                isRenderInTag: true,
                content: optionNode.label,
            });
        }
        const { content, isRenderInTag } = (renderSelectedItem as RenderMultipleSelectedItemFn)(item[1], { index: i, disabled, onClose });
        const basic = {
            disabled,
            closable: !disabled,
            onClose,
        };
        const realContent = isCollapseItem && !isFunction(this.props.renderSelectedItem)
            ? (
                <Text size='small' ellipsis={{ rows: 1, showTooltip: { type: 'popover', opts: { style: { width: 'auto', fontSize: 12 } } } }} >
                    {content}
                </Text>
            )
            : content;
        if (isRenderInTag) {
            return (
                <Tag {...basic} color="white" size={size || 'large'} key={value} style={{ maxWidth: '100%' }}>
                    {realContent}
                </Tag>
            );
        } else {
            return <Fragment key={value}>{realContent}</Fragment>;
        }
    }

    renderNTag(n: number, restTags: [React.ReactNode, any][]) {
        const { size, showRestTagsPopover, restTagsPopoverProps } = this.props;
        let nTag = (
            <Tag
                closable={false}
                size={size || 'large'}
                color='grey'
                className={`${prefixcls}-content-wrapper-collapse-tag`}
                key={`_+${n}`}
                style={{ marginRight: 0, flexShrink: 0 }}
            >
                +{n}
            </Tag>
        );

        if (showRestTagsPopover) {
            nTag = (
                <Popover
                    showArrow
                    content={
                        <Space spacing={2} wrap style={{ maxWidth: '400px' }}>
                            {restTags.map((tag, index) => (this.renderTag(tag, index)))}
                        </Space>
                    }
                    trigger="hover"
                    position="top"
                    autoAdjustOverflow
                    {...restTagsPopoverProps}
                    key={`_+${n}_Popover`}
                >
                    {nTag}
                </Popover>
            );
        }
        return nTag;
    }

    renderOverflow(items: [React.ReactNode, any][], index: number) {
        const isCollapse = true;
        return items.length && items[0]
            ? this.renderTag(items[0], index, isCollapse)
            : null;
    }

    handleOverflow(items: [React.ReactNode, any][]) {
        const { overflowItemCount, selections } = this.state;
        const { maxTagCount } = this.props;
        const newOverFlowItemCount = selections.size - maxTagCount > 0 ? selections.size - maxTagCount + items.length - 1 : items.length - 1;
        if (overflowItemCount !== newOverFlowItemCount) {
            this.foundation.updateOverflowItemCount(selections.size, newOverFlowItemCount);
        }
    }


    renderCollapsedTags(selections: [React.ReactNode, any][], length: number | undefined): React.ReactElement<any> {
        const { overflowItemCount } = this.state;
        const normalTags = typeof length === 'number' ? selections.slice(0, length) : selections;
        return (
            <div className={`${prefixcls}-content-wrapper-collapse`}>
                <OverflowList
                    items={normalTags}
                    key={String(selections.length)}
                    overflowRenderer={overflowItems => this.renderOverflow(overflowItems as [React.ReactNode, any][], length - 1)}
                    onOverflow={overflowItems => this.handleOverflow(overflowItems as [React.ReactNode, any][])}
                    visibleItemRenderer={(item, index) => this.renderTag(item as [React.ReactNode, any], index)}
                />
                {overflowItemCount > 0 && this.renderNTag(overflowItemCount, selections.slice(selections.length - overflowItemCount))}
            </div>
        );
    }

    renderOneLineTags(selectedItems: [React.ReactNode, any][], n: number | undefined): React.ReactElement<any> {
        let { renderSelectedItem } = this.props;
        const { showRestTagsPopover, restTagsPopoverProps, maxTagCount } = this.props;
        const { isFullTags } = this.state;
        let tagContent: ReactNode;

        if (typeof renderSelectedItem === 'undefined') {
            renderSelectedItem = (optionNode: OptionProps) => ({
                isRenderInTag: true,
                content: optionNode.label,
            });
        }
        if (showRestTagsPopover) {
            // showRestTagsPopover = true，
            const mapItems = isFullTags ? selectedItems : selectedItems.slice(0, maxTagCount);
            const tags = mapItems.map((item, i) => {
                return this.getTagItem(item, i, renderSelectedItem);
            });

            tagContent = (
                <TagGroup<"custom">
                    tagList={tags}
                    maxTagCount={n}
                    restCount={isFullTags ? undefined : (selectedItems.length - maxTagCount)}
                    size="large"
                    mode="custom"
                    showPopover={showRestTagsPopover}
                    popoverProps={restTagsPopoverProps}
                    onPlusNMouseEnter={() => {
                        this.foundation.updateIsFullTags();
                    }}
                />
            );
        } else {
            // If maxTagCount is set, showRestTagsPopover is false/undefined, 
            // then there is no popover when hovering, no extra Tags are displayed, 
            // only the tags and restCount displayed in the trigger need to be passed in
            const mapItems = selectedItems.slice(0, maxTagCount);
            const tags = mapItems.map((item, i) => {
                return this.getTagItem(item, i, renderSelectedItem);
            });
            tagContent = (
                <TagGroup<"custom">
                    tagList={tags}
                    maxTagCount={n}
                    restCount={selectedItems.length - maxTagCount}
                    size="large"
                    mode="custom"
                />
            );
        }
        return tagContent;
    }


    renderMultipleSelection(selections: Map<OptionProps['label'], any>, filterable: boolean) {
        let { renderSelectedItem, searchPosition } = this.props;
        const { placeholder, maxTagCount, expandRestTagsOnClick, ellipsisTrigger } = this.props;
        const { inputValue, isOpen } = this.state;

        const selectedItems = [...selections];

        if (typeof renderSelectedItem === 'undefined') {
            renderSelectedItem = (optionNode: OptionProps) => ({
                isRenderInTag: true,
                content: optionNode.label,
            });
        }

        const contentWrapperCls = cls({
            [`${prefixcls}-content-wrapper`]: true,
            [`${prefixcls}-content-wrapper-one-line`]: maxTagCount && !isOpen,
            [`${prefixcls}-content-wrapper-empty`]: !selectedItems.length,
        });

        const spanCls = cls({
            [`${prefixcls}-selection-text`]: true,
            [`${prefixcls}-selection-placeholder`]: !selectedItems.length,
            [`${prefixcls}-selection-text-hide`]: selectedItems && selectedItems.length,
        });
        const placeholderText = placeholder && !inputValue ? <span className={spanCls}>{placeholder}</span> : null;
        const n = selectedItems.length > maxTagCount ? maxTagCount : undefined;
        const NotOneLine = !maxTagCount;

        const oneLineTags = ellipsisTrigger ? this.renderCollapsedTags(selectedItems, n) : this.renderOneLineTags(selectedItems, n);

        const tagContent = NotOneLine || (expandRestTagsOnClick && isOpen)
            ? selectedItems.map((item, i) => this.renderTag(item, i))
            : oneLineTags;

        const showTriggerInput = filterable && searchPosition === strings.SEARCH_POSITION_TRIGGER;

        return (
            <>
                <div className={contentWrapperCls}>
                    {selectedItems && selectedItems.length ? tagContent : placeholderText}
                    {showTriggerInput ? this.renderTriggerInput() : null}
                </div>
            </>
        );
    }

    onMouseEnter(e: MouseEvent) {
        this.foundation.handleMouseEnter(e as any);
    }

    onMouseLeave(e: MouseEvent) {
        this.foundation.handleMouseLeave(e as any);
    }

    onKeyPress(e: React.KeyboardEvent) {
        this.foundation.handleKeyPress(e as any);
    }

    /* Processing logic when popover visible changes */
    handlePopoverVisibleChange(status) {
        const { virtualize } = this.props;
        const { selections } = this.state;
        if (!status) {
            return;
        }
        if (virtualize) {
            let minItemIndex = -1;
            selections.forEach(item => {
                const itemIndex = get(item, '_scrollIndex');
                /* When the itemIndex is legal */
                if (isNumber(itemIndex) && itemIndex >= 0) {
                    minItemIndex = minItemIndex !== -1 && minItemIndex < itemIndex
                        ? minItemIndex
                        : itemIndex;
                }
            });
            if (minItemIndex !== -1) {
                try {
                    this.virtualizeListRef.current.scrollToItem(minItemIndex, 'center');
                } catch (error) { }
            }
        } else {
            this.foundation.updateScrollTop();
        }
    }

    renderSuffix() {
        const { suffix } = this.props;
        const suffixWrapperCls = cls({
            [`${prefixcls}-suffix`]: true,
            [`${prefixcls}-suffix-text`]: suffix && isString(suffix),
            [`${prefixcls}-suffix-icon`]: isSemiIcon(suffix),
        });
        return <div className={suffixWrapperCls} x-semi-prop="suffix">{suffix}</div>;
    }

    renderPrefix() {
        const { prefix, insetLabel, insetLabelId } = this.props;
        const labelNode = (prefix || insetLabel) as React.ReactElement<any, any>;

        const prefixWrapperCls = cls({
            [`${prefixcls}-prefix`]: true,
            [`${prefixcls}-inset-label`]: insetLabel,
            [`${prefixcls}-prefix-text`]: labelNode && isString(labelNode),
            [`${prefixcls}-prefix-icon`]: isSemiIcon(labelNode),
        });

        return (
            <div className={prefixWrapperCls} id={insetLabelId} x-semi-prop="prefix,insetLabel">
                {labelNode}
            </div>
        );
    }

    renderSelection() {
        const {
            disabled,
            multiple,
            filter,
            style,
            id,
            size,
            className,
            validateStatus,
            showArrow,
            suffix,
            prefix,
            insetLabel,
            placeholder,
            triggerRender,
            arrowIcon,
            clearIcon,
            borderless,
            ...rest
        } = this.props;

        const { selections, isOpen, keyboardEventSet, inputValue, isHovering, isFocus, showInput, focusIndex } = this.state;
        const useCustomTrigger = typeof triggerRender === 'function';
        const filterable = Boolean(filter); // filter（boolean || function）
        const selectionCls = useCustomTrigger ?
            cls(className) :
            cls(prefixcls, className, {
                [`${prefixcls}-borderless`]: borderless,
                [`${prefixcls}-open`]: isOpen,
                [`${prefixcls}-focus`]: isFocus,
                [`${prefixcls}-disabled`]: disabled,
                [`${prefixcls}-single`]: !multiple,
                [`${prefixcls}-multiple`]: multiple,
                [`${prefixcls}-filterable`]: filterable,
                [`${prefixcls}-small`]: size === 'small',
                [`${prefixcls}-large`]: size === 'large',
                [`${prefixcls}-error`]: validateStatus === 'error',
                [`${prefixcls}-warning`]: validateStatus === 'warning',
                [`${prefixcls}-no-arrow`]: !showArrow,
                [`${prefixcls}-with-prefix`]: prefix || insetLabel,
                [`${prefixcls}-with-suffix`]: suffix,
            });

        const showClear = this.props.showClear &&
            (selections.size || inputValue) && !disabled && (isHovering || isOpen);

        const arrowContent = showArrow ? (
            <div className={`${prefixcls}-arrow`} x-semi-prop="arrowIcon">
                {arrowIcon}
            </div>
        ) : (
            <div className={`${prefixcls}-arrow-empty`} />
        );

        const clear = clearIcon ? clearIcon : <IconClear />;

        // semantics of onSearch are more in line with behavior, onChange is alias of onSearch, will be deprecate next major version
        const inner = useCustomTrigger ? (
            <Trigger
                value={Array.from(selections.values())}
                inputValue={inputValue}
                onChange={this.handleInputChange}
                onSearch={this.handleInputChange}
                onRemove={(item) => this.foundation.removeTag(item)}
                onClear={this.onClear}
                disabled={disabled}
                triggerRender={triggerRender}
                placeholder={placeholder as any}
                componentName="Select"
                componentProps={{ ...this.props }}
            />
        ) : (
            [
                <Fragment key="prefix">{prefix || insetLabel ? this.renderPrefix() : null}</Fragment>,
                <Fragment key="selection">
                    <div className={cls(`${prefixcls}-selection`)}>
                        {multiple ?
                            this.renderMultipleSelection(selections, filterable) :
                            this.renderSingleSelection(selections, filterable)}
                    </div>
                </Fragment>,
                <Fragment key="suffix">{suffix ? this.renderSuffix() : null}</Fragment>,
                <Fragment key="clearicon">
                    {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions */}
                    {showClear ? (<div className={cls(`${prefixcls}-clear`)} onClick={this.onClear}>{clear}</div>) : arrowContent}
                </Fragment>,
            ]
        );

        /**
         * 
         * In disabled, searchable single-selection and display input, and searchable multi-selection
         * make combobox not focusable by tab key
         * 
         * 在disabled，可搜索单选且显示input框，以及可搜索多选情况下
         * 让combobox无法通过tab聚焦
         */
        const tabIndex = (disabled || (filterable && showInput) || (filterable && multiple)) ? -1 : 0;
        return (
            /* eslint-disable-next-line jsx-a11y/aria-activedescendant-has-tabindex */
            <div
                role="combobox"
                aria-disabled={disabled}
                aria-expanded={isOpen}
                aria-controls={`${prefixcls}-${this.selectOptionListID}`}
                aria-haspopup="listbox"
                aria-label={selections.size ? 'selected' : ''} // if there is a value, expect the narration to speak selected
                aria-invalid={this.props['aria-invalid']}
                aria-errormessage={this.props['aria-errormessage']}
                aria-labelledby={this.props['aria-labelledby']}
                aria-describedby={this.props['aria-describedby']}
                aria-required={this.props['aria-required']}
                className={selectionCls}
                ref={ref => {((this.triggerRef as any).current = ref);}}
                onClick={e => this.foundation.handleClick(e)}
                style={style}
                id={this.selectID}
                tabIndex={tabIndex}
                aria-activedescendant={focusIndex !== -1 ? `${this.selectID}-option-${focusIndex}` : ''}
                onMouseEnter={this.onMouseEnter}
                onMouseLeave={this.onMouseLeave}
                onFocus={e => this.foundation.handleTriggerFocus(e)}
                onBlur={e => this.foundation.handleTriggerBlur(e as any)}
                onKeyPress={this.onKeyPress}
                {...keyboardEventSet}
                {...this.getDataAttr(rest)}
            >
                {inner}
            </div>
        );
    }

    render() {
        const { direction } = this.context;
        const defaultPosition = direction === 'rtl' ? 'bottomRight' : 'bottomLeft';
        const {
            children,
            position = defaultPosition,
            zIndex,
            getPopupContainer,
            motion,
            autoAdjustOverflow,
            mouseLeaveDelay,
            mouseEnterDelay,
            spacing,
            stopPropagation,
            dropdownMargin,
        } = this.props;
        const { isOpen, optionKey } = this.state;
        const selection = this.renderSelection();
        return (
            <Popover
                getPopupContainer={getPopupContainer}
                motion={motion}
                margin={dropdownMargin}
                autoAdjustOverflow={autoAdjustOverflow}
                mouseLeaveDelay={mouseLeaveDelay}
                mouseEnterDelay={mouseEnterDelay}
                zIndex={zIndex}
                ref={this.optionsRef}
                content={() => this.renderOptions(children)}
                visible={isOpen}
                trigger="custom"
                rePosKey={optionKey}
                position={position}
                spacing={spacing}
                stopPropagation={stopPropagation}
                disableArrowKeyDown={true}
                onVisibleChange={status => this.handlePopoverVisibleChange(status)}
                afterClose={() => this.foundation.handlePopoverClose()}
            >
                {selection}
            </Popover>
        );
    }
}

export default Select;
