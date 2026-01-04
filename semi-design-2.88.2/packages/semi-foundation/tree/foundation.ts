/**
 * The drag and drop handler implementation is referenced from rc-tree
 * https://github.com/react-component/tree
 */

import { isUndefined, difference, pick, get } from 'lodash';
import BaseFoundation, { DefaultAdapter } from '../base/foundation';
import {
    flattenTreeData,
    findDescendantKeys,
    findAncestorKeys,
    filter,
    normalizedArr,
    normalizeKeyList,
    getMotionKeys,
    calcCheckedKeysForChecked,
    calcCheckedKeysForUnchecked,
    calcCheckedKeys,
    getValueOrKey,
    getDragNodesKeys,
    calcDropRelativePosition,
    calcDropActualPosition
} from './treeUtil';

import type { KeyMapProps } from './treeUtil';
import { strings } from './constants';
export type { KeyMapProps };

export interface BasicTreeNodeProps {
    [x: string]: any;
    expanded?: boolean;
    selected?: boolean;
    checked?: boolean;
    halfChecked?: boolean;
    active?: boolean;
    disabled?: boolean;
    loaded?: boolean;
    loading?: boolean;
    isLeaf?: boolean;
    pos?: string;
    children?: BasicTreeNodeData[];
    icon?: any;
    directory?: boolean;
    selectedKey?: string;
    motionKey?: string[] | string;
    eventKey?: string;
    showLine?: boolean
}

export interface BasicTreeNodeData {
    [x: string]: any;
    key?: string;
    value?: number | string;
    label?: any;
    icon?: any;
    disabled?: boolean;
    isLeaf?: boolean;
    children?: BasicTreeNodeData[]
}

export interface BasicKeyEntities {
    [key: string]: BasicKeyEntity
}

export interface BasicKeyEntity {
    children?: BasicKeyEntities;
    data?: BasicTreeNodeData;
    ind?: number;
    key?: string;
    level?: number;
    parent?: undefined | BasicKeyEntity;
    parentPos?: null | string;
    pos?: string
}

export interface BasicDragTreeNode extends BasicTreeNodeData {
    expanded: boolean;
    /**
     * The positional relationship of the current node in the entire
     * treeData, such as the 0th node of the 2nd node of the 1st node
     * of the 0th layer: '0-1-2-0'
     */
    pos: string
}

export interface BasicFlattenNode {
    _innerDataTag?: boolean;
    children?: BasicFlattenNode[];
    data?: BasicTreeNodeData;
    key?: string;
    label?: any;
    parent?: null | BasicFlattenNode;
    pos?: string;
    value?: string
}

export interface BasicDragProps {
    event: any;
    node: BasicDragTreeNode
}

export interface BasicDragEnterProps extends BasicDragProps {
    expandedKeys?: string[]
}

export type ExpandAction = false | 'click' | 'doubleClick';

export type BasicValue = string | number | BasicTreeNodeData | Array<BasicTreeNodeData | string | number>;

export interface BasicOnDragProps {
    event: any;
    node: BasicDragTreeNode;
    dragNode: BasicDragTreeNode;
    dragNodesKeys: string[];
    /**
     * dropPosition represents the position of the dragged node being
     * dropped in the current level. If inserted before the 0th node 
     * of the same level, it is -1, after the 0th node, it is 1, and 
     * it is 0 when it falls on it. And so on. With dropToGap, a more 
     * complete judgment can be obtained.
     */
    dropPosition: number;
    /**
     * Indicates whether the dragged node is dropped between nodes, if
     *  it is false, it is dropped above a node
     */
    dropToGap: boolean
}

export interface BasicRenderFullLabelProps {
    /* Click the callback of the entire row to control the expansion behavior and selection */
    onClick: (e: any) => void;
    /* Right-click the callback for the entire row */
    onContextMenu: (e: any) => void;
    /* Double-click the entire line of callback */
    onDoubleClick: (e: any) => void;
    /* Class name, including built-in styles such as indentation, expand button, filter, disable, select, etc. */
    className: string;
    /* Expand callback */
    onExpand: (e: any) => void;
    /* The original data of the row */
    data: BasicTreeNodeData;
    /* The level of the line can be used to customize the indentation value */
    level: number;
    /* The style required for virtualization, if virtualization is used, the style must be assigned to the DOM element */
    style: any;
    /* Multi-select click callback */
    onCheck: (e: any) => void;
    /* icon of Expand button */
    expandIcon: any;
    /* Selected state */
    checkStatus: {
        /* Whether to select in the multi-select state */
        checked: boolean;
        /* Whether to half-select in the multi-select state */
        halfChecked: boolean
    };
    /* Expand status */
    expandStatus: {
        /* Has it been expanded */
        expanded: boolean;
        /* Is it unfolding */
        loading: boolean
    };
    /* Whether the node meets the search conditions */
    filtered: boolean | undefined;
    /* Current search box input */
    searchWord: string | undefined
}

export interface BasicSearchRenderProps {
    className: string;
    placeholder: string;
    prefix: any;
    showClear?: boolean;
    value: string;
    onChange: (value: string) => void
}

export interface TreeDataSimpleJson {
    [x: string]: string | TreeDataSimpleJson
}

export interface Virtualize {
    itemSize: number;
    height?: number | string;
    width?: number | string
}

export type CheckRelation = 'related' | 'unRelated';

export interface BasicTreeProps {
    autoExpandParent?: boolean;
    autoExpandWhenDragEnter?: boolean;
    blockNode?: boolean;
    children?: any;
    className?: string;
    expandAll?: boolean;
    defaultExpandAll?: boolean;
    defaultExpandedKeys?: string[];
    defaultValue?: BasicValue;
    directory?: boolean;
    disabled?: boolean;
    disableStrictly?: boolean;
    draggable?: boolean;
    emptyContent?: any;
    expandAction?: ExpandAction;
    expandedKeys?: string[];
    filterTreeNode?: boolean | ((inputValue: string, treeNodeString: string, data?: BasicTreeNodeData) => boolean);
    hideDraggingNode?: boolean;
    labelEllipsis?: boolean;
    leafOnly?: boolean;
    loadData?: (treeNode?: BasicTreeNodeData) => Promise<void>;
    loadedKeys?: string[];
    motion?: boolean;
    multiple?: boolean;
    onChange?: (value?: BasicValue) => void;
    onChangeWithObject?: boolean;
    onDoubleClick?: (e: any, node: BasicTreeNodeData) => void;
    onDragEnd?: (dragProps: BasicDragProps) => void;
    onDragEnter?: (dragEnterProps: BasicDragEnterProps) => void;
    onDragLeave?: (dragProps: BasicDragProps) => void;
    onDragOver?: (dragProps: BasicDragProps) => void;
    onDragStart?: (dragProps: BasicDragProps) => void;
    onDrop?: (onDragProps: BasicOnDragProps) => void;
    onExpand?: (expandedKeys: string[], expandedOtherProps: BasicExpandedOtherProps) => void;
    onLoad?: (loadedKeys?: Set<string>, treeNode?: BasicTreeNodeData) => void;
    onContextMenu?: (e: any, node: BasicTreeNodeData) => void;
    onSearch?: (sunInput: string, filteredExpandedKeys: string[]) => void;
    onSelect?: (selectedKey: string, selected: boolean, selectedNode: BasicTreeNodeData) => void;
    preventScroll?: boolean;
    renderDraggingNode?: (nodeInstance: HTMLElement, node: BasicTreeNodeData) => HTMLElement;
    renderFullLabel?: (renderFullLabelProps: BasicRenderFullLabelProps) => any;
    renderLabel?: (label?: any, treeNode?: BasicTreeNodeData) => any;
    searchClassName?: string;
    searchPlaceholder?: string;
    searchRender?: ((searchRenderProps: BasicSearchRenderProps) => any) | false;
    searchStyle?: any;
    showClear?: boolean;
    showFilteredOnly?: boolean;
    showLine?: boolean;
    style?: any;
    treeData?: BasicTreeNodeData[];
    treeDataSimpleJson?: TreeDataSimpleJson;
    treeNodeFilterProp?: string;
    value?: BasicValue;
    virtualize?: Virtualize;
    icon?: any;
    checkRelation?: CheckRelation;
    'aria-label'?: string
}

/* Data maintained internally. At the React framework level, corresponding to state */
export interface BasicTreeInnerData {
    /* The input content of the input box */
    inputValue: string;
    /* keyEntities */
    keyEntities: BasicKeyEntities;
    /* treeData */
    treeData: BasicTreeNodeData[];
    /* Expanded node */
    flattenNodes: BasicFlattenNode[];
    /* The selected node when single-selected */
    selectedKeys: string[];
    /* Select all nodes in multiple selection */
    checkedKeys: Set<string>;
    /* Half-selected node when multiple selection */
    halfCheckedKeys: Set<string>;
    /* real selected nodes in multiple selection */
    realCheckedKeys: Set<string>;
    /* Animation node */
    motionKeys: Set<string>;
    /* Animation type */
    motionType: string;
    /* Expand node */
    expandedKeys: Set<string>;
    /* Searched node */
    filteredKeys: Set<string>;
    /* The ancestor node expanded because of the searched node*/
    filteredExpandedKeys: Set<string>;
    /* Because of the searched node, the expanded ancestor node + the searched node + the descendant nodes of the searched node */
    filteredShownKeys: Set<string>;
    /* Prev props */
    prevProps: null | BasicTreeProps;
    /* loaded nodes */
    loadedKeys: Set<string>;
    /* loading nodes */
    loadingKeys: Set<string>;
    /* cache */
    cachedFlattenNodes: BasicFlattenNode[] | undefined;
    cachedKeyValuePairs: { [x: string]: string };
    /* Strictly disabled node */
    disabledKeys: Set<string>;
    /* Is dragging */
    dragging: boolean;
    /* Dragged node */
    dragNodesKeys: Set<string>;
    /* DragOver node */
    dragOverNodeKey: string[] | string | null;
    /* Drag position */
    dropPosition: number | null
}

export interface BasicExpandedOtherProps {
    expanded: boolean;
    node: BasicTreeNodeData
}

export interface TreeAdapter extends DefaultAdapter<BasicTreeProps, BasicTreeInnerData> {
    updateInputValue: (value: string) => void;
    focusInput: () => void;
    updateState: (states: Partial<BasicTreeInnerData>) => void;
    notifyExpand: (expandedKeys: Set<string>, { expanded, node }: BasicExpandedOtherProps) => void;
    notifySelect: (selectKey: string, bool: boolean, node: BasicTreeNodeData) => void;
    notifyChange: (value: BasicValue) => void;
    notifySearch: (input: string, filteredExpandedKeys: string[]) => void;
    notifyRightClick: (e: any, node: BasicTreeNodeData) => void;
    notifyDoubleClick: (e: any, node: BasicTreeNodeData) => void;
    cacheFlattenNodes: (bool: boolean) => void;
    setDragNode: (treeNode: any) => void
}

export default class TreeFoundation extends BaseFoundation<TreeAdapter, BasicTreeProps, BasicTreeInnerData> {
    delayedDragEnterLogic: any;

    constructor(adapter: TreeAdapter) {
        super({
            ...adapter,
        });
    }

    _isMultiple() {
        return this.getProp('multiple');
    }

    _isAnimated() {
        return this.getProp('motion');
    }

    _isDisabled(treeNode: BasicTreeNodeProps = {}) {
        return this.getProp('disabled') || treeNode.disabled;
    }

    _isExpandControlled() {
        return !isUndefined(this.getProp('expandedKeys'));
    }

    _isLoadControlled() {
        return !isUndefined(this.getProp('loadedKeys'));
    }

    _isFilterable() {
        // filter can be boolean or function
        return Boolean(this.getProp('filterTreeNode'));
    }

    _showFilteredOnly() {
        const { inputValue } = this.getStates();
        const { showFilteredOnly } = this.getProps();
        return Boolean(inputValue) && showFilteredOnly;
    }

    getTreeNodeProps(key: string) {
        const {
            expandedKeys = new Set([]),
            selectedKeys = [],
            checkedKeys = new Set([]),
            halfCheckedKeys = new Set([]),
            realCheckedKeys = new Set([]),
            keyEntities = {},
            filteredKeys = new Set([]),
            inputValue = '',
            loadedKeys = new Set([]),
            loadingKeys = new Set([]),
            filteredExpandedKeys = new Set([]),
            disabledKeys = new Set([]),
        } = this.getStates();
        const { treeNodeFilterProp, checkRelation } = this.getProps();
        const entity = keyEntities[key];
        const notExist = !entity;
        if (notExist) {
            return null;
        }
        // if checkRelation is invalid, the checked status of node will be false
        let realChecked = false;
        let realHalfChecked = false;
        if (checkRelation === 'related') {
            realChecked = checkedKeys.has(key);
            realHalfChecked = halfCheckedKeys.has(key);
        } else if (checkRelation === 'unRelated') {
            realChecked = realCheckedKeys.has(key);
            realHalfChecked = false;
        }
        const isSearching = Boolean(inputValue);
        const treeNodeProps: BasicTreeNodeProps = {
            eventKey: key,
            expanded: isSearching ? filteredExpandedKeys.has(key) : expandedKeys.has(key),
            selected: selectedKeys.includes(key),
            checked: realChecked,
            halfChecked: realHalfChecked,
            pos: String(entity ? entity.pos : ''),
            level: entity.level,
            filtered: filteredKeys.has(key),
            loading: loadingKeys.has(key) && !loadedKeys.has(key),
            loaded: loadedKeys.has(key),
            keyword: inputValue,
            treeNodeFilterProp,
        };

        if (this.getProp('disableStrictly') && disabledKeys.has(key)) {
            treeNodeProps.disabled = true;
        }

        return treeNodeProps;
    }

    notifyJsonChange(key: string[] | string, e: any) {
        const data = this.getProp('treeDataSimpleJson');
        const selectedPath = normalizedArr(key).map(i => i.replaceAll(strings.JSON_KEY_SPLIT, '.'));
        const value = pick(data, selectedPath);
        this._adapter.notifyChange(value as BasicValue);
    }

    constructDataForValue(value: string) {
        const { keyMaps } = this.getProps();
        const keyName = get(keyMaps, 'key', 'key');
        const labelName = get(keyMaps, 'label', 'label');
        return {
            [keyName]: value,
            [labelName]: value
        };    
    }

    findDataForValue(findValue: string) {
        const { value, defaultValue, keyMaps } = this.getProps();
        const realValueName = get(keyMaps, 'value', 'value');
        const realKeyName = get(keyMaps, 'key', 'key');
        let valueArr = [];
        if (value) {
            valueArr = Array.isArray(value) ? value : [value];
        } else if (defaultValue) {
            valueArr = Array.isArray(defaultValue) ? defaultValue : [defaultValue];
        }
        return valueArr.find(item => {
            return item[realValueName] === findValue || item[realKeyName] === findValue;
        });
    }

    getDataForKeyNotInKeyEntities(value: string) {
        const { onChangeWithObject } = this.getProps();
        if (onChangeWithObject) {
            return this.findDataForValue(value);
        } else {
            return this.constructDataForValue(value);
        }
    }

    notifyMultipleChange(key: string[], e: any) {
        const { keyEntities } = this.getStates();
        const { leafOnly, checkRelation, keyMaps, autoMergeValue } = this.getProps();
        let value;
        let keyList = [];
        if (checkRelation === 'related') {
            keyList = autoMergeValue ? normalizeKeyList(key, keyEntities, leafOnly, true) : key;
        } else if (checkRelation === 'unRelated') {
            keyList = key;
        }
        const nodes = keyList.map(key => keyEntities[key] ? keyEntities[key].data : this.getDataForKeyNotInKeyEntities(key));
        if (this.getProp('onChangeWithObject')) {
            value = nodes;
        } else {
            value = getValueOrKey(nodes, keyMaps);
        }
        this._adapter.notifyChange(value);
    }

    notifyChange(key: string[] | string, e: any) {
        const isMultiple = this._isMultiple();
        const { keyMaps } = this.getProps();
        const { keyEntities } = this.getStates();
        if (this.getProp('treeDataSimpleJson')) {
            this.notifyJsonChange(key, e);
        } else if (isMultiple) {
            this.notifyMultipleChange(key as string[], e);
        } else {
            let value;
            if (this.getProp('onChangeWithObject')) {
                value = get(keyEntities, key).data;
            } else {
                const { data } = get(keyEntities, key);
                value = getValueOrKey(data, keyMaps);
            }
            this._adapter.notifyChange(value);
        }
    }

    handleInputChange(sugInput: string) {
        // Input is a controlled component, so the value value needs to be updated
        this._adapter.updateInputValue(sugInput);
        const { expandedKeys, selectedKeys, keyEntities, treeData } = this.getStates();
        const { showFilteredOnly, filterTreeNode, treeNodeFilterProp, keyMaps } = this.getProps();
        const realFilterProp = treeNodeFilterProp !== 'label' ? treeNodeFilterProp : get(keyMaps, 'label', 'label');
        let filteredOptsKeys: string[] = [];
        let expandedOptsKeys: string[] = [];
        let flattenNodes: BasicFlattenNode[] = [];
        let filteredShownKeys = new Set([]);

        if (!sugInput) {
            expandedOptsKeys = findAncestorKeys(selectedKeys, keyEntities);
            expandedOptsKeys.forEach(item => expandedKeys.add(item));
            flattenNodes = flattenTreeData(treeData, expandedKeys, keyMaps);
        } else {
            filteredOptsKeys = Object.values(keyEntities)
                .filter((item: BasicKeyEntity) => filter(sugInput, item.data, filterTreeNode, realFilterProp))
                .map((item: BasicKeyEntity) => item.key);
            expandedOptsKeys = findAncestorKeys(filteredOptsKeys, keyEntities, false);
            const shownChildKeys = findDescendantKeys(filteredOptsKeys, keyEntities, true);
            filteredShownKeys = new Set([...shownChildKeys, ...expandedOptsKeys]);
            flattenNodes = flattenTreeData(
                treeData,
                new Set(expandedOptsKeys),
                keyMaps,
                showFilteredOnly && filteredShownKeys
            );
        }
        const newFilteredExpandedKeys = new Set(expandedOptsKeys);
        this._adapter.notifySearch(sugInput, Array.from(newFilteredExpandedKeys));
        this._adapter.updateState({
            expandedKeys,
            flattenNodes,
            motionKeys: new Set([]),
            filteredKeys: new Set(filteredOptsKeys),
            filteredExpandedKeys: newFilteredExpandedKeys,
            filteredShownKeys,
        });
    }

    handleNodeSelect(e: any, treeNode: BasicTreeNodeProps) {
        const isDisabled = this._isDisabled(treeNode);
        if (isDisabled) {
            return;
        }
        if (!this._isMultiple()) {
            this.handleSingleSelect(e, treeNode);
        } else {
            this.handleMultipleSelect(e, treeNode);
        }
    }

    handleNodeRightClick(e: any, treeNode: BasicTreeNodeProps) {
        this._adapter.notifyRightClick(e, treeNode.data);
    }

    handleNodeDoubleClick(e: any, treeNode: BasicTreeNodeProps) {
        this._adapter.notifyDoubleClick(e, treeNode.data);
    }

    handleSingleSelect(e: any, treeNode: BasicTreeNodeProps) {
        let selectedKeys = [...this.getState('selectedKeys')];
        const { selected, eventKey, data } = treeNode;
        const targetSelected = !selected;

        this._adapter.notifySelect(eventKey, true, data);

        if (!targetSelected) {
            return;
        }

        if (!selectedKeys.includes(eventKey)) {
            selectedKeys = [eventKey];
            this.notifyChange(eventKey, e);
            if (!this._isControlledComponent()) {
                this._adapter.updateState({ selectedKeys });
            }
        }
    }

    calcCheckedKeys(eventKey: string, targetStatus: boolean) {
        const { keyEntities } = this.getStates();
        const checkedKeys = new Set(this.getState('checkedKeys')) as Set<string>;
        const halfCheckedKeys = new Set(this.getState('halfCheckedKeys')) as Set<string>;
        return targetStatus ?
            calcCheckedKeysForChecked(eventKey, keyEntities, checkedKeys, halfCheckedKeys) :
            calcCheckedKeysForUnchecked(eventKey, keyEntities, checkedKeys, halfCheckedKeys);
    }

    /*
    * Compute the checked state of the node
    */
    calcCheckedStatus(targetStatus: boolean, eventKey: string) {
        // From checked to unchecked, you can change it directly
        if (!targetStatus) {
            return targetStatus;
        }
        // Starting from unchecked, you need to judge according to the descendant nodes
        const { checkedKeys, keyEntities, disabledKeys } = this.getStates();
        const descendantKeys = normalizeKeyList(findDescendantKeys([eventKey], keyEntities, false), keyEntities, true);
        const hasDisabled = descendantKeys.some((key: string) => disabledKeys.has(key));
        // If the descendant nodes are not disabled, they will be directly changed to checked
        if (!hasDisabled) {
            return targetStatus;
        }
        // If all descendant nodes that are not disabled are selected, return unchecked, otherwise, return checked
        const nonDisabledKeys = descendantKeys.filter((key: string) => !disabledKeys.has(key));
        const allChecked = nonDisabledKeys.every((key: string) => checkedKeys.has(key));
        return !allChecked;
    }

    /*
    * In strict disable mode, calculate the nodes of checked and halfCheckedKeys and return their corresponding keys
    */
    calcNonDisabledCheckedKeys(eventKey: string, targetStatus: boolean) {
        const { keyEntities, disabledKeys } = this.getStates();
        const checkedKeys = new Set(this.getState('checkedKeys'));
        const descendantKeys = normalizeKeyList(findDescendantKeys([eventKey], keyEntities, false), keyEntities, true);
        const hasDisabled = descendantKeys.some((key: string) => disabledKeys.has(key));
        // If none of the descendant nodes are disabled, follow the normal logic
        if (!hasDisabled) {
            return this.calcCheckedKeys(eventKey, targetStatus);
        }
        const nonDisabled = descendantKeys.filter((key: string) => !disabledKeys.has(key));
        const newCheckedKeys = targetStatus ?
            [...nonDisabled, ...checkedKeys] :
            difference(normalizeKeyList([...checkedKeys], keyEntities, true, true), nonDisabled);
        return calcCheckedKeys(newCheckedKeys, keyEntities);
    }

    /*
    * Handle the selection event in the case of multiple selection
    */
    handleMultipleSelect(e: any, treeNode: BasicTreeNodeProps) {
        const { disableStrictly, checkRelation } = this.getProps();
        const { realCheckedKeys } = this.getStates();
        // eventKey: The key value of the currently clicked node
        const { checked, eventKey, data } = treeNode;
        if (checkRelation === 'related') {
            // Find the checked state of the current node
            const targetStatus = disableStrictly ? this.calcCheckedStatus(!checked, eventKey) : !checked;
            const { checkedKeys, halfCheckedKeys } = disableStrictly ?
                this.calcNonDisabledCheckedKeys(eventKey, targetStatus) :
                this.calcCheckedKeys(eventKey, targetStatus);
            this._adapter.notifySelect(eventKey, targetStatus, data);
            this.notifyChange([...checkedKeys], e);
            if (!this._isControlledComponent()) {
                this._adapter.updateState({ checkedKeys, halfCheckedKeys });
            }
        } else if (checkRelation === 'unRelated') {
            const newRealCheckedKeys: Set<string> = new Set(realCheckedKeys);
            let targetStatus: boolean;
            if (realCheckedKeys.has(eventKey)) {
                newRealCheckedKeys.delete(eventKey);
                targetStatus = false;
            } else {
                newRealCheckedKeys.add(eventKey);
                targetStatus = true;
            }
            this._adapter.notifySelect(eventKey, targetStatus, data);
            this.notifyChange([...newRealCheckedKeys], e);
            if (!this._isControlledComponent()) {
                this._adapter.updateState({ realCheckedKeys: newRealCheckedKeys });
            }
        }
    }

    setExpandedStatus(treeNode: BasicTreeNodeProps) {
        const { inputValue, treeData, filteredShownKeys, keyEntities } = this.getStates();
        const { keyMaps } = this.getProps();
        const isSearching = Boolean(inputValue);
        const showFilteredOnly = this._showFilteredOnly();
        const expandedStateKey = isSearching ? 'filteredExpandedKeys' : 'expandedKeys';
        const expandedKeys = new Set(this.getState(expandedStateKey)) as Set<string>;

        let motionType = 'show';
        const { eventKey, expanded, data } = treeNode;
        if (!expanded) {
            expandedKeys.add(eventKey);
        } else if (expandedKeys.has(eventKey)) {
            expandedKeys.delete(eventKey);
            motionType = 'hide';
        }
        this._adapter.cacheFlattenNodes(motionType === 'hide' && this._isAnimated());

        if (!this._isExpandControlled()) {
            const flattenNodes = flattenTreeData(
                treeData,
                expandedKeys,
                keyMaps,
                isSearching && showFilteredOnly && filteredShownKeys
            );
            const motionKeys = this._isAnimated() ? getMotionKeys(eventKey, expandedKeys, keyEntities) : [];
            const newState = {
                [expandedStateKey]: expandedKeys,
                flattenNodes,
                motionKeys: new Set(motionKeys),
                motionType,
            };
            this._adapter.updateState(newState);
        }

        return {
            expandedKeys,
            expanded: !expanded,
            data,
        };
    }

    handleNodeExpand(e: any, treeNode: BasicTreeNodeProps) {
        const { loadData } = this.getProps();
        if (!loadData && (!treeNode.children || !treeNode.children.length)) {
            return;
        }

        const { expandedKeys, data, expanded } = this.setExpandedStatus(treeNode);
        this._adapter.notifyExpand(expandedKeys, {
            expanded,
            node: data,
        });
    }

    handleNodeLoad(loadedKeys: Set<string>, loadingKeys: Set<string>, data: BasicTreeNodeData, resolve: (value?: any) => void) {
        const { loadData, onLoad } = this.getProps();
        const { key } = data;
        if (!loadData || loadedKeys.has(key) || loadingKeys.has(key)) {
            return {};
        }

        // Process the loaded data
        loadData(data).then(() => {
            const prevLoadedKeys = new Set(this.getState('loadedKeys')) as Set<string>;
            const prevLoadingKeys = new Set(this.getState('loadingKeys')) as Set<string>;
            const newLoadedKeys = prevLoadedKeys.add(key);
            const newLoadingKeys = new Set([...prevLoadingKeys]);
            newLoadingKeys.delete(key);

            // onLoad should be triggered before internal setState to avoid `loadData` being triggered twice
            onLoad && onLoad(newLoadedKeys, data);

            if (!this._isLoadControlled()) {
                this._adapter.updateState({
                    loadedKeys: newLoadedKeys,
                });
            }
            this._adapter.setState({
                loadingKeys: newLoadingKeys,
            } as any);

            resolve();
        });

        return {
            loadingKeys: loadingKeys.add(key),
        };
    }

    // Drag and drop related processing logic
    getDragEventNodeData(node: BasicTreeNodeData) {
        return {
            ...node.data,
            ...pick(node, ['expanded', 'pos', 'children']),
        };
    }

    triggerDragEvent(name: string, event: any, node: BasicTreeNodeData, extra = {}) {
        const callEvent = this.getProp(name);
        callEvent &&
            callEvent({
                event,
                node: this.getDragEventNodeData(node),
                ...extra,
            });
    }

    clearDragState = () => {
        this._adapter.updateState({
            dragOverNodeKey: '',
            dragging: false,
        });
    };

    handleNodeDragStart(e: any, treeNode: BasicTreeNodeData) {
        const { keyEntities } = this.getStates();
        const { hideDraggingNode, renderDraggingNode } = this.getProps();
        const { eventKey, nodeInstance, data } = treeNode;

        if (hideDraggingNode || renderDraggingNode) {
            let dragImg;
            if (typeof renderDraggingNode === 'function') {
                dragImg = renderDraggingNode(nodeInstance, data);
            } else if (hideDraggingNode) {
                dragImg = nodeInstance.cloneNode(true);
                dragImg.style.opacity = 0;
            }
            document.body.appendChild(dragImg);
            e.dataTransfer.setDragImage(dragImg, 0, 0);
        }

        this._adapter.setDragNode(treeNode);

        this._adapter.updateState({
            dragging: true,
            dragNodesKeys: new Set(getDragNodesKeys(eventKey, keyEntities)),
        });

        this.triggerDragEvent('onDragStart', e, treeNode);
    }

    handleNodeDragEnter(e: any, treeNode: BasicTreeNodeData, dragNode: any) {
        const { dragging, dragNodesKeys } = this.getStates();
        const { autoExpandWhenDragEnter } = this.getProps();
        const { pos, eventKey, expanded } = treeNode;
        if (!dragNode || dragNodesKeys.has(eventKey)) {
            return;
        }
        const dropPosition = calcDropRelativePosition(e, treeNode);

        // If the drag node is itself, skip
        if (dragNode.eventKey === eventKey && dropPosition === 0) {
            this._adapter.updateState({
                dragOverNodeKey: '',
                dropPosition: null,
            });
            return;
        }

        // Trigger dragenter after clearing the prev state in dragleave
        setTimeout(() => {
            this._adapter.updateState({
                dragOverNodeKey: eventKey,
                dropPosition,
            });

            // If autoExpand is already expanded or not allowed, trigger the event and return
            if (!autoExpandWhenDragEnter || expanded) {
                this.triggerDragEvent('onDragEnter', e, treeNode);
                return;
            }

            // Side effects of delayed drag
            if (!this.delayedDragEnterLogic) {
                this.delayedDragEnterLogic = {};
            }

            Object.keys(this.delayedDragEnterLogic).forEach(key => {
                clearTimeout(this.delayedDragEnterLogic[key]);
            });

            this.delayedDragEnterLogic[pos] = window.setTimeout(() => {
                if (!dragging) {
                    return;
                }

                const { expandedKeys: newExpandedKeys } = this.setExpandedStatus(treeNode);
                this.triggerDragEvent('onDragEnter', e, treeNode, { expandedKeys: [...newExpandedKeys] });
            }, 400);
        }, 0);
    }

    handleNodeDragOver(e: any, treeNode: BasicTreeNodeData, dragNode: any) {
        const { dropPosition, dragNodesKeys, dragOverNodeKey } = this.getStates();
        const { eventKey } = treeNode;

        if (dragNodesKeys.has(eventKey)) {
            return;
        }

        // Update the drag position
        if (dragNode && eventKey === dragOverNodeKey) {
            const newPos = calcDropRelativePosition(e, treeNode);
            if (dropPosition === newPos) {
                return;
            }
            this._adapter.updateState({
                dropPosition: newPos,
            });
        }

        this.triggerDragEvent('onDragOver', e, treeNode);
    }

    handleNodeDragLeave(e: any, treeNode: BasicTreeNodeData) {
        this._adapter.updateState({
            dragOverNodeKey: '',
        });
        this.triggerDragEvent('onDragLeave', e, treeNode);
    }

    handleNodeDragEnd(e: any, treeNode: BasicTreeNodeData) {
        this.clearDragState();
        this.triggerDragEvent('onDragEnd', e, treeNode);
        this._adapter.setDragNode(null);
    }

    handleNodeDrop(e: any, treeNode: BasicTreeNodeData, dragNode: any) {
        const { dropPosition, dragNodesKeys } = this.getStates();
        const { eventKey, pos } = treeNode;
        this.clearDragState();
        if (dragNodesKeys.has(eventKey)) {
            return;
        }

        const dropRes = {
            dragNode: dragNode ? this.getDragEventNodeData(dragNode) : null,
            dragNodesKeys: [...dragNodesKeys],
            dropPosition: calcDropActualPosition(pos, dropPosition),
            dropToGap: dropPosition !== 0,
        };

        this.triggerDragEvent('onDrop', e, treeNode, dropRes);
        this._adapter.setDragNode(null);
    }
}
