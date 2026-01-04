import React, { Fragment } from 'react';
import ReactDOM from 'react-dom';
import cls from 'classnames';
import PropTypes from 'prop-types';
import { isEqual, isString, isEmpty, noop, get, isFunction, isUndefined, isNull, pick } from 'lodash';
import TreeSelectFoundation, {
    Size,
    BasicTriggerRenderProps,
    /* Corresponding props */
    BasicTreeSelectProps,
    /* Corresponding state */
    BasicTreeSelectInnerData,
    TreeSelectAdapter
} from '@douyinfe/semi-foundation/treeSelect/foundation';
import {
    convertDataToEntities,
    flattenTreeData,
    calcExpandedKeysForValues,
    calcMotionKeys,
    findKeysForValues,
    calcCheckedKeys,
    calcExpandedKeys,
    getValueOrKey,
    normalizeKeyList,
    calcDisabledKeys,
    normalizeValue,
    updateKeys,
    filterTreeData
} from '@douyinfe/semi-foundation/tree/treeUtil';
import { cssClasses, strings } from '@douyinfe/semi-foundation/treeSelect/constants';
import { numbers as popoverNumbers } from '@douyinfe/semi-foundation/popover/constants';
import { FixedSizeList as VirtualList, ListItemKeySelector } from 'react-window';
import '@douyinfe/semi-foundation/tree/tree.scss';
import '@douyinfe/semi-foundation/treeSelect/treeSelect.scss';
import BaseComponent, { ValidateStatus } from '../_base/baseComponent';
import ConfigContext, { ContextValue } from '../configProvider/context';
import TagGroup from '../tag/group';
import Tag, { TagProps } from '../tag/index';
import Input, { InputProps } from '../input/index';
import AutoSizer from '../tree/autoSizer';
import TreeContext from '../tree/treeContext';
import TreeNode from '../tree/treeNode';
import NodeList from '../tree/nodeList';
import { cloneDeep } from '../tree/treeUtil';
import LocaleConsumer from '../locale/localeConsumer';
import { Locale } from '../locale/interface';
import Trigger from '../trigger';
import TagInput from '../tagInput';
import { isSemiIcon } from '../_utils';
import { OptionProps, TreeProps, TreeState, FlattenNode, TreeNodeData, TreeNodeProps } from '../tree/interface';
import { IconChevronDown, IconClear, IconSearch } from '@douyinfe/semi-icons';
import CheckboxGroup from '../checkbox/checkboxGroup';
import Popover, { PopoverProps } from '../popover/index';
import VirtualRow from '../select/virtualRow';

export type ExpandAction = false | 'click' | 'doubleClick';

export interface TriggerRenderProps extends Omit<BasicTriggerRenderProps, 'componentProps'> {
    [x: string]: any;
    componentProps: TreeSelectProps;
    value: TreeNodeData[];
    onClear: (e: React.MouseEvent) => void
}

export interface OnChange {
    /* onChangeWithObject is false */
    (
        value: TreeNodeData['value'] | Array<TreeNodeData['value']>,
        node: TreeNodeData[] | TreeNodeData,
        e: React.MouseEvent
    ): void;
    /* onChangeWithObject is true */
    (node: TreeNodeData[] | TreeNodeData, e: React.MouseEvent): void
}

export type RenderSelectedItemInSingle = (treeNode: TreeNodeData) => React.ReactNode;

export type RenderSelectedItemInMultiple = (
    treeNode: TreeNodeData,
    otherProps: { index: number | string; onClose: (tagContent: any, e: React.MouseEvent) => void }
) => {
    isRenderInTag: boolean;
    content: React.ReactNode
};

export type RenderSelectedItem = RenderSelectedItemInSingle | RenderSelectedItemInMultiple;

export type OverrideCommonProps =
    'renderFullLabel'
    | 'renderLabel'
    | 'defaultValue'
    | 'emptyContent'
    | 'filterTreeNode'
    | 'style'
    | 'treeData'
    | 'value'
    | 'onExpand'
    | 'keyMaps'
    | 'showLine';

/**
* Type definition description:
* TreeSelectProps inherits some properties from BasicTreeSelectProps (from foundation) and TreeProps (from semi-ui-react).
*/
export interface TreeSelectProps extends Omit<BasicTreeSelectProps, OverrideCommonProps | 'validateStatus' | 'searchRender'>, Pick<TreeProps, OverrideCommonProps> {
    'aria-describedby'?: React.AriaAttributes['aria-describedby'];
    'aria-errormessage'?: React.AriaAttributes['aria-errormessage'];
    'aria-invalid'?: React.AriaAttributes['aria-invalid'];
    'aria-labelledby'?: React.AriaAttributes['aria-labelledby'];
    'aria-required'?: React.AriaAttributes['aria-required'];
    motion?: boolean;
    mouseEnterDelay?: number;
    mouseLeaveDelay?: number;
    arrowIcon?: React.ReactNode;
    autoAdjustOverflow?: boolean;
    clickToHide?: boolean;
    clearIcon?: React.ReactNode;
    defaultOpen?: boolean;
    dropdownClassName?: string;
    dropdownMatchSelectWidth?: boolean;
    dropdownStyle?: React.CSSProperties;
    dropdownMargin?: PopoverProps['margin'];
    insetLabel?: React.ReactNode;
    insetLabelId?: string;
    maxTagCount?: number;
    motionExpand?: boolean;
    optionListStyle?: React.CSSProperties;
    outerBottomSlot?: React.ReactNode;
    outerTopSlot?: React.ReactNode;
    placeholder?: string;
    prefix?: React.ReactNode;
    position?: PopoverProps['position'];
    searchAutoFocus?: boolean;
    searchPlaceholder?: string;
    showSearchClear?: boolean;
    size?: Size;
    suffix?: React.ReactNode;
    treeNodeLabelProp?: string;
    validateStatus?: ValidateStatus;
    zIndex?: number;
    searchPosition?: string;
    stopPropagation?: boolean | string;
    restTagsPopoverProps?: PopoverProps;
    expandIcon?: React.ReactNode | ((props: {
        onClick: (e: MouseEvent) => void;
        className: string;
        expanded: boolean
    }) => React.ReactNode);
    searchRender?: boolean | ((inputProps: InputProps) => React.ReactNode);
    onSelect?: (selectedKey: string, selected: boolean, selectedNode: TreeNodeData) => void;
    renderSelectedItem?: RenderSelectedItem;
    getPopupContainer?: () => HTMLElement;
    triggerRender?: (props: TriggerRenderProps) => React.ReactNode;
    onBlur?: (e: React.MouseEvent) => void;
    onChange?: OnChange;
    onFocus?: (e: React.MouseEvent) => void;
    onVisibleChange?: (isVisible: boolean) => void;
    onClear?: (e: React.MouseEvent | React.KeyboardEvent<HTMLDivElement>) => void;
    autoMergeValue?: boolean
}

export type OverrideCommonState =
    'keyEntities'
    | 'treeData'
    | 'disabledKeys'
    | 'flattenNodes';

export interface TreeSelectState extends Omit<BasicTreeSelectInnerData, OverrideCommonState | 'prevProps'>, Pick<TreeState, OverrideCommonState> {
    inputTriggerFocus: boolean;
    isOpen: boolean;
    // isInput: boolean;
    rePosKey: number;
    dropdownMinWidth: null | number;
    isHovering: boolean;
    prevProps: TreeSelectProps;
    isFocus: boolean
}

const prefixcls = cssClasses.PREFIX;
const prefixTree = cssClasses.PREFIX_TREE;

const key = 0;

class TreeSelect extends BaseComponent<TreeSelectProps, TreeSelectState> {
    static contextType = ConfigContext;

    static propTypes = {
        'aria-describedby': PropTypes.string,
        'aria-errormessage': PropTypes.string,
        'aria-invalid': PropTypes.bool,
        'aria-labelledby': PropTypes.string,
        'aria-required': PropTypes.bool,
        borderless: PropTypes.bool,
        loadedKeys: PropTypes.arrayOf(PropTypes.string),
        loadData: PropTypes.func,
        onLoad: PropTypes.func,
        arrowIcon: PropTypes.node,
        clearIcon: PropTypes.node,
        defaultOpen: PropTypes.bool,
        defaultValue: PropTypes.oneOfType([PropTypes.string, PropTypes.array, PropTypes.object]),
        defaultExpandAll: PropTypes.bool,
        defaultExpandedKeys: PropTypes.array,
        expandAll: PropTypes.bool,
        disabled: PropTypes.bool,
        disableStrictly: PropTypes.bool,
        // Whether to turn on the input box filtering function, when it is a function, it represents a custom filtering function
        filterTreeNode: PropTypes.oneOfType([PropTypes.func, PropTypes.bool]),
        multiple: PropTypes.bool,
        searchPlaceholder: PropTypes.string,
        searchAutoFocus: PropTypes.bool,
        virtualize: PropTypes.object,
        treeNodeFilterProp: PropTypes.string,
        onChange: PropTypes.func,
        onClear: PropTypes.func,
        onSearch: PropTypes.func,
        onSelect: PropTypes.func,
        onExpand: PropTypes.func,
        onChangeWithObject: PropTypes.bool,
        onBlur: PropTypes.func,
        onFocus: PropTypes.func,
        value: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.array, PropTypes.object]),
        expandedKeys: PropTypes.array,
        autoExpandParent: PropTypes.bool,
        showClear: PropTypes.bool,
        showSearchClear: PropTypes.bool,
        autoAdjustOverflow: PropTypes.bool,
        showFilteredOnly: PropTypes.bool,
        showLine: PropTypes.bool,
        motionExpand: PropTypes.bool,
        emptyContent: PropTypes.node,
        keyMaps: PropTypes.object,
        leafOnly: PropTypes.bool,
        treeData: PropTypes.arrayOf(
            PropTypes.shape({
                key: PropTypes.string,
                value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
                label: PropTypes.any,
            })
        ),
        dropdownClassName: PropTypes.string,
        dropdownStyle: PropTypes.object,
        dropdownMargin: PropTypes.oneOfType([PropTypes.number, PropTypes.object]),
        motion: PropTypes.bool,
        placeholder: PropTypes.string,
        maxTagCount: PropTypes.number,
        size: PropTypes.oneOf<TreeSelectProps['size']>(strings.SIZE_SET),
        className: PropTypes.string,
        style: PropTypes.object,
        treeNodeLabelProp: PropTypes.string,
        suffix: PropTypes.node,
        prefix: PropTypes.node,
        insetLabel: PropTypes.node,
        insetLabelId: PropTypes.string,
        zIndex: PropTypes.number,
        getPopupContainer: PropTypes.func,
        dropdownMatchSelectWidth: PropTypes.bool,
        validateStatus: PropTypes.oneOf(strings.STATUS),
        mouseEnterDelay: PropTypes.number,
        mouseLeaveDelay: PropTypes.number,
        triggerRender: PropTypes.func,
        stopPropagation: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
        outerBottomSlot: PropTypes.node,
        outerTopSlot: PropTypes.node,
        onVisibleChange: PropTypes.func,
        expandAction: PropTypes.oneOf(['click' as const, 'doubleClick' as const, false as const]),
        searchPosition: PropTypes.oneOf([strings.SEARCH_POSITION_DROPDOWN, strings.SEARCH_POSITION_TRIGGER]),
        clickToHide: PropTypes.bool,
        renderLabel: PropTypes.func,
        renderFullLabel: PropTypes.func,
        labelEllipsis: PropTypes.bool,
        optionListStyle: PropTypes.object,
        searchRender: PropTypes.oneOfType([PropTypes.func, PropTypes.bool]),
        renderSelectedItem: PropTypes.func,
        checkRelation: PropTypes.string,
        'aria-label': PropTypes.string,
        showRestTagsPopover: PropTypes.bool,
        restTagsPopoverProps: PropTypes.object,
        preventScroll: PropTypes.bool,
        clickTriggerToHide: PropTypes.bool,
        autoMergeValue: PropTypes.bool,
    };

    static defaultProps: Partial<TreeSelectProps> = {
        borderless: false,
        searchPosition: strings.SEARCH_POSITION_DROPDOWN,
        arrowIcon: <IconChevronDown />,
        autoExpandParent: false,
        autoAdjustOverflow: true,
        stopPropagation: true,
        motion: true,
        motionExpand: true,
        expandAll: false,
        zIndex: popoverNumbers.DEFAULT_Z_INDEX,
        disableStrictly: false,
        multiple: false,
        filterTreeNode: false,
        size: 'default' as const,
        treeNodeFilterProp: 'label' as const,
        onChangeWithObject: false,
        treeNodeLabelProp: 'label' as const,
        dropdownMatchSelectWidth: true,
        defaultOpen: false,
        showSearchClear: true,
        showClear: false,
        onVisibleChange: noop,
        expandAction: false,
        clickToHide: true,
        searchAutoFocus: false,
        checkRelation: 'related',
        'aria-label': 'TreeSelect',
        showRestTagsPopover: false,
        restTagsPopoverProps: {},
        clickTriggerToHide: true,
        autoMergeValue: true,
    };
    inputRef: React.RefObject<typeof Input>;
    tagInputRef: React.RefObject<TagInput>;
    triggerRef: React.RefObject<HTMLDivElement>;
    optionsRef: React.RefObject<any>;
    optionContainerEl: React.RefObject<HTMLDivElement>;
    clickOutsideHandler: any;
    // _flattenNodes: TreeState['flattenNodes'];
    onNodeClick: any;
    onNodeDoubleClick: any;
    onMotionEnd: any;
    treeSelectID: string;
    context: ContextValue;

    constructor(props: TreeSelectProps) {
        super(props);
        this.state = {
            inputTriggerFocus: false,
            isOpen: false,
            isFocus: false,
            // isInput: false,
            rePosKey: key,
            dropdownMinWidth: null,
            inputValue: '',
            keyEntities: {},
            treeData: [],
            flattenNodes: [],
            cachedFlattenNodes: undefined,
            selectedKeys: [],
            checkedKeys: new Set(),
            halfCheckedKeys: new Set(),
            realCheckedKeys: new Set([]),
            disabledKeys: new Set(),
            motionKeys: new Set([]),
            motionType: 'hide',
            expandedKeys: new Set(props.expandedKeys),
            filteredKeys: new Set(),
            filteredExpandedKeys: new Set(),
            filteredShownKeys: new Set(),
            prevProps: null,
            isHovering: false,
            cachedKeyValuePairs: {},
            loadedKeys: new Set(),
            loadingKeys: new Set(),
        };
        this.inputRef = React.createRef();
        this.tagInputRef = React.createRef();
        this.triggerRef = React.createRef();
        this.optionsRef = React.createRef();
        this.optionContainerEl = React.createRef();
        this.clickOutsideHandler = null;
        this.foundation = new TreeSelectFoundation(this.adapter);
        this.treeSelectID = Math.random().toString(36).slice(2);
        this.onMotionEnd = () => {
            this.adapter.rePositionDropdown();
        };
    }

    static getDerivedStateFromProps(props: TreeSelectProps, prevState: TreeSelectState) {
        const { prevProps, rePosKey } = prevState;
        const { keyMaps } = props;
        const needUpdate = (name: string) => (
            (!prevProps && name in props) ||
            (prevProps && !isEqual(prevProps[name], props[name]))
        );

        let treeData;
        const withObject = props.onChangeWithObject;
        let keyEntities = prevState.keyEntities || {};
        let valueEntities = prevState.cachedKeyValuePairs || {};
        const newState: Partial<TreeSelectState> = {
            prevProps: props,
        };
        const needUpdateTreeData = needUpdate('treeData');
        const needUpdateExpandedKeys = needUpdate('expandedKeys');
        const isExpandControlled = 'expandedKeys' in props;
        const isSearching = Boolean(props.filterTreeNode && prevState.inputValue && prevState.inputValue.length);
        // TreeNode
        if (needUpdateTreeData) {
            treeData = props.treeData;
            newState.treeData = treeData;
            const entitiesMap = convertDataToEntities(treeData, keyMaps);
            newState.keyEntities = {
                ...entitiesMap.keyEntities,
            };
            keyEntities = newState.keyEntities;
            newState.cachedKeyValuePairs = { ...entitiesMap.valueEntities };
            valueEntities = newState.cachedKeyValuePairs;
        }

        // if treeData keys changes, we won't show animation
        if (
            treeData &&
            props.motion &&
            !isEqual(Object.keys(newState.keyEntities), Object.keys(prevState.keyEntities))
        ) {
            if (prevProps && props.motion) {
                newState.motionKeys = new Set([]);
                newState.motionType = null;
            }
        }
        const expandAllWhenDataChange = needUpdateTreeData && props.expandAll;
        if (!isSearching) {
            // expandedKeys
            if (needUpdateExpandedKeys || (prevProps && needUpdate('autoExpandParent'))) {
                newState.expandedKeys = calcExpandedKeys(
                    props.expandedKeys,
                    keyEntities,
                    props.autoExpandParent || !prevProps
                );
                // only show animation when treeData does not change
                if (prevProps && props.motion && !treeData) {
                    const { motionKeys, motionType } = calcMotionKeys(
                        prevState.expandedKeys,
                        newState.expandedKeys,
                        keyEntities
                    );
                    newState.motionKeys = new Set(motionKeys);
                    newState.motionType = motionType;
                    if (motionType === 'hide') {
                        // cache flatten nodes: expandedKeys changed may not be triggered by interaction
                        newState.cachedFlattenNodes = cloneDeep(prevState.flattenNodes);
                    }
                }
            } else if ((!prevProps && (props.defaultExpandAll || props.expandAll)) || expandAllWhenDataChange) {
                newState.expandedKeys = new Set(Object.keys(keyEntities));
            } else if (!prevProps && props.defaultExpandedKeys) {
                newState.expandedKeys = calcExpandedKeys(props.defaultExpandedKeys, keyEntities);
            } else if (!prevProps && props.defaultValue) {
                newState.expandedKeys = calcExpandedKeysForValues(
                    normalizeValue(props.defaultValue, withObject, keyMaps),
                    keyEntities,
                    props.multiple,
                    valueEntities
                );
            } else if (!prevProps && props.value) {
                newState.expandedKeys = calcExpandedKeysForValues(
                    normalizeValue(props.value, withObject, keyMaps),
                    keyEntities,
                    props.multiple,
                    valueEntities
                );
            }

            if (!newState.expandedKeys) {
                delete newState.expandedKeys;
            }

            if (treeData || newState.expandedKeys) {
                const flattenNodes = flattenTreeData(
                    treeData || prevState.treeData,
                    newState.expandedKeys || prevState.expandedKeys,
                    keyMaps
                );
                newState.flattenNodes = flattenNodes;
            }
        } else {
            let filteredState;
            // treeData changed while searching
            if (treeData) {
                // Get filter data
                filteredState = filterTreeData({
                    treeData,
                    inputValue: prevState.inputValue,
                    filterTreeNode: props.filterTreeNode,
                    filterProps: props.treeNodeFilterProp,
                    showFilteredOnly: props.showFilteredOnly,
                    keyEntities: newState.keyEntities,
                    prevExpandedKeys: [...prevState.filteredExpandedKeys],
                    keyMaps: keyMaps
                });
                newState.flattenNodes = filteredState.flattenNodes;
                newState.motionKeys = new Set([]);
                newState.filteredKeys = filteredState.filteredKeys;
                newState.filteredShownKeys = filteredState.filteredShownKeys;
                newState.filteredExpandedKeys = filteredState.filteredExpandedKeys;
            }

            // expandedKeys changed while searching
            if (props.expandedKeys) {
                newState.filteredExpandedKeys = calcExpandedKeys(
                    props.expandedKeys,
                    keyEntities,
                    props.autoExpandParent || !prevProps
                );

                if (prevProps && props.motion) {
                    const prevKeys = prevState ? prevState.filteredExpandedKeys : new Set([]);
                    // only show animation when treeData does not change
                    if (!treeData) {
                        const motionResult = calcMotionKeys(
                            prevKeys,
                            newState.filteredExpandedKeys,
                            keyEntities
                        );

                        let { motionKeys } = motionResult;
                        const { motionType } = motionResult;
                        if (props.showFilteredOnly) {
                            motionKeys = motionKeys.filter(key => prevState.filteredShownKeys.has(key));
                        }
                        if (motionType === 'hide') {
                            // cache flatten nodes: expandedKeys changed may not be triggered by interaction
                            newState.cachedFlattenNodes = cloneDeep(prevState.flattenNodes);
                        }
                        newState.motionKeys = new Set(motionKeys);
                        newState.motionType = motionType;
                    }
                }
                newState.flattenNodes = flattenTreeData(
                    treeData || prevState.treeData,
                    newState.filteredExpandedKeys || prevState.filteredExpandedKeys,
                    keyMaps,
                    props.showFilteredOnly && prevState.filteredShownKeys
                );
            }
        }

        // selectedKeys: single mode controlled
        const isMultiple = props.multiple;
        if (!isMultiple) {
            if (needUpdate('value')) {
                newState.selectedKeys = findKeysForValues(
                    normalizeValue(props.value, withObject, keyMaps),
                    valueEntities,
                    isMultiple
                );
            } else if (!prevProps && props.defaultValue) {
                newState.selectedKeys = findKeysForValues(
                    normalizeValue(props.defaultValue, withObject, keyMaps),
                    valueEntities,
                    isMultiple
                );
            } else if (treeData) {
                // If `treeData` changed, we also need check it
                if (props.value) {
                    newState.selectedKeys = findKeysForValues(
                        normalizeValue(props.value, withObject, keyMaps) || '',
                        valueEntities,
                        isMultiple
                    );
                } else {
                    newState.selectedKeys = updateKeys(prevState.selectedKeys, keyEntities);
                }
            }
        } else {
            // checkedKeys: multiple mode controlled || data changed
            let checkedKeyValues;

            if (needUpdate('value')) {
                checkedKeyValues = findKeysForValues(
                    normalizeValue(props.value, withObject, keyMaps),
                    valueEntities,
                    isMultiple
                );
            } else if (!prevProps && props.defaultValue) {
                checkedKeyValues = findKeysForValues(
                    normalizeValue(props.defaultValue, withObject, keyMaps),
                    valueEntities,
                    isMultiple
                );
            } else if (treeData) {
                // If `treeData` changed, we also need check it
                if (props.value) {
                    checkedKeyValues = findKeysForValues(
                        normalizeValue(props.value, withObject, keyMaps) || [],
                        valueEntities,
                        isMultiple
                    );
                } else {
                    checkedKeyValues = updateKeys(props.checkRelation === 'related' ? prevState.checkedKeys : prevState.realCheckedKeys, keyEntities);
                }
            }

            if (checkedKeyValues) {
                if (props.checkRelation === 'unRelated') {
                    newState.realCheckedKeys = new Set(checkedKeyValues);
                } else if (props.checkRelation === 'related') {
                    const { checkedKeys, halfCheckedKeys } = calcCheckedKeys(checkedKeyValues, keyEntities);

                    newState.checkedKeys = checkedKeys;
                    newState.halfCheckedKeys = halfCheckedKeys;
                }
            }
        }

        // loadedKeys
        if (needUpdate('loadedKeys')) {
            newState.loadedKeys = new Set(props.loadedKeys);
        }

        // ================== rePosKey ==================
        if (needUpdateTreeData || needUpdate('value')) {
            newState.rePosKey = rePosKey + 1;
        }

        // ================ disableStrictly =================
        if (treeData && props.disableStrictly && props.checkRelation === 'related') {
            newState.disabledKeys = calcDisabledKeys(keyEntities, keyMaps);
        }

        return newState;
    }

    get adapter(): TreeSelectAdapter<TreeSelectProps, TreeSelectState> {
        const filterAdapter: Pick<TreeSelectAdapter, 'updateInputValue'> = {
            updateInputValue: value => {
                this.setState({ inputValue: value });
            }
        };
        const treeSelectAdapter: Pick<TreeSelectAdapter,
        'registerClickOutsideHandler'
        | 'unregisterClickOutsideHandler'
        | 'rePositionDropdown'
        > = {
            registerClickOutsideHandler: cb => {
                this.adapter.unregisterClickOutsideHandler();
                const clickOutsideHandler = (e: Event) => {
                    const triggerDom = this.triggerRef && this.triggerRef.current;
                    const optionsDom = (this.optionContainerEl && this.optionContainerEl.current) as HTMLDivElement;
                    const target = e.target as Element;
                    const path = e.composedPath && e.composedPath() || [target];

                    if (
                        optionsDom &&
                        (
                            !optionsDom.contains(target) ||
                            !optionsDom.contains(target.parentNode)
                        ) &&
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
                if (!this.clickOutsideHandler) {
                    return;
                }
                document.removeEventListener('mousedown', this.clickOutsideHandler, false);
                this.clickOutsideHandler = null;
            },
            rePositionDropdown: () => {
                let { rePosKey } = this.state;
                rePosKey = rePosKey + 1;
                this.setState({ rePosKey });
            },
        };
        const treeAdapter: Pick<TreeSelectAdapter,
        'updateState'
        | 'notifySelect'
        | 'notifySearch'
        | 'cacheFlattenNodes'
        | 'notifyLoad'
        | 'notifyClear'
        > = {
            updateState: states => {
                this.setState({ ...states } as TreeSelectState);
            },
            notifySelect: ((selectKey, bool, node) => {
                this.props.onSelect && this.props.onSelect(selectKey, bool, node);
            }),
            notifySearch: (input, filteredExpandedKeys, filteredNodes) => {
                this.props.onSearch && this.props.onSearch(input, filteredExpandedKeys, filteredNodes);
            },
            cacheFlattenNodes: bool => {
                this.setState({ cachedFlattenNodes: bool ? cloneDeep(this.state.flattenNodes) : undefined });
            },
            notifyLoad: (newLoadedKeys, data) => {
                const { onLoad } = this.props;
                isFunction(onLoad) && onLoad(newLoadedKeys, data);
            },
            notifyClear: (e: React.MouseEvent | React.KeyboardEvent<HTMLDivElement>) => {
                this.props.onClear && this.props.onClear(e);
            }
        };
        return {
            ...super.adapter,
            ...filterAdapter,
            ...treeSelectAdapter,
            ...treeAdapter,
            updateLoadKeys: (data, resolve) => {
                this.setState(({ loadedKeys, loadingKeys }) =>
                    this.foundation.handleNodeLoad(loadedKeys, loadingKeys, data, resolve));
            },
            updateState: states => {
                this.setState({ ...states } as TreeSelectState);
            },
            openMenu: () => {
                this.setState({ isOpen: true }, () => {
                    this.props.onVisibleChange(true);
                });
            },
            closeMenu: cb => {
                this.setState({ isOpen: false }, () => {
                    cb && cb();
                    this.props.onVisibleChange(false);
                });
            },
            getTriggerWidth: () => {
                const el = this.triggerRef.current;
                return el && el.getBoundingClientRect().width;
            },
            setOptionWrapperWidth: width => {
                this.setState({ dropdownMinWidth: width });
            },
            notifyChange: (value, node, e) => {
                this.props.onChange && this.props.onChange(value, node, e);
            },
            notifyChangeWithObject: (node, e) => {
                this.props.onChange && this.props.onChange(node, e);
            },
            notifyExpand: (expandedKeys, { expanded: bool, node }) => {
                this.props.onExpand && this.props.onExpand([...expandedKeys], { expanded: bool, node });
                if (bool && this.props.loadData) {
                    this.onNodeLoad(node);
                }
            },
            notifyFocus: (...v) => {
                this.props.onFocus && this.props.onFocus(...v);
            },
            notifyBlur: (...v) => {
                this.props.onBlur && this.props.onBlur(...v);
            },
            toggleHovering: bool => {
                this.setState({ isHovering: bool });
            },
            updateInputFocus: bool => {
                if (bool) {
                    if (this.inputRef && this.inputRef.current) {
                        const { preventScroll } = this.props;
                        (this.inputRef.current as any).focus({ preventScroll });
                    }
                    if (this.tagInputRef && this.tagInputRef.current) {
                        this.tagInputRef.current.focus();
                    }
                } else {
                    if (this.inputRef && this.inputRef.current) {
                        (this.inputRef.current as any).blur();
                    }
                    if (this.tagInputRef && this.tagInputRef.current) {
                        this.tagInputRef.current.blur();
                    }
                }
            },
            updateIsFocus: bool => {
                this.setState({ isFocus: bool });
            },
        };
    }

    componentDidMount() {
        this.foundation.init();
    }

    componentWillUnmount() {
        this.foundation.destroy();
    }

    renderSuffix = () => {
        const { suffix }: any = this.props;
        const suffixWrapperCls = cls({
            [`${prefixcls}-suffix`]: true,
            [`${prefixcls}-suffix-text`]: suffix && isString(suffix),
            [`${prefixcls}-suffix-icon`]: isSemiIcon(suffix),
        });
        return (
            <div className={suffixWrapperCls} x-semi-prop="suffix">
                {suffix}
            </div>
        );
    };

    renderPrefix = () => {
        const { prefix, insetLabel, insetLabelId }: any = this.props;
        const labelNode = prefix || insetLabel;
        const prefixWrapperCls = cls({
            [`${prefixcls}-prefix`]: true,
            // to be doublechecked
            [`${prefixcls}-inset-label`]: insetLabel,
            [`${prefixcls}-prefix-text`]: labelNode && isString(labelNode),
            [`${prefixcls}-prefix-icon`]: isSemiIcon(labelNode),
        });

        return (
            <div className={prefixWrapperCls} id={insetLabelId} x-semi-prop="prefix,insetLabel">
                {labelNode}
            </div>
        );
    };

    renderContent = () => {
        const { dropdownMinWidth } = this.state;
        const { dropdownStyle, dropdownClassName } = this.props;
        const style = { minWidth: dropdownMinWidth, ...dropdownStyle };
        const popoverCls = cls(dropdownClassName, `${prefixcls}-popover`);
        return (
            <div className={popoverCls} style={style} onKeyDown={this.foundation.handleKeyDown} ref={this.optionContainerEl}>
                {this.renderTree()}
            </div>
        );
    };

    removeTag = (removedKey: TreeNodeData['key']) => {
        this.foundation.removeTag(removedKey);
    };

    handleClick = (e: React.MouseEvent) => {
        this.foundation.handleClick(e);
    };

    getDataForKeyNotInKeyEntities = (key: string) => {
        return this.foundation.getDataForKeyNotInKeyEntities(key);
    }

    /* istanbul ignore next */
    handleSelectionEnterPress = (e: React.KeyboardEvent<HTMLDivElement>) => {
        this.foundation.handleSelectionEnterPress(e);
    };

    hasValue = (): boolean => {
        const { multiple, checkRelation } = this.props;
        const { realCheckedKeys, checkedKeys, selectedKeys } = this.state;
        let hasValue = false;
        if (multiple) {
            if (checkRelation === 'related') {
                hasValue = Boolean(checkedKeys.size);
            } else if (checkRelation === 'unRelated') {
                hasValue = Boolean(realCheckedKeys.size);
            }
        } else {
            hasValue = Boolean(selectedKeys.length);
        }
        return hasValue;
    }

    showClearBtn = () => {
        const { showClear, disabled, searchPosition } = this.props;
        const { inputValue, isOpen, isHovering } = this.state;
        const triggerSearchHasInputValue = searchPosition === strings.SEARCH_POSITION_TRIGGER && inputValue;

        return showClear && (this.hasValue() || triggerSearchHasInputValue) && !disabled && (isOpen || isHovering);
    };

    renderTagList = (triggerRenderKeys: string[]) => {
        const { keyEntities, disabledKeys } = this.state;
        const {
            treeNodeLabelProp,
            leafOnly,
            disabled,
            disableStrictly,
            size,
            renderSelectedItem: propRenderSelectedItem,
            keyMaps
        } = this.props;
        const realLabelName = get(keyMaps, 'label', treeNodeLabelProp);
        const renderSelectedItem = isFunction(propRenderSelectedItem) ?
            propRenderSelectedItem :
            (item: TreeNodeData) => ({
                isRenderInTag: true,
                content: get(item, realLabelName, null)
            });
        const tagList: Array<React.ReactNode> = [];
        triggerRenderKeys.forEach((key: TreeNodeData['key'], index) => {
            const item = (keyEntities[key] && keyEntities[key].key === key) ? keyEntities[key].data : this.getDataForKeyNotInKeyEntities(key);
            const onClose = (tagContent: any, e: React.MouseEvent) => {
                if (e && typeof e.preventDefault === 'function') {
                    // make sure that tag will not hidden immediately in controlled mode
                    e.preventDefault();
                }
                this.removeTag(key);
            };
            const { content, isRenderInTag } = item ?
                (renderSelectedItem as RenderSelectedItemInMultiple)(item, { index, onClose }) :
                ({} as any);
            if (isNull(content) || isUndefined(content)) {
                return;
            }
            const isDisabled = disabled || item.disabled || (disableStrictly && disabledKeys.has(item.key));
            const tag: Partial<TagProps> & React.Attributes = {
                closable: !isDisabled,
                color: 'white',
                visible: true,
                onClose,
                key: `tag-${key}-${index}`,
                size: size === 'small' ? 'small' : 'large'
            };
            if (isRenderInTag) {
                // pass ReactNode list to tagList when using tagGroup custom mode
                tagList.push(<Tag {...tag}>{content}</Tag>);
            } else {
                tagList.push(content);
            }
        });
        return tagList;
    };

    /**
     * When single selection and the search box is on trigger, the items displayed in the rendered search box
     */
    renderSingleTriggerSearchItem = () => {
        const { placeholder, disabled } = this.props;
        const { inputTriggerFocus } = this.state;
        const renderText = this.foundation.getRenderTextInSingle();
        const spanCls = cls(`${prefixcls}-selection-TriggerSearchItem`, {
            [`${prefixcls}-selection-TriggerSearchItem-placeholder`]: (inputTriggerFocus || !renderText) && !disabled,
            [`${prefixcls}-selection-TriggerSearchItem-disabled`]: disabled,
        });
        return (
            <span className={spanCls} onClick={this.foundation.onClickSingleTriggerSearchItem}>
                {renderText ? renderText : placeholder}
            </span>
        );
    };

    /**
     * Single selection and the search box content rendered when the search box is on trigger
     */
    renderSingleTriggerSearch = () => {
        const { inputValue } = this.state;
        return (
            <>
                {this.renderInput()}
                {!inputValue && this.renderSingleTriggerSearchItem()}
            </>
        );
    };

    renderSelectContent = (triggerRenderKeys: string[]) => {
        const {
            multiple,
            placeholder,
            maxTagCount,
            searchPosition,
            filterTreeNode,
            showRestTagsPopover,
            restTagsPopoverProps
        } = this.props;
        const isTriggerPositionSearch = filterTreeNode && searchPosition === strings.SEARCH_POSITION_TRIGGER;
        // searchPosition = trigger
        if (isTriggerPositionSearch) {
            return multiple ? this.renderTagInput(triggerRenderKeys) : this.renderSingleTriggerSearch();
        }
        // searchPosition = dropdown and single seleciton
        if (!multiple || !this.hasValue()) {
            const renderText = this.foundation.getRenderTextInSingle();
            const spanCls = cls(`${prefixcls}-selection-content`, {
                [`${prefixcls}-selection-placeholder`]: !renderText,
            });
            return <span className={spanCls}>{renderText ? renderText : placeholder}</span>;
        }
        // searchPosition = dropdown and multiple seleciton
        const tagList = this.renderTagList(triggerRenderKeys);
        // mode=custom to return tagList directly
        return (
            <TagGroup<'custom'>
                maxTagCount={maxTagCount}
                tagList={tagList}
                size="large"
                mode="custom"
                showPopover={showRestTagsPopover}
                popoverProps={restTagsPopoverProps}
            />
        );
    };

    handleClear = (e: React.MouseEvent) => {
        e && e.stopPropagation();
        this.foundation.handleClear(e);
    };

    /* istanbul ignore next */
    handleClearEnterPress = (e: React.KeyboardEvent<HTMLDivElement>) => {
        e && e.stopPropagation();
        this.foundation.handleClearEnterPress(e);
    };

    handleMouseOver = (e: React.MouseEvent) => {
        this.foundation.toggleHoverState(true);
    };

    handleMouseLeave = (e: React.MouseEvent) => {
        this.foundation.toggleHoverState(false);
    };

    search = (value: string) => {
        const { isOpen } = this.state;
        if (!isOpen) {
            this.foundation.open();
        }
        this.foundation.handleInputChange(value);
    };

    close = () => {
        this.foundation.close(null);
    };

    renderArrow = () => {
        const showClearBtn = this.showClearBtn();
        const { arrowIcon } = this.props;
        if (showClearBtn) {
            return null;
        }
        return arrowIcon ? (
            <div className={cls(`${prefixcls}-arrow`)} x-semi-prop="arrowIcon">
                {arrowIcon}
            </div>
        ) : null;
    };

    renderClearBtn = () => {
        const showClearBtn = this.showClearBtn();
        const { clearIcon } = this.props;
        const clearCls = cls(`${prefixcls}-clearbtn`);
        if (showClearBtn) {
            return (
                <div
                    role='button'
                    tabIndex={0}
                    aria-label="Clear TreeSelect value"
                    className={clearCls}
                    onClick={this.handleClear}
                    onKeyPress={this.handleClearEnterPress}
                >
                    {clearIcon ? clearIcon : <IconClear />}
                </div>
            );
        }
        return null;
    };

    renderSelection = () => {
        const {
            disabled,
            multiple,
            filterTreeNode,
            validateStatus,
            prefix,
            suffix,
            style,
            size,
            insetLabel,
            className,
            placeholder,
            showClear,
            leafOnly,
            searchPosition,
            triggerRender,
            borderless,
            autoMergeValue,
            checkRelation,
            ...rest
        } = this.props;
        const { inputValue, selectedKeys, checkedKeys, keyEntities, isFocus, realCheckedKeys } = this.state;
        const filterable = Boolean(filterTreeNode);
        const useCustomTrigger = typeof triggerRender === 'function';
        const mouseEvent = showClear ?
            {
                onMouseEnter: (e: React.MouseEvent) => this.handleMouseOver(e),
                onMouseLeave: (e: React.MouseEvent) => this.handleMouseLeave(e),
            } :
            {};
        const isTriggerPositionSearch = searchPosition === strings.SEARCH_POSITION_TRIGGER && filterable;
        const isEmptyTriggerSearch = isTriggerPositionSearch && isEmpty(checkedKeys);
        const isValueTriggerSearch = isTriggerPositionSearch && !isEmpty(checkedKeys);
        const classNames = useCustomTrigger ?
            cls(className) :
            cls(
                prefixcls,
                {
                    [`${prefixcls}-borderless`]: borderless,
                    [`${prefixcls}-focus`]: isFocus,
                    [`${prefixcls}-disabled`]: disabled,
                    [`${prefixcls}-single`]: !multiple,
                    [`${prefixcls}-multiple`]: multiple,
                    [`${prefixcls}-multiple-tagInput-empty`]: multiple && isEmptyTriggerSearch,
                    [`${prefixcls}-multiple-tagInput-notEmpty`]: multiple && isValueTriggerSearch,
                    [`${prefixcls}-filterable`]: filterable,
                    [`${prefixcls}-error`]: validateStatus === 'error',
                    [`${prefixcls}-warning`]: validateStatus === 'warning',
                    [`${prefixcls}-small`]: size === 'small',
                    [`${prefixcls}-large`]: size === 'large',
                    [`${prefixcls}-with-prefix`]: prefix || insetLabel,
                    [`${prefixcls}-with-suffix`]: suffix,
                    [`${prefixcls}-with-suffix`]: suffix,
                },
                className
            );
        let inner: React.ReactNode | React.ReactNode[];
        let triggerRenderKeys = [];
        if (multiple) {
            if (!autoMergeValue) {
                triggerRenderKeys = [...checkedKeys];
            } else if (checkRelation === 'related') {
                triggerRenderKeys = normalizeKeyList([...checkedKeys], keyEntities, leafOnly, true);
            } else if (checkRelation === 'unRelated') {
                triggerRenderKeys = [...realCheckedKeys];
            }
        } else {
            triggerRenderKeys = selectedKeys;
        }
        if (useCustomTrigger) {
            inner = <Trigger
                inputValue={inputValue}
                value={triggerRenderKeys.map((key: string) => get(keyEntities, [key, 'data']))}
                disabled={disabled}
                placeholder={placeholder}
                onClear={this.handleClear}
                componentName={'TreeSelect'}
                triggerRender={triggerRender}
                componentProps={{ ...this.props }}
                onSearch={this.search}
                onRemove={this.removeTag}
            />;
        } else {
            inner = [
                <Fragment key={'prefix'}>{prefix || insetLabel ? this.renderPrefix() : null}</Fragment>,
                <Fragment key={'selection'}>
                    <div className={`${prefixcls}-selection`}>{this.renderSelectContent(triggerRenderKeys)}</div>
                </Fragment>,
                <Fragment key={'suffix'}>{suffix ? this.renderSuffix() : null}</Fragment>,
                <Fragment key={'clearBtn'}>
                    {
                        (showClear || (isTriggerPositionSearch && inputValue)) ?
                            this.renderClearBtn() :
                            null
                    }
                </Fragment>,
                <Fragment key={'arrow'}>{this.renderArrow()}</Fragment>,
            ];
        }
        const tabIndex = disabled ? null : 0;
        /**
         * Reasons for disabling the a11y eslint rule:
         * The following attributes(aria-controls,aria-expanded) will be automatically added by Tooltip, no need to declare here
         */
        return (
            <div
                // eslint-disable-next-line jsx-a11y/role-has-required-aria-props
                role='combobox'
                aria-disabled={disabled}
                aria-haspopup="tree"
                tabIndex={tabIndex}
                className={classNames}
                style={style}
                ref={this.triggerRef}
                onClick={this.handleClick}
                onKeyPress={this.handleSelectionEnterPress}
                onKeyDown={this.foundation.handleKeyDown}
                aria-invalid={this.props['aria-invalid']}
                aria-errormessage={this.props['aria-errormessage']}
                aria-label={this.props['aria-label']}
                aria-labelledby={this.props['aria-labelledby']}
                aria-describedby={this.props['aria-describedby']}
                aria-required={this.props['aria-required']}
                {...mouseEvent}
                {...this.getDataAttr(rest)}
            >
                {inner}
            </div>
        );
    };

    renderTagItem = (key: string, idx: number) => {
        const { keyEntities, disabledKeys } = this.state;
        const {
            size,
            leafOnly,
            disabled,
            disableStrictly,
            renderSelectedItem: propRenderSelectedItem,
            treeNodeLabelProp,
            keyMaps
        } = this.props;
        const realLabelName = get(keyMaps, 'label', treeNodeLabelProp);
        const keyList = normalizeKeyList([key], keyEntities, leafOnly, true);
        const nodes = keyList.map(i => (keyEntities[key] && keyEntities[key].key === key) ? keyEntities[key].data : this.getDataForKeyNotInKeyEntities(key));
        const value = getValueOrKey(nodes, keyMaps);
        const tagCls = cls(`${prefixcls}-selection-tag`, {
            [`${prefixcls}-selection-tag-disabled`]: disabled,
        });
        const nodeHaveData = !isEmpty(nodes) && !isEmpty(nodes[0]);
        const isDisableStrictlyNode = disableStrictly && nodeHaveData && disabledKeys.has(nodes[0].key);
        const closable = nodeHaveData && !nodes[0].disabled && !disabled && !isDisableStrictlyNode;
        const onClose = (tagChildren: React.ReactNode, e: React.MouseEvent) => {
            // When value has not changed, prevent clicking tag closeBtn to close tag
            e.preventDefault();
            this.removeTag(key);
        };
        const tagProps: Partial<TagProps> & React.Attributes = {
            size: size === 'small' ? 'small' : 'large',
            key: `tag-${value}-${idx}`,
            color: 'white',
            className: tagCls,
            closable,
            onClose,
        };
        const item = nodes[0];
        const renderSelectedItem = isFunction(propRenderSelectedItem) ? propRenderSelectedItem :
            (selectedItem: TreeNodeData) => ({
                isRenderInTag: true,
                content: get(selectedItem, realLabelName, null)
            });
        if (isFunction(renderSelectedItem)) {
            const { content, isRenderInTag } = item ?
                (renderSelectedItem as RenderSelectedItemInMultiple)(item, { index: idx, onClose }) :
                ({} as any);
            if (isRenderInTag) {
                return <Tag {...tagProps}>{content}</Tag>;
            } else {
                return content;
            }
        }
        return (
            <Tag {...tagProps}>
                {value}
            </Tag>
        );
    };

    renderTagInput = (triggerRenderKeys: string[]) => {
        const {
            disabled,
            size,
            searchAutoFocus,
            placeholder,
            maxTagCount,
            showRestTagsPopover,
            restTagsPopoverProps,
            searchPosition,
            filterTreeNode,
            preventScroll
        } = this.props;
        const {
            inputValue,
        } = this.state;
        // auto focus search input divide into two parts
        // 1. filterTreeNode && searchPosition === strings.SEARCH_POSITION_TRIGGER
        //    Implemented by passing autofocus to the underlying input's autofocus
        // 2. filterTreeNode && searchPosition === strings.SEARCH_POSITION_DROPDOWN
        //    Due to the off-screen rendering in the tooltip implementation mechanism, if it is implemented through the 
        //    autofocus of the input, when the option panel is opened, the page will scroll to top, so it is necessary 
        //    to call the focus method through ref in the onVisibleChange callback of the Popover to achieve focus
        const autoFocus = (filterTreeNode && searchPosition === strings.SEARCH_POSITION_TRIGGER) ? searchAutoFocus : undefined;
        return (
            <TagInput
                maxTagCount={maxTagCount}
                disabled={disabled}
                onInputChange={v => this.search(v)}
                ref={this.tagInputRef}
                placeholder={placeholder}
                value={triggerRenderKeys}
                inputValue={inputValue}
                size={size}
                showRestTagsPopover={showRestTagsPopover}
                restTagsPopoverProps={restTagsPopoverProps}
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus={autoFocus}
                renderTagItem={(itemKey, index) => this.renderTagItem(itemKey, index)}
                onRemove={itemKey => this.removeTag(itemKey)}
                expandRestTagsOnClick={false}
                preventScroll={preventScroll}
            />
        );
    };

    // render Tree
    renderInput = () => {
        const {
            searchPlaceholder,
            searchRender,
            showSearchClear,
            searchPosition,
            searchAutoFocus,
            multiple,
            disabled,
            preventScroll,
        } = this.props;
        const { inputValue, inputTriggerFocus } = this.state;
        const isDropdownPositionSearch = searchPosition === strings.SEARCH_POSITION_DROPDOWN;
        const inputcls = cls({
            [`${prefixTree}-input`]: isDropdownPositionSearch,
            [`${prefixcls}-inputTrigger`]: !isDropdownPositionSearch
        });
        const baseInputProps = {
            value: inputValue,
            className: inputcls,
            preventScroll,
            onChange: (value: string) => this.search(value),
        };
        const inputDropdownProps = {
            showClear: showSearchClear,
            prefix: <IconSearch />,
        };
        const inputTriggerProps = {
            autofocus: searchAutoFocus,
            onFocus: (e: React.FocusEvent) => this.foundation.handleInputTriggerFocus(),
            onBlur: (e: React.FocusEvent) => this.foundation.handleInputTriggerBlur(),
            disabled,
        };
        const realInputProps = isDropdownPositionSearch ? inputDropdownProps : inputTriggerProps;
        const wrapperCls = cls({
            [`${prefixTree}-search-wrapper`]: isDropdownPositionSearch,
            [`${prefixcls}-triggerSingleSearch-wrapper`]: !isDropdownPositionSearch && !multiple,
            [`${prefixcls}-triggerSingleSearch-upper`]: !isDropdownPositionSearch && inputTriggerFocus,
        });
        const useCusSearch = typeof searchRender === 'function' || typeof searchRender === 'boolean';
        if (useCusSearch && !searchRender) {
            return null;
        }
        return (
            <div className={wrapperCls}>
                <LocaleConsumer componentName="TreeSelect">
                    {(locale: Locale['TreeSelect']) => {
                        const placeholder = isDropdownPositionSearch ?
                            searchPlaceholder || locale.searchPlaceholder :
                            '';
                        if (useCusSearch) {
                            return (searchRender as any)({ ...realInputProps, ...baseInputProps, placeholder });
                        }
                        return (
                            <Input
                                aria-label='Filter TreeSelect item'
                                ref={this.inputRef as any}
                                placeholder={placeholder}
                                {...baseInputProps}
                                {...realInputProps}
                            />
                        );
                    }}
                </LocaleConsumer>
            </div>
        );
    };

    renderEmpty = () => {
        const { emptyContent } = this.props;
        if (emptyContent === null) {
            return null;
        }
        if (emptyContent) {
            return <TreeNode empty emptyContent={this.props.emptyContent} />;
        } else {
            return (
                <LocaleConsumer componentName="Tree">
                    {(locale: Locale['Tree']) => <TreeNode empty emptyContent={locale.emptyText} />}
                </LocaleConsumer>
            );
        }
    };

    onNodeLoad = (data: TreeNodeData) => new Promise(resolve => this.foundation.setLoadKeys(data, resolve));

    onNodeSelect = (e: React.MouseEvent | React.KeyboardEvent, treeNode: TreeNodeProps) => {
        this.foundation.handleNodeSelect(e, treeNode);
    };

    onNodeCheck = (e: React.MouseEvent | React.KeyboardEvent, treeNode: TreeNodeProps) => {
        this.foundation.handleNodeSelect(e, treeNode);
    };

    onNodeExpand = (e: React.MouseEvent | React.KeyboardEvent, treeNode: TreeNodeProps) => {
        this.foundation.handleNodeExpand(e, treeNode);
    };

    getTreeNodeRequiredProps = () => {
        const { expandedKeys, selectedKeys, checkedKeys, halfCheckedKeys, keyEntities, filteredKeys } = this.state;
        return {
            expandedKeys: expandedKeys || new Set(),
            selectedKeys: selectedKeys || [],
            checkedKeys: checkedKeys || new Set(),
            halfCheckedKeys: halfCheckedKeys || new Set(),
            filteredKeys: filteredKeys || new Set(),
            keyEntities,
        };
    };

    getTreeNodeKey = (treeNode: TreeNodeData) => {
        const { data } = treeNode;
        const { key }: { key: string } = data;
        return key;
    };

    /* Event handler function after popover visible change */
    handlePopoverVisibleChange = isVisible => {
        this.foundation.handlePopoverVisibleChange(isVisible);
    }

    afterClose = () => {
        this.foundation.handleAfterClose();
    }

    renderTreeNode = (treeNode: FlattenNode, ind: number, style: React.CSSProperties) => {
        const { data, key } = treeNode;
        const treeNodeProps = this.foundation.getTreeNodeProps(key);
        const { showLine } = this.props;
        if (!treeNodeProps) {
            return null;
        }
        const props: any = pick(treeNode, ['key', 'label', 'disabled', 'isLeaf', 'icon', 'isEnd']);
        const { keyMaps, expandIcon } = this.props;
        const children = data[get(keyMaps, 'children', 'children')];
        !isUndefined(children) && (props.children = children);
        return <TreeNode 
            {...treeNodeProps} 
            {...data} 
            {...props} 
            data={data} 
            style={style} 
            showLine={showLine}
            expandIcon={expandIcon}
        />;
    };

    itemKey = (index: number, data: Record<string, any>) => {
        const { visibleOptions } = data;
        // Find the item at the specified index.
        const item = visibleOptions[index];
        // Return a value that uniquely identifies this item.
        return item.key;
    };

    renderNodeList = () => {
        const { flattenNodes, cachedFlattenNodes, motionKeys, motionType, filteredKeys } = this.state;
        const { direction } = this.context;
        const { virtualize, motionExpand } = this.props;
        const isExpandControlled = 'expandedKeys' in this.props;
        if (!virtualize || isEmpty(virtualize)) {
            return (
                <NodeList
                    flattenNodes={flattenNodes}
                    flattenList={cachedFlattenNodes}
                    motionKeys={motionExpand ? motionKeys : new Set([])}
                    motionType={motionType}
                    // When motionKeys is empty, but filteredKeys is not empty (that is, the search hits), this situation should be distinguished from ordinary motionKeys
                    searchTargetIsDeep={
                        isExpandControlled &&
                        motionExpand &&
                        isEmpty(motionKeys) &&
                        !isEmpty(filteredKeys)
                    }
                    onMotionEnd={this.onMotionEnd}
                    renderTreeNode={this.renderTreeNode}
                />
            );
        }

        const data = {
            visibleOptions: flattenNodes,
            renderOption: this.renderTreeNode
        };

        return (
            <AutoSizer defaultHeight={virtualize.height} defaultWidth={virtualize.width}>
                {({ height, width }) => (
                    <VirtualList
                        itemCount={flattenNodes.length}
                        itemSize={virtualize.itemSize}
                        height={height}
                        width={width}
                        // @ts-ignore avoid strict check of itemKey
                        itemKey={this.itemKey}
                        itemData={data}
                        className={`${prefixTree}-virtual-list`}
                        style={{ direction }}
                    >
                        {VirtualRow}
                    </VirtualList>
                )}
            </AutoSizer>
        );
    };

    renderTree = () => {
        const { keyEntities, motionKeys, motionType, inputValue, filteredKeys, flattenNodes, checkedKeys, realCheckedKeys } = this.state;
        const {
            loadData,
            filterTreeNode,
            disabled,
            multiple,
            showFilteredOnly,
            motionExpand,
            outerBottomSlot,
            outerTopSlot,
            expandAction,
            labelEllipsis,
            virtualize,
            optionListStyle,
            searchPosition,
            renderLabel,
            renderFullLabel,
            checkRelation,
            emptyContent
        } = this.props;
        const wrapperCls = cls(`${prefixTree}-wrapper`);
        const searchNoRes = Boolean(inputValue) && !filteredKeys.size;
        const noData = isEmpty(flattenNodes) || (showFilteredOnly && searchNoRes);
        const isDropdownPositionSearch = searchPosition === strings.SEARCH_POSITION_DROPDOWN;
        const listCls = cls(`${prefixTree}-option-list ${prefixTree}-option-list-block`, {
            [`${prefixTree}-option-list-hidden`]: emptyContent === null && noData,
        });
        return (
            <TreeContext.Provider
                value={{
                    loadData,
                    treeDisabled: disabled,
                    motion: motionExpand,
                    motionKeys,
                    motionType,
                    expandAction,
                    filterTreeNode,
                    keyEntities,
                    onNodeClick: this.onNodeClick,
                    onNodeDoubleClick: this.onNodeDoubleClick,
                    // tree node will call this function when treeNode is right clicked
                    onNodeRightClick: noop,
                    onNodeExpand: this.onNodeExpand,
                    onNodeSelect: this.onNodeSelect,
                    onNodeCheck: this.onNodeCheck,
                    renderTreeNode: this.renderTreeNode,
                    multiple,
                    showFilteredOnly,
                    isSearching: Boolean(inputValue),
                    renderLabel,
                    renderFullLabel,
                    labelEllipsis: typeof labelEllipsis === 'undefined' ? virtualize : labelEllipsis,
                }}
            >
                <div className={wrapperCls}>
                    {outerTopSlot}
                    {
                        !outerTopSlot &&
                        filterTreeNode &&
                        isDropdownPositionSearch &&
                        this.renderInput()
                    }
                    <div className={listCls} role="tree" aria-multiselectable={multiple ? true : false} style={optionListStyle}>
                        {noData ? this.renderEmpty() : (multiple ?
                            (<CheckboxGroup value={Array.from(checkRelation === 'related' ? checkedKeys : realCheckedKeys)}>
                                {this.renderNodeList()}
                            </CheckboxGroup>) :
                            this.renderNodeList()
                        )}
                    </div>
                    {outerBottomSlot}
                </div>
            </TreeContext.Provider>
        );
    };

    render() {
        const content = this.renderContent();
        const {
            motion,
            zIndex,
            mouseLeaveDelay,
            mouseEnterDelay,
            autoAdjustOverflow,
            stopPropagation,
            getPopupContainer,
            dropdownMargin,
            position,
        } = this.props;
        const { isOpen, rePosKey } = this.state;
        const selection = this.renderSelection();
        const pos = position ? position : 'bottomLeft';
        return (
            <Popover
                stopPropagation={stopPropagation}
                getPopupContainer={getPopupContainer}
                zIndex={zIndex}
                motion={motion}
                margin={dropdownMargin}
                ref={this.optionsRef}
                content={content}
                visible={isOpen}
                trigger="custom"
                rePosKey={rePosKey}
                position={pos}
                autoAdjustOverflow={autoAdjustOverflow}
                mouseLeaveDelay={mouseLeaveDelay}
                mouseEnterDelay={mouseEnterDelay}
                onVisibleChange={this.handlePopoverVisibleChange}
                afterClose={this.afterClose}
            >
                {selection}
            </Popover>
        );
    }
}

export default TreeSelect;
