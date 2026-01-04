import React, { MouseEvent, KeyboardEvent } from 'react';
import cls from 'classnames';
import PropTypes from 'prop-types';
import ConfigContext, { ContextValue } from '../configProvider/context';
import TreeFoundation, { TreeAdapter } from '@douyinfe/semi-foundation/tree/foundation';
import {
    convertDataToEntities,
    flattenTreeData,
    calcExpandedKeysForValues,
    calcMotionKeys,
    convertJsonToData,
    findKeysForValues,
    calcCheckedKeys,
    calcExpandedKeys,
    filterTreeData,
    normalizeValue,
    updateKeys,
    calcDisabledKeys
} from '@douyinfe/semi-foundation/tree/treeUtil';
import { cssClasses, strings } from '@douyinfe/semi-foundation/tree/constants';
import BaseComponent from '../_base/baseComponent';
import { isEmpty, isEqual, get, isFunction, pick, isUndefined } from 'lodash';
import { cloneDeep } from './treeUtil';
import Input from '../input/index';
import { FixedSizeList as VirtualList } from 'react-window';
import AutoSizer from './autoSizer';
import TreeContext from './treeContext';
import TreeNode from './treeNode';
import NodeList from './nodeList';
import LocaleConsumer from '../locale/localeConsumer';
import '@douyinfe/semi-foundation/tree/tree.scss';
import { IconSearch } from '@douyinfe/semi-icons';
import { Locale as LocaleObject } from '../locale/interface';
import {
    TreeProps,
    TreeState,
    TreeNodeProps,
    TreeNodeData,
    FlattenNode,
    KeyEntity,
    OptionProps,
    ScrollData,
} from './interface';
import CheckboxGroup from '../checkbox/checkboxGroup';

export * from './interface';
export type { AutoSizerProps } from './autoSizer';

const prefixcls = cssClasses.PREFIX;

const treeDataNodeShape = {
    key: PropTypes.string,
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    label: PropTypes.any,
    isLeaf: PropTypes.bool,
    children: PropTypes.array,
};
treeDataNodeShape.children = PropTypes.arrayOf(PropTypes.shape(treeDataNodeShape));

class Tree extends BaseComponent<TreeProps, TreeState> {
    static contextType = ConfigContext;

    static propTypes = {
        autoMergeValue: PropTypes.bool,
        blockNode: PropTypes.bool,
        className: PropTypes.string,
        showClear: PropTypes.bool,
        defaultExpandAll: PropTypes.bool,
        defaultExpandedKeys: PropTypes.array,
        defaultValue: PropTypes.oneOfType([PropTypes.string, PropTypes.array]),
        directory: PropTypes.bool,
        disabled: PropTypes.bool,
        emptyContent: PropTypes.node,
        expandAll: PropTypes.bool,
        expandedKeys: PropTypes.array,
        filterTreeNode: PropTypes.oneOfType([PropTypes.func, PropTypes.bool]),
        icon: PropTypes.node,
        onChangeWithObject: PropTypes.bool,
        motion: PropTypes.bool,
        multiple: PropTypes.bool,
        onChange: PropTypes.func,
        onExpand: PropTypes.func,
        onSearch: PropTypes.func,
        onSelect: PropTypes.func,
        onContextMenu: PropTypes.func,
        onDoubleClick: PropTypes.func,
        searchClassName: PropTypes.string,
        searchPlaceholder: PropTypes.string,
        searchStyle: PropTypes.object,
        selectedKey: PropTypes.string,
        showFilteredOnly: PropTypes.bool,
        showLine: PropTypes.bool,
        style: PropTypes.object,
        treeData: PropTypes.arrayOf(PropTypes.shape(treeDataNodeShape)),
        keyMaps: PropTypes.object,
        treeDataSimpleJson: PropTypes.object,
        treeNodeFilterProp: PropTypes.string,
        value: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.array, PropTypes.object]),
        virtualize: PropTypes.object,
        autoExpandParent: PropTypes.bool,
        expandAction: PropTypes.oneOf(strings.EXPAND_ACTION),
        searchRender: PropTypes.oneOfType([PropTypes.func, PropTypes.bool]),
        renderLabel: PropTypes.func,
        renderFullLabel: PropTypes.func,
        leafOnly: PropTypes.bool,
        loadedKeys: PropTypes.array,
        loadData: PropTypes.func,
        onLoad: PropTypes.func,
        disableStrictly: PropTypes.bool,
        draggable: PropTypes.bool,
        autoExpandWhenDragEnter: PropTypes.bool,
        hideDraggingNode: PropTypes.bool,
        renderDraggingNode: PropTypes.func,
        onDragEnd: PropTypes.func,
        onDragEnter: PropTypes.func,
        onDragLeave: PropTypes.func,
        onDragOver: PropTypes.func,
        onDragStart: PropTypes.func,
        onDrop: PropTypes.func,
        labelEllipsis: PropTypes.bool,
        checkRelation: PropTypes.string,
        'aria-label': PropTypes.string,
        preventScroll: PropTypes.bool,
    };

    static defaultProps = {
        showClear: true,
        disabled: false,
        blockNode: true,
        multiple: false,
        filterTreeNode: false,
        autoExpandParent: false,
        treeNodeFilterProp: 'label',
        defaultExpandAll: false,
        expandAll: false,
        onChangeWithObject: false,
        motion: true,
        leafOnly: false,
        showFilteredOnly: false,
        showLine: false,
        expandAction: false,
        disableStrictly: false,
        draggable: false,
        autoExpandWhenDragEnter: true,
        checkRelation: 'related',
        autoMergeValue: true,
    };

    static TreeNode: typeof TreeNode;
    inputRef: React.RefObject<typeof Input>;
    optionsRef: React.RefObject<any>;
    dragNode: any;
    onNodeClick: any;
    onMotionEnd: any;
    context: ContextValue;
    virtualizedListRef: React.RefObject<any>;

    constructor(props: TreeProps) {
        super(props);
        this.state = {
            inputValue: '',
            keyEntities: {},
            treeData: [],
            flattenNodes: [],
            selectedKeys: [],
            checkedKeys: new Set(),
            halfCheckedKeys: new Set(),
            realCheckedKeys: new Set([]),
            motionKeys: new Set([]),
            motionType: 'hide',
            expandedKeys: new Set(props.expandedKeys),
            filteredKeys: new Set(),
            filteredExpandedKeys: new Set(),
            filteredShownKeys: new Set(),
            prevProps: null,
            loadedKeys: new Set(),
            loadingKeys: new Set(),
            cachedFlattenNodes: undefined,
            cachedKeyValuePairs: {},
            disabledKeys: new Set(),
            dragging: false,
            dragNodesKeys: new Set(),
            dragOverNodeKey: null,
            dropPosition: null,
        };
        this.inputRef = React.createRef();
        this.optionsRef = React.createRef();
        this.foundation = new TreeFoundation(this.adapter);
        this.dragNode = null;
        this.virtualizedListRef = React.createRef();
    }

    /**
     * Process of getDerivedStateFromProps was inspired by rc-tree
     * https://github.com/react-component/tree
     */

    static getDerivedStateFromProps(props: TreeProps, prevState: TreeState) {
        const { prevProps } = prevState;
        const { keyMaps } = props;
        let treeData;
        let keyEntities = prevState.keyEntities || {};
        let valueEntities = prevState.cachedKeyValuePairs || {};
        const isSeaching = Boolean(props.filterTreeNode && prevState.inputValue && prevState.inputValue.length);
        const newState: Partial<TreeState> = {
            prevProps: props,
        };
        const isExpandControlled = 'expandedKeys' in props;

        // Accept a props field as a parameter to determine whether to update the field
        const needUpdate = (name: string) => {
            const firstInProps = !prevProps && name in props;
            const nameHasChange = prevProps && !isEqual(prevProps[name], props[name]);
            return firstInProps || nameHasChange;
        };

        // Determine whether treeData has changed
        const needUpdateData = () => {
            const firstInProps = !prevProps && 'treeData' in props;
            const treeDataHasChange = prevProps && prevProps.treeData !== props.treeData;
            return firstInProps || treeDataHasChange;
        };

        const needUpdateTreeData = needUpdate('treeData');
        const needUpdateSimpleJson = needUpdate('treeDataSimpleJson');

        // Update the data of tree in state
        if (needUpdateTreeData || (props.draggable && needUpdateData())) {
            treeData = props.treeData;
            newState.treeData = treeData;
            const entitiesMap = convertDataToEntities(treeData, keyMaps);
            newState.keyEntities = {
                ...entitiesMap.keyEntities,
            };
            keyEntities = newState.keyEntities;
            newState.cachedKeyValuePairs = { ...entitiesMap.valueEntities };
            valueEntities = newState.cachedKeyValuePairs;
        } else if (needUpdateSimpleJson) {
            // Convert treeDataSimpleJson to treeData
            treeData = convertJsonToData(props.treeDataSimpleJson);
            newState.treeData = treeData;
            const entitiesMap = convertDataToEntities(treeData, keyMaps);
            newState.keyEntities = {
                ...entitiesMap.keyEntities,
            };
            keyEntities = newState.keyEntities;
            newState.cachedKeyValuePairs = { ...entitiesMap.valueEntities };
            valueEntities = newState.cachedKeyValuePairs;
        }

        // If treeData keys changes, we won't show animation
        if (treeData && props.motion) {
            if (prevProps && props.motion) {
                newState.motionKeys = new Set([]);
                newState.motionType = null;
            }
        }
        const dataUpdated = needUpdateSimpleJson || needUpdateTreeData;
        const expandAllWhenDataChange = dataUpdated && props.expandAll;
        if (!isSeaching) {
            // Update expandedKeys
            if (needUpdate('expandedKeys') || (prevProps && needUpdate('autoExpandParent'))) {
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
                    props.defaultValue,
                    keyEntities,
                    props.multiple,
                    valueEntities
                );
            } else if (!prevProps && props.value) {
                newState.expandedKeys = calcExpandedKeysForValues(
                    props.value,
                    keyEntities,
                    props.multiple,
                    valueEntities
                );
            } else if ((!isExpandControlled && dataUpdated) && props.value) {
                // 当 treeData 已经设置具体的值，并且设置了 props.loadData ，则认为 treeData 的更新是因为 loadData 导致的
                // 如果是因为 loadData 导致 treeData改变， 此时在这里重新计算 key 会导致为未选中的展开项目被收起
                // 所以此时不需要重新计算 expandedKeys，因为在点击展开按钮时候已经把被展开的项添加到 expandedKeys 中
                // When treeData has a specific value and props.loadData is set, it is considered that the update of treeData is caused by loadData
                // If the treeData is changed because of loadData, recalculating the key here will cause the unselected expanded items to be collapsed
                // So there is no need to recalculate expandedKeys at this time, because the expanded item has been added to expandedKeys when the expand button is clicked
                if (!(prevState.treeData && prevState.treeData?.length > 0 && props.loadData)) {
                    newState.expandedKeys = calcExpandedKeysForValues(
                        props.value,
                        keyEntities,
                        props.multiple,
                        valueEntities
                    );
                }
            }

            if (!newState.expandedKeys) {
                delete newState.expandedKeys;
            }

            // Update flattenNodes
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

        // Handle single selection and multiple selection in controlled mode
        const withObject = props.onChangeWithObject;
        const isMultiple = props.multiple;
        if (!isMultiple) {
            // When getting single selection, the selected node
            if (needUpdate('value')) {
                newState.selectedKeys = findKeysForValues(
                    // In both cases whether withObject is turned on, the value is standardized to string
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
                }
            }
        } else {
            let checkedKeyValues;
            // Get the selected node during multiple selection
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

        // update loadedKeys
        if (needUpdate('loadedKeys')) {
            newState.loadedKeys = new Set(props.loadedKeys);
        }

        // update disableStrictly
        if (treeData && props.disableStrictly && props.checkRelation === 'related') {
            newState.disabledKeys = calcDisabledKeys(keyEntities, keyMaps);
        }

        return newState;
    }

    get adapter(): TreeAdapter {
        const filterAdapter: Pick<TreeAdapter, 'updateInputValue' | 'focusInput'> = {
            updateInputValue: value => {
                this.setState({ inputValue: value });
            },
            focusInput: () => {
                const { preventScroll } = this.props;
                if (this.inputRef && this.inputRef.current) {
                    (this.inputRef.current as any).focus({ preventScroll });
                }
            },
        };
        return {
            ...super.adapter,
            ...filterAdapter,
            updateState: states => {
                this.setState({ ...states } as TreeState);
            },
            notifyExpand: (expandedKeys, { expanded: bool, node }) => {
                this.props.onExpand && this.props.onExpand([...expandedKeys], { expanded: bool, node });
                if (bool && this.props.loadData) {
                    this.onNodeLoad(node);
                }
            },
            notifySelect: (selectKey, bool, node) => {
                this.props.onSelect && this.props.onSelect(selectKey, bool, node);
            },
            notifyChange: value => {
                this.props.onChange && this.props.onChange(value);
            },
            notifySearch: (input: string, filteredExpandedKeys: string[]) => {
                this.props.onSearch && this.props.onSearch(input, filteredExpandedKeys);
            },
            notifyRightClick: (e, node) => {
                this.props.onContextMenu && this.props.onContextMenu(e, node);
            },
            notifyDoubleClick: (e, node) => {
                this.props.onDoubleClick && this.props.onDoubleClick(e, node);
            },
            cacheFlattenNodes: bool => {
                this.setState({ cachedFlattenNodes: bool ? cloneDeep(this.state.flattenNodes) : undefined });
            },
            setDragNode: treeNode => {
                this.dragNode = treeNode;
            },
        };
    }

    search = (value: string) => {
        this.foundation.handleInputChange(value);
    };

    scrollTo = (scrollData: ScrollData) => {
        const { key, align = 'center' } = scrollData;
        const { flattenNodes } = this.state;
        if (key) {
            const index = flattenNodes?.findIndex((node) => {
                return node.key === key;
            });
            index >= 0 && (this.virtualizedListRef.current as any)?.scrollToItem(index, align);
        }
    }

    renderInput() {
        const {
            searchClassName,
            searchStyle,
            searchRender,
            searchPlaceholder,
            showClear
        } = this.props;
        if (searchRender === false) {
            return null;
        }
        const inputcls = cls(`${prefixcls}-input`);
        const { inputValue } = this.state;
        const inputProps = {
            value: inputValue,
            className: inputcls,
            onChange: (value: string) => this.search(value),
            prefix: <IconSearch />,
            showClear,
            placeholder: searchPlaceholder,
        };
        const wrapperCls = cls(`${prefixcls}-search-wrapper`, searchClassName);
        return (
            <div className={wrapperCls} style={searchStyle}>
                <LocaleConsumer componentName="Tree">
                    {(locale: LocaleObject) => {
                        inputProps.placeholder = searchPlaceholder || get(locale, 'searchPlaceholder');
                        if (isFunction(searchRender)) {
                            return searchRender({ ...inputProps });
                        }
                        return (
                            <Input
                                aria-label='Filter Tree'
                                ref={this.inputRef as any}
                                {...inputProps}
                            />
                        );
                    }}
                </LocaleConsumer>
            </div>
        );
    }

    renderEmpty = () => {
        const { emptyContent } = this.props;
        if (emptyContent) {
            return <TreeNode empty emptyContent={this.props.emptyContent} />;
        } else {
            return (
                <LocaleConsumer componentName="Tree">
                    {(locale: LocaleObject) => <TreeNode empty emptyContent={get(locale, 'emptyText')} />}
                </LocaleConsumer>
            );
        }
    };

    onNodeSelect = (e: MouseEvent | KeyboardEvent, treeNode: TreeNodeProps) => {
        this.foundation.handleNodeSelect(e, treeNode);
    };

    onNodeLoad = (data: TreeNodeData) => (
        new Promise(resolve => {
            // We need to get the latest state of loading/loaded keys
            this.setState(({ loadedKeys = new Set([]), loadingKeys = new Set([]) }) => (
                this.foundation.handleNodeLoad(loadedKeys, loadingKeys, data, resolve)
            ));
        })
    );

    onNodeCheck = (e: MouseEvent | KeyboardEvent, treeNode: TreeNodeProps) => {
        this.foundation.handleNodeSelect(e, treeNode);
    };

    onNodeExpand = (e: MouseEvent | KeyboardEvent, treeNode: TreeNodeProps) => {
        this.foundation.handleNodeExpand(e, treeNode);
    };

    onNodeRightClick = (e: MouseEvent, treeNode: TreeNodeProps) => {
        this.foundation.handleNodeRightClick(e, treeNode);
    };

    onNodeDoubleClick = (e: MouseEvent, treeNode: TreeNodeProps) => {
        this.foundation.handleNodeDoubleClick(e, treeNode);
    };

    onNodeDragStart = (e: React.DragEvent<HTMLLIElement>, treeNode: TreeNodeProps) => {
        this.foundation.handleNodeDragStart(e, treeNode);
    };

    onNodeDragEnter = (e: React.DragEvent<HTMLLIElement>, treeNode: TreeNodeProps) => {
        this.foundation.handleNodeDragEnter(e, treeNode, this.dragNode);
    };

    onNodeDragOver = (e: React.DragEvent<HTMLLIElement>, treeNode: TreeNodeProps) => {
        this.foundation.handleNodeDragOver(e, treeNode, this.dragNode);
    };

    onNodeDragLeave = (e: React.DragEvent<HTMLLIElement>, treeNode: TreeNodeProps) => {
        this.foundation.handleNodeDragLeave(e, treeNode);
    };

    onNodeDragEnd = (e: React.DragEvent<HTMLLIElement>, treeNode: TreeNodeProps) => {
        this.foundation.handleNodeDragEnd(e, treeNode);
    };

    onNodeDrop = (e: React.DragEvent<HTMLLIElement>, treeNode: TreeNodeProps) => {
        this.foundation.handleNodeDrop(e, treeNode, this.dragNode);
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
        const { key } = data;
        return key;
    };

    renderTreeNode = (treeNode: FlattenNode, ind?: number, style?: React.CSSProperties) => {
        const { data, key } = treeNode;
        const treeNodeProps = this.foundation.getTreeNodeProps(key);
        if (!treeNodeProps) {
            return null;
        }
        const { keyMaps, showLine, expandIcon } = this.props;
        const props: any = pick(treeNode, ['key', 'label', 'disabled', 'isLeaf', 'icon', 'isEnd']);
        const children = data[get(keyMaps, 'children', 'children')];
        !isUndefined(children) && (props.children = children);
        return <TreeNode 
            {...treeNodeProps} 
            {...data} 
            {...props} 
            showLine={showLine} 
            data={data}
            expandIcon={expandIcon}
            style={isEmpty(style) ? {} : style} 
        />;
    };

    itemKey = (index: number, data: KeyEntity) => {
        // Find the item at the specified index.
        const item = data[index];
        // Return a value that uniquely identifies this item.
        return item.key;
    };

    option = ({ index, style, data }: OptionProps) => (
        this.renderTreeNode(data[index], index, style)
    );

    renderNodeList() {
        const { flattenNodes, cachedFlattenNodes, motionKeys, motionType } = this.state;
        const { virtualize, motion } = this.props;
        const { direction } = this.context;
        if (isEmpty(flattenNodes)) {
            return undefined;
        }
        if (!virtualize || isEmpty(virtualize)) {
            return (
                <NodeList
                    flattenNodes={flattenNodes}
                    flattenList={cachedFlattenNodes}
                    motionKeys={motion ? motionKeys : new Set([])}
                    motionType={motionType}
                    onMotionEnd={this.onMotionEnd}
                    renderTreeNode={this.renderTreeNode}
                />
            );
        }

        return (
            <AutoSizer defaultHeight={virtualize.height} defaultWidth={virtualize.width}>
                {({ height, width }: { width: string | number; height: string | number }) => (
                    <VirtualList
                        ref={this.virtualizedListRef}
                        itemCount={flattenNodes.length}
                        itemSize={virtualize.itemSize}
                        height={height}
                        width={width}
                        itemKey={this.itemKey}
                        itemData={flattenNodes as any}
                        className={`${prefixcls}-virtual-list`}
                        style={{ direction }}
                    >
                        {this.option}
                    </VirtualList>
                )}
            </AutoSizer>
        );
    }

    render() {
        const {
            keyEntities,
            motionKeys,
            motionType,
            inputValue,
            filteredKeys,
            dragOverNodeKey,
            dropPosition,
            checkedKeys,
            realCheckedKeys,
        } = this.state;

        const {
            blockNode,
            className,
            style,
            filterTreeNode,
            disabled,
            icon,
            directory,
            multiple,
            showFilteredOnly,
            showLine,
            motion,
            expandAction,
            loadData,
            renderLabel,
            draggable,
            renderFullLabel,
            labelEllipsis,
            virtualize,
            checkRelation,
            ...rest
        } = this.props;
        const wrapperCls = cls(`${prefixcls}-wrapper`, className);
        const listCls = cls(`${prefixcls}-option-list`, {
            [`${prefixcls}-option-list-block`]: blockNode,
        });
        const searchNoRes = Boolean(inputValue) && !filteredKeys.size;
        const noData = isEmpty(keyEntities) || (showFilteredOnly && searchNoRes);
        const ariaAttr = {
            role: noData ? 'none' : 'tree'
        };
        if (ariaAttr.role === 'tree') {
            ariaAttr['aria-multiselectable'] = multiple ? true : false;
        }
        return (
            <TreeContext.Provider
                value={{
                    treeDisabled: disabled,
                    treeIcon: icon,
                    motion,
                    motionKeys,
                    motionType,
                    filterTreeNode,
                    keyEntities,
                    onNodeClick: this.onNodeClick,
                    onNodeExpand: this.onNodeExpand,
                    onNodeSelect: this.onNodeSelect,
                    onNodeCheck: this.onNodeCheck,
                    onNodeRightClick: this.onNodeRightClick,
                    onNodeDoubleClick: this.onNodeDoubleClick,
                    renderTreeNode: this.renderTreeNode,
                    onNodeDragStart: this.onNodeDragStart,
                    onNodeDragEnter: this.onNodeDragEnter,
                    onNodeDragOver: this.onNodeDragOver,
                    onNodeDragLeave: this.onNodeDragLeave,
                    onNodeDragEnd: this.onNodeDragEnd,
                    onNodeDrop: this.onNodeDrop,
                    expandAction,
                    directory,
                    multiple,
                    showFilteredOnly,
                    isSearching: Boolean(inputValue),
                    loadData,
                    onNodeLoad: this.onNodeLoad,
                    renderLabel,
                    draggable,
                    renderFullLabel,
                    dragOverNodeKey,
                    dropPosition,
                    labelEllipsis: typeof labelEllipsis === 'undefined' ? virtualize : labelEllipsis,
                }}
            >
                <div aria-label={this.props['aria-label']} className={wrapperCls} style={style} {...this.getDataAttr(rest)}>
                    {filterTreeNode ? this.renderInput() : null}
                    <div className={listCls} {...ariaAttr}>
                        {noData ? this.renderEmpty() : (multiple ?
                            (<CheckboxGroup value={Array.from(checkRelation === 'related' ? checkedKeys : realCheckedKeys)}>
                                {this.renderNodeList()}
                            </CheckboxGroup>) :
                            this.renderNodeList()
                        )}
                    </div>
                </div>
            </TreeContext.Provider>
        );
    }
}

Tree.TreeNode = TreeNode;
export default Tree;
